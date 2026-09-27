import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C, osm_extract as X
from tests.fixtures import write_osm

CAMPUSES = [dict(id="upd", osm_pattern="University of the Philippines.{0,3}Diliman|UP Diliman", hint_lat=14.6537, hint_lon=121.0685),
            dict(id="mcc", osm_pattern="Mandaue City College", hint_lat=10.33, hint_lon=123.94),
            dict(id="xu", osm_pattern="Xavier University", hint_lat=8.477, hint_lon=124.645)]

class Osm(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(); cls.pbf = write_osm(os.path.join(cls.tmp, "t.osm"))
    def test_finds_way_area_and_point(self):
        got = X.find_campus_areas(self.pbf, CAMPUSES)
        self.assertEqual([c["ref"] for c in got["upd"]], ["w10"])
        a = got["upd"][0]
        self.assertEqual(a["geometry"]["type"], "MultiPolygon")
        self.assertGreater(a["area_m2"], 1.0e6)            # 0.01° × 0.01° ≈ 1.2 km²
        self.assertTrue(121.06 < a["rep"][0] < 121.07 and 14.65 < a["rep"][1] < 14.66)
        self.assertEqual([c["ref"] for c in got["mcc"]], ["n9"])
        self.assertEqual(got["mcc"][0]["area_m2"], 0)
        self.assertEqual(got["xu"], [])
    def test_radius_limits_matches(self):
        got = X.find_campus_areas(self.pbf, [dict(CAMPUSES[1], hint_lat=11.5, hint_lon=124.5)])
        self.assertEqual(got["mcc"], [])
    def test_ways_per_box(self):
        b1 = C.box_around(14.655, 121.065); b2 = C.box_around(10.301, 123.901); b3 = C.box_around(8.0, 125.0)
        got = X.extract_ways(self.pbf, {"a": b1, "b": b2, "c": b3})
        kinds = sorted((f["properties"].get("highway") or f["properties"].get("waterway")) for f in got["a"])
        self.assertEqual(kinds, ["primary", "stream"])       # the motorway is not a street people live on
        self.assertEqual(got["a"][0]["properties"], {"highway": "primary", "name": "C.P. Garcia Avenue"})
        self.assertEqual(len(got["b"]), 1); self.assertEqual(got["c"], [])
        self.assertEqual(got["a"][0]["geometry"]["coordinates"][0], [121.05, 14.655])

if __name__ == "__main__":
    unittest.main()
