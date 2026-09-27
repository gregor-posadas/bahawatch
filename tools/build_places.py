#!/usr/bin/env python3
"""places.json: every sensor street and barangay the page can answer for, with NOAH flags and
connected sensors (spec §3, §7). Run from the repo root: python3 tools/build_places.py"""
import base64, heapq, json, math, os, re, statistics
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = {"tv": "data.json", "diliman": "data_diliman.json", "berkeley": "data_berkeley.json"}
FLOW_SPEED_MS = 0.5          # overland flow along streets, m/s (tunable)
SPILL_M = 0.10               # water from a sensor spreads to cells no higher than its ground + 10 cm
NOAH_SHARE = 0.10            # a barangay is flagged for a NOAH zone only when at least this share of its cells sit in it

def read_lookahead_min():
    """RULE.LOOKAHEAD_MIN lives in one place: shared/verdict.js. Read it from there so places.json
    can never silently desync from a future rule-constant tune."""
    path = os.path.join(ROOT, "shared", "verdict.js")
    text = open(path, encoding="utf-8").read()
    m = re.search(r"LOOKAHEAD_MIN:\s*(\d+)", text)
    if not m:
        raise RuntimeError(f"LOOKAHEAD_MIN not found in {path}")
    return int(m.group(1))

LOOKAHEAD_MIN = read_lookahead_min()   # RULE.LOOKAHEAD_MIN

def b64(s): return base64.b64decode(s)
def elev_grid(d):
    return (np.frombuffer(b64(d["elev"]), dtype="<i2").astype(np.float32) / 10.0).reshape(d["GH"], d["GW"])
def unrle(s, n):
    b = b64(s); g = np.zeros(n, np.uint8); o = 0
    for i in range(0, len(b), 2):
        g[o:o + b[i]] = b[i + 1]; o += b[i]
    return g

def cell_center(d, cx, cy):
    x0, y0, x1, y1 = d["bbox"]
    return (y1 - (cy + 0.5) / d["GH"] * (y1 - y0), x0 + (cx + 0.5) / d["GW"] * (x1 - x0))   # lat, lon

