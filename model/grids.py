"""Grid helpers shared by build_data.py and tools/build_places.py (spec §6.1, §6.2).
Row 0 is the north edge, like build_data.py's world coordinates."""
import base64
import numpy as np
from scipy.ndimage import label, distance_transform_edt

BLOCK_FRAC = 0.75     # a cell at least this built-up blocks water
SUPER = 5             # built fraction is measured on a 5 × 5 sub-grid per cell


def rle(g):
    """(count, value) byte pairs, base64: the page's unrle() reads this."""
    flat = np.asarray(g).flatten(); out = bytearray(); i = 0
    while i < len(flat):
        v = flat[i]; n = 1
        while i + n < len(flat) and flat[i + n] == v and n < 255:
            n += 1
        out += bytes([n, int(v)]); i += n
    return base64.b64encode(bytes(out)).decode()


def unrle(s, n):
    b = base64.b64decode(s); g = np.zeros(n, np.uint8); o = 0
    for i in range(0, len(b), 2):
        g[o:o + b[i]] = b[i + 1]; o += b[i]
    return g


def rasterize(shapes, bbox, GW, GH, super_=1, dtype="uint8", fill=0):
    """Burn (GeoJSON geometry, value) pairs into a grid over bbox; a cell takes a value when its centre is inside.
    Later shapes overwrite earlier ones."""
    from rasterio.features import rasterize as burn
    from rasterio.transform import from_bounds
    shapes = list(shapes)
    if not shapes:
        return np.full((GH * super_, GW * super_), fill, dtype)
    return burn(shapes, out_shape=(GH * super_, GW * super_), transform=from_bounds(*bbox, GW * super_, GH * super_),
                fill=fill, dtype=dtype)


def built_fraction(polys, bbox, GW, GH, super_=SUPER):
    """Share (0–1) of each cell covered by the footprint polygons."""
    m = rasterize(((p, 1) for p in polys), bbox, GW, GH, super_)
    return m.reshape(GH, super_, GW, super_).mean(axis=(1, 3))


def label_polys(polys, bbox, GW, GH):
    """Cell → 1-based index of the polygon holding the cell centre (0 = none)."""
    return rasterize(((p, i + 1) for i, p in enumerate(polys)), bbox, GW, GH, dtype="int32")


def sea_mask(raw):
    """Sea: cells with no terrain value, or at or below 0 m, that connect to the grid edge.
    An inland hollow below 0 m stays land."""
    low = ~np.isfinite(raw) | (np.nan_to_num(raw, nan=-1.0) <= 0)
    lab, _ = label(low)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, sorted(edge))


def block_mask(frac, street, creek, sea):
    """Cells water may not enter: ≥ 75 % built (never a street or creek cell), and the sea."""
    return ((frac >= BLOCK_FRAC) & ~street & ~creek) | sea


def dist_m(mask, cell_m):
    """Metres from every cell to the nearest True cell (inf when there is none)."""
    if not mask.any():
        return np.full(mask.shape, np.inf)
    return distance_transform_edt(~mask) * cell_m


def counts(cells, GW, GH):
    """Per-cell count of (cx, cy) points, capped at 255 so it packs as bytes."""
    g = np.zeros((GH, GW), np.int32)
    for cx, cy in cells:
        g[cy, cx] += 1
    return np.minimum(g, 255).astype(np.uint8)
