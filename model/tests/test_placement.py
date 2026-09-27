import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from model import placement as P


def cand(fid, x, y, score, oc=False):
    return {"fid": fid, "x_m": x, "y_m": y, "score": score, "oc": oc}


class Scores(unittest.TestCase):
    def test_lowness_pit_and_peak(self):
        e = np.full((41, 41), 10.0); e[20, 20] = 5.0; e[5, 5] = 20.0
        low = P.lowness(e, 15.0)
        self.assertEqual(low[20, 20], 1.0)              # nothing nearby is lower
        self.assertLess(low[5, 5], 0.05)                # almost everything nearby is lower
    def test_lowness_ignores_sea(self):
        e = np.full((21, 21), 2.0); e[:, :10] = -5.0; valid = e > 0
        self.assertEqual(P.lowness(e, 15.0, valid=valid)[10, 15], 1.0)   # the sea is lower, but it isn't ground
    def test_hazard_tiers_and_missing_maps(self):
        n5 = np.array([[1, 0, 0, 0]]); n25 = np.array([[1, 1, 0, 0]]); n100 = np.array([[1, 1, 1, 0]])
        self.assertEqual(P.hazard({"5": n5, "25": n25, "100": n100}, (1, 4)).tolist(), [[1.0, 0.66, 0.33, 0.0]])
        self.assertEqual(P.hazard({"5": None, "25": n25, "100": None}, (1, 4)).tolist(), [[0.66, 0.66, 0.0, 0.0]])
    def test_near_water(self):
        self.assertEqual(P.near_water(np.array([0.0, 150.0, 300.0, np.inf])).tolist(), [1.0, 0.5, 0.0, 0.0])

class Pick(unittest.TestCase):
    def line(self, n, step, oc_at=None):
        return [cand(i, i * step, 0.0, 1.0 - i / 100, oc=(i == oc_at)) for i in range(n)]
    def test_first_unit_is_on_campus_even_if_it_scores_lower(self):
        cs = self.line(20, 310.0, oc_at=5)
        chosen, sp = P.pick(cs)
        self.assertEqual(chosen[0]["fid"], 5); self.assertEqual(sp, 300.0); self.assertEqual(len(chosen), 8)
    def test_spacing_is_kept(self):
        cs = [cand(i, (i % 10) * 100.0, (i // 10) * 100.0, 1.0 - i / 1000, oc=(i == 0)) for i in range(100)]
        chosen, sp = P.pick(cs)
        for a in chosen:
            for b in chosen:
                if a is not b: self.assertGreaterEqual(((a["x_m"] - b["x_m"]) ** 2 + (a["y_m"] - b["y_m"]) ** 2) ** 0.5, sp)
    def test_falls_back_to_closer_spacing_then_fails(self):
        chosen, sp = P.pick(self.line(8, 260.0, oc_at=0)); self.assertEqual(sp, 250.0)
        with self.assertRaises(ValueError): P.pick(self.line(8, 150.0, oc_at=0))
    def test_no_campus_candidate_fails(self):
        with self.assertRaises(ValueError): P.pick(self.line(20, 400.0))
    def test_ok_rejects_are_skipped_and_ties_break_by_fid(self):
        cs = [cand(9, 0, 0, 0.5, oc=True)] + [cand(i, 1000.0 * i, 0, 0.9) for i in (3, 1, 2)] + [cand(i, 1000.0 * i, 0, 0.1) for i in range(4, 10) if i != 9]
        chosen, _ = P.pick(cs, ok=lambda c: c["fid"] != 2)
        self.assertEqual([c["fid"] for c in chosen], [9, 1, 3, 4, 5, 6, 7, 8])

if __name__ == "__main__":
    unittest.main()
