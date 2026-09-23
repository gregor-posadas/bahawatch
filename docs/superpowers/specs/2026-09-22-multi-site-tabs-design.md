# BahaWatch dashboard — multi-site tabs (Teachers Village · UP Diliman · UC Berkeley)

Date: 2026-09-22 · Status: draft for review · Owner: Gregor Posadas

## 1. Purpose

Show the same sensor-driven flood dashboard on three sites so the conference audience sees the system work on different terrain, street patterns and data quality: a Quezon City neighborhood (30 m terrain), a campus in the same city (30 m terrain, richer creek network), and a US campus with 1 m lidar and a live sensor. One file, one link, three tabs.

Success: a presenter opens the link on any site by URL, switches tabs without reloading, and every feature of the current build (public view, details view, figures, street highlight, languages, tests) works on all three.

## 2. Scope

In scope: site model, tab bar and routing, per-site preprocessing (including UTM inputs and lidar conditioning), per-site sensor lists, per-site wording profiles, hazard layer on/off, tests, README.

Out of scope, already approved and queued separately: the car scale and MMDA passability thresholds (built first; sites inherit it) and the v2 hero/rise-time redesign. Also out of scope: live sensor data, FEMA hazard layer for Berkeley, Phil-LiDAR terrain (drops in when the LiPAD request is granted).

## 3. Site model

`template.html` gains a `SITES` table. Each entry:

| Field | Teachers Village | UP Diliman | UC Berkeley |
|---|---|---|---|
| `id` / hash | `tv` (default, no hash) | `diliman` | `berkeley` |
| name / place line | BahaWatch · Teachers Village, Quezon City | UP Diliman, Quezon City | UC Berkeley, California |
| frame (WGS84) | as now | 121.0560–121.0820 E, 14.6440–14.6700 N | −122.2700 to −122.2480 E, 37.8660–37.8790 N |
| grid | 200 × 177 (~15 m) | 200 × 200 (~14 m) | 240 × 180 (~8 m) |
| terrain input | Copernicus GLO-30 (DSM) | Copernicus GLO-30 (DSM) | USGS 3DEP 1 m (DTM, EPSG:26910) |
| conditioning | min-filter 3×3, σ 1.6, carve 0.5 m | same | no min-filter, σ 0.8, carve 0.25 m |
| hazard layer | NOAH 5/25/100 | NOAH 5/25/100 | none |
| scenarios | Dry day / Habagat rain / Typhoon (P 0.16 / 0.50) | same | Dry day / Winter storm / Atmospheric river (P 0.14 / 0.40) |
| languages | six, menu shown, default from browser | same | English only, menu hidden |
| units | metric first | metric first | imperial first |
| wording profile | `street` (MMDA vehicle passability) | `street` | `path` |
| emergency line | 911 or your barangay | same | 911 or UCPD (510-642-3333) |
| attribution | OSM · Copernicus © ESA · NOAH | same | OSM · USGS 3DEP via OpenTopography |

Data: `build_data.py` reads a site config (a Python dict in `sites.py`) and writes `data_<id>.json`; `build_html.py` injects all three as `DATA_ALL = {tv:…, diliman:…, berkeley:…}` and the page picks `DATA = DATA_ALL[site]` at load and on tab switch. Total embedded data ≈ 1.2 MB.

Everything now hard-coded for Teachers Village (bbox, grid, sensors, labels, scenarios, strings that name the place) moves into the `tv` entry. No behavior of the current build changes for that site.

## 4. Tabs and routing

A tab bar sits under the header in both views: **Teachers Village · UP Diliman · UC Berkeley**, ink underline on the active tab, `role="tablist"`, arrow keys move between tabs. Tab labels are not translated (place names).

Switching a tab: save per-site state (my street, language) → set `site` → rebuild terrain grid, sensors, hazard grids, labels, street mask, palette → re-render base map and flood → reset the simulated clock to 0 and the scenario to the site's second scenario → fit the map to the sensor cluster → render the active view. Under 200 ms on the 1 m site.

URL: `#diliman`, `#berkeley`, `#tv` select a site; `#berkeley/details` selects the site and the details view. No hash = Teachers Village, public view. The page writes the hash on tab and view changes so the presenter can copy a URL for any state.

Per-site memory: `localStorage` keys become `bw-street:<site>` and `bw-lang:<site>`; the theme stays global. Missing storage falls back to defaults as now.

## 5. Preprocessing

`build_data.py` changes:

- Accepts a site config: input paths, frame, grid, conditioning parameters, sensor list, label list, hazard shapefiles (or none), road-class map.
- Reprojects any input DEM to WGS84 sampling via `pyproj` (Berkeley is UTM 10N); handles `nodata` (−999999 in the USGS tile) by masking before filtering.
- Conditioning per site (table above). Rationale: the lidar DTM is bare earth, so the minimum filter that strips rooftops from a DSM would only erode real terrain; a light blur removes lidar noise at the cell size.
- Road classes: Berkeley's campus is mostly `footway`, `path`, `pedestrian`, `steps`. For the `path` profile these become `minor` (drawn and carved) so water follows the paths the way it follows streets in Teachers Village; `steps` are excluded. `service` stays `alley`.
- Creeks: `stream` and `river` ways, plus `drain` for Diliman (its creeks are tagged inconsistently; named drains are kept).
- Sensor siting: a unit is placed on a named building (Berkeley, Diliman campus) or an addressed building (Teachers Village) that carries the intended name; the build asserts the building is within 60 m of the named creek or street it is labeled with, derives the "near X" cross reference from geometry, and snaps the ground datum to a cell on its own street or, for creek units, the nearest carved path cell. `test_sites.js` runs per site.
- Labels: the six to ten most useful named ways per site, plus creek names; Berkeley adds "Strawberry Creek North Fork".

