import json, math, os, re, sys, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open(os.path.join(ROOT, "places.json"), encoding="utf-8"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_places as BP  # noqa: E402  (helper functions reused, not duplicated, by the tests below)
DATA = BP.data_files()      # {site: path} for every data/<site>.json

def rule_lookahead_min():
    """RULE.LOOKAHEAD_MIN as defined in shared/verdict.js — the one place rule constants live."""
    text = open(os.path.join(ROOT, "shared", "verdict.js"), encoding="utf-8").read()
    m = re.search(r"LOOKAHEAD_MIN:\s*(\d+)", text)
    assert m, "LOOKAHEAD_MIN not found in shared/verdict.js"
    return int(m.group(1))

def hav(a, b, c, d):
    r = math.radians
    x = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))

class Places(unittest.TestCase):
    def test_every_sensor_has_a_sensor_place(self):
        for site, f in DATA.items():
            ids = {s["id"] for s in json.load(open(f))["sensors"]}
            got = {p["sensor"] for p in P["sites"][site] if p["kind"] == "sensor"}
            self.assertEqual(ids, got, site)
    def test_ids_and_fields(self):
        for site, places in P["sites"].items():
            for p in places:
                self.assertRegex(p["id"], rf"^{site}:(s|b):[A-Za-z0-9-]+$")
                for k in ("name", "lat", "lon", "noah5", "noah25", "noahMapped", "lowM", "connected"):
                    self.assertIn(k, p)
                for c in p["connected"]:
                    self.assertIn(c["sensor"], P["sensors"])
                    self.assertTrue(0 <= c["travelMin"] <= 60)
                    if p["kind"] == "sensor":
                        self.assertNotEqual(c["sensor"], p["sensor"])
    def test_barangays_only_in_philippine_sites(self):
        kinds = lambda s: {p["kind"] for p in P["sites"][s]}
        self.assertIn("b", {p["id"].split(":")[1] for p in P["sites"]["tv"]})
        self.assertIn("b", {p["id"].split(":")[1] for p in P["sites"]["upd"]})
        self.assertEqual(kinds("berkeley"), {"sensor"})
    def test_noah_flags(self):
        self.assertFalse(any(p["noahMapped"] for p in P["sites"]["berkeley"]))
        self.assertTrue(all(p["noahMapped"] for p in P["sites"]["tv"]))
        self.assertTrue(any(p["noah5"] or p["noah25"] for p in P["sites"]["tv"]))
    def test_connectivity_found_somewhere(self):
        self.assertTrue(any(p["connected"] for p in P["sites"]["tv"]))
    def test_sensor_place_sits_on_its_sensor(self):
        for site, places in P["sites"].items():
            for p in places:
                if p["kind"] == "sensor":
                    s = P["sensors"][p["sensor"]]
                    self.assertLess(hav(p["lat"], p["lon"], s["lat"], s["lon"]), 1.0)
    def test_travel_min_within_rule_lookahead(self):
        limit = rule_lookahead_min()
        for site, places in P["sites"].items():
            for p in places:
                for c in p["connected"]:
                    self.assertLessEqual(c["travelMin"], limit, (site, p["id"], c))
    def test_noah5_implies_noah25(self):
        for site, places in P["sites"].items():
            for p in places:
                if p["noah5"]:
                    self.assertTrue(p["noah25"], (site, p["id"]))
    def test_barangay_noah_flags_match_share_threshold(self):
        for site, f in DATA.items():
            gj = BP.barangays_path(site)
            if not gj:
                continue
            d = json.load(open(f, encoding="utf-8"))
            noah, hazard = BP.noah_layers(d)
            feats = {feat["properties"]["pcode"]: feat for feat in json.load(open(gj, encoding="utf-8"))["features"]}
            for p in P["sites"][site]:
                if p["kind"] != "barangay":
                    continue
                pcode = p["id"].split(":")[2]
                feat = feats.get(pcode)
                self.assertIsNotNone(feat, (site, p["id"]))
                cells = BP.barangay_cells(d, feat)
                for k, key in (("5", "noah5"), ("25", "noah25")):
                    share = BP.zone_share(noah[k], cells)
                    self.assertEqual(p[key], share >= BP.NOAH_SHARE, (site, p["id"], k, share))

    def test_barangay_inside_sensors(self):
        # I2: every barangay lists the same-site sensors whose point lies inside its polygon
        self.assertTrue(any(p["kind"] == "barangay" and p["name"] == "U.P. Campus" for p in P["sites"]["upd"]))
        for site, f in DATA.items():
            gj = BP.barangays_path(site)
            feats = {feat["properties"]["pcode"]: feat for feat in json.load(open(gj, encoding="utf-8"))["features"]} if gj else {}
            d = json.load(open(f, encoding="utf-8"))
            for p in P["sites"][site]:
                self.assertIn("inside", p, (site, p["id"]))
                if p["kind"] == "sensor":
                    self.assertEqual(p["inside"], [p["sensor"]], (site, p["id"]))
                    continue
                rings = [r for poly in BP.polys(feats[p["id"].split(":")[2]]["geometry"]) for r in poly]
                want = sorted(s["id"] for s in d["sensors"] if BP.point_in_poly(s["lat"], s["lon"], rings))
                self.assertEqual(sorted(p["inside"]), want, (site, p["id"]))
                for sid in p["inside"]:
                    self.assertEqual(P["sensors"][sid]["site"], site)

    def test_every_site_file_carries_its_own_places(self):
        self.assertEqual(set(DATA), set(P["sites"]))
        self.assertEqual(len(DATA), 27)                   # 25 campuses and the two pilots
        for site, f in DATA.items():
            self.assertEqual(json.load(open(f, encoding="utf-8"))["places"], P["sites"][site], site)

class Reach(unittest.TestCase):
    def test_water_never_travels_through_a_blocked_cell(self):
        import numpy as np
        elev = np.zeros((9, 9), np.float32); block = np.zeros((9, 9), bool); block[:, 4] = True
        r = BP.reach(elev, (4, 1), 15.0, block)
        self.assertTrue((4, 3) in r and not any(x >= 4 for _, x in r))
        block[4, 4] = False                               # a street through the wall
        self.assertIn((4, 7), BP.reach(elev, (4, 1), 15.0, block))

if __name__ == "__main__":
    unittest.main()
