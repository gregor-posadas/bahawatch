import json, os, sys, tempfile, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C, cut
from shapely.geometry import box as sbox, shape, Point
from tests.fixtures import write_fabdem_tiles, write_buildings, write_noah, write_admin

UPD = C.box_around(14.6537, 121.0685)       # inside the fake Metro Manila hazard map
SEAM = C.box_around(14.60, 121.0)           # straddles the 121° E tile edge
CEBU = C.box_around(10.30, 123.90)

class Terrain(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tiles = write_fabdem_tiles(os.path.join(tempfile.mkdtemp(), "fabdem"))
    def test_tiles_for_a_seam_box(self):
        names = [os.path.basename(p) for p in cut.fabdem_tiles_for(C.grow(SEAM, 300), self.tiles)]
        self.assertEqual(names, ["N14E120_FABDEM_V1-2.tif", "N14E121_FABDEM_V1-2.tif"])
    def test_merge_is_continuous_across_the_seam(self):
        z, prof = cut.clip_fabdem(SEAM, self.tiles)
        self.assertFalse((z == -9999.0).any())
        self.assertEqual(z.shape, (prof["height"], prof["width"]))
        steps = np.diff(z[0])
        self.assertTrue(np.allclose(steps, 0.1, atol=1e-3), steps.max())   # 1 m per 0.01° → 0.1 m per pixel, no jump
    def test_missing_tile_is_an_error(self):
        with self.assertRaises(FileNotFoundError):
            cut.clip_fabdem(CEBU, self.tiles)

class Buildings(unittest.TestCase):
    def test_scan_sorts_and_splits(self):
        tmp = tempfile.mkdtemp()
        a = sbox(121.066, 14.652, 121.0661, 14.6521)          # inside UPD
        b = sbox(121.060, 14.650, 121.0601, 14.6501)          # inside UPD, sorts first (smaller x)
        far = sbox(125.0, 7.0, 125.0001, 7.0001)
        pq = write_buildings(os.path.join(tmp, "b.parquet"), [a, far, b])
        n = cut.scan_buildings(pq, {"upd": UPD, "cebu": CEBU}, tmp)
        self.assertEqual(n, 2)
        fs = cut.box_buildings(tmp, "upd")
        self.assertEqual([f["properties"]["fid"] for f in fs], [0, 1])
        self.assertLess(fs[0]["properties"]["px"], fs[1]["properties"]["px"])
        for f in fs:
            self.assertTrue(shape(f["geometry"]).contains(Point(f["properties"]["px"], f["properties"]["py"])))
        self.assertEqual(cut.box_buildings(tmp, "cebu"), [])
    def test_footprint_in_two_boxes_goes_to_both(self):
        tmp = tempfile.mkdtemp()
        near = C.box_around(14.6537, 121.080)                  # overlaps UPD
        shared = sbox(121.075, 14.650, 121.0751, 14.6501)
        cut.scan_buildings(write_buildings(os.path.join(tmp, "b.parquet"), [shared]), {"upd": UPD, "near": near}, tmp)
        self.assertEqual(len(cut.box_buildings(tmp, "upd")), 1)
        self.assertEqual(len(cut.box_buildings(tmp, "near")), 1)

class Noah(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        d = write_noah(tempfile.mkdtemp())
        cls.got = cut.noah_for_boxes(sorted(os.path.join(d, f) for f in os.listdir(d)), {"upd": UPD, "cebu": CEBU})
    def test_covered_period_keeps_hazard_classes(self):
        vs = sorted(f["properties"]["Var"] for f in self.got["upd"]["5"])
        self.assertEqual(vs, [1, 3])                       # the Var 2 polygon lies outside the box; the duplicate zip is read once
    def test_uncovered_period_is_none_not_empty(self):
        self.assertIsNone(self.got["upd"]["25"]); self.assertIsNone(self.got["upd"]["100"])
        self.assertEqual(len(self.got["cebu"]["25"]), 1); self.assertIsNone(self.got["cebu"]["100"])
    def test_clipped_to_box_plus_margin(self):
        g = C.grow(UPD, 300)
        for f in self.got["upd"]["5"]:
            x0, y0, x1, y1 = shape(f["geometry"]).bounds
            self.assertTrue(x0 >= g[0] - 1e-6 and x1 <= g[2] + 1e-6 and y0 >= g[1] - 1e-6 and y1 <= g[3] + 1e-6)

class NoahIndex(unittest.TestCase):
    """Reading 284 province maps' headers takes ~150 s on the PC, so the bounding boxes are indexed once and the
    clip step opens only the provinces that touch a box."""
    @classmethod
    def setUpClass(cls):
        d = write_noah(tempfile.mkdtemp())
        cls.zips = sorted(os.path.join(d, f) for f in os.listdir(d))
    def test_index_has_each_province_bbox_and_marks_empty_ones(self):
        idx = cut.noah_index(self.zips)
        self.assertEqual(idx["100yr-A-001.zip"]["100yr/TawiTawi.zip"], None)
        x0, y0, x1, y1 = idx["5yr-A-001.zip"]["5yr/MetroManila.zip"]
        self.assertEqual((round(x0, 2), round(y0, 3), round(x1, 2), round(y1, 2)), (121.04, 14.63, 121.11, 14.71))
    def test_clip_with_the_index_matches_clip_without(self):
        boxes = {"upd": UPD, "cebu": CEBU}
        self.assertEqual(cut.noah_for_boxes(self.zips, boxes, index=cut.noah_index(self.zips)), cut.noah_for_boxes(self.zips, boxes))
    def test_empty_province_zip_is_skipped(self):
        got = cut.noah_for_boxes(self.zips, {"upd": UPD})
        self.assertIsNone(got["upd"]["100"])

class Admin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.zip = write_admin(os.path.join(tempfile.mkdtemp(), "phl_admin_boundaries.shp.zip"))
    def test_barangays_intersecting_each_box(self):
        got = cut.barangays_for_boxes(self.zip, {"upd": UPD, "cebu": CEBU})
        self.assertEqual([f["properties"] for f in got["upd"]],
                         [{"pcode": "PH137404104", "name": "U.P. Campus", "muni": "Quezon City", "lat": 14.65, "lon": 121.06}])
        self.assertEqual(got["cebu"], [])
    def test_outline_drops_islets_and_rounds(self):
        g = cut.ph_outline(self.zip)
        self.assertEqual(g["type"], "MultiPolygon")
        self.assertEqual(len(g["coordinates"]), 1)          # the 0.001° islet (≈0.01 km²) is dropped
        xs = [c[0] for c in g["coordinates"][0][0]]
        self.assertTrue(all(round(x, 3) == x for x in xs))
        self.assertEqual(len(g["coordinates"][0]), 1)       # exterior ring only

if __name__ == "__main__":
    unittest.main()
