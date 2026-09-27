#!/usr/bin/env python3
"""BahaWatch campus pipeline: the part that runs on Gregor's PC (spec §5.1).

  python3 run_pc.py find --data "<Nationwide Update>" --out "<Nationwide Update>/bahawatch-data/campuses"
  python3 run_pc.py cut  --data "<Nationwide Update>" --out "<Nationwide Update>/bahawatch-data/campuses"

It reads the national downloads and never changes them. It writes only inside --out. A file that already exists
is kept (the log says "kept"), so an interrupted run picks up where it stopped. Every step adds a line to
<out>/pipeline_log.txt."""
import argparse, csv, datetime, glob, io, json, os, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402


class Out:
    """The only way this script writes: inside one folder, new files only, via a .part file and a rename."""
    def __init__(self, root):
        self.root = os.path.realpath(root)
        os.makedirs(self.root, exist_ok=True)
        self.log_path = os.path.join(self.root, "pipeline_log.txt")

    def path(self, *rel):
        p = os.path.realpath(os.path.join(self.root, *rel))
        if p != self.root and not p.startswith(self.root + os.sep):
            raise ValueError(f"refusing to write outside {self.root}: {p}")
        return p

    def exists(self, *rel):
        return os.path.exists(self.path(*rel))

    def _write(self, rel, writer):
        p = self.path(*rel)
        if os.path.exists(p):
            return False
        os.makedirs(os.path.dirname(p), exist_ok=True)
        writer(p + ".part")
        os.replace(p + ".part", p)
        return True

    def json(self, obj, *rel):
        def w(t):
            with open(t, "w", encoding="utf-8") as f:
                json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        return self._write(rel, w)

    def text(self, s, *rel):
        def w(t):
            with open(t, "w", encoding="utf-8", newline="") as f:
                f.write(s)
        return self._write(rel, w)

    def tif(self, arr, prof, *rel):
        import rasterio
        def w(t):
            with rasterio.open(t, "w", **prof) as d:
                d.write(arr, 1)
        return self._write(rel, w)

    def log(self, msg):
        line = f"{datetime.datetime.now().isoformat(timespec='seconds')} {msg}"
        print(line, flush=True)
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")


def inputs(data):
    d = os.path.realpath(data)
    pbf = sorted(glob.glob(os.path.join(d, "philippines-*.osm.pbf"))) or sorted(glob.glob(os.path.join(d, "philippines-*.osm")))
    if not pbf:
        sys.exit(f"no philippines-*.osm.pbf in {d}")
    return {"pbf": pbf[-1], "parquet": os.path.join(d, "PHL_buildings.parquet"),
            "fabdem": os.path.join(d, "bahawatch-data", "fabdem"), "admin": os.path.join(d, "phl_admin_boundaries.shp.zip"),
            "noah": sorted(glob.glob(os.path.join(d, "*yr-*.zip")))}


def describe(p):
    st = os.stat(p)
    return f"{os.path.basename(p)} ({st.st_size / 1e6:.0f} MB, modified {datetime.date.fromtimestamp(st.st_mtime)})"


def fc(features):
    return {"type": "FeatureCollection", "features": features}


def cmd_find(a):
    import osm_extract
    out, inp, rows = Out(a.out), inputs(a.data), C.read_campuses(a.campuses)
    t = time.time()
    got = osm_extract.find_campus_areas(inp["pbf"], rows, radius_m=a.radius, index=a.index)
    buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
    w.writerow(["id", "candidates", "ref", "name", "amenity", "dist_m", "area_m2", "rep_lon", "rep_lat"])
    for r in rows:
        cands = got[r["id"]]
        out.json(fc([{"type": "Feature", "properties": {k: c[k] for k in ("ref", "name", "amenity", "dist_m", "area_m2", "rep")},
                      "geometry": c["geometry"]} for c in cands]), "_candidates", f"{r['id']}.geojson")
        for c in cands or [None]:
            w.writerow([r["id"], len(cands)] + ([c["ref"], c["name"], c["amenity"], c["dist_m"], c["area_m2"], *c["rep"]] if c else [""] * 7))
    out.text(buf.getvalue(), "_candidates", "summary.csv")
    none = [r["id"] for r in rows if not got[r["id"]]]
    out.log(f"find: {sum(len(v) for v in got.values())} candidates for {len(rows)} campuses from {describe(inp['pbf'])} "
            f"in {time.time() - t:.0f} s" + (f"; none for {', '.join(none)}" if none else ""))


