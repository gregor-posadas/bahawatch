import math, os, re, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C

class CampusList(unittest.TestCase):
    rows = C.read_campuses()
    def test_twenty_five_unique_ids(self):
        ids = [r["id"] for r in self.rows]
        self.assertEqual(len(ids), 25)
        self.assertEqual(len(set(ids)), 25)
        for i in ids: self.assertRegex(i, C.ID_RE)
    def test_groups_17_5_3(self):
        n = {g: sum(r["group"] == g for r in self.rows) for g in C.GROUPS}
        self.assertEqual(n, {"Luzon": 17, "Visayas": 5, "Mindanao": 3})
    def test_fields(self):
        for r in self.rows:
            self.assertIn(r["type"], C.TYPES, r["id"])
            for k in ("short", "name", "campus", "city", "province"): self.assertTrue(r[k].strip(), (r["id"], k))
            re.compile(r["osm_pattern"], re.I)
            self.assertTrue(4.5 <= r["hint_lat"] <= 21.5 and 116 <= r["hint_lon"] <= 127, r["id"])

class Boxes(unittest.TestCase):
    def test_box_is_3km_square(self):
        for lat in (14.6537, 8.241, 15.737):
            lon0, lat0, lon1, lat1 = C.box_around(lat, 121.0)
            w = (lon1 - lon0) * C.m_per_deg_lon(lat); h = (lat1 - lat0) * C.M_PER_DEG_LAT
            self.assertAlmostEqual(w, 3000, delta=1.0); self.assertAlmostEqual(h, 3000, delta=1.0)
    def test_grow_and_overlap(self):
        b = C.box_around(14.65, 121.07); g = C.grow(b, 300)
        self.assertAlmostEqual((g[2] - g[0]) * C.m_per_deg_lon(14.65), 3600, delta=1.0)
        self.assertTrue(C.overlaps(b, g))
        far = C.box_around(10.3, 123.9)
        self.assertFalse(C.overlaps(b, far))
    def test_boxes_include_pilots_and_skip_unresolved(self):
        rows = [dict(id="aa", lat=None, lon=None), dict(id="bb", lat=14.6, lon=121.0)]
        bx = C.boxes(rows)
        self.assertEqual(set(bx), {"bb", "tv"})

if __name__ == "__main__":
    unittest.main()
