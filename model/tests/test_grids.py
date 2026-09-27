import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from model import grids

BBOX = (0.0, 0.0, 10.0, 10.0)          # 10 × 10 cells of 1° for easy arithmetic; row 0 is the north edge


def sq(x0, y0, x1, y1):
    return {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}


class Grids(unittest.TestCase):
    def test_rle_round_trip(self):
        g = np.zeros((20, 30), np.uint8); g[3:9, 4:25] = 2; g[15, :] = 1
        self.assertTrue((grids.unrle(grids.rle(g), g.size).reshape(g.shape) == g).all())

    def test_built_fraction(self):
        f = grids.built_fraction([sq(2, 7, 3, 8), sq(5, 5, 5.4, 6)], BBOX, 10, 10)
        self.assertAlmostEqual(f[2, 2], 1.0)          # lat 7–8 is row 2 counted from the north
        self.assertAlmostEqual(f[4, 5], 0.4, places=6)   # 0.4 of a cell wide: 2 of the 5 sub-columns have their centres inside
        self.assertEqual(f.sum().round(6), 1.4)

    def test_label_polys(self):
        lab = grids.label_polys([sq(0, 0, 10, 10), sq(0, 9, 1, 10)], BBOX, 10, 10)
        self.assertEqual(lab[0, 0], 2); self.assertEqual(lab[5, 5], 1)

    def test_sea_is_low_ground_touching_the_edge(self):
        raw = np.full((10, 10), 5.0)
        raw[:, 0:2] = 0.0; raw[0, 5] = np.nan           # a coast on the west edge and a nodata cell on the north edge
        raw[5, 5] = -1.0                                # an inland hollow below sea level
        sea = grids.sea_mask(raw)
        self.assertTrue(sea[:, 0:2].all() and sea[0, 5])
        self.assertFalse(sea[5, 5]); self.assertEqual(int(sea.sum()), 21)

    def test_block_never_streets_or_creeks_always_sea(self):
        frac = np.full((3, 3), 0.9); street = np.zeros((3, 3), bool); creek = np.zeros((3, 3), bool); sea = np.zeros((3, 3), bool)
        street[1, :] = True; creek[:, 1] = True; sea[0, 0] = True; frac[2, 2] = 0.74
        b = grids.block_mask(frac, street, creek, sea)
        self.assertEqual(b.astype(int).tolist(), [[1, 0, 1], [0, 0, 0], [1, 0, 0]])

    def test_dist_and_counts(self):
        m = np.zeros((5, 5), bool); m[2, 2] = True
        d = grids.dist_m(m, 15.0)
        self.assertEqual(d[2, 4], 30.0); self.assertTrue(np.isinf(grids.dist_m(np.zeros((2, 2), bool), 15.0)).all())
        c = grids.counts([(1, 1), (1, 1), (0, 2)], 3, 3)
        self.assertEqual(c[1, 1], 2); self.assertEqual(c[2, 0], 1); self.assertEqual(c.dtype, np.uint8)

if __name__ == "__main__":
    unittest.main()