def cmd_cut(a):
    import cut, osm_extract
    out, inp, rows = Out(a.out), inputs(a.data), C.read_campuses(a.campuses)
    todo_rows = [r for r in rows if r["lat"] is None or not r["osm_ref"]]
    if todo_rows:
        sys.exit("campuses.csv has no centre or osm_ref yet for: " + ", ".join(r["id"] for r in todo_rows))
    bx = C.boxes(rows)
    if a.only:
        keep = set(a.only.split(","))
        bx = {k: v for k, v in bx.items() if k in keep}
    by_id = {r["id"]: r for r in rows}
    for k, b in bx.items():
        out.json({"id": k, "bbox": list(b)}, k, "box.json")

    def step(name, fname, fn):
        todo = [k for k in bx if not out.exists(k, fname)]
        kept = len(bx) - len(todo)
        if not todo:
            out.log(f"cut {name}: kept all {kept}")
            return
        t = time.time()
        msg = fn({k: bx[k] for k in todo})
        out.log(f"cut {name}: {msg} for {len(todo)} boxes ({kept} kept) in {time.time() - t:.0f} s")

    def outlines(todo):
        n = 0
        for k in todo:
            if k not in by_id:                       # pilot boxes have no campus outline
                continue
            r = by_id[k]
            if r["osm_ref"] == "manual":             # no OSM outline anywhere: the centre Gregor gave, as a point
                n += out.json(fc([{"type": "Feature", "properties": {"ref": "manual", "name": r["name"]},
                                   "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]}}]), k, "outline.geojson")
                continue
            cands = json.load(open(out.path("_candidates", f"{k}.geojson"), encoding="utf-8"))["features"]
            pick = [f for f in cands if f["properties"]["ref"] == by_id[k]["osm_ref"]]
            if not pick:
                sys.exit(f"{k}: osm_ref {by_id[k]['osm_ref']} is not among its candidates")
            n += out.json(fc(pick), k, "outline.geojson")
        return f"{n} outlines"
    step("outline", "outline.geojson", lambda todo: outlines([k for k in todo if k in by_id]))

    def terrain(todo):
        for k, b in todo.items():
            arr, prof = cut.clip_fabdem(b, inp["fabdem"])
            out.tif(arr, prof, k, "dem.tif")
        return f"FABDEM from {inp['fabdem']}"
    step("terrain", "dem.tif", terrain)

    def buildings(todo):
        tmp = a.tmp or tempfile.mkdtemp(prefix="bw_bld_")
        n = cut.scan_buildings(inp["parquet"], todo, tmp)
        counts = []
        for k in todo:
            fs = cut.box_buildings(tmp, k)
            out.json(fc(fs), k, "buildings.geojson")
            counts.append(f"{k} {len(fs)}")
        return f"{n} footprints from {describe(inp['parquet'])}: " + ", ".join(counts)
    step("buildings", "buildings.geojson", buildings)

    def ways(todo):
        got = osm_extract.extract_ways(inp["pbf"], todo, index=a.index)
        for k in todo:
            out.json(fc(got[k]), k, "osm.geojson")
        return f"streets and creeks from {describe(inp['pbf'])}: " + ", ".join(f"{k} {len(got[k])}" for k in todo)
    step("osm", "osm.geojson", ways)

    def noah(todo):
        if out.exists("_noah_index.json"):
            index = json.load(open(out.path("_noah_index.json"), encoding="utf-8"))
        else:                                        # once: every province map's extent (minutes on the PC)
            t = time.time()
            index = cut.noah_index(inp["noah"])
            out.json(index, "_noah_index.json")
            out.log(f"cut noah index: {sum(len(v) for v in index.values())} province maps in {time.time() - t:.0f} s")
            if a.index_only:
                return "index only"
        got = cut.noah_for_boxes(inp["noah"], todo, index=index)
        for k in todo:
            for rp, fs in got[k].items():
                if fs is not None:
                    out.json(fc(fs), k, f"noah_{rp}.geojson")
            out.json({rp: ("covered" if got[k][rp] is not None else "missing") for rp in ("5", "25", "100")}, k, "noah.json")
        return f"NOAH from {len(inp['noah'])} zips: " + ", ".join(
            f"{k} " + "/".join(rp if got[k][rp] is not None else "-" for rp in ("5", "25", "100")) for k in todo)
    step("noah", "noah.json", noah)

    def barangays(todo):
        got = cut.barangays_for_boxes(inp["admin"], todo)
        for k in todo:
            out.json(fc(got[k]), k, "barangays.geojson")
        return f"barangays from {describe(inp['admin'])}: " + ", ".join(f"{k} {len(got[k])}" for k in todo)
    step("barangays", "barangays.geojson", barangays)

    if out.exists("ph_outline.geojson"):
        out.log("cut outline (country): kept")
    else:
        t = time.time()
        g = cut.ph_outline(inp["admin"], tolerance_deg=a.tolerance)
        out.json(g, "ph_outline.geojson")
        out.log(f"cut outline (country): {len(g['coordinates'])} islands, {len(json.dumps(g)) // 1024} KB in {time.time() - t:.0f} s")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["find", "cut"])
    p.add_argument("--data", required=True, help="the 'Nationwide Update' folder (read only)")
    p.add_argument("--out", required=True, help="where results go, e.g. <data>/bahawatch-data/campuses")
    p.add_argument("--campuses", default=C.CAMPUSES_CSV)
    p.add_argument("--index", default=None, help="pyosmium node index, e.g. sparse_file_array,/tmp/nodes.idx")
    p.add_argument("--radius", type=float, default=10000.0, help="find: search radius around each hint, metres")
    p.add_argument("--only", default=None, help="cut: comma-separated box ids")
    p.add_argument("--tmp", default=None, help="cut: scratch folder for the buildings scan (outside --out)")
    p.add_argument("--tolerance", type=float, default=0.01, help="cut: country outline simplification, degrees")
    p.add_argument("--index-only", action="store_true", help="cut: stop after writing the NOAH index (it takes one whole call)")
    a = p.parse_args(argv)
    {"find": cmd_find, "cut": cmd_cut}[a.cmd](a)


if __name__ == "__main__":
    main()
