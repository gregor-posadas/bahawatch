# Nationwide PhilDev prototype: 25 partner campuses — design

Date: 2026-09-27 · Status: approved in conversation (4 sections), awaiting written-spec review
Builds on: `2026-09-26-babaha-ba-reports-no-accounts-design.md` (§9 left this for its own spec) and
`2026-09-26-try-reporting-tab-design.md`

## 1. Purpose

PhilDev needs to see **what a BahaWatch partnership would look like at each of its 25 partner
universities**. Today the site shows three hand-built places (Teachers Village, UP Diliman, UC Berkeley).
This round turns it into a national prototype with:

- a map of the Philippines with every partner campus on it;
- for each campus, the familiar simple "Babaha ba?" view of the campus and its neighbourhood;
- 8 proposed sensor units per campus, placed automatically;
- a card that spells out the partnership.

It also moves the Philippine model from Copernicus to FABDEM bare-earth terrain, with buildings
acting as obstacles to water.

**What Gregor said:**
- Every campus at full depth.
- Cover the campus plus its neighbours, about a 3 km box.
- Sensor spots are placed automatically only.
- Switch Teachers Village and UP Diliman to the new model; Berkeley keeps its USGS 1 m terrain.
- Load one campus at a time.
- Accuracy matters ("as true to reality as possible").
- Free tiers only.
- Specs, plans and reports as PDF.
- Accessibility in all work.
- Nothing runs on his PC until the plan is approved.

**Assumptions (not said):**
- A campus with several sites is shown at its main campus (§4).
- The site stays static on GitHub Pages, with no server.
- Readings stay simulated and labelled as such.

**Success looks like:**
- From the opening map, a PhilDev reader reaches any of the 25 campuses in two taps or by typing its name.
- Each campus shows the flood view, 8 units on real buildings (one on campus), and a partnership card
  with barangays and NOAH hazard shares.
- Water on the map follows low ground and goes around buildings.
- Missing data is stated, never shown as zero.
- The opening view is small (≤ 250 KB gzipped); each campus loads only when chosen.
- The whole pipeline can be re-run from the saved scripts and gives identical files.

## 2. Decisions taken in conversation

| # | Decision | Chosen | Rejected and why |
|---|---|---|---|
| N1 | Depth | All 25 campuses at full depth | A few showcase campuses plus pins only (does not show "every partner") |
| N2 | Coverage | Campus plus neighbours: a 3 km box centred on the campus | Campus grounds only (floods mostly hit the neighbours); whole city (too large per page) |
| N3 | Sensor spots | Automatic placement, 8 per campus, one on campus | Hand-picked (25 × 8 spots by hand, not repeatable) |
| N4 | Terrain | FABDEM V1-2 bare earth for all Philippine sites, including TV and UP Diliman; Berkeley keeps USGS 1 m | Keep Copernicus plus filtering for old sites (two models side by side) |
| N5 | Loading | National map first; one campus file (`data/<id>.json`) fetched on demand | One page with all 25 embedded (≈ 10 MB) |
| N6 | Where cutting happens | On Gregor's PC, one pass per big dataset, small outputs staged to the container | Uploading 5 GB of buildings (over the 400 MB stage limit) |
| N7 | Buildings in the model | Per-cell built fraction; ≥ 75 % built cells block water, street cells never block | Ignore buildings (water crosses houses); full hydraulic model (not possible in a static page) |

## 3. What PhilDev sees

### 3.1 Opening view: national map

- **Plain link.** A plain link (no hash) or `#ph` opens a map of the Philippines with all 25 campuses.
- **Outline.** The country outline is simplified from the admin boundaries file, about 30 KB.

**Pins by type**, told apart by shape as well as colour:

| Type | Pin |
|---|---|
| State university / college (SUC) | Blue #385F96 circle |
| Local university / college (LUC) | Orange #CF5921 square |
| Private | Maroon #800000 triangle |

A legend says this in words.

- **Labels.** Each pin has a short text label (e.g. "UPLB"). Where labels collide in Metro Manila, the map
  shows a count bubble ("12 campuses") that zooms in when chosen.
