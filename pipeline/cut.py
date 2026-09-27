"""Cut the national files down to each box. Every function reads its inputs read-only and returns data or writes
only into the temp folder it is given; run_pc.py decides where the results go."""
import io, json, math, os, tempfile, zipfile
import shapely
from shapely.geometry import shape, mapping, box as sbox, Polygon, MultiPolygon
from common import grow, overlaps, MARGIN_M, m_per_deg_lon, M_PER_DEG_LAT


def _round(c, nd):
    return round(c, nd) if isinstance(c, (int, float)) else [_round(x, nd) for x in c]


def round_geom(geom, nd=6):
    """GeoJSON geometry with coordinates rounded (6 decimals ≈ 0.1 m) and tuples turned into lists."""
    return {"type": geom["type"], "coordinates": _round(geom["coordinates"], nd)}


# ---------------------------------------------------------------- terrain
def fabdem_tiles_for(bbox, tile_dir):
    """The FABDEM 1° tiles a bbox touches (named by their south-west corner, e.g. N14E120_FABDEM_V1-2.tif)."""
    lon0, lat0, lon1, lat1 = bbox
    out = []
    for la in range(math.floor(lat0), math.floor(lat1) + 1):
        for lo in range(math.floor(lon0), math.floor(lon1) + 1):
            p = os.path.join(tile_dir, f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}_FABDEM_V1-2.tif")
            if not os.path.exists(p):
                raise FileNotFoundError(p)
            out.append(p)
    return out


def clip_fabdem(bbox, tile_dir, margin_m=MARGIN_M):
    """(2-D float32 array, GeoTIFF profile) of FABDEM over bbox + margin, merged across tile edges.
    Whole tiles are merged first and then cropped outward to whole pixels: merging straight to the bounds
    leaves a nodata column at a tile edge."""
    import rasterio
    from rasterio.merge import merge
    from rasterio.windows import from_bounds, Window, transform as wtransform
    b = grow(bbox, margin_m)
    srcs = [rasterio.open(p) for p in fabdem_tiles_for(b, tile_dir)]
    try:
        arr, tr = merge(srcs, nodata=-9999.0, dtype="float32")
        prof = srcs[0].profile.copy()
    finally:
        for s in srcs:
            s.close()
    w = from_bounds(*b, transform=tr)
    c0, r0 = int(math.floor(w.col_off)), int(math.floor(w.row_off))
    c1, r1 = int(math.ceil(w.col_off + w.width)), int(math.ceil(w.row_off + w.height))
    sub = arr[0, r0:r1, c0:c1]
    prof.update(driver="GTiff", height=sub.shape[0], width=sub.shape[1], transform=wtransform(Window(c0, r0, c1 - c0, r1 - r0), tr),
                count=1, dtype="float32", nodata=-9999.0, compress="deflate")
    return sub, prof


# ---------------------------------------------------------------- buildings
def scan_buildings(parquet, boxes, tmp_dir, margin_m=MARGIN_M, mem="2GB", threads=2, batch=50000):
    """One DuckDB scan of the buildings file. Footprints touching each box (+margin) are appended to
    <tmp_dir>/<box>.ndjson as [px, py, source, geometry]; a footprint in two boxes goes to both.
    Returns how many footprints matched any box."""
    import duckdb
    big = {k: grow(b, margin_m) for k, b in boxes.items()}
    cond = " OR ".join(f"(bbox.xmin <= {b[2]!r} AND bbox.xmax >= {b[0]!r} AND bbox.ymin <= {b[3]!r} AND bbox.ymax >= {b[1]!r})"
                       for b in big.values())
    con = duckdb.connect()
    con.execute(f"SET memory_limit='{mem}'")
    con.execute(f"SET threads={int(threads)}")
    parts = {k: open(os.path.join(tmp_dir, f"{k}.ndjson"), "w", encoding="utf-8") for k in boxes}
    n = 0
    try:
        rdr = con.execute("SELECT bbox.xmin AS x0, bbox.ymin AS y0, bbox.xmax AS x1, bbox.ymax AS y1, bf_source, geometry "
                          f"FROM read_parquet(?) WHERE {cond}", [parquet]).to_arrow_reader(batch)
        for rb in rdr:
            d = rb.to_pydict()
            geoms = shapely.from_wkb(d["geometry"])
            reps = shapely.point_on_surface(geoms)
            for i, g in enumerate(geoms):
                bb = (d["x0"][i], d["y0"][i], d["x1"][i], d["y1"][i])
                line = None
                for k, b in big.items():
                    if overlaps(bb, b):
                        if line is None:
                            line = json.dumps([round(reps[i].x, 7), round(reps[i].y, 7), d["bf_source"][i], round_geom(mapping(g))])
                        parts[k].write(line + "\n")
                n += 1
    finally:
        for f in parts.values():
            f.close()
    return n


def box_buildings(tmp_dir, key):
    """The footprints scan_buildings() wrote for one box, sorted by representative point so ids are stable."""
    with open(os.path.join(tmp_dir, f"{key}.ndjson"), encoding="utf-8") as f:
        rows = [json.loads(l) for l in f]
    rows.sort(key=lambda r: (r[0], r[1], json.dumps(r[3])))
    return [{"type": "Feature", "properties": {"fid": i, "src": r[2], "px": r[0], "py": r[1]}, "geometry": r[3]}
            for i, r in enumerate(rows)]


