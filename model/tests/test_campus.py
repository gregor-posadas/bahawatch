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
        got = campus.candidates(pts, score, street, sea, 15.0, edge_m=0)
        self.assertEqual([c["fid"] for c in got], [1]); self.assertEqual(got[0]["score"], 63.0)
    def test_candidates_keep_away_from_the_box_edge(self):
        """Units at the box edge are drawn at the map's edge, clipped or under the legend (Task 13 screenshots)."""
        street = np.ones((40, 40), bool); sea = np.zeros((40, 40), bool); score = np.ones((40, 40))
        pts = [dict(fid=0, cx=20, cy=20, x_m=0, y_m=0, oc=False),     # the middle
               dict(fid=1, cx=10, cy=20, x_m=0, y_m=0, oc=False),     # cell centre 157.5 m from the left edge: kept
               dict(fid=2, cx=9, cy=20, x_m=0, y_m=0, oc=False),      # 142.5 m: dropped
               dict(fid=3, cx=20, cy=2, x_m=0, y_m=0, oc=True),       # 37.5 m from the top: dropped, on campus or not
               dict(fid=4, cx=30, cy=20, x_m=0, y_m=0, oc=False),     # 142.5 m from the right edge: dropped
               dict(fid=5, cx=20, cy=29, x_m=0, y_m=0, oc=False)]     # 157.5 m from the bottom: kept
        got = campus.candidates(pts, score, street, sea, 15.0, edge_m=150)
        self.assertEqual(sorted(c["fid"] for c in got), [0, 1, 5])
    def test_default_edge_margin(self):
        from model import placement
        self.assertEqual(placement.EDGE_M, 300.0)
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
