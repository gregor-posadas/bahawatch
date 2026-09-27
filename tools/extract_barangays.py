#!/usr/bin/env python3
"""Barangay polygons (PSA/NAMRIA admin level 4) whose centre lies in a site's frame → one GeoJSON per site.
Run where phl_admin_boundaries.shp.zip lives:  python3 extract_barangays.py <zip> <outdir>"""
import io, json, sys, zipfile, shapefile

BBOX = {"tv": (121.0470, 14.6300, 121.0755, 14.6545), "diliman": (121.0560, 14.6440, 121.0820, 14.6700)}
zpath, outdir = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(zpath)
rd = shapefile.Reader(shp=io.BytesIO(z.read("phl_admin4.shp")), shx=io.BytesIO(z.read("phl_admin4.shx")),
                      dbf=io.BytesIO(z.read("phl_admin4.dbf")), encoding="utf-8")
names = [f[0] for f in rd.fields[1:]]
feats = {k: [] for k in BBOX}
for sr in rd.iterShapeRecords():
    r = dict(zip(names, sr.record))
    lat, lon = float(r["center_lat"]), float(r["center_lon"])
    for site, (x0, y0, x1, y1) in BBOX.items():
        if x0 <= lon <= x1 and y0 <= lat <= y1:
            g = sr.shape.__geo_interface__
            def rnd(c):
                return [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 6), round(c[1], 6)]
            g = {"type": g["type"], "coordinates": rnd(g["coordinates"])}
            feats[site].append({"type": "Feature", "geometry": g, "properties": {
                "pcode": r["adm4_pcode"], "name": r["adm4_name"], "muni": r["adm3_name"],
                "lat": round(lat, 6), "lon": round(lon, 6)}})
for site, fs in feats.items():
    with open(f"{outdir}/barangays_{site}.geojson", "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": fs}, f, ensure_ascii=False)
    print(site, len(fs), "barangays")
