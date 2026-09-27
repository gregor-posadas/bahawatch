"""Tiny stand-ins for the national files, written into a temp folder by the tests."""
import os

OSM = """<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="bahawatch-test">
 <node id="1" lat="14.650" lon="121.060" version="1"/>
 <node id="2" lat="14.650" lon="121.070" version="1"/>
 <node id="3" lat="14.660" lon="121.070" version="1"/>
 <node id="4" lat="14.660" lon="121.060" version="1"/>
 <node id="5" lat="14.655" lon="121.050" version="1"/>
 <node id="6" lat="14.655" lon="121.080" version="1"/>
 <node id="7" lat="14.640" lon="121.065" version="1"/>
 <node id="8" lat="14.670" lon="121.065" version="1"/>
 <node id="9" lat="10.300" lon="123.900" version="1"><tag k="amenity" v="college"/><tag k="name" v="Mandaue City College"/></node>
 <node id="11" lat="10.301" lon="123.901" version="1"/>
 <node id="12" lat="10.302" lon="123.902" version="1"/>
 <node id="100" lat="14.6500" lon="121.028" version="1"/>
 <node id="101" lat="14.6505" lon="121.065" version="1"/>
 <node id="102" lat="14.6510" lon="121.065" version="1"/>
 <node id="103" lat="14.6515" lon="121.065" version="1"/>
 <node id="104" lat="14.6520" lon="121.065" version="1"/>
 <node id="105" lat="14.6525" lon="121.065" version="1"/>
 <node id="106" lat="14.6530" lon="121.065" version="1"/>
 <node id="107" lat="14.6535" lon="121.065" version="1"/>
 <node id="108" lat="14.6540" lon="121.028" version="1"/>
 <node id="109" lat="14.6545" lon="121.065" version="1"/>
 <node id="110" lat="14.6550" lon="121.065" version="1"/>
 <node id="111" lat="14.6555" lon="121.065" version="1"/>
 <node id="112" lat="14.6560" lon="121.065" version="1"/>
 <node id="113" lat="14.6565" lon="121.065" version="1"/>
 <node id="114" lat="14.6570" lon="121.065" version="1"/>
 <node id="115" lat="14.6575" lon="121.065" version="1"/>
 <node id="116" lat="14.6580" lon="121.028" version="1"/>
 <way id="10" version="1"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
  <tag k="amenity" v="university"/><tag k="name" v="University of the Philippines Diliman"/></way>
 <way id="20" version="1"><nd ref="5"/><nd ref="6"/><tag k="highway" v="primary"/><tag k="name" v="C.P. Garcia Avenue"/><tag k="surface" v="asphalt"/></way>
 <way id="21" version="1"><nd ref="7"/><nd ref="8"/><tag k="waterway" v="stream"/><tag k="name" v="Pansol Creek"/></way>
 <way id="22" version="1"><nd ref="7"/><nd ref="8"/><tag k="highway" v="motorway"/></way>
 <way id="23" version="1"><nd ref="11"/><nd ref="12"/><tag k="highway" v="residential"/></way>
 <way id="24" version="1"><nd ref="100"/><nd ref="101"/><nd ref="102"/><nd ref="103"/><nd ref="104"/><nd ref="105"/><nd ref="106"/><nd ref="107"/><nd ref="108"/><nd ref="109"/><nd ref="110"/><nd ref="111"/><nd ref="112"/><nd ref="113"/><nd ref="114"/><nd ref="115"/><nd ref="116"/><tag k="highway" v="service"/></way>
</osm>
"""

