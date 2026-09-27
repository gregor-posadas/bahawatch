#!/usr/bin/env python3
"""One QR code per place, pointing at its share link (spec §5). python3 tools/make_qr.py [base_url]"""
import csv, json, os, sys, qrcode
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://gregor-posadas.github.io/bahawatch/"
P = json.load(open(os.path.join(ROOT, "places.json"), encoding="utf-8"))
out = os.path.join(ROOT, "qr"); os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "index.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n"); w.writerow(["place_id", "name", "url", "file"])
    for site, places in P["sites"].items():
        os.makedirs(os.path.join(out, site), exist_ok=True)
        for p in places:
            site_, kind, code = p["id"].split(":")
            url = BASE + "#p." + ".".join((site_, kind, code))
            rel = f"qr/{site}/{kind}-{code}.png"
            qrcode.make(url, box_size=10, border=4).save(os.path.join(ROOT, rel))
            w.writerow([p["id"], p["name"], url, rel])
print("QR codes written to qr/")
