"""Campus-only parts of the model: candidate houses and the partnership card (spec §3.2, §6.3)."""
import numpy as np
from model import grids, placement


def candidates(pts, score, street, sea, cell_m, street_m=placement.STREET_M):
    """pts: dicts with fid, cx, cy (cell), x_m, y_m, oc. Keeps houses on land within street_m of a street cell
    and attaches the cell's score."""
    sd = grids.dist_m(street, cell_m)
    return [dict(p, score=float(score[p["cy"], p["cx"]])) for p in pts
            if not sea[p["cy"], p["cx"]] and sd[p["cy"], p["cx"]] <= street_m]


def card(units, spacing, brgy_grid, brgy_names, noah, sea, outline):
    """What the partnership card shows. NOAH shares are of land cells only; a missing map gives None."""
    land = ~sea
    ids = np.unique(brgy_grid[land & (brgy_grid > 0)])
    names = sorted({brgy_names[i - 1] for i in ids})
    nland = max(int(land.sum()), 1)
    shares = {rp: (None if g is None else round(float(((g >= 1) & land).sum()) / nland, 4)) for rp, g in noah.items()}
    return {"units": [{"id": u["id"], "name": u["bld"], "oc": bool(u["oc"])} for u in units],
            "barangays": names, "noah": shares, "spacing": spacing, "outline": bool(outline)}
