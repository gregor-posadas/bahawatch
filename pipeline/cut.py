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
def _inner_zip(outer, name):
    """A province zip inside a download zip, opened as a stream: only that province is decompressed."""
    return zipfile.ZipFile(outer.open(name))


def _shp_stem(z):
    shp = [n for n in z.namelist() if n.lower().endswith(".shp")]
    return shp[0][:-4] if shp else None          # an empty province zip (e.g. Tawi-Tawi 100-yr) has none


def _inner_shapefile(z, stem):
    import shapefile
    return shapefile.Reader(shp=io.BytesIO(z.read(stem + ".shp")), shx=io.BytesIO(z.read(stem + ".shx")),
                            dbf=io.BytesIO(z.read(stem + ".dbf")))


def _shp_polygons(shp, shx, boxes):
    """One shapely geometry per record of a polygon shapefile (bytes), keeping only rings whose extent touches one of
    `boxes`. Parsed with numpy (pyshp spends ~60 s on one province's 1.7 M points); rings are outers when clockwise and
    holes when anticlockwise, as the shapefile format defines them. Records away from every box come back empty."""
    import struct
    import numpy as np
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    ub = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    n = (len(shx) - 100) // 8
    offs = np.frombuffer(shx, dtype=">i4", count=2 * n, offset=100).reshape(n, 2)[:, 0]
    out = []
    for off in offs:
        p = int(off) * 2 + 8
        if struct.unpack_from("<i", shp, p)[0] == 0 or not any(overlaps(struct.unpack_from("<4d", shp, p + 4), b) for b in boxes):
            out.append(Polygon())
            continue
        nparts, npts = struct.unpack_from("<2i", shp, p + 36)
        parts = np.frombuffer(shp, "<i4", nparts, p + 44).astype(np.int64)
        pts = np.frombuffer(shp, "<f8", npts * 2, p + 44 + 4 * nparts).reshape(npts, 2)
        ends = np.append(parts[1:], npts)
        x, y = pts[:, 0], pts[:, 1]
        cs = np.concatenate([[0.0], np.cumsum(x[:-1] * y[1:] - x[1:] * y[:-1])])
        area2 = cs[ends - 1] - cs[parts]                     # shoelace per ring: < 0 clockwise (outer)
        x0 = np.minimum.reduceat(x, parts); x1 = np.maximum.reduceat(x, parts)
        y0 = np.minimum.reduceat(y, parts); y1 = np.maximum.reduceat(y, parts)
        outers, holes = [], []
        for k in range(nparts):
            if ends[k] - parts[k] < 4 or not any(overlaps((x0[k], y0[k], x1[k], y1[k]), b) for b in boxes):
                continue
            g = Polygon(pts[parts[k]:ends[k]])
            if not g.is_valid:
                g = shapely.make_valid(g)
            g = shapely.clip_by_rect(g, *ub)
            if not g.is_empty:
                (outers if area2[k] < 0 else holes).append(g)
        g = unary_union(outers) if outers else Polygon()
        if holes and not g.is_empty:
            g = g.difference(unary_union(holes))
        out.append(g)
    return out


def noah_index(zip_paths):
    """{download zip name: {province zip: [x0, y0, x1, y1] or None}} from each map's 100-byte shapefile header.
    Reading every header takes minutes on the PC, so run_pc.py saves this once and the clip reuses it."""
    import struct
    idx = {}
    for zp in sorted(zip_paths):
        outer = zipfile.ZipFile(zp)
        d = idx.setdefault(os.path.basename(zp), {})
        for name in sorted(outer.namelist()):
            if not name.lower().endswith(".zip"):
                continue
            inner = _inner_zip(outer, name)
            stem = _shp_stem(inner)
            d[name] = None if stem is None else list(struct.unpack("<4d", inner.open(stem + ".shp").read(100)[36:68]))
    return idx


def _polygonal(g):
    parts = [p for p in shapely.get_parts(g) if p.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else None


def noah_for_boxes(zip_paths, boxes, margin_m=MARGIN_M, index=None):
    """{box: {"5"|"25"|"100": [Feature(Var, src)] or None}}. None means no NOAH map for that return period covers the
    box (shown as "not available"); an empty list means maps cover it and none of it is hazard.
    A province zip that appears in two downloads under the same name is read once; two different maps of one
    province (e.g. 'Misamis Oriental' and 'MisamisOriental') are both kept and the build takes the highest class."""
    big = {k: grow(b, margin_m) for k, b in boxes.items()}
    out = {k: {} for k in boxes}
    seen = set()
    for zp in sorted(zip_paths):
        outer = zipfile.ZipFile(zp)
        zi = (index or {}).get(os.path.basename(zp))
        for name in sorted(outer.namelist()):
            if not name.lower().endswith(".zip"):
                continue
            rp = name.split("/")[0].lower().replace("yr", "")
            key = (rp, name.split("/")[-1])
            if key in seen:
                continue
            seen.add(key)
            if zi is not None and name in zi:             # the index says where this map is: skip it unless it touches a box
                bb = zi[name]
                if bb is None or not any(overlaps(tuple(bb), b) for b in big.values()):
                    continue
            inner = _inner_zip(outer, name)
            stem = _shp_stem(inner)
            if stem is None:
                continue
            rd = _inner_shapefile(inner, stem)
            hit = [k for k, b in big.items() if overlaps(tuple(rd.bbox), b)]
            if not hit:
                continue
            polys = _shp_polygons(inner.read(stem + ".shp"), inner.read(stem + ".shx"), [big[k] for k in hit])
            geoms = [(int(round(float(rd.record(i)[0]))), g) for i, g in enumerate(polys)]
            for k in hit:
                feats = out[k].setdefault(rp, [])
                for var, g in geoms:
                    if g.is_empty or not overlaps(g.bounds, big[k]):
                        continue
                    c = _polygonal(shapely.clip_by_rect(g, *big[k]))
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
