#!/usr/bin/env python3
"""The per-site data checks of spec §7.1. Prints one line per site and exits 1 if any check fails.
  python3 tools/check_site_data.py              # every data/*.json
  python3 tools/check_site_data.py upd xu       # just these
Environment: BW_DATA_DIR (default data/), CAMPUSES_CSV, CAMPUS_INPUTS (default inputs/campuses; the
unit-on-a-footprint check runs only where a site's buildings.geojson is present)."""
import base64, glob, json, math, os, re, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, "pipeline"))
from model import grids  # noqa: E402
import common as C  # noqa: E402

MAX_BYTES = 750_000          # raw; what matters on the wire is MAX_GZ (GitHub Pages serves gzip)
MAX_GZ = 250 * 1024
DATA_DIR = os.environ.get("BW_DATA_DIR", os.path.join(ROOT, "data"))
CAMPUS_INPUTS = os.environ.get("CAMPUS_INPUTS", os.path.join(ROOT, "inputs", "campuses"))


def metres(a, b):
    lat = (a[1] + b[1]) / 2
    return math.hypot((a[0] - b[0]) * C.m_per_deg_lon(lat), (a[1] - b[1]) * C.M_PER_DEG_LAT)


def check(path, rows):
    errs = []
    d = json.load(open(path, encoding="utf-8")); sid = d["site"]["id"]; GW, GH = d["GW"], d["GH"]; N = GW * GH
    size = os.path.getsize(path)
    if size > MAX_BYTES: errs.append(f"{size} bytes > {MAX_BYTES}")
    import gzip
    gz = len(gzip.compress(open(path, "rb").read(), 6))
    if gz > MAX_GZ: errs.append(f"{gz} bytes gzipped > {MAX_GZ}")
    if "places" not in d: errs.append("no places (run tools/build_places.py)")
    e = np.frombuffer(base64.b64decode(d["elev"]), dtype="<i2") / 10.0
    if e.size != N: errs.append("terrain grid has the wrong size")
    sea = grids.unrle(d["sea"], N).astype(bool) if "sea" in d else np.zeros(N, bool)
    if d["elev_min"] < -5 or e[~sea].max() > 3000: errs.append(f"implausible terrain {d['elev_min']:.1f}–{e[~sea].max():.1f} m")
    if sid not in rows:
        return errs, f"{len(d['sensors'])} units"
    r = rows[sid]; units = d["sensors"]; card = d["card"]
    b = d["bbox"]; centre = ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
    if metres(centre, (r["lon"], r["lat"])) > 50: errs.append("box is not centred on the campus")
    ids = [u["id"] for u in units]
    if ids != [f"BW-{sid.upper()}-{k:02d}" for k in range(1, 9)]: errs.append(f"unit ids {ids}")
    if [u.get("oc") for u in units].count(True) != 1 or not units[0].get("oc"): errs.append("exactly one unit, unit 01, must be on campus")
    for u in units:
        if not u.get("street") or not u.get("brgy"): errs.append(f"{u['id']} has no street or barangay")
        if sea[u["cy"] * GW + u["cx"]]: errs.append(f"{u['id']} sits on the sea")
    for i, a in enumerate(units):
        for q in units[i + 1:]:
            if metres((a["lon"], a["lat"]), (q["lon"], q["lat"])) < card["spacing"] - 2:
                errs.append(f"{a['id']} and {q['id']} closer than {card['spacing']:.0f} m")
    if not card["barangays"]: errs.append("no barangay covered")
    for rp in ("5", "25", "100"):
        v = card["noah"][rp]
        if (v is None) != (rp in d["site"]["noah_missing"]): errs.append(f"NOAH {rp}-yr: card and site disagree")
        if v is not None and not 0 <= v <= 1: errs.append(f"NOAH {rp}-yr share {v}")
    bpath = os.path.join(CAMPUS_INPUTS, sid, "buildings.geojson")
    if os.path.exists(bpath):
        from shapely.geometry import shape, Point
        foot = {f["properties"]["fid"]: f for f in json.load(open(bpath, encoding="utf-8"))["features"]}
        for u in units:
            g = shape(foot[u["fid"]]["geometry"])
            gap = g.distance(Point(u["lon"], u["lat"])) * C.M_PER_DEG_LAT
            if gap > 2: errs.append(f"{u['id']} is {gap:.0f} m off its footprint")
    return errs, f"{len(units)} units, spacing {card['spacing']:.0f} m, {len(card['barangays'])} barangays, NOAH " + \
        "/".join("n/a" if card["noah"][rp] is None else f"{card['noah'][rp]:.0%}" for rp in ("5", "25", "100"))


def main(argv):
    rows = {r["id"]: r for r in C.read_campuses(os.environ.get("CAMPUSES_CSV", C.CAMPUSES_CSV))}
    paths = [os.path.join(DATA_DIR, f"{s}.json") for s in argv] or \
        [p for p in sorted(glob.glob(os.path.join(DATA_DIR, "*.json"))) if not p.endswith("ph_outline.json")]
    bad = 0
    for p in paths:
        errs, info = check(p, rows)
        name = os.path.basename(p)[:-5]
        size = os.path.getsize(p)
        if errs:
            bad += 1; print(f"FAIL {name}: " + "; ".join(errs))
        else:
            print(f"ok   {name}: {size // 1000} KB ({len(__import__('gzip').compress(open(p, 'rb').read(), 6)) // 1000} KB gz), {info}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
