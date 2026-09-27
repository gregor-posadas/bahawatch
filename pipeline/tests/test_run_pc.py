import csv, hashlib, json, os, subprocess, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C
from run_pc import Out
from shapely.geometry import box as sbox
from tests.fixtures import write_osm, write_fabdem_tiles, write_buildings, write_noah, write_admin

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUN = [sys.executable, os.path.join(HERE, "run_pc.py")]
FIELDS = ["id", "short", "name", "campus", "group", "type", "city", "province", "osm_pattern", "hint_lat", "hint_lon", "osm_ref", "lat", "lon"]
ROWS = [dict(id="upd", short="UP Diliman", name="University of the Philippines Diliman", campus="Diliman", group="Luzon", type="SUC",
             city="Quezon City", province="Metro Manila", osm_pattern="University of the Philippines.?.?.?Diliman", hint_lat=14.6537, hint_lon=121.0685),
        dict(id="mcc", short="MCC", name="Mandaue City College", campus="Main", group="Visayas", type="LUC",
             city="Mandaue City", province="Cebu", osm_pattern="Mandaue City College", hint_lat=10.33, hint_lon=123.94)]


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, FIELDS); w.writeheader()
        for r in rows: w.writerow({k: r.get(k, "") for k in FIELDS})


def snapshot(folder, skip):
    out = {}
    for d, _, fs in os.walk(folder):
        if os.path.realpath(d).startswith(os.path.realpath(skip)): continue
        for f in fs:
            p = os.path.join(d, f); out[p] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return out


class EndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = d = tempfile.mkdtemp(prefix="Nationwide Update ")
        write_osm(os.path.join(d, "philippines-test.osm"))
        write_fabdem_tiles(os.path.join(d, "bahawatch-data", "fabdem"), tiles=((14, 120), (14, 121), (10, 123)))
        write_buildings(os.path.join(d, "PHL_buildings.parquet"),
                        [sbox(121.066, 14.652, 121.0661, 14.6521), sbox(123.901, 10.301, 123.9011, 10.3011), sbox(121.05, 14.64, 121.0501, 14.6401)])
        write_noah(d); write_admin(os.path.join(d, "phl_admin_boundaries.shp.zip"))
        cls.out = os.path.join(d, "bahawatch-data", "campuses")
        cls.csv = os.path.join(tempfile.mkdtemp(), "campuses.csv"); write_csv(cls.csv, ROWS)
        cls.before = snapshot(d, cls.out)
        cls.find = subprocess.run(RUN + ["find", "--data", d, "--out", cls.out, "--campuses", cls.csv], capture_output=True, text=True)
        cands = {k: json.load(open(os.path.join(cls.out, "_candidates", f"{k}.geojson")))["features"] for k in ("upd", "mcc")}
        resolved = [dict(r, osm_ref=cands[r["id"]][0]["properties"]["ref"], lon=cands[r["id"]][0]["properties"]["rep"][0],
                         lat=cands[r["id"]][0]["properties"]["rep"][1]) for r in ROWS]
        write_csv(cls.csv, resolved)
        cls.cut1 = subprocess.run(RUN + ["cut", "--data", d, "--out", cls.out, "--campuses", cls.csv], capture_output=True, text=True)
        cls.mtimes = {p: os.stat(p).st_mtime_ns for p in snapshot(cls.out, "/nonexistent")}
        cls.cut2 = subprocess.run(RUN + ["cut", "--data", d, "--out", cls.out, "--campuses", cls.csv], capture_output=True, text=True)

    def test_find_writes_candidates(self):
        self.assertEqual(self.find.returncode, 0, self.find.stderr)
        s = open(os.path.join(self.out, "_candidates", "summary.csv"), encoding="utf-8").read()
        self.assertIn("upd,1,w10,University of the Philippines Diliman", s)
        self.assertIn("mcc,1,n9,Mandaue City College", s)

    def test_cut_writes_every_box(self):
        self.assertEqual(self.cut1.returncode, 0, self.cut1.stderr)
        for k in ("upd", "mcc", "tv"):
            for f in ("box.json", "dem.tif", "buildings.geojson", "osm.geojson", "noah.json", "barangays.geojson"):
                self.assertTrue(os.path.exists(os.path.join(self.out, k, f)), (k, f))
        self.assertTrue(os.path.exists(os.path.join(self.out, "upd", "outline.geojson")))
        self.assertFalse(os.path.exists(os.path.join(self.out, "tv", "outline.geojson")))
        self.assertEqual(json.load(open(os.path.join(self.out, "upd", "noah.json"))), {"5": "covered", "25": "missing", "100": "missing"})
        self.assertTrue(os.path.exists(os.path.join(self.out, "ph_outline.geojson")))
        b = json.load(open(os.path.join(self.out, "upd", "buildings.geojson")))["features"]
        self.assertEqual(len(b), 2)

    def test_noah_index_saved_once(self):
        idx = json.load(open(os.path.join(self.out, "_noah_index.json")))
        self.assertIn("5yr/MetroManila.zip", idx["5yr-A-001.zip"])

    def test_second_run_keeps_everything(self):
        self.assertEqual(self.cut2.returncode, 0, self.cut2.stderr)
        self.assertIn("kept all", self.cut2.stdout)
        now = {p: os.stat(p).st_mtime_ns for p in self.mtimes if not p.endswith("pipeline_log.txt")}
        self.assertEqual(now, {p: m for p, m in self.mtimes.items() if not p.endswith("pipeline_log.txt")})

    def test_inputs_untouched_and_nothing_written_outside_out(self):
        self.assertEqual(snapshot(self.data, self.out), self.before)

    def test_log_has_a_line_per_step(self):
        log = open(os.path.join(self.out, "pipeline_log.txt"), encoding="utf-8").read()
        for s in ("find:", "cut outline:", "cut terrain:", "cut buildings:", "cut osm:", "cut noah index:", "cut noah:", "cut barangays:", "cut outline (country):"):
            self.assertIn(s, log)

    def test_manual_centre_becomes_a_point_outline(self):
        out = tempfile.mkdtemp()
        csvp = os.path.join(tempfile.mkdtemp(), "c.csv")
        write_csv(csvp, [dict(ROWS[1], osm_ref="manual", lat=10.3301, lon=123.9402)])
        r = subprocess.run(RUN + ["cut", "--data", self.data, "--out", out, "--campuses", csvp, "--only", "mcc"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        g = json.load(open(os.path.join(out, "mcc", "outline.geojson")))["features"][0]["geometry"]
        self.assertEqual(g, {"type": "Point", "coordinates": [123.9402, 10.3301]})

    def test_out_refuses_paths_outside(self):
        o = Out(tempfile.mkdtemp())
        with self.assertRaises(ValueError):
            o.path("..", "escape.txt")

if __name__ == "__main__":
    unittest.main()