def write_osm(path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(OSM)
    return path


# ---------------------------------------------------------------- Task 3: rasters, buildings, NOAH, admin
import io, zipfile
import numpy as np


def write_fabdem_tiles(folder, tiles=((14, 120), (14, 121))):
    """1° tiles at 0.001° (≈110 m) whose height rises 1 m per 0.01° of longitude, so a seam shows as a jump."""
    import rasterio
    from rasterio.transform import from_origin
    os.makedirs(folder, exist_ok=True)
    for la, lo in tiles:
        n = 1000
        lon = lo + (np.arange(n) + 0.5) * 0.001
        z = np.tile(((lon - 120.0) * 100.0).astype("float32"), (n, 1))
        prof = dict(driver="GTiff", width=n, height=n, count=1, dtype="float32", crs="EPSG:4326", nodata=-9999.0,
                    transform=from_origin(lo, la + 1, 0.001, 0.001))
        with rasterio.open(os.path.join(folder, f"N{la:02d}E{lo:03d}_FABDEM_V1-2.tif"), "w", **prof) as d:
            d.write(z, 1)
    return folder


def write_buildings(path, polys):
    """A GeoParquet-shaped file: bf_source, bbox struct, WKB geometry (the columns the VIDA file has)."""
    import pyarrow as pa, pyarrow.parquet as pq, shapely
    t = pa.table({"bf_source": ["google"] * len(polys), "confidence": [0.9] * len(polys),
                  "bbox": pa.array([{"xmin": p.bounds[0], "ymin": p.bounds[1], "xmax": p.bounds[2], "ymax": p.bounds[3]} for p in polys]),
                  "geometry": pa.array([shapely.to_wkb(p) for p in polys], pa.binary())})
    pq.write_table(t, path, row_group_size=2)
    return path


def shp_files(stem, polys, fields, records):
    """{name: bytes} of a polygon shapefile (clockwise rings) built in memory."""
    import shapefile
    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=shapefile.POLYGON)
    for f in fields:
        w.field(*f)
    for (x0, y0, x1, y1), rec in zip(polys, records):
        w.poly([[(x0, y0), (x0, y1), (x1, y1), (x1, y0), (x0, y0)]])
        w.record(*rec)
    w.close()
    return {stem + ".shp": shp.getvalue(), stem + ".shx": shx.getvalue(), stem + ".dbf": dbf.getvalue()}


def _zip_bytes(files):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        for n, data in files.items():
            z.writestr(n, data)
    return b.getvalue()


def write_noah(folder):
    """NOAH-shaped downloads: outer zips holding <rp>yr/<Province>.zip, each holding one shapefile with Var 1..3."""
    os.makedirs(folder, exist_ok=True)
    mm = shp_files("MetroManila_Flood_5year", [(121.04, 14.63, 121.09, 14.68), (121.06, 14.645, 121.07, 14.655), (121.10, 14.70, 121.11, 14.71)],
                   [("Var", "N", 5, 0)], [(1,), (3,), (2,)])
    cebu = shp_files("Cebu_Flood", [(123.88, 10.28, 123.92, 10.33)], [("Var", "N", 5, 0)], [(2,)])
    five = {"5yr/MetroManila.zip": _zip_bytes(mm), "5yr/Cebu.zip": _zip_bytes(cebu)}
    open(os.path.join(folder, "5yr-A-001.zip"), "wb").write(_zip_bytes(five))
    open(os.path.join(folder, "5yr-B-001.zip"), "wb").write(_zip_bytes(five))          # the duplicated download
    open(os.path.join(folder, "25yr-A-001.zip"), "wb").write(_zip_bytes({"25yr/Cebu.zip": _zip_bytes(cebu)}))
    open(os.path.join(folder, "100yr-A-001.zip"), "wb").write(_zip_bytes({"100yr/TawiTawi.zip": _zip_bytes({})}))   # an empty province, as in the real download
    return folder


def write_admin(path):
    """phl_admin_boundaries.shp.zip stand-in: two barangays (admin4) and a country (admin0) with an islet."""
    a4 = shp_files("phl_admin4", [(121.05, 14.64, 121.07, 14.66), (123.0, 10.0, 123.01, 10.01)],
                   [("adm4_name", "C", 60, 0), ("adm4_pcode", "C", 20, 0), ("adm3_name", "C", 60, 0), ("center_lat", "N", 12, 6), ("center_lon", "N", 12, 6)],
                   [("U.P. Campus", "PH137404104", "Quezon City", 14.65, 121.06), ("Far Away", "PH072217000", "Cebu City", 10.005, 123.005)])
    a0 = shp_files("phl_admin0", [(120.0, 13.0, 122.0, 16.0), (125.0, 9.0, 125.001, 9.001)],
                   [("adm0_name", "C", 20, 0)], [("Philippines",), ("Philippines",)])
    open(path, "wb").write(_zip_bytes({**a4, **a0}))
    return path
