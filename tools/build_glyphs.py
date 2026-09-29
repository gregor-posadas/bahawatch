"""Map-label glyphs in Atkinson Hyperlegible Next (2026-09-29, Gregor: the low-vision typeface everywhere, map labels too).

MapLibre draws labels from signed-distance-field glyph files, 256 code points per file: shared/fonts/<fontstack>/<a>-<b>.pbf.
This renders them from the SIL OFL release of Atkinson Hyperlegible Next (github.com/google/fonts, ofl/atkinsonhyperlegiblenext,
variable font), in the same format and metrics as the Noto Sans files beside them (24 px, 3 px buffer, edge at 192, 32 per
pixel; top = bitmap top − 25), so labels sit where they did. Code points the font lacks are copied from the Noto Sans file
of the same range, so no label loses a character.

    python3 tools/build_glyphs.py <AtkinsonHyperlegibleNext[wght].ttf>
"""
import io, os, sys
import numpy as np, freetype
from scipy.ndimage import distance_transform_edt
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glyph_pbf as P

SIZE, BUF, UP, TOP = 24, 3, 8, 25                   # px size, buffer, supersampling for the distance field, top offset
STACKS = {"Atkinson Hyperlegible Next Regular": (400, "Noto Sans Regular"),
          "Atkinson Hyperlegible Next Medium": (500, "Noto Sans Medium")}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "shared", "fonts")


def instance(src, wght):
    f = instancer.instantiateVariableFont(TTFont(src), {"wght": wght})
    b = io.BytesIO(); f.save(b); return b.getvalue()


def sdf(face, cp):
    """One glyph: metrics at 24 px, distance field from a rendering 8× larger."""
    face.set_pixel_sizes(0, SIZE); face.load_char(cp, freetype.FT_LOAD_DEFAULT | freetype.FT_LOAD_NO_HINTING)
    m = face.glyph.metrics; adv = round(face.glyph.advance.x / 64)
    face.load_char(cp, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_NO_HINTING)
    bm = face.glyph.bitmap; w, h = bm.width, bm.rows
    left, top = face.glyph.bitmap_left, face.glyph.bitmap_top
    if w == 0 or h == 0:
        return dict(w=0, h=0, left=0, top=-TOP, adv=adv, bm=b"")
    face.set_pixel_sizes(0, SIZE * UP); face.load_char(cp, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_NO_HINTING)
    hb = face.glyph.bitmap; hl, ht = face.glyph.bitmap_left, face.glyph.bitmap_top
    hi = np.array(hb.buffer, np.uint8).reshape(hb.rows, hb.pitch)[:, :hb.width] >= 128
    # a canvas covering the 24 px bitmap plus its buffer, in high-res pixels
    W, H = (w + 2 * BUF) * UP, (h + 2 * BUF) * UP
    canvas = np.zeros((H + 2 * UP * 4, W + 2 * UP * 4), bool); pad = UP * 4
    ox = (hl - (left - BUF) * UP) + pad; oy = ((top + BUF) * UP - ht) + pad
    ys, xs = max(oy, 0), max(ox, 0)
    sub = hi[ys - oy:, xs - ox:][:canvas.shape[0] - ys, :canvas.shape[1] - xs]
    canvas[ys:ys + sub.shape[0], xs:xs + sub.shape[1]] |= sub
    d = (distance_transform_edt(~canvas) - distance_transform_edt(canvas)) / UP     # + outside, − inside, in 24 px pixels
    c = pad + UP // 2 + np.arange(w + 2 * BUF) * UP; r = pad + UP // 2 + np.arange(h + 2 * BUF) * UP
    v = np.clip(np.round(192 - 32 * d[np.ix_(r, c)]), 0, 255).astype(np.uint8)
    return dict(w=w, h=h, left=left, top=top - TOP, adv=adv, bm=v.tobytes())


def main(src):
    for name, (wght, fallback) in STACKS.items():
        face = freetype.Face(io.BytesIO(instance(src, wght)))
        have = {cp for cp, _ in face.get_chars()}
        os.makedirs(os.path.join(OUT, name), exist_ok=True)
        for f in sorted(os.listdir(os.path.join(OUT, fallback))):
            if not f.endswith(".pbf"): continue
            a, b = map(int, f[:-4].split("-"))
            gl = {cp: g for cp, g in P.read(os.path.join(OUT, fallback, f)).items()}      # Noto for what Atkinson lacks
            own = 0
            for cp in range(a, b + 1):
                if cp in have and cp >= 32:
                    gl[cp] = sdf(face, cp); own += 1
            open(os.path.join(OUT, name, f), "wb").write(P.write(name, f[:-4], gl))
            print(f"{name}/{f}: {own} Atkinson, {len(gl) - own} Noto")


if __name__ == "__main__":
    main(sys.argv[1])