## 6. Sensor sites (initial; to be corrected by Gregor)

UC Berkeley, downstream to upstream along Strawberry Creek:

| Unit | Building | Creek / note |
|---|---|---|
| BW-B00 | Strawberry Creek demo unit (the real sensor) | placed at the Oxford Hall footbridge until real coordinates are supplied |
| BW-B01 | Oxford Hall | creek leaves campus; lowest campus point in the box |
| BW-B02 | Creekside Center | 17 m from the creek |
| BW-B03 | César E. Chávez Student Center | south fork at Sproul |
| BW-B04 | Anthony Hall | 14 m from the creek |
| BW-B05 | Faculty Club | 24 m |
| BW-B06 | Women's Faculty Club | 19 m |
| BW-B07 | Chou Hall | 14 m, upstream |
| BW-B08 | Stebbins Hall | North Fork |

UP Diliman, where creeks meet the campus:

| Unit | Building | Creek |
|---|---|---|
| BW-D01 | Bulwagang Pambarangay ng San Vicente | San Vicente Creek (west) |
| BW-D02 | UP Checkpoint, University Avenue | unnamed creek at the Commonwealth gate |
| BW-D03 | Tech Portal | UP TechnoHub |
| BW-D04 | Josefa Llanes Escoda Memorial Hall | Pansol Creek, Balara — lowest ground in the box |
| BW-D05 | Orosa Hall | Pansol Creek |
| BW-D06 | BPI, C.P. Garcia Avenue | Katipunan Creek |
| BW-D07 | Parroquia de Balara | Old Balara |
| BW-D08 | Tierra Bella Multi-Purpose Hall | Tandang Sora Creek |

Labels use building names on the two campuses ("Chávez Student Center") and house numbers in Teachers Village, as now.

## 7. Wording profiles

Every user-facing string that mentions streets or vehicles is keyed by profile. The `street` profile is the current text in all six languages. The `path` profile (English only) reads:

- Section headings: "My path" / "Monitored paths"; picker hint "Pick the path you take across campus."
- Row status: "Path open" (< 5 cm) / "Water on the path" (5–33 cm; "walk with care" from 25 cm) / "Path closed" (≥ 33 cm), matching the MMDA/paper thresholds so the shapes stay consistent across sites.
- Headline: "No flooding reported." / "Water on 3 paths." / "2 paths closed."
- Depth: "14 in · 35 cm"; figure caption imperial first; ruler shows both units (already does).
- Car caption stays (a car still floods) with "Not passable to light vehicles" replaced by "Cars: do not drive through".
- Scenario names and emergency line from the site table.

## 8. Map and figures

The map is unchanged except that the `path` profile draws paths at the `minor` weight and the basemap tint range is per site (Berkeley's 49–326 m range would wash out at Teachers Village's contrast). The figures, faces, street highlight and coach mark work unchanged. The NOAH chips and the Details "NOAH class" field hide for a site without a hazard layer; the public legend drops nothing.

## 9. Storm response

Unchanged formula: `sus = clamp(0.35 + 0.5·lowness + 0.45·w_noah, 0.15, 2.6)`, with `lowness` relative to the site's terrain (56 m reference becomes the site's median street elevation) and `w_noah = 0` where there is no layer. Berkeley's response therefore comes from terrain alone; the creek-side units are the low ones and will show it. Rain intensities in the site table are tuned so each site's second scenario peaks around half-knee and its third around waist at the lowest unit; the calibration numbers go in the README.

## 10. Testing

- `test_sites.js` runs for each site: every unit sits on the named building, within 60 m of its labeled creek or street; labels resolve.
- `test_tabs.js` (new): loading `#berkeley` opens Berkeley in public view; `#diliman/details` opens Diliman details; switching tabs changes the place line, sensor count, headline and figure caption; my-street and language are remembered per site; the map fits the new cluster; no page errors across all switches.
- `test_figure.js` and `test_public.js` run against Teachers Village (unchanged) and Berkeley (imperial caption, path wording).
- Screenshots of all three sites at phone and desktop widths, reviewed by eye before publishing.

## 11. Files

`sites.py` (new; the three configs) · `build_data.py` (site-driven) · `build_html.py` (three injections) · `template.html` (SITES table, tab bar, routing, profile-keyed strings, per-site palette/legend) · `public_view.js`, `public_view.css` (tab bar styles, path profile) · `test_tabs.js` (new) · `README.md` (§2 inputs per site, §6 tabs, §7 wording profiles, calibration table). Raw inputs stay out of the package as now; the README documents the Overpass queries and OpenTopography jobs used for each site.

## 12. Risks

- **Embedded size** ~1.2 MB: acceptable for a demo link; if load time on a phone matters, the site blobs can move to separate files later without changing the page's API.
- **Diliman's OSM creeks** are tagged as stream/river/drain/ditch with gaps; the model does not depend on them (they are drawn, not modeled), so gaps only affect the picture.
- **Berkeley demo unit** coordinates are a placeholder until supplied; the unit is labeled as the demo unit either way.
- **Lidar nodata** at the tile edge is masked; if the mask reaches a sensor cell the build fails loudly rather than placing a unit on a hole.
