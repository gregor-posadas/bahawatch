"""OpenStreetMap passes over the Philippines .osm.pbf with pyosmium 4. Each function reads the file once.
find_campus_areas(): university/college outlines (or points) whose names match a campus pattern
extract_ways():      streets and creeks touching each box, as GeoJSON LineStrings"""
import json, math, re
import osmium
from shapely.geometry import shape
from common import grow, overlaps, MARGIN_M, m_per_deg_lon, M_PER_DEG_LAT

AMENITIES = {"university", "college"}
NAME_KEYS = ("name", "name:en", "official_name", "alt_name", "short_name", "old_name")
HIGHWAYS = {"trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link",
            "residential", "unclassified", "busway", "service", "living_street", "pedestrian", "footway", "path", "cycleway"}
WATERWAYS = {"river", "stream", "drain", "canal", "ditch"}
SAMPLE_PAD_DEG = 0.05          # ≈5.5 km: how far a way may stray between its sampled nodes and still be found


def _dist_m(lat1, lon1, lat2, lon2):
    return math.hypot((lon2 - lon1) * m_per_deg_lon((lat1 + lat2) / 2), (lat2 - lat1) * M_PER_DEG_LAT)


def _rep_and_area(geom):
    g = shape(geom)
    p = g.representative_point()
    lat = p.y
    area = 0.0 if geom["type"] == "Point" else g.area * m_per_deg_lon(lat) * M_PER_DEG_LAT
    return [round(p.x, 7), round(p.y, 7)], area


def find_campus_areas(pbf, campuses, radius_m=10000.0, index=None):
    pats = {c["id"]: re.compile(c["osm_pattern"], re.I) for c in campuses}
    hint = {c["id"]: (c["hint_lat"], c["hint_lon"]) for c in campuses}
    out = {c["id"]: [] for c in campuses}
    gj = osmium.geom.GeoJSONFactory()
    fp = (osmium.FileProcessor(pbf).with_locations(index or "flex_mem")
          .with_areas(osmium.filter.KeyFilter("amenity"))
          .with_filter(osmium.filter.KeyFilter("amenity")))
    for o in fp:
        tags = {t.k: t.v for t in o.tags}
        if tags.get("amenity") not in AMENITIES:
            continue
        names = [tags[k] for k in NAME_KEYS if k in tags]
        if not names:
            continue
        if isinstance(o, osmium.osm.Area):
            ref = ("w" if o.from_way() else "r") + str(o.orig_id())
            try:
                geom = json.loads(gj.create_multipolygon(o))
            except Exception:          # broken multipolygon in OSM: nothing to outline
                continue
        elif isinstance(o, osmium.osm.Node):
            ref = "n" + str(o.id)
            geom = {"type": "Point", "coordinates": [o.location.lon, o.location.lat]}
        else:
            continue                   # a closed way arrives again as an Area
        rep, area = _rep_and_area(geom)
        for cid, pat in pats.items():
            if not any(pat.search(n) for n in names):
                continue
            d = _dist_m(rep[1], rep[0], *hint[cid])
            if d > radius_m:
                continue
            out[cid].append({"ref": ref, "name": tags.get("name", names[0]), "amenity": tags["amenity"],
                             "dist_m": round(d), "area_m2": round(area), "rep": rep, "geometry": geom})
    for cid in out:
        out[cid].sort(key=lambda c: (c["dist_m"], c["ref"]))
    return out


def extract_ways(pbf, boxes, index=None, margin_m=MARGIN_M):
    big = {k: grow(b, margin_m) for k, b in boxes.items()}
    out = {k: [] for k in boxes}
    fp = (osmium.FileProcessor(pbf).with_locations(index or "flex_mem")
          .with_filter(osmium.filter.KeyFilter("highway", "waterway")))
    for o in fp:
        if not isinstance(o, osmium.osm.Way):
            continue
        tags = {t.k: t.v for t in o.tags}
        if tags.get("highway") not in HIGHWAYS and tags.get("waterway") not in WATERWAYS:
            continue
        nodes = o.nodes
        # Speed: most of the 1.8 M ways are nowhere near a box. Look at every 8th node (and the last) first, and only
        # read the whole way when that sample, padded by SAMPLE_PAD_DEG, touches a box.
        sample = [nodes[i].location for i in list(range(0, len(nodes), 8)) + [len(nodes) - 1]]
        sample = [loc for loc in sample if loc.valid()]
        if not sample:
            continue
        sx = [loc.lon for loc in sample]; sy = [loc.lat for loc in sample]
        sb = (min(sx) - SAMPLE_PAD_DEG, min(sy) - SAMPLE_PAD_DEG, max(sx) + SAMPLE_PAD_DEG, max(sy) + SAMPLE_PAD_DEG)
        if not any(overlaps(sb, b) for b in big.values()):
            continue
        if not all(n.location.valid() for n in nodes):
            continue                   # a way running off the edge of the extract
        pts = [[round(n.lon, 6), round(n.lat, 6)] for n in nodes]
        if len(pts) < 2:
            continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        bb = (min(xs), min(ys), max(xs), max(ys))
        feat = None
        for k, b in big.items():
            if overlaps(bb, b):
                if feat is None:
                    props = {k2: tags[k2] for k2 in ("highway", "waterway", "name") if k2 in tags}
                    feat = {"type": "Feature", "properties": props, "geometry": {"type": "LineString", "coordinates": pts}}
                out[k].append(feat)
    return out