- **Campus list** beside the map on desktop, below it on phones:
  - grouped **Luzon (17) · Visayas (5) · Mindanao (3)**;
  - a search box that matches full name, short name, city or province ("Xavier", "UPLB", "Iligan").
- **Other tabs** stay after the list: **Pilot sites** (Teachers Village, UC Berkeley) and **Try reporting**.
- **Screen readers** get a short description: "Map of the Philippines with 25 PhilDev partner campuses:
  17 in Luzon, 5 in Visayas, 3 in Mindanao. The list below has the same campuses."
- **Keyboard.** Pins are reachable by keyboard in list order.

### 3.2 A campus page

- **Link.** `#<id>`, e.g. `#upd`, `#xu`. The same scheme as the existing `#tv`, `#tv/details` and
  `#tv/live`. Ids are lowercase letters only, so share tokens `#p.<id>.s.<sensor>` keep working.
- **Header:** "‹ All campuses · [campus name] ▾". The ▾ opens the same picker.
- **Map.** The existing simple view on the new terrain: streets, creeks, buildings, the 8 units and the
  simulated storm, with the "Babaha ba?" answer for the chosen place.
  - Detail view, language menu, share links and QR codes work as they do today.
- **"What a partnership looks like" card:**
  - **Proposed units:** 8 household water-level units, placed automatically; one on campus
    (named, e.g. "BW-UPD-01 · on campus").
  - **Barangays covered:** names of the barangays inside the box (count, then the list).
  - **NOAH flood hazard in this area.** The share of the land in the box inside a hazard zone, at
    5-, 25- and 100-year rain. A missing return period reads "not available from NOAH", never 0 %.
  - **University role** (the same text for every campus):
    - students install and look after the units with residents;
    - faculty check the data;
    - the campus hosts one unit and the local dashboard.
- **Simulation label**, always visible: "Simulation: sensor readings are simulated; unit spots are
  proposals. Terrain: FABDEM (30 m). Not a forecast; not for emergency use."
- **Load failure.** If the campus file fails to load, the page shows "This campus didn't load. Check
  your connection." with a **Try again** button, instead of a blank map.

### 3.3 Existing pages

- **Teachers Village:** a pilot site on the new terrain and buildings. It keeps its 8 hand-placed units,
  so the Try reporting tab (BW-H03, Malingap Street) is unchanged.
- **UC Berkeley:** a pilot site, unchanged (USGS 1 m terrain, same data).
- **UP Diliman** becomes the regular campus page `#upd`, with automatic placement.
  - Old links `#diliman`, `#diliman/details`, `#diliman/live` and share tokens `#p.diliman.…` open the
    matching `#upd` page. A share token whose sensor no longer exists falls back to the campus page.
- **Try reporting:** unchanged. It now loads `data/tv.json` on demand, like everything else.
- **Offline.** The service worker (`sw.js`, network-first) also caches each campus file once it has been
  visited, so a visited campus opens offline.

## 4. The 25 campuses

The list is from the PhilDev Starter Pack ("PhilDev partners across the Philippines"). Where a
university has several campuses, the **main campus** is used.

`campuses.csv` holds, for each campus:
- id and short name;
- full name;
- island group;
- type;
- city and province;
- the centre point.

**Centre points.** Each is set from the matching OpenStreetMap campus outline (`amenity=university` or
`college`) in the Philippines extract. The build checks that the centre lies inside that outline, or
within 200 m of it where the campus has no outline. Each point is also checked by eye on the screenshot
sheet (§7.6).

