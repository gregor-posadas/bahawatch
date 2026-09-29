"""Automatic unit placement (spec §6.3): score every candidate building, then pick best-first with spacing."""
import math
import numpy as np

W_LOW, W_HAZ, W_WATER = 0.5, 0.3, 0.2
RADIUS_M = 300.0       # lowness is judged against ground within this distance
WATER_M = 300.0        # the near-water score falls to 0 here
STREET_M = 25.0        # a unit's house must be this close to a street
EDGE_M = 300.0         # and this far inside the 3 km box, so it is not drawn under the map's edge, legend or credits
N_UNITS = 8
SPACINGS = (300.0, 250.0, 200.0)


def lowness(elev, cell_m, radius_m=RADIUS_M, valid=None):
    """1 − (share of cells within radius_m that are lower than this cell). Cells off the grid or not valid (sea)
    are not counted, so a cell by the shore is judged against land only."""
    GH, GW = elev.shape
    r = int(round(radius_m / cell_m))
    e = elev.astype(float) if valid is None else np.where(valid, elev, np.nan)
    pad = np.pad(e, r, constant_values=np.nan)
    below = np.zeros(elev.shape); n = np.zeros(elev.shape)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r:
                continue
            s = pad[r + dy:r + dy + GH, r + dx:r + dx + GW]
            ok = ~np.isnan(s)
            n += ok
            below += ok & (s < e)
    return 1.0 - below / np.maximum(n, 1)


def hazard(noah, shape):
    """1.0 in a 5-yr zone, 0.66 in a 25-yr zone only, 0.33 in a 100-yr zone only, else 0. A missing map is skipped."""
    h = np.zeros(shape)
    for rp, v in (("100", 0.33), ("25", 0.66), ("5", 1.0)):
        g = noah.get(rp)
        if g is not None:
            h = np.where(g >= 1, v, h)
    return h


def near_water(dist):
    """1 at a creek or drain, falling linearly to 0 at WATER_M."""
    return np.clip(1.0 - dist / WATER_M, 0.0, 1.0)


def score(elev, noah, creek_dist, cell_m, valid=None):
    return (W_LOW * lowness(elev, cell_m, valid=valid) + W_HAZ * hazard(noah, elev.shape)
            + W_WATER * near_water(creek_dist))


def pick(cands, n=N_UNITS, spacings=SPACINGS, ok=lambda c: True, all_inside=False):
    """cands: dicts with fid, x_m, y_m, score, oc (on campus). Unit 1 is the best on-campus candidate; the rest are
    off-campus houses (or, with all_inside, houses inside the outline) taken best-first at least `spacing` metres from
    every unit already chosen. ok(c) is asked only of a candidate
    about to be chosen (naming it is slow). Returns (chosen, spacing used)."""
    order = sorted(cands, key=lambda c: (-c["score"], c["fid"]))
    bad = set()

    def good(c):
        if c["fid"] in bad:
            return False
        if ok(c):
            return True
        bad.add(c["fid"])
        return False

    first = next((c for c in order if c["oc"] and good(c)), None)
    if first is None:
        raise ValueError("no usable candidate on campus")
    best = [first]
    for sp in spacings:
        chosen = [first]
        for c in order:
            if len(chosen) == n:
                break
            if c is first or c["oc"] != all_inside:   # spec §7.1: exactly one unit, unit 01, inside the campus outline;
                continue                              # all_inside (a barangay pilot, sjq): every unit inside it
            if all(math.hypot(c["x_m"] - o["x_m"], c["y_m"] - o["y_m"]) >= sp for o in chosen) and good(c):
                chosen.append(c)
        if len(chosen) == n:
            return chosen, sp
        best = chosen
    raise ValueError(f"only {len(best)} units fit at {spacings[-1]:.0f} m")
