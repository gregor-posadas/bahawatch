"""A made-up campus 'zz' with every input the campus build reads, for tests that can't wait for real data.
python3 model/tests/fixture_campus.py <folder>  → <folder>/campuses.csv and <folder>/inputs/zz/…"""
import csv, json, math, os, sys
import numpy as np

LAT, LON = 14.0, 121.5
ML = 111320.0 * math.cos(math.radians(LAT)); MY = 110640.0


def ll(dx_m, dy_m):
    return [round(LON + dx_m / ML, 7), round(LAT + dy_m / MY, 7)]


def sq(cx, cy, h):
    return {"type": "Polygon", "coordinates": [[ll(cx - h, cy - h), ll(cx + h, cy - h), ll(cx + h, cy + h), ll(cx - h, cy + h), ll(cx - h, cy - h)]]}


def fc(fs):
    return {"type": "FeatureCollection", "features": fs}


def make(folder):
    import rasterio
    from rasterio.transform import from_origin
    d = os.path.join(folder, "inputs", "zz"); os.makedirs(d, exist_ok=True)
    # terrain: 30 m at the centre, rising 1 m per 100 m northwards, a 6 m valley along the creek at x = +600 m, sea (nodata) west of −1300 m, inside the box
    px = 0.0003; x0, y1 = LON - 2000 / ML, LAT + 2000 / MY; n = int(4000 / ML / px) + 1; m = int(4000 / MY / px) + 1
    xs = (x0 + (np.arange(n) + 0.5) * px - LON) * ML; ys = (y1 - (np.arange(m) + 0.5) * px - LAT) * MY
    X, Y = np.meshgrid(xs, ys)
    z = (30 + Y / 100 - 6 * np.exp(-((X - 600) / 120) ** 2)).astype("float32")
    z[X < -1300] = -9999.0
    with rasterio.open(os.path.join(d, "dem.tif"), "w", driver="GTiff", width=n, height=m, count=1, dtype="float32",
                       crs="EPSG:4326", nodata=-9999.0, transform=from_origin(x0, y1, px, px)) as t:
        t.write(z, 1)
    ways = [{"type": "Feature", "properties": {"highway": "residential", "name": f"Kalye {i}"},
             "geometry": {"type": "LineString", "coordinates": [ll(-1500, v), ll(1500, v)]}} for i, v in enumerate(range(-1400, 1500, 200))]
    ways += [{"type": "Feature", "properties": {"highway": "residential", "name": f"Daan {i}"},
              "geometry": {"type": "LineString", "coordinates": [ll(v, -1500), ll(v, 1500)]}} for i, v in enumerate(range(-1400, 1500, 200))]
    ways.append({"type": "Feature", "properties": {"highway": "primary", "name": "Main Avenue"},
                 "geometry": {"type": "LineString", "coordinates": [ll(-1500, 0), ll(1500, 0)]}})
    ways.append({"type": "Feature", "properties": {"waterway": "stream", "name": "Test Creek"},
                 "geometry": {"type": "LineString", "coordinates": [ll(600, -1500), ll(600, 1500)]}})
    json.dump(fc(ways), open(os.path.join(d, "osm.geojson"), "w"))
    bl = []
    for v in range(-1400, 1500, 200):
        for u in range(-1480, 1500, 40):
            for cx, cy in ((u, v + 14), (v + 14, u)):
                if abs(cx - 600) > 30:
                    bl.append((cx, cy))
    bl += [(x, y) for x in range(-100, 101, 20) for y in range(-100, 101, 20) if (x, y) != (0, 0)]   # a dense campus block
    bl = sorted(set(bl))
    fs = [{"type": "Feature", "properties": {"fid": i, "src": "test", "px": ll(x, y)[0], "py": ll(x, y)[1]}, "geometry": sq(x, y, 5 if abs(x) > 100 or abs(y) > 100 else 9)}
          for i, (x, y) in enumerate(bl)]
    json.dump(fc(fs), open(os.path.join(d, "buildings.geojson"), "w"))
    json.dump(fc([{"type": "Feature", "properties": {"Var": 1, "src": "t"}, "geometry": sq(800, 0, 700)},
                  {"type": "Feature", "properties": {"Var": 3, "src": "t"}, "geometry": sq(600, -800, 150)}]), open(os.path.join(d, "noah_5.geojson"), "w"))
    json.dump(fc([{"type": "Feature", "properties": {"Var": 2, "src": "t"}, "geometry": sq(600, 0, 1000)}]), open(os.path.join(d, "noah_25.geojson"), "w"))
    json.dump({"5": "covered", "25": "covered", "100": "missing"}, open(os.path.join(d, "noah.json"), "w"))
    json.dump(fc([{"type": "Feature", "properties": {"pcode": "PH0000001", "name": "Kanluran", "muni": "Testville", "lat": LAT, "lon": ll(-800, 0)[0]},
                   "geometry": {"type": "Polygon", "coordinates": [[ll(-1700, -1700), ll(0, -1700), ll(0, 1700), ll(-1700, 1700), ll(-1700, -1700)]]}},
                  {"type": "Feature", "properties": {"pcode": "PH0000002", "name": "Silangan", "muni": "Testville", "lat": LAT, "lon": ll(800, 0)[0]},
                   "geometry": {"type": "Polygon", "coordinates": [[ll(0, -1700), ll(1700, -1700), ll(1700, 1700), ll(0, 1700), ll(0, -1700)]]}}]),
              open(os.path.join(d, "barangays.geojson"), "w"))
    json.dump(fc([{"type": "Feature", "properties": {"ref": "w1", "name": "Test University"}, "geometry": sq(0, 0, 200)}]), open(os.path.join(d, "outline.geojson"), "w"))
    cols = ["id", "short", "name", "campus", "group", "type", "city", "province", "osm_pattern", "hint_lat", "hint_lon", "osm_ref", "lat", "lon"]
    with open(os.path.join(folder, "campuses.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(cols)
        w.writerow(["zz", "TU", "Test University", "Main", "Luzon", "SUC", "Testville", "Nowhere", "Test University", LAT, LON, "w1", LAT, LON])
    return folder


if __name__ == "__main__":
    make(sys.argv[1]); print("fixture campus written to", sys.argv[1])