| # | id | Short | Institution (campus used) | Group | Type | City, province |
|---|---|---|---|---|---|---|
| 1 | bsu | BatStateU | Batangas State University (Pablo Borbon main campus) | Luzon | SUC | Batangas City, Batangas |
| 2 | clsu | CLSU | Central Luzon State University (main campus) — see note 1 | Luzon | SUC | Science City of Muñoz, Nueva Ecija |
| 3 | cmu | CMU | City of Malabon University | Luzon | LUC | Malabon, Metro Manila |
| 4 | dlsu | DLSU | De La Salle University (Taft Avenue, Manila) | Luzon | Private | Manila, Metro Manila |
| 5 | feutech | FEU Tech | Far Eastern University – Institute of Technology | Luzon | Private | Manila (Sampaloc), Metro Manila |
| 6 | jru | JRU | José Rizal University (Shaw Boulevard) | Luzon | Private | Mandaluyong, Metro Manila |
| 7 | mapua | Mapúa | Mapúa University (Intramuros main campus) | Luzon | Private | Manila, Metro Manila |
| 8 | plp | PLP | Pamantasan ng Lungsod ng Pasig | Luzon | LUC | Pasig, Metro Manila |
| 9 | ptc | PTC | Pateros Technological College | Luzon | LUC | Pateros, Metro Manila |
| 10 | pup | PUP | Polytechnic University of the Philippines (Sta. Mesa main campus) | Luzon | SUC | Manila, Metro Manila |
| 11 | qcu | QCU | Quezon City University (San Bartolome main campus) | Luzon | LUC | Quezon City, Metro Manila |
| 12 | sti | STI Global City | STI College Global City | Luzon | Private | Taguig, Metro Manila |
| 13 | udm | UdM | Universidad de Manila | Luzon | LUC | Manila, Metro Manila |
| 14 | umak | UMak | University of Makati (West Rembo) — see note 3 | Luzon | LUC | Taguig, Metro Manila |
| 15 | ust | UST | University of Santo Tomas (España) | Luzon | Private | Manila (Sampaloc), Metro Manila |
| 16 | upd | UP Diliman | University of the Philippines Diliman | Luzon | SUC | Quezon City, Metro Manila |
| 17 | uplb | UPLB | University of the Philippines Los Baños | Luzon | SUC | Los Baños, Laguna |
| 18 | ctu | CTU | Cebu Technological University (main campus, M.J. Cuenco Ave) | Visayas | SUC | Cebu City, Cebu |
| 19 | usc | USC | University of San Carlos (Talamban campus) — see note 2 | Visayas | Private | Cebu City, Cebu |
| 20 | llcc | LLCC | Lapu-Lapu City College | Visayas | LUC | Lapu-Lapu City, Cebu |
| 21 | mcc | MCC | Mandaue City College | Visayas | LUC | Mandaue City, Cebu |
| 22 | upc | UP Cebu | University of the Philippines Cebu (Lahug) | Visayas | SUC | Cebu City, Cebu |
| 23 | msuiit | MSU-IIT | Mindanao State University – Iligan Institute of Technology | Mindanao | SUC | Iligan City, Lanao del Norte |
| 24 | ustp | USTP | University of Science and Technology of Southern Philippines (Cagayan de Oro main campus) | Mindanao | SUC | Cagayan de Oro, Misamis Oriental |
| 25 | xu | XU | Xavier University – Ateneo de Cagayan (Corrales Avenue) | Mindanao | Private | Cagayan de Oro, Misamis Oriental |

**Notes for Gregor to confirm:**
1. The Starter Pack says "Central Luzon University". The spec reads this as **Central Luzon State
   University** in Muñoz, Nueva Ecija. If PhilDev means a different school, only its row changes.
2. For USC, the spec uses **Talamban**, the larger campus with the engineering programmes. The
   Downtown campus is the other choice.
3. The University of Makati's West Rembo campus is now administered by Taguig after the Supreme
   Court's Fort Bonifacio ruling. The city column says Taguig; the name stays as the university uses it.
4. **Neighbouring boxes overlap.** Several Manila campuses sit within 3 km of each other (UST, FEU Tech,
   UdM, Mapúa, PUP). Each campus still gets its own box, units and card; the boxes are independent.

**Data coverage checked on 2026-09-27** against the files in Gregor's "Nationwide Update" folder:
- **FABDEM:** tiles exist for all needed 1° cells (N08E124, N10E123, N13E121, N14E120, N14E121, N15E120).
  Manila campuses near 121° E need two tiles merged.