# ---------------------------------------------------------------- NOAH hazard
def _inner_shapefile(zbytes):
    import shapefile
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    shp = [n for n in z.namelist() if n.lower().endswith(".shp")][0]
    stem = shp[:-4]
    return shapefile.Reader(shp=io.BytesIO(z.read(stem + ".shp")), shx=io.BytesIO(z.read(stem + ".shx")),
                            dbf=io.BytesIO(z.read(stem + ".dbf")))


def _polygonal(g):
    parts = [p for p in shapely.get_parts(g) if p.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else None


def noah_for_boxes(zip_paths, boxes, margin_m=MARGIN_M):
    """{box: {"5"|"25"|"100": [Feature(Var, src)] or None}}. None means no NOAH map for that return period covers the
    box (shown as "not available"); an empty list means maps cover it and none of it is hazard.
    A province zip that appears in two downloads under the same name is read once; two different maps of one
    province (e.g. 'Misamis Oriental' and 'MisamisOriental') are both kept and the build takes the highest class."""
    big = {k: grow(b, margin_m) for k, b in boxes.items()}
    out = {k: {} for k in boxes}
    seen = set()
    for zp in sorted(zip_paths):
        outer = zipfile.ZipFile(zp)
        for name in sorted(outer.namelist()):
            if not name.lower().endswith(".zip"):
                continue
            rp = name.split("/")[0].lower().replace("yr", "")
            key = (rp, name.split("/")[-1])
            if key in seen:
                continue
            seen.add(key)
            rd = _inner_shapefile(outer.read(name))
            hit = [k for k, b in big.items() if overlaps(tuple(rd.bbox), b)]
            if not hit:
                continue
            geoms = []
            for i in range(len(rd)):
                g = shape(rd.shape(i).__geo_interface__)
                if not g.is_valid:
                    g = shapely.make_valid(g)
                geoms.append((int(round(float(rd.record(i)[0]))), g))
            for k in hit:
                clip = sbox(*big[k])
                feats = out[k].setdefault(rp, [])
                for var, g in geoms:
                    if not overlaps(g.bounds, big[k]):
                        continue
                    c = _polygonal(g.intersection(clip))
                    if c is not None and not c.is_empty:
                        feats.append({"type": "Feature", "properties": {"Var": var, "src": name}, "geometry": round_geom(mapping(c))})
    for k in boxes:
        for rp in ("5", "25", "100"):
            out[k].setdefault(rp, None)
    return out


# ---------------------------------------------------------------- barangays and the country outline
def _admin_reader(admin_zip, layer):
    import shapefile
    z = zipfile.ZipFile(admin_zip)
    return shapefile.Reader(shp=io.BytesIO(z.read(layer + ".shp")), shx=io.BytesIO(z.read(layer + ".shx")),
                            dbf=io.BytesIO(z.read(layer + ".dbf")), encoding="utf-8")


def barangays_for_boxes(admin_zip, boxes):
    """{box: [Feature]} of admin level 4 polygons that intersect each box; properties pcode, name, muni, lat, lon
    (the same shape tools/extract_barangays.py wrote for the pilot sites)."""
    rd = _admin_reader(admin_zip, "phl_admin4")
    names = [f[0] for f in rd.fields[1:]]
    out = {k: [] for k in boxes}
    for sr in rd.iterShapeRecords():
        if sr.shape.shapeType == 0:
            continue
        hits = [k for k, b in boxes.items() if overlaps(tuple(sr.shape.bbox), b)]
        if not hits:
            continue
        g = shape(sr.shape.__geo_interface__)
        r = dict(zip(names, sr.record))
        props = {"pcode": r["adm4_pcode"], "name": r["adm4_name"], "muni": r["adm3_name"],
                 "lat": round(float(r["center_lat"]), 6), "lon": round(float(r["center_lon"]), 6)}
        for k in hits:
            if g.intersects(sbox(*boxes[k])):
                out[k].append({"type": "Feature", "properties": props, "geometry": round_geom(mapping(g))})
    for k in out:
        out[k].sort(key=lambda f: f["properties"]["pcode"])
    return out


def ph_outline(admin_zip, tolerance_deg=0.01, min_area_km2=20.0):
    """Simplified country outline for the national map: islands of at least min_area_km2, no holes, 3 decimals."""
    rd = _admin_reader(admin_zip, "phl_admin0")
    geoms = [shape(s.__geo_interface__) for s in rd.shapes() if s.shapeType != 0]
    u = shapely.union_all(geoms)
    keep = []
    for p in shapely.get_parts(u):
        if p.geom_type != "Polygon":
            continue
        if p.area * m_per_deg_lon(p.centroid.y) * M_PER_DEG_LAT / 1e6 < min_area_km2:
            continue
        s = Polygon(p.exterior).simplify(tolerance_deg, preserve_topology=True)
        if not s.is_empty and s.geom_type == "Polygon":
            keep.append(s)
    keep.sort(key=lambda q: (-q.area, q.bounds))
    return round_geom(mapping(MultiPolygon(keep)), 3)
