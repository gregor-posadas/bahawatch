#!/usr/bin/env python3
"""Our own vector tiles for the maps, so the detailed map needs no outside tile server (works offline and in the
private demo). Builds PMTiles archives with tippecanoe:

  shared/tiles/ph-base.pmtiles     the whole Philippines, zoom 0-12: land, built-up density (from the Open Buildings
                                   footprints), main roads, rivers, city and town names (OpenStreetMap)
  shared/tiles/site-<id>.pmtiles   each site's box, zoom 12-15: every street, waterways, building footprints

Inputs (not in git):
  --national  _national_osm.geojsonl   main roads, rivers and places, from the Philippines .osm.pbf (pyosmium pass)
  --density   _built_density.csv       Open Buildings footprint counts per 0.005° cell (DuckDB over PHL_buildings.parquet)
  inputs/campuses/<id>/{osm,buildings}.geojson   the per-site cuts (README §2.5)
  data/ph_outline.json                 the country outline

  python3 tools/build_basemap.py --national <file> --density <file> [--tippecanoe <path>]
"""
import argparse, csv, glob, json, os, shutil, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shared", "tiles")
CELL = 0.005
ROAD_MINZOOM = {"motorway": 4, "trunk": 4, "primary": 7, "secondary": 9, "tertiary": 11}
PLACE_MINZOOM = {"city": 6, "municipality": 8, "town": 8}
STREET_CLASS = {"motorway": "major", "trunk": "major", "primary": "major", "secondary": "mid", "tertiary": "mid"}


def feat(props, geom, minzoom=None):
    f = {"type": "Feature", "properties": props, "geometry": geom}
    if minzoom is not None:
        f["tippecanoe"] = {"minzoom": minzoom}
    return json.dumps(f, ensure_ascii=False, separators=(",", ":")) + "\n"


def run(tip, args):
    subprocess.run([tip, "--quiet", "--force"] + args, check=True)


def base(tip, national, density, tmp):
    outline = json.load(open(os.path.join(ROOT, "data", "ph_outline.json"), encoding="utf-8"))
    paths = {k: os.path.join(tmp, k + ".geojsonl") for k in ("land", "builtup", "roads", "rivers", "places")}
    with open(paths["land"], "w") as f:
        f.write(feat({}, outline))
    with open(paths["builtup"], "w") as f, open(density) as src:
        for r in csv.DictReader(src):
            n = int(r["n"])
            if n < 30:                      # a few scattered houses: leave the land plain
                continue
            x, y = int(r["gx"]) * CELL, int(r["gy"]) * CELL
            d = 1 if n < 60 else 2 if n < 200 else 3
            f.write(feat({"d": d}, {"type": "Polygon", "coordinates": [[[x, y], [x + CELL, y], [x + CELL, y + CELL],
                                                                          [x, y + CELL], [x, y]]]}, {3: 4, 2: 6, 1: 8}[d]))
    with open(paths["roads"], "w") as fr, open(paths["rivers"], "w") as fw, open(paths["places"], "w") as fp, \
            open(national, encoding="utf-8") as src:
        for line in src:
            o = json.loads(line)
            p = o["properties"]
            if p["kind"] == "road":
                q = {"class": p["class"]}
                if "name" in p: q["name"] = p["name"]
                fr.write(feat(q, o["geometry"], ROAD_MINZOOM[p["class"]]))
            elif p["kind"] == "river":
                fw.write(feat({"name": p["name"]} if "name" in p else {}, o["geometry"], 9))
            elif p["kind"] == "place":
                fp.write(feat({"name": p["name"], "place": p["place"]}, o["geometry"], PLACE_MINZOOM[p["place"]]))
    dst = os.path.join(OUT, "ph-base.pmtiles")
    run(tip, ["-o", dst, "-Z0", "-z11", "--drop-densest-as-needed",
              "--simplification=10", "--detect-shared-borders"] +
        sum([["-L", f"{k}:{v}"] for k, v in paths.items()], []))
    return dst


def site(tip, sid, tmp):
    d = os.path.join(ROOT, "inputs", "campuses", sid)
    st, wa, bl = (os.path.join(tmp, f"{sid}-{k}.geojsonl") for k in ("streets", "waterways", "buildings"))
    with open(st, "w") as fs, open(wa, "w") as fw:
        for o in json.load(open(os.path.join(d, "osm.geojson"), encoding="utf-8"))["features"]:
            p = o["properties"]
            if "highway" in p:
                q = {"class": STREET_CLASS.get(p["highway"], "minor")}
                if "name" in p: q["name"] = p["name"]
                fs.write(feat(q, o["geometry"]))
            elif "waterway" in p:
                fw.write(feat({"name": p["name"]} if "name" in p else {}, o["geometry"]))
    with open(bl, "w") as fb:
        for o in json.load(open(os.path.join(d, "buildings.geojson"), encoding="utf-8"))["features"]:
            fb.write(feat({}, o["geometry"], 13))
    dst = os.path.join(OUT, f"site-{sid}.pmtiles")
    run(tip, ["-o", dst, "-Z12", "-z15", "--drop-densest-as-needed", "--simplification=4",
              "-L", f"streets:{st}", "-L", f"waterways:{wa}", "-L", f"buildings:{bl}"])
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--national", required=True)
    ap.add_argument("--density", required=True)
    ap.add_argument("--tippecanoe", default=shutil.which("tippecanoe") or "tippecanoe")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        print(base(a.tippecanoe, a.national, a.density, tmp), os.path.getsize(os.path.join(OUT, "ph-base.pmtiles")))
        for d in sorted(glob.glob(os.path.join(ROOT, "inputs", "campuses", "*", "osm.geojson"))):
            sid = os.path.basename(os.path.dirname(d))
            dst = site(a.tippecanoe, sid, tmp)
            print(dst, os.path.getsize(dst))


if __name__ == "__main__":
    main()