- **NOAH** has 5-, 25- and 100-year maps for every needed province: Metro Manila, Batangas, Nueva Ecija,
  Laguna, Cebu, Lanao del Norte, Misamis Oriental.
  - Some provinces appear twice under different spellings (e.g. "Misamis Oriental" and "MisamisOriental").
    The pipeline merges both and reports it.
  - The known gaps (Tawi-Tawi 100-yr; 8 provinces at 25-yr; 12 at 5-yr) do not affect these 25 campuses.
    The card still handles a gap as "not available".

## 5. Data pipeline

### 5.1 On Gregor's PC

Nothing runs until the plan is approved. When it runs, it only **reads** the downloads in "Nationwide
Update" and **writes new files** into `bahawatch-data/campuses/`. Existing files are never changed or deleted.

- **Where it runs:** the scripts run in the desktop app's workspace on the PC (3.9 GB memory, 2 cores).
- **Packages:** they need `rasterio`, `duckdb`, `pyarrow`, `osmium` (pyosmium), `shapely` and `pyproj`,
  installed with pip into that workspace, not into Windows.
- **Order:** each big dataset is read **once for all 25 boxes**:

| Step | Input | Output per campus (`campuses/<id>/`) |
|---|---|---|
| 1. Boxes | `campuses.csv` | 3 km box (the centre ± 1.5 km, as longitude/latitude) |
| 2. Terrain | FABDEM tiles (merged where a box crosses tiles) | `dem.tif`, the box plus a 300 m margin |
| 3. Buildings | `PHL_buildings.parquet` (5 GB), one DuckDB scan with the 25 boxes as filters | `buildings.geojson` (footprints) |
| 4. Streets, creeks, campus outline | `philippines-260925.osm.pbf`, one pyosmium pass | `osm.geojson` |
| 5. Hazard | NOAH zips, only the provinces needed | `noah_5.geojson`, `noah_25.geojson`, `noah_100.geojson` (clipped) |
| 6. Barangays | `phl_admin4.shp` inside `phl_admin_boundaries.shp.zip` | `barangays.geojson` (name, pcode, municipality) |
| 7. Country outline | admin boundaries (level 0 or dissolved level 1) | `ph_outline.geojson`, simplified |

- **Log:** each step writes a line to `campuses/pipeline_log.txt`: input file, size, date, feature counts
  per campus, time taken.
- **Memory:** the buildings scan runs with DuckDB's memory limit set to 2 GB, so the 5 GB file streams
  instead of loading whole.
- **Transfer:** the per-campus folders are a few MB each. They are staged into the container, where the
  page data is built.
- **Scripts** live in the repo under `pipeline/`, so the run can be repeated.

### 5.2 In the container

- **Script:** `build_data.py` gains a campus mode, `SITE=<id>`, that reads `campuses/<id>/` and writes
  `data/<id>.json`.
- **Pilot sites:** Teachers Village is rebuilt the same way from its own box, keeping its hand-placed
  sensor list. Berkeley's build is unchanged and only moves to `data/berkeley.json`.
- **Page build:** `build_html.py` no longer embeds site data. It embeds:
  - the campus list;
  - the country outline;
  - the rule;
  - the strings.
- **Places:** `tools/build_places.py` covers all 27 sites (25 campuses and 2 pilots). Place ids stay
  `<site>:s:<sensor>` and `<site>:b:<pcode>`.

## 6. The model

### 6.1 Terrain

- **Source:** FABDEM V1-2, 30 m, with buildings and forest already removed.
- **Grid:** resampled with bilinear interpolation to the page grid, 200 × 200 cells over the 3 km box
  (≈ 15 m cells).
- **Filtering:** the old rooftop-removal step (minimum filter) is **dropped** for FABDEM sites. Light
  smoothing stays (Gaussian, σ = 1 cell).
- **Streets** are still carved 0.5 m below the local minimum, so water runs along them.
- **Sea:**
  - cells that are sea in FABDEM (no data, or ≤ 0 m and connected to the box edge) are marked **sea**;
  - sea is drawn as water-body colour, never counted as flood, and left out of the NOAH land share.
