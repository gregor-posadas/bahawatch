"""Per-site configuration for build_data.py. One entry per dashboard tab.

Fields
  id, name, place       identity and the place line under the logo
  bbox                  (LON0, LAT0, LON1, LAT1) display frame, WGS84
  W, H, GW, GH          world canvas (px units) and model grid (cells)
  dem, dem_kind         terrain GeoTIFF (any CRS) and whether it is a surface ("dsm") or bare-earth ("dtm") model
  min_filter, sigma, carve   terrain conditioning: 3x3 minimum filter (None to skip), gaussian sigma in cells, street carve depth in m
  osm                   Overpass GeoJSON export
  noah                  dict of NOAH shapefile stems by return period, or None for no hazard layer
  sensors               list of (unit id, building name or street name, target lon, target lat)
  site_by               "address": unit sits on a house with addr:housenumber + addr:street == name
                        "name":    unit sits on a building whose OSM name == name
  labels                named ways to label on the map
  unit_names            optional {unit id: display name} overriding the OSM building name (e.g. the demo unit)
  short                 optional {unit id: short map label} for long building names (the list keeps the full name)
  label_pos             optional {unit id: "left" | "right" | "above" | "below"} map-label placement
  fixed                 optional set of unit ids sited at their (lon, lat) directly, not on a building (the demo unit)
  g_ref                 optional storm-response reference elevation (m ASL); default = median sensor street elevation
  tz, utc               clock label and ISO offset for the simulated feed ("PHT", "+08:00")
  road_class            OSM highway tag → major / mid / minor / alley
  creek_tags            waterway tags drawn as creeks
  profile               "street" (MMDA vehicle passability) or "path" (campus footpaths)
  langs                 "all" (six-language menu) or "en" (English only, menu hidden)
  units                 "metric" or "imperial" (which unit is written first)
  scen                  scenario key → (label, rain intensity P, duration min, start min)
  emergency             who to call, for the footer
  attribution           data credits, for the footer and map
  terrain               terrain source, for the footnote ("FABDEM V1-2 (30 m bare earth)")
  buildings             optional footprints GeoJSON (pipeline cut): drawn as dots, counted per cell, and ≥75 % built cells block water
  sea                   True: cells with no terrain or ≤ 0 m touching the edge are sea (never flooded, never a unit)
  noah                  … or "geojson": per-period noah_<rp>.geojson files in noah_dir (a missing file = no NOAH map)
  sensors / labels      … or "auto" (campuses: units placed by model/placement.py, labels from the longest named roads)
  campus                campuses only: identity shown on the page (id, short, name, campus, group, type, city, province, lat, lon)
Campus sites are not listed in SITES: get_site(id) builds them from pipeline/campuses.csv.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline"))
from common import read_campuses, box_around, CAMPUSES_CSV  # noqa: E402

ROAD_STREET = {"primary":"major","primary_link":"major","secondary":"major","secondary_link":"major",
               "tertiary":"mid","residential":"minor","unclassified":"minor","busway":"minor",
               "service":"alley"}
# Campus profile: footpaths are the streets. Steps are excluded (not walkable in water anyway).
# Campus cuts come straight from the national extract, which also has trunk roads and pedestrian streets.
ROAD_CAMPUS = dict(ROAD_STREET, trunk="major", trunk_link="major", tertiary_link="mid", living_street="minor", pedestrian="minor")
ROAD_PATH = dict(ROAD_STREET, **{"footway":"minor","path":"minor","pedestrian":"minor","cycleway":"minor","living_street":"minor"})

NOAH = {"5":"inputs/noah/MetroManila_Flood_5year","25":"inputs/noah/MetroManila_Flood_25year","100":"inputs/noah/MetroManila_Flood_100year"}
PH_SCEN = {"clear":("Dry day",0,0,0),"monsoon":("Habagat rain",0.16,300,180),"typhoon":("Typhoon",0.50,340,150)}
FAB_ATTR = ("Map data © OpenStreetMap contributors · Buildings: Google Open Buildings, Microsoft, OSM (combined by VIDA) · "
            "Terrain: FABDEM V1-2 © University of Bristol (CC BY-NC-SA 4.0) · Hazard reference: UP Project NOAH")
FAB_TERRAIN = "FABDEM V1-2 (30 m, buildings and trees removed)"

SITES = {
 "tv": dict(id="tv", name="Teachers Village", place="Teachers Village, Quezon City",
   bbox=(121.0470,14.6300,121.0755,14.6545), W=1200, H=1059, GW=400, GH=354, elev_factor=2,   # 7.5 m model cells, terrain on 15 m (2026-09-29)
   dem="inputs/campuses/tv/dem.tif", dem_kind="dtm", min_filter=None, sigma=1.0, carve=0.5, sea=True,
   buildings="inputs/campuses/tv/buildings.geojson",
   osm="inputs/export.geojson", noah=NOAH,
   sensors=[("BW-H01","Maginhawa Street",121.0602,14.6382),("BW-H02","Maginhawa Street",121.0582,14.6438),
            ("BW-H03","Malingap Street",121.0575,14.6425),("BW-H04","Matahimik Street",121.0545,14.6412),
            ("BW-H05","Mahusay Street",121.0565,14.6487),("BW-H06","Matimtiman Street",121.0598,14.6448),
            ("BW-H07","Mayaman Street",121.0515,14.6478),("BW-H08","V. Luna Road",121.0555,14.6365)],
   site_by="address",
   labels=["Maginhawa Street","Malingap Street","Matahimik Street","Mayaman Street","Matalino Street","Kalayaan Avenue",
           "Magiting Street","Mahusay Street","Matimtiman Street","V. Luna Road","Anonas Street","Katipunan Avenue",
           "Masaya Street","Maalalahanin Street"],
   road_class=ROAD_STREET, creek_tags={"river","stream"}, profile="street", langs="all", units="metric",
   tz="PHT", utc="+08:00",
   scen=PH_SCEN, emergency="911 or your barangay", attribution=FAB_ATTR, terrain=FAB_TERRAIN),

 # Brgy. San Joaquin, Mabalacat City, Pampanga (2026-09-29): a pilot beside Teachers Village, cut like a campus
 # (pipeline/common.py PILOT_BOXES["sjq"]); 8 units placed automatically, all inside the barangay (its outline; units_inside)
 "sjq": dict(id="sjq", name="San Joaquin", place="Brgy. San Joaquin, Mabalacat City, Pampanga",
   bbox=(120.545552, 15.207867, 120.573482, 15.234982), W=1200, H=1200, GW=400, GH=400, elev_factor=2,
   dem="inputs/campuses/sjq/dem.tif", dem_kind="dtm", min_filter=None, sigma=1.0, carve=0.5, sea=True,
   osm="inputs/campuses/sjq/osm.geojson", buildings="inputs/campuses/sjq/buildings.geojson", noah="geojson",
   noah_dir="inputs/campuses/sjq", barangays="inputs/campuses/sjq/barangays.geojson",
   outline="inputs/campuses/sjq/outline.geojson", sensors="auto", site_by="auto", labels="auto", units_inside=True,
   road_class=ROAD_CAMPUS, creek_tags={"river", "stream", "drain", "canal", "ditch"}, profile="street",
   langs="all", units="metric", tz="PHT", utc="+08:00", scen=PH_SCEN, emergency="911 or your barangay",
   attribution=FAB_ATTR, terrain=FAB_TERRAIN),
 "berkeley": dict(id="berkeley", name="UC Berkeley", place="UC Berkeley, California",
   bbox=(-122.2700,37.8660,-122.2480,37.8790), W=1200, H=880, GW=240, GH=180,
   dem="sites/berkeley/output_USGS1m.tif", dem_kind="dtm", min_filter=None, sigma=0.8, carve=0.25,
   osm="sites/berkeley/export.geojson", noah=None,
   sensors=[("BW-B00","Strawberry Creek demo unit",-122.26489,37.87071),   # the real sensor; placeholder at the Grinnell Pathway footbridge over Strawberry Creek until real coordinates arrive
            ("BW-B01","Oxford Hall",-122.26621,37.86985),
            ("BW-B02","Creekside Center",-122.26127,37.87035),
            ("BW-B03","César E. Chavez Student Center",-122.26012,37.86976),
            ("BW-B04","Anthony Hall",-122.25820,37.87068),
            ("BW-B05","Faculty Club",-122.25586,37.87181),
            ("BW-B06","Women's Faculty Club",-122.25491,37.87205),
            ("BW-B07","Chou Hall (North Academic Building)",-122.25437,37.87239),
            ("BW-B08","Stebbins Hall",-122.25932,37.87634)],
   site_by="name",
   fixed={"BW-B00"},                                              # sited at its coordinate, not on a building
   short={"BW-B00":"Demo unit","BW-B03":"Chavez Center","BW-B07":"Chou Hall","BW-B06":"Women's Faculty Club"},
   label_pos={"BW-B00":"above","BW-B01":"left","BW-B02":"above","BW-B03":"below","BW-B04":"below",
              "BW-B05":"left","BW-B06":"below","BW-B07":"right","BW-B08":"right"},
   labels=["Oxford Street","Bancroft Way","Hearst Avenue","Piedmont Avenue","Gayley Road","University Drive",
           "Strawberry Creek","Strawberry Creek North Fork"],
   road_class=ROAD_PATH, creek_tags={"river","stream"}, profile="path", langs="en", units="imperial",
   tz="PT", utc="-07:00",
   scen={"clear":("Dry day",0,0,0),"monsoon":("Winter storm",0.14,300,180),"typhoon":("Atmospheric river",0.40,340,150)},
   emergency="911 or UCPD (510-642-3333)",
   attribution="Map data © OpenStreetMap contributors · Terrain: USGS 3DEP 1 m via OpenTopography",
   terrain="USGS 3DEP 1 m lidar (bare earth)"),
}


def campus_site(r, root=None):
    """Site config for one PhilDev campus row of pipeline/campuses.csv (spec §3.2, §6)."""
    root = root or os.environ.get("CAMPUS_INPUTS", "inputs/campuses")
    d = f"{root}/{r['id']}"
    ident = {k: r[k] for k in ("id", "short", "name", "campus", "group", "type", "city", "province")}
    ident.update(lat=r["lat"], lon=r["lon"])
    return dict(id=r["id"], name=r["short"], place=f"{r['name']} · {r['city']}, {r['province']}", campus=ident,
                bbox=box_around(r["lat"], r["lon"]), W=1200, H=1200, GW=400, GH=400, elev_factor=2,   # 7.5 m model cells, terrain on 15 m (2026-09-29)
                dem=f"{d}/dem.tif", dem_kind="dtm", min_filter=None, sigma=1.0, carve=0.5, sea=True,
                osm=f"{d}/osm.geojson", buildings=f"{d}/buildings.geojson", noah="geojson", noah_dir=d,
                barangays=f"{d}/barangays.geojson", outline=f"{d}/outline.geojson",
                sensors="auto", site_by="auto", labels="auto",
                road_class=ROAD_CAMPUS, creek_tags={"river", "stream", "drain", "canal", "ditch"}, profile="street",
                langs="all", units="metric", tz="PHT", utc="+08:00", scen=PH_SCEN, emergency="911 or your barangay",
                attribution=FAB_ATTR, terrain=FAB_TERRAIN)


def get_site(site_id):
    if site_id in SITES:
        return SITES[site_id]
    rows = {r["id"]: r for r in read_campuses(os.environ.get("CAMPUSES_CSV", CAMPUSES_CSV))}
    if site_id not in rows:
        raise KeyError(f"unknown site {site_id!r}")
    if rows[site_id]["lat"] is None:
        raise ValueError(f"{site_id}: no centre in campuses.csv yet (pipeline Task 5)")
    return campus_site(rows[site_id])
