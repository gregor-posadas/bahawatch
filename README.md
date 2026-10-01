# BahaWatch — Flood Monitor (25 PhilDev partner campuses · Teachers Village · San Joaquin · UC Berkeley)

A web dashboard demonstrating how a network of low-cost household
water-level sensors can produce **live, sensor-driven flood extent maps** for
real places. It opens on a **national map of the 25 PhilDev partner
campuses**; each campus has its own page (a 3 km box around the campus, eight
proposed sensor spots, a partnership card). Three pilot sites keep their own
tabs: **Teachers Village**, Quezon City (the original neighbourhood build),
**San Joaquin**, Mabalacat City, Pampanga (added 2026-09-29, cut like a campus,
all eight units inside the barangay; unit 01 fixed at 71 Imelda Marcos St by
`pin_units` in `sites.py`, the rest placed around it) and **UC Berkeley** around Strawberry Creek
(where the real demo unit lives). A plain link now opens the **homepage** (`#home`,
`#home/how`, `#home/contact`; 2026-09-30, reworked the same day after Gregor's 18 notes): what BahaWatch is and why
(each figure links its source from the cited words), an animated five-stop line from sensor to answer that repeats while on
screen (no pause button, by Gregor's choice; still under reduced motion), a side-view-to-map figure showing how one reading
becomes a flood map (FABDEM ground, the edges where ground rises above the water level, a walled-off dip that stays dry),
raised explore cards that sink when pressed, the team with LinkedIn links, the collaborators' logos (Bike Scouts,
University of the Philippines, UP Resilience Institute, Project NOAH, Blum Center, Development Engineering at UC Berkeley, UC Berkeley Disaster Lab, each linking to its site; PhilDev), a call to partner,
the timeline and contact (Noam's address as text with a Copy button, no mailto link). Sections fade in on scroll
(off under reduced motion). Images are in `shared/home/`. A Listen button beside "Baha" plays a Tagalog speaker's recording (samurai19817 on Forvo, non-commercial licence, credited in the footer). A **Flood history** tab (`#history`, `#history/<section>`; built by `tools/build_history.py`) tells the human side of Philippine floods in openly licensed photos (1991–2026), living with tidal flooding and subsidence, and a sourced, even-handed timeline of the 2025–2026 flood-control scandal; every photo is credited under it and every figure links its source. Links that leave the site open in a new tab (and say so to screen readers), so BahaWatch stays open. A **Lives lost** chart draws one small figure per 10 dead (ink) or missing (orange, on their own line) for each flood on the page, gives the injured and the families affected (with a bar to scale), every number linked to its source; on wide screens it sits to the right of the stories. The national map moved to `#ph`; it opens with a note that the PhilDev collaboration is still being discussed. Every page has the same header: the logo, "BahaWatch" in 20 px bold, the page or place in small grey, and a thick black rule. An **Accessibility** tab
(`#access`, `#access/<section>`) lists the design-for-accessibility choices and what still falls short. While a site
file or a map loads, a thin progress bar runs along the top, the page shows a skeleton, and the map shows "Loading map…". Action buttons across the dashboard
are **raised** on a hard ink shadow and sink into it when pressed (the chosen weather or sensor reading stays sunk; tabs,
list rows, pins and the Details view's pill groups keep their own look; under reduced motion only the shadow thins).
Filipino words on the English pages carry their meaning (*Babaha ba?* “Will it flood?”, *Oo* yes, *Baka* maybe,
*Hindi* no, barangay (neighbourhood), habagat (monsoon)), and the homepage's harder terms open notes like About's. An **About** tab (`#about`, `#about/<section>`)
explains the dashboard in plain language for talks such as GHTC: how it works,
the data, the sensor units and their assumed mounting, accuracy and biases,
future work and an FAQ; underlined terms open a short note. The
old UP Diliman tab is now the `upd` campus page, and old `#diliman` links go
there. §2.5 explains how the campus data are made; §6.5 how the pages work.

The dashboard is a proof of concept. Its map, terrain, and hazard reference
layers are real. Its sensor feed is simulated (see §5) so the whole thing runs
offline in a browser with no backend — the point of the demo is the *model and
the interface*, and the simulated feed is designed to be swapped for a real
device API without touching the model.

Live artifact: <https://claude.ai/artifact/Mjsm9genvWF9sFdXxuKis9>

On GitHub Pages the repository root serves the dashboard: `index.html`
redirects to `bahawatch_dashboard.html` and keeps the hash (`#upd`,
`#xu/details`, `#berkeley`). No hash opens the homepage; `#ph` the national map. The page embeds
only the campus list and the country outline (≈ 265 KB, ≈ 85 KB gzipped); a
site's data file (`data/<id>.json`, ≤ 250 KB gzipped) is fetched when that
site is opened. Code is MIT-licensed; the data files carry their
source licences (`DATA-LICENSE.md`).

The file has **two views**:

- **Public view (default)** — for residents: one status line, a street board
  in MMDA/PAGASA advisory language, a "My street" pin, and a diagram-style
  map. Six languages on the Philippine sites. Nothing else.
- **Details view** (the "Details" link, or open the file with `#details`) —
  the operator dashboard: storm scenarios, 36-h timeline, NOAH overlay,
  per-unit telemetry, simulated API feed, event log, impact statistics.
  This is the conference/engineering view.

---

## 1. What's in this package

| File | What it is |
|---|---|
| `bahawatch_dashboard.html` | **The deliverable.** The page (≈ 265 KB): UI, model, the campus list and the country outline. It fetches `data/<id>.json` when a site is opened, so it needs the `data/` folder next to it (GitHub Pages, or `node tools/test_server.js`). Open with `#upd`, `#xu`, `#tv` or `#berkeley` (add `/details` for the operator view) to land on a site. |
| `template.html` | The dashboard source with placeholders (`__CAMPUSES__`, `__PH_OUTLINE__`, the shared rule and flood fill, the API base). Edit this to change the UI or model. |
| `sites.py` | **Per-site configuration.** The two pilots (`tv`, `berkeley`) are written out in `SITES`; each campus is built from its row of `pipeline/campuses.csv` by `campus_site()`. Input paths, map frame, grid, terrain conditioning, sensor list and siting rule, labels, road classes, wording profile, units, languages, scenarios, emergency line, attribution, terrain footnote. Field list in the module docstring. |
| `data/<id>.json` (27), `data/ph_outline.json` | The preprocessed site files (terrain grid, streets, creeks, building dots and per-cell counts, sea and blocked cells, NOAH hazard grids, sensor sites, places, the partnership card, and a `site` block). Generated by `build_data.py` and `tools/build_places.py`. `data/ph_outline.json` is the simplified country outline for the national map. |
| `build_data.py` | Preprocessing: inputs → `data/<id>.json`. `SITE=upd python3 build_data.py`. Re-run only when inputs, the map frame, or sensor sites change. |
| `pipeline/` | The campus pipeline that runs on the PC with the national files: `run_pc.py find` (campus outlines) and `run_pc.py cut` (per-campus terrain, buildings, streets, NOAH, barangays, country outline). `campuses.csv` is the campus list. §2.5. |
| `model/` | Grid helpers (built fraction, sea, blocked cells, counts), automatic unit placement, the partnership card. §4.6. |
| `tools/` | `build_places.py` (places for every site, and `places.json` for the Worker), `check_site_data.py` (the per-campus checks), `make_qr.py` (QR codes), `test_server.js` (a gzip test server), `md_to_pdf.py`. |
| `shared/flood.js`, `shared/verdict.js` | The flood fill and the Babaha ba? rule, shared by the page and (for the rule) the Worker; each has a `node --test` suite. |
| `sw.js` | Service worker: caches the page and the site files; a data-file request is never answered with the page. |
| `test_build.sh` | Build regression: runs the pipeline and model unit tests, builds a fixture campus twice (byte-identical) and through the checker, shows the checker catches a broken file, rebuilds Teachers Village and UP Diliman and compares them with `data/`, checks the two pilots, then checks all 27 site files. |
| `test_init.js`, `test_tabs.js`, `test_sites.js`, `test_figure.js`, `test_public.js`, `test_car.js` | Playwright browser tests: site state rebuild and switching, tab bar and `#site/view` routing, per-site wording/units/language rules, sensor siting per site, depth figure, public view, car scale. `node test_<name>.js` after `build_html.py`. |
| `test_answer.js`, `test_report.js`, `test_recent.js`, `test_noaccount.js` | Playwright browser tests for §6.6: the Babaha ba? answer band (touch targets, contrast, live-region announcements), one-tap reports (Undo, offline hold, the demo page's no-network path, 429 shown as success), the details-view `/recent` report map and log (including a stale reply after switching sites), and the no-account features (share-link confirmation surviving playback re-renders). `node test_<name>.js` after `build_html.py`. |
| `test_try.js` | Playwright browser tests for §6.7, the Try reporting tab: rule steps, Undo, the neighbour cap, reset, no network, restoring the demo on leave, the `#try` link, six languages, contrast, phone layout. `node test_try.js` after `build_html.py`. |
| `test_routes.js`, `test_obstacles.js`, `test_national.js`, `test_campus.js`, `test_a11y.js` | Playwright browser tests for the campus pages: routing (national map, loading and failure screens, the latest choice wins, old `#diliman` links and saved hashes), water kept out of blocked and sea cells and the terrain footnote, the national map (clusters, grouped list, accent-free search, pilots), the campus bar and partnership card, and the accessibility pass (keyboard, announcements, contrast, colour-blind pins, 390 px, six languages, file-size budget). |
| `test_zoomout.js` | Playwright browser tests for zooming a site map out to the whole country and back (§2.6, §6.5): wheel/`−`/pinch out, "Whole country", "Back to the flood map", Escape, the box-fills-the-view return, and leaving the site while zoomed out. `node test_zoomout.js` after `build_html.py`. |
| `shared/basemap.js`, `shared/basemap.test.js` | The vector basemap loader (§2.6): clustering, box maths, coverage and view-fitting helpers, and the MapLibre load/open sequence with its 8 s fallback. `node --test shared/basemap.test.js`. |
| `tools/basemap_style.py`, `tools/test_basemap_style.py` | Generates and checks `shared/basemap-style.json`/`-dark.json` (§2.6). `python3 -m unittest tools.test_basemap_style`. |
| `.ux-profile.md` | UI/UX profile: aesthetic reference, banned anti-aesthetics, accessibility target, voice and icon library. Read before any UI or microcopy change; §6 and §7 follow it. |
| `build_html.py` | Fills the placeholders in `template.html` (campus list, country outline, shared rule and flood fill) → `bahawatch_dashboard.html`. Site data stay in `data/` and are fetched. Run after any edit to the template, the csv or `shared/`. |
| `logo.png` | BahaWatch logo (embedded in the HTML as a data URI). |
| `README.md` | This file. |

Rebuild from scratch (the campus cuts come from the PC pipeline, §2.5):

```bash
pip install numpy scipy rasterio pyshp pyproj shapely  # preprocessing only; the page needs nothing
for s in tv berkeley $(python3 -c "import sys; sys.path.insert(0, 'pipeline'); import common; print(' '.join(r['id'] for r in common.read_campuses()))"); do
  SITE=$s python3 -W ignore build_data.py            # → data/<id>.json
done
python3 -W ignore tools/build_places.py              # places into every data file, and places.json
python3 -W ignore tools/check_site_data.py           # one "ok" line per site
python3 build_html.py                                # → bahawatch_dashboard.html
```

How to run the tests:

```bash
./test_build.sh                                              # build regression and site checks
node --test --no-warnings shared/*.test.js sw.test.js        # flood fill, rule, service worker, basemap helpers (§2.6)
(cd worker && node --test --no-warnings test/*.test.js)      # the Worker (parked, §6.6)
python3 tools/test_places.py                                 # places
python3 -m unittest tools.test_basemap_style                 # basemap styles (§2.6)
./test_pages.sh                                              # every browser suite (test_*.js) on a local gzip server, incl. test_zoomout.js
(cd pipeline && python3 -W ignore -m unittest discover -s tests -t .)   # the PC pipeline
python3 -W ignore -m unittest discover -s model/tests -t .              # grids, placement, card
```

The raw input datasets are **not** included (several GB, and they are freely
re-downloadable), and neither are the per-campus cuts (`inputs/campuses/`,
git-ignored, ≈ 440 MB). §2 explains how to get each one.

---

## 2. Datasets the pipeline needs

All open data. Paths live in `sites.py`.

| Site | Streets and creeks | Terrain | Buildings | Hazard |
|---|---|---|---|---|
| The 25 campuses | Geofabrik extract, cut per campus (§2.5) | FABDEM V1-2 (§2.4) | VIDA combined footprints (§2.4) | Project NOAH, the campus's province (§2.4) |
| Teachers Village (`tv`) | Overpass export `inputs/export.geojson` (§2.1) | FABDEM V1-2, cut like a campus (`inputs/campuses/tv/`) | VIDA combined footprints | Project NOAH Metro Manila (§2.3) |
| UC Berkeley (`berkeley`) | Overpass export, bbox `37.8660,-122.2700,37.8790,-122.2480` | **USGS 3DEP 1 m** via OpenTopography (`OTNED.012021.4269.3`), EPSG:26910, nodata −999999 → `sites/berkeley/output_USGS1m.tif` | OSM (drawn only; no blocking) | none — no public campus-scale flood hazard layer exists; the hazard UI is hidden on this tab |

The Overpass query is the same for every site (§2.1); only `{{bbox}}` changes.
The Berkeley DEM is a bare-earth model at 1 m, so it gets no minimum filter
and only a light smoothing (σ 0.8 cells) and a 0.25 m path carve — see the
per-site conditioning fields in `sites.py`. OpenTopography takes the bbox in
degrees as *Xmin, Ymin, Xmax, Ymax* (west, south, east, north); western
longitudes are negative.

### 2.1 OpenStreetMap — streets, buildings, creeks

**File:** `inputs/export.geojson` (Overpass API export, ~19 MB)

Query used (Overpass Turbo, <https://overpass-turbo.eu>), bounding box
`14.618, 121.045, 14.655, 121.085`:

```
[out:json][timeout:60];
(
  way["highway"]({{bbox}});
  way["building"]({{bbox}});
  way["waterway"]({{bbox}});
);
out geom;
```

Export → GeoJSON. Provides 26,305 features: 23,622 building footprints,
~2,600 road ways (primary → service), and the waterways — Lagarian Creek,
Duyan-duyan Creek, Katipunan Creek, Evangelista Creek.

License: ODbL, © OpenStreetMap contributors.

### 2.2 Copernicus GLO-30 — terrain (no longer used)

No page uses GLO-30 any more: Teachers Village moved to FABDEM with the
campuses (§2.4). The two GeoTIFFs below stay in the repository as the record
of the first builds.

**File:** `inputs/output_hh.tif` (GeoTIFF, EPSG:4326, 1 arc-second ≈ 30 m, ~85 KB)

Downloaded from OpenTopography (<https://portal.opentopography.org/raster?opentopoID=OTSDEM.032021.4326.3>),
bounding box 121.045–121.085 E, 14.618–14.655 N. Guest access works; an email
address is required for job notification. The job took 11 seconds.

Elevations in the frame run 35–80 m ASL: the Diliman plateau falling toward
the creek valleys. Note GLO-30 is a **surface** model (it includes buildings
and canopy); §4.1 describes how the pipeline conditions it.

Citation: European Space Agency (2024). *Copernicus Global Digital Elevation
Model.* Distributed by OpenTopography. <https://doi.org/10.5069/G9028PQB>

### 2.3 Project NOAH — flood hazard reference

**Files:** `inputs/noah/MetroManila_Flood_{5,25,100}year.{shp,shx,dbf,prj}`
(≈33–38 MB each, EPSG:4326)

UP Resilience Institute's Metro Manila flood hazard maps for the 5-, 25- and
100-year return periods. Each shapefile has exactly three records — one
multipolygon per hazard level (`Var` = 1 low, 2 medium, 3 high). Sources:

- NOAH portal: <https://noah.up.edu.ph/know-your-hazards>
- BetterGov mirror: <https://data.bettergov.ph/datasets/22>
- Hugging Face mirror (also has PMTiles): `bettergovph/project-noah-hazard-maps`

License: ODbL.

`project_noah_hazards.csv` (barangay-level percent-area statistics by
`adm4_pcode`) is part of the same BetterGov dataset. It is not used by the
dashboard yet; it would suit a "barangay context" panel.

### 2.4 The national files (campuses and Teachers Village)

One folder on the PC ("Nationwide Update") holds the national downloads.
`pipeline/run_pc.py` reads them in place and never changes them:

| File | What it is | Licence |
|---|---|---|
| `philippines-<yymmdd>.osm.pbf` (≈ 600 MB) | Geofabrik OpenStreetMap extract of the Philippines | ODbL |
| `PHL_buildings.parquet` (≈ 5 GB) | VIDA's combined building footprints (Google Open Buildings + Microsoft + OSM) | CC BY 4.0 (Google) / ODbL (Microsoft, OSM) |
| `bahawatch-data/fabdem/*_FABDEM_V1-2.tif` | FABDEM V1-2 1° tiles (University of Bristol): Copernicus GLO-30 with buildings and trees removed, 30 m | CC BY-NC-SA 4.0 (non-commercial) |
| `5yr-*.zip`, `25yr-*.zip`, `100yr-*.zip` | UP Project NOAH flood hazard shapefiles, one per province and return period | ODbL |
| `phl_admin_boundaries.shp.zip` | PSA/NAMRIA administrative boundaries (OCHA HDX `cod-ab-phl`): barangays and the country outline | CC BY-IGO |

### 2.5 PhilDev campuses: the pipeline

The campus data are made in two places: `run_pc.py` on the PC, next to the
national files, and `build_data.py` in the repository. Each device call on the
PC is limited to 180 s and background jobs are stopped when a call ends, so
every step runs **in the foreground**, in groups of boxes when needed.

On the PC (copy `pipeline/` into `…\Nationwide Update\bahawatch-data\campuses\_pipeline` first;
Python 3.10+, `pip install -r requirements.txt`):

```bash
cd "<Nationwide Update>/bahawatch-data/campuses/_pipeline"
# 1. find: every OSM feature whose name matches a campus's osm_pattern near its hint → _candidates/<id>.geojson + summary.csv
python3 -W ignore run_pc.py find --data "<Nationwide Update>" --out "<Nationwide Update>/bahawatch-data/campuses"
# 2. choose one outline per campus; write osm_ref, lat, lon into pipeline/campuses.csv (manual = a point, no outline)
# 3. NOAH index: province extents from the shapefile headers, saved once as _noah_index.json (≈ 150 s)
python3 -W ignore run_pc.py cut --data "<Nationwide Update>" --out "<Nationwide Update>/bahawatch-data/campuses" --index-only
# 4. cut: outline, terrain, buildings, streets and creeks, NOAH, barangays, country outline; finished files are kept,
#    so re-running continues where it stopped. Use --only in groups of 3–5 boxes to stay under 180 s per call.
python3 -W ignore run_pc.py cut --data "<Nationwide Update>" --out "<Nationwide Update>/bahawatch-data/campuses" --only upd,dlsu,ust
```

`run_pc.py` writes only new files, only inside `--out`, and logs every step
to `pipeline_log.txt`. Each box is 3 km across, centred on the campus, with a
300 m margin; it holds `dem.tif`, `buildings.geojson`, `osm.geojson`,
`noah_<5|25|100>.geojson`, `barangays.geojson` and `outline.geojson`. The
cuts are zipped on the PC, brought into the repository as `inputs/campuses/`
(git-ignored), and built in the container:

```bash
python3 - <<'PY'   # country outline for the national map (≈ 34 KB)
import json; from shapely.geometry import shape, mapping
g = shape(json.load(open("inputs/campuses/ph_outline.geojson"))).simplify(0.02, preserve_topology=True)
json.dump(mapping(g), open("data/ph_outline.json", "w"), separators=(",", ":"))
PY
for s in tv berkeley <the 25 campus ids>; do SITE=$s python3 -W ignore build_data.py; done
python3 -W ignore tools/build_places.py && python3 -W ignore tools/check_site_data.py
```

**Adding a campus:** add a row to `pipeline/campuses.csv` (id, names, group,
type, city, province, `osm_pattern`, hint), run `find`, choose its outline,
run `cut --only <id>`, bring the box in, then `SITE=<id> python3 build_data.py`,
`python3 tools/build_places.py`, `python3 tools/check_site_data.py <id>` and
`python3 build_html.py`. The page picks the campus up from the csv.

**Size budget.** Each site file must stay ≤ 250 KB gzipped (and ≤ 750,000
bytes raw). `build_data.py` thins the building dots until the file is
≤ 225 KB gzipped before places are added (`BW_GZ_BUDGET`); the model and the
counts keep every footprint.

### 2.6 The vector basemap

The PhilDev tab's map and every site's zoomed-out country view (§6.5) run on
**MapLibre GL JS 6.11.2**, vendored byte-for-byte in
`lib/maplibre-gl-6.11.2/` (`maplibre-gl.mjs` and the two ES modules it
imports, `maplibre-gl.css`, `LICENSE.txt`, [BSD-3-Clause](lib/maplibre-gl-6.11.2/LICENSE.txt))
rather than loaded from a CDN with an integrity hash — MapLibre 6 ships as
three ES modules, and a hash on the entry file wouldn't cover the two it
imports (plan ruling 1). It opens **our own vector tiles**, served from this repo like the page (no outside tile
server, so the detailed map also works in the private demo):

- `shared/tiles/ph-base.pmtiles` (≈ 14 MB): the whole Philippines to zoom 11 — land, main roads (motorway to
  tertiary), rivers, city and town names (OpenStreetMap), and a built-up tint from the VIDA combined building
  footprints (counts per 0.005° cell);
- `shared/tiles/site-<id>.pmtiles` (0.3–2.7 MB each): every site's box to zoom 15 — all streets and waterways (the
  site's OSM cut) and every building footprint (the site's VIDA cut);
- `shared/fonts/`: Noto Sans glyphs (SIL OFL, from protomaps/basemaps-assets);
- `lib/pmtiles-4.5.0/pmtiles.mjs` reads the archives (with HTTP range requests, or the whole file where a server
  ignores ranges).

They are built by `python3 tools/build_basemap.py --national <file> --density <file>` with tippecanoe from two
files made on Gregor's PC: `_national_osm.geojsonl` (a pyosmium pass over the Philippines `.osm.pbf`: main roads,
rivers, places) and `_built_density.csv` (DuckDB over `PHL_buildings.parquet`), plus the site cuts in
`inputs/campuses/`. Outside the site boxes there are no building footprints (the whole country's would be several
GB); the built-up tint shows where towns are. UC Berkeley's zoomed-out view, outside the Philippines, uses the
OpenFreeMap style `shared/basemap-style-world*.json`.

**Styles.** `shared/basemap-style.json` and `shared/basemap-style-dark.json`
are generated by `python3 tools/basemap_style.py`, one style definition over
two palettes (light/dark), and checked by
`python3 -m unittest tools.test_basemap_style` (contrast, the sea colour's
separation from the flood, hazard and creek colours, committed files
current).

**Fallback.** The outline map always shows first. With no WebGL, if the
library or the style fails to load, or if no tile has arrived within 8
seconds, the outline stays and a note reads "The detailed map can't be shown on this device." The vector map is not retried later in the same visit.

**Test plumbing.** `BW_TEST_BASEMAP=offline` starts the test server on an
offline style (`tests/fixtures/basemap-offline.json`: the country outline
and two roads, no network at all), so the browser suites can exercise the
vector map path without reaching the internet. The page itself never reads
its URL's query. For manual checking against the live OpenFreeMap tiles,
either run the server without `BW_TEST_BASEMAP`, or set
`window.BW_BASEMAP_STYLE='shared/basemap-style.json?real'` before the map
opens (the server serves the real style for a request with `?real`).

**Privacy note.** The Philippine maps load only files from this site. Only UC Berkeley's zoomed-out view requests
tiles and fonts from `tiles.openfreemap.org`, which then sees the visitor's IP address and the map area viewed.

---

## 3. How the map is built (`build_data.py`)

The pipeline projects everything into one **display frame** and one
**model grid** per site (values from `sites.py`):

| Site | Frame (WGS84) | World canvas | Model grid |
|---|---|---|---|
| Teachers Village | lon 121.0470–121.0755, lat 14.6300–14.6545 (≈3.1 km × 2.7 km) | 1200 × 1059 | 200 × 177 cells, ≈15 m (35,400) |
| Each campus | 3 km × 3 km square centred on the campus | 1200 × 1200 | 200 × 200 cells, 15 m (40,000) |
| UC Berkeley | lon −122.2700 to −122.2480, lat 37.8660–37.8790 (≈1.9 km × 1.4 km) | 1200 × 880 | 240 × 180 cells, ≈8 m (43,200) |

The DEM is read in its own CRS (pyproj handles the UTM → WGS84 sampling for
Berkeley); nodata cells are filled from the nearest valid cell and the build
asserts no sensor sits on a filled hole.

Steps, in order:

1. **Terrain** — the DEM is bilinearly resampled onto the model grid, then
   conditioned (§4.1).
2. **OSM** — highway ways are clipped to the frame, projected to canvas
   units, Douglas-Peucker simplified (ε = 2.5 px) and classed:
   `major` (primary/secondary), `mid` (tertiary), `minor` (residential/
   unclassified/busway), `alley` (service). Footways and paths are dropped.
   Waterways of type river/stream are kept. Building polygons become
   centroids (17,993 inside the frame).
3. **Street mask + carve** — every road is rasterized onto the grid (major
   roads 3 cells wide) to produce a street mask, and street cells are lowered
   below their surroundings (§4.1).
4. **NOAH** — each hazard multipolygon is rasterized to the grid with an
   even-odd scanline fill (holes are handled correctly), producing three
   `uint8` grids with values 0–3.
5. **Sensors** — each of the eight sites is placed on a real OSM building
   that carries a house number **and** `addr:street` equal to the intended
   street, choosing the addressed house nearest the target coordinate. The
   build asserts the house is within 30 m of that street's OSM ways, derives
   the "near X" cross street from geometry (nearest other named street within
   150 m), and snaps the unit to a grid cell on *its own* street for the
   ground datum (§4.3). Units are labeled by address ("195 Maginhawa St").
   An earlier version snapped to the nearest building of any kind and six of
   eight ended up on the wrong street; `test_sites.js` guards against that.
6. **Labels** — anchor point and bearing for the main named streets and the
   creeks, taken from the longest OSM way of each name.

Everything is packed compactly: elevation as int16 decimeters (base64),
building centroids as uint16 pairs (base64), NOAH grids and street mask as
run-length-encoded base64, streets/creeks as rounded coordinate lists.

---

## 4. The flood model

### 4.1 Terrain conditioning

GLO-30 is a digital *surface* model at 30 m; in a dense residential area its
cells are lifted by rooftops and trees and carry ±1 m noise at the scale of a
street. Used raw, no local fill can travel more than a couple of cells. The
pipeline therefore:

- applies a **3×3 minimum filter** (strips building/canopy bumps),
- **Gaussian-smooths** with σ = 1.6 cells (removes DSM noise at street scale),
- **carves streets** 0.5 m below the minimum of their 3×3 neighbourhood, so
  graded streets become the continuous flow channels they physically are.

Result: 35.5–79.7 m ASL, streets connected, lots ~0.5 m above the street —
so shallow water stays on the street and deeper water enters lots, which is
what happens in Teachers Village.

### 4.2 The model contract

> **Flood extents derive only from sensor observations.**
> No reading → blank map. This is checked in the test harness:
> all sensors at zero produces zero wet cells.

Each reporting unit contributes one observation: *depth d at a known ground
elevation g*, i.e. a local water-surface elevation `WSE = g + d`.

### 4.3 Sensor-seeded terrain fill

For every unit with `d > 2 cm`, the model runs a breadth-first fill from the
unit's street cell over the conditioned terrain:

```
cap   = d + 0.45 m                         # extrapolation band
for each cell reached at BFS distance k:
    avail = WSE − 0.010 · k                # 1 cm decay per cell (~15 m)
    depth = avail − elev[cell]
    claim the cell only if 0.02 < depth ≤ cap
    otherwise stop: don't claim, don't traverse
stop after 80 steps (~1.2 km)
```

Why each rule exists:

- **`depth > 0.02`** — water can't climb; ridges and higher ground stop the fill.
- **`depth ≤ cap`** — a 20 cm reading on a plateau must not assert a
  10 m-deep flooded valley below it. The model extrapolates the observed water
  surface only into terrain within the observed depth range (+0.45 m margin).
  Without this rule, the raw "bathtub" fill flooded 43 % of the map from
  11 cm readings.
- **distance decay** — confidence in an extrapolated surface falls with
  distance from the observation; extents are deliberately conservative.
- **street datum** — the gate-post sensor measures depth *on the street*, so
  the fill is seeded on the nearest street cell with that cell's elevation.
  Seeding on the lot cell (0.5 m higher) isolated the sensor from the carved
  street and killed the fill at 1–3 cells.

Where two units' footprints overlap, the deeper estimate wins and the cell
records which unit it came from — the tooltip shows "via BW-H07", and tapping
a unit isolates its footprint.

### 4.4 What NOAH is (and isn't) used for

This is the point most worth stating precisely at a demo:

- **NOAH is not used to compute flood extents.** Extents come from sensor
  readings and topography only (§4.2–4.3).
- NOAH is shown as a **reference overlay** (Off / 5-yr / 25-yr / 100-yr) so the
  audience can compare sensor-derived extents against the official hazard map.
- NOAH is also used, together with elevation, to **calibrate the simulated
  sensor readings** in the demo (§5.2). With real sensors this second use
  disappears entirely.

The comparison is itself a talking point: in this frame NOAH — a riverine
model — flags the Lagarian/Duyan-duyan corridors and Mayaman Street (level 2)
but is blank across the Maginhawa interior, whose well-known flooding is
street-level drainage ponding. That is exactly the gap a household sensor
network fills.

### 4.5 Calibration results

*These results are from the multi-site build on Copernicus GLO-30, before the
move to FABDEM and the campus pages; they are kept as the record of how the
storm formula was tuned. The campuses use the same formula unchanged.*

Peak modeled extents in the two storm scenarios of each site (calibration
probe, Task 7 of the multi-site plan; depths at the storm peak, units in
`sites.py` order). The storm-response reference elevation is 56 m on
Teachers Village (unchanged from the single-site build) and each campus's
median sensor street elevation, so the same formula works at 46 m ASL in
Quezon City and at 60–112 m on the Berkeley hillside.

| Site | Scenario | Peak sensor depths (cm) | Wet area |
|---|---|---|---|
| Teachers Village | Habagat rain | 32, 5, 12, 12, 7, 1, 29, **36** | 0.32 % |
| | Typhoon | 88, 21, 37, 36, 25, 6, 82, **90** | 1.72 % |
| UP Diliman | Habagat rain | 27, 4, 25, 0, **44**, 2, 7, 37 | 0.23 % |
| | Typhoon | 67, 13, 63, 5, **90**, 8, 23, 89 | 1.55 % |
| UC Berkeley | Winter storm | 33, **38**, 27, 11, 3, 0, 0, 0, 0 | 0.24 % |
| | Atmospheric river | 87, **90**, 80, 41, 15, 5, 5, 6, 6 | 1.63 % |

Every site lands in the intended band (storm 20–45 cm at its lowest unit,
extreme 60–90 cm, wet area 0.2–2 % of the frame) without per-site tuning of
the formula; the Berkeley rain intensities (`P` 0.14 / 0.40) are the only
scenario numbers that differ. On Teachers Village the current siting (units on
addressed houses, ground datum on the street cell) makes V. Luna, Maginhawa
south and Mayaman the low corridor; on Diliman it is Orosa Hall at the Balara
end and the Red Cross by C. P. Garcia; on Berkeley it is the two Oxford Hall
units and Creekside, where Strawberry Creek leaves campus.

### 4.6 Campus model notes (FABDEM, obstacles, sea, placement)

- **Terrain.** Every Philippine site uses **FABDEM V1-2**, a bare-earth model
  (Copernicus GLO-30 with buildings and trees removed), so it gets no minimum
  filter: σ 1.0 cell smoothing and a 0.5 m street carve. FABDEM heights can be
  1–3 m off in dense cities; the page footnote says so.
- **Buildings as obstacles.** Footprints are rasterised to a built fraction per
  cell. A cell ≥ 75 % built blocks water, except street and creek cells, which
  are never blocked. Water goes around blocked cells (`shared/flood.js`).
- **Sea.** Cells with no terrain, or at or below 0 m, that connect to the grid
  edge are sea: drawn as water, never flooded, never a unit, and not counted in
  the NOAH shares. An inland hollow below 0 m stays land.
- **Automatic placement.** Candidate houses are within 25 m of a street and at
  least 300 m inside the box (so no unit is drawn under the map's edge, legend
  or credits). Each is
  scored 0.5 × lowness (share of ground within 300 m that is higher) + 0.3 ×
  NOAH hazard + 0.2 × nearness to water (to 0 at 300 m). Eight units are
  picked best-first, at least 300 m apart (then 250 m, then 200 m if eight do
  not fit). Unit 01 is the best spot on the campus; units 02–08 are off campus.
  The spots are proposals, not surveyed sites.
- **Storm-response reference.** `g_ref` is the median of the units' ground
  heights on every site (Teachers Village no longer pins 56 m).

---

## 5. How sensors feed the dashboard

### 5.1 The real device (what the dashboard is designed around)

BahaWatch units are ultrasonic water-level sensors (~$210/unit) mounted on a
household gate post at street edge, reporting over **LoRaWAN every 10
minutes**. Each unit is geotagged at install. The dashboard treats every unit
as a *point observation of street water depth* and needs exactly these fields
per reading:

```json
{
  "device_id": "BW-H07",
  "ts": "2026-09-16T08:30:00+08:00",
  "water_depth_cm": 28,
  "lat": 14.6478,
  "lon": 121.0515
}
```

Everything else the UI shows — rate of rise, status, ground elevation, NOAH
class, battery, RSSI — is either derived from consecutive readings or looked
up from the preprocessed data at install time (ground elevation comes from
the terrain grid at the unit's street cell, not from the device).

### 5.2 The simulated feed (what runs in the demo)

`SyntheticSensorAPI.latest(id, t)` in `template.html` stands in for the
device backend. It returns the JSON above (plus battery/RSSI/firmware fields
for realism) for any unit at any simulated minute `t` in a 36-hour window.
Depth comes from a storm hyetograph shaped by a gamma pulse (a second, smaller
pulse in the typhoon scenario), scaled per site by a **susceptibility** term:

```
lowness = (56 − ground_elev_m) / 4
w_noah  = 0.5·NOAH5 + 0.3·NOAH25 + 0.2·NOAH100          (levels 0–3, 3×3 max at the site)
sus     = clamp(0.35 + 0.5·lowness + 0.45·w_noah, 0.15, 2.6)
depth   = min(0.9, (P(t)·sus − 0.02) · exposure)         P: habagat 0.16, typhoon 0.50
```

so low-lying and NOAH-flagged sites flood earlier and deeper. Readings carry a
small deterministic jitter (seeded PRNG) so replays are identical.

The simulated clock emits a reading for every unit each 10 simulated
minutes — the same cadence as the real uplink — and the scrubber lets you
drag to any time; the reading history is rebuilt for the new position.

### 5.3 Swapping in the real feed

The model, renderer and UI never touch the storm generator directly; they
only call `SyntheticSensorAPI.latest()`. To go live:

1. Replace `SyntheticSensorAPI.latest(id, t)` with a fetch to your device API
   (`GET /api/v1/devices/{id}/readings?latest=1`, or a WebSocket/MQTT
   subscription) that returns the fields in §5.1.
2. Make `HOUSEHOLD` (the unit list in `template.html`) load from a
   `GET /api/v1/devices` registry instead of `DATA.sensors`; at install time,
   run the snapping step in `build_data.py` (§3 step 5) for each new unit so it
   gets `cx, cy, g` — its street cell and ground datum.
3. Drive the clock from wall time instead of the simulated timeline (keep the
   scrubber for replaying past events from stored readings).

`computeFlood()` is independent of all of this and runs in well under a
millisecond per update on the 35,400-cell grid, so it can be re-run on every
incoming reading.

### 5.4 Status thresholds

| Status (shape) | Depth at the unit | Depth words (public view) | Passability (car-based) |
|---|---|---|---|
| Normal (circle) | < 5 cm | No water | Passable to all vehicles |
| Water on street (triangle) | 5–25 cm | Gutter-deep (< 20) / Half-knee (20–45) | Passable to all vehicles |
| Water on street (triangle) | 25–33 cm | Half-knee-deep | Passable — drive slowly |
| Flooded (square) | 33–66 cm | Half-knee / Knee-deep (45–75) | Not passable to light vehicles |
| Flooded (square) | ≥ 66 cm | Knee / Waist-deep (≥ 75) | Not passable to any vehicle |

Depth words follow the human levels of the MMDA Flood Gauge (gutter 8″,
half-knee 10″, knee 19″, waist 37″). Passability follows its **car** levels —
half-tire 13″ (33 cm) = not passable to light vehicles, tire 26″ (66 cm) =
not passable to any — and the 25 cm "drive slowly" step is where Mamuyac et
al. (2025, *Natural Hazards* 121:14907–14933) observed lane closures
beginning in MMDA CCTV footage. The "flooded" square, the headline count and
the details-view time-to-flood ETA all use the 33 cm cutoff.

---

## 6. Public view

Built for the actual audience — someone at work asking *is there water at my
place?* and *can I get home?* — after team feedback that the operator
dashboard was visually overwhelming. Design register: NYC subway signage
(Unimark 1970 manual): Helvetica, black on white, one typeface, three sizes,
two weights, a black bar under the header, and color used only to carry
meaning.

Top to bottom:

1. **Status line + depth figure.** One sentence, large: "No flooding
   reported." / "Water on 3 streets." / "Mayaman St not passable to light
   vehicles." — counted by distinct street, not by unit. Below it, "Updated
   HH:MM". Beside it, two original geometric silhouettes on one ground line —
   an **adult at 160 cm (5′3″)**, between the Filipino adult averages, and a
   **child at 120 cm (3′11″)**, about age 6–7 — with water drawn over both at
   the current reading, a cm / ft ruler (feet hidden on phones), and the MMDA
   words (gutter, half-knee, knee, waist) ticked beside the adult. The
   caption gives the depth in cm and inches and where it lands on the child
   ("Child, 1.20 m: chest-deep"), computed from depth as a fraction of the
   child's height. A third figure — an original front view of a Vios-class
   sedan (1.47 m, ground clearance 15 cm, tire top 66 cm) with half-tire and
   tire ticks — carries the passability verdict: "Sedan: at the tire · Not
   passable to any vehicle". Each person wears a face set by where the water
   is on *that* body (under a quarter of height: happy; to 45 %: neutral;
   above: sad), so the child frowns while the adult is still neutral. The figure follows the tapped street, else "My street",
   else the deepest. It is an SVG `role="img"` with a localized title and
   description (e.g. "Figure of an adult (1.60 m) and a child (1.20 m)
   standing in water: knee-deep, 58 centimeters, on Matahimik St. On the
   child the water reaches the thigh."). Body-part words are in the `parts`
   array of each language table.
2. **My street.** Pick once from the monitored list; remembered per browser
   (`localStorage`, try/catch) and always shown first.
3. **Street board.** One row per unit, sorted worst-first: shape + street
   name, depth in advisory words plus rising/falling, passability, and the
   centimeter reading. Tap a row to center the map on it and isolate its
   footprint.
4. **Map beside the list** on screens wider than 900 px (sticky, scrolls
   independently of the street board — the layout recommended for map +
   panel interfaces); stacked below the list on phones with the map capped
   at 60 % of the viewport. Drawn as a diagram: named streets only (two weights), creeks as one light
   line, no buildings, no terrain tint, no alleys, no NOAH overlay, no zoom
   widget (pinch/scroll still work). Sensors are labeled with their street
   names, station-style, instead of labeling streets. Opens fitted to the
   sensor cluster. Selecting a unit (row or marker) highlights **the whole
   street** — every OSM way carrying that street name, so both Maginhawa
   units select all of Maginhawa. The selected street is redrawn at full
   strength with an ink casing and its name written along it, while every
   other street fades toward the paper; water is untouched. No colour is
   added (blue would read as "flooded"), and it settles which street a
   sensor near an intersection belongs to. Water is the only colored fill (two bands: on the street /
   knee-deep or more).
5. **Footer.** Full-width band: demo notice and "not for emergency use" on
   the left, attribution on the right; stacked on phones.

A one-time coach mark ("Tap a street on the map or in the list…") sits in
the map's corner until the first street is chosen, then never returns in
that browser (`localStorage` key `bw-coach`).

**Languages.** English, Filipino, Bisaya (Cebuano), Ilokano, Hiligaynon,
Kapampangan — chosen from the browser language on first visit, switchable,
remembered. Every string lives in the `LANGS` table in `template.html`;
adding Waray or Bikol is one more entry. The Filipino strings follow MMDA
advisory phrasing (*hanggang tuhod*, *hindi madadaanan ng maliliit na
sasakyan*). **Cebuano, Ilokano, Hiligaynon and Kapampangan were drafted
without a native speaker.** They are labeled "(for professional translation
review)" in the language menu, and a notice to that effect appears under
the header whenever one of them is active (`REVIEW_TAG` in `template.html`;
clear an entry once a language has been reviewed).

The public view runs the same simulated clock (at 12×, so the storm plays in
about three real minutes); the details view's scenario buttons change what it
shows.

### 6.5 Sites and tabs

A tab bar under the header — **PhilDev campuses · Teachers Village · San
Joaquin · UC Berkeley · Try reporting · About** — sits in both views (it wraps to a
second row on a phone) (`role="tablist"`, arrow keys
move between tabs; place names are not translated). On a campus page a campus
bar under it names the campus, says the readings are simulated, and links back
to the national map.

**The national map** (`#ph`, or no hash) is the "PhilDev campuses" tab: one
screen, a full-window vector map (§2.6) with the 25 campuses as pins by
group, clustered where they crowd (Metro Manila, Cebu), and a list with
search that ignores accents and case ("mapua", "banos") beside it. The list is a
tree of drop-downs, island group › province › campus, closed at first; a search
opens every branch with a match, and choosing a pin opens its branch. On
screens 900 px and wider, a list row flies the map to that campus, outlines
its 3 km box and shows "Open <short>"; narrower than 900 px the map sits
off-screen above the list, so a row opens the campus page directly instead
(plan ruling 5). Choosing a pin or cluster does the same flying/zooming on
the map itself. The map falls back to the country outline under §2.6's rule,
and shows the credit line `© OpenStreetMap contributors · Open Buildings (Google, Microsoft, VIDA) · MapLibre`
whenever tiles are showing.

**Routing.** The hash is `#<site>[/details]`: `#upd`, `#xu/details`,
`#berkeley`. No hash opens the homepage; `#ph` or an unknown site opens the national map; the old
`#details` link opens Teachers Village details; `#diliman` (and old
`#p.diliman.…` share links, and a saved `bw-last-hash`) open `#upd`. Opening a
site fetches its data file and shows a loading screen, or a retry screen if
the fetch fails; if another site is chosen while one is loading, the latest
choice wins.

**Zooming out to the whole country.** Every site's flood map — the
campuses, Teachers Village and Berkeley — can hand over to the same country
view. Zooming out past the whole box (one "−" press, two wheel notches, or
pinching in 25 %) hands the map over to the vector basemap or, offline, the
whole-country outline (§2.6), centred on the site with its box outlined as
the simulated area; "Whole country" on the campus bar opens it the same way.
"Back to the flood map", zooming back in until the box fills at least 0.9 of
the view's shorter side, or Escape all return. Leaving the site — another
tab, the national map, Try reporting, or Back — always closes the country
view, so the next site starts on its own flood map. Never available in the
Try tab; offline, Berkeley shows only the note, since the repository has no
country outline for the United States (plan ruling 7). `test_zoomout.js`
covers this end to end.

**The Try tab's phone.** "Try reporting" (§6.7) draws its answer band and
report buttons inside a CSS phone outline — a 12 px frame, 48 px corners,
and a camera pill and side buttons around a 390 px screen, in CSS rather
than inline SVG so the frame keeps a fixed corner radius as its height
changes (plan ruling 3) — with its map beside it, opened on about 700 m
across around 22 Malingap St, wide enough for every pretend phone in view.

**What switching does** (`switchSite`, ~150 ms): save the current site's
language, drop the selection and street highlight, rebuild terrain grid,
sensors, hazard grids, street mask, model buffers and canvases from that
site's blob (`initSite`), rebuild the unit cards and scenario buttons, reset
the clock to 0 and the scenario to the site's second one, fit the map to the
sensor cluster, restore that site's "My street" and language.

**Per-site memory.** `localStorage` keys are suffixed by site
(`bw-street:berkeley`, `bw-lang:tv`), so a Berkeley visitor's path pick never
appears in Teachers Village. A stored unit id that no longer exists falls back
to "Choose my street".

**Wording profiles.** `profile: "street"` (both Philippine sites) keeps the
MMDA vehicle-passability vocabulary. `profile: "path"` (Berkeley) overlays
`PATH_EN` on the English table: *paths* instead of *streets*, "Path open /
Water on the path — walk with care / Path closed" as the per-row verdict, the
car verdict as a secondary line ("Cars: do not drive through"), "My path",
and the UCPD emergency line.

**Units.** `units: "imperial"` writes inches first ("16 in · 40 cm"); metric
sites write "40 cm (16 in)". The figure keeps both rulers everywhere.

**Languages.** `langs: "all"` shows the six-language menu; `langs: "en"`
(Berkeley) forces English and hides the menu. The national map and the 25
campuses share one language (`bw-lang:ph`); Teachers Village and Berkeley
remember their own, starting from the shared one.

**Hazard layer.** Berkeley has no public campus-scale flood hazard layer, so
its `noah` entry is `None`; the NOAH chips, heading and per-unit NOAH class
are hidden on that tab and the susceptibility term falls back to terrain
lowness only. Teachers Village uses the Metro Manila NOAH shapefiles; each campus uses its province's NOAH maps, cut by the pipeline (§2.5).

**Sensor siting per site** (`site_by`). Teachers Village units sit on
addressed houses (`addr:housenumber` + `addr:street`) within 30 m of their
street; the campuses use OSM-named buildings within 90 m of a mapped creek,
with the nearest named way as the unit's street ("Orosa Hall · near Betany
St"). Long building names get a short map label (`short`) and a hand-placed
label side (`label_pos`); the list keeps the full name. **BW-B00 is the real
Strawberry Creek demo unit**; it is sited at a coordinate rather than on a
building (`fixed`), currently a placeholder at the Grinnell Pathway footbridge
over Strawberry Creek (`-122.26489, 37.87071`) until the real ones are
supplied — change the tuple in `sites.py`, rebuild `data/berkeley.json`,
rebuild the HTML.

**Clock and feed.** Each site carries its time-zone label and ISO offset
(`tz`, `utc`): the simulated clock reads "simulated PT" on Berkeley and the
API feed's timestamps carry `-07:00`.

**Storm-response reference.** The rise-time lag and susceptibility are
relative to a reference street elevation: the median of the units' ground
heights, on every site (§4.6).

**Map tint.** The details-view hypsometric tint is stretched between the 5th
and 95th elevation percentiles of the frame so Berkeley's hills do not flatten
the campus.

**`sites.py` fields.** `id, name, place` · `bbox` (LON0, LAT0, LON1, LAT1) ·
`W, H, GW, GH` · `dem, dem_kind` (`dsm` or `dtm`) · `min_filter, sigma, carve`
· `osm` · `noah` (dict of shapefile stems or `None`) · `sensors`
[(id, building or street name, target lon, target lat)] · `site_by`
(`address` | `name`) · `fixed`, `unit_names`, `short`, `label_pos` (optional
per-unit overrides) · `g_ref` (optional) · `tz`, `utc` · `labels` ·
`road_class` · `creek_tags` · `profile` · `langs` · `units` · `scen` ·
`emergency` · `attribution`.

---

### 6.6 Babaha ba?, reports and no accounts

An answer band above the street board, in the local phrasing everyone already
uses to ask a neighbour: **Babaha ba?** ("Will it flood?") →
**Oo** (filled square) / **Baka** (triangle) / **Hindi** (ring circle) /
**Walang bagong datos** ("no fresh data", dashed grey box) — the same four shapes
used on the map markers, so colour is never the only carrier of meaning
(§6, Accessibility). A live region announces the answer on every real change
(place, language, or verdict), not on every re-render.

**The rule.** Flowchart:
[shared artifact](https://claude.ai/artifact/6EmnCVpoKj743RrE9PSFfL) ·
[repo copy](docs/superpowers/specs/2026-09-26-babaha-ba-flowchart.html)
(linked from the design doc,
`docs/superpowers/specs/2026-09-26-babaha-ba-reports-no-accounts-design.md`).
Implemented as one pure function, `babahaBa()` in `shared/verdict.js` — no
network, no clock, no DOM — which decides the answer from whatever inputs
are fresh (sensors, neighbour reports, rain), in this order, first match
wins:

1. **stale** → `nodata` if the newest of every input is more than
   `FRESH_MIN` (20 min) old. The page must never show "Hindi" on stale data.
2. **sensor here, wet now** (≥ `WET_CM`, 5 cm) → `oo`.
3. **sensor here, wet soon** (rising to 5 cm within `LOOKAHEAD_MIN`, 60 min)
   → `oo`, with an ETA rounded to 5 min.
4. **upstream sensor** wet-or-soon plus its travel time to here, within the
   same 60-min look-ahead → `oo`.
5. **`REPORTS_YES`** (3) distinct phones reporting "Oo" within `REPORT_RADIUS_M`
   (1 km) in the last hour → `baka` with reason `reports` ("N neighbours report
   flooding"), or `reports_vs_dry_sensor` when a sensor within `DRY_SENSOR_M`
   (500 m) is dry with no rise. Reports alone never produce `oo`; only a sensor does.
6. **rain** ≥ `RAIN_YELLOW` (7.5 mm/h) in a NOAH 5- or 25-year zone, or
   ≥ `RAIN_ORANGE` (15 mm/h) anywhere hazard-mapped → `baka`.
7. **1–2 "Oo" reports**, or a trace reading at the local sensor
   (≥ `TRACE_CM`, 1 cm) → `baka`.
8. Otherwise → `hindi`: reason `clear` ("No flood signs from sensors, reports
   or rain.") when a fresh sensor reading was part of the check, or
   `clear_no_sensor` ("No heavy rain or flood reports nearby. No sensor here
   yet.") when none was — so a Hindi never claims sensors were checked where
   there are none.

"The local sensor" is every sensor *inside* the place: a sensor street's own
unit, or for a barangay every unit standing inside its boundary (`inside` in
`places.json`); when there are several, the most urgent one decides.

The Worker imports the same module for its cron (`worker/README.md`);
`build_html.py` inlines it into the page (stripping `export`) so the demo
build's simulated verdicts and the live build's server verdicts are the same
code, not two implementations kept in sync by hand. Every constant lives in
the one `RULE` object — `shared/verdict.js` is the source of truth, checked
against the flowchart above by the table tests in `shared/verdict.test.js`.

**`places.json`.** Every sensor street and barangay the page (and the
Worker) can answer for, with each place's NOAH flags, the sensors inside it
(`inside`: the place's own sensor for a street; every unit standing inside
the boundary for a barangay) and the sensors whose water can reach it
(`connected`, with travel times). Rebuild after any change to `sites.py`, a
`data_<site>.json`, or the barangay boundaries:

```bash
python3 tools/build_places.py     # reads shared/verdict.js's LOOKAHEAD_MIN, never desyncs from it
```

Barangay polygons come from the PSA/NAMRIA admin-4 boundaries and are
extracted separately, on the machine that has the source shapefile (not part
of the normal rebuild — the boundary file isn't checked in):

```bash
python3 tools/extract_barangays.py <phl_admin_boundaries.zip> <outdir>   # → sites/<site>/barangays.geojson
```

A barangay is flagged for a NOAH hazard zone once at least `NOAH_SHARE`
(10 %) of its grid cells sit inside that zone (`build_places.py`) — not a
single flooded cell, so a barangay that just clips the edge of a hazard
polygon isn't flagged for it. The campus boxes carry 5 (UPLB) to 316 (UST) barangays.

**Demo vs. live.** `#tv` (no `/live`) stays in demo mode: a locally
simulated clock and verdict, exactly like the rest of the dashboard, and
tapping a report button just shows "Demo — not sent." The demo answer band
carries a visible **Demo · simulated storm** chip (in the page's language),
which is also the first thing the screen-reader announcement says.
`#tv/live` switches the public view to real answers polled from the Worker's
`/status/<place>`: the simulated playback stops, and the simple view hides
the simulated depth figure, street list, headline, flood layer, depth legend
and status-coloured sensor markers — the map keeps only the basemap and a
neutral marker for the picked place — and shows a note that it's live
instead. `#tv/details/live` is the details view in live mode: its map, cards
and log still run on the simulated feed, under a banner saying so ("Simulated
sensor feed — the answer above is live"), and it also draws neighbours'
recent reports as hollow diamonds on the map and a last-hour text log, from
`/recent/<site>`. A build with no
`BAHAWATCH_API` (the published demo artifact) can't go live at all — `/live`
is silently dropped from the hash. Ages shown next to "Updated" always come
from the server's `checkedAt`/`serverNow`, never `Date.now()` on the phone,
so a phone with a wrong clock still sees a correct "updated 2 min ago"
(Review Focus #1). Within a session the time since the last reply is
measured on the monotonic clock, so a phone clock changed mid-session can't
make an old answer look fresh; a cached answer from an earlier session whose
receive time is in the phone's future is shown as "Walang bagong datos".

**Polling.** Cloudflare does not edge-cache Worker responses (the 60 s
`Cache-Control` only lets a browser reuse a reply), so every `/status` poll
runs the Worker. The page therefore polls once per cron run: after a reply,
the next poll is due at the reply's `checkedAt` + 5 min + a random 0–30 s
(computed in server time), never sooner than 60 s — about **12 requests an
hour per open tab** (a failed poll backs off 2 → 4 → 5 min). Coming back to
the tab polls straight away only if the answer on screen is more than 5
minutes old. The details view in live mode also fetches `/recent/<site>`
once a minute.

**The Worker.** `worker/README.md` has the full runbook: one-time Cloudflare
setup, the six endpoints, what's stored and for how long, and how the
5-minute cron stays within D1 Free's 50-query cap.

**Share links and QR.** A share token is a bare hash, `#p.<site>.<s|b>.<code>`
(e.g. `#p.tv.s.BW-H05`) — opening it sets that place with no picker, and
opens straight into live mode when the build has an API to talk to (the
published demo just sets the place). `qr/<site>/` holds one PNG per place
encoding its share URL; `qr/index.csv` lists all 51 places with their place
id, name, URL and PNG path (`tools/make_qr.py`). Add to Home Screen
(`manifest.webmanifest`, `sw.js`) launches at `bahawatch_dashboard.html?source=pwa`,
which restores whichever site/view/place the person last had open, from
`localStorage`, rather than always opening to Teachers Village; the service
worker caches the page shell for offline opening (showing the last answer
with its age) but is network-first and never caches API responses — a
same-origin GET is refreshed from the network whenever possible, and the
Worker's calls are cross-origin so they're never intercepted at all.

**What's stored, and for how long.** GPS is rounded to 3 decimal places
(~100 m) on the phone and again on the server — no exact position, name, or
phone number is ever stored. The phone only uses its GPS fix when it is
within 1 km of the place being reported (otherwise the report is pinned to
the place's centre — someone answering about a relative's barangay doesn't
send their own position), and the Worker rejects a position more than 2 km
from the place. A report counts toward the answer for 60 minutes, then ages
out. One report per phone per place per 10 minutes: the same answer again
comes back as "already recorded", shown as a normal "Thanks, recorded", not
an error (Review Focus #5); a *different* answer (say "Hindi" to "Still
there?" after that phone's own "Oo") replaces the phone's earlier report —
latest wins. The phone's random report id is blanked from a report once it
stops counting (the hourly job, after ~61 minutes), so stored reports aren't
a per-phone trail. Raw report rows are deleted after 30 days, but the hourly
Oo/Hindi/Di sigurado counts rolled up from them are kept indefinitely, as is
the sensor reading history (needed later to tune the rule's thresholds). Undo works for 10 s in
the page's own UI and up to 15 s server-side. A report made offline (no
signal when "Oo" was tapped) is held on the phone for up to 10 minutes and
sent once connectivity returns, or dropped if it doesn't.

**Language review flags.** Cebuano, Ilokano, Hiligaynon and Kapampangan
carry the existing `REVIEW_TAG` notice (§6) because they were drafted
without a native speaker. The new report/live strings added for this
feature (report buttons, "Thanks, recorded", Undo, "Still there?", the live
note, the neighbour-reports log) are covered by the same tables and the
same flag — they still need that native-speaker pass before the flag comes
off, same as the rest of each language's table.

---

### 6.7 Try reporting (proof of concept on the static site)

The fourth tab, **Try reporting** (`#try`), shows how neighbour reports work without a server.

- **The phone:** the same answer band and report buttons as the live page, for one fixed place (22 Malingap Street, sensor BW-H03, Teachers Village).
- **The controls:**
  - **+ Neighbour says "Oo" / "Hindi"** adds up to 8 pretend phones at fixed spots within about 300 m.
  - **Sensor at 22 Malingap St** switches between dry, 3 cm and 20 cm.
  - **Reset** clears the reports and the sensor.
- **The explanation line** under the controls says what the rule saw and decided. The rule is the same `shared/verdict.js` the Worker uses. Reports alone reach Baka at most; only a sensor makes Oo.
- **The map** shows each report as a hollow diamond, and the list under it repeats them as text.
- **Nothing is sent.** State is in memory and a reload starts fresh. The tab never changes the place chosen on the other tabs.
- **Demo tabs:** tapping a report button says "Demo — not sent" and links here.

## 7. Dashboard anatomy — details view (`template.html`)

| Layer / panel | Notes |
|---|---|
| Base map | Offscreen canvas at 2.2× resolution: hypsometric paper tint from the terrain grid, roads by class with casing, creeks in logo blue over roads, 17,993 building squares. Rendered once per theme. |
| NOAH overlay | Offscreen canvas; the selected return-period grid tinted yellow/orange/red. Off by default. |
| Flood overlay | Offscreen canvas; depth grid → three bands (ankle < 22 cm, knee < 55 cm, waist+). Re-rendered on each reading. When a unit is selected, other units' footprints dim. |
| Overlay canvas | Screen-space: street/creek labels, sensor markers (shape + color by status), street-cut markers (depth > 25 cm on a road), selection ring. Redrawn every frame. |
| Zoom/pan | Scroll or pinch (1×–6×, anchored to the cursor), drag to pan (clamped to the frame), double-click, +/−/⌂ buttons, keyboard (see Accessibility), and "Zoom to unit" on the selected card. |
| Right rail | Alert banner · selected unit (depth, rate, ground m ASL, NOAH class, sparkline) · unit grid · impact stats (buildings in wet cells, residents at 4.2/household, streets cut, deepest reading) · simulated API JSON · event log. |
| Timeline | 36-h simulated window, hydrograph curves per unit, play/pause, 1×/4×/12× speed, drag to scrub. |

### Visual style

Mini Motorways in spirit: warm paper ground (`#f8f4ec`), white streets with
sand casings, soft tan building squares, pastel creeks, hairline dividers
instead of cards, uppercase tracked section labels, and the map as the
dominant element. Typeface: **Atkinson Hyperlegible Next** (Braille Institute),
for readers with low vision (2026-09-29): the page, the canvas labels and the depth
figure load the unaltered web fonts in `shared/fonts/atkinson/` (Mono for the API
feed); the map labels use glyphs rendered from its OFL release by
`tools/build_glyphs.py` (Noto Sans fills the code points it lacks). Glyphs the
font lacks on the page (☾ ☀ ▾ ⌂) fall back to Helvetica / Arial. Brand blues from the logo: `#0030a0` (controls,
deepest water band, selection ring) and `#70c0e0` (creeks; the brand color in
dark theme).

A manual light/dark toggle (☾/☀ in the header) overrides the OS preference and
is remembered per browser via `localStorage` (wrapped in try/catch; falls back
to the OS setting).

### The car in the depth figure

An original front-view drawing of a subcompact sedan at Vios-class
dimensions (1.70 m wide, 1.47 m tall, 15 cm ground clearance, 66 cm tire,
hood 78 cm, roof 1.47 m). The wheels stand a few centimetres proud of the
body so the MMDA marks — half-tire 33 cm, tire 66 cm — land on rubber. Scale
type is 12 px in the SVG (≈ 10 px on a laptop at 100 %); below 560 px the
ruler, car-tick and body-part labels are enlarged by CSS so they read
without pinching.

### The motorcycle in the depth figure

An original front-view underbone (Wave / XRM / Sniper class): 17″ wheel with
the tire top at 66 cm, leg shield, handlebar at 1.00 m, mirrors to 1.20 m,
crankcase 15–35 cm, exhaust header down the right side, footpegs at 30 cm.
The MMDA gauge defines no motorcycle level and Mamuyac et al. (2025) report
motorcycle speeds but no cutoff, so the verdict is **BahaWatch's own exhaust
rule**, stated as such: *ride slowly* from 15 cm (water at the crankcase),
*not passable* from 30 cm (exhaust outlet and footpegs — where bikes stall).
The figure's ticks mark both. The street verdicts in the headline and list
stay car-based (MMDA); the motorcycle line appears in the figure caption and
the screen-reader description. Wording exists in all six languages; the five
non-English strings are flagged for professional review with the rest.

### Accessibility

Designed to WCAG 2.2 AA:

- **Color-vision deficiency.** Status is never conveyed by color alone. Each
  unit's status is encoded by **shape** — circle = normal, triangle = water on
  street, square = flooded — on the map markers, the legend, and the unit
  cards, and the status word is printed on every card. Status colors come from
  the Okabe-Ito CVD-safe palette (`#008f68` / `#bd7a00` / `#d55e00` in light
  theme; `#00b386` / `#e69f00` / `#e8763a` in dark). Flood depth is a
  single-hue sequential blue ramp (safe for all common CVD types) and the NOAH
  overlay is a sequential purple ramp so it cannot be confused with water or
  with status. Map markers carry a paper halo and an ink outline so their
  boundary is high-contrast regardless of fill.
- **Contrast.** Every text/background pair is ≥ 4.5:1 in both themes (audited:
  secondary text 5.6:1 light / 6.2:1 dark, banners 12–14:1, brand buttons
  8–11:1). Status markers and the mid/deep depth bands are ≥ 3:1 against the
  paper; the lightest depth band (ankle) is intentionally faint and is backed
  by the tooltip's numeric depth and the legend. Hairline dividers are
  decorative.
- **Keyboard.** The map is focusable: `+`/`−` zoom, arrow keys pan, `0`/Home
  resets. The timeline is a proper `role="slider"`: arrows ±10 min, PageUp/Down
  ±60 min, Home/End, Space toggles play. Unit cards are buttons (Enter/Space
  select; `aria-pressed` reflects selection). All toggle groups expose
  `aria-pressed`. Focus rings are 3 px brand-colored.
- **Screen readers.** `h1`/`h2` landmarks; the alert banner is a `role="status"`
  live region; the map has an `aria-describedby` summary (units by status,
  buildings affected, deepest reading) refreshed with each reading; the slider
  reports its time as `aria-valuetext`.
- **Motion.** Marker pulses and autoplay are suppressed under
  `prefers-reduced-motion`.
- **Targets.** Interactive controls are ≥ 24 × 24 CSS px (chips 26 px,
  buttons 28–44 px).

Not yet covered: the canvas map itself is not navigable marker-by-marker with
a screen reader — use the unit cards and "Zoom to unit" instead.

The dashboard's own **Accessibility** tab (`#access`) is the current, plain-language
version of this section for users (WCAG 2.1 AA with 48 px targets, per `.ux-profile.md`).

---

## 8. Known limitations / next steps

- **Terrain resolution.** 30 m FABDEM (bare earth), with 1–3 m height error in
  dense cities. Phil-LiDAR/DREAM 1 m DTMs (via UP/LiPAD) would make the fill
  far more faithful; requested through Project NOAH.
- **Campus unit spots are proposals** from the automatic placement (§4.6), not
  surveyed or agreed sites. Readings are simulated everywhere.
- **Worker parked.** The live Worker still carries the pilot configuration.
  Before deploying it with 27 sites, re-count the D1 queries per cron run
  (27 rain upserts plus about 6 reads and writes, against the free plan's 50)
  and the CPU time per run.
- **Static fill, no dynamics.** The model extrapolates a water surface; it
  does not route flow or conserve volume. Extents are conservative by design.
- **Simulated readings.** Replace with bench/field data from a real unit
  (§5.3). A replay of a logged storm would be the strongest demo.
- **Berkeley demo unit** coordinates are a placeholder (§6.5) until the real
  ones are supplied; the Berkeley map has no hazard reference layer at all.
- **Eight sites per tab, hand-picked.** Real deployments should let the registry
  drive the unit list. The demo labels units with real OSM house numbers for
  clarity; a real deployment shows an address only with the household's
  consent (drop `hn` from the sensor record to fall back to street-only
  labels).
- **Unused:** `project_noah_hazards.csv` (barangay statistics).
- **Translations** for Cebuano, Ilokano, Hiligaynon and Kapampangan need
  professional review (§6).
- **Canvas map** is not navigable marker-by-marker with a screen reader; the
  street board is the equivalent path.

---

## 9. Attribution

Map data © OpenStreetMap contributors (ODbL; Geofabrik extract and Overpass) ·
Buildings: Google Open Buildings (CC BY 4.0), Microsoft Building Footprints
(ODbL), OSM (ODbL), combined by VIDA · Terrain: FABDEM V1-2 © University of
Bristol (CC BY-NC-SA 4.0, non-commercial); USGS 3DEP 1 m at Berkeley (public
domain) · Flood hazard reference: UP Project NOAH / UP Resilience Institute
(ODbL) · Administrative boundaries: PSA / NAMRIA via OCHA HDX (CC BY-IGO). Full list:
`DATA-LICENSE.md`.

Not a forecast. Not for emergency use.