- **Berkeley** keeps USGS 1 m and its current settings.

### 6.2 Buildings as obstacles

- **Built fraction:** footprints are rasterised to the share of each cell covered by buildings, stored as
  0–100 per cell and packed like the other grids.
- **Blocking:** in the sensor-seeded terrain fill, a cell with **≥ 75 % built** is **blocked**: water does
  not enter it and spreads around it. Street and creek cells are never blocked.
- **Flood count:** "Buildings in flooded cells" counts real footprints (centroid in a flooded cell).
- **Drawing:** buildings stay drawn as small dots, as now.
- **Size:** if a campus exceeds its size budget (§7.1), dots are thinned evenly (every n-th). The count
  and the model still use all footprints, and the footnote says "some buildings drawn as a sample".

### 6.3 Automatic unit placement (8 per campus)

**Candidates:** building footprints whose centroid is within 25 m of a street. A household unit goes on
a house by a road.

**Score for each candidate** (higher is better), each part scaled 0–1:

| Part | Weight | Meaning |
|---|---|---|
| Lowness | 0.5 | 1 − (percentile of its ground height among cells within 300 m) |
| NOAH hazard | 0.3 | 1.0 in a 5-yr zone, 0.66 in 25-yr only, 0.33 in 100-yr only, 0 outside |
| Near water | 0.2 | 1 at a creek or drain, falling to 0 at 300 m |

Where NOAH is missing for a return period, that tier is skipped and the rest still count.

**Picking:**
1. The first unit is the best-scoring candidate **inside the campus outline**. If the campus has no
   outline, it is the best within 150 m of the centre point.
2. The next 7 are chosen best-first, each at least **300 m** from every unit already chosen.
3. Ties are broken by footprint id, so the result is the same on every run.
4. If fewer than 8 fit at 300 m, the spacing drops to 250 m, then 200 m, and the log says so.

**Names and ids:**
- Each unit is named by its nearest named street and its barangay: "near Katipunan Ave · Loyola Heights".
- Ids are `BW-<SHORT>-01`…`08`, with `<SHORT>` the id in capitals (e.g. `BW-UPD-01`). Unit 01 is always
  the one on campus.

### 6.4 Storm response (simulated readings)

- **Method:** unchanged. Each unit's simulated storm follows its NOAH class and how low it sits against
  the site's reference height.
- **Reference height** (`g_ref`): the median of the units' ground heights for every site.
  - Teachers Village drops its fixed 56.0 m, because FABDEM heights differ from Copernicus.
- **Rule and scenarios:** the answer rule (`shared/verdict.js`) and the storm scenarios are unchanged.

### 6.5 Honest limits

These are stated in the campus footnote, the card and the README:
- FABDEM is 30 m data. Its height error in dense cities is typically 1–3 m.
- The fill is a terrain-and-obstacle spread from measured points, not a hydraulic model.
- Unit spots are proposals from open data, not surveyed.

The LiPAD 1 m DTM replaces FABDEM wherever it is granted.

## 7. Testing and checks

### 7.1 Pipeline and data

- **Unit tests** (in `pipeline/tests/`, on small fixtures made from real clips) for:
  - the box maths;
  - the tile merge;
  - the building filter;
  - the OSM filter;
  - the NOAH province-name merge;
  - the barangay clip.
- **Same inputs give byte-identical outputs** (run twice, compare).
- **Checks on every campus file.** The build stops on any failure:
  - The box centre is within 50 m of the `campuses.csv` point.
  - Terrain has no gaps, and heights are plausible for the place: land cells between −5 m and 3,000 m.
  - 8 units:
    - each lies inside a real footprint;
    - all pairs are ≥ 300 m apart, or the logged fallback spacing;
    - exactly one is inside the campus outline.
  - Every unit has a street name and a barangay.
  - At least one barangay is covered.
  - NOAH shares are in 0–100 %, or "not available".
  - `data/<id>.json` is ≤ 450 KB.
