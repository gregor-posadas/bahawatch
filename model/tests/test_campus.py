import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from model import campus


class Campus(unittest.TestCase):
    def test_candidates_need_land_and_a_street(self):
        street = np.zeros((10, 10), bool); street[5, :] = True
        sea = np.zeros((10, 10), bool); sea[:, 0] = True
        score = np.arange(100, dtype=float).reshape(10, 10)
        pts = [dict(fid=0, cx=0, cy=5, x_m=0, y_m=0, oc=False),       # on the sea
               dict(fid=1, cx=3, cy=6, x_m=0, y_m=0, oc=False),       # next to the street (15 m)
               dict(fid=2, cx=3, cy=8, x_m=0, y_m=0, oc=False)]       # 45 m away
        got = campus.candidates(pts, score, street, sea, 15.0)
        self.assertEqual([c["fid"] for c in got], [1]); self.assertEqual(got[0]["score"], 63.0)
    def test_card_uses_land_only_and_keeps_missing_maps(self):
        sea = np.zeros((4, 4), bool); sea[:, 0] = True
        n5 = np.zeros((4, 4), np.uint8); n5[:, 0] = 3; n5[0, 1:] = 1   # the sea's hazard must not count
        brgy = np.zeros((4, 4), np.int32); brgy[:2, :] = 1; brgy[2:, 1:] = 2; brgy[3, 0] = 3
        units = [{"id": "BW-X-01", "bld": "near A St · One", "oc": True}]
        c = campus.card(units, 300.0, brgy, ["One", "Two", "Sea Barangay"], {"5": n5, "25": None, "100": n5 * 0}, sea, True)
        self.assertEqual(c["noah"], {"5": 0.25, "25": None, "100": 0.0})
        self.assertEqual(c["barangays"], ["One", "Two"])
        self.assertEqual(c["units"], [{"id": "BW-X-01", "name": "near A St · One", "oc": True}])

if __name__ == "__main__":
    unittest.main()
