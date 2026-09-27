import json, math, os, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open(os.path.join(ROOT, "places.json"), encoding="utf-8"))
DATA = {"tv": "data.json", "diliman": "data_diliman.json", "berkeley": "data_berkeley.json"}

def hav(a, b, c, d):
    r = math.radians
    x = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))

class Places(unittest.TestCase):
    def test_every_sensor_has_a_sensor_place(self):
        for site, f in DATA.items():
            ids = {s["id"] for s in json.load(open(os.path.join(ROOT, f)))["sensors"]}
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
        self.assertIn("b", {p["id"].split(":")[1] for p in P["sites"]["diliman"]})
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

if __name__ == "__main__":
    unittest.main()
