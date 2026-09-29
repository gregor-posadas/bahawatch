"""model/grids.fine_elev agrees with shared/flood.js fineElev on the same case (shared/flood.test.js FINE_CASE)."""
import unittest, numpy as np
from model.grids import fine_elev

EXPECT = [[10.0, 10.5, 11.5, 12.5, 13.5, 14.0], [10.25, 10.75, 10.0, 12.75, 13.75, 14.25],
          [10.75, 11.25, 12.25, 13.25, 14.25, 14.75], [11.0, 11.5, 12.5, 13.5, 14.5, 15.0]]

class FineElev(unittest.TestCase):
    def test_same_numbers_as_the_page(self):
        st = np.zeros((4, 6), bool); st.flat[8] = True
        e = fine_elev([100, 120, 140, 110, 130, 150], 3, 2, 6, 4, st, 0.5)
        np.testing.assert_allclose(e, EXPECT, atol=1e-6)

    def test_five_by_five_window(self):
        st = np.zeros((4, 6), bool); st.flat[8] = True
        np.testing.assert_allclose(fine_elev([100, 120, 140, 110, 130, 150], 3, 2, 6, 4, st, 0.5, 5), [[10.0, 10.5, 11.5, 12.5, 13.5, 14.0], [10.25, 10.75, 9.5, 12.75, 13.75, 14.25], [10.75, 11.25, 12.25, 13.25, 14.25, 14.75], [11.0, 11.5, 12.5, 13.5, 14.5, 15.0]], atol=1e-6)

if __name__ == "__main__":
    unittest.main()