def point_in_poly(lat, lon, rings):
    inside = False
    for ring in rings:
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i]; xj, yj = ring[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
    return inside

def polys(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]

def noah_layers(d):
    """The site's NOAH 5-yr/25-yr hazard grids, and whether it is hazard-mapped at all (spec §7)."""
    GH, GW = d["GH"], d["GW"]; N = GH * GW
    hazard = bool(d["site"].get("hazard"))
    layers = {k: (unrle(d["noah"][k], N).reshape(GH, GW) if hazard else np.zeros((GH, GW), np.uint8)) for k in ("5", "25")}
    return layers, hazard

def barangay_cells(d, feature):
    """Grid cells whose centre falls inside a barangay GeoJSON feature's polygon."""
    rings = [r for p in polys(feature["geometry"]) for r in p]
    return [(cy, cx) for cy in range(d["GH"]) for cx in range(d["GW"]) if point_in_poly(*cell_center(d, cx, cy), rings)]

def zone_share(layer, cells):
    """Fraction of `cells` that sit inside a NOAH hazard layer."""
    if not cells: return 0.0
    return sum(1 for cy, cx in cells if layer[cy, cx] >= 1) / len(cells)

def reach(elev, start, cell_m):
    """Minutes for water to travel from `start` to every cell it can spill into (≤ LOOKAHEAD_MIN)."""
    GH, GW = elev.shape; sy, sx = start; top = elev[sy, sx] + SPILL_M
    lim = FLOW_SPEED_MS * LOOKAHEAD_MIN * 60
    dist = {start: 0.0}; pq = [(0.0, start)]
    while pq:
        dd, (y, x) = heapq.heappop(pq)
        if dd > dist.get((y, x), 1e18): continue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not (dy or dx): continue
                ny, nx = y + dy, x + dx
                if not (0 <= ny < GH and 0 <= nx < GW) or elev[ny, nx] > top: continue
                nd = dd + cell_m * (1.4142 if dy and dx else 1.0)
                if nd <= lim and nd < dist.get((ny, nx), 1e18):
                    dist[(ny, nx)] = nd; heapq.heappush(pq, (nd, (ny, nx)))
    return {k: v / FLOW_SPEED_MS / 60 for k, v in dist.items()}

def build_site(site, d):
    GH, GW = d["GH"], d["GW"]; N = GH * GW
    elev = elev_grid(d); street = unrle(d["street"], N).reshape(GH, GW)
    noah, hazard = noah_layers(d)
    x0, y0, x1, y1 = d["bbox"]
    cell_m = (x1 - x0) * 111320 * math.cos(math.radians((y0 + y1) / 2)) / GW
    gref = statistics.median(s["g"] for s in d["sensors"])
    reaches = {s["id"]: reach(elev, (s["cy"], s["cx"]), cell_m) for s in d["sensors"]}

    def place(pid, kind, name, lat, lon, cells, rep, extra):
        # Sensor streets: a small local neighbourhood, so any cell in the zone is enough to flag it.
        # Barangays: a large polygon, so only flag it when a meaningful share of it is in the zone
        # (a few edge cells inside a huge barangay shouldn't turn the whole place "Baka").
        if kind == "barangay":
            flag = lambda k: zone_share(noah[k], cells) >= NOAH_SHARE
        else:
            flag = lambda k: bool(any(noah[k][cy, cx] >= 1 for cy, cx in cells))
        conn = []
        for sid, r in reaches.items():
            if extra.get("sensor") == sid or rep not in r: continue
            conn.append({"sensor": sid, "travelMin": round(r[rep])})
        return {"id": pid, "kind": kind, "name": name, "lat": round(lat, 6), "lon": round(lon, 6),
                "noah5": flag("5"), "noah25": flag("25"), "noahMapped": hazard,
                "lowM": round(float(elev[rep] - gref), 2), "connected": sorted(conn, key=lambda c: c["travelMin"]), **extra}

    out = []
    for s in d["sensors"]:
        name = s.get("bld") or ((s.get("hn") + " " if s.get("hn") else "") + s["street"])
        cells = [(y, x) for y in range(s["cy"] - 1, s["cy"] + 2) for x in range(s["cx"] - 1, s["cx"] + 2) if 0 <= y < GH and 0 <= x < GW]
        out.append(place(f"{site}:s:{s['id']}", "sensor", name, s["lat"], s["lon"], cells, (s["cy"], s["cx"]), {"sensor": s["id"], "inside": [s["id"]]}))
    gj = os.path.join(ROOT, "sites", site, "barangays.geojson")
    if os.path.exists(gj):
        for f in json.load(open(gj, encoding="utf-8"))["features"]:
            pr = f["properties"]
            cells = barangay_cells(d, f)
            if not cells: continue
            st = [c for c in cells if street[c]] or cells
            rep = min(st, key=lambda c: elev[c])
            # Sensors standing inside the barangay answer for it directly ("here"), whether or not their water
            # would reach the barangay's lowest street cell (`connected` only covers that one cell).
            rings = [r for p in polys(f["geometry"]) for r in p]
            inside = sorted(x["id"] for x in d["sensors"] if point_in_poly(x["lat"], x["lon"], rings))
            out.append(place(f"{site}:b:{pr['pcode']}", "barangay", pr["name"], pr["lat"], pr["lon"], cells, rep, {"muni": pr["muni"], "inside": inside}))
    return out

def main():
    res = {"version": 1, "sensors": {}, "sites": {}}
    for site, f in DATA.items():
        d = json.load(open(os.path.join(ROOT, f), encoding="utf-8"))
        res["sites"][site] = build_site(site, d)
        for s in d["sensors"]:
            name = s.get("bld") or ((s.get("hn") + " " if s.get("hn") else "") + s["street"])
            res["sensors"][s["id"]] = {"site": site, "name": name, "lat": s["lat"], "lon": s["lon"]}
        print(site, len(res["sites"][site]), "places")
    json.dump(res, open(os.path.join(ROOT, "places.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    main()
