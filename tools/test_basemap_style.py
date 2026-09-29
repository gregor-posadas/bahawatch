"""The basemap styles (spec §4.2, §7): OpenFreeMap tiles and fonts, our layers, the sea kept apart from the flood and
hazard colours, readable labels, committed files current. Run: python3 -m unittest tools.test_basemap_style"""
import json, math, os, sys, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import basemap_style as B  # noqa: E402


def lab(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    r, g, b = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    return 116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))


def de2000(a, b):
    L1, a1, b1 = lab(a); L2, a2, b2 = lab(b)
    Cb = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2; G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2; C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360; h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p; dh = h2p - h1p
    dh = 0 if C1p * C2p == 0 else dh - 360 if dh > 180 else dh + 360 if dh < -180 else dh
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2)); Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hb = h1p + h2p if C1p * C2p == 0 else (h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb)) + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.20 * math.cos(math.radians(4 * hb - 63))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)); Rt = -math.sin(math.radians(2 * 30 * math.exp(-((hb - 275) / 25) ** 2))) * Rc
    Sl = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2); Sc = 1 + 0.045 * Cbp; Sh = 1 + 0.015 * Cbp * T
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def contrast(a, b):
    def lum(h):
        h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        r, g, bb = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * r + 0.7152 * g + 0.0722 * bb
    x, y = lum(a), lum(b); return (max(x, y) + 0.05) / (min(x, y) + 0.05)


# the page's flood-depth bands per theme (template.html mapPal), the NOAH purples (light) and the creek blue
AVOID = {"light": ["#8fc6e2", "#2f86c2", "#0030a0", "#d9c2ea", "#a978cf", "#5b2a8f", "#70c0e0"],
         "dark": ["#2e5a7a", "#3f93bf", "#a7e0f5", "#70c0e0"]}


class Styles(unittest.TestCase):
    def test_committed_files_are_current(self):
        for theme, name in (("light", "basemap-style.json"), ("dark", "basemap-style-dark.json")):
            self.assertEqual(json.load(open(os.path.join(ROOT, "shared", name), encoding="utf-8")), B.style(theme), name)
        self.assertEqual(json.load(open(os.path.join(ROOT, "tests", "fixtures", "basemap-offline.json"), encoding="utf-8")), B.fixture())

    def test_own_tiles_and_fonts(self):
        s = B.style("light"); src = s["sources"]["base"]
        self.assertEqual((src["type"], src["url"]), ("vector", "pmtiles://shared/tiles/ph-base.pmtiles"))
        self.assertIn("OpenStreetMap", src["attribution"]); self.assertIn("Open Buildings", src["attribution"])
        self.assertEqual(s["glyphs"], "shared/fonts/{fontstack}/{range}.pbf")
        for f in ("Atkinson Hyperlegible Next Regular", "Atkinson Hyperlegible Next Medium"):
            self.assertTrue(os.path.exists(os.path.join(ROOT, "shared", "fonts", f, "0-255.pbf")), f)
        for k, v in s["sources"].items():                     # every archive the style names is in the repo
            self.assertTrue(os.path.exists(os.path.join(ROOT, v["url"][len("pmtiles://"):])), k)
        self.assertIn("site-tv", s["sources"]); self.assertIn("site-upd", s["sources"])
        self.assertNotIn("sprite", s)

    def test_world_style_for_berkeley(self):
        w = B.world_style("light")
        self.assertEqual(w["sources"]["openmaptiles"]["url"], "https://tiles.openfreemap.org/planet")
        for theme, name in (("light", "basemap-style-world.json"), ("dark", "basemap-style-world-dark.json")):
            self.assertEqual(json.load(open(os.path.join(ROOT, "shared", name), encoding="utf-8")), B.world_style(theme), name)

    def test_layers(self):
        for theme in ("light", "dark"):
            s = B.style(theme); ids = [l["id"] for l in s["layers"]]
            for need in ("water", "land", "builtup", "river", "road-major", "road-mid", "road-minor", "building-upd", "road-label", "place-label"):
                self.assertIn(need, ids, need)
            self.assertLess(ids.index("land"), ids.index("road-major"))
            self.assertEqual(next(l for l in s["layers"] if l["id"] == "building-upd")["minzoom"], 13)
            self.assertEqual(s["layers"][0]["paint"]["background-color"], B.PALETTES[theme]["sea"])

    def test_sea_is_far_from_flood_hazard_and_creek_colours(self):
        for theme in ("light", "dark"):
            sea = B.PALETTES[theme]["sea"]
            for c in AVOID[theme]:
                self.assertGreaterEqual(de2000(sea, c), 15, f"{theme} sea {sea} vs {c}")
            self.assertGreaterEqual(de2000(sea, B.PALETTES[theme]["land"]), 7, f"{theme} sea vs land")

    def test_labels_are_readable(self):
        for theme in ("light", "dark"):
            p = B.PALETTES[theme]
            self.assertGreaterEqual(contrast(p["label"], p["land"]), 4.5, theme)
            for l in B.style(theme)["layers"]:
                if l["type"] == "symbol":
                    ts = l["layout"]["text-size"]; sizes = [ts] if isinstance(ts, (int, float)) else [v for v in ts if isinstance(v, (int, float))]
                    self.assertTrue(all(v >= 12 for v in sizes), (l["id"], sizes))


if __name__ == "__main__":
    unittest.main()
