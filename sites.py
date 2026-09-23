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
"""
ROAD_STREET = {"primary":"major","primary_link":"major","secondary":"major","secondary_link":"major",
               "tertiary":"mid","residential":"minor","unclassified":"minor","busway":"minor",
               "service":"alley"}
# Campus profile: footpaths are the streets. Steps are excluded (not walkable in water anyway).
ROAD_PATH = dict(ROAD_STREET, **{"footway":"minor","path":"minor","pedestrian":"minor","cycleway":"minor","living_street":"minor"})

NOAH = {"5":"inputs/noah/MetroManila_Flood_5year","25":"inputs/noah/MetroManila_Flood_25year","100":"inputs/noah/MetroManila_Flood_100year"}
PH_SCEN = {"clear":("Dry day",0,0,0),"monsoon":("Habagat rain",0.16,300,180),"typhoon":("Typhoon",0.50,340,150)}
PH_ATTR = "Map data © OpenStreetMap contributors · Terrain: Copernicus GLO-30 © ESA · Hazard reference: UP Project NOAH"

SITES = {
 "tv": dict(id="tv", name="Teachers Village", place="Teachers Village, Quezon City",
   bbox=(121.0470,14.6300,121.0755,14.6545), W=1200, H=1059, GW=200, GH=177,
   dem="inputs/output_hh.tif", dem_kind="dsm", min_filter=3, sigma=1.6, carve=0.5,
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
   g_ref=56.0,                                                     # v17 constant, kept so Teachers Village behaves exactly as before
   tz="PHT", utc="+08:00",
   scen=PH_SCEN, emergency="911 or your barangay", attribution=PH_ATTR),

 "diliman": dict(id="diliman", name="UP Diliman", place="UP Diliman, Quezon City",
   bbox=(121.0560,14.6440,121.0820,14.6700), W=1200, H=1200, GW=200, GH=200,
   dem="sites/diliman/output_hh.tif", dem_kind="dsm", min_filter=3, sigma=1.6, carve=0.5,
   osm="sites/diliman/export.geojson", noah=NOAH,
   # all eight sit on OSM-named buildings within 90 m of a mapped creek (San Vicente, Tandang Sora, Katipunan/Lagarian, Pansol, Luzon)
   sensors=[("BW-D01","San Vicente Sentrong Sigla",121.05704,14.65352),            # San Vicente Creek, west edge
            ("BW-D02","UP Checkpoint- Carabao Horn R",121.06199,14.65465),        # University Ave checkpoint, creek culvert
            ("BW-D03","NEU Dorm 4 (Megadorm)",121.05702,14.66551),                # Tandang Sora Creek, north-west
            ("BW-D04","UP Integrated School K-2",121.07253,14.65236),             # Katipunan/Lagarian Creek, campus core
            ("BW-D05","Orosa Hall",121.08144,14.65480),                          # Balara, east (62 m from creek, on Betany St)
            ("BW-D06","BPI",121.07400,14.64520),                                  # Katipunan Ave, south-east
            ("BW-D07","Parroquia dela Nuestra Señora dela Paz y Buen Viaje de Balara",121.07463,14.66323),  # Old Balara, north-east
            ("BW-D08","Philippine Red Cross",121.05886,14.65146)],                # south-west
   site_by="name",
   short={"BW-D01":"Sentrong Sigla","BW-D02":"UP Checkpoint","BW-D03":"NEU Megadorm","BW-D04":"UPIS K-2",
          "BW-D07":"Balara Parish","BW-D08":"Red Cross"},
   label_pos={"BW-D05":"left","BW-D01":"right","BW-D03":"right","BW-D08":"right","BW-D06":"left"},
   labels=["University Avenue","Commonwealth Avenue","C.P. Garcia Avenue","Katipunan Avenue","Tandang Sora Avenue",
           "Magsaysay Avenue","Osmeña Avenue","Roxas Avenue"],
   road_class=ROAD_STREET, creek_tags={"river","stream","drain"}, profile="street", langs="all", units="metric",
   tz="PHT", utc="+08:00",
   scen=PH_SCEN, emergency="911 or your barangay", attribution=PH_ATTR),

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
   attribution="Map data © OpenStreetMap contributors · Terrain: USGS 3DEP 1 m via OpenTopography"),
}