- **Campus list:** 25 rows, no duplicate ids, ids lowercase letters only. Each row has a group, type, city
  and province. Groups count 17 / 5 / 3.

### 7.2 Model

- **Obstacles:** on a small made-up terrain, a wall of fully built cells keeps water on one side; the same
  wall with a street cell through it lets water through.
- **Placement:** on a made-up map with known low spots and hazard zones, placement:
  - picks the lowest, high-hazard buildings;
  - respects the spacing;
  - puts unit 01 on campus;
  - is identical when run twice.
- **Teachers Village:** still 8 hand-placed units. The Try reporting suite (`test_try.js`, 45 checks)
  passes unchanged.
- **Rule:** the 20 rule tests and the worker tests are unchanged and green.

### 7.3 Page (Playwright, new `test_national.js`)

- **Opening map:**
  - A plain link opens the national map: 25 pins, each with a text label, and a legend in words.
  - The list is grouped 17 / 5 / 3.
  - Search finds "Xavier" → XU, "UPLB" → UPLB, "Iligan" → MSU-IIT, and says how many matched.
- **Campus pages:**
  - Choosing a campus fetches only `data/<id>.json`, and the header reads "‹ All campuses · [campus name]".
  - "‹ All campuses" and the browser Back button both return to the national map.
  - `#xu` opens XU directly.
  - Each card shows 8 units, the barangay count and three NOAH lines, with the simulation label present.
- **Old links:** `#diliman`, `#diliman/details` and `#p.diliman.b.<pcode>` land on the matching `#upd` page.
- **Load failure:** a failed fetch shows the message and **Try again**; retrying after the fault clears
  loads the campus.
- **Pilot sites:** Teachers Village and Berkeley open from Pilot sites; Try reporting still works.

### 7.4 Accessibility

- **Keyboard:** the national map, the list and the picker work by keyboard alone. Focus is visible.
- **Map description:** the national map has the text description in §3.1.
- **Search:** results are announced once through the existing announcer.
- **Contrast:** text contrast ≥ 4.5:1 and pin contrast ≥ 3:1 against the map, in both themes.
- **Pins** differ by shape as well as colour. A colour-blindness simulation of the national map is checked.
- **Phone width:** at 390 px there is no sideways scroll, and every button is ≥ 48 px.
- **Languages:** new strings exist in all six languages (English strings placed in the others and marked
  for native review, as before).

### 7.5 Speed and size

- The opening page, with no campus data, is ≤ 250 KB gzipped.
- Each campus file is ≤ 450 KB before compression.
- A campus appears within 3 s on the test browser's throttled "Fast 3G" profile.

### 7.6 Existing suites and screenshots

- **Existing suites:** all stay green, with these planned changes:
  - `test_build`'s "TV byte-identical" check becomes the same-inputs check;
  - Diliman numbers in `test_sites` move to the `upd` campus;
  - the tab tests follow the new picker and the Pilot sites group;
  - `test_public` expects the national map at a plain link.
- **Screenshot sheet:** before hand-over, 5 campuses are captured, one per island group plus the smallest
  and largest file. They are checked by eye: water follows low ground and goes around buildings, and the
  centre point sits on the campus. The sheet goes in the build report PDF.

## 8. Delivery

1. **Container work:** code, tests and docs on a branch.
2. **PC pipeline:** after plan approval, run on Gregor's PC as in §5.1, with each step's log line reported
   back.
3. **Build and review:** build the 27 data files, the whole-branch review, and the build report PDF with
   the screenshot sheet.
4. **Private demo artifact:** updated, with the campus files published alongside the page.
5. **Merge:** after Gregor's review, merge to `main`; Gregor pulls the bundle and pushes to GitHub Pages.

## 9. Out of scope

- A server, live reports, the Cloudflare setup, and the two live-only bugs (parked).
- Real sensor readings.
- Campuses beyond the 25, or more than one campus per university.
- LiPAD 1 m terrain (when granted).
- Native-speaker review of the new strings (listed for later, as before).
- A PDF or print version of the partnership card.
