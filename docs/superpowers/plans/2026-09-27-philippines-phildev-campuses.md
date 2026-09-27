# Nationwide PhilDev prototype (25 partner campuses) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn BahaWatch into a national prototype: a map and list of the 25 PhilDev partner campuses, each with the "Babaha ba?" view on FABDEM terrain, buildings that block water, 8 automatically placed units and a partnership card. Each campus loads on demand.

**Architecture:**
1. A small Python pipeline (`pipeline/`) runs once on Gregor's PC. It cuts the national datasets (FABDEM tiles, the 5 GB buildings file, the OSM extract, NOAH zips, admin boundaries) down to one 3 km box per campus.
2. In the container:
   - `build_data.py` gains a campus mode that turns those cuts into `data/<id>.json`, with helpers in `model/`;
   - `tools/build_places.py` adds each site's places into its data file.
3. The page (`template.html`) stops embedding site data. It embeds the campus list and the country outline, opens on a national map, and fetches one site file when a campus is chosen.
4. The flood fill moves into `shared/flood.js` (pure, tested in Node), with blocked cells.

**Tech stack:**
- Pipeline: Python 3.10+ (pyosmium 4, DuckDB, pyarrow, rasterio, shapely 2, pyshp).
- Model: numpy / scipy.
- Page: vanilla JS in one HTML file.
- Tests: Playwright (Chromium at `/opt/pw-browsers/chromium`), `node --test`, Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-09-27-philippines-phildev-campuses-design.md` (approved 2026-09-27). The earlier specs `2026-09-26-babaha-ba-reports-no-accounts-design.md` and `2026-09-26-try-reporting-tab-design.md` still hold for everything this one doesn't change.

## Global Constraints

**Repo and git**
- Repo: `/home/claude/work`, branch `phildev-campuses`.
- Commits are authored by `Gregor <gregor500man.gerp@gmail.com>` (already the repo's git config). Every commit gets a second `-m` with exactly:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG` (two lines).

**Gregor's PC**
- It runs only what Task 5 says, only after plan approval.
- It **reads** the files in `Nationwide Update` and **writes only under** `bahawatch-data/campuses/`. Existing files are never changed or deleted.
- Pipeline code must run on Python **3.10** (the PC's version).

**Boxes and grid**
- Campus box: the centre ± **1500 m**, as a square.
- Model grid: **200 × 200** cells over it. World canvas: **1200 × 1200**.
- Cut margin: **300 m**.

**Model constants**
- Blocking: a cell with **≥ 75 %** of its area built is blocked. Street and creek cells are never blocked. Sea is always blocked.
- Placement score: `0.5·lowness + 0.3·hazard + 0.2·near-water`.
  - Lowness: percentile within **300 m**.
  - Hazard: 1.0 in a 5-yr zone, 0.66 in 25-yr only, 0.33 in 100-yr only, 0 outside.
  - Near water: linear to 0 at **300 m**.
- Units: **8**. Candidates must lie within **25 m** of a street. Spacing **300 m**, falling back to 250 m and then 200 m.
- Unit 01 is **on campus**. Without an outline, it is within **150 m** of the centre.
- Unit ids: `BW-<ID IN CAPITALS>-01..08`.

**Terrain**
- FABDEM sites: no minimum filter, Gaussian **σ = 1** cell, street carve **0.5 m**.
- Berkeley is unchanged (USGS 1 m).

**Sizes**
- Each `data/<id>.json` is ≤ **450,000 bytes** after places are added.
- `build_data` leaves room for places by aiming at **400,000 bytes**.
- The opening page is ≤ **250 KB gzipped**.
- A campus appears in ≤ **3 s** on Fast 3G.

**Ids and links**
- Site ids are lowercase letters only (`^[a-z]+$`).
- Links:
  - `#ph`, or a plain link → the national map;
  - `#<id>`, `#<id>/details`, `#<id>/live`;
  - `#p.<id>.<s|b>.<code>`;
  - legacy `diliman` → `upd`.

**Pin colours**

| Pin | Light theme | Dark theme (not in the spec: chosen for ≥ 3:1 on the dark map and to stay apart under protan, deutan and tritan simulation) |
|---|---|---|
| SUC circle | #385F96 | #7FA8E0 |
| LUC square | #CF5921 | #F08A4B |
| Private triangle | #800000 | #F2F2F2 |

**Accessibility**
- Text contrast ≥ **4.5:1** and pin contrast ≥ **3:1**, in both themes.
- Tap targets ≥ **48 px** in the national view.
- No sideways scroll at **390 px**.

**Languages**
- New strings exist for `en, fil, ceb, ilo, hil, pam`.
- Non-English entries are English copies marked `_review:true`, for native review later.

**Unchanged**
- `shared/verdict.js`, the Worker's logic, the Try tab's behaviour (`#try`, BW-H03), and Berkeley's data.

**Deliverables** (specs, plans, reports) are also delivered as PDF via `python3 tools/md_to_pdf.py <md> <pdf>`.

## Review Focus

These are the five things a person will hit that no test would otherwise touch. Each has a test in the owning task.

1. **Quick double choice.** Picking campus A, then campus B before A has loaded, must end on B, never A. The same goes for choosing Try reporting while Teachers Village is still loading. Test in Task 8 (`test_routes.js`: "latest choice wins", "not yet in the Try tab").
2. **Search without accents or in lowercase.** "mapua", "banos" and "xavier" must find Mapúa, UPLB (Los Baños) and XU. Test in Task 10 (`test_national.js`).
3. **Old saved links and home-screen relaunch.** A saved `bw-last-hash` of `#diliman`, and `?source=pwa`, must land on the UP Diliman campus page, not a blank page or Teachers Village. The same goes for an old `#p.diliman.b.<pcode>` share link. Test in Task 8 (`test_routes.js`).
4. **Offline revisit.** When the network is down, the service worker must never answer a data-file request with the HTML page. That would break JSON parsing and show a broken map instead of the retry message. Test in Task 11 (`sw.test.js`).
5. **Coastal boxes.** Sea cells must not flood, must not hold units, and must not count in the NOAH shares. Tests:
   - Task 6: `sea_mask`, `lowness` ignores sea, the card counts land only;
   - Task 7: `check_site_data.py` "sits on the sea";
   - Task 9: `test_obstacles.js` "no water in blocked or sea cells".

---

## File structure

| Path | Status | Responsibility |
|---|---|---|
| `pipeline/campuses.csv` | new | The 25 campuses: identity, OSM name pattern, search hint, resolved OSM ref and centre |
| `pipeline/common.py` | new | Box maths, campus list reader, constants shared by PC and container |
| `pipeline/osm_extract.py` | new | pyosmium passes: campus outlines; streets and creeks per box |
| `pipeline/cut.py` | new | FABDEM clip/merge, buildings scan (DuckDB), NOAH clip, barangays, country outline |
| `pipeline/run_pc.py` | new | Command line for the PC (`find`, `cut`): safe writes, resume, log |
| `pipeline/requirements.txt` | new | pip packages for the PC |
| `pipeline/tests/` | new | Fixture-based unit tests for the four modules above |
| `model/grids.py` | new | RLE, built fraction, sea mask, blocking, distance grids, polygon rasterising |
| `model/placement.py` | new | Lowness, scores, greedy spacing pick |
| `model/campus.py` | new | Auto units, unit names and barangays, partnership card |
| `model/tests/` | new | Unit tests for `model/` |
| `sites.py` | modify | Adds FABDEM attribution, campus site configs, and Teachers Village on FABDEM; removes the `diliman` entry |
| `model/tests/fixture_campus.py`, `test_build.sh` | new / modify | A made-up campus for build tests; same-inputs and data checks |
| `build_data.py` | modify | Writes `data/<id>.json`. Adds campus mode, sea, built fraction, block/bc grids, geojson NOAH, dot thinning |
| `tools/build_places.py` | modify | Covers all `data/*.json`, puts places into each file, respects blocked cells, fast barangay cells |
| `tools/check_site_data.py` | new | The per-campus checks of spec §7.1 |
| `test_build.sh` | modify | Same-inputs check plus the data checks (replaces "TV byte-identical") |
| `shared/flood.js`, `shared/flood.test.js` | new | The flood fill as a pure function with obstacles |
| `build_html.py` | modify | Embeds campuses, outline and flood.js. No site data and no places embedded |
| `template.html` | modify | On-demand loading, router, national view, campus bar, card, sea, counts, load failure |
| `sw.js`, `sw.test.js` | modify / new | HTML fallback only for page navigations; cache v2 |
| `tools/test_server.js`, `test_pages.sh` | new | gzip static server for page tests; runner |
| `test_routes.js`, `test_obstacles.js`, `test_national.js`, `test_campus.js`, `test_a11y.js` | new | Routing and old links; obstacles and sea; national map; campus pages; accessibility, speed and size |
| existing `test_*.js` | modify | http:// URLs, `#tv` where they meant Teachers Village, `upd` instead of `diliman` |
| `data/*.json` | new | 27 site files and `data/ph_outline.json`. Replace `data.json`, `data_diliman.json` and `data_berkeley.json` |
| `README.md`, `DATA-LICENSE.md` | modify | Pipeline runbook, new sources and licences |

Big inputs are staged into `inputs/campuses/<id>/` in the container. That folder is git-ignored and never committed.

---
### Task 1: Campus list and pipeline basics

**Files:**
- Create: `pipeline/campuses.csv`, `pipeline/common.py`, `pipeline/requirements.txt`, `pipeline/__init__.py` (empty), `pipeline/tests/__init__.py` (empty), `pipeline/tests/test_common.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `common.read_campuses(path=CAMPUSES_CSV) -> list[dict]`. Keys are the CSV columns; `hint_lat` and `hint_lon` are floats; `lat` and `lon` are float or None.
  - `common.box_around(lat, lon, half_m=1500.0) -> (lon0, lat0, lon1, lat1)`
  - `common.grow(bbox, m) -> bbox`
  - `common.overlaps(a, b) -> bool`
  - `common.boxes(rows) -> {id: bbox}`: campuses that have a centre, plus `PILOT_BOXES`.
  - `common.m_per_deg_lon(lat)`
  - Constants: `M_PER_DEG_LAT=110640.0`, `BOX_HALF_M`, `MARGIN_M`, `GRID=200`, `WORLD=1200`, `GROUPS`, `TYPES`, `ID_RE`, `PILOT_BOXES={"tv": (121.0470,14.6300,121.0755,14.6545)}`.

- [ ] **Step 1: Write the campus list**

`pipeline/campuses.csv`:
- `hint_lat`/`hint_lon` are search hints only (±5 km). The real centre comes from the OSM outline in Task 5.
- `osm_ref`, `lat` and `lon` stay empty until Task 5.
- `osm_pattern` is a case-insensitive regex matched against OSM `name`, `name:en`, `official_name`, `alt_name`, `short_name` and `old_name`. Patterns contain no commas (no `{m,n}` repeats), so the CSV needs no quoting.

```csv
id,short,name,campus,group,type,city,province,osm_pattern,hint_lat,hint_lon,osm_ref,lat,lon
bsu,BatStateU,Batangas State University,Pablo Borbon main campus,Luzon,SUC,Batangas City,Batangas,Batangas State University,13.7565,121.0583,,,
clsu,CLSU,Central Luzon State University,Main campus,Luzon,SUC,Science City of Muñoz,Nueva Ecija,Central Luzon State University,15.7370,120.9300,,,
cmu,CMU,City of Malabon University,Main campus,Luzon,LUC,Malabon,Metro Manila,City of Malabon University,14.6630,120.9560,,,
dlsu,DLSU,De La Salle University,Taft Avenue,Luzon,Private,Manila,Metro Manila,De La Salle University,14.5646,120.9932,,,
feutech,FEU Tech,Far Eastern University – Institute of Technology,P. Paredes St,Luzon,Private,Manila (Sampaloc),Metro Manila,FEU.?.?.?(Institute of Technology|Tech)|Far Eastern University.*(Technology|Tech),14.6040,120.9868,,,
jru,JRU,José Rizal University,Shaw Boulevard,Luzon,Private,Mandaluyong,Metro Manila,Jos[eé] Rizal University,14.5810,121.0360,,,
mapua,Mapúa,Mapúa University,Intramuros main campus,Luzon,Private,Manila,Metro Manila,Map[uú]a,14.5906,120.9780,,,
plp,PLP,Pamantasan ng Lungsod ng Pasig,Main campus,Luzon,LUC,Pasig,Metro Manila,Pamantasan ng Lungsod ng Pasig,14.5610,121.0780,,,
ptc,PTC,Pateros Technological College,Main campus,Luzon,LUC,Pateros,Metro Manila,Pateros Technological College,14.5445,121.0685,,,
pup,PUP,Polytechnic University of the Philippines,Sta. Mesa main campus,Luzon,SUC,Manila,Metro Manila,Polytechnic University of the Philippines,14.5978,121.0107,,,
qcu,QCU,Quezon City University,San Bartolome main campus,Luzon,LUC,Quezon City,Metro Manila,Quezon City University,14.7005,121.0335,,,
sti,STI Global City,STI College Global City,Global City,Luzon,Private,Taguig,Metro Manila,STI.*Global City,14.5500,121.0500,,,
udm,UdM,Universidad de Manila,Main campus,Luzon,LUC,Manila,Metro Manila,Universidad de Manila,14.5905,120.9815,,,
umak,UMak,University of Makati,West Rembo,Luzon,LUC,Taguig,Metro Manila,University of Makati,14.5630,121.0560,,,
ust,UST,University of Santo Tomas,España,Luzon,Private,Manila (Sampaloc),Metro Manila,University of Santo Tomas,14.6096,120.9894,,,
upd,UP Diliman,University of the Philippines Diliman,Diliman,Luzon,SUC,Quezon City,Metro Manila,University of the Philippines.?.?.?Diliman|UP Diliman,14.6537,121.0685,,,
uplb,UPLB,University of the Philippines Los Baños,Los Baños,Luzon,SUC,Los Baños,Laguna,University of the Philippines.?.?.?Los Ba[nñ]os|UPLB,14.1650,121.2430,,,
ctu,CTU,Cebu Technological University,Main campus (M.J. Cuenco Ave),Visayas,SUC,Cebu City,Cebu,Cebu Technological University,10.2970,123.9060,,,
usc,USC,University of San Carlos,Talamban campus,Visayas,Private,Cebu City,Cebu,University of San Carlos,10.3530,123.9130,,,
llcc,LLCC,Lapu-Lapu City College,Main campus,Visayas,LUC,Lapu-Lapu City,Cebu,Lapu-?Lapu City College,10.3100,123.9500,,,
mcc,MCC,Mandaue City College,Main campus,Visayas,LUC,Mandaue City,Cebu,Mandaue City College,10.3300,123.9400,,,
upc,UP Cebu,University of the Philippines Cebu,Lahug,Visayas,SUC,Cebu City,Cebu,University of the Philippines.?.?.?Cebu|UP Cebu,10.3225,123.8990,,,
msuiit,MSU-IIT,Mindanao State University – Iligan Institute of Technology,Iligan,Mindanao,SUC,Iligan City,Lanao del Norte,Iligan Institute of Technology|MSU.?IIT,8.2410,124.2440,,,
ustp,USTP,University of Science and Technology of Southern Philippines,Cagayan de Oro main campus,Mindanao,SUC,Cagayan de Oro,Misamis Oriental,University of Science and Technology of Southern Philippines|USTP,8.4855,124.6560,,,
xu,XU,Xavier University – Ateneo de Cagayan,Corrales Avenue,Mindanao,Private,Cagayan de Oro,Misamis Oriental,Xavier University,8.4770,124.6450,,,
```

- [ ] **Step 2: Write the failing tests**

`pipeline/tests/test_common.py`:

```python
import math, os, re, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C

class CampusList(unittest.TestCase):
    rows = C.read_campuses()
    def test_twenty_five_unique_ids(self):
        ids = [r["id"] for r in self.rows]
        self.assertEqual(len(ids), 25)
        self.assertEqual(len(set(ids)), 25)
        for i in ids: self.assertRegex(i, C.ID_RE)
    def test_groups_17_5_3(self):
        n = {g: sum(r["group"] == g for r in self.rows) for g in C.GROUPS}
        self.assertEqual(n, {"Luzon": 17, "Visayas": 5, "Mindanao": 3})
    def test_fields(self):
        for r in self.rows:
            self.assertIn(r["type"], C.TYPES, r["id"])
            for k in ("short", "name", "campus", "city", "province"): self.assertTrue(r[k].strip(), (r["id"], k))
            re.compile(r["osm_pattern"], re.I)
            self.assertTrue(4.5 <= r["hint_lat"] <= 21.5 and 116 <= r["hint_lon"] <= 127, r["id"])

class Boxes(unittest.TestCase):
    def test_box_is_3km_square(self):
        for lat in (14.6537, 8.241, 15.737):
            lon0, lat0, lon1, lat1 = C.box_around(lat, 121.0)
            w = (lon1 - lon0) * C.m_per_deg_lon(lat); h = (lat1 - lat0) * C.M_PER_DEG_LAT
            self.assertAlmostEqual(w, 3000, delta=1.0); self.assertAlmostEqual(h, 3000, delta=1.0)
    def test_grow_and_overlap(self):
        b = C.box_around(14.65, 121.07); g = C.grow(b, 300)
        self.assertAlmostEqual((g[2] - g[0]) * C.m_per_deg_lon(14.65), 3600, delta=1.0)
        self.assertTrue(C.overlaps(b, g))
        far = C.box_around(10.3, 123.9)
        self.assertFalse(C.overlaps(b, far))
    def test_boxes_include_pilots_and_skip_unresolved(self):
        rows = [dict(id="aa", lat=None, lon=None), dict(id="bb", lat=14.6, lon=121.0)]
        bx = C.boxes(rows)
        self.assertEqual(set(bx), {"bb", "tv"})

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run them and watch them fail**

Run: `cd /home/claude/work/pipeline && python3 -m unittest tests.test_common -v 2>&1 | tail -3`
Expected: `ModuleNotFoundError: No module named 'common'`.

- [ ] **Step 4: Write `pipeline/common.py`**

```python
"""Shared definitions for the PhilDev campus pipeline. Runs on Gregor's PC (Python 3.10) and in the container.
Standard library only."""
import csv, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
CAMPUSES_CSV = os.path.join(HERE, "campuses.csv")
BOX_HALF_M = 1500.0          # a 3 km box centred on the campus (spec §3.2, N2)
MARGIN_M = 300.0             # extra ring cut around each box, so edge cells have neighbours
GRID = 200                   # model cells per side (≈15 m)
WORLD = 1200                 # page world units per side
M_PER_DEG_LAT = 110640.0     # the same constants build_data.py uses
GROUPS = ("Luzon", "Visayas", "Mindanao")
TYPES = ("SUC", "LUC", "Private")
ID_RE = re.compile(r"^[a-z]+$")   # share tokens #p.<id>.… accept lowercase letters only
PILOT_BOXES = {"tv": (121.0470, 14.6300, 121.0755, 14.6545)}   # Teachers Village keeps its own frame


def m_per_deg_lon(lat):
    return 111320.0 * math.cos(math.radians(lat))


def read_campuses(path=CAMPUSES_CSV):
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["hint_lat"] = float(r["hint_lat"]); r["hint_lon"] = float(r["hint_lon"])
        r["lat"] = float(r["lat"]) if r.get("lat") else None
        r["lon"] = float(r["lon"]) if r.get("lon") else None
    return rows


def box_around(lat, lon, half_m=BOX_HALF_M):
    """(lon0, lat0, lon1, lat1) of the square reaching half_m from (lat, lon) on each side."""
    dx = half_m / m_per_deg_lon(lat); dy = half_m / M_PER_DEG_LAT
    return (round(lon - dx, 6), round(lat - dy, 6), round(lon + dx, 6), round(lat + dy, 6))


def grow(bbox, m):
    lon0, lat0, lon1, lat1 = bbox; lat = (lat0 + lat1) / 2
    dx = m / m_per_deg_lon(lat); dy = m / M_PER_DEG_LAT
    return (lon0 - dx, lat0 - dy, lon1 + dx, lat1 + dy)


def overlaps(a, b):
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def boxes(rows):
    """Final model boxes: every campus that has a centre, plus the pilot boxes."""
    out = {r["id"]: box_around(r["lat"], r["lon"]) for r in rows if r.get("lat") is not None}
    out.update(PILOT_BOXES)
    return out
```

Create empty `pipeline/__init__.py` and `pipeline/tests/__init__.py`.

`pipeline/requirements.txt`:

```
duckdb>=1.1
pyarrow>=15
osmium>=4.0
shapely>=2.0
rasterio>=1.3
pyshp>=2.3
numpy>=1.24
```

Append to `.gitignore`:

```
# per-campus cuts staged from Gregor's PC (hundreds of MB) — rebuilt with pipeline/run_pc.py, see README §2.5
inputs/campuses/
# live-mode page builds made by the tests (served over http with the data files)
_bw_*.html
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `cd /home/claude/work/pipeline && python3 -m unittest tests.test_common -v 2>&1 | tail -3`
Expected: `Ran 6 tests … OK`.

- [ ] **Step 6: Commit**

```bash
cd /home/claude/work && git add pipeline .gitignore && git commit -q -m "Pipeline: the 25 PhilDev campuses and shared box maths" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 2: OpenStreetMap passes

**Files:**
- Create: `pipeline/osm_extract.py`, `pipeline/tests/fixtures.py`, `pipeline/tests/test_osm.py`

**Interfaces:**
- Consumes: `common.grow`, `common.overlaps`, `common.MARGIN_M`, `common.m_per_deg_lon`, `common.M_PER_DEG_LAT`.
- Produces:
  - `osm_extract.find_campus_areas(pbf, campuses, radius_m=10000.0, index=None) -> {id: [candidate]}`. A candidate is `{"ref": "w123"|"r45"|"n6", "name", "amenity", "dist_m", "area_m2", "rep": [lon, lat], "geometry": GeoJSON}`, sorted by `(dist_m, ref)`.
  - `osm_extract.extract_ways(pbf, boxes, index=None, margin_m=MARGIN_M) -> {box id: [GeoJSON Feature LineString]}`. Properties are only `highway`, `waterway` and `name`.
  - `fixtures.write_osm(path)`: a tiny .osm XML used by the tests here and in Task 4.

- [ ] **Step 1: Write the fixture and failing tests**

`pipeline/tests/fixtures.py` (this file grows in Tasks 3 and 4):

```python
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
 <way id="10" version="1"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
  <tag k="amenity" v="university"/><tag k="name" v="University of the Philippines Diliman"/></way>
 <way id="20" version="1"><nd ref="5"/><nd ref="6"/><tag k="highway" v="primary"/><tag k="name" v="C.P. Garcia Avenue"/><tag k="surface" v="asphalt"/></way>
 <way id="21" version="1"><nd ref="7"/><nd ref="8"/><tag k="waterway" v="stream"/><tag k="name" v="Pansol Creek"/></way>
 <way id="22" version="1"><nd ref="7"/><nd ref="8"/><tag k="highway" v="motorway"/></way>
 <way id="23" version="1"><nd ref="11"/><nd ref="12"/><tag k="highway" v="residential"/></way>
</osm>
"""

def write_osm(path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(OSM)
    return path
```

`pipeline/tests/test_osm.py`:

```python
import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C, osm_extract as X
from tests.fixtures import write_osm

CAMPUSES = [dict(id="upd", osm_pattern="University of the Philippines.{0,3}Diliman|UP Diliman", hint_lat=14.6537, hint_lon=121.0685),
            dict(id="mcc", osm_pattern="Mandaue City College", hint_lat=10.33, hint_lon=123.94),
            dict(id="xu", osm_pattern="Xavier University", hint_lat=8.477, hint_lon=124.645)]

class Osm(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(); cls.pbf = write_osm(os.path.join(cls.tmp, "t.osm"))
    def test_finds_way_area_and_point(self):
        got = X.find_campus_areas(self.pbf, CAMPUSES)
        self.assertEqual([c["ref"] for c in got["upd"]], ["w10"])
        a = got["upd"][0]
        self.assertEqual(a["geometry"]["type"], "MultiPolygon")
        self.assertGreater(a["area_m2"], 1.0e6)            # 0.01° × 0.01° ≈ 1.2 km²
        self.assertTrue(121.06 < a["rep"][0] < 121.07 and 14.65 < a["rep"][1] < 14.66)
        self.assertEqual([c["ref"] for c in got["mcc"]], ["n9"])
        self.assertEqual(got["mcc"][0]["area_m2"], 0)
        self.assertEqual(got["xu"], [])
    def test_radius_limits_matches(self):
        got = X.find_campus_areas(self.pbf, [dict(CAMPUSES[1], hint_lat=11.5, hint_lon=124.5)])
        self.assertEqual(got["mcc"], [])
    def test_ways_per_box(self):
        b1 = C.box_around(14.655, 121.065); b2 = C.box_around(10.301, 123.901); b3 = C.box_around(8.0, 125.0)
        got = X.extract_ways(self.pbf, {"a": b1, "b": b2, "c": b3})
        kinds = sorted((f["properties"].get("highway") or f["properties"].get("waterway")) for f in got["a"])
        self.assertEqual(kinds, ["primary", "stream"])       # the motorway is not a street people live on
        self.assertEqual(got["a"][0]["properties"], {"highway": "primary", "name": "C.P. Garcia Avenue"})
        self.assertEqual(len(got["b"]), 1); self.assertEqual(got["c"], [])
        self.assertEqual(got["a"][0]["geometry"]["coordinates"][0], [121.05, 14.655])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run and watch them fail**

Run: `cd /home/claude/work/pipeline && python3 -m unittest tests.test_osm -v 2>&1 | tail -3`
Expected: `ModuleNotFoundError: No module named 'osm_extract'`.

If `import osmium` fails in the container, install the packages first: `pip install --break-system-packages -q osmium shapely duckdb pyarrow`.

- [ ] **Step 3: Write `pipeline/osm_extract.py`**

```python
"""OpenStreetMap passes over the Philippines .osm.pbf with pyosmium 4. Each function reads the file once.
find_campus_areas(): university/college outlines (or points) whose names match a campus pattern
extract_ways():      streets and creeks touching each box, as GeoJSON LineStrings"""
import json, math, re
import osmium
from shapely.geometry import shape
from common import grow, overlaps, MARGIN_M, m_per_deg_lon, M_PER_DEG_LAT

AMENITIES = {"university", "college"}
NAME_KEYS = ("name", "name:en", "official_name", "alt_name", "short_name", "old_name")
HIGHWAYS = {"trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link",
            "residential", "unclassified", "busway", "service", "living_street", "pedestrian", "footway", "path", "cycleway"}
WATERWAYS = {"river", "stream", "drain", "canal", "ditch"}


def _dist_m(lat1, lon1, lat2, lon2):
    return math.hypot((lon2 - lon1) * m_per_deg_lon((lat1 + lat2) / 2), (lat2 - lat1) * M_PER_DEG_LAT)


def _rep_and_area(geom):
    g = shape(geom)
    p = g.representative_point()
    lat = p.y
    area = 0.0 if geom["type"] == "Point" else g.area * m_per_deg_lon(lat) * M_PER_DEG_LAT
    return [round(p.x, 7), round(p.y, 7)], area


def find_campus_areas(pbf, campuses, radius_m=10000.0, index=None):
    pats = {c["id"]: re.compile(c["osm_pattern"], re.I) for c in campuses}
    hint = {c["id"]: (c["hint_lat"], c["hint_lon"]) for c in campuses}
    out = {c["id"]: [] for c in campuses}
    gj = osmium.geom.GeoJSONFactory()
    fp = (osmium.FileProcessor(pbf).with_locations(index or "flex_mem")
          .with_areas(osmium.filter.KeyFilter("amenity"))
          .with_filter(osmium.filter.KeyFilter("amenity")))
    for o in fp:
        tags = {t.k: t.v for t in o.tags}
        if tags.get("amenity") not in AMENITIES:
            continue
        names = [tags[k] for k in NAME_KEYS if k in tags]
        if not names:
            continue
        if isinstance(o, osmium.osm.Area):
            ref = ("w" if o.from_way() else "r") + str(o.orig_id())
            try:
                geom = json.loads(gj.create_multipolygon(o))
            except Exception:          # broken multipolygon in OSM: nothing to outline
                continue
        elif isinstance(o, osmium.osm.Node):
            ref = "n" + str(o.id)
            geom = {"type": "Point", "coordinates": [o.location.lon, o.location.lat]}
        else:
            continue                   # a closed way arrives again as an Area
        rep, area = _rep_and_area(geom)
        for cid, pat in pats.items():
            if not any(pat.search(n) for n in names):
                continue
            d = _dist_m(rep[1], rep[0], *hint[cid])
            if d > radius_m:
                continue
            out[cid].append({"ref": ref, "name": tags.get("name", names[0]), "amenity": tags["amenity"],
                             "dist_m": round(d), "area_m2": round(area), "rep": rep, "geometry": geom})
    for cid in out:
        out[cid].sort(key=lambda c: (c["dist_m"], c["ref"]))
    return out


def extract_ways(pbf, boxes, index=None, margin_m=MARGIN_M):
    big = {k: grow(b, margin_m) for k, b in boxes.items()}
    out = {k: [] for k in boxes}
    fp = (osmium.FileProcessor(pbf).with_locations(index or "flex_mem")
          .with_filter(osmium.filter.KeyFilter("highway", "waterway")))
    for o in fp:
        if not isinstance(o, osmium.osm.Way):
            continue
        tags = {t.k: t.v for t in o.tags}
        if tags.get("highway") not in HIGHWAYS and tags.get("waterway") not in WATERWAYS:
            continue
        if not all(n.location.valid() for n in o.nodes):
            continue                   # a way running off the edge of the extract
        pts = [[round(n.lon, 6), round(n.lat, 6)] for n in o.nodes]
        if len(pts) < 2:
            continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        bb = (min(xs), min(ys), max(xs), max(ys))
        feat = None
        for k, b in big.items():
            if overlaps(bb, b):
                if feat is None:
                    props = {k2: tags[k2] for k2 in ("highway", "waterway", "name") if k2 in tags}
                    feat = {"type": "Feature", "properties": props, "geometry": {"type": "LineString", "coordinates": pts}}
                out[k].append(feat)
    return out
```

- [ ] **Step 4: Run and watch them pass**

Run: `cd /home/claude/work/pipeline && python3 -m unittest tests.test_osm -v 2>&1 | tail -3`
Expected: `Ran 3 tests … OK`.

If `test_ways_per_box` reports the properties in a different key order, note that `assertEqual` on dicts ignores order. Any other difference is a real failure.

- [ ] **Step 5: Commit**

```bash
cd /home/claude/work && git add pipeline && git commit -q -m "Pipeline: OSM passes for campus outlines and per-box streets and creeks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 3: Terrain, buildings, hazard, barangays and the outline

**Files:**
- Create: `pipeline/cut.py`, `pipeline/tests/test_cut.py`
- Modify: `pipeline/tests/fixtures.py` (append the Task 3 fixtures)

**Interfaces:**
- Consumes: `common.grow`, `common.overlaps`, `common.MARGIN_M`, `common.m_per_deg_lon`, `common.M_PER_DEG_LAT`, `common.box_around`.
- Produces:
  - `cut.round_geom(geom, nd=6) -> geom`
  - `cut.fabdem_tiles_for(bbox, tile_dir) -> [path]`. Raises `FileNotFoundError` when a tile is missing.
  - `cut.clip_fabdem(bbox, tile_dir, margin_m=300) -> (float32 2-D array, profile)`
  - `cut.scan_buildings(parquet, boxes, tmp_dir, margin_m=300, mem="2GB", threads=2, batch=50000) -> int`
  - `cut.box_buildings(tmp_dir, key) -> [Feature]`. Properties are `fid, src, px, py`, sorted by `(px, py)`; `fid` is the index.
  - `cut.noah_for_boxes(zip_paths, boxes, margin_m=300) -> {box: {"5"|"25"|"100": [Feature(Var, src)] | None}}`
  - `cut.barangays_for_boxes(admin_zip, boxes) -> {box: [Feature(pcode, name, muni, lat, lon)]}`
  - `cut.ph_outline(admin_zip, tolerance_deg=0.01, min_area_km2=20.0) -> MultiPolygon geometry`

**Ruling (ledger it when you start the task):** spec §7.1 asks for fixtures "made from real clips". Real clips exist only after Task 5 runs on Gregor's PC, so these fixtures are small synthetic stand-ins in the real files' formats. The formats were checked on the PC on 2026-09-27:
- the FABDEM tile naming;
- the VIDA parquet columns (`bf_source`, `bbox` struct, WKB `geometry`);
- NOAH's nested `<rp>yr/<Province>.zip` holding one shapefile with a `Var` field;
- the admin shapefile fields (`adm4_name`, `adm4_pcode`, `adm3_name`, `center_lat`, `center_lon`).

The real files are exercised by Task 5 (the same suite on the PC, then the real run) and by Task 7 (builds from the real cuts). The cost if wrong: a format detail the fixtures miss surfaces in Task 5 instead of here.

- [ ] **Step 1: Append the fixtures**

Append to `pipeline/tests/fixtures.py`:

```python
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
```

- [ ] **Step 2: Write the failing tests**

`pipeline/tests/test_cut.py`:

```python
import json, os, sys, tempfile, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C, cut
from shapely.geometry import box as sbox, shape, Point
from tests.fixtures import write_fabdem_tiles, write_buildings, write_noah, write_admin

UPD = C.box_around(14.6537, 121.0685)       # inside the fake Metro Manila hazard map
SEAM = C.box_around(14.60, 121.0)           # straddles the 121° E tile edge
CEBU = C.box_around(10.30, 123.90)

class Terrain(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tiles = write_fabdem_tiles(os.path.join(tempfile.mkdtemp(), "fabdem"))
    def test_tiles_for_a_seam_box(self):
        names = [os.path.basename(p) for p in cut.fabdem_tiles_for(C.grow(SEAM, 300), self.tiles)]
        self.assertEqual(names, ["N14E120_FABDEM_V1-2.tif", "N14E121_FABDEM_V1-2.tif"])
    def test_merge_is_continuous_across_the_seam(self):
        z, prof = cut.clip_fabdem(SEAM, self.tiles)
        self.assertFalse((z == -9999.0).any())
        self.assertEqual(z.shape, (prof["height"], prof["width"]))
        steps = np.diff(z[0])
        self.assertTrue(np.allclose(steps, 0.1, atol=1e-3), steps.max())   # 1 m per 0.01° → 0.1 m per pixel, no jump
    def test_missing_tile_is_an_error(self):
        with self.assertRaises(FileNotFoundError):
            cut.clip_fabdem(CEBU, self.tiles)

class Buildings(unittest.TestCase):
    def test_scan_sorts_and_splits(self):
        tmp = tempfile.mkdtemp()
        a = sbox(121.066, 14.652, 121.0661, 14.6521)          # inside UPD
        b = sbox(121.060, 14.650, 121.0601, 14.6501)          # inside UPD, sorts first (smaller x)
        far = sbox(125.0, 7.0, 125.0001, 7.0001)
        pq = write_buildings(os.path.join(tmp, "b.parquet"), [a, far, b])
        n = cut.scan_buildings(pq, {"upd": UPD, "cebu": CEBU}, tmp)
        self.assertEqual(n, 2)
        fs = cut.box_buildings(tmp, "upd")
        self.assertEqual([f["properties"]["fid"] for f in fs], [0, 1])
        self.assertLess(fs[0]["properties"]["px"], fs[1]["properties"]["px"])
        for f in fs:
            self.assertTrue(shape(f["geometry"]).contains(Point(f["properties"]["px"], f["properties"]["py"])))
        self.assertEqual(cut.box_buildings(tmp, "cebu"), [])
    def test_footprint_in_two_boxes_goes_to_both(self):
        tmp = tempfile.mkdtemp()
        near = C.box_around(14.6537, 121.080)                  # overlaps UPD
        shared = sbox(121.075, 14.650, 121.0751, 14.6501)
        cut.scan_buildings(write_buildings(os.path.join(tmp, "b.parquet"), [shared]), {"upd": UPD, "near": near}, tmp)
        self.assertEqual(len(cut.box_buildings(tmp, "upd")), 1)
        self.assertEqual(len(cut.box_buildings(tmp, "near")), 1)

class Noah(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        d = write_noah(tempfile.mkdtemp())
        cls.got = cut.noah_for_boxes(sorted(os.path.join(d, f) for f in os.listdir(d)), {"upd": UPD, "cebu": CEBU})
    def test_covered_period_keeps_hazard_classes(self):
        vs = sorted(f["properties"]["Var"] for f in self.got["upd"]["5"])
        self.assertEqual(vs, [1, 3])                       # the Var 2 polygon lies outside the box; the duplicate zip is read once
    def test_uncovered_period_is_none_not_empty(self):
        self.assertIsNone(self.got["upd"]["25"]); self.assertIsNone(self.got["upd"]["100"])
        self.assertEqual(len(self.got["cebu"]["25"]), 1); self.assertIsNone(self.got["cebu"]["100"])
    def test_clipped_to_box_plus_margin(self):
        g = C.grow(UPD, 300)
        for f in self.got["upd"]["5"]:
            x0, y0, x1, y1 = shape(f["geometry"]).bounds
            self.assertTrue(x0 >= g[0] - 1e-6 and x1 <= g[2] + 1e-6 and y0 >= g[1] - 1e-6 and y1 <= g[3] + 1e-6)

class Admin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.zip = write_admin(os.path.join(tempfile.mkdtemp(), "phl_admin_boundaries.shp.zip"))
    def test_barangays_intersecting_each_box(self):
        got = cut.barangays_for_boxes(self.zip, {"upd": UPD, "cebu": CEBU})
        self.assertEqual([f["properties"] for f in got["upd"]],
                         [{"pcode": "PH137404104", "name": "U.P. Campus", "muni": "Quezon City", "lat": 14.65, "lon": 121.06}])
        self.assertEqual(got["cebu"], [])
    def test_outline_drops_islets_and_rounds(self):
        g = cut.ph_outline(self.zip)
        self.assertEqual(g["type"], "MultiPolygon")
        self.assertEqual(len(g["coordinates"]), 1)          # the 0.001° islet (≈0.01 km²) is dropped
        xs = [c[0] for c in g["coordinates"][0][0]]
        self.assertTrue(all(round(x, 3) == x for x in xs))
        self.assertEqual(len(g["coordinates"][0]), 1)       # exterior ring only

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run them and watch them fail**

Run: `cd /home/claude/work/pipeline && python3 -W ignore -m unittest tests.test_cut 2>&1 | tail -3`
Expected: `ModuleNotFoundError: No module named 'cut'`.

- [ ] **Step 4: Write `pipeline/cut.py`**

Two details are deliberate:
- `clip_fabdem` merges whole tiles and then crops. `rasterio.merge.merge(..., bounds=…)` leaves a nodata column at a tile edge; this was checked on the fixture tiles.
- `scan_buildings` streams to per-box files, because Manila boxes overlap and a million footprints won't fit in the PC's 3.9 GB.

```python
"""Cut the national files down to each box. Every function reads its inputs read-only and returns data or writes
only into the temp folder it is given; run_pc.py decides where the results go."""
import io, json, math, os, tempfile, zipfile
import shapely
from shapely.geometry import shape, mapping, box as sbox, Polygon, MultiPolygon
from common import grow, overlaps, MARGIN_M, m_per_deg_lon, M_PER_DEG_LAT


def _round(c, nd):
    return round(c, nd) if isinstance(c, (int, float)) else [_round(x, nd) for x in c]


def round_geom(geom, nd=6):
    """GeoJSON geometry with coordinates rounded (6 decimals ≈ 0.1 m) and tuples turned into lists."""
    return {"type": geom["type"], "coordinates": _round(geom["coordinates"], nd)}


# ---------------------------------------------------------------- terrain
def fabdem_tiles_for(bbox, tile_dir):
    """The FABDEM 1° tiles a bbox touches (named by their south-west corner, e.g. N14E120_FABDEM_V1-2.tif)."""
    lon0, lat0, lon1, lat1 = bbox
    out = []
    for la in range(math.floor(lat0), math.floor(lat1) + 1):
        for lo in range(math.floor(lon0), math.floor(lon1) + 1):
            p = os.path.join(tile_dir, f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}_FABDEM_V1-2.tif")
            if not os.path.exists(p):
                raise FileNotFoundError(p)
            out.append(p)
    return out


def clip_fabdem(bbox, tile_dir, margin_m=MARGIN_M):
    """(2-D float32 array, GeoTIFF profile) of FABDEM over bbox + margin, merged across tile edges.
    Whole tiles are merged first and then cropped outward to whole pixels: merging straight to the bounds
    leaves a nodata column at a tile edge."""
    import rasterio
    from rasterio.merge import merge
    from rasterio.windows import from_bounds, Window, transform as wtransform
    b = grow(bbox, margin_m)
    srcs = [rasterio.open(p) for p in fabdem_tiles_for(b, tile_dir)]
    try:
        arr, tr = merge(srcs, nodata=-9999.0, dtype="float32")
        prof = srcs[0].profile.copy()
    finally:
        for s in srcs:
            s.close()
    w = from_bounds(*b, transform=tr)
    c0, r0 = int(math.floor(w.col_off)), int(math.floor(w.row_off))
    c1, r1 = int(math.ceil(w.col_off + w.width)), int(math.ceil(w.row_off + w.height))
    sub = arr[0, r0:r1, c0:c1]
    prof.update(driver="GTiff", height=sub.shape[0], width=sub.shape[1], transform=wtransform(Window(c0, r0, c1 - c0, r1 - r0), tr),
                count=1, dtype="float32", nodata=-9999.0, compress="deflate")
    return sub, prof


# ---------------------------------------------------------------- buildings
def scan_buildings(parquet, boxes, tmp_dir, margin_m=MARGIN_M, mem="2GB", threads=2, batch=50000):
    """One DuckDB scan of the buildings file. Footprints touching each box (+margin) are appended to
    <tmp_dir>/<box>.ndjson as [px, py, source, geometry]; a footprint in two boxes goes to both.
    Returns how many footprints matched any box."""
    import duckdb
    big = {k: grow(b, margin_m) for k, b in boxes.items()}
    cond = " OR ".join(f"(bbox.xmin <= {b[2]!r} AND bbox.xmax >= {b[0]!r} AND bbox.ymin <= {b[3]!r} AND bbox.ymax >= {b[1]!r})"
                       for b in big.values())
    con = duckdb.connect()
    con.execute(f"SET memory_limit='{mem}'")
    con.execute(f"SET threads={int(threads)}")
    parts = {k: open(os.path.join(tmp_dir, f"{k}.ndjson"), "w", encoding="utf-8") for k in boxes}
    n = 0
    try:
        rdr = con.execute("SELECT bbox.xmin AS x0, bbox.ymin AS y0, bbox.xmax AS x1, bbox.ymax AS y1, bf_source, geometry "
                          f"FROM read_parquet(?) WHERE {cond}", [parquet]).to_arrow_reader(batch)
        for rb in rdr:
            d = rb.to_pydict()
            geoms = shapely.from_wkb(d["geometry"])
            reps = shapely.point_on_surface(geoms)
            for i, g in enumerate(geoms):
                bb = (d["x0"][i], d["y0"][i], d["x1"][i], d["y1"][i])
                line = None
                for k, b in big.items():
                    if overlaps(bb, b):
                        if line is None:
                            line = json.dumps([round(reps[i].x, 7), round(reps[i].y, 7), d["bf_source"][i], round_geom(mapping(g))])
                        parts[k].write(line + "\n")
                n += 1
    finally:
        for f in parts.values():
            f.close()
    return n


def box_buildings(tmp_dir, key):
    """The footprints scan_buildings() wrote for one box, sorted by representative point so ids are stable."""
    with open(os.path.join(tmp_dir, f"{key}.ndjson"), encoding="utf-8") as f:
        rows = [json.loads(l) for l in f]
    rows.sort(key=lambda r: (r[0], r[1], json.dumps(r[3])))
    return [{"type": "Feature", "properties": {"fid": i, "src": r[2], "px": r[0], "py": r[1]}, "geometry": r[3]}
            for i, r in enumerate(rows)]


# ---------------------------------------------------------------- NOAH hazard
def _inner_shapefile(zbytes):
    import shapefile
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    shp = [n for n in z.namelist() if n.lower().endswith(".shp")][0]
    stem = shp[:-4]
    return shapefile.Reader(shp=io.BytesIO(z.read(stem + ".shp")), shx=io.BytesIO(z.read(stem + ".shx")),
                            dbf=io.BytesIO(z.read(stem + ".dbf")))


def _polygonal(g):
    parts = [p for p in shapely.get_parts(g) if p.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else None


def noah_for_boxes(zip_paths, boxes, margin_m=MARGIN_M):
    """{box: {"5"|"25"|"100": [Feature(Var, src)] or None}}. None means no NOAH map for that return period covers the
    box (shown as "not available"); an empty list means maps cover it and none of it is hazard.
    A province zip that appears in two downloads under the same name is read once; two different maps of one
    province (e.g. 'Misamis Oriental' and 'MisamisOriental') are both kept and the build takes the highest class."""
    big = {k: grow(b, margin_m) for k, b in boxes.items()}
    out = {k: {} for k in boxes}
    seen = set()
    for zp in sorted(zip_paths):
        outer = zipfile.ZipFile(zp)
        for name in sorted(outer.namelist()):
            if not name.lower().endswith(".zip"):
                continue
            rp = name.split("/")[0].lower().replace("yr", "")
            key = (rp, name.split("/")[-1])
            if key in seen:
                continue
            seen.add(key)
            rd = _inner_shapefile(outer.read(name))
            hit = [k for k, b in big.items() if overlaps(tuple(rd.bbox), b)]
            if not hit:
                continue
            geoms = []
            for i in range(len(rd)):
                g = shape(rd.shape(i).__geo_interface__)
                if not g.is_valid:
                    g = shapely.make_valid(g)
                geoms.append((int(round(float(rd.record(i)[0]))), g))
            for k in hit:
                clip = sbox(*big[k])
                feats = out[k].setdefault(rp, [])
                for var, g in geoms:
                    if not overlaps(g.bounds, big[k]):
                        continue
                    c = _polygonal(g.intersection(clip))
                    if c is not None and not c.is_empty:
                        feats.append({"type": "Feature", "properties": {"Var": var, "src": name}, "geometry": round_geom(mapping(c))})
    for k in boxes:
        for rp in ("5", "25", "100"):
            out[k].setdefault(rp, None)
    return out


# ---------------------------------------------------------------- barangays and the country outline
def _admin_reader(admin_zip, layer):
    import shapefile
    z = zipfile.ZipFile(admin_zip)
    return shapefile.Reader(shp=io.BytesIO(z.read(layer + ".shp")), shx=io.BytesIO(z.read(layer + ".shx")),
                            dbf=io.BytesIO(z.read(layer + ".dbf")), encoding="utf-8")


def barangays_for_boxes(admin_zip, boxes):
    """{box: [Feature]} of admin level 4 polygons that intersect each box; properties pcode, name, muni, lat, lon
    (the same shape tools/extract_barangays.py wrote for the pilot sites)."""
    rd = _admin_reader(admin_zip, "phl_admin4")
    names = [f[0] for f in rd.fields[1:]]
    out = {k: [] for k in boxes}
    for sr in rd.iterShapeRecords():
        if sr.shape.shapeType == 0:
            continue
        hits = [k for k, b in boxes.items() if overlaps(tuple(sr.shape.bbox), b)]
        if not hits:
            continue
        g = shape(sr.shape.__geo_interface__)
        r = dict(zip(names, sr.record))
        props = {"pcode": r["adm4_pcode"], "name": r["adm4_name"], "muni": r["adm3_name"],
                 "lat": round(float(r["center_lat"]), 6), "lon": round(float(r["center_lon"]), 6)}
        for k in hits:
            if g.intersects(sbox(*boxes[k])):
                out[k].append({"type": "Feature", "properties": props, "geometry": round_geom(mapping(g))})
    for k in out:
        out[k].sort(key=lambda f: f["properties"]["pcode"])
    return out


def ph_outline(admin_zip, tolerance_deg=0.01, min_area_km2=20.0):
    """Simplified country outline for the national map: islands of at least min_area_km2, no holes, 3 decimals."""
    rd = _admin_reader(admin_zip, "phl_admin0")
    geoms = [shape(s.__geo_interface__) for s in rd.shapes() if s.shapeType != 0]
    u = shapely.union_all(geoms)
    keep = []
    for p in shapely.get_parts(u):
        if p.geom_type != "Polygon":
            continue
        if p.area * m_per_deg_lon(p.centroid.y) * M_PER_DEG_LAT / 1e6 < min_area_km2:
            continue
        s = Polygon(p.exterior).simplify(tolerance_deg, preserve_topology=True)
        if not s.is_empty and s.geom_type == "Polygon":
            keep.append(s)
    keep.sort(key=lambda q: (-q.area, q.bounds))
    return round_geom(mapping(MultiPolygon(keep)), 3)
```

- [ ] **Step 5: Run them and watch them pass**

Run: `cd /home/claude/work/pipeline && python3 -W ignore -m unittest tests.test_cut tests.test_common tests.test_osm 2>&1 | tail -3`
Expected: `Ran 19 tests … OK`.

- [ ] **Step 6: Commit**

```bash
cd /home/claude/work && git add pipeline && git commit -q -m "Pipeline: FABDEM merge and clip, one-scan buildings, NOAH, barangays, country outline" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 4: The PC command line (`find`, `cut`)

**Files:**
- Create: `pipeline/run_pc.py`, `pipeline/tests/test_run_pc.py`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  - The CLI `python3 run_pc.py find|cut --data <folder> --out <folder> [--campuses csv] [--index spec] [--radius m] [--only ids] [--tmp dir] [--tolerance deg]`.
  - Output layout under `--out`:

    | Path | Contents |
    |---|---|
    | `_candidates/<id>.geojson` | Candidate outlines, properties `ref, name, amenity, dist_m, area_m2, rep` |
    | `_candidates/summary.csv` | One row per candidate |
    | `<id>/box.json` | `{"id", "bbox"}` |
    | `<id>/outline.geojson` | Campuses only. An `osm_ref` of `manual` gives a Point at the csv centre |
    | `<id>/dem.tif`, `<id>/buildings.geojson`, `<id>/osm.geojson`, `<id>/barangays.geojson` | The cuts |
    | `<id>/noah_<rp>.geojson` | Only for covered periods |
    | `<id>/noah.json` | `{"5"|"25"|"100": "covered"|"missing"}` |
    | `ph_outline.geojson` | The country outline |
    | `pipeline_log.txt` | One line per step |

  - `run_pc.Out(root)`: `.path(*rel)` raises `ValueError` outside root; `.json/.text/.tif(…, *rel)` write only new files; `.log(msg)`.

- [ ] **Step 1: Write the failing end-to-end test**

`pipeline/tests/test_run_pc.py`. It builds a fake "Nationwide Update" folder from the fixtures, runs `find`, resolves the csv the way Task 5 will, runs `cut` twice, and checks:
- the inputs are unchanged;
- nothing is written outside `--out`;
- the second run keeps every file;
- a `manual` centre works.

```python
import csv, hashlib, json, os, subprocess, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common as C
from run_pc import Out
from shapely.geometry import box as sbox
from tests.fixtures import write_osm, write_fabdem_tiles, write_buildings, write_noah, write_admin

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUN = [sys.executable, os.path.join(HERE, "run_pc.py")]
FIELDS = ["id", "short", "name", "campus", "group", "type", "city", "province", "osm_pattern", "hint_lat", "hint_lon", "osm_ref", "lat", "lon"]
ROWS = [dict(id="upd", short="UP Diliman", name="University of the Philippines Diliman", campus="Diliman", group="Luzon", type="SUC",
             city="Quezon City", province="Metro Manila", osm_pattern="University of the Philippines.?.?.?Diliman", hint_lat=14.6537, hint_lon=121.0685),
        dict(id="mcc", short="MCC", name="Mandaue City College", campus="Main", group="Visayas", type="LUC",
             city="Mandaue City", province="Cebu", osm_pattern="Mandaue City College", hint_lat=10.33, hint_lon=123.94)]


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, FIELDS); w.writeheader()
        for r in rows: w.writerow({k: r.get(k, "") for k in FIELDS})


def snapshot(folder, skip):
    out = {}
    for d, _, fs in os.walk(folder):
        if os.path.realpath(d).startswith(os.path.realpath(skip)): continue
        for f in fs:
            p = os.path.join(d, f); out[p] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return out


class EndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = d = tempfile.mkdtemp(prefix="Nationwide Update ")
        write_osm(os.path.join(d, "philippines-test.osm"))
        write_fabdem_tiles(os.path.join(d, "bahawatch-data", "fabdem"), tiles=((14, 120), (14, 121), (10, 123)))
        write_buildings(os.path.join(d, "PHL_buildings.parquet"),
                        [sbox(121.066, 14.652, 121.0661, 14.6521), sbox(123.901, 10.301, 123.9011, 10.3011), sbox(121.05, 14.64, 121.0501, 14.6401)])
        write_noah(d); write_admin(os.path.join(d, "phl_admin_boundaries.shp.zip"))
        cls.out = os.path.join(d, "bahawatch-data", "campuses")
        cls.csv = os.path.join(tempfile.mkdtemp(), "campuses.csv"); write_csv(cls.csv, ROWS)
        cls.before = snapshot(d, cls.out)
        cls.find = subprocess.run(RUN + ["find", "--data", d, "--out", cls.out, "--campuses", cls.csv], capture_output=True, text=True)
        cands = {k: json.load(open(os.path.join(cls.out, "_candidates", f"{k}.geojson")))["features"] for k in ("upd", "mcc")}
        resolved = [dict(r, osm_ref=cands[r["id"]][0]["properties"]["ref"], lon=cands[r["id"]][0]["properties"]["rep"][0],
                         lat=cands[r["id"]][0]["properties"]["rep"][1]) for r in ROWS]
        write_csv(cls.csv, resolved)
        cls.cut1 = subprocess.run(RUN + ["cut", "--data", d, "--out", cls.out, "--campuses", cls.csv], capture_output=True, text=True)
        cls.mtimes = {p: os.stat(p).st_mtime_ns for p in snapshot(cls.out, "/nonexistent")}
        cls.cut2 = subprocess.run(RUN + ["cut", "--data", d, "--out", cls.out, "--campuses", cls.csv], capture_output=True, text=True)

    def test_find_writes_candidates(self):
        self.assertEqual(self.find.returncode, 0, self.find.stderr)
        s = open(os.path.join(self.out, "_candidates", "summary.csv"), encoding="utf-8").read()
        self.assertIn("upd,1,w10,University of the Philippines Diliman", s)
        self.assertIn("mcc,1,n9,Mandaue City College", s)

    def test_cut_writes_every_box(self):
        self.assertEqual(self.cut1.returncode, 0, self.cut1.stderr)
        for k in ("upd", "mcc", "tv"):
            for f in ("box.json", "dem.tif", "buildings.geojson", "osm.geojson", "noah.json", "barangays.geojson"):
                self.assertTrue(os.path.exists(os.path.join(self.out, k, f)), (k, f))
        self.assertTrue(os.path.exists(os.path.join(self.out, "upd", "outline.geojson")))
        self.assertFalse(os.path.exists(os.path.join(self.out, "tv", "outline.geojson")))
        self.assertEqual(json.load(open(os.path.join(self.out, "upd", "noah.json"))), {"5": "covered", "25": "missing", "100": "missing"})
        self.assertTrue(os.path.exists(os.path.join(self.out, "ph_outline.geojson")))
        b = json.load(open(os.path.join(self.out, "upd", "buildings.geojson")))["features"]
        self.assertEqual(len(b), 2)

    def test_second_run_keeps_everything(self):
        self.assertEqual(self.cut2.returncode, 0, self.cut2.stderr)
        self.assertIn("kept all", self.cut2.stdout)
        now = {p: os.stat(p).st_mtime_ns for p in self.mtimes if not p.endswith("pipeline_log.txt")}
        self.assertEqual(now, {p: m for p, m in self.mtimes.items() if not p.endswith("pipeline_log.txt")})

    def test_inputs_untouched_and_nothing_written_outside_out(self):
        self.assertEqual(snapshot(self.data, self.out), self.before)

    def test_log_has_a_line_per_step(self):
        log = open(os.path.join(self.out, "pipeline_log.txt"), encoding="utf-8").read()
        for s in ("find:", "cut outline:", "cut terrain:", "cut buildings:", "cut osm:", "cut noah:", "cut barangays:", "cut outline (country):"):
            self.assertIn(s, log)

    def test_manual_centre_becomes_a_point_outline(self):
        out = tempfile.mkdtemp()
        csvp = os.path.join(tempfile.mkdtemp(), "c.csv")
        write_csv(csvp, [dict(ROWS[1], osm_ref="manual", lat=10.3301, lon=123.9402)])
        r = subprocess.run(RUN + ["cut", "--data", self.data, "--out", out, "--campuses", csvp, "--only", "mcc"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        g = json.load(open(os.path.join(out, "mcc", "outline.geojson")))["features"][0]["geometry"]
        self.assertEqual(g, {"type": "Point", "coordinates": [123.9402, 10.3301]})

    def test_out_refuses_paths_outside(self):
        o = Out(tempfile.mkdtemp())
        with self.assertRaises(ValueError):
            o.path("..", "escape.txt")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd /home/claude/work/pipeline && python3 -W ignore -m unittest tests.test_run_pc 2>&1 | tail -3`
Expected: an error importing `run_pc` (`ModuleNotFoundError`).

- [ ] **Step 3: Write `pipeline/run_pc.py`**

```python
#!/usr/bin/env python3
"""BahaWatch campus pipeline: the part that runs on Gregor's PC (spec §5.1).

  python3 run_pc.py find --data "<Nationwide Update>" --out "<Nationwide Update>/bahawatch-data/campuses"
  python3 run_pc.py cut  --data "<Nationwide Update>" --out "<Nationwide Update>/bahawatch-data/campuses"

It reads the national downloads and never changes them. It writes only inside --out. A file that already exists
is kept (the log says "kept"), so an interrupted run picks up where it stopped. Every step adds a line to
<out>/pipeline_log.txt."""
import argparse, csv, datetime, glob, io, json, os, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402


class Out:
    """The only way this script writes: inside one folder, new files only, via a .part file and a rename."""
    def __init__(self, root):
        self.root = os.path.realpath(root)
        os.makedirs(self.root, exist_ok=True)
        self.log_path = os.path.join(self.root, "pipeline_log.txt")

    def path(self, *rel):
        p = os.path.realpath(os.path.join(self.root, *rel))
        if p != self.root and not p.startswith(self.root + os.sep):
            raise ValueError(f"refusing to write outside {self.root}: {p}")
        return p

    def exists(self, *rel):
        return os.path.exists(self.path(*rel))

    def _write(self, rel, writer):
        p = self.path(*rel)
        if os.path.exists(p):
            return False
        os.makedirs(os.path.dirname(p), exist_ok=True)
        writer(p + ".part")
        os.replace(p + ".part", p)
        return True

    def json(self, obj, *rel):
        def w(t):
            with open(t, "w", encoding="utf-8") as f:
                json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        return self._write(rel, w)

    def text(self, s, *rel):
        def w(t):
            with open(t, "w", encoding="utf-8", newline="") as f:
                f.write(s)
        return self._write(rel, w)

    def tif(self, arr, prof, *rel):
        import rasterio
        def w(t):
            with rasterio.open(t, "w", **prof) as d:
                d.write(arr, 1)
        return self._write(rel, w)

    def log(self, msg):
        line = f"{datetime.datetime.now().isoformat(timespec='seconds')} {msg}"
        print(line, flush=True)
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")


def inputs(data):
    d = os.path.realpath(data)
    pbf = sorted(glob.glob(os.path.join(d, "philippines-*.osm.pbf"))) or sorted(glob.glob(os.path.join(d, "philippines-*.osm")))
    if not pbf:
        sys.exit(f"no philippines-*.osm.pbf in {d}")
    return {"pbf": pbf[-1], "parquet": os.path.join(d, "PHL_buildings.parquet"),
            "fabdem": os.path.join(d, "bahawatch-data", "fabdem"), "admin": os.path.join(d, "phl_admin_boundaries.shp.zip"),
            "noah": sorted(glob.glob(os.path.join(d, "*yr-*.zip")))}


def describe(p):
    st = os.stat(p)
    return f"{os.path.basename(p)} ({st.st_size / 1e6:.0f} MB, modified {datetime.date.fromtimestamp(st.st_mtime)})"


def fc(features):
    return {"type": "FeatureCollection", "features": features}


def cmd_find(a):
    import osm_extract
    out, inp, rows = Out(a.out), inputs(a.data), C.read_campuses(a.campuses)
    t = time.time()
    got = osm_extract.find_campus_areas(inp["pbf"], rows, radius_m=a.radius, index=a.index)
    buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
    w.writerow(["id", "candidates", "ref", "name", "amenity", "dist_m", "area_m2", "rep_lon", "rep_lat"])
    for r in rows:
        cands = got[r["id"]]
        out.json(fc([{"type": "Feature", "properties": {k: c[k] for k in ("ref", "name", "amenity", "dist_m", "area_m2", "rep")},
                      "geometry": c["geometry"]} for c in cands]), "_candidates", f"{r['id']}.geojson")
        for c in cands or [None]:
            w.writerow([r["id"], len(cands)] + ([c["ref"], c["name"], c["amenity"], c["dist_m"], c["area_m2"], *c["rep"]] if c else [""] * 7))
    out.text(buf.getvalue(), "_candidates", "summary.csv")
    none = [r["id"] for r in rows if not got[r["id"]]]
    out.log(f"find: {sum(len(v) for v in got.values())} candidates for {len(rows)} campuses from {describe(inp['pbf'])} "
            f"in {time.time() - t:.0f} s" + (f"; none for {', '.join(none)}" if none else ""))


def cmd_cut(a):
    import cut, osm_extract
    out, inp, rows = Out(a.out), inputs(a.data), C.read_campuses(a.campuses)
    todo_rows = [r for r in rows if r["lat"] is None or not r["osm_ref"]]
    if todo_rows:
        sys.exit("campuses.csv has no centre or osm_ref yet for: " + ", ".join(r["id"] for r in todo_rows))
    bx = C.boxes(rows)
    if a.only:
        keep = set(a.only.split(","))
        bx = {k: v for k, v in bx.items() if k in keep}
    by_id = {r["id"]: r for r in rows}
    for k, b in bx.items():
        out.json({"id": k, "bbox": list(b)}, k, "box.json")

    def step(name, fname, fn):
        todo = [k for k in bx if not out.exists(k, fname)]
        kept = len(bx) - len(todo)
        if not todo:
            out.log(f"cut {name}: kept all {kept}")
            return
        t = time.time()
        msg = fn({k: bx[k] for k in todo})
        out.log(f"cut {name}: {msg} for {len(todo)} boxes ({kept} kept) in {time.time() - t:.0f} s")

    def outlines(todo):
        n = 0
        for k in todo:
            if k not in by_id:                       # pilot boxes have no campus outline
                continue
            r = by_id[k]
            if r["osm_ref"] == "manual":             # no OSM outline anywhere: the centre Gregor gave, as a point
                n += out.json(fc([{"type": "Feature", "properties": {"ref": "manual", "name": r["name"]},
                                   "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]}}]), k, "outline.geojson")
                continue
            cands = json.load(open(out.path("_candidates", f"{k}.geojson"), encoding="utf-8"))["features"]
            pick = [f for f in cands if f["properties"]["ref"] == by_id[k]["osm_ref"]]
            if not pick:
                sys.exit(f"{k}: osm_ref {by_id[k]['osm_ref']} is not among its candidates")
            n += out.json(fc(pick), k, "outline.geojson")
        return f"{n} outlines"
    step("outline", "outline.geojson", lambda todo: outlines([k for k in todo if k in by_id]))

    def terrain(todo):
        for k, b in todo.items():
            arr, prof = cut.clip_fabdem(b, inp["fabdem"])
            out.tif(arr, prof, k, "dem.tif")
        return f"FABDEM from {inp['fabdem']}"
    step("terrain", "dem.tif", terrain)

    def buildings(todo):
        tmp = a.tmp or tempfile.mkdtemp(prefix="bw_bld_")
        n = cut.scan_buildings(inp["parquet"], todo, tmp)
        counts = []
        for k in todo:
            fs = cut.box_buildings(tmp, k)
            out.json(fc(fs), k, "buildings.geojson")
            counts.append(f"{k} {len(fs)}")
        return f"{n} footprints from {describe(inp['parquet'])}: " + ", ".join(counts)
    step("buildings", "buildings.geojson", buildings)

    def ways(todo):
        got = osm_extract.extract_ways(inp["pbf"], todo, index=a.index)
        for k in todo:
            out.json(fc(got[k]), k, "osm.geojson")
        return f"streets and creeks from {describe(inp['pbf'])}: " + ", ".join(f"{k} {len(got[k])}" for k in todo)
    step("osm", "osm.geojson", ways)

    def noah(todo):
        got = cut.noah_for_boxes(inp["noah"], todo)
        for k in todo:
            for rp, fs in got[k].items():
                if fs is not None:
                    out.json(fc(fs), k, f"noah_{rp}.geojson")
            out.json({rp: ("covered" if got[k][rp] is not None else "missing") for rp in ("5", "25", "100")}, k, "noah.json")
        return f"NOAH from {len(inp['noah'])} zips: " + ", ".join(
            f"{k} " + "/".join(rp if got[k][rp] is not None else "-" for rp in ("5", "25", "100")) for k in todo)
    step("noah", "noah.json", noah)

    def barangays(todo):
        got = cut.barangays_for_boxes(inp["admin"], todo)
        for k in todo:
            out.json(fc(got[k]), k, "barangays.geojson")
        return f"barangays from {describe(inp['admin'])}: " + ", ".join(f"{k} {len(got[k])}" for k in todo)
    step("barangays", "barangays.geojson", barangays)

    if out.exists("ph_outline.geojson"):
        out.log("cut outline (country): kept")
    else:
        t = time.time()
        g = cut.ph_outline(inp["admin"], tolerance_deg=a.tolerance)
        out.json(g, "ph_outline.geojson")
        out.log(f"cut outline (country): {len(g['coordinates'])} islands, {len(json.dumps(g)) // 1024} KB in {time.time() - t:.0f} s")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["find", "cut"])
    p.add_argument("--data", required=True, help="the 'Nationwide Update' folder (read only)")
    p.add_argument("--out", required=True, help="where results go, e.g. <data>/bahawatch-data/campuses")
    p.add_argument("--campuses", default=C.CAMPUSES_CSV)
    p.add_argument("--index", default=None, help="pyosmium node index, e.g. sparse_file_array,/tmp/nodes.idx")
    p.add_argument("--radius", type=float, default=10000.0, help="find: search radius around each hint, metres")
    p.add_argument("--only", default=None, help="cut: comma-separated box ids")
    p.add_argument("--tmp", default=None, help="cut: scratch folder for the buildings scan (outside --out)")
    p.add_argument("--tolerance", type=float, default=0.01, help="cut: country outline simplification, degrees")
    a = p.parse_args(argv)
    {"find": cmd_find, "cut": cmd_cut}[a.cmd](a)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the whole pipeline suite**

Run: `cd /home/claude/work/pipeline && python3 -W ignore -m unittest discover -s tests -t . 2>&1 | tail -3`
Expected: `Ran 26 tests … OK`.

- [ ] **Step 5: Commit**

```bash
cd /home/claude/work && git add pipeline && git commit -q -m "Pipeline: run_pc.py find/cut: new files only, inside --out, resumable, logged" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 5: Run the pipeline on Gregor's PC

This task runs commands on Gregor's computer, through the desktop app's workspace (`mcp__remote-devices__device_bash`). Gregor approved it with the plan.

**Rules on his PC:**
- Read only from `Nationwide Update`.
- Write only under `bahawatch-data/campuses/`.
- Never delete anything.

**Paths:**

| Folder | On Windows | In device_bash |
|---|---|---|
| The data folder | `C:\Users\grego\OneDrive\Desktop\Research\BahaWatch\Nationwide Update` | `$HOME/mnt/Nationwide Update` |
| Out | `…\bahawatch-data\campuses` | `$HOME/mnt/Nationwide Update/bahawatch-data/campuses` |

**Scratch** (node index, temporary building parts, logs): the workspace home `$HOME` in device_bash, outside `mnt/`, where Gregor never sees it.

**Long steps:** a `device_bash` call stops after 180 s, so start them with `setsid nohup … &` and poll the log every 2–3 minutes.

**Files:**
- Modify: `pipeline/campuses.csv` (fill `osm_ref`, `lat`, `lon`), `pipeline/tests/test_common.py` (one new test)
- Create (container, git-ignored): `inputs/campuses/<id>/…` for the 25 campuses and `tv`; `inputs/campuses/ph_outline.geojson`; `inputs/campuses/pipeline_log.txt`

**Interfaces:**
- Consumes: `run_pc.py` from Task 4.
- Produces:
  - `pipeline/campuses.csv` with every centre filled;
  - `inputs/campuses/` laid out as the Task 4 table.

  Tasks 7 onwards read these.

- [ ] **Step 1: Copy the pipeline to the PC**

Copy these into `/mnt/user-data/outputs/pipeline_pc/`, keeping the `tests/` sub-folder:
- `pipeline/__init__.py`, `common.py`, `osm_extract.py`, `cut.py`, `run_pc.py`, `campuses.csv`, `requirements.txt`;
- `pipeline/tests/__init__.py`, `fixtures.py`, `test_common.py`, `test_osm.py`, `test_cut.py`, `test_run_pc.py`.

Then call `device_commit_files` once, with each file's `stagedPath` and `devicePath` = `C:\Users\grego\OneDrive\Desktop\Research\BahaWatch\Nationwide Update\bahawatch-data\campuses\_pipeline\<same relative path>`.
Expected: all 13 in `written`, none in `rejected`.

- [ ] **Step 2: Install the packages in the workspace (not in Windows)**

device_bash:
```bash
python3 -m pip install --user -q -r "$HOME/mnt/Nationwide Update/bahawatch-data/campuses/_pipeline/requirements.txt" 2>&1 | tail -3; python3 -c "import duckdb, pyarrow, osmium, shapely, rasterio, shapefile; print('imports ok')"
```

Expected: `imports ok`.

If pip can't reach PyPI, stop and tell Gregor (one question): the workspace's network allowlist blocks it. Nothing else in this task can run without these packages.

- [ ] **Step 3: Run the pipeline's own tests on the PC (Python 3.10)**

device_bash (the tests write only to the workspace's `/tmp`):
```bash
cd "$HOME/mnt/Nationwide Update/bahawatch-data/campuses/_pipeline" && PYTHONDONTWRITEBYTECODE=1 python3 -W ignore -m unittest discover -s tests -t . 2>&1 | tail -3
```

Expected: `Ran 26 tests … OK`. A failure here is a Python 3.10 incompatibility: fix it in the container (TDD), re-copy, and re-run.

- [ ] **Step 4: `find`: campus outlines (one pass over the 607 MB extract)**

device_bash:
```bash
cd "$HOME/mnt/Nationwide Update/bahawatch-data/campuses/_pipeline" && PYTHONDONTWRITEBYTECODE=1 setsid nohup python3 -W ignore run_pc.py find --data "$HOME/mnt/Nationwide Update" --out "$HOME/mnt/Nationwide Update/bahawatch-data/campuses" --index "sparse_file_array,$HOME/bw_nodes.idx" > "$HOME/bw_find.out" 2>&1 < /dev/null & echo started
```

Poll: `tail -3 "$HOME/bw_find.out"; pgrep -f "run_pc.py find" > /dev/null && echo running || echo done`.
Expected at the end: one log line `find: <N> candidates for 25 campuses from philippines-260925.osm.pbf (607 MB, …) in <s> s`. It may add `; none for …`.

- [ ] **Step 5: Choose each campus's outline and fill `campuses.csv`**

Stage `…\campuses\_candidates\summary.csv` and the 25 `_candidates\<id>.geojson` with `device_stage_files`. Then, for each campus, pick one candidate:

1. Its name must fit the campus in the spec's §4 table: the main campus. Reject names with "Senior High", "Annex", "Extension", "Laboratory School", or another campus's place name, e.g. "Alangilan" for BatStateU, "Downtown" for USC, "Makati" for Mapúa.
2. Prefer `amenity=university` to `college`, then the largest `area_m2` within 3 km of the hint.
3. Use a Point (`n…`) only if no outline fits.
4. If a campus has no candidate:
   - Re-run `find` for that campus with `--radius 25000 --out "$HOME/mnt/Nationwide Update/bahawatch-data/campuses/_find2"` and a one-row copy of the csv. Stage that copy with `device_commit_files` to `…\_pipeline\one.csv` and pass `--campuses one.csv`.
   - If there is still none, ask Gregor once for the campus location (a Google Maps pin is enough). Set `osm_ref` to `manual` and use his point.

Write `osm_ref` (e.g. `w123456`) and the candidate's `rep` as `lon` and `lat` (6 decimals) into `pipeline/campuses.csv`. Put one ledger line per campus that needed a judgement: `Task 5: Ruling: <id> → <ref> "<name>" — <why> — cost if wrong: that campus's box is off-centre`.

Append to `pipeline/tests/test_common.py` inside `class CampusList`:

```python
    def test_centres_resolved(self):
        """Task 5 filled osm_ref, lat and lon from the OSM outlines found on Gregor's PC."""
        for r in self.rows:
            self.assertRegex(r["osm_ref"], r"^([nwr]\d+|manual)$", r["id"])
            d = math.hypot((r["lon"] - r["hint_lon"]) * C.m_per_deg_lon(r["lat"]), (r["lat"] - r["hint_lat"]) * C.M_PER_DEG_LAT)
            self.assertLess(d, 10000, (r["id"], round(d)))
```

Run: `cd /home/claude/work/pipeline && python3 -m unittest tests.test_common 2>&1 | tail -3`
Expected: `Ran 7 tests … OK`. Before the csv was filled, the new test would fail with `TypeError` on `None`.

```bash
cd /home/claude/work && git add pipeline/campuses.csv pipeline/tests/test_common.py && git commit -q -m "Campus list: centres and OSM outlines chosen for all 25 campuses" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

- [ ] **Step 6: Send the filled csv to the PC**

Copy `pipeline/campuses.csv` to `/mnt/user-data/outputs/pipeline_pc/campuses.csv`. `device_commit_files` it to `C:\Users\grego\OneDrive\Desktop\Research\BahaWatch\Nationwide Update\bahawatch-data\campuses\_pipeline\campuses.csv`, the pipeline's own copy.
Expected: `written`.

- [ ] **Step 7: `cut`: every box, one pass per national file**

device_bash:
```bash
mkdir -p "$HOME/bw_tmp" && cd "$HOME/mnt/Nationwide Update/bahawatch-data/campuses/_pipeline" && PYTHONDONTWRITEBYTECODE=1 setsid nohup python3 -W ignore run_pc.py cut --data "$HOME/mnt/Nationwide Update" --out "$HOME/mnt/Nationwide Update/bahawatch-data/campuses" --index "sparse_file_array,$HOME/bw_nodes.idx" --tmp "$HOME/bw_tmp" > "$HOME/bw_cut.out" 2>&1 < /dev/null & echo started
```

Poll as in Step 4 (`bw_cut.out`, `run_pc.py cut`).
Expected, in order:
- `cut outline:`, `cut terrain:`;
- `cut buildings: <n> footprints from PHL_buildings.parquet (5000 MB, …): upd <k>, …`;
- `cut osm:`, `cut noah: … upd 5/25/100, …`, `cut barangays:`;
- `cut outline (country): <islands> islands, <KB> KB`.

If the process dies (e.g. out of memory in the buildings scan), re-run the same command. Finished files are kept. If it dies again in the same step, re-run with `--only` over half the boxes at a time (ledger it).

The country outline must be ≤ 40 KB. If it is bigger, re-run that step alone with a larger `--tolerance` in a fresh `--out` (e.g. `…\campuses\_outline2`, tolerance 0.02) and use that file (ledger it).

- [ ] **Step 8: Bring the cuts into the container**

device_bash (zip into the out folder, so the stage is one file under 400 MB; nothing else is written):
```bash
cd "$HOME/mnt/Nationwide Update/bahawatch-data/campuses" && python3 - <<'PY'
import os, zipfile
with zipfile.ZipFile("_stage_cuts.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for d, dirs, fs in os.walk("."):
        dirs[:] = [x for x in dirs if not x.startswith("_")]
        for f in fs:
            if not f.startswith("_") and not f.endswith(".part"):
                z.write(os.path.join(d, f))
print(os.path.getsize("_stage_cuts.zip") // 1_000_000, "MB")
PY
```

Expected: a size under 400 MB. If it is larger, write `_stage_cuts_a.zip` (the Metro Manila boxes) and `_stage_cuts_b.zip` (the rest) the same way, filtering on the box id.

Stage the zip(s) with `device_stage_files`, then in the container:
```bash
mkdir -p /home/claude/work/inputs/campuses && cd /home/claude/work/inputs/campuses && for z in "/mnt/user-data/uploads/Nationwide Update/bahawatch-data/campuses/"_stage_cuts*.zip; do python3 -m zipfile -e "$z" .; done && ls | head -40 && tail -12 pipeline_log.txt
```

- [ ] **Step 9: Check what arrived**

```bash
cd /home/claude/work && python3 - <<'PY'
import json, os, sys
sys.path.insert(0, "pipeline"); import common as C
rows = C.read_campuses(); root = "inputs/campuses"
need = ["box.json", "dem.tif", "buildings.geojson", "osm.geojson", "noah.json", "barangays.geojson"]
for k in [r["id"] for r in rows] + ["tv"]:
    miss = [f for f in need + ([] if k == "tv" else ["outline.geojson"]) if not os.path.exists(f"{root}/{k}/{f}")]
    nb = len(json.load(open(f"{root}/{k}/buildings.geojson"))["features"]) if not miss else 0
    print(f"{k:8s} {'MISSING ' + ','.join(miss) if miss else 'ok'}  buildings {nb:6d}  noah {json.load(open(f'{root}/{k}/noah.json')) if not miss else '-'}")
print("outline", os.path.getsize(f"{root}/ph_outline.geojson") // 1024, "KB")
PY
```

Expected: every row `ok`, with buildings in the thousands (tens of thousands in Metro Manila), NOAH `covered` for 5/25/100 at every campus (spec §4 coverage check), and an outline ≤ 40 KB. Put the printout in the ledger.

Nothing is committed here beyond Step 5: `inputs/campuses/` is git-ignored.

---

### Task 6: Model pieces: grids, placement, the partnership card

**Files:**
- Create: `model/__init__.py` (empty), `model/grids.py`, `model/placement.py`, `model/campus.py`, `model/tests/__init__.py` (empty), `model/tests/test_grids.py`, `model/tests/test_placement.py`, `model/tests/test_campus.py`

**Interfaces:**
- Consumes: nothing from earlier tasks (numpy, scipy, rasterio; all present in the container).
- Produces (used by `build_data.py` and `tools/build_places.py` in Task 7):
  - `model.grids`:
    - `BLOCK_FRAC=0.75`
    - `rle(g) -> str`, `unrle(s, n) -> uint8[n]`
    - `rasterize(shapes, bbox, GW, GH, super_=1, dtype="uint8", fill=0)`
    - `built_fraction(polys, bbox, GW, GH) -> float[GH,GW]`
    - `label_polys(polys, bbox, GW, GH) -> int32[GH,GW]` (1-based, 0 none)
    - `sea_mask(raw) -> bool[GH,GW]`
    - `block_mask(frac, street, creek, sea) -> bool`
    - `dist_m(mask, cell_m) -> float` (inf when empty)
    - `counts(cells, GW, GH) -> uint8`
  - `model.placement`:
    - `W_LOW, W_HAZ, W_WATER, RADIUS_M, WATER_M, STREET_M, N_UNITS, SPACINGS`
    - `lowness(elev, cell_m, radius_m=300, valid=None)`
    - `hazard(noah, shape)`
    - `near_water(dist)`
    - `score(elev, noah, creek_dist, cell_m, valid=None)`
    - `pick(cands, n=8, spacings=(300,250,200), ok=callable) -> (chosen, spacing)`. It raises `ValueError` when nothing is on campus or 8 don't fit.
  - `model.campus`:
    - `candidates(pts, score, street, sea, cell_m, street_m=25) -> [dict + score]`
    - `card(units, spacing, brgy_grid, brgy_names, noah, sea, outline) -> {"units", "barangays", "noah", "spacing", "outline"}`

- [ ] **Step 1: Write the failing tests**

`model/tests/test_grids.py`:

```python
import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from model import grids

BBOX = (0.0, 0.0, 10.0, 10.0)          # 10 × 10 cells of 1° for easy arithmetic; row 0 is the north edge


def sq(x0, y0, x1, y1):
    return {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}


class Grids(unittest.TestCase):
    def test_rle_round_trip(self):
        g = np.zeros((20, 30), np.uint8); g[3:9, 4:25] = 2; g[15, :] = 1
        self.assertTrue((grids.unrle(grids.rle(g), g.size).reshape(g.shape) == g).all())

    def test_built_fraction(self):
        f = grids.built_fraction([sq(2, 7, 3, 8), sq(5, 5, 5.4, 6)], BBOX, 10, 10)
        self.assertAlmostEqual(f[2, 2], 1.0)          # lat 7–8 is row 2 counted from the north
        self.assertAlmostEqual(f[4, 5], 0.4, places=6)   # 0.4 of a cell wide: 2 of the 5 sub-columns have their centres inside
        self.assertEqual(f.sum().round(6), 1.4)

    def test_label_polys(self):
        lab = grids.label_polys([sq(0, 0, 10, 10), sq(0, 9, 1, 10)], BBOX, 10, 10)
        self.assertEqual(lab[0, 0], 2); self.assertEqual(lab[5, 5], 1)

    def test_sea_is_low_ground_touching_the_edge(self):
        raw = np.full((10, 10), 5.0)
        raw[:, 0:2] = 0.0; raw[0, 5] = np.nan           # a coast on the west edge and a nodata cell on the north edge
        raw[5, 5] = -1.0                                # an inland hollow below sea level
        sea = grids.sea_mask(raw)
        self.assertTrue(sea[:, 0:2].all() and sea[0, 5])
        self.assertFalse(sea[5, 5]); self.assertEqual(int(sea.sum()), 21)

    def test_block_never_streets_or_creeks_always_sea(self):
        frac = np.full((3, 3), 0.9); street = np.zeros((3, 3), bool); creek = np.zeros((3, 3), bool); sea = np.zeros((3, 3), bool)
        street[1, :] = True; creek[:, 1] = True; sea[0, 0] = True; frac[2, 2] = 0.74
        b = grids.block_mask(frac, street, creek, sea)
        self.assertEqual(b.astype(int).tolist(), [[1, 0, 1], [0, 0, 0], [1, 0, 0]])

    def test_dist_and_counts(self):
        m = np.zeros((5, 5), bool); m[2, 2] = True
        d = grids.dist_m(m, 15.0)
        self.assertEqual(d[2, 4], 30.0); self.assertTrue(np.isinf(grids.dist_m(np.zeros((2, 2), bool), 15.0)).all())
        c = grids.counts([(1, 1), (1, 1), (0, 2)], 3, 3)
        self.assertEqual(c[1, 1], 2); self.assertEqual(c[2, 0], 1); self.assertEqual(c.dtype, np.uint8)

if __name__ == "__main__":
    unittest.main()
```

`model/tests/test_placement.py`:

```python
import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from model import placement as P


def cand(fid, x, y, score, oc=False):
    return {"fid": fid, "x_m": x, "y_m": y, "score": score, "oc": oc}


class Scores(unittest.TestCase):
    def test_lowness_pit_and_peak(self):
        e = np.full((41, 41), 10.0); e[20, 20] = 5.0; e[5, 5] = 20.0
        low = P.lowness(e, 15.0)
        self.assertEqual(low[20, 20], 1.0)              # nothing nearby is lower
        self.assertLess(low[5, 5], 0.05)                # almost everything nearby is lower
    def test_lowness_ignores_sea(self):
        e = np.full((21, 21), 2.0); e[:, :10] = -5.0; valid = e > 0
        self.assertEqual(P.lowness(e, 15.0, valid=valid)[10, 15], 1.0)   # the sea is lower, but it isn't ground
    def test_hazard_tiers_and_missing_maps(self):
        n5 = np.array([[1, 0, 0, 0]]); n25 = np.array([[1, 1, 0, 0]]); n100 = np.array([[1, 1, 1, 0]])
        self.assertEqual(P.hazard({"5": n5, "25": n25, "100": n100}, (1, 4)).tolist(), [[1.0, 0.66, 0.33, 0.0]])
        self.assertEqual(P.hazard({"5": None, "25": n25, "100": None}, (1, 4)).tolist(), [[0.66, 0.66, 0.0, 0.0]])
    def test_near_water(self):
        self.assertEqual(P.near_water(np.array([0.0, 150.0, 300.0, np.inf])).tolist(), [1.0, 0.5, 0.0, 0.0])

class Pick(unittest.TestCase):
    def line(self, n, step, oc_at=None):
        return [cand(i, i * step, 0.0, 1.0 - i / 100, oc=(i == oc_at)) for i in range(n)]
    def test_first_unit_is_on_campus_even_if_it_scores_lower(self):
        cs = self.line(20, 310.0, oc_at=5)
        chosen, sp = P.pick(cs)
        self.assertEqual(chosen[0]["fid"], 5); self.assertEqual(sp, 300.0); self.assertEqual(len(chosen), 8)
    def test_spacing_is_kept(self):
        cs = [cand(i, (i % 10) * 100.0, (i // 10) * 100.0, 1.0 - i / 1000, oc=(i == 0)) for i in range(100)]
        chosen, sp = P.pick(cs)
        for a in chosen:
            for b in chosen:
                if a is not b: self.assertGreaterEqual(((a["x_m"] - b["x_m"]) ** 2 + (a["y_m"] - b["y_m"]) ** 2) ** 0.5, sp)
    def test_falls_back_to_closer_spacing_then_fails(self):
        chosen, sp = P.pick(self.line(8, 260.0, oc_at=0)); self.assertEqual(sp, 250.0)
        with self.assertRaises(ValueError): P.pick(self.line(8, 150.0, oc_at=0))
    def test_no_campus_candidate_fails(self):
        with self.assertRaises(ValueError): P.pick(self.line(20, 400.0))
    def test_ok_rejects_are_skipped_and_ties_break_by_fid(self):
        cs = [cand(9, 0, 0, 0.5, oc=True)] + [cand(i, 1000.0 * i, 0, 0.9) for i in (3, 1, 2)] + [cand(i, 1000.0 * i, 0, 0.1) for i in range(4, 10) if i != 9]
        chosen, _ = P.pick(cs, ok=lambda c: c["fid"] != 2)
        self.assertEqual([c["fid"] for c in chosen], [9, 1, 3, 4, 5, 6, 7, 8])

if __name__ == "__main__":
    unittest.main()
```

`model/tests/test_campus.py`:

```python
import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from model import campus


class Campus(unittest.TestCase):
    def test_candidates_need_land_and_a_street(self):
        street = np.zeros((10, 10), bool); street[5, :] = True
        sea = np.zeros((10, 10), bool); sea[:, 0] = True
        score = np.arange(100, dtype=float).reshape(10, 10)
        pts = [dict(fid=0, cx=0, cy=5, x_m=0, y_m=0, oc=False),       # on the sea
               dict(fid=1, cx=3, cy=6, x_m=0, y_m=0, oc=False),       # next to the street (15 m)
               dict(fid=2, cx=3, cy=8, x_m=0, y_m=0, oc=False)]       # 45 m away
        got = campus.candidates(pts, score, street, sea, 15.0)
        self.assertEqual([c["fid"] for c in got], [1]); self.assertEqual(got[0]["score"], 63.0)
    def test_card_uses_land_only_and_keeps_missing_maps(self):
        sea = np.zeros((4, 4), bool); sea[:, 0] = True
        n5 = np.zeros((4, 4), np.uint8); n5[:, 0] = 3; n5[0, 1:] = 1   # the sea's hazard must not count
        brgy = np.zeros((4, 4), np.int32); brgy[:2, :] = 1; brgy[2:, 1:] = 2; brgy[3, 0] = 3
        units = [{"id": "BW-X-01", "bld": "near A St · One", "oc": True}]
        c = campus.card(units, 300.0, brgy, ["One", "Two", "Sea Barangay"], {"5": n5, "25": None, "100": n5 * 0}, sea, True)
        self.assertEqual(c["noah"], {"5": 0.25, "25": None, "100": 0.0})
        self.assertEqual(c["barangays"], ["One", "Two"])
        self.assertEqual(c["units"], [{"id": "BW-X-01", "name": "near A St · One", "oc": True}])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /home/claude/work && touch model/__init__.py model/tests/__init__.py && python3 -W ignore -m unittest discover -s model/tests -t . 2>&1 | tail -3`
Expected: `ImportError: cannot import name 'grids' from 'model'`, 3 errors.

- [ ] **Step 3: Write `model/grids.py`**

```python
"""Grid helpers shared by build_data.py and tools/build_places.py (spec §6.1, §6.2).
Row 0 is the north edge, like build_data.py's world coordinates."""
import base64
import numpy as np
from scipy.ndimage import label, distance_transform_edt

BLOCK_FRAC = 0.75     # a cell at least this built-up blocks water
SUPER = 5             # built fraction is measured on a 5 × 5 sub-grid per cell


def rle(g):
    """(count, value) byte pairs, base64: the page's unrle() reads this."""
    flat = np.asarray(g).flatten(); out = bytearray(); i = 0
    while i < len(flat):
        v = flat[i]; n = 1
        while i + n < len(flat) and flat[i + n] == v and n < 255:
            n += 1
        out += bytes([n, int(v)]); i += n
    return base64.b64encode(bytes(out)).decode()


def unrle(s, n):
    b = base64.b64decode(s); g = np.zeros(n, np.uint8); o = 0
    for i in range(0, len(b), 2):
        g[o:o + b[i]] = b[i + 1]; o += b[i]
    return g


def rasterize(shapes, bbox, GW, GH, super_=1, dtype="uint8", fill=0):
    """Burn (GeoJSON geometry, value) pairs into a grid over bbox; a cell takes a value when its centre is inside.
    Later shapes overwrite earlier ones."""
    from rasterio.features import rasterize as burn
    from rasterio.transform import from_bounds
    shapes = list(shapes)
    if not shapes:
        return np.full((GH * super_, GW * super_), fill, dtype)
    return burn(shapes, out_shape=(GH * super_, GW * super_), transform=from_bounds(*bbox, GW * super_, GH * super_),
                fill=fill, dtype=dtype)


def built_fraction(polys, bbox, GW, GH, super_=SUPER):
    """Share (0–1) of each cell covered by the footprint polygons."""
    m = rasterize(((p, 1) for p in polys), bbox, GW, GH, super_)
    return m.reshape(GH, super_, GW, super_).mean(axis=(1, 3))


def label_polys(polys, bbox, GW, GH):
    """Cell → 1-based index of the polygon holding the cell centre (0 = none)."""
    return rasterize(((p, i + 1) for i, p in enumerate(polys)), bbox, GW, GH, dtype="int32")


def sea_mask(raw):
    """Sea: cells with no terrain value, or at or below 0 m, that connect to the grid edge.
    An inland hollow below 0 m stays land."""
    low = ~np.isfinite(raw) | (np.nan_to_num(raw, nan=-1.0) <= 0)
    lab, _ = label(low)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, sorted(edge))


def block_mask(frac, street, creek, sea):
    """Cells water may not enter: ≥ 75 % built (never a street or creek cell), and the sea."""
    return ((frac >= BLOCK_FRAC) & ~street & ~creek) | sea


def dist_m(mask, cell_m):
    """Metres from every cell to the nearest True cell (inf when there is none)."""
    if not mask.any():
        return np.full(mask.shape, np.inf)
    return distance_transform_edt(~mask) * cell_m


def counts(cells, GW, GH):
    """Per-cell count of (cx, cy) points, capped at 255 so it packs as bytes."""
    g = np.zeros((GH, GW), np.int32)
    for cx, cy in cells:
        g[cy, cx] += 1
    return np.minimum(g, 255).astype(np.uint8)
```

- [ ] **Step 4: Write `model/placement.py`**

```python
"""Automatic unit placement (spec §6.3): score every candidate building, then pick best-first with spacing."""
import math
import numpy as np

W_LOW, W_HAZ, W_WATER = 0.5, 0.3, 0.2
RADIUS_M = 300.0       # lowness is judged against ground within this distance
WATER_M = 300.0        # the near-water score falls to 0 here
STREET_M = 25.0        # a unit's house must be this close to a street
N_UNITS = 8
SPACINGS = (300.0, 250.0, 200.0)


def lowness(elev, cell_m, radius_m=RADIUS_M, valid=None):
    """1 − (share of cells within radius_m that are lower than this cell). Cells off the grid or not valid (sea)
    are not counted, so a cell by the shore is judged against land only."""
    GH, GW = elev.shape
    r = int(round(radius_m / cell_m))
    e = elev.astype(float) if valid is None else np.where(valid, elev, np.nan)
    pad = np.pad(e, r, constant_values=np.nan)
    below = np.zeros(elev.shape); n = np.zeros(elev.shape)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r:
                continue
            s = pad[r + dy:r + dy + GH, r + dx:r + dx + GW]
            ok = ~np.isnan(s)
            n += ok
            below += ok & (s < e)
    return 1.0 - below / np.maximum(n, 1)


def hazard(noah, shape):
    """1.0 in a 5-yr zone, 0.66 in a 25-yr zone only, 0.33 in a 100-yr zone only, else 0. A missing map is skipped."""
    h = np.zeros(shape)
    for rp, v in (("100", 0.33), ("25", 0.66), ("5", 1.0)):
        g = noah.get(rp)
        if g is not None:
            h = np.where(g >= 1, v, h)
    return h


def near_water(dist):
    """1 at a creek or drain, falling linearly to 0 at WATER_M."""
    return np.clip(1.0 - dist / WATER_M, 0.0, 1.0)


def score(elev, noah, creek_dist, cell_m, valid=None):
    return (W_LOW * lowness(elev, cell_m, valid=valid) + W_HAZ * hazard(noah, elev.shape)
            + W_WATER * near_water(creek_dist))


def pick(cands, n=N_UNITS, spacings=SPACINGS, ok=lambda c: True):
    """cands: dicts with fid, x_m, y_m, score, oc (on campus). Unit 1 is the best on-campus candidate; the rest are
    taken best-first at least `spacing` metres from every unit already chosen. ok(c) is asked only of a candidate
    about to be chosen (naming it is slow). Returns (chosen, spacing used)."""
    order = sorted(cands, key=lambda c: (-c["score"], c["fid"]))
    bad = set()

    def good(c):
        if c["fid"] in bad:
            return False
        if ok(c):
            return True
        bad.add(c["fid"])
        return False

    first = next((c for c in order if c["oc"] and good(c)), None)
    if first is None:
        raise ValueError("no usable candidate on campus")
    best = [first]
    for sp in spacings:
        chosen = [first]
        for c in order:
            if len(chosen) == n:
                break
            if c is first:
                continue
            if all(math.hypot(c["x_m"] - o["x_m"], c["y_m"] - o["y_m"]) >= sp for o in chosen) and good(c):
                chosen.append(c)
        if len(chosen) == n:
            return chosen, sp
        best = chosen
    raise ValueError(f"only {len(best)} units fit at {spacings[-1]:.0f} m")
```

- [ ] **Step 5: Write `model/campus.py`**

```python
"""Campus-only parts of the model: candidate houses and the partnership card (spec §3.2, §6.3)."""
import numpy as np
from model import grids, placement


def candidates(pts, score, street, sea, cell_m, street_m=placement.STREET_M):
    """pts: dicts with fid, cx, cy (cell), x_m, y_m, oc. Keeps houses on land within street_m of a street cell
    and attaches the cell's score."""
    sd = grids.dist_m(street, cell_m)
    return [dict(p, score=float(score[p["cy"], p["cx"]])) for p in pts
            if not sea[p["cy"], p["cx"]] and sd[p["cy"], p["cx"]] <= street_m]


def card(units, spacing, brgy_grid, brgy_names, noah, sea, outline):
    """What the partnership card shows. NOAH shares are of land cells only; a missing map gives None."""
    land = ~sea
    ids = np.unique(brgy_grid[land & (brgy_grid > 0)])
    names = sorted({brgy_names[i - 1] for i in ids})
    nland = max(int(land.sum()), 1)
    shares = {rp: (None if g is None else round(float(((g >= 1) & land).sum()) / nland, 4)) for rp, g in noah.items()}
    return {"units": [{"id": u["id"], "name": u["bld"], "oc": bool(u["oc"])} for u in units],
            "barangays": names, "noah": shares, "spacing": spacing, "outline": bool(outline)}
```

- [ ] **Step 6: Run them and watch them pass**

Run: `cd /home/claude/work && python3 -W ignore -m unittest discover -s model/tests -t . 2>&1 | tail -3`
Expected: `Ran 17 tests … OK`.

- [ ] **Step 7: Commit**

```bash
cd /home/claude/work && git add model && git commit -q -m "Model: grids (built fraction, sea, blocking), automatic placement, partnership card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 7: Site data files for all 27 sites

**Files:**
- Create: `model/tests/fixture_campus.py`, `tools/check_site_data.py`, `data/<site>.json` × 27, `data/ph_outline.json`
- Modify (replace whole file): `sites.py`, `build_data.py`, `tools/build_places.py`, `test_build.sh`
- Modify: `tools/test_places.py` (one-off edit script), `worker/test/cron.test.js`, `places.json` (regenerated)

**Interfaces:**
- Consumes:
  - `model.grids`, `model.placement`, `model.campus` (Task 6);
  - `pipeline/common.py` and `campuses.csv` with centres (Tasks 1 and 5);
  - `inputs/campuses/<id>/…` (Task 5).
- Produces:
  - `sites.get_site(id)`: pilot configs from `SITES` (`tv`, `berkeley`; no `diliman`) or a campus config from `campuses.csv`. Env `CAMPUSES_CSV` and `CAMPUS_INPUTS` override the defaults.
  - `data/<site>.json`: the old keys plus the ones below. Tasks 8–11 read these.

    | Key | Contents |
    |---|---|
    | `sea` | RLE 0/1 |
    | `block` | RLE 0/1 (sea included) |
    | `bc` | RLE footprint counts per cell |
    | `thin` | Dot-thinning step (1 = every building) |
    | `site.terrain` | Terrain source, for the footnote |
    | `site.noah_missing` | e.g. `["100"]` |
    | `site.campus` | `{id, short, name, campus, group, type, city, province, lat, lon}` |
    | `card` | `{units:[{id,name,oc}], barangays:[…], noah:{"5","25","100": share or null}, spacing, outline}` |
    | `places` | The site's places, added by `build_places.py` |

  - Campus units carry `id` `BW-<ID>-NN`, `street`, `bld` ("near X · Brgy"), `short`, `oc`, `brgy`, `fid`.
  - `tools/build_places.py`:
    - `data_files() -> {site: path}`, `barangays_path(site) -> path | None`;
    - `reach(elev, start, cell_m, block=None)`;
    - env `BW_DATA_DIR`, `BW_PLACES`, `CAMPUS_INPUTS`.
  - `tools/check_site_data.py [site …]`: exits 1 on any failed §7.1 check.

**Note:** until Task 8 the page still embeds the old `data.json`, `data_diliman.json` and `data_berkeley.json`, so page suites are not run here. Task 8 deletes those files.

- [ ] **Step 1: Write the made-up campus and the checks**

`model/tests/fixture_campus.py`: a small campus with every input the build reads. It has:
- a sea strip inside the box;
- a creek valley;
- a street grid with houses;
- NOAH 5/25-yr (100-yr missing);
- two barangays and a campus outline.

```python
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
```

`tools/check_site_data.py`:

```python
#!/usr/bin/env python3
"""The per-site data checks of spec §7.1. Prints one line per site and exits 1 if any check fails.
  python3 tools/check_site_data.py              # every data/*.json
  python3 tools/check_site_data.py upd xu       # just these
Environment: BW_DATA_DIR (default data/), CAMPUSES_CSV, CAMPUS_INPUTS (default inputs/campuses; the
unit-on-a-footprint check runs only where a site's buildings.geojson is present)."""
import base64, glob, json, math, os, re, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, "pipeline"))
from model import grids  # noqa: E402
import common as C  # noqa: E402

MAX_BYTES = 450_000
DATA_DIR = os.environ.get("BW_DATA_DIR", os.path.join(ROOT, "data"))
CAMPUS_INPUTS = os.environ.get("CAMPUS_INPUTS", os.path.join(ROOT, "inputs", "campuses"))


def metres(a, b):
    lat = (a[1] + b[1]) / 2
    return math.hypot((a[0] - b[0]) * C.m_per_deg_lon(lat), (a[1] - b[1]) * C.M_PER_DEG_LAT)


def check(path, rows):
    errs = []
    d = json.load(open(path, encoding="utf-8")); sid = d["site"]["id"]; GW, GH = d["GW"], d["GH"]; N = GW * GH
    size = os.path.getsize(path)
    if size > MAX_BYTES: errs.append(f"{size} bytes > {MAX_BYTES}")
    if "places" not in d: errs.append("no places (run tools/build_places.py)")
    e = np.frombuffer(base64.b64decode(d["elev"]), dtype="<i2") / 10.0
    if e.size != N: errs.append("terrain grid has the wrong size")
    sea = grids.unrle(d["sea"], N).astype(bool) if "sea" in d else np.zeros(N, bool)
    if d["elev_min"] < -5 or e[~sea].max() > 3000: errs.append(f"implausible terrain {d['elev_min']:.1f}–{e[~sea].max():.1f} m")
    if sid not in rows:
        return errs, f"{len(d['sensors'])} units"
    r = rows[sid]; units = d["sensors"]; card = d["card"]
    b = d["bbox"]; centre = ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
    if metres(centre, (r["lon"], r["lat"])) > 50: errs.append("box is not centred on the campus")
    ids = [u["id"] for u in units]
    if ids != [f"BW-{sid.upper()}-{k:02d}" for k in range(1, 9)]: errs.append(f"unit ids {ids}")
    if [u.get("oc") for u in units].count(True) != 1 or not units[0].get("oc"): errs.append("exactly one unit, unit 01, must be on campus")
    for u in units:
        if not u.get("street") or not u.get("brgy"): errs.append(f"{u['id']} has no street or barangay")
        if sea[u["cy"] * GW + u["cx"]]: errs.append(f"{u['id']} sits on the sea")
    for i, a in enumerate(units):
        for q in units[i + 1:]:
            if metres((a["lon"], a["lat"]), (q["lon"], q["lat"])) < card["spacing"] - 2:
                errs.append(f"{a['id']} and {q['id']} closer than {card['spacing']:.0f} m")
    if not card["barangays"]: errs.append("no barangay covered")
    for rp in ("5", "25", "100"):
        v = card["noah"][rp]
        if (v is None) != (rp in d["site"]["noah_missing"]): errs.append(f"NOAH {rp}-yr: card and site disagree")
        if v is not None and not 0 <= v <= 1: errs.append(f"NOAH {rp}-yr share {v}")
    bpath = os.path.join(CAMPUS_INPUTS, sid, "buildings.geojson")
    if os.path.exists(bpath):
        from shapely.geometry import shape, Point
        foot = {f["properties"]["fid"]: f for f in json.load(open(bpath, encoding="utf-8"))["features"]}
        for u in units:
            g = shape(foot[u["fid"]]["geometry"])
            gap = g.distance(Point(u["lon"], u["lat"])) * C.M_PER_DEG_LAT
            if gap > 2: errs.append(f"{u['id']} is {gap:.0f} m off its footprint")
    return errs, f"{len(units)} units, spacing {card['spacing']:.0f} m, {len(card['barangays'])} barangays, NOAH " + \
        "/".join("n/a" if card["noah"][rp] is None else f"{card['noah'][rp]:.0%}" for rp in ("5", "25", "100"))


def main(argv):
    rows = {r["id"]: r for r in C.read_campuses(os.environ.get("CAMPUSES_CSV", C.CAMPUSES_CSV))}
    paths = [os.path.join(DATA_DIR, f"{s}.json") for s in argv] or \
        [p for p in sorted(glob.glob(os.path.join(DATA_DIR, "*.json"))) if not p.endswith("ph_outline.json")]
    bad = 0
    for p in paths:
        errs, info = check(p, rows)
        name = os.path.basename(p)[:-5]
        size = os.path.getsize(p)
        if errs:
            bad += 1; print(f"FAIL {name}: " + "; ".join(errs))
        else:
            print(f"ok   {name}: {size // 1000} KB, {info}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

`test_build.sh` (replaces the old "Teachers Village byte-identical" check, as the spec §7.6 says):

```bash
#!/bin/bash
# Build checks (spec §7.1–7.2): pipeline and model unit tests; a made-up campus built twice (byte-identical) and
# checked, including that the checker catches a broken file; Teachers Village and UP Diliman rebuilt from the same
# inputs (identical to data/ apart from places); Berkeley unchanged; every data/*.json checked.
set -e
cd "$(dirname "$0")"
T=$(mktemp -d)
fail(){ echo "FAIL $1"; [ -n "$2" ] && tail -20 "$2"; exit 1; }

(cd pipeline && python3 -W ignore -m unittest discover -s tests -t .) > $T/u1.log 2>&1 || fail "pipeline unit tests" $T/u1.log
echo "ok   pipeline unit tests ($(grep -o 'Ran [0-9]* tests' $T/u1.log))"
python3 -W ignore -m unittest discover -s model/tests -t . > $T/u2.log 2>&1 || fail "model unit tests" $T/u2.log
echo "ok   model unit tests ($(grep -o 'Ran [0-9]* tests' $T/u2.log))"

# the made-up campus: same inputs → byte-identical file; the checker passes it and catches a broken copy
python3 model/tests/fixture_campus.py $T/fx > /dev/null
FX="CAMPUSES_CSV=$T/fx/campuses.csv CAMPUS_INPUTS=$T/fx/inputs"
for o in a b; do env $FX SITE=zz OUTPUT=$T/fx/$o/zz.json python3 -W ignore build_data.py > $T/fx_$o.log 2>&1 || fail "fixture campus build" $T/fx_$o.log; done
cmp -s $T/fx/a/zz.json $T/fx/b/zz.json || fail "same inputs gave different campus files"
echo "ok   same inputs give a byte-identical campus file"
env $FX BW_DATA_DIR=$T/fx/a BW_PLACES=$T/fx/places.json python3 -W ignore tools/build_places.py > /dev/null
env $FX BW_DATA_DIR=$T/fx/a python3 -W ignore tools/check_site_data.py zz > $T/chk.log || fail "fixture campus data checks" $T/chk.log
echo "ok   fixture campus passes the data checks"
mkdir -p $T/fx/bad
python3 - $T/fx/a/zz.json $T/fx/bad/zz.json <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
d["sensors"][3]["oc"] = True                                         # a second "on campus" unit
d["sensors"][5]["lon"], d["sensors"][5]["lat"] = d["sensors"][4]["lon"], d["sensors"][4]["lat"]   # two units on one spot
json.dump(d, open(sys.argv[2], "w"))
PY
if env $FX BW_DATA_DIR=$T/fx/bad python3 -W ignore tools/check_site_data.py zz > $T/bad.log; then fail "the checker passed a broken file"; fi
grep -q "exactly one unit" $T/bad.log && grep -q "closer than" $T/bad.log || fail "the checker missed a broken rule" $T/bad.log
echo "ok   the checker catches a broken file"

# real sites: rebuilding from the same inputs gives the same data (places are added afterwards by build_places.py)
for s in tv upd; do
  SITE=$s OUTPUT=$T/$s.json python3 -W ignore build_data.py > $T/$s.log 2>&1 || fail "$s build" $T/$s.log
  python3 - $s $T/$s.json <<'PY' || fail "$s rebuild"
import json, sys
a = json.load(open(f"data/{sys.argv[1]}.json")); b = json.load(open(sys.argv[2])); a.pop("places", None)
assert a == b, f"{sys.argv[1]}: rebuilding from the same inputs changed the data"
print(f"ok   {sys.argv[1]} rebuilds identically")
PY
done
python3 - <<'PY' || fail "pilot sites"
import json
tv = json.load(open("data/tv.json"))
assert [s["id"] for s in tv["sensors"]] == [f"BW-H0{i}" for i in range(1, 9)], "Teachers Village keeps its 8 hand-placed units"
assert "block" in tv and "bc" in tv and tv["site"]["terrain"].startswith("FABDEM") and "g_ref" not in tv["site"]
print("ok   Teachers Village: 8 hand-placed units on FABDEM, buildings as obstacles, median storm reference")
bk = json.load(open("data/berkeley.json"))
import base64, numpy as np
e = np.frombuffer(base64.b64decode(bk["elev"]), dtype="<i2") / 10.0
assert len(bk["sensors"]) == 9 and 45 < e.min() < 60 and 300 < e.max() < 330 and "block" not in bk and not bk["site"]["hazard"]
assert bk["site"]["terrain"].startswith("USGS")
print("ok   Berkeley unchanged: USGS 1 m terrain, 9 units, no obstacle grid, no hazard layer")
PY
python3 -W ignore tools/check_site_data.py > $T/all.log || { cat $T/all.log; fail "site data checks"; }
cat $T/all.log
grep -q 'f"data/{SITE_ID}.json"' build_data.py || fail "default output is not data/<site>.json"
echo "ok   default output is data/<site>.json"
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd /home/claude/work && chmod +x test_build.sh && ./test_build.sh 2>&1 | tail -5`
Expected: `ok` for the pipeline (27) and model (17) unit tests, then `FAIL fixture campus build`, with `KeyError: 'zz'` in the log tail (the old build only knows `SITES`).

- [ ] **Step 3: Replace `sites.py`**

These are the changes:
- `ROAD_CAMPUS`, `FAB_ATTR` and `FAB_TERRAIN` are added.
- Teachers Village moves to FABDEM and pipeline footprints, and drops `g_ref`.
- `diliman` is gone.
- Berkeley gets `terrain`.
- `campus_site()` and `get_site()` are added.

```python
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
   bbox=(121.0470,14.6300,121.0755,14.6545), W=1200, H=1059, GW=200, GH=177,
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
                bbox=box_around(r["lat"], r["lon"]), W=1200, H=1200, GW=200, GH=200,
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
```

- [ ] **Step 4: Replace `build_data.py`**

These are the changes against the current file:
- the new docstring;
- `get_site`, and output `data/<site>.json`;
- `raw` kept for `SEA`;
- footprints from the pipeline;
- the creek mask;
- `BLOCK` and `BC`;
- GeoJSON NOAH with missing periods kept as `None`;
- `auto_units()`;
- automatic labels;
- the new keys;
- evenly thinned dots under `BW_BUDGET` (400,000 bytes).

Everything else is byte-for-byte the old code.

```python
#!/usr/bin/env python3
"""
BahaWatch dashboard — data preprocessing.

Turns open geodata for one site into the compact JSON file the dashboard fetches (data/<site>.json).
Run once per site; re-run only when inputs, the frame, or the sensor sites change.

  SITE=tv python3 build_data.py          # a pilot site from sites.SITES
  SITE=upd python3 build_data.py         # a PhilDev campus from pipeline/campuses.csv (inputs/campuses/upd/)

Inputs (see README.md for how to obtain each):
  osm         OpenStreetMap GeoJSON: highways, waterways (and, for the pilots, buildings with addresses/names)
  dem         terrain GeoTIFF: FABDEM V1-2 for Philippine sites, USGS 1 m for Berkeley
  buildings   footprint GeoJSON from the pipeline (Philippine sites)
  noah        NOAH flood hazard (shapefiles for Teachers Village, clipped GeoJSON for campuses)

Output:
  data/<site>.json   frame + terrain + streets + creeks + buildings + NOAH + sea/blocked/building-count grids + units
                     (+ the partnership card for campuses; tools/build_places.py adds "places" afterwards)

Dependencies:  numpy scipy rasterio pyshp shapely
"""
import json, base64, math, os, sys
import numpy as np
import rasterio, shapefile
from scipy.ndimage import minimum_filter, gaussian_filter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import grids, placement, campus as campus_model

# ------------------------------------------------------------------ site config
from sites import get_site
SITE_ID = os.environ.get("SITE", "tv")
CFG = get_site(SITE_ID)
INPUT_OSM, INPUT_DEM, INPUT_NOAH = CFG["osm"], CFG["dem"], CFG["noah"]
OUTPUT = os.environ.get("OUTPUT", f"data/{SITE_ID}.json")        # the page fetches data/<site>.json
BUDGET = int(os.environ.get("BW_BUDGET", "400000"))              # bytes; places (added later) must still fit 450 KB
LON0, LAT0, LON1, LAT1 = CFG["bbox"]
W, H, GW, GH = CFG["W"], CFG["H"], CFG["GW"], CFG["GH"]
DSM_MIN_FILTER, DSM_SMOOTH_SIGMA, STREET_CARVE_M = CFG["min_filter"], CFG["sigma"], CFG["carve"]
SENSOR_TARGETS, LABEL_STREETS, ROAD_CLASS = CFG["sensors"], CFG["labels"], CFG["road_class"]
CREEK_TAGS = CFG["creek_tags"]

# ------------------------------------------------------------------ helpers
def wx(lon): return (lon-LON0)/(LON1-LON0)*W
def wy(lat): return (LAT1-lat)/(LAT1-LAT0)*H
def cell_ll(gx, gy):
    return (LON0+(gx+0.5)/GW*(LON1-LON0), LAT1-(gy+0.5)/GH*(LAT1-LAT0))
def b64(arr): return base64.b64encode(arr.tobytes()).decode()
def rle(g):
    flat=g.flatten(); out=bytearray(); i=0
    while i < len(flat):
        v=flat[i]; n=1
        while i+n < len(flat) and flat[i+n]==v and n<255: n+=1
        out += bytes([n,int(v)]); i+=n
    return base64.b64encode(bytes(out)).decode()
def douglas_peucker(pts, eps):
    if len(pts) < 3: return pts
    (ax,ay),(bx,by)=pts[0],pts[-1]; dmax=0; idx=0
    for i in range(1,len(pts)-1):
        px,py=pts[i]
        if ax==bx and ay==by: d=math.hypot(px-ax,py-ay)
        else:
            t=((px-ax)*(bx-ax)+(py-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)
            t=min(max(t,0),1); d=math.hypot(px-(ax+t*(bx-ax)),py-(ay+t*(by-ay)))
        if d>dmax: dmax=d; idx=i
    if dmax>eps: return douglas_peucker(pts[:idx+1],eps)[:-1]+douglas_peucker(pts[idx:],eps)
    return [pts[0],pts[-1]]

# ------------------------------------------------------------------ 1. terrain
print("1/5 terrain: resampling DEM ...")
from pyproj import Transformer
ds=rasterio.open(INPUT_DEM); dem=ds.read(1).astype(np.float64)
if ds.nodata is not None: dem[dem==ds.nodata]=np.nan
_to_dem=Transformer.from_crs("EPSG:4326",ds.crs,always_xy=True)   # identity for WGS84 inputs
def dem_at(lon,lat):
    X,Y=_to_dem.transform(lon,lat)
    c=(X-ds.bounds.left)/ds.res[0]-0.5; r=(ds.bounds.top-Y)/ds.res[1]-0.5
    c=min(max(c,0),ds.width-1.001); r=min(max(r,0),ds.height-1.001)
    c0,r0=int(c),int(r); fc,fr=c-c0,r-r0
    q=[dem[r0,c0],dem[r0,min(c0+1,ds.width-1)],dem[min(r0+1,ds.height-1),c0],dem[min(r0+1,ds.height-1),min(c0+1,ds.width-1)]]
    if any(np.isnan(v) for v in q): return np.nan
    return q[0]*(1-fc)*(1-fr)+q[1]*fc*(1-fr)+q[2]*(1-fc)*fr+q[3]*fc*fr
elev=np.zeros((GH,GW))
for gy in range(GH):
    for gx in range(GW):
        elev[gy,gx]=dem_at(*cell_ll(gx,gy))
raw=elev.copy()                                   # before any filling: sea detection needs the gaps
hole=np.isnan(elev)
if hole.any():
    from scipy.ndimage import distance_transform_edt
    idx=distance_transform_edt(hole,return_distances=False,return_indices=True)
    elev=elev[tuple(idx)]
    print(f"  filled {int(hole.sum())} nodata cells from nearest neighbours")
if DSM_MIN_FILTER: elev=minimum_filter(elev,size=DSM_MIN_FILTER)
elev=gaussian_filter(elev,sigma=DSM_SMOOTH_SIGMA)
SEA=grids.sea_mask(raw) if CFG.get("sea") else np.zeros((GH,GW),bool)
if SEA.any(): print(f"  sea: {int(SEA.sum())} cells")

# ------------------------------------------------------------------ 2. OSM
print("2/5 osm: streets, creeks, buildings ...")
osm=json.load(open(INPUT_OSM))
def clip(pts): return [(x,y) for x,y in pts if LON0-0.001<=x<=LON1+0.001 and LAT0-0.001<=y<=LAT1+0.001]
roads=[]; waters=[]; blds=[]; addressed=[]; named=[]; name_ways={}
for f in osm["features"]:
    p=f.get("properties",{}); g=f["geometry"]
    if "highway" in p and p["highway"] in ROAD_CLASS and g["type"]=="LineString":
        pts=clip(g["coordinates"])
        if len(pts)<2: continue
        w=douglas_peucker([(wx(x),wy(y)) for x,y in pts],2.5)
        rd={"c":ROAD_CLASS[p["highway"]],"p":[[round(x,1),round(y,1)] for x,y in w]}
        if p.get("name"): rd["n"]=p["name"]          # kept so the UI can highlight a whole street
        roads.append(rd)
        if p.get("name"): name_ways.setdefault(p["name"],[]).append(w)
    elif "waterway" in p and p["waterway"] in CREEK_TAGS and g["type"]=="LineString":
        pts=clip(g["coordinates"])
        if len(pts)<2: continue
        w=douglas_peucker([(wx(x),wy(y)) for x,y in pts],2.0)
        waters.append({"n":p.get("name",""),"p":[[round(x,1),round(y,1)] for x,y in w]})
    elif "building" in p and g["type"] in ("Polygon","MultiPolygon"):
        ring=g["coordinates"][0] if g["type"]=="Polygon" else g["coordinates"][0][0]
        cx=sum(q[0] for q in ring)/len(ring); cy=sum(q[1] for q in ring)/len(ring)
        if LON0<=cx<=LON1 and LAT0<=cy<=LAT1:
            blds.append((wx(cx),wy(cy)))
            if p.get("addr:housenumber") and p.get("addr:street"):
                addressed.append({"x":wx(cx),"y":wy(cy),"lon":cx,"lat":cy,"hn":p["addr:housenumber"],"street":p["addr:street"]})
            if p.get("name"):
                named.append({"x":wx(cx),"y":wy(cy),"lon":cx,"lat":cy,"name":p["name"]})

# footprints from the pipeline replace OSM's building dots (OSM still supplies addresses and names for siting)
ALLFOOT=[]; FOOT=[]
if CFG.get("buildings"):
    ALLFOOT=json.load(open(CFG["buildings"],encoding="utf-8"))["features"]
    FOOT=[f for f in ALLFOOT if LON0<=f["properties"]["px"]<=LON1 and LAT0<=f["properties"]["py"]<=LAT1]
    blds=[(wx(f["properties"]["px"]),wy(f["properties"]["py"])) for f in FOOT]
    print(f"  {len(FOOT)} footprints in the frame ({len(ALLFOOT)} cut)")

# street mask + carve
street=np.zeros((GH,GW),bool)
for r in roads:
    wide = r["c"]=="major"; w=r["p"]
    for i in range(len(w)-1):
        (x1,y1),(x2,y2)=w[i],w[i+1]; L=math.hypot(x2-x1,y2-y1); n=max(int(L/(W/GW*0.5)),1)
        for k in range(n+1):
            gx=int((x1+(x2-x1)*k/n)/W*GW); gy=int((y1+(y2-y1)*k/n)/H*GH)
            if 0<=gx<GW and 0<=gy<GH:
                street[gy,gx]=True
                if wide:
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        if 0<=gx+dx<GW and 0<=gy+dy<GH: street[gy+dy,gx+dx]=True
mn=minimum_filter(elev,size=3)
elev[street]=mn[street]-STREET_CARVE_M

# creek mask: water may always run along a creek, however built-up its banks are
creek=np.zeros((GH,GW),bool)
for wt in waters:
    w=wt["p"]
    for i in range(len(w)-1):
        (x1,y1),(x2,y2)=w[i],w[i+1]; L=math.hypot(x2-x1,y2-y1); n=max(int(L/(W/GW*0.5)),1)
        for k in range(n+1):
            gx=int((x1+(x2-x1)*k/n)/W*GW); gy=int((y1+(y2-y1)*k/n)/H*GH)
            if 0<=gx<GW and 0<=gy<GH: creek[gy,gx]=True

# buildings as obstacles (spec §6.2): built fraction → blocked cells; footprints counted per cell
BLOCK=SEA.copy(); BC=None
if CFG.get("buildings"):
    frac=grids.built_fraction([f["geometry"] for f in ALLFOOT],(LON0,LAT0,LON1,LAT1),GW,GH)
    BLOCK=grids.block_mask(frac,street,creek,SEA)
    BC=grids.counts([(min(int(x/W*GW),GW-1),min(int(y/H*GH),GH-1)) for x,y in blds],GW,GH)
    print(f"  blocked: {int((BLOCK&~SEA).sum())} built-up cells of {GW*GH}")

# ------------------------------------------------------------------ 3. NOAH
print("3/5 noah: rasterizing hazard polygons (even-odd scanline) ...")
def rasterize_noah(path):
    sf=shapefile.Reader(path); grid=np.zeros((GH,GW),np.uint8)
    cell_y=[cell_ll(0,gy)[1] for gy in range(GH)]; cell_x=np.array([cell_ll(gx,0)[0] for gx in range(GW)])
    for si in range(sf.numRecords):
        var=int(round(sf.record(si)[0])); shp=sf.shape(si)
        pts=shp.points; parts=list(shp.parts)+[len(pts)]; E=[]
        for pi in range(len(parts)-1):
            ring=pts[parts[pi]:parts[pi+1]]
            xs=[q[0] for q in ring]; ys=[q[1] for q in ring]
            if max(xs)<LON0 or min(xs)>LON1 or max(ys)<LAT0 or min(ys)>LAT1: continue
            E += [(ring[i][0],ring[i][1],ring[i+1][0],ring[i+1][1]) for i in range(len(ring)-1)]
        if not E: continue
        E=np.array(E); x1,y1,x2,y2=E[:,0],E[:,1],E[:,2],E[:,3]
        for gy,cy in enumerate(cell_y):
            m=(y1<=cy)!=(y2<=cy)
            if not m.any(): continue
            xc=np.sort(x1[m]+(cy-y1[m])*(x2[m]-x1[m])/(y2[m]-y1[m]))
            inside=np.searchsorted(xc,cell_x)%2==1
            grid[gy,inside]=np.maximum(grid[gy,inside],var)
    return grid
def noah_geojson(path):
    """A clipped NOAH GeoJSON → grid of hazard class (highest wins); None when the pipeline found no map."""
    if not os.path.exists(path): return None
    fs=sorted(json.load(open(path,encoding="utf-8"))["features"],key=lambda f:f["properties"]["Var"])
    return grids.rasterize(((f["geometry"],int(f["properties"]["Var"])) for f in fs),(LON0,LAT0,LON1,LAT1),GW,GH)
if INPUT_NOAH=="geojson":
    noah={rp:noah_geojson(f"{CFG['noah_dir']}/noah_{rp}.geojson") for rp in ("5","25","100")}
else:
    noah={k:rasterize_noah(v) for k,v in INPUT_NOAH.items()} if INPUT_NOAH else {}

# ------------------------------------------------------------------ 4. sensors
print("4/5 sensors: siting on buildings, referencing to street cells ...")
MDEG_X=111320*math.cos(math.radians((LAT0+LAT1)/2)); MDEG_Y=110640
MX=(LON1-LON0)*MDEG_X/W; MY=(LAT1-LAT0)*MDEG_Y/H          # metres per world unit
def dist_pt_seg(px,py,ax,ay,bx,by):
    dx,dy=bx-ax,by-ay; L2=dx*dx+dy*dy
    t=0 if L2==0 else max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L2))
    return math.hypot((px-(ax+t*dx))*MX,(py-(ay+t*dy))*MY)
def dist_to_street(px,py,name):
    return min((dist_pt_seg(px,py,*r["p"][i],*r["p"][i+1]) for r in roads if r.get("n")==name for i in range(len(r["p"])-1)),default=1e9)
def nearest_other_street(px,py,own):
    best=(1e9,None)
    for r in roads:
        n=r.get("n")
        if not n or n==own: continue
        for i in range(len(r["p"])-1):
            dd=dist_pt_seg(px,py,*r["p"][i],*r["p"][i+1])
            if dd<best[0]: best=(dd,n)
    return best
def shortSt(n): return n.replace(" Street"," St").replace(" Avenue"," Ave").replace(" Road"," Rd")
def nearest_cell(mask,gx,gy,R=10):
    for r in range(R+1):
        for dy in range(-r,r+1):
            for dx in range(-r,r+1):
                if max(abs(dx),abs(dy))!=r: continue
                x,y=gx+dx,gy+dy
                if 0<=x<GW and 0<=y<GH and mask[y,x]: return x,y
    return None
def auto_units():
    """Campus units (spec §6.3): score every footprint near a street, unit 01 on campus, the rest ≥ 300 m apart."""
    from shapely.geometry import shape, Point
    cell_m=(LON1-LON0)*MDEG_X/GW
    score=placement.score(elev,noah,grids.dist_m(creek,cell_m),cell_m,valid=~SEA)
    geom=shape(json.load(open(CFG["outline"],encoding="utf-8"))["features"][0]["geometry"])
    has_outline=geom.geom_type in ("Polygon","MultiPolygon"); c=CFG["campus"]
    def on_campus(lon,lat):
        if has_outline: return geom.contains(Point(lon,lat))
        return math.hypot((lon-c["lon"])*MDEG_X,(lat-c["lat"])*MDEG_Y)<=150
    pts=[]
    for f in FOOT:
        p=f["properties"]; x,y=wx(p["px"]),wy(p["py"])
        pts.append(dict(fid=p["fid"],px=p["px"],py=p["py"],x=x,y=y,cx=min(int(x/W*GW),GW-1),cy=min(int(y/H*GH),GH-1),
                        x_m=x*MX,y_m=y*MY,oc=on_campus(p["px"],p["py"])))
    cands=campus_model.candidates(pts,score,street,SEA,cell_m)
    bfeats=json.load(open(CFG["barangays"],encoding="utf-8"))["features"]
    bgrid=grids.label_polys([f["geometry"] for f in bfeats],(LON0,LAT0,LON1,LAT1),GW,GH)
    bnames=[f["properties"]["name"] for f in bfeats]
    def ok(cd):                                   # asked only of a house about to be chosen
        dn,st=nearest_other_street(cd["x"],cd["y"],"")
        b=int(bgrid[cd["cy"],cd["cx"]]); cell=nearest_cell(street,cd["cx"],cd["cy"])
        if not st or dn>200 or b==0 or cell is None or SEA[cell[1],cell[0]]: return False
        cd["street"],cd["brgy"],cd["cell"]=st,bnames[b-1],cell
        return True
    chosen,spacing=placement.pick(cands,ok=ok)
    out=[]
    for k,cd in enumerate(chosen,1):
        cx,cy=cd["cell"]
        out.append({"id":f"BW-{SITE_ID.upper()}-{k:02d}","street":cd["street"],"hn":"","near":None,
                    "x":round(float(cd["x"]),1),"y":round(float(cd["y"]),1),"cx":cx,"cy":cy,
                    "lon":round(cd["px"],5),"lat":round(cd["py"],5),"g":round(float(elev[cy,cx]),2),
                    "bld":f"near {shortSt(cd['street'])} · {cd['brgy']}","short":shortSt(cd["street"]),
                    "oc":bool(cd["oc"]),"brgy":cd["brgy"],"fid":cd["fid"]})
        print(f"  {out[-1]['id']} → {out[-1]['bld']}{' (on campus)' if cd['oc'] else ''} score {cd['score']:.2f}")
    print(f"  {len(cands)} candidate houses; spacing {spacing:.0f} m")
    return out,spacing,bgrid,bnames,has_outline

sensors=[]
for sid,st,lon,lat in ([] if SENSOR_TARGETS=="auto" else SENSOR_TARGETS):
    tx,ty=wx(lon),wy(lat)
    if sid in CFG.get("fixed",set()):
        b={"x":tx,"y":ty,"lon":lon,"lat":lat,"name":st}                # sited at the coordinate itself
    else:
        if CFG["site_by"]=="address":
            cands=[b for b in addressed if b["street"]==st]
            assert cands, f"no addressed building on {st}"
        else:
            cands=[b for b in named if b["name"]==st]
            assert cands, f"no building named {st}"
        b=min(cands,key=lambda b:(b["x"]-tx)**2+(b["y"]-ty)**2)
    x,y=b["x"],b["y"]
    if CFG["site_by"]=="address" and sid not in CFG.get("fixed",set()):
        dst=dist_to_street(x,y,st); assert dst<30, f"{sid}: {dst:.0f} m from {st}"
        street_name=st; bld=None
        dnear,near=nearest_other_street(x,y,st)
    else:
        dst=min((dist_pt_seg(x,y,*w["p"][i],*w["p"][i+1]) for w in waters for i in range(len(w["p"])-1)),default=1e9)
        assert dst<90, f"{sid}: {dst:.0f} m from any creek"
        dn_st,street_name=nearest_other_street(x,y,"")     # nearest named way is the unit's street
        assert street_name, f"{sid}: no named way nearby"
        bld=st; dnear,near=1e9,None
    lon,lat=b["lon"],b["lat"]
    gx=min(int(x/W*GW),GW-1); gy=min(int(y/H*GH),GH-1)
    own=np.zeros((GH,GW),bool)
    for r in roads:
        if r.get("n")!=street_name: continue
        w=r["p"]
        for i in range(len(w)-1):
            (x1,y1),(x2,y2)=w[i],w[i+1]; L=math.hypot(x2-x1,y2-y1); n=max(int(L/(W/GW*0.5)),1)
            for k in range(n+1):
                ox=int((x1+(x2-x1)*k/n)/W*GW); oy=int((y1+(y2-y1)*k/n)/H*GH)
                if 0<=ox<GW and 0<=oy<GH: own[oy,ox]=True
    best=None
    for R in range(0,10):
        for dy in range(-R,R+1):
            for dx in range(-R,R+1):
                if max(abs(dx),abs(dy))!=R: continue
                if 0<=gx+dx<GW and 0<=gy+dy<GH and own[gy+dy,gx+dx]: best=(gx+dx,gy+dy); break
            if best: break
        if best: break
    if best is None:                                            # own street too far in grid terms: any carved street cell
        for R in range(0,10):
            for dy in range(-R,R+1):
                for dx in range(-R,R+1):
                    if max(abs(dx),abs(dy))!=R: continue
                    if 0<=gx+dx<GW and 0<=gy+dy<GH and street[gy+dy,gx+dx]: best=(gx+dx,gy+dy); break
                if best: break
            if best: break
    assert best is not None, f"{sid}: no street cell within 10 cells"
    assert not hole[best[1],best[0]], f"{sid}: sensor cell is a DEM hole"
    rec={"id":sid,"street":street_name,"hn":b.get("hn",""),"near":near if dnear<150 else None,
         "x":round(float(x),1),"y":round(float(y),1),
         "cx":best[0],"cy":best[1],"lon":round(lon,5),"lat":round(lat,5),
         "g":round(float(elev[best[1],best[0]]),2)}
    if bld: rec["bld"]=CFG.get("unit_names",{}).get(sid,bld)     # name-sited units only; address-sited records stay unchanged
    if sid in CFG.get("short",{}): rec["short"]=CFG["short"][sid]
    if sid in CFG.get("label_pos",{}): rec["lp"]=CFG["label_pos"][sid]
    sensors.append(rec)
    print(f"  {sid} → {bld or b.get('hn','')} {street_name}  ({dst:.0f} m from {'creek' if bld else 'street'}; near {near}, {dnear:.0f} m)")

if SENSOR_TARGETS=="auto":
    sensors,SPACING,BGRID,BNAMES,HAS_OUTLINE=auto_units()

# ------------------------------------------------------------------ 5. labels + encode
print("5/5 labels + encoding ...")
if LABEL_STREETS=="auto":                         # campuses: the longest named main roads
    lens={}
    for r in roads:
        if r.get("n") and r["c"] in ("major","mid"):
            lens[r["n"]]=lens.get(r["n"],0)+sum(math.hypot(r["p"][i+1][0]-r["p"][i][0],r["p"][i+1][1]-r["p"][i][1]) for i in range(len(r["p"])-1))
    LABEL_STREETS=[n for n,_ in sorted(lens.items(),key=lambda kv:(-kv[1],kv[0]))[:12]]
labels=[]
for nm in LABEL_STREETS:
    if nm not in name_ways: continue
    wb=max(name_ways[nm],key=lambda w:sum(math.hypot(w[i+1][0]-w[i][0],w[i+1][1]-w[i][1]) for i in range(len(w)-1)))
    mid=len(wb)//2; a=wb[max(mid-1,0)]; b=wb[min(mid+1,len(wb)-1)]
    ang=math.atan2(b[1]-a[1],b[0]-a[0])
    if ang>math.pi/2 or ang<-math.pi/2: ang+=math.pi
    labels.append({"n":nm.replace(" Street"," St").replace(" Avenue"," Ave").replace(" Road"," Rd"),
                   "x":round(wb[mid][0],1),"y":round(wb[mid][1],1),"a":round(ang,3)})
for wt in waters:
    if wt["n"] and wt["n"] not in [l["n"] for l in labels] and len(wt["p"])>3:
        p=wt["p"]; mid=len(p)//2; a,b=p[mid-1],p[min(mid+1,len(p)-1)]
        ang=math.atan2(b[1]-a[1],b[0]-a[0])
        if ang>math.pi/2 or ang<-math.pi/2: ang+=math.pi
        labels.append({"n":wt["n"],"x":p[mid][0],"y":p[mid][1],"a":round(ang,3),"w":1})

noah_ok={k:v for k,v in noah.items() if v is not None}
data={"W":W,"H":H,"GW":GW,"GH":GH,"bbox":[LON0,LAT0,LON1,LAT1],
      "elev":b64(np.clip(np.round(elev*10),0,32000).astype("<i2")),
      "elev_min":float(elev.min()),"elev_max":float(elev.max()),
      "blds":"","nb":len(blds),
      "roads":roads,"waters":waters,"labels":labels,"sensors":sensors,
      "noah":{k:rle(v) for k,v in noah_ok.items()},"street":rle(street.astype(np.uint8))}
if CFG.get("sea"): data["sea"]=rle(SEA.astype(np.uint8))
if CFG.get("buildings"): data["block"]=rle(BLOCK.astype(np.uint8)); data["bc"]=rle(BC)
data["site"]={k:CFG[k] for k in ("id","name","place","profile","langs","units","emergency","attribution","tz","utc")}
if "g_ref" in CFG: data["site"]["g_ref"]=CFG["g_ref"]
data["site"]["scen"]={k:{"label":v[0],"P":v[1],"dur":v[2],"start":v[3]} for k,v in CFG["scen"].items()}
data["site"]["hazard"]=bool(noah_ok)
data["site"]["noah_missing"]=[rp for rp in ("5","25","100") if CFG["noah"] and rp not in noah_ok]
data["site"]["terrain"]=CFG.get("terrain","")
if "campus" in CFG:
    data["site"]["campus"]=CFG["campus"]
    data["card"]=campus_model.card(sensors,SPACING,BGRID,BNAMES,{rp:noah.get(rp) for rp in ("5","25","100")},SEA,HAS_OUTLINE)
# building dots last: thin them evenly if the file would pass its budget (the count and the model keep every footprint)
base=len(json.dumps(data,separators=(",",":"),ensure_ascii=False).encode())
nmax=max(int((BUDGET-base)/5.34),1)
step=1 if len(blds)<=nmax else math.ceil(len(blds)/nmax)
data["blds"]=b64(np.array([[int(x*10),int(y*10)] for x,y in blds[::step]],dtype="<u2").reshape(-1,2))
data["thin"]=step
if step>1: print(f"  building dots thinned 1 in {step} to fit {BUDGET} bytes")
os.makedirs(os.path.dirname(OUTPUT) or ".",exist_ok=True)
json.dump(data,open(OUTPUT,"w",encoding="utf-8"),separators=(",",":"),ensure_ascii=False)
print(f"wrote {OUTPUT}: {os.path.getsize(OUTPUT)//1024} KB · {len(blds)} buildings · {len(roads)} road ways · "
      f"{len(waters)} creek segments · terrain {elev.min():.1f}–{elev.max():.1f} m")
for s in sensors: print(f"  {s['id']} {s['hn']:>5s} {s['street']:20s} street cell ({s['cx']},{s['cy']}) ground {s['g']:.1f} m")
```

- [ ] **Step 5: Replace `tools/build_places.py`**

The changes:
- places go into each `data/<site>.json` as well as `places.json`;
- barangays are found for campuses;
- `reach()` respects blocked cells;
- barangay cells are rasterised (fast for the hundred-odd small barangays of a Manila box).

```python
#!/usr/bin/env python3
"""Places: every sensor street and barangay the page can answer for, with NOAH flags and connected sensors
(spec §3, §7). Each site's list goes into its own data/<site>.json ("places", fetched with the site) and all of
them into places.json (the Worker's copy). Run from the repo root after build_data.py: python3 tools/build_places.py"""
import base64, glob, heapq, json, math, os, re, statistics, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from model import grids  # noqa: E402
DATA_DIR = os.environ.get("BW_DATA_DIR", os.path.join(ROOT, "data"))
CAMPUS_INPUTS = os.environ.get("CAMPUS_INPUTS", os.path.join(ROOT, "inputs", "campuses"))


def barangays_path(site):
    """The site's barangay polygons: sites/<site>/ for the pilots, the pipeline cut for campuses (None if neither)."""
    for p in (os.path.join(ROOT, "sites", site, "barangays.geojson"), os.path.join(CAMPUS_INPUTS, site, "barangays.geojson")):
        if os.path.exists(p):
            return p
    return None


def data_files():
    """{site: path} for every site file in data/ (the country outline is not a site)."""
    return {os.path.basename(p)[:-5]: p for p in sorted(glob.glob(os.path.join(DATA_DIR, "*.json")))
            if os.path.basename(p) != "ph_outline.json"}
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
    """Grid cells whose centre falls inside a barangay GeoJSON feature's polygon (rasterised: fast for the
    hundred-odd small barangays of a Manila box)."""
    m = grids.rasterize([(feature["geometry"], 1)], tuple(d["bbox"]), d["GW"], d["GH"])
    return [(int(cy), int(cx)) for cy, cx in zip(*np.nonzero(m))]

def zone_share(layer, cells):
    """Fraction of `cells` that sit inside a NOAH hazard layer."""
    if not cells: return 0.0
    return sum(1 for cy, cx in cells if layer[cy, cx] >= 1) / len(cells)

def reach(elev, start, cell_m, block=None):
    """Minutes for water to travel from `start` to every cell it can spill into (≤ LOOKAHEAD_MIN), never through
    a blocked cell (≥ 75 % built, or sea: spec §6.2)."""
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
                if block is not None and block[ny, nx]: continue
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
    block = unrle(d["block"], N).reshape(GH, GW).astype(bool) if "block" in d else None
    reaches = {s["id"]: reach(elev, (s["cy"], s["cx"]), cell_m, block) for s in d["sensors"]}

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
    gj = barangays_path(site)
    if gj:
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
    for site, f in data_files().items():
        d = json.load(open(f, encoding="utf-8"))
        d.pop("places", None)
        places = build_site(site, d)
        res["sites"][site] = places
        d["places"] = places
        json.dump(d, open(f, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
        for s in d["sensors"]:
            name = s.get("bld") or ((s.get("hn") + " " if s.get("hn") else "") + s["street"])
            res["sensors"][s["id"]] = {"site": site, "name": name, "lat": s["lat"], "lon": s["lon"]}
        print(site, len(places), "places", os.path.getsize(f), "bytes")
    out = os.environ.get("BW_PLACES", os.path.join(ROOT, "places.json"))
    json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    main()
```

- [ ] **Step 6: The made-up campus passes**

Run: `cd /home/claude/work && ./test_build.sh 2>&1 | head -6`
Expected:
- `ok` for both unit suites;
- `ok   same inputs give a byte-identical campus file`;
- `ok   fixture campus passes the data checks`;
- `ok   the checker catches a broken file`.

It then fails at `tv build` or `tv rebuild`, because `data/tv.json` doesn't exist yet.

- [ ] **Step 7: Build all 27 sites and their places**

```bash
cd /home/claude/work && mkdir -p data && python3 - <<'PY'
import json
g = json.load(open("inputs/campuses/ph_outline.geojson"))
json.dump({"type": g["type"], "coordinates": g["coordinates"]}, open("data/ph_outline.json", "w"), separators=(",", ":"))
PY
for s in tv berkeley $(python3 -c "import sys; sys.path.insert(0, 'pipeline'); import common; print(' '.join(r['id'] for r in common.read_campuses()))"); do
  SITE=$s python3 -W ignore build_data.py > /tmp/bw_build_$s.log 2>&1 && echo "built $s: $(grep -o 'wrote .*' /tmp/bw_build_$s.log | cut -c1-90)" || { echo "FAIL $s"; tail -4 /tmp/bw_build_$s.log; }
done
python3 -W ignore tools/build_places.py
```

Expected:
- 27 `built …` lines, no `FAIL`;
- then 27 lines `<site> <n> places <bytes> bytes`, every size ≤ 450000.

Rulings allowed here, one ledger line each:
- **`no usable candidate on campus`** (e.g. a campus whose outline is a single building with no street within 25 m): set that row's `osm_ref` to `manual` with the same centre, re-run Task 5 Step 7 for that box only (`--only <id>`, fresh `--out`), and copy its `outline.geojson` in.
- **`only k units fit at 200 m`**: stop and report to Gregor. The spec's spacing rules have no further fallback.
- **A file over 450,000 bytes after places**: lower the `BW_BUDGET` default in `build_data.py` (e.g. to 380000) and rebuild **all** sites, so the rebuild check stays exact.

- [ ] **Step 8: Run the build checks**

Run: `cd /home/claude/work && ./test_build.sh 2>&1 | tail -34`
Expected, all `ok`:
- `tv rebuilds identically` and `upd rebuilds identically`;
- the Teachers Village and Berkeley lines;
- 27 site lines like `ok   upd: 3xx KB, 8 units, spacing 300 m, <n> barangays, NOAH x%/y%/z%`;
- `default output is data/<site>.json`.

- [ ] **Step 9: Update the places tests and the Worker test**

Save as `/tmp/bw_update_places_tests.py` and run it from the repo root (`python3 /tmp/bw_update_places_tests.py`):

```python
"""One-off (Task 7): tools/test_places.py reads every data/*.json, finds barangays for campuses too, and no longer
knows a 'diliman' site. Run from the repo root."""
p = "tools/test_places.py"; s = open(p, encoding="utf-8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (old[:90], s.count(old)); s = s.replace(old, new)
rep('''DATA = {"tv": "data.json", "diliman": "data_diliman.json", "berkeley": "data_berkeley.json"}

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_places as BP  # noqa: E402  (helper functions reused, not duplicated, by the tests below)''',
'''sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_places as BP  # noqa: E402  (helper functions reused, not duplicated, by the tests below)
DATA = BP.data_files()      # {site: path} for every data/<site>.json''')
s = s.replace('json.load(open(os.path.join(ROOT, f)))["sensors"]', 'json.load(open(f))["sensors"]')
s = s.replace('d = json.load(open(os.path.join(ROOT, f), encoding="utf-8"))', 'd = json.load(open(f, encoding="utf-8"))')
rep('''        self.assertIn("b", {p["id"].split(":")[1] for p in P["sites"]["diliman"]})''',
    '''        self.assertIn("b", {p["id"].split(":")[1] for p in P["sites"]["upd"]})''')
rep('''            gj = os.path.join(ROOT, "sites", site, "barangays.geojson")
            if not os.path.exists(gj):
                continue''', '''            gj = BP.barangays_path(site)
            if not gj:
                continue''')
rep('''        # I2: every barangay lists the same-site sensors whose point lies inside its polygon
        upc = next(p for p in P["sites"]["diliman"] if p["kind"] == "barangay" and p["name"] == "U.P. Campus")
        self.assertEqual(sorted(upc["inside"]), ["BW-D02", "BW-D04", "BW-D08"])''',
'''        # I2: every barangay lists the same-site sensors whose point lies inside its polygon
        self.assertTrue(any(p["kind"] == "barangay" and p["name"] == "U.P. Campus" for p in P["sites"]["upd"]))''')
rep('''            gj = os.path.join(ROOT, "sites", site, "barangays.geojson")
            feats = {feat["properties"]["pcode"]: feat for feat in json.load(open(gj, encoding="utf-8"))["features"]} if os.path.exists(gj) else {}''',
'''            gj = BP.barangays_path(site)
            feats = {feat["properties"]["pcode"]: feat for feat in json.load(open(gj, encoding="utf-8"))["features"]} if gj else {}''')
rep('''if __name__ == "__main__":''', '''    def test_every_site_file_carries_its_own_places(self):
        self.assertEqual(set(DATA), set(P["sites"]))
        self.assertEqual(len(DATA), 27)                   # 25 campuses and the two pilots
        for site, f in DATA.items():
            self.assertEqual(json.load(open(f, encoding="utf-8"))["places"], P["sites"][site], site)

class Reach(unittest.TestCase):
    def test_water_never_travels_through_a_blocked_cell(self):
        import numpy as np
        elev = np.zeros((9, 9), np.float32); block = np.zeros((9, 9), bool); block[:, 4] = True
        r = BP.reach(elev, (4, 1), 15.0, block)
        self.assertTrue((4, 3) in r and not any(x >= 4 for _, x in r))
        block[4, 4] = False                               # a street through the wall
        self.assertIn((4, 7), BP.reach(elev, (4, 1), 15.0, block))

if __name__ == "__main__":''')
open(p, "w", encoding="utf-8").write(s)
print("tools/test_places.py updated")
```

In `worker/test/cron.test.js`, replace:

```js
test('I2: a sensor inside a barangay counts as here: U.P. Campus answers Oo when BW-D02 reads 30 cm', async () => {
  const env = envWith();
  const upc = PLACES.sites.diliman.find((pl) => pl.kind === 'barangay' && pl.name === 'U.P. Campus');
  await env.DB.prepare('INSERT INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind('BW-D02', NOW - 60000, 30).run();
```

with:

```js
test('I2: a sensor inside a barangay counts as here: a UP Diliman barangay answers Oo when its unit reads 30 cm', async () => {
  const env = envWith();
  const upc = PLACES.sites.upd.find((pl) => pl.kind === 'barangay' && pl.inside.length);
  await env.DB.prepare('INSERT INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind(upc.inside[0], NOW - 60000, 30).run();
```

Run: `cd /home/claude/work && python3 -W ignore tools/test_places.py 2>&1 | tail -3 && (cd worker && node --test --no-warnings test/*.test.js 2>&1 | grep -E "^# (pass|fail)")`
Expected: `Ran 12 tests … OK`, `# pass 46`, `# fail 0`.

- [ ] **Step 10: Commit**

```bash
cd /home/claude/work && git add sites.py build_data.py tools/build_places.py tools/check_site_data.py tools/test_places.py model/tests/fixture_campus.py test_build.sh data places.json worker/test/cron.test.js && git commit -q -m "Site data: 25 campuses and 2 pilots on FABDEM with buildings as obstacles, automatic units, partnership card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 8: The page fetches one site at a time (router, loading, failure, old links)

**Files:**
- Create: `tools/test_server.js`, `test_pages.sh`, `test_routes.js`
- Modify: `build_html.py` (replace), `template.html` (edit script), every existing `test_*.js` (edit script)
- Delete: `data.json`, `data_diliman.json`, `data_berkeley.json`

**Interfaces:**
- Consumes: `data/<site>.json` with `places` (Task 7); `pipeline/common.read_campuses`.
- Produces:
  - **Page globals** used by Tasks 9–12 and the tests:
    - `CAMPUSES`, `CAMPUS_BY_ID`, `isCampus(id)`, `SITE_IDS`, `LEGACY_SITES`
    - `DATA_ALL` (a cache), `loadSiteData(id) -> Promise`
    - `ROUTE` ("ph" | "site" | "loading" | "fail"), `siteBooted`
    - `go(h, ctx)`, `showRoute(r)`, `markReady(id)`: body `data-ready` is the site id, "ph" or "fail"
    - `NAT_EN`, `NAT_LANGS`, `NL()`, `siteLabel(id)`
  - **Markup:**
    - `#nat` (a placeholder section with its own tab row);
    - `#route-loading #load-msg`;
    - `#route-fail #fail-msg #load-retry #fail-back`;
    - tab rows `ph, tv, berkeley, try` in all three navs.
  - **Test harness:**
    - `./test_pages.sh [suite …]` serves the repo at `http://127.0.0.1:8765/` with gzip;
    - suites read `BASE` from `BW_BASE`;
    - live builds are written to `_bw_*.html` in the repo (git-ignored).

The spec's §3.1–3.3 routes are all here. Plain links, `#ph` and unknown hashes go to the national map; the map itself arrives in Task 10.

- [ ] **Step 1: The test server and runner**

`tools/test_server.js`:

```js
// Static server for the page tests: the repo over http://127.0.0.1:<port>/ with gzip, the way GitHub Pages serves it.
// The page fetches data/<site>.json, which file:// URLs can't do.  node tools/test_server.js  (BW_PORT, default 8765)
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml' };
function start(port = Number(process.env.BW_PORT || 8765)) {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const f = path.resolve(ROOT, rel);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    const body = fs.readFileSync(f), head = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); res.end(zlib.gzipSync(body)); }
    else { res.writeHead(200, head); res.end(body); }
  });
  return new Promise((resolve) => srv.listen(port, '127.0.0.1', () => resolve(srv)));
}
if (require.main === module) start().then(() => console.log('serving', ROOT));
module.exports = { start };
```

`test_pages.sh`:

```bash
#!/bin/bash
# Page tests (Playwright). They need http:// because the page fetches data/<site>.json, so this starts the
# gzip test server, runs each suite, and stops it.   ./test_pages.sh            # every suite
#                                                    ./test_pages.sh test_try.js   # one
cd "$(dirname "$0")"
node tools/test_server.js > /tmp/bw_test_server.log 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null http://127.0.0.1:8765/index.html && break; sleep 0.1; done
SUITES=${@:-$(ls test_*.js)}
fail=0
for t in $SUITES; do
  node "$t" > "/tmp/bw_$t.log" 2>&1; code=$?
  n=$(grep -c '^ok' "/tmp/bw_$t.log")
  if [ $code -ne 0 ] || grep -q '^FAIL' "/tmp/bw_$t.log"; then echo "FAIL $t ($n ok)"; grep '^FAIL' "/tmp/bw_$t.log" | head -5; fail=1; else echo "ok   $t ($n checks)"; fi
done
exit $fail
```

- [ ] **Step 2: Write the failing routing test**

`test_routes.js`:

```js
// Routing and on-demand site files (spec §3.1–3.3, §7.3): plain link → national map, one file per site, the latest
// choice wins, a failed file shows a retry, old Diliman links and home-screen relaunches land on the campus.
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>x?document.body.dataset.ready===x:!!document.body.dataset.ready,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const files=[];pg.on('request',r=>{const m=r.url().match(/\/data\/(\w+)\.json/);if(m)files.push(m[1]);});
  await pg.goto(U);await ready(pg,"ph");
  let s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,nat:getComputedStyle(document.getElementById('nat')).display,pub:getComputedStyle(document.getElementById('public')).display,booted:siteBooted}));
  assert(s.route==="ph"&&s.hash===""&&s.nat!=="none"&&s.pub==="none"&&!s.booted,"a plain link opens the national map and loads no site");
  assert(files.length===0,"no site file fetched for the national map: "+files);
  await pg.evaluate(()=>{location.hash="#tv";});await ready(pg,"tv");
  s=await pg.evaluate(()=>({route:ROUTE,site:SITE,loaded:Object.keys(DATA_ALL)}));
  assert(s.route==="site"&&s.site==="tv"&&s.loaded.join()==="tv"&&files.join()==="tv","#tv fetches data/tv.json only: "+files);
  await pg.evaluate(()=>{location.hash="#ph";});await ready(pg,"ph");
  await pg.evaluate(()=>{location.hash="#tv";});await ready(pg,"tv");
  assert(files.join()==="tv","going back to a site does not fetch its file again: "+files);
  await pg.goBack();await ready(pg,"ph");await pg.goBack();await ready(pg,"tv");
  assert(await pg.evaluate(()=>ROUTE==="site"&&SITE==="tv"),"browser Back and Forward move between the national map and the site");

  // latest choice wins: UP Diliman is slow, then UC Berkeley is chosen; Diliman's late file must not take over
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));
  let release;const held=new Promise(r=>{release=r;});
  await pg2.route('**/data/upd.json',async r=>{await held;r.continue();});
  await pg2.goto(U);await ready(pg2,"ph");
  await pg2.evaluate(()=>{location.hash="#upd";});await pg2.waitForTimeout(150);
  s=await pg2.evaluate(()=>({route:ROUTE,msg:document.getElementById('load-msg').textContent,shown:getComputedStyle(document.getElementById('route-loading')).display}));
  assert(s.route==="loading"&&/Loading UP Diliman/.test(s.msg)&&s.shown!=="none","a slow file shows 'Loading UP Diliman…': "+s.msg);
  await pg2.evaluate(()=>{location.hash="#berkeley";});await ready(pg2,"berkeley");
  release();await pg2.waitForTimeout(600);
  s=await pg2.evaluate(()=>({site:SITE,hash:location.hash,ready:document.body.dataset.ready}));
  assert(s.site==="berkeley"&&s.hash==="#berkeley"&&s.ready==="berkeley","latest choice wins: Berkeley stays after Diliman's late file: "+JSON.stringify(s));

  // a file that fails: message, focus on Try again, retry loads it
  const pg3=await ctx.newPage();pg3.on('pageerror',e=>errs.push(e.message));
  let fail=true;await pg3.route('**/data/upd.json',r=>fail?r.abort():r.continue());
  await pg3.goto(U+'#upd');await ready(pg3,"fail");
  s=await pg3.evaluate(()=>({route:ROUTE,msg:document.getElementById('fail-msg').textContent,focus:document.activeElement.id,btn:document.getElementById('load-retry').textContent,back:document.getElementById('fail-back').getAttribute('href')}));
  assert(s.route==="fail"&&/UP Diliman didn.t load/.test(s.msg)&&s.focus==="load-retry"&&s.btn==="Try again"&&s.back==="#ph","a failed file: message, 'Try again' focused, a way back to all campuses: "+s.msg);
  fail=false;await pg3.click('#load-retry');await ready(pg3,"upd");
  assert(await pg3.evaluate(()=>ROUTE==="site"&&SITE==="upd"),"Try again loads the campus once the file arrives");

  // old UP Diliman links and a home-screen relaunch that saved #diliman
  const pg4=await ctx.newPage();pg4.on('pageerror',e=>errs.push(e.message));
  await pg4.goto(U+'#diliman');await ready(pg4,"upd");
  assert(await pg4.evaluate(()=>SITE==="upd"&&location.hash==="#upd"),"#diliman opens the UP Diliman campus and rewrites the link to #upd");
  const code=await pg4.evaluate(()=>PLACES.sites.upd.find(p=>p.kind==="barangay").id.split(":")[2]);
  const pg5=await ctx.newPage();pg5.on('pageerror',e=>errs.push(e.message));             // share links open in a fresh tab
  await pg5.goto(U+'#p.diliman.b.'+code);await ready(pg5,"upd");
  s=await pg5.evaluate(()=>({site:SITE,place:myPlace}));
  assert(s.site==="upd"&&s.place==="upd:b:"+code,"an old #p.diliman.b.<pcode> share link opens that barangay on the campus: "+JSON.stringify(s));
  await pg4.evaluate(()=>localStorage.setItem("bw-last-hash","#diliman"));
  await pg4.goto(U+'?source=pwa');await ready(pg4,"upd");
  assert(await pg4.evaluate(()=>SITE==="upd"&&ROUTE==="site"),"home-screen relaunch with a saved #diliman lands on the campus");
  await pg4.evaluate(()=>localStorage.setItem("bw-last-hash",""));
  await pg4.goto(U+'?source=pwa');await ready(pg4,"ph");
  assert(await pg4.evaluate(()=>ROUTE==="ph"),"home-screen relaunch after the national map returns to the national map");

  // Try reporting from a campus page, before Teachers Village's file is loaded: no half-switched frame
  const pg6=await ctx.newPage();pg6.on('pageerror',e=>errs.push(e.message));
  await pg6.route('**/data/tv.json',async r=>{await new Promise(z=>setTimeout(z,400));r.continue();});
  await pg6.goto(U+'#upd');await ready(pg6,"upd");
  await pg6.click('#public .site-tabs [data-site="try"]');await pg6.waitForTimeout(150);
  s=await pg6.evaluate(()=>({route:ROUTE,t:TRY,site:SITE}));
  assert(s.route==="loading"&&!s.t&&s.site==="upd","while Teachers Village loads, the page is not yet in the Try tab: "+JSON.stringify(s));
  await ready(pg6,"tv");await pg6.waitForTimeout(200);
  assert(await pg6.evaluate(()=>TRY&&SITE==="tv"&&location.hash==="#try"),"then the Try tab opens on Teachers Village");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

Run: `cd /home/claude/work && chmod +x test_pages.sh && ./test_pages.sh test_routes.js`
Expected: `FAIL test_routes.js`. The plain link still opens Teachers Village, and `ready` never becomes "ph" (a waitForFunction timeout).

- [ ] **Step 3: Move the existing suites to the server and the new defaults**

Save as `/tmp/bw_update_tests.py` and run it from the repo root. Every edit asserts it matched exactly once.

The script does three things:
- It changes URLs from `file://` to `BASE`, and a plain link that meant Teachers Village becomes `#tv`.
- It waits for `data-ready`, and points tab clicks at `#public .site-tabs`.
- It moves Diliman to the `upd` campus, updates the tab row to `ph,tv,berkeley,try`, and replaces the 56 m check with a median check.

```python
"""One-off (Task 8): move the page tests to the http test server, the national-map default and on-demand site
files. Run from the repo root: python3 /tmp/bw_update_tests.py. Every edit must match exactly once."""
import glob, re

W = "file:///home/claude/work/bahawatch_dashboard.html"
for f in sorted(glob.glob("test_*.js")):
    s = open(f, encoding="utf-8").read(); o = s
    s = s.replace(f"goto('{W}')", "goto(BASE+'bahawatch_dashboard.html#tv')")          # a plain link meant Teachers Village
    s = s.replace(f"'{W}#", "BASE+'bahawatch_dashboard.html#")
    s = s.replace(f"='{W}';", "=BASE+'bahawatch_dashboard.html';")
    s = s.replace("'file:///tmp/bw_", "BASE+'_bw_").replace("OUT=/tmp/bw_", "OUT=/home/claude/work/_bw_")
    s = s.replace("'.site-tabs [", "'#public .site-tabs [")                            # the national map has its own tab row first
    # wait for the site's data file (the page marks body[data-ready]) before the old fixed pause
    s = re.sub(r"await (\w+)\.goto\(([^;]*?)\);await \1\.waitForTimeout", r"await \1.goto(\2);await \1.waitForFunction(()=>document.body.dataset.ready);await \1.waitForTimeout", s)
    if s != o:
        s = re.sub(r"^(const \{chromium\}=require\('playwright'\);)", r"\1\nconst BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';", s, count=1, flags=re.M)
        assert "const BASE=" in s, f
    assert "file://" not in s, (f, re.findall(r"file://\S+", s)[:3])
    open(f, "w", encoding="utf-8").write(s)


def edit(f, pairs):
    s = open(f, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (f, old[:100], s.count(old))
        s = s.replace(old, new)
    open(f, "w", encoding="utf-8").write(s)
READY = "await pg.waitForFunction(()=>document.body.dataset.ready);"

# ---- test_answer.js: U is only ever opened bare; places now arrive per site; I2 moves from Diliman to the UP Diliman campus
s = open("test_answer.js", encoding="utf-8").read()
i = s.index('  // I2: a sensor inside a barangay counts as "here" in the demo too')
j = s.index('  assert(s.answer==="oo"&&s.reason.key==="sensor_now","demo: inside sensor')
s = s[:i] + '''  // I2: a sensor inside a barangay counts as "here" in the demo too — on the UP Diliman campus, a barangay with a unit inside at 30 cm is Oo
  s=await pg.evaluate(()=>loadSiteData("upd").then(()=>{
    switchSite("upd");playing=false;scenario="clear";
    const p=PLACES.sites.upd.find(q=>q.kind==="barangay"&&q.inside.length);
    for(const h of HOUSEHOLD){h.depth=0;h.rate=0;}
    HOUSEHOLD.find(h=>h.id===p.inside[0]).depth=0.30;
    const v=babahaBa(demoInputs(p));
    switchSite("tv");
    return v;
  }));
''' + s[j:]
open("test_answer.js", "w", encoding="utf-8").write(s)
edit("test_answer.js", [
    ("const U=BASE+'bahawatch_dashboard.html';", "const U=BASE+'bahawatch_dashboard.html#tv';"),
    ('''  s=await pg.evaluate(()=>({n:PLACES.sites.tv.length,b:PLACES.sites.tv.some(p=>p.kind==="barangay"),berk:PLACES.sites.berkeley.every(p=>p.kind==="sensor")}));
  assert(s.n>=18&&s.b&&s.berk,"places.json embedded with barangays for Philippine sites only");''',
     '''  s=await pg.evaluate(()=>loadSiteData("berkeley").then(()=>({n:PLACES.sites.tv.length,b:PLACES.sites.tv.some(p=>p.kind==="barangay"),berk:PLACES.sites.berkeley.every(p=>p.kind==="sensor")})));
  assert(s.n>=18&&s.b&&s.berk,"each site's places arrive with its data file; barangays for Philippine sites only");'''),
])

# ---- test_init.js: site files arrive on demand; Diliman is now the upd campus
edit("test_init.js", [
    ('''  const r=await pg.evaluate(()=>{''', '''  await pg.evaluate(()=>Promise.all(["berkeley","upd"].map(loadSiteData)));     // site files arrive on demand
  const r=await pg.evaluate(()=>{'''),
    ('''  assert(r.keys.join()==="tv,diliman,berkeley","three sites embedded");''',
     '''  assert(r.keys.sort().join()==="berkeley,tv,upd","only the sites opened so far are loaded: "+r.keys);'''),
    ('''  assert(r.after.site==="tv"&&r.after.units===8&&r.after.n===35400,"initSite(tv) restores");''',
     '''  assert(r.after.site==="tv"&&r.after.units===8&&r.after.n===35400,"initSite(tv) restores");
  const nd=await pg.evaluate(()=>{try{initSite("uplb");return "no error";}catch(e){return e.message;}});
  assert(nd!=="no error","initSite needs the site's data file first (it isn't fetched here)");'''),
    ('''    switchSite("diliman");''', '''    switchSite("upd");'''),
    ('''  assert(sw.a.place==="UP Diliman, Quezon City"&&sw.a.rows===8&&sw.a.cards===8,"Diliman place line, 8 rows, 8 cards");''',
     '''  assert(/University of the Philippines Diliman/.test(sw.a.place)&&sw.a.rows===8&&sw.a.cards===8,"UP Diliman campus: place line, 8 rows, 8 cards: "+sw.a.place);'''),
])

# ---- test_recent.js: the second site is the upd campus, loaded before switching
s = open("test_recent.js", encoding="utf-8").read()
s = s.replace('switchSite("diliman")', 'loadSiteData("upd").then(()=>switchSite("upd"))').replace("diliman", "upd")
open("test_recent.js", "w", encoding="utf-8").write(s)

# ---- test_sites.js: Teachers Village, Berkeley and one campus with automatic units
edit("test_sites.js", [
    ('''// Sensor siting test, per site. Address-sited units (Teachers Village) must sit on their named street;
// name-sited units (the two campuses) must sit on a named building within 90 m of a mapped creek. Run: node test_sites.js''',
     '''// Sensor siting test, per site. Address-sited units (Teachers Village) must sit on their named street;
// name-sited units (Berkeley) on a named building within 90 m of a mapped creek; automatically placed campus
// units (spec §6.3) are named after a street within 200 m, and unit 01 is on campus. Run: ./test_pages.sh test_sites.js'''),
    ('''for(const site of ["tv","diliman","berkeley"]){''', '''for(const site of ["tv","berkeley","upd"]){'''),
    ('''        return {id:s.id,street:s.street,bld:s.bld,hn:s.hn,own:Math.round(own),nearest:best[1],nd:Math.round(best[0]),creek:Math.round(creek)};''',
     '''        return {id:s.id,street:s.street,bld:s.bld,hn:s.hn,own:Math.round(own),nearest:best[1],nd:Math.round(best[0]),creek:Math.round(creek),oc:DATA.sensors[s.idx].oc};'''),
    ('''      return {site:SITE,rows};''', '''      return {site:SITE,rows,campus:isCampus(SITE)};'''),
    ('''    assert(r0.site===site,`opened #${site}`);''', '''    assert(r0.site===site,`opened #${site}`);
    if(r0.campus){
      assert(r0.rows[0].oc===true&&r0.rows.filter(r=>r.oc).length===1,`${site}: unit 01, and only unit 01, is on campus`);
      for(const r of r0.rows)assert(r.own<=200&&/^near /.test(r.bld),`${site} ${r.id} ${r.bld}: ${r.own} m from ${r.street}`);
      await pg.close();continue;
    }'''),
])

# ---- test_try.js: the tab row starts with PhilDev campuses; only fetches after boot count; leaving writes #tv
edit("test_try.js", [
    ("await pg.goto(U);" + READY + "await pg.waitForTimeout(400);",
     "await pg.goto(U+'#tv');" + READY + "await pg.waitForTimeout(400);\n  net.length=0;                                   // the page and data/tv.json are loaded; from here on nothing may be fetched"),
    ('assert(s.join()==="tv,diliman,berkeley,try"', 'assert(s.join()==="ph,tv,berkeley,try"'),
    ('assert(!s.t&&s.hash===""&&/Mayaman/', 'assert(!s.t&&s.hash==="#tv"&&/Mayaman/'),
    ("await pg3.goto(U);", "await pg3.goto(U+'#tv');"),
])

# ---- test_tabs.js: legacy #diliman, the national map for unknown hashes, the PhilDev campuses tab
edit("test_tabs.js", [
    ('''  await pg.goto(U+'#diliman/details');''' + READY + '''await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW}));
  assert(s.site==="diliman"&&s.view==="details","#diliman/details opens Diliman details");
  await pg.goto(U+'#nowhere');''' + READY + '''await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW,hash:location.hash}));
  assert(s.site==="tv"&&s.view==="public"&&(s.hash===""||s.hash==="#tv"),"unknown hash falls back to Teachers Village: "+s.hash);''',
     '''  await pg.goto(U+'#diliman/details');''' + READY + '''await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW,hash:location.hash}));
  assert(s.site==="upd"&&s.view==="details"&&s.hash==="#upd/details","old #diliman/details opens the UP Diliman campus details: "+s.hash);
  await pg.goto(U+'#nowhere');''' + READY + '''await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,shown:getComputedStyle(document.getElementById('nat')).display}));
  assert(s.route==="ph"&&s.hash===""&&s.shown!=="none","unknown hash opens the national map: "+s.hash);'''),
    ('''  await pg.goto(U);''' + READY, '''  await pg.goto(U+'#tv');''' + READY),
    ('''  await pg.click('#public .site-tabs [data-site="diliman"]');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({site:SITE,hash:location.hash,rows:document.querySelectorAll('#p-all .p-row').length}));
  assert(s.site==="diliman"&&s.hash==="#diliman"&&s.rows===8,"tab click switches site and writes the hash");''',
     '''  await pg.click('#public .site-tabs [data-site="berkeley"]');await pg.waitForFunction(()=>document.body.dataset.ready==="berkeley");await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({site:SITE,hash:location.hash,rows:document.querySelectorAll('#p-all .p-row').length}));
  assert(s.site==="berkeley"&&s.hash==="#berkeley"&&s.rows===9,"tab click switches site and writes the hash");'''),
    ('''  await pg.evaluate(()=>{localStorage.setItem("bw-street:diliman","BW-D04");localStorage.setItem("bw-street:tv","BW-GONE");});
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(200);''',
     '''  await pg.evaluate(()=>{localStorage.setItem("bw-street:upd","BW-UPD-04");localStorage.setItem("bw-street:tv","BW-GONE");});
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);'''),
    ('''  await pg.click('#public .site-tabs [data-site="diliman"]');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({my:myStreet,cap:document.getElementById("p-fig-cap").textContent}));
  assert(s.my==="BW-D04"&&/Integrated School/.test(s.cap),"Diliman remembers its own street: "+s.cap);   // BW-D04 = UP Integrated School K-2 (Task 2 ruling)
  // keyboard
  await pg.focus('#public .site-tabs [aria-selected="true"]');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>SITE);
  assert(s==="berkeley","ArrowRight moves to the next tab");''',
     '''  await pg.goto(U+'#upd');await pg.waitForFunction(()=>document.body.dataset.ready==="upd");await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({my:myStreet,cap:document.getElementById("p-fig-cap").textContent,street:shortSt(HOUSEHOLD.find(h=>h.id==="BW-UPD-04").street)}));
  assert(s.my==="BW-UPD-04"&&s.cap.includes(s.street),"the UP Diliman campus remembers its own street: "+s.cap);
  // keyboard: on a campus page the PhilDev campuses tab is selected; ArrowRight moves to Teachers Village
  s=await pg.evaluate(()=>document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site);
  assert(s==="ph","a campus page selects the 'PhilDev campuses' tab: "+s);
  await pg.focus('#public .site-tabs [aria-selected="true"]');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>SITE);
  assert(s==="tv","ArrowRight moves to the next tab");
  // the PhilDev campuses tab opens the national map; Back returns to the site
  await pg.click('#public .site-tabs [data-site="ph"]');await pg.waitForFunction(()=>document.body.dataset.ready==="ph");
  s=await pg.evaluate(()=>({route:ROUTE,sel:document.querySelector('#nat .site-tabs [aria-selected="true"]').dataset.site}));
  assert(s.route==="ph"&&s.sel==="ph","'PhilDev campuses' tab opens the national map");
  await pg.goBack();await pg.waitForFunction(()=>document.body.dataset.ready==="tv");
  assert(await pg.evaluate(()=>ROUTE==="site"&&SITE==="tv"),"browser Back from the national map returns to Teachers Village");'''),
    ('''  await pg.click('#public .site-tabs [data-site="diliman"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({playing,t:tMin}));''', '''  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({playing,t:tMin}));'''),
    ('''  // Teachers Village keeps v17's storm-response reference (56 m)
  await pg.goto(U+'#tv');''' + READY + '''await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>HOUSEHOLD[0].gRef);
  assert(s===56,"Teachers Village gRef stays 56 m: "+s);
  // a fresh load of #diliman must not overwrite Diliman's stored language with Teachers Village's
  await pg.evaluate(()=>{localStorage.setItem("bw-lang:tv","fil");localStorage.setItem("bw-lang:diliman","ceb");});
  await pg.goto(U+'#diliman');await pg.reload();await pg.waitForTimeout(400);               // a real document load, not a hash change
  s=await pg.evaluate(()=>({lang:LANG,stored:localStorage.getItem("bw-lang:diliman")}));
  assert(s.lang==="ceb"&&s.stored==="ceb","fresh load keeps Diliman's own language: "+JSON.stringify(s));''',
     '''  // storm-response reference: the median of the units' ground heights on every site (spec §6.4; the fixed 56 m is gone)
  await pg.goto(U+'#tv');''' + READY + '''await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>{const g=HOUSEHOLD.map(h=>h.gElev).sort((a,b)=>a-b);return {ref:HOUSEHOLD[0].gRef,med:g[Math.floor(g.length/2)]};});
  assert(s.ref===s.med,"Teachers Village gRef is its units' median ground height: "+JSON.stringify(s));
  // a fresh load of a campus must not overwrite that campus's stored language with Teachers Village's
  await pg.evaluate(()=>{localStorage.setItem("bw-lang:tv","fil");localStorage.setItem("bw-lang:upd","ceb");});
  await pg.goto(U+'#upd');await pg.reload();''' + READY + '''await pg.waitForTimeout(400);   // a real document load, not a hash change
  s=await pg.evaluate(()=>({lang:LANG,stored:localStorage.getItem("bw-lang:upd")}));
  assert(s.lang==="ceb"&&s.stored==="ceb","fresh load keeps the campus's own language: "+JSON.stringify(s));'''),
])
print("tests updated")
```

- [ ] **Step 4: Replace `build_html.py`**

```python
#!/usr/bin/env python3
"""Build bahawatch_dashboard.html from template.html. Site data is not embedded: the page fetches data/<site>.json
when a site is opened. Embedded: the PhilDev campus list (pipeline/campuses.csv) and the shared rule."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline"))
from common import read_campuses  # noqa: E402

tpl = open("template.html", encoding="utf-8").read()
KEYS = ("id", "short", "name", "campus", "group", "type", "city", "province", "lat", "lon")
campuses = [{k: r[k] for k in KEYS} for r in read_campuses() if r["lat"] is not None]   # only campuses with a centre
strip = lambda f: open(f, encoding="utf-8").read().replace("export const ", "const ").replace("export function ", "function ")
verdict = strip("shared/verdict.js")
api_base = os.environ.get("BAHAWATCH_API", "")
sitekey = os.environ.get("TURNSTILE_SITEKEY", "")
for ph in ("__CAMPUSES__", "/*__VERDICT_JS__*/", "__API_BASE__", "__TURNSTILE_SITEKEY__"):
    assert ph in tpl, f"template.html is missing {ph}"
out = (tpl.replace("__CAMPUSES__", json.dumps(campuses, ensure_ascii=False, separators=(",", ":")))
          .replace("/*__VERDICT_JS__*/", verdict)
          .replace("__API_BASE__", json.dumps(api_base)).replace("__TURNSTILE_SITEKEY__", json.dumps(sitekey)))
dest = os.environ.get("OUT", "bahawatch_dashboard.html")
open(dest, "w", encoding="utf-8").write(out)
print(f"{dest} written ({os.path.getsize(dest) // 1024} KB, {len(campuses)} campuses)")
```

- [ ] **Step 5: Edit `template.html`**

Save as `/tmp/bw_task8_template.py` and run it from the repo root. The script:
- adds site loading, `parseHash` routes, `writeHash`, `go()`, `applySiteHash()` and `bootSite()` (the old boot, wrapped);
- makes `selectTab()` route through `go()`;
- adds `markReady` in `switchSite()`;
- adds the three route sections and their CSS;
- adds the `ph` tab.

```python
import sys
p = "template.html"; s = open(p, encoding="utf-8").read()
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:90], s.count(old)); s = s.replace(old, new)
# ---- Task 8: site files on demand, the router, loading/failed routes, the PhilDev campuses tab
rep('''const DATA_ALL=__DATA_ALL__;''','''const CAMPUSES=__CAMPUSES__;          // the PhilDev partner campuses (pipeline/campuses.csv), embedded at build
const CAMPUS_BY_ID=Object.fromEntries(CAMPUSES.map(c=>[c.id,c]));
const isCampus=id=>!!CAMPUS_BY_ID[id];
const PILOTS=["tv","berkeley"];
const SITE_IDS=new Set([...PILOTS,...CAMPUSES.map(c=>c.id)]);
const LEGACY_SITES={diliman:"upd"};  // old tabs → where they live now
const DATA_BASE="data/";             // one file per site, fetched when the site is opened
const DATA_ALL={};                   // site id → its parsed data file (loadSiteData fills it)
const dataInflight={};
function loadSiteData(id){
  if(DATA_ALL[id])return Promise.resolve(DATA_ALL[id]);
  if(!dataInflight[id])dataInflight[id]=fetch(DATA_BASE+id+".json").then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(d=>{DATA_ALL[id]=d;PLACES.sites[id]=d.places||[];delete dataInflight[id];return d;},e=>{delete dataInflight[id];throw e;});
  return dataInflight[id];
}''')
rep('''  NOAH=SITE_CFG.hazard?{"5":unrle(DATA.noah["5"]),"25":unrle(DATA.noah["25"]),"100":unrle(DATA.noah["100"])}:{"5":new Uint8Array(N),"25":new Uint8Array(N),"100":new Uint8Array(N)};''',
'''  NOAH={};for(const k of ["5","25","100"])NOAH[k]=DATA.noah&&DATA.noah[k]?unrle(DATA.noah[k]):new Uint8Array(N);   // a missing NOAH map reads as no hazard''')
rep('''const PLACES=__PLACES__;''','''const PLACES={version:1,sites:{}};   // each site's places arrive inside its data file''')
rep('''function parseHash(){
  TRY=(location.hash||"")==="#try";if(TRY){LIVE=false;return {site:"tv",view:"public"};}
  const tok=(location.hash||"").match(/^#p\\.([a-z]+)\\.(s|b)\\.([A-Za-z0-9-]+)$/);
  if(tok&&DATA_ALL[tok[1]]){SHARE_TOKEN_SEEN=true;SHARED_PLACE=tok[1]+":"+tok[2]+":"+tok[3];return {site:tok[1],view:"public"};}
  const m=(location.hash||"").replace(/^#/,"").split("/");
  if(m[0]==="details")m.unshift("tv");                       // pre-tab links: #details → Teachers Village details
  const site=DATA_ALL[m[0]]?m[0]:"tv", view=m[1]==="details"?"details":"public";
  LIVE=!!API_BASE&&m.slice(1).includes("live");               // #<site>/live and #<site>/details/live are both live
  return {site,view};
}
function writeHash(){if(TRY){history.replaceState(null,"",location.pathname+location.search+"#try");try{localStorage.setItem("bw-last-hash","#try");}catch(e){}return;}
  const plain=SITE==="tv"&&VIEW==="public"&&!LIVE;
  const h=plain?"":"#"+SITE+(VIEW==="details"?"/details":"")+(LIVE?"/live":"");
  history.replaceState(null,"",plain?location.pathname+location.search:h);
  try{localStorage.setItem("bw-last-hash",h);}catch(e){}   // Add to Home Screen: relaunch (?source=pwa, no hash) restores this
}
function syncTabs(){document.querySelectorAll('.site-tabs [role="tab"]').forEach(b=>{const on=TRY?b.dataset.site==="try":b.dataset.site===SITE;b.setAttribute("aria-selected",on?"true":"false");b.tabIndex=on?0:-1;});}''',
'''/* Routes: "ph" (national map: a plain link, #ph, or anything unknown), "site" (#<site>[/details][/live], #try,
   #p.<site>.<s|b>.<code>), and while a site file loads or fails, "loading" / "fail". */
function parseHash(){
  const raw=(location.hash||"").replace(/^#/,"");
  TRY=raw==="try";if(TRY){LIVE=false;return {route:"site",site:"tv",view:"public"};}
  const tok=raw.match(/^p\\.([a-z]+)\\.(s|b)\\.([A-Za-z0-9-]+)$/);
  if(tok){const site=LEGACY_SITES[tok[1]]||tok[1];
    if(SITE_IDS.has(site)){SHARE_TOKEN_SEEN=true;SHARED_PLACE=site+":"+tok[2]+":"+tok[3];return {route:"site",site,view:"public"};}}
  const m=raw.split("/");
  if(m[0]==="details")m.unshift("tv");                       // pre-tab links: #details → Teachers Village details
  if(LEGACY_SITES[m[0]])m[0]=LEGACY_SITES[m[0]];
  if(!SITE_IDS.has(m[0])){LIVE=false;return {route:"ph"};}
  LIVE=!!API_BASE&&m.slice(1).includes("live");               // #<site>/live and #<site>/details/live are both live
  return {route:"site",site:m[0],view:m[1]==="details"?"details":"public"};
}
function writeHash(){
  const h=ROUTE==="ph"?"":TRY?"#try":"#"+SITE+(VIEW==="details"?"/details":"")+(LIVE?"/live":"");
  history.replaceState(null,"",h||location.pathname+location.search);
  try{localStorage.setItem("bw-last-hash",h);}catch(e){}   // Add to Home Screen: relaunch (?source=pwa, no hash) restores this
}
function syncTabs(){const cur=TRY?"try":(ROUTE==="ph"||isCampus(SITE))?"ph":SITE;
  document.querySelectorAll('.site-tabs [role="tab"]').forEach(b=>{const on=b.dataset.site===cur;b.setAttribute("aria-selected",on?"true":"false");b.tabIndex=on?0:-1;});}''')
rep('''window.addEventListener("hashchange",()=>{const wasLive=LIVE,wasTry=TRY;const h=parseHash();
  if(TRY){if(!wasTry)enterTry();return;}
  if(wasTry){exitTry(h.site,true);if(h.view!==VIEW)setView(h.view);writeHash();return;}
  if(h.site!==SITE){switchSite(h.site);syncTabs();}if(h.view!==VIEW)setView(h.view);
  if(LIVE!==wasLive){setPlay(!reducedMotion&&!LIVE);syncLiveUI();renderPublic();drawMap();drawOverlayCanvas();pollNow();}});''',
'''/* Strings for the national map, campus pages and loading (six languages; non-English entries are English copies
   marked _review for native-speaker review, as in earlier rounds). */
const NAT_EN={loading:"Loading {name}…",fail:"{name} didn't load. Check your connection.",retry:"Try again",back:"‹ All campuses"};
const NAT_LANGS={en:NAT_EN,fil:Object.assign({_review:true},NAT_EN),ceb:Object.assign({_review:true},NAT_EN),
  ilo:Object.assign({_review:true},NAT_EN),hil:Object.assign({_review:true},NAT_EN),pam:Object.assign({_review:true},NAT_EN)};
const NL=()=>NAT_LANGS[LANG]||NAT_EN;
const siteLabel=id=>CAMPUS_BY_ID[id]?CAMPUS_BY_ID[id].short:{tv:"Teachers Village",berkeley:"UC Berkeley"}[id]||id;
let ROUTE=null, siteBooted=false, navSeq=0, lastNav=null;
function showRoute(r){ROUTE=r;document.body.dataset.route=r;}
function markReady(id){document.body.dataset.ready=id;}        // tests and timings wait for this
// The router: every navigation (boot, hash change, Try again) comes through here. A newer navigation wins over one
// whose data file is still loading.
function go(h,ctx){
  const seq=++navSeq;lastNav={h,ctx};
  const want=h.want||(h.want={TRY,LIVE});   // what parseHash() set for this link (kept on h, so Try again reuses it)
  if(h.route==="ph"){
    if(siteBooted){if(ctx.wasTry)exitTry(SITE,true);setPlay(false);}
    showRoute("ph");syncTabs();writeHash();markReady("ph");
    return Promise.resolve();
  }
  if(!DATA_ALL[h.site]&&siteBooted){TRY=ctx.wasTry;LIVE=ctx.wasLive;}   // until the new file arrives, the page still shows the old site
  if(!DATA_ALL[h.site]){$("load-msg").textContent=fill(NL().loading,{name:siteLabel(h.site)});showRoute("loading");document.body.dataset.ready="";}
  return loadSiteData(h.site).then(()=>{
    if(seq!==navSeq)return;
    TRY=want.TRY;LIVE=want.LIVE;
    const from=ROUTE;showRoute("site");
    if(!siteBooted){siteBooted=true;bootSite(h);}
    else applySiteHash(h,Object.assign({},ctx,{from}));
    markReady(h.site);
  },()=>{
    if(seq!==navSeq)return;
    const L=NL();$("fail-msg").textContent=fill(L.fail,{name:siteLabel(h.site)});$("load-retry").textContent=L.retry;$("fail-back").textContent=L.back;
    showRoute("fail");document.body.dataset.ready="fail";$("load-retry").focus();
  });
}
// A hash change while a site is already booted (was the hashchange handler).
function applySiteHash(h,ctx){
  if(TRY){if(!ctx.wasTry)enterTry();else if(ctx.from!=="site")resize();syncTabs();return;}
  if(ctx.wasTry){exitTry(h.site,true);if(h.view!==VIEW)setView(h.view);writeHash();return;}
  if(h.site!==SITE)switchSite(h.site);
  if(h.view!==VIEW)setView(h.view);
  if(ctx.from!=="site"){resize();setPlay(!reducedMotion&&!LIVE);}
  if(LIVE!==ctx.wasLive){setPlay(!reducedMotion&&!LIVE);syncLiveUI();renderPublic();drawMap();drawOverlayCanvas();pollNow();}
  syncTabs();writeHash();
}
window.addEventListener("hashchange",()=>{const ctx={wasLive:LIVE,wasTry:TRY};go(parseHash(),ctx);});
$("load-retry").addEventListener("click",()=>{if(lastNav)go(lastNav.h,lastNav.ctx);});''')
rep('''const h0=parseHash();
initSite(h0.site);''','''// The first site opened boots the whole site UI (was top-level code; runs once, after that site's data has arrived).
function bootSite(h0){
initSite(h0.site);''')
rep('''log(SITE_CFG.attribution);
if("serviceWorker" in navigator&&location.protocol==="https:"){navigator.serviceWorker.register("sw.js").catch(()=>{});}
step(0,true);
requestAnimationFrame(loop);''','''log(SITE_CFG.attribution);
step(0,true);
requestAnimationFrame(loop);
}
if("serviceWorker" in navigator&&location.protocol==="https:"){navigator.serviceWorker.register("sw.js").catch(()=>{});}
go(parseHash(),{wasLive:false,wasTry:false});''')
rep('''function selectTab(key){
  if(key==="try"){if(!TRY)enterTry();return;}''','''function selectTab(key){
  if(key==="ph"){location.hash="#ph";return;}
  if(ROUTE!=="site"||!DATA_ALL[key==="try"?"tv":key]){location.hash="#"+key;return;}   // needs a fetch or leaves the national map: the router does it
  if(key==="try"){if(!TRY)enterTry();return;}''')
rep('''  recentReports=[];renderRecent();pollRecent();
}''','''  recentReports=[];renderRecent();pollRecent();
  markReady(id);
}''')
rep('''  <button role="tab" data-site="tv" aria-selected="true">Teachers Village</button>
  <button role="tab" data-site="diliman" aria-selected="false">UP Diliman</button>
  <button role="tab" data-site="berkeley" aria-selected="false">UC Berkeley</button>''','''  <button role="tab" data-site="ph" aria-selected="false">PhilDev campuses</button>
  <button role="tab" data-site="tv" aria-selected="true">Teachers Village</button>
  <button role="tab" data-site="berkeley" aria-selected="false">UC Berkeley</button>''',2)
rep('''<body data-view="public">
''','''<body data-view="public">
<section id="nat" aria-labelledby="nat-h">
  <h1 class="nat-h" id="nat-h">PhilDev partner campuses</h1>
<nav class="site-tabs" role="tablist" aria-label="Site">
  <button role="tab" data-site="ph" aria-selected="true">PhilDev campuses</button>
  <button role="tab" data-site="tv" aria-selected="false">Teachers Village</button>
  <button role="tab" data-site="berkeley" aria-selected="false">UC Berkeley</button>
  <button role="tab" data-site="try" aria-selected="false">Try reporting</button>
</nav>
  <div id="nat-body"></div>
</section>
<section id="route-loading" class="route-msg"><p id="load-msg" role="status" aria-live="polite"></p></section>
<section id="route-fail" class="route-msg">
  <p id="fail-msg" role="alert"></p>
  <button id="load-retry" class="route-btn"></button>
  <a href="#ph" class="route-link" id="fail-back"></a>
</section>
''')
rep('''.sr-only{position:absolute;''','''/* routes (body[data-route]): the national map, a site's file loading or failing, and the site itself */
#nat,#route-loading,#route-fail{display:none}
body[data-route="ph"] #nat,body[data-route="loading"] #route-loading,body[data-route="fail"] #route-fail{display:block}
body[data-route]:not([data-route="site"]) > :is(#public,header,nav.site-tabs,#d-live-banner,main,#timeline){display:none !important}
.route-msg{max-width:640px; margin:0 auto; padding:48px 16px; font-size:16px}
.route-btn{min-height:48px; padding:0 18px; border:2px solid var(--ink); border-radius:6px; font-weight:700; margin:16px 12px 0 0}
.route-link{color:var(--brand); display:inline-flex; align-items:center; min-height:48px}
.sr-only{position:absolute;''')
open(p, "w", encoding="utf-8").write(s); print("template edits applied")
```

- [ ] **Step 6: Remove the old embedded site files, build, and run every page suite**

Run:
```bash
cd /home/claude/work && git rm -q data.json data_diliman.json data_berkeley.json && python3 build_html.py && ./test_pages.sh
```

Expected:
- `bahawatch_dashboard.html written (~205 KB, 25 campuses)`;
- `ok` for `test_routes.js` (16 checks) and for every other suite.

Rulings allowed here: Teachers Village now has new terrain (Task 7), so a check that encodes a number from the old Copernicus storm may fail. Examples: which street is Oo at `tMin=495`, a depth in a caption, a flooded-building count.
- For each such failure, confirm it is a terrain number and not behaviour: the same check against the old build gives the old number.
- Then update the expected value to what the new data gives.
- Ledger each: `Task 8: Ruling: <suite> "<check>": <old> → <new> — Teachers Village terrain changed (spec N4) — cost if wrong: a real regression hidden behind a new number`.

Any other failure is a bug. Fix it here, test-first.

- [ ] **Step 7: Commit**

```bash
cd /home/claude/work && git add -A build_html.py template.html tools/test_server.js test_pages.sh test_routes.js test_*.js && git commit -q -m "Page: national route, one site file fetched at a time, loading and failure screens, old Diliman links" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 9: Buildings and sea on the page (the shared flood fill)

**Files:**
- Create: `shared/flood.js`, `shared/flood.test.js`, `test_obstacles.js`
- Modify: `build_html.py` (inject flood.js), `template.html` (edit script)

**Interfaces:**
- Consumes: `data/<site>.json` keys `block`, `sea`, `bc`, `nb`, `thin` and `site.terrain` (Task 7); `unrle`, `initSite`, `switchSite` (existing).
- Produces:
  - `fillFlood(g, sources, scratch)`, `scratch(N)`, `DECAY_PER_CELL`, `MAX_STEPS` (shared/flood.js, injected at `/*__FLOOD_JS__*/`);
  - page globals `BLOCK`, `SEA`, `BC`, `FS`, `paintSea(ctx, P)`;
  - palette key `P.sea`;
  - footnote spans `#foot-nb`, `#foot-terrain`, `#foot-block`.

- [ ] **Step 1: Write the failing tests**

`shared/flood.test.js`. It includes the wall, a street through the wall, and an equivalence test against the old fill, copied inline:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillFlood, scratch } from './flood.js';

const GW = 20, GH = 20, N = GW * GH;
const flat = () => new Float32Array(N);                       // flat ground at 0 m
const src = (cx, cy, depth) => ({ idx: 0, cx, cy, gElev: 0, depth });
const wet = (s, x, y) => s.depth[y * GW + x] > 0;

test('a wall of fully built cells keeps the water on one side', () => {
  const block = new Uint8Array(N); for (let y = 0; y < GH; y++) block[y * GW + 10] = 1;
  const s = scratch(N); fillFlood({ elev: flat(), block, GW, GH }, [src(3, 10, 0.3)], s);
  assert.ok(wet(s, 9, 10) && wet(s, 3, 3));
  for (let y = 0; y < GH; y++) for (let x = 10; x < GW; x++) assert.ok(!wet(s, x, y), `(${x},${y}) is past the wall`);
});

test('the same wall with a street cell through it lets the water pass', () => {
  const block = new Uint8Array(N); for (let y = 0; y < GH; y++) block[y * GW + 10] = 1;
  block[10 * GW + 10] = 0;                                     // the street is never blocked
  const s = scratch(N); fillFlood({ elev: flat(), block, GW, GH }, [src(3, 10, 0.3)], s);
  assert.ok(wet(s, 10, 10) && wet(s, 14, 10) && wet(s, 14, 3));
});

test('blocked cells themselves stay dry', () => {
  const block = new Uint8Array(N); block[10 * GW + 5] = 1;
  const s = scratch(N); fillFlood({ elev: flat(), block, GW, GH }, [src(3, 10, 0.3)], s);
  assert.ok(!wet(s, 5, 10) && wet(s, 6, 10));
});

test('with no obstacles it matches the fill the page used before (same depths, same sources)', () => {
  // the pre-obstacle algorithm, copied from template.html v24 computeFlood()
  function legacy(elev, sources) {
    const depth = new Float32Array(N), srcIdx = new Int8Array(N).fill(-1), gen = new Int32Array(N), dist = new Int32Array(N), q = new Int32Array(N); let G = 0;
    for (const s of sources) {
      if (s.depth <= 0.02) continue;
      const WSE = s.gElev + s.depth, cap = s.depth + 0.45; G++; let qh = 0, qt = 0; const start = s.cy * GW + s.cx;
      gen[start] = G; dist[start] = 0; q[qt++] = start;
      while (qh < qt) {
        const i = q[qh++], x = i % GW, dstep = dist[i]; const d = WSE - 0.010 * dstep - elev[i];
        if (d <= 0.02 || d > cap) continue; if (d > depth[i]) { depth[i] = d; srcIdx[i] = s.idx; } if (dstep >= 80) continue;
        for (const j of [i - 1, i + 1, i - GW, i + GW]) { if (j < 0 || j >= N) continue; if ((j === i - 1 && x === 0) || (j === i + 1 && x === GW - 1)) continue; if (gen[j] === G) continue; gen[j] = G; dist[j] = dstep + 1; q[qt++] = j; }
      }
    }
    return { depth, srcIdx };
  }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const elev = new Float32Array(N).map(() => rnd() * 0.6);
  const sources = [{ idx: 0, cx: 4, cy: 4, gElev: elev[4 * GW + 4], depth: 0.35 }, { idx: 1, cx: 15, cy: 12, gElev: elev[12 * GW + 15], depth: 0.5 }];
  const s = scratch(N); fillFlood({ elev, block: null, GW, GH }, sources, s);
  const L = legacy(elev, sources);
  assert.deepEqual(Array.from(s.depth), Array.from(L.depth));
  assert.deepEqual(Array.from(s.src), Array.from(L.srcIdx));
});
```

`test_obstacles.js`:

```js
// Buildings and sea on the page (spec §6.1–6.2, §7.2): the fill never wets a blocked or sea cell, the flooded-building
// count uses every footprint, and the footnote names the terrain. Run: ./test_pages.sh test_obstacles.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  for(const site of ["upd","tv"]){
    await pg.goto(BASE+'bahawatch_dashboard.html#'+site+'/details');await pg.waitForFunction(x=>document.body.dataset.ready===x,site);
    const s=await pg.evaluate(()=>{
      playing=false;scenario="typhoon";let most=null;
      for(let t=300;t<=700;t+=20){tMin=t;lastEmit=-999;step(0,true);let w=0;for(let i=0;i<N;i++)if(depth[i]>0.05)w++;if(!most||w>most.w)most={t,w};}
      tMin=most.t;lastEmit=-999;step(0,true);
      let wetBlocked=0,wetSea=0,bc=0;
      for(let i=0;i<N;i++){if(depth[i]>0){if(BLOCK&&BLOCK[i])wetBlocked++;if(SEA&&SEA[i])wetSea++;}if(BC&&BC[i]&&depth[i]>0.05)bc+=BC[i];}
      return {wet:most.w,wetBlocked,wetSea,bc,shown:+document.getElementById("st-houses").textContent.replace(/,/g,""),
        blocked:BLOCK?BLOCK.reduce((a,v)=>a+v,0):0,terrain:document.getElementById("foot-terrain").textContent,blk:!document.getElementById("foot-block").hidden,
        nb:document.getElementById("foot-nb").textContent,limits:!document.getElementById("foot-limits").hidden};
    });
    assert(s.wet>0&&s.blocked>0,`${site}: the storm peak floods cells (${s.wet}) and the site has blocked cells (${s.blocked})`);
    assert(s.wetBlocked===0&&s.wetSea===0,`${site}: no water in blocked or sea cells (${s.wetBlocked}, ${s.wetSea})`);
    assert(s.shown===s.bc,`${site}: 'buildings in flooded cells' counts footprints per cell: ${s.shown} vs ${s.bc}`);
    assert(/FABDEM/.test(s.terrain)&&s.blk&&s.limits&&/^\d/.test(s.nb),`${site}: footnote names FABDEM, its limits, the 75% rule and the footprint count: ${s.terrain} · ${s.nb}`);
  }
  await pg.goto(BASE+'bahawatch_dashboard.html#berkeley/details');await pg.waitForFunction(()=>document.body.dataset.ready==="berkeley");
  const s=await pg.evaluate(()=>({t:document.getElementById("foot-terrain").textContent,blk:document.getElementById("foot-block").hidden,lim:document.getElementById("foot-limits").hidden,block:BLOCK,sea:SEA}));
  assert(/USGS/.test(s.t)&&s.blk&&s.lim&&s.block===null&&s.sea===null,"Berkeley: USGS terrain, no obstacle grids, no 75% clause, no FABDEM caveat");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

Run: `cd /home/claude/work && node --test --no-warnings shared/*.test.js 2>&1 | grep -E "^# (pass|fail)"; ./test_pages.sh test_obstacles.js`
Expected:
- `# fail 1`: flood.test.js can't import `./flood.js`, and the 20 verdict tests still pass;
- `FAIL test_obstacles.js`: `BLOCK is not defined`.

- [ ] **Step 2: Write `shared/flood.js`**

```js
// Sensor-seeded terrain fill (spec §6.2). Water from each wet sensor sets a surface at ground + measured depth and
// spreads to neighbouring cells that surface can reach, losing DECAY_PER_CELL per step, never into a blocked cell
// (≥ 75 % built, or sea). Pure: the page and the tests run this same function.
export const DECAY_PER_CELL = 0.010;
export const MAX_STEPS = 80;

// g: {elev: Float32Array, block: Uint8Array|null, GW, GH}
// sources: [{idx, cx, cy, gElev, depth}] (depth in metres)
// s: scratch reused between calls {depth: Float32Array, src: Int8Array, gen: Int32Array, dist: Int32Array, q: Int32Array, g: number}
export function fillFlood(g, sources, s) {
  const { elev, block, GW, GH } = g, N = GW * GH;
  s.depth.fill(0); s.src.fill(-1);
  for (const w of sources) {
    if (w.depth <= 0.02) continue;
    const WSE = w.gElev + w.depth;
    const cap = w.depth + 0.45;   // extrapolate only within the observed depth band
    s.g++;
    let qh = 0, qt = 0;
    const start = w.cy * GW + w.cx;
    s.gen[start] = s.g; s.dist[start] = 0; s.q[qt++] = start;
    while (qh < qt) {
      const i = s.q[qh++], x = i % GW, dstep = s.dist[i];
      const d = WSE - DECAY_PER_CELL * dstep - elev[i];
      if (d <= 0.02 || d > cap) continue;   // dry ground, or far below the observed surface: no claim, no traverse
      if (d > s.depth[i]) { s.depth[i] = d; s.src[i] = w.idx; }
      if (dstep >= MAX_STEPS) continue;
      for (const j of [i - 1, i + 1, i - GW, i + GW]) {
        if (j < 0 || j >= N) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === GW - 1)) continue;
        if (s.gen[j] === s.g) continue;
        s.gen[j] = s.g;
        if (block && block[j]) continue;    // buildings and sea: water goes around
        s.dist[j] = dstep + 1; s.q[qt++] = j;
      }
    }
  }
}

export function scratch(N) {
  return { depth: new Float32Array(N), src: new Int8Array(N), gen: new Int32Array(N), dist: new Int32Array(N), q: new Int32Array(N), g: 0 };
}
```

- [ ] **Step 3: Inject it in `build_html.py`**

Run this edit (save as `/tmp/bw_task9_build.py`, run from the repo root):

```python
p = "build_html.py"; s = open(p, encoding="utf-8").read()
for old, new in [
    ('verdict = strip("shared/verdict.js")', 'verdict, flood = strip("shared/verdict.js"), strip("shared/flood.js")'),
    ('for ph in ("__CAMPUSES__", "/*__VERDICT_JS__*/",', 'for ph in ("__CAMPUSES__", "/*__VERDICT_JS__*/", "/*__FLOOD_JS__*/",'),
    ('          .replace("/*__VERDICT_JS__*/", verdict)', '          .replace("/*__VERDICT_JS__*/", verdict).replace("/*__FLOOD_JS__*/", flood)'),
    ('Embedded: the PhilDev campus list (pipeline/campuses.csv) and the shared rule."""',
     'Embedded: the PhilDev campus list (pipeline/campuses.csv), the shared rule and the shared flood fill."""'),
]:
    assert s.count(old) == 1, old; s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
```

- [ ] **Step 4: Edit `template.html`**

Save as `/tmp/bw_task9_template.py` and run it from the repo root. The script:
- replaces `computeFlood` with `fillFlood`;
- decodes `SEA`, `BLOCK` and `BC`;
- counts footprints per cell;
- paints the sea in both base maps;
- adds sea colours to both palettes;
- makes the footnote per site.

```python
import sys
p = "template.html"; s = open(p, encoding="utf-8").read()
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:90], s.count(old)); s = s.replace(old, new)
# ---- Task 9: the shared flood fill with obstacles, sea on the map, footprint counts, the terrain footnote
a = s.index("/* ---------- flood model: sensor-seeded terrain fill ---------- */"); b = s.index("const depthAtWorld=")
rep(s[a:b], '''/* ---------- flood model: sensor-seeded terrain fill, with buildings and sea as obstacles (shared/flood.js) ---------- */
/*__FLOOD_JS__*/
let FS=null;                          // the fill's scratch buffers, sized per site in initSite()
function computeFlood(t){fillFlood({elev,block:BLOCK,GW,GH},HOUSEHOLD,FS);}
''')
rep('''let W,H,GW,GH,N, elev,NOAH,STREETMASK,BLDS,HOUSEHOLD,SCEN, depth,srcIdx,fillGen,fillDist,fq, eMinD,eMaxD,tLo,tHi, SEG_SAMPLES;''',
'''let W,H,GW,GH,N, elev,NOAH,STREETMASK,BLDS,HOUSEHOLD,SCEN, depth,srcIdx,fillGen,fillDist,fq, eMinD,eMaxD,tLo,tHi, SEG_SAMPLES;
let BLOCK=null, SEA=null, BC=null;    // per-cell grids: water may not enter / sea / building footprints (Philippine sites)''')
rep('''  depth=new Float32Array(N);srcIdx=new Int8Array(N);fillGen=new Int32Array(N);fillDist=new Int32Array(N);fq=new Int32Array(N);''',
'''  depth=new Float32Array(N);srcIdx=new Int8Array(N);fillGen=new Int32Array(N);fillDist=new Int32Array(N);fq=new Int32Array(N);
  FS={depth,src:srcIdx,gen:fillGen,dist:fillDist,q:fq,g:0};
  SEA=DATA.sea?unrle(DATA.sea):null;
  BLOCK=DATA.block?unrle(DATA.block):SEA;
  BC=DATA.bc?unrle(DATA.bc):null;''')
rep('''  for(const b of BLDS)if(depthAtWorld(b[0],b[1])>0.05)floodedB++;''',
'''  if(BC){for(let i=0;i<N;i++)if(BC[i]&&depth[i]>0.05)floodedB+=BC[i];}   // every footprint, even when the dots are a sample
  else for(const b of BLDS)if(depthAtWorld(b[0],b[1])>0.05)floodedB++;''')
rep('''function renderBaseSimple(ctx,P){
  ctx.fillStyle=`rgb(${P.bgLo[0]},${P.bgLo[1]},${P.bgLo[2]})`;ctx.fillRect(0,0,W,H);''','''// sea cells as open water under everything else (never flooded: the fill treats them as blocked)
function paintSea(ctx,P){
  if(!SEA)return;
  const img=new ImageData(GW,GH),px=img.data;
  for(let i=0;i<N;i++)if(SEA[i]){const o=i*4;px[o]=P.sea[0];px[o+1]=P.sea[1];px[o+2]=P.sea[2];px[o+3]=255;}
  const tmp=document.createElement("canvas");tmp.width=GW;tmp.height=GH;tmp.getContext("2d").putImageData(img,0,0);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(tmp,0,0,W,H);ctx.imageSmoothingEnabled=true;
}
function renderBaseSimple(ctx,P){
  ctx.fillStyle=`rgb(${P.bgLo[0]},${P.bgLo[1]},${P.bgLo[2]})`;ctx.fillRect(0,0,W,H);
  paintSea(ctx,P);''')
rep('''  ctx.imageSmoothingEnabled=true;ctx.drawImage(tmp,0,0,W,H);
  // roads by class, casing then fill''','''  ctx.imageSmoothingEnabled=true;ctx.drawImage(tmp,0,0,W,H);
  paintSea(ctx,P);
  // roads by class, casing then fill''')
rep('''    bgLo:[36,34,32],bgHi:[50,47,42],street:"#4a4640",''','''    bgLo:[36,34,32],bgHi:[50,47,42],sea:[31,52,66],street:"#4a4640",''')
rep('''    bgLo:[248,242,230],bgHi:[235,226,207],street:"#ffffff",''','''    bgLo:[248,242,230],bgHi:[235,226,207],sea:[204,226,238],street:"#ffffff",''')
rep('''    <p class="foot-note">Proof of concept on real data: OpenStreetMap streets and 17,993 building footprints, Copernicus GLO-30 terrain (conditioned: surface features filtered, streets carved as flow paths), and Project NOAH flood hazard as a reference layer.''',
'''    <p class="foot-note">Proof of concept on real data: OpenStreetMap streets, <span id="foot-nb"></span> building footprints, <span id="foot-terrain"></span> terrain (streets carved as flow paths<span id="foot-block">; water goes around cells that are at least 75% built</span>), and Project NOAH flood hazard as a reference layer.<span id="foot-limits"> FABDEM heights can be 1–3 m off in dense cities, and this is a spread from measured points over terrain and buildings, not a hydraulic model.</span>''')
rep('''  document.querySelector(".map-attr").textContent=SITE_CFG.attribution;document.getElementById("p-attr").textContent=SITE_CFG.attribution;''',
'''  document.querySelector(".map-attr").textContent=SITE_CFG.attribution;document.getElementById("p-attr").textContent=SITE_CFG.attribution;
  $("foot-nb").textContent=DATA.nb.toLocaleString()+(DATA.thin>1?" (drawn as a sample: one dot in "+DATA.thin+")":"");
  $("foot-terrain").textContent=SITE_CFG.terrain||"Copernicus GLO-30";$("foot-block").hidden=!DATA.block;
  $("foot-limits").hidden=!/FABDEM/.test(SITE_CFG.terrain||"");''')
rep('''   DATA: OSM streets/buildings/creeks, Copernicus GLO-30 terrain grid,''','''   DATA: OSM streets/creeks, building footprints, FABDEM (USGS 1 m at Berkeley) terrain grid,''')
open(p, "w", encoding="utf-8").write(s); print("template edits applied")
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `cd /home/claude/work && node --test --no-warnings shared/*.test.js 2>&1 | grep -E "^# (pass|fail)" && python3 build_html.py && ./test_pages.sh`
Expected: `# pass 24`, `# fail 0`; every page suite `ok`, including `test_obstacles.js` (10 checks).

- [ ] **Step 6: Commit**

```bash
cd /home/claude/work && git add shared/flood.js shared/flood.test.js test_obstacles.js build_html.py template.html && git commit -q -m "Page: flood fill shared and tested; buildings and sea block water; footprint counts; per-site terrain footnote" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 10: The national map and the campus list

**Files:**
- Create: `test_national.js`
- Modify: `build_html.py` (embed the outline), `template.html` (edit script)

**Interfaces:**
- Consumes: `CAMPUSES`, `CAMPUS_BY_ID`, `go()`, `showRoute`, `NAT_EN`/`NL()` (Task 8); `data/ph_outline.json` (Task 7); `esc`, `fill`, `setTheme`, `LANGS`, `LANG` (existing).
- Produces:
  - `PH_OUTLINE`, `natProj`, `NAT`, `norm`, `pinLabel`;
  - `natInit`, `natSetView`, `natPins`, `natZoomTo`, `natList`, `natRender`, `natEnter`;
  - markup `#nat-map #nat-pins .pin(.pin-suc|.pin-luc|.pin-private) .pin-cluster[data-ids] #nat-zoom-out #nat-legend #nat-q #nat-count #nat-list h2[data-group][data-n] .nat-item #nat-pilots-h #nat-lang #nat-theme`;
  - CSS variables `--pin-suc/--pin-luc/--pin-pvt`, in both themes;
  - `NAT_EN` keys for the map.

  Task 11 adds `NAT_EN` campus-page keys and replaces `natEnter`.

**Design points:**
- **Pins:** a pin is a link (`<a href="#id">`, a 48 px target) with a spoken label: name, place, type. Pins closer than 48 px become a numbered cluster button that zooms in. DOM order follows the campus list.
- **Search:** it matches name, short name, city, province and id, with accents and case ignored. The count is announced 400 ms after typing stops, once per new query.
- **Status region:** the national view has its own `#nat-count` status region. The answer announcer lives in the hidden site section, and a hidden live region is never read. Ruling against spec §7.4 "the existing announcer": the spoken result is the same, and the cost if wrong is none.
- **Dark theme pin colours:** Global Constraints. The light colours follow the spec.
- **Theme button:** it must not redraw a site before one is booted (`setTheme(…, true)` on the national map).

- [ ] **Step 1: Write the failing test**

`test_national.js`:

```js
// The national map and campus list (spec §3.1, §7.3): 25 campuses as labelled pins and a grouped list, search that
// ignores accents and case, clusters that zoom, pilot links. Run: ./test_pages.sh test_national.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await ready(pg,"ph");
  let s=await pg.evaluate(()=>{
    const pins=[...document.querySelectorAll('#nat-pins .pin')],cl=[...document.querySelectorAll('#nat-pins .pin-cluster')];
    return {n:CAMPUSES.length,shown:pins.length+cl.reduce((a,c)=>a+c.dataset.ids.split(",").length,0),
      labels:pins.every(p=>/: .+, .+\. (State|Local|Private)/.test(p.getAttribute('aria-label'))),text:pins.every(p=>p.querySelector('.pin-t').textContent.length>1),
      clusters:cl.map(c=>c.getAttribute('aria-label')),legend:[...document.querySelectorAll('#nat-legend li')].map(l=>l.textContent),
      desc:document.getElementById('nat-desc').textContent,title:document.title,
      tabs:[...document.querySelectorAll('#nat .site-tabs [role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":""))};});
  assert(s.n===25&&s.shown===25,"all 25 campuses are on the map, as pins or inside clusters: "+s.shown);
  assert(s.labels&&s.text,"each pin has a visible short label and a full spoken label (name, place, type)");
  assert(s.clusters.length>=1&&s.clusters.every(c=>/^\d+ campuses: .+Zoom in$/.test(c)),"crowded Metro Manila pins become a cluster that says how many and which: "+s.clusters[0]);
  assert(s.legend.join("|")==="State university or college (circle)|Local university or college (square)|Private (triangle)","legend says the pin shapes in words");
  assert(s.desc==="Map of the Philippines with 25 PhilDev partner campuses: 17 in Luzon, 5 in Visayas, 3 in Mindanao. The list below has the same campuses.","screen-reader description of the map");
  assert(s.tabs.join()==="ph*,tv,berkeley,try"&&/PhilDev partner campuses/.test(s.title),"tab row with 'PhilDev campuses' selected; page title");
  s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-list h2')].map(h=>h.dataset.group+h.dataset.n+":"+h.nextElementSibling.children.length));
  assert(s.join()==="Luzon17:17,Visayas5:5,Mindanao3:3","list grouped Luzon 17 · Visayas 5 · Mindanao 3: "+s);
  // search: accents, case, city names; the count is announced once typing pauses
  const find=async q=>{await pg.fill('#nat-q',q);await pg.waitForTimeout(500);return pg.evaluate(()=>({ids:[...document.querySelectorAll('#nat-list .nat-item')].map(a=>a.getAttribute('href').slice(1)),count:document.getElementById('nat-count').textContent,none:document.getElementById('nat-list').textContent}));};
  for(const [q,want] of [["Xavier",["xu"]],["xavier",["xu"]],["UPLB",["uplb"]],["banos",["uplb"]],["mapua",["mapua"]],["Iligan",["msuiit"]],["cebu city",["ctu","usc","upc"]]]){
    s=await find(q);assert(s.ids.join()===want.join(),`search "${q}" finds ${want}: ${s.ids}`);
  }
  s=await find("Xavier");assert(s.count==="1 campus matches.","search announces how many matched: "+s.count);
  s=await find("zzz");assert(s.ids.length===0&&/No campus matches “zzz”/.test(s.none)&&/No campus matches/.test(s.count),"no match says so");
  await pg.fill('#nat-q','');await pg.waitForTimeout(450);
  // a cluster zooms in; 'Whole country' zooms back out
  const before=await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length);
  await pg.click('#nat-pins .pin-cluster');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({pins:document.querySelectorAll('#nat-pins .pin').length,out:!document.getElementById('nat-zoom-out').hidden,focus:document.activeElement.closest('#nat-pins')!==null}));
  assert(s.pins>0&&s.out&&s.focus,"a cluster zooms in to separate pins, shows 'Whole country', and keeps focus on the map: "+s.pins);
  for(let i=0;i<4&&await pg.$('#nat-pins .pin-cluster');i++){await pg.click('#nat-pins .pin-cluster');await pg.waitForTimeout(80);}
  assert(await pg.evaluate(()=>!document.querySelector('#nat-pins .pin-cluster')||document.querySelectorAll('#nat-pins .pin').length>1),"zooming further separates even the closest campuses");
  await pg.click('#nat-zoom-out');
  assert(await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length)===before,"'Whole country' returns to the full map");
  // choosing a campus from the list opens it; Back returns to the map
  await pg.click('#nat-list a[href="#xu"]');await ready(pg,"xu");
  s=await pg.evaluate(()=>({site:SITE,hash:location.hash,title:document.title}));
  assert(s.site==="xu"&&s.hash==="#xu","choosing XU in the list opens its page: "+s.hash);
  await pg.goBack();await ready(pg,"ph");
  assert(await pg.evaluate(()=>ROUTE==="ph"&&getComputedStyle(document.getElementById('nat')).display!=="none"),"Back returns to the national map");
  await pg.click('#nat-pins .pin-cluster');await pg.click('#nat-pins .pin >> nth=0');
  assert(await pg.waitForFunction(()=>ROUTE==="site"&&isCampus(SITE),null,{timeout:15000}).then(()=>true,()=>false),"choosing a pin opens that campus");
  await pg.goBack();await ready(pg,"ph");
  // pilot sites and Try reporting stay reachable from here
  s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-pilots-h + .nat-ul a')].map(a=>a.getAttribute('href')));
  assert(s.join()==="#tv,#berkeley,#try","pilot sites and Try reporting listed after the campuses");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

Run: `cd /home/claude/work && ./test_pages.sh test_national.js`
Expected: `FAIL`. There are no `#nat-pins` pins yet (`shown` is 0).

- [ ] **Step 2: Embed the outline**

Save as `/tmp/bw_task10_build.py` and run it:

```python
p = "build_html.py"; s = open(p, encoding="utf-8").read()
for old, new in [
    ('for ph in ("__CAMPUSES__",', 'outline = open("data/ph_outline.json", encoding="utf-8").read()\nfor ph in ("__CAMPUSES__", "__PH_OUTLINE__",'),
    ('out = (tpl.replace("__CAMPUSES__", json.dumps(campuses, ensure_ascii=False, separators=(",", ":")))',
     'out = (tpl.replace("__CAMPUSES__", json.dumps(campuses, ensure_ascii=False, separators=(",", ":"))).replace("__PH_OUTLINE__", outline)'),
    ('Embedded: the PhilDev campus list (pipeline/campuses.csv), the shared rule and the shared flood fill."""',
     'Embedded: the PhilDev campus list (pipeline/campuses.csv), the country outline (data/ph_outline.json), the shared rule\nand the shared flood fill."""'),
]:
    assert s.count(old) == 1, old; s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
```

- [ ] **Step 3: Edit `template.html`**

Save as `/tmp/bw_task10_template.py` and run it from the repo root. The script:
- replaces the placeholder `#nat` section with the full national view;
- adds its CSS;
- extends `NAT_EN`;
- adds the national map code before the router;
- calls `natEnter()` on the `ph` route;
- adds `PH_OUTLINE`;
- guards `setTheme` redraws until a site is booted.

```python
import sys
p = "template.html"; s = open(p, encoding="utf-8").read()
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:90], s.count(old)); s = s.replace(old, new)
# ---- Task 10: the national map, the campus list and search
a = s.index('<section id="nat" aria-labelledby="nat-h">'); b = s.index('<section id="route-loading"')
rep(s[a:b], r'''<section id="nat" aria-labelledby="nat-h">
 <div class="nat-inner">
  <div class="nat-top">
    <img class="nat-logo" id="nat-logo" alt="" width="40" height="40">
    <div><div class="p-name">BahaWatch</div><h1 class="nat-h" id="nat-h"></h1></div>
    <div class="p-tools">
      <label class="sr-only" for="nat-lang">Language</label>
      <select id="nat-lang"></select>
      <button id="nat-theme" aria-label="Switch theme">☾</button>
    </div>
  </div>
<nav class="site-tabs" role="tablist" aria-label="Site">
  <button role="tab" data-site="ph" aria-selected="true">PhilDev campuses</button>
  <button role="tab" data-site="tv" aria-selected="false">Teachers Village</button>
  <button role="tab" data-site="berkeley" aria-selected="false">UC Berkeley</button>
  <button role="tab" data-site="try" aria-selected="false">Try reporting</button>
</nav>
  <p class="nat-intro" id="nat-intro"></p>
  <div class="nat-body">
    <div class="nat-mapcol">
      <div class="nat-map" id="nat-map" role="group" aria-labelledby="nat-map-l" aria-describedby="nat-desc">
        <svg id="nat-svg" aria-hidden="true" focusable="false" preserveAspectRatio="none"><path id="nat-land"/></svg>
        <div class="nat-pins" id="nat-pins"></div>
      </div>
      <span class="sr-only" id="nat-map-l"></span>
      <p class="sr-only" id="nat-desc"></p>
      <button class="nat-btn" id="nat-zoom-out" hidden></button>
      <ul class="nat-legend" id="nat-legend"></ul>
    </div>
    <div class="nat-listcol">
      <label class="nat-ql" for="nat-q" id="nat-q-l"></label>
      <input class="nat-q" type="search" id="nat-q" autocomplete="off" aria-describedby="nat-count">
      <p class="nat-count" id="nat-count" role="status" aria-live="polite"></p>
      <div id="nat-list"></div>
      <h2 class="nat-g" id="nat-pilots-h"></h2>
      <ul class="nat-ul">
        <li><a class="nat-item" href="#tv"><b>Teachers Village</b><span class="nat-where">Quezon City · pilot, hand-placed units</span></a></li>
        <li><a class="nat-item" href="#berkeley"><b>UC Berkeley</b><span class="nat-where">California · pilot, the real demo unit</span></a></li>
        <li><a class="nat-item" href="#try"><b id="nat-try"></b></a></li>
      </ul>
    </div>
  </div>
  <p class="nat-foot" id="nat-foot"></p>
 </div>
</section>
''')
rep('''.route-msg{max-width:640px;''', r'''/* the national map (#nat): an outline of the Philippines with campus pins, and the same campuses as a list */
:root{--pin-suc:#385F96; --pin-luc:#CF5921; --pin-pvt:#800000}
:root[data-theme="dark"]{--pin-suc:#7FA8E0; --pin-luc:#F08A4B; --pin-pvt:#F2F2F2}
.nat-inner{max-width:1180px; margin:0 auto; padding:14px 16px 28px}
.nat-top{display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:8px}
.nat-top .p-tools{margin-left:auto; display:flex; gap:8px; align-items:center}
.nat-top .p-tools button, .nat-top .p-tools select{min-height:48px; min-width:48px}
.nat-h{font-size:20px; font-weight:700}
.nat-intro{max-width:70ch; margin:12px 0 16px; font-size:15px}
.nat-body{display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:24px; align-items:start}
@media (max-width:820px){.nat-body{grid-template-columns:1fr}}
.nat-map{position:relative; width:min(100%, calc(76vh * var(--ar,0.6))); margin:0 auto; aspect-ratio:var(--ar,0.6); background:var(--map-bg); border:1px solid var(--ink); border-radius:6px; overflow:hidden}
#nat-svg{position:absolute; inset:0; width:100%; height:100%}
#nat-land{fill:var(--panel-2); stroke:var(--ink-2); stroke-width:1; vector-effect:non-scaling-stroke}
.nat-pins{position:absolute; inset:0}
.pin,.pin-cluster{position:absolute; transform:translate(-50%,-50%); width:48px; height:48px; display:flex; align-items:center; justify-content:center}
.pin{color:var(--ink); text-decoration:none}
.pin-shape{display:inline-block; flex:none; width:16px; height:16px; background:var(--pin); filter:drop-shadow(0 0 1px var(--bg)) drop-shadow(0 0 1px var(--bg))}
.pin-suc{--pin:var(--pin-suc)} .pin-luc{--pin:var(--pin-luc)} .pin-private{--pin:var(--pin-pvt)}
.pin-suc .pin-shape, .pin-shape.pin-suc{border-radius:50%}
.pin-private .pin-shape, .pin-shape.pin-private{clip-path:polygon(50% 0,100% 100%,0 100%); width:18px; height:17px}
.pin-t{position:absolute; left:34px; top:50%; transform:translateY(-50%); white-space:nowrap; font-size:12px; font-weight:700; color:var(--ink); background:var(--map-bg); padding:0 3px; border-radius:3px; pointer-events:none}
.pin-cluster span{min-width:32px; height:32px; border-radius:16px; background:var(--ink); color:var(--bg); font-weight:700; display:flex; align-items:center; justify-content:center; padding:0 6px}
.pin:focus-visible,.pin-cluster:focus-visible,.nat-item:focus-visible,.nat-btn:focus-visible,.nat-q:focus-visible{outline:3px solid var(--brand); outline-offset:2px; border-radius:6px}
.nat-btn{min-height:48px; padding:0 14px; border:2px solid var(--ink); border-radius:6px; font-weight:700; margin-top:10px}
.nat-legend{list-style:none; padding:0; margin:10px 0 0; display:flex; flex-wrap:wrap; gap:6px 16px; font-size:13px}
.nat-legend li{display:flex; align-items:center; gap:6px}
.nat-ql{display:block; font-weight:700; margin-bottom:6px}
.nat-q{width:100%; min-height:48px; font:inherit; font-size:16px; padding:0 12px; border:2px solid var(--ink); border-radius:6px; background:var(--panel); color:var(--ink)}
.nat-count{min-height:1.4em; margin:6px 0; color:var(--ink-2)}
.nat-g{font-size:15px; font-weight:700; margin:16px 0 4px}
.nat-ul{list-style:none; padding:0; margin:0}
.nat-item{display:flex; flex-wrap:wrap; align-items:center; gap:2px 8px; min-height:48px; padding:6px 4px; border-bottom:1px solid var(--line); color:var(--ink); text-decoration:none}
.nat-item:hover b{text-decoration:underline}
.nat-where{flex-basis:100%; padding-left:24px; color:var(--ink-2); font-size:13px}
.nat-foot{font-size:12px; color:var(--ink-2); margin-top:20px}
.route-msg{max-width:640px;''')
rep('''const NAT_EN={loading:"Loading {name}…",fail:"{name} didn't load. Check your connection.",retry:"Try again",back:"‹ All campuses"};
''', '''const NAT_EN={loading:"Loading {name}…",fail:"{name} didn't load. Check your connection.",retry:"Try again",back:"‹ All campuses",
  title:"PhilDev partner campuses",
  intro:"Choose a campus to see what a BahaWatch partnership would look like there: eight household water-level units, the barangays they cover, and the flood hazard around the campus.",
  mapL:"Map of PhilDev partner campuses",
  desc:"Map of the Philippines with {n} PhilDev partner campuses: {luzon} in Luzon, {visayas} in Visayas, {mindanao} in Mindanao. The list below has the same campuses.",
  search:"Find a campus",count0:"No campus matches “{q}”.",count1:"1 campus matches.",countN:"{n} campuses match.",
  groups:{Luzon:"Luzon",Visayas:"Visayas",Mindanao:"Mindanao"},
  types:{SUC:"State university or college",LUC:"Local university or college",Private:"Private"},
  shapes:{SUC:"circle",LUC:"square",Private:"triangle"},
  cluster:"{n} campuses: {names}. Zoom in",zoomOut:"‹ Whole country",pilots:"Pilot sites",tryLink:"Try reporting",
  foot:"Campus list: PhilDev partners across the Philippines (PhilDev Starter Pack). Map: PSA/NAMRIA administrative boundaries, simplified. Main campuses are shown where a university has several."};
''')
rep('''let ROUTE=null, siteBooted=false, navSeq=0, lastNav=null;''', r'''/* ---------- the national map: PhilDev partner campuses ---------- */
const K_LAT=Math.cos(12.5*Math.PI/180);
const natProj=(lon,lat)=>[(lon-116)*K_LAT*100,(22-lat)*100];   // equirectangular; 100 units per degree of latitude
const NAT={vb:null,full:null,built:false};
const norm=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();   // "banos" finds "Baños"
const pinLabel=c=>`${c.short}: ${c.name}, ${c.city}, ${c.province}. ${NL().types[c.type]}.`;
function natInit(){
  if(NAT.built)return;NAT.built=true;
  let d="",x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const poly of PH_OUTLINE.coordinates)for(const ring of poly){
    ring.forEach(([lo,la],k)=>{const [x,y]=natProj(lo,la);d+=(k?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});d+="Z";}
  $("nat-land").setAttribute("d",d);
  NAT.full=[x0-20,y0-20,x1-x0+40,y1-y0+40];NAT.vb=NAT.full;
  $("nat-map").style.setProperty("--ar",(NAT.full[2]/NAT.full[3]).toFixed(4));
  $("nat-logo").src=document.querySelector(".p-head img").src;
  const sel=$("nat-lang");sel.innerHTML=$("p-lang").innerHTML;
  sel.addEventListener("change",()=>{LANG=sel.value;try{localStorage.setItem("bw-lang:ph",LANG);}catch(e){}natRender();});
  $("nat-theme").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark",true));
  $("nat-q").addEventListener("input",natList);
  $("nat-pins").addEventListener("click",e=>{const c=e.target.closest(".pin-cluster");if(c)natZoomTo(c.dataset.ids.split(","));});
  $("nat-zoom-out").addEventListener("click",()=>{natSetView(NAT.full);const f=$("nat-pins").querySelector("a,button");if(f)f.focus();});
  window.addEventListener("resize",()=>{if(ROUTE==="ph")natPins();});
}
function natSetView(vb){NAT.vb=vb;$("nat-svg").setAttribute("viewBox",vb.join(" "));$("nat-zoom-out").hidden=vb===NAT.full;natPins();}
// Pins closer than one tap target (48 px) become a numbered cluster that zooms in; DOM order follows the list.
function natPins(){
  const vb=NAT.vb,R=48/(($("nat-map").clientWidth||480)/vb[2]),L=NL(),groups=[];
  for(const c of CAMPUSES){
    const p=natProj(c.lon,c.lat);
    if(p[0]<vb[0]||p[0]>vb[0]+vb[2]||p[1]<vb[1]||p[1]>vb[1]+vb[3])continue;
    const g=groups.find(g=>Math.hypot(g.p[0]-p[0],g.p[1]-p[1])<R);
    if(g)g.m.push(c);else groups.push({p,m:[c]});
  }
  $("nat-pins").innerHTML=groups.map(g=>{
    const pos=`style="left:${((g.p[0]-vb[0])/vb[2]*100).toFixed(3)}%;top:${((g.p[1]-vb[1])/vb[3]*100).toFixed(3)}%"`;
    if(g.m.length===1){const c=g.m[0];return `<a class="pin pin-${c.type.toLowerCase()}" href="#${c.id}" ${pos} aria-label="${esc(pinLabel(c))}"><span class="pin-shape" aria-hidden="true"></span><span class="pin-t" aria-hidden="true">${esc(c.short)}</span></a>`;}
    return `<button class="pin-cluster" data-ids="${g.m.map(c=>c.id).join(",")}" ${pos} aria-label="${esc(fill(L.cluster,{n:g.m.length,names:g.m.map(c=>c.short).join(", ")}))}"><span aria-hidden="true">${g.m.length}</span></button>`;
  }).join("");
}
function natZoomTo(ids){
  const ps=ids.map(id=>natProj(CAMPUS_BY_ID[id].lon,CAMPUS_BY_ID[id].lat)),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]),ar=NAT.full[2]/NAT.full[3];
  let w=Math.max(Math.max(...xs)-Math.min(...xs),1.2)*1.8,h=Math.max(Math.max(...ys)-Math.min(...ys),1.2)*1.8;
  if(w/h<ar)w=h*ar;else h=w/ar;
  const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
  natSetView([cx-w/2,cy-h/2,w,h]);
  const f=$("nat-pins").querySelector("a,button");if(f)f.focus();
}
let natAnnounceT=null,natLastQ="";
function natList(){
  const q=$("nat-q").value,n=norm(q.trim()),L=NL();
  const ms=n?CAMPUSES.filter(c=>[c.name,c.short,c.city,c.province,c.id].some(f=>norm(f).includes(n))):CAMPUSES;
  let html="";
  for(const g of ["Luzon","Visayas","Mindanao"]){
    const all=CAMPUSES.filter(c=>c.group===g).length,cs=ms.filter(c=>c.group===g);
    if(!cs.length)continue;
    html+=`<h2 class="nat-g" data-group="${g}" data-n="${all}">${esc(L.groups[g])} (${all})</h2><ul class="nat-ul">`+cs.map(c=>
      `<li><a class="nat-item" href="#${c.id}"><span class="pin-shape pin-${c.type.toLowerCase()}" aria-hidden="true"></span><b>${esc(c.short)}</b><span>${esc(c.name)}</span><span class="nat-where">${esc(c.city)}, ${esc(c.province)} · ${esc(L.types[c.type])}</span></a></li>`).join("")+"</ul>";
  }
  $("nat-list").innerHTML=html||`<p>${esc(fill(L.count0,{q}))}</p>`;
  clearTimeout(natAnnounceT);                         // announce once the typing pauses, and only when the query changed
  natAnnounceT=setTimeout(()=>{if(q===natLastQ)return;natLastQ=q;
    $("nat-count").textContent=!n?"":ms.length===0?fill(L.count0,{q}):ms.length===1?L.count1:fill(L.countN,{n:ms.length});},400);
}
function natRender(){
  natInit();
  const L=NL(),cnt=g=>CAMPUSES.filter(c=>c.group===g).length;
  $("nat-lang").value=LANG;
  $("nat-h").textContent=L.title;$("nat-intro").textContent=L.intro;$("nat-map-l").textContent=L.mapL;
  $("nat-desc").textContent=fill(L.desc,{n:CAMPUSES.length,luzon:cnt("Luzon"),visayas:cnt("Visayas"),mindanao:cnt("Mindanao")});
  $("nat-legend").innerHTML=["SUC","LUC","Private"].map(t=>`<li><span class="pin-shape pin-${t.toLowerCase()}" aria-hidden="true"></span>${esc(L.types[t])} (${esc(L.shapes[t])})</li>`).join("");
  $("nat-q-l").textContent=L.search;$("nat-zoom-out").textContent=L.zoomOut;$("nat-pilots-h").textContent=L.pilots;$("nat-try").textContent=L.tryLink;$("nat-foot").textContent=L.foot;
  document.title="BahaWatch — "+L.title;
  natSetView(NAT.vb);natList();
}
function natEnter(){let saved=null;try{saved=localStorage.getItem("bw-lang:ph");}catch(e){}if(saved&&LANGS[saved])LANG=saved;natRender();}

let ROUTE=null, siteBooted=false, navSeq=0, lastNav=null;''')
rep('''    showRoute("ph");syncTabs();writeHash();markReady("ph");''', r'''    showRoute("ph");natEnter();syncTabs();writeHash();markReady("ph");''')
rep('''const CAMPUSES=__CAMPUSES__;          // the PhilDev partner campuses (pipeline/campuses.csv), embedded at build''',
'''const CAMPUSES=__CAMPUSES__;          // the PhilDev partner campuses (pipeline/campuses.csv), embedded at build
const PH_OUTLINE=__PH_OUTLINE__;      // simplified country outline for the national map (data/ph_outline.json)''')
rep('''  const pt=document.getElementById("p-theme");if(pt){pt.textContent=t==="dark"?"☀":"☾";pt.setAttribute("aria-label",t==="dark"?"Switch to light theme":"Switch to dark theme");}
  if(render){renderBase();renderNoah();renderFlood();drawMap();}''',
'''  for(const pt of [document.getElementById("p-theme"),document.getElementById("nat-theme")])if(pt){pt.textContent=t==="dark"?"☀":"☾";pt.setAttribute("aria-label",t==="dark"?"Switch to light theme":"Switch to dark theme");}
  if(render&&siteBooted){renderBase();renderNoah();renderFlood();drawMap();}   // on the national map no site is drawn yet''')
open(p, "w", encoding="utf-8").write(s); print("template edits applied")
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd /home/claude/work && python3 build_html.py && ./test_pages.sh`
Expected: `ok   test_national.js (24 checks)`, and every other suite `ok`.

- [ ] **Step 5: Look at it**

Take screenshots at 1280 × 900 and 390 × 844 of the plain link, and one after clicking the Metro Manila cluster. Use the same Playwright launch as the tests, with the server running: `node tools/test_server.js &`.

Check by eye that:
- the outline is recognisably the Philippines;
- pins sit where the campuses are (UPLB south of Manila, the Cebu campuses on Cebu, XU and USTP in Cagayan de Oro);
- labels are readable in both themes.

Put the three PNGs in `/mnt/user-data/outputs/nat_*.png` for the build report (Task 13).

- [ ] **Step 6: Commit**

```bash
cd /home/claude/work && git add build_html.py template.html test_national.js && git commit -q -m "Page: national map of the 25 PhilDev campuses with clusters, a searchable grouped list and pilot links" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 11: Campus pages (the bar, the simulation label, the partnership card) and offline files

**Files:**
- Create: `test_campus.js`, `sw.test.js`
- Modify: `template.html` (edit script), `sw.js` (replace)

**Interfaces:**
- Consumes:
  - `CAMPUS_BY_ID`, `NL()`, `NAT_EN`, `natEnter` (Tasks 8 and 10);
  - `DATA.card` (Task 7);
  - `switchSite`, `setView`, `syncTryUI`, the `#p-lang` change handler (existing).
- Produces:
  - `syncCampusUI()`, `natFocusSearch`;
  - markup `[data-cbar] .c-back .c-pick .c-sim` (under the public and the details tab rows);
  - `#c-card #c-card-h #c-units-h #c-units #c-brgy-h #c-brgy-d #c-brgy-s #c-brgy #c-noah-h #c-noah #c-role-h #c-role`;
  - `NAT_EN` keys `change, sim, cardH, unitsH, onCampus, brgyH, brgy1, brgyN, noahH, noahRp, noahNA, roleH, role`;
  - service worker cache `bahawatch-v2`.

- [ ] **Step 1: Write the failing tests**

`test_campus.js`:

```js
// A campus page (spec §3.2, §7.3): "‹ All campuses · <campus> ▾" with the simulation label, and the partnership card.
// Run: ./test_pages.sh test_campus.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{try{localStorage.setItem("bw-asked:xu","1");}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message+' @ '+(e.stack||'').split('\n').slice(1,4).join(' | ')));
  await pg.goto(U+'#xu');await ready(pg,"xu");
  let s=await pg.evaluate(()=>{const bar=document.querySelector('#public [data-cbar]');return {shown:!bar.hidden,back:bar.querySelector('.c-back').textContent,href:bar.querySelector('.c-back').getAttribute('href'),
    pick:bar.querySelector('.c-pick').textContent,pickL:bar.querySelector('.c-pick').getAttribute('aria-label'),sim:bar.querySelector('.c-sim').textContent,
    tab:document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site};});
  assert(s.shown&&s.back==="‹ All campuses"&&s.href==="#ph"&&s.pick==="XU ▾"&&/Change campus \(now Xavier University/.test(s.pickL),"campus bar: ‹ All campuses · XU ▾ ("+s.pickL+")");
  assert(s.sim==="Simulation: sensor readings are simulated; unit spots are proposals. Terrain: FABDEM (30 m). Not a forecast; not for emergency use.","simulation label always shown on a campus page");
  assert(s.tab==="ph","the PhilDev campuses tab stays selected on a campus page");
  s=await pg.evaluate(()=>({hidden:document.getElementById('c-card').hidden,h:document.getElementById('c-card-h').textContent,uh:document.getElementById('c-units-h').textContent,
    units:[...document.querySelectorAll('#c-units li')].map(l=>l.textContent),brgyS:document.getElementById('c-brgy-s').textContent,brgy:document.querySelectorAll('#c-brgy li').length,
    card:DATA.card,noah:[...document.querySelectorAll('#c-noah li')].map(l=>l.textContent),role:document.querySelectorAll('#c-role li').length}));
  assert(!s.hidden&&s.h==="What a partnership looks like","partnership card shown with its heading");
  assert(s.uh==="Proposed units: 8 household water-level units, placed automatically"&&s.units.length===8,"8 proposed units listed");
  assert(/^BW-XU-01 · .+ · on campus$/.test(s.units[0])&&s.units.slice(1).every(u=>!/on campus/.test(u)),"unit 01, and only unit 01, is marked on campus: "+s.units[0]);
  assert(s.brgy===s.card.barangays.length&&s.brgy>0&&s.brgyS===(s.brgy===1?"1 barangay":s.brgy+" barangays"),"barangays covered: count, then the list ("+s.brgyS+")");
  assert(s.noah.length===3&&s.noah.every((t,i)=>new RegExp("^"+["5","25","100"][i]+"-year rain: (\\d+%|not available from NOAH)$").test(t)),"three NOAH lines: "+s.noah.join(" | "));
  assert(s.role===3,"university role: three lines");
  s=await pg.evaluate(()=>{DATA.card.noah["100"]=null;syncCampusUI();return document.querySelectorAll('#c-noah li')[2].textContent;});
  assert(s==="100-year rain: not available from NOAH","a missing NOAH period reads 'not available', never 0%");
  // details view: bar stays, card goes; Try tab and pilot sites: neither
  await pg.click('#p-details');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({bar:!document.querySelector('header + .site-tabs + [data-cbar]').hidden,card:document.getElementById('c-card').hidden}));
  assert(s.bar&&s.card,"details view: the campus bar stays, the card is for the simple view");
  await pg.click('header + .site-tabs [data-site="try"]');await pg.waitForTimeout(300);
  assert(await pg.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].every(b=>b.hidden)&&document.getElementById('c-card').hidden),"Try reporting: no campus bar, no card");
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  assert(await pg.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].every(b=>b.hidden)&&document.getElementById('c-card').hidden),"a pilot site: no campus bar, no card");
  // ▾ opens the national list with the search box focused; ‹ All campuses opens the map
  await pg.goto(U+'#xu');await ready(pg,"xu");
  await pg.click('#public [data-cbar] .c-pick');await ready(pg,"ph");
  assert(await pg.evaluate(()=>document.activeElement.id==="nat-q"),"'XU ▾' opens the campus list with the search box focused");
  await pg.goBack();await ready(pg,"xu");
  await pg.click('#public [data-cbar] .c-back');await ready(pg,"ph");
  assert(await pg.evaluate(()=>ROUTE==="ph"),"'‹ All campuses' returns to the national map");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

`sw.test.js` (Review Focus 4):

```js
// The service worker's offline fallbacks (Review Focus 4). Run: node --test --no-warnings sw.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), vm = require('vm');

function load(cached) {
  const handlers = {};
  const cache = { put: async () => {} };
  const ctx = {
    self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: { origin: 'https://bw.test' }, URL, Response,
    fetch: () => Promise.reject(new TypeError('offline')),
    caches: { open: async () => cache, keys: async () => [], match: async (req) => cached[typeof req === 'string' ? req : new URL(req.url).pathname.slice(1)] },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), ctx);
  return (url, mode) => new Promise((resolve) => handlers.fetch({ request: { method: 'GET', url, mode }, respondWith: (p) => resolve(p) }));
}
const HTML = { page: 'dashboard' };

test('offline, a page navigation falls back to the cached dashboard', async () => {
  const get = load({ 'bahawatch_dashboard.html': HTML });
  assert.equal(await get('https://bw.test/bahawatch_dashboard.html?source=pwa', 'navigate'), HTML);
});
test('offline, an uncached data file fails instead of returning the HTML page', async () => {
  const get = load({ 'bahawatch_dashboard.html': HTML });
  const r = await get('https://bw.test/data/xu.json', 'cors');
  assert.notEqual(r, HTML); assert.equal(r.type, 'error');
});
test('offline, a data file visited before comes from the cache', async () => {
  const XU = { site: 'xu' };
  const get = load({ 'bahawatch_dashboard.html': HTML, 'data/xu.json': XU });
  assert.equal(await get('https://bw.test/data/xu.json', 'cors'), XU);
});
test('the cache name moved to v2 so old shells are cleared', () => {
  assert.match(fs.readFileSync(__dirname + '/sw.js', 'utf8'), /bahawatch-v2/);
});
```

Run: `cd /home/claude/work && ./test_pages.sh test_campus.js; node --test --no-warnings sw.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected:
- `FAIL test_campus.js`: `querySelector('#public [data-cbar]')` is null;
- `# fail 2`: the uncached-data-file test gets the HTML page, and the v2 cache-name test fails.

- [ ] **Step 2: Edit `template.html`**

Save as `/tmp/bw_task11_template.py` and run it from the repo root. The script:
- adds the campus bar under both site tab rows;
- adds the card after the report row;
- adds their CSS and strings;
- adds `syncCampusUI()` and the "▾ opens the list with search focused" handler;
- calls it from `switchSite`, `setView`, `syncTryUI` and the language menu.

```python
import sys
p = "template.html"; s = open(p, encoding="utf-8").read()
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:90], s.count(old)); s = s.replace(old, new)
# ---- Task 11: the campus bar with the simulation label, and the partnership card
CBAR = r'''<div class="c-bar" data-cbar hidden>
  <a href="#ph" class="c-back"></a><span aria-hidden="true">·</span><button class="c-pick"></button>
  <p class="c-sim"></p>
</div>
'''
rep('''</nav>
  <p class="try-sim" id="try-sim" hidden></p>''', '''</nav>
''' + CBAR + '''  <p class="try-sim" id="try-sim" hidden></p>''')
rep('''</nav>
<div class="d-live-banner"''', '''</nav>
''' + CBAR + '''<div class="d-live-banner"''')
rep('''      <div class="p-live-note" id="p-live-note" hidden></div>''', r'''      <section class="c-card" id="c-card" aria-labelledby="c-card-h" hidden>
        <h2 id="c-card-h"></h2>
        <h3 id="c-units-h"></h3><ol id="c-units"></ol>
        <h3 id="c-brgy-h"></h3><details id="c-brgy-d"><summary id="c-brgy-s"></summary><ul id="c-brgy"></ul></details>
        <h3 id="c-noah-h"></h3><ul id="c-noah"></ul>
        <h3 id="c-role-h"></h3><ul id="c-role"></ul>
      </section>
      <div class="p-live-note" id="p-live-note" hidden></div>''')
rep('''.route-msg{max-width:640px;''', r'''/* campus pages: the bar under the tabs, and the partnership card */
.c-bar{display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; padding:6px 0}
[data-view="details"] .c-bar{padding:6px 22px}
.c-bar[hidden]{display:none}
.c-back,.c-pick{min-height:48px; display:inline-flex; align-items:center; font-weight:700; font-size:15px}
.c-back{color:var(--brand)}
.c-sim{flex-basis:100%; font-size:13px; color:var(--ink); background:var(--warn-bg); border-radius:4px; padding:6px 10px; margin:0}
.c-card{border:1px solid var(--line); border-radius:6px; padding:14px 16px; margin-top:14px; background:var(--panel)}
.c-card[hidden]{display:none}
.c-card h2{font-size:16px; font-weight:700; margin-bottom:4px}
.c-card h3{font-size:14px; font-weight:700; margin:12px 0 4px}
.c-card ol,.c-card ul{margin:0; padding-left:20px}
.c-card li{margin:2px 0}
.c-card summary{min-height:48px; display:flex; align-items:center; cursor:pointer}
.c-oc{font-weight:700}
.route-msg{max-width:640px;''')
rep('''  foot:"Campus list: PhilDev partners''', r'''  change:"Change campus (now {name})",
  sim:"Simulation: sensor readings are simulated; unit spots are proposals. Terrain: FABDEM (30 m). Not a forecast; not for emergency use.",
  cardH:"What a partnership looks like",unitsH:"Proposed units: {n} household water-level units, placed automatically",onCampus:"on campus",
  brgyH:"Barangays covered",brgy1:"1 barangay",brgyN:"{n} barangays",
  noahH:"NOAH flood hazard in this area (share of the land in a hazard zone)",noahRp:"{rp}-year rain",noahNA:"not available from NOAH",
  roleH:"University role",role:["Students install and look after the units with residents.","Faculty check the data.","The campus hosts one unit and the local dashboard."],
  foot:"Campus list: PhilDev partners''')
rep('''function natEnter(){let saved=null;try{saved=localStorage.getItem("bw-lang:ph");}catch(e){}if(saved&&LANGS[saved])LANG=saved;natRender();}

''', '''let natFocusSearch=false;             // the campus bar's "▾" opens the national list with the search box focused
function natEnter(){let saved=null;try{saved=localStorage.getItem("bw-lang:ph");}catch(e){}if(saved&&LANGS[saved])LANG=saved;natRender();
  if(natFocusSearch){natFocusSearch=false;$("nat-q").focus();}}
// Campus pages: the "‹ All campuses · <campus> ▾" bar with the simulation label, and the partnership card (spec §3.2).
function syncCampusUI(){
  const c=CAMPUS_BY_ID[SITE],L=NL(),on=!!c&&!TRY;
  document.querySelectorAll("[data-cbar]").forEach(bar=>{
    bar.hidden=!on;if(!on)return;
    bar.querySelector(".c-back").textContent=L.back;
    const p=bar.querySelector(".c-pick");p.textContent=c.short+" ▾";p.setAttribute("aria-label",fill(L.change,{name:c.name}));
    bar.querySelector(".c-sim").textContent=L.sim;
  });
  const card=$("c-card"),D=DATA&&DATA.card;
  card.hidden=!on||!D||VIEW!=="public";if(card.hidden)return;
  $("c-card-h").textContent=L.cardH;
  $("c-units-h").textContent=fill(L.unitsH,{n:D.units.length});
  $("c-units").innerHTML=D.units.map(u=>`<li><b>${esc(u.id)}</b> · ${esc(u.name)}${u.oc?` · <span class="c-oc">${esc(L.onCampus)}</span>`:""}</li>`).join("");
  $("c-brgy-h").textContent=L.brgyH;
  $("c-brgy-s").textContent=fill(D.barangays.length===1?L.brgy1:L.brgyN,{n:D.barangays.length});
  $("c-brgy").innerHTML=D.barangays.map(b=>`<li>${esc(b)}</li>`).join("");
  $("c-noah-h").textContent=L.noahH;
  $("c-noah").innerHTML=["5","25","100"].map(rp=>{const v=D.noah[rp];return `<li>${esc(fill(L.noahRp,{rp}))}: ${v==null?esc(L.noahNA):Math.round(v*100)+"%"}</li>`;}).join("");
  $("c-role-h").textContent=L.roleH;$("c-role").innerHTML=L.role.map(r=>`<li>${esc(r)}</li>`).join("");
}
document.addEventListener("click",e=>{if(e.target.closest(".c-pick")){natFocusSearch=true;location.hash="#ph";}});

''')
rep('''  recentReports=[];renderRecent();pollRecent();
  markReady(id);''', '''  recentReports=[];renderRecent();pollRecent();
  syncCampusUI();markReady(id);''')
rep('''  VIEW=v;document.body.dataset.view=v;
  syncLiveUI();''', '''  VIEW=v;document.body.dataset.view=v;
  syncLiveUI();syncCampusUI();''')
rep('''function syncTryUI(){''', r'''function syncTryUI(){
  syncCampusUI();''')
rep('''$("p-lang").addEventListener("change",e=>{LANG=e.target.value;try{localStorage.setItem(siteKey("bw-lang"),LANG);}catch(x){}renderPublic();});''',
'''$("p-lang").addEventListener("change",e=>{LANG=e.target.value;try{localStorage.setItem(siteKey("bw-lang"),LANG);}catch(x){}renderPublic();syncCampusUI();});''')
open(p, "w", encoding="utf-8").write(s); print("template edits applied")
```

- [ ] **Step 3: Replace `sw.js`**

```js
// Offline shell: the page opens without signal and shows the last answer with its age (spec §5). Site files
// (data/<site>.json) are cached as they are fetched, so a campus visited once opens offline too.
const CACHE = 'bahawatch-v2';
const SHELL = ['./', 'index.html', 'bahawatch_dashboard.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;          // API calls: network only
  // ignoreSearch: the PWA start_url launches as bahawatch_dashboard.html?source=pwa (so a relaunch can restore
  // the person's last view), but the shell was cached without that query string — match it either way.
  // Only a page navigation may fall back to the dashboard HTML; a data file that isn't cached must fail, so the
  // page shows "didn't load · Try again" instead of trying to read HTML as JSON.
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })
      .then((m) => m || (e.request.mode === 'navigate' ? caches.match('bahawatch_dashboard.html') : Response.error()))));
});
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd /home/claude/work && python3 build_html.py && node --test --no-warnings sw.test.js 2>&1 | grep -E "^# (pass|fail)" && ./test_pages.sh`
Expected: `# pass 4`, `# fail 0`; `ok   test_campus.js (16 checks)` and every other suite `ok`.

- [ ] **Step 5: Commit**

```bash
cd /home/claude/work && git add template.html sw.js sw.test.js test_campus.js && git commit -q -m "Page: campus bar with simulation label, partnership card; offline data files never answered with HTML" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 12: Accessibility, speed and size checks

**Files:**
- Create: `test_a11y.js`

**Interfaces:**
- Consumes: everything on the page from Tasks 8–11.
- Produces: the §7.4 and §7.5 checks.
  - Keyboard: Tab order, visible focus.
  - Announcing search once.
  - Text contrast ≥ 4.5:1 and pin contrast ≥ 3:1 in both themes.
  - Pins distinct under protan, deutan and tritan simulation (Machado 2009; closest pair ≥ 60 in sRGB).
  - At 390 px: no sideways scroll, controls ≥ 48 px.
  - Six-language strings.
  - Opening page ≤ 250 KB gzipped; data files ≤ 450,000 bytes.
  - UPLB in ≤ 3 s on Fast 3G.

These checks describe the finished page, so they should pass on the first run. When one fails, the failure is the RED step:
1. Fix the page, test-first.
2. Re-run until green.
3. Ledger it as `Task 12: fixed <what> — <check> RED→GREEN`.

The check "the theme button works before any site is opened" found a real bug while this plan was written; Task 10's `setTheme` guard is its fix.

- [ ] **Step 1: Write the checks**

`test_a11y.js`:

```js
// Accessibility, speed and size for the national view and campus pages (spec §7.4, §7.5).
// Run: ./test_pages.sh test_a11y.js
const {chromium}=require('playwright');
const fs=require('fs'),zlib=require('zlib'),path=require('path');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(m[0])+0.7152*f(m[1])+0.0722*f(m[2]);};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
// Machado, Oliveira & Fernandes (2009) simulation matrices, severity 1.0, applied in linear RGB
const CVD={protan:[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
  deutan:[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
  tritan:[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]};
const toLin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);},toS=v=>{v=Math.min(1,Math.max(0,v));return 255*(v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055);};
const sim=(c,m)=>{const l=c.match(/[\d.]+/g).slice(0,3).map(Number).map(toLin);return m.map(r=>toS(r[0]*l[0]+r[1]*l[1]+r[2]*l[2]));};
const TEXT=`(sel)=>{const bg=e=>{for(let x=e;x;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\\(0, 0, 0, 0\\)|transparent/.test(c))return c;}return getComputedStyle(document.body).backgroundColor;};
  return [...document.querySelectorAll(sel)].filter(e=>e.offsetParent&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('.sr-only'))
    .map(e=>({id:e.id||e.className||e.tagName,fg:getComputedStyle(e).color,bg:bg(e)}));}`;
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await ready(pg,"ph");
  await pg.click('#nat-theme');await pg.click('#nat-theme');
  assert(errs.length===0&&await pg.evaluate(()=>document.documentElement.dataset.theme==="light"),"the theme button works on the national map before any site is opened");
  // keyboard: the search box, the list and the pins are reachable with Tab, and focus is visible
  await pg.focus('#nat-q');await pg.keyboard.press('Tab');
  let s=await pg.evaluate(()=>({cls:document.activeElement.className,ol:getComputedStyle(document.activeElement).outlineStyle}));
  assert(s.cls==="nat-item"&&s.ol!=="none","Tab from the search box reaches the campus list, with a visible focus ring");
  s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-pins a, #nat-pins button')].every(e=>e.tabIndex===0));
  assert(s,"every pin and cluster is in the Tab order");
  await pg.focus('#nat-pins .pin');
  assert(await pg.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=="none"),"a focused pin shows its focus ring");
  // search results are announced once per pause, not per keystroke
  await pg.evaluate(()=>{window.__ann=0;new MutationObserver(()=>window.__ann++).observe(document.getElementById('nat-count'),{childList:true,characterData:true,subtree:true});});
  await pg.type('#nat-q','cebu',{delay:40});await pg.waitForTimeout(700);
  s=await pg.evaluate(()=>({n:window.__ann,t:document.getElementById('nat-count').textContent}));
  assert(s.n===1&&s.t==="5 campuses match.","typing 'cebu' is announced once: "+JSON.stringify(s));
  await pg.fill('#nat-q','');
  // contrast in both themes: national view text ≥ 4.5:1, pins ≥ 3:1 against the map; pins stay apart for colour-blind viewers
  for(const theme of ["light","dark"]){
    await pg.evaluate(t=>setTheme(t,true),theme);await pg.waitForTimeout(100);
    const pairs=await pg.evaluate(`(${TEXT})('#nat *')`);
    const bad=pairs.map(p=>({...p,r:ratio(p.fg,p.bg)})).filter(p=>p.r<4.5);
    assert(pairs.length>40&&bad.length===0,`${theme}: national view text contrast ≥ 4.5:1 (${pairs.length} elements): `+bad.slice(0,4).map(p=>p.id+" "+p.r.toFixed(2)).join(", "));
    const pins=await pg.evaluate(()=>({map:getComputedStyle(document.getElementById('nat-map')).backgroundColor,
      c:["suc","luc","private"].map(t=>{const e=document.querySelector('#nat-legend .pin-'+t);return getComputedStyle(e).backgroundColor;})}));
    const low=pins.c.map(c=>ratio(c,pins.map));
    assert(low.every(r=>r>=3),`${theme}: pin colours ≥ 3:1 against the map: ${low.map(r=>r.toFixed(1))}`);
    for(const [k,m] of Object.entries(CVD)){
      const q=pins.c.map(c=>sim(c,m));let min=1e9;
      for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)min=Math.min(min,Math.hypot(...q[i].map((v,x)=>v-q[j][x])));
      assert(min>=60,`${theme}: pin colours stay distinct under ${k} simulation (closest pair ${min.toFixed(0)})`);
    }
  }
  await pg.evaluate(()=>setTheme("light",true));
  // a campus page: bar and card text contrast in both themes
  await pg.goto(U+'#xu');await ready(pg,"xu");
  for(const theme of ["light","dark"]){
    await pg.evaluate(t=>setTheme(t,true),theme);await pg.waitForTimeout(100);
    const pairs=await pg.evaluate(`(${TEXT})('#public [data-cbar] *, #c-card *')`);
    const bad=pairs.map(p=>({...p,r:ratio(p.fg,p.bg)})).filter(p=>p.r<4.5);
    assert(pairs.length>10&&bad.length===0,`${theme}: campus bar and card contrast ≥ 4.5:1: `+bad.slice(0,4).map(p=>p.id+" "+p.r.toFixed(2)).join(", "));
  }
  // phone width: no sideways scroll; every control in the national view and the campus bar is ≥ 48 px tall
  const ph=await b.newPage({viewport:{width:390,height:844}});ph.on('pageerror',e=>errs.push(e.message));
  await ph.goto(U);await ready(ph,"ph");
  s=await ph.evaluate(()=>({sw:document.documentElement.scrollWidth,small:[...document.querySelectorAll('#nat a, #nat button, #nat input, #nat select')].filter(e=>e.offsetParent&&!e.closest('.site-tabs')&&e.getBoundingClientRect().height<48).map(e=>e.className||e.id)}));
  assert(s.sw<=390&&s.small.length===0,"390 px national view: no sideways scroll ("+s.sw+"), controls ≥ 48 px: "+s.small.slice(0,5));
  await ph.goto(U+'#xu');await ready(ph,"xu");
  s=await ph.evaluate(()=>({sw:document.documentElement.scrollWidth,small:[...document.querySelectorAll('#public [data-cbar] a, #public [data-cbar] button, #c-card summary')].filter(e=>e.getBoundingClientRect().height<48).map(e=>e.className||e.id)}));
  assert(s.sw<=390&&s.small.length===0,"390 px campus page: no sideways scroll ("+s.sw+"), bar and card controls ≥ 48 px: "+s.small);
  // new strings exist in six languages (non-English marked for native review)
  s=await pg.evaluate(()=>{const miss=[];for(const k of ["en","fil","ceb","ilo","hil","pam"]){for(const n of Object.keys(NAT_LANGS.en))if(NAT_LANGS[k]==null||NAT_LANGS[k][n]==null)miss.push(k+"."+n);if(k!=="en"&&!NAT_LANGS[k]._review)miss.push(k+"._review");}return miss;});
  assert(s.length===0,"national and campus strings in six languages, non-English marked for review: "+s.join(","));
  // size: the opening page is small; site files stay within budget
  const html=fs.readFileSync(path.join(__dirname,'bahawatch_dashboard.html'));
  const gz=zlib.gzipSync(html).length;
  assert(gz<=250*1024,`opening page ${Math.round(gz/1024)} KB gzipped (≤ 250 KB)`);
  const big=fs.readdirSync(path.join(__dirname,'data')).filter(f=>f.endsWith('.json')).map(f=>[f,fs.statSync(path.join(__dirname,'data',f)).size]).filter(([,n])=>n>450000);
  assert(big.length===0,"every data file ≤ 450,000 bytes: "+big.map(x=>x.join(" ")).join(", "));
  // speed: a campus appears within 3 s on the browser's "Fast 3G" profile
  const slow=await b.newPage({viewport:{width:1280,height:900}});
  await slow.goto(U);await ready(slow,"ph");
  const cdp=await slow.context().newCDPSession(slow);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:562.5,downloadThroughput:1.6*1024*1024/8*0.9,uploadThroughput:750*1024/8*0.9});
  const t0=Date.now();await slow.click('#nat-list a[href="#uplb"]');await ready(slow,"uplb");const dt=Date.now()-t0;
  assert(dt<=3000,`UPLB appears in ${dt} ms on Fast 3G (≤ 3000)`);
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 2: Run them**

Run: `cd /home/claude/work && ./test_pages.sh test_a11y.js`
Expected: `ok   test_a11y.js (24 checks)`. The Fast 3G line should show about 1–2 s. The opening page should be about 60 KB gzipped.

- [ ] **Step 3: Commit**

```bash
cd /home/claude/work && git add test_a11y.js && git commit -q -m "Checks: keyboard, announcements, contrast, colour-blind pins, 390 px, six languages, size and Fast 3G budgets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 13: Hand-over (docs, QR codes, checks, screenshots, review, report, demo, bundle)

**Files:**
- Modify: `README.md`, `DATA-LICENSE.md`, `qr/` (regenerated; `qr/diliman/` removed)
- Create: `docs/superpowers/reports/2026-09-27-phildev-campuses-build-report.md` and its PDF, screenshots in `/mnt/user-data/outputs/`

**Interfaces:**
- Consumes: everything above.
- Produces: the merged-ready branch, the report PDF, the updated private demo, and `bahawatch.bundle`.

- [ ] **Step 1: README and data licences**

In `README.md`:
- **New section "§2.5 PhilDev campuses: the pipeline":**
  - the national files it reads;
  - the Task 5 commands for `find` and `cut` (PC);
  - the container build lines from Task 7 Step 7;
  - `inputs/campuses/` git-ignored;
  - how to add a campus: a csv row, then `find`, choose, `cut --only <id>`, `SITE=<id> python3 build_data.py`, `build_places.py`.
- **Site list:** Teachers Village and Berkeley are pilots; UP Diliman is now a campus page; old `#diliman` links redirect.
- **How to run the tests:**
  - `./test_build.sh`;
  - `node --test --no-warnings shared/*.test.js sw.test.js`;
  - `(cd worker && node --test --no-warnings test/*.test.js)`;
  - `python3 tools/test_places.py`;
  - `./test_pages.sh`.

  Update the test table with the new suites (`test_routes`, `test_obstacles`, `test_national`, `test_campus`, `test_a11y`).
- **§6 model notes:**
  - FABDEM for Philippine sites;
  - buildings as obstacles (≥ 75 %);
  - sea;
  - automatic placement (weights and spacing);
  - `g_ref` is the median of the units' ground heights everywhere.
- **Parked:** before deploying the Worker with 27 sites, re-count the D1 queries per cron run (27 rain upserts + about 6 reads and writes, of 50) and the CPU time.

In `DATA-LICENSE.md`, add:
- **FABDEM V1-2** (University of Bristol): CC BY-NC-SA 4.0, non-commercial.
- **The VIDA combined building footprints:** Google Open Buildings CC BY 4.0, Microsoft Building Footprints ODbL, OSM ODbL.
- **The Geofabrik OpenStreetMap extract:** ODbL.
- **The PSA/NAMRIA administrative boundaries:** fetch the dataset page on OCHA HDX with WebFetch and quote its licence line exactly.
- **UP Project NOAH** hazard maps, for all provinces used.

Remove the Copernicus GLO-30 line only if nothing still uses it: Berkeley doesn't, and Teachers Village no longer does.

- [ ] **Step 2: QR codes**

Run: `cd /home/claude/work && git rm -rq qr/diliman && python3 tools/make_qr.py && ls qr | wc -l && wc -l < qr/index.csv`
Expected:
- 27 site folders plus `index.csv`;
- one csv line per place plus the header. This matches the total of the place counts from Task 7 Step 7.

- [ ] **Step 3: Every check, from clean**

Run:
```bash
cd /home/claude/work && python3 build_html.py && ./test_build.sh | tail -3 && node --test --no-warnings shared/*.test.js sw.test.js 2>&1 | grep -E '^# (pass|fail)' && (cd worker && node --test --no-warnings test/*.test.js 2>&1 | grep -E '^# (pass|fail)') && python3 -W ignore tools/test_places.py 2>&1 | tail -1 && ./test_pages.sh
```

Expected:
- `test_build.sh` ends `ok   default output is data/<site>.json`;
- shared + sw `# pass 28`, `# fail 0`;
- worker `# pass 46`, `# fail 0`;
- places `OK`;
- every page suite `ok`: `test_a11y`, `test_answer`, `test_campus`, `test_car`, `test_figure`, `test_init`, `test_national`, `test_noaccount`, `test_obstacles`, `test_public`, `test_recent`, `test_report`, `test_routes`, `test_sites`, `test_tabs`, `test_try`.

- [ ] **Step 4: The screenshot sheet (spec §7.6)**

```bash
cd /home/claude/work && node tools/test_server.js > /dev/null 2>&1 & sleep 1; cd /home/claude/work && node - <<'JS'
// screenshot sheet for the build report: the national map, and five campuses at their storm peak (details view)
const {chromium}=require('playwright'),fs=require('fs');
const sizes=fs.readdirSync('data').filter(f=>f.endsWith('.json')&&!['ph_outline.json','tv.json','berkeley.json'].includes(f)).map(f=>[f.slice(0,-5),fs.statSync('data/'+f).size]).sort((a,b)=>a[1]-b[1]);
const pick=[...new Set(['upd','usc','xu',sizes[0][0],sizes[sizes.length-1][0]])];
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  await pg.goto('http://127.0.0.1:8765/bahawatch_dashboard.html');await pg.waitForFunction(()=>document.body.dataset.ready==='ph');
  await pg.screenshot({path:'/mnt/user-data/outputs/sheet_national.png'});
  for(const id of pick){
    await pg.goto('http://127.0.0.1:8765/bahawatch_dashboard.html#'+id+'/details');await pg.waitForFunction(x=>document.body.dataset.ready===x,id);
    await pg.evaluate(()=>{playing=false;scenario="typhoon";let best=0,bt=300;for(let t=300;t<=700;t+=20){tMin=t;lastEmit=-999;step(0,true);let w=0;for(let i=0;i<N;i++)if(depth[i]>0.05)w++;if(w>best){best=w;bt=t;}}tMin=bt;lastEmit=-999;step(0,true);});
    await pg.screenshot({path:`/mnt/user-data/outputs/sheet_${id}.png`});
    console.log(id,'done');
  }
  await b.close();
})();
JS
kill %1
```

Look at every PNG. For each campus, check that:
- the campus is in the middle of the frame;
- the water sits in low ground and along creeks, not across blocks of buildings;
- sea, if any, is drawn as water and holds no flood;
- unit 01 is on the campus.

A finding here is a bug to fix test-first (Tasks 6–11), not a note. Ledger what you saw, one line per campus.

- [ ] **Step 5: Whole-branch review**

Follow the execution skill's final review:
- the review package from `git merge-base main HEAD` to `HEAD`;
- a fresh reviewer on the most capable model;
- the plan's Review Focus verbatim;
- one fix pass for Critical and Important findings, each fix RED→GREEN plus the full Step 3 run;
- Minor findings ledgered as deferred.

- [ ] **Step 6: The build report (PDF)**

Write `docs/superpowers/reports/2026-09-27-phildev-campuses-build-report.md` from this outline. Fill every `<…>` from the ledger and the command outputs, not from memory.

```markdown
# Nationwide PhilDev prototype — build report

Date: <today> · Branch `phildev-campuses` · Spec `docs/superpowers/specs/2026-09-27-philippines-phildev-campuses-design.md`
Plan `docs/superpowers/plans/2026-09-27-philippines-phildev-campuses.md`

## 1. What was built
<one paragraph per area: pipeline run on the PC (with the log lines), the 27 site files, the page (national map, campus pages, card), tests>

## 2. The 25 campuses
<the output of `python3 tools/check_site_data.py`, as a table: campus · size · units · spacing · barangays · NOAH 5/25/100>

## 3. Screenshots
<![national](/mnt/user-data/outputs/sheet_national.png) and one image per campus from Step 4, each with one line on what it shows>

## 4. Test results
<each suite with its count: test_build.sh, shared, sw, worker, places, every page suite>

## 5. Rulings made during the build
<every `Ruling:` line from the ledger, with its cost if wrong>

## 6. Deferred minors
<every `minor (deferred)` line>

## 7. Honest limits and what is parked
<FABDEM 30 m and 1–3 m height error in dense cities; terrain-and-obstacle spread, not hydraulics; unit spots are proposals;
readings simulated; the Worker is not deployed — with 27 sites a cron run would make ~27 rain writes plus ~6 queries,
under D1's 50 but closer than before; native review of the new strings; LiPAD 1 m when granted>
```

Then:
```bash
cd /home/claude/work && python3 tools/md_to_pdf.py docs/superpowers/reports/2026-09-27-phildev-campuses-build-report.md /mnt/user-data/outputs/BahaWatch_PhilDev-Campuses_Build_Report_$(date +%F).pdf
```

Render pages 1 and 3 to PNG (`pdftoppm -r 60`) and look at them: tables fit, and the images show.

```bash
cd /home/claude/work && git add README.md DATA-LICENSE.md qr docs/superpowers/reports && git commit -q -m "Docs: pipeline runbook, data licences, QR codes for 27 sites, build report" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

- [ ] **Step 7: Update the private demo artifact**

Publish `bahawatch_dashboard.html` to the existing artifact `https://claude.ai/artifact/Mjsm9genvWF9sFdXxuKis9`:
- read it first, as the Artifact tool requires;
- pass `files` mapping each `data/<id>.json` (27 files) to its path, and `manifest.webmanifest`;
- the icon is kept.

Open `#xu` on the published page and confirm it loads (the files are served next to the page).

- [ ] **Step 8: Bundle for Gregor**

Run: `cd /home/claude/work && git bundle create /mnt/user-data/outputs/bahawatch.bundle phildev-campuses main`

Tell Gregor, with the report PDF attached, that after his review the branch is merged to `main` in the container (superpowers:finishing-a-development-branch) and re-bundled. He then runs, in PowerShell:
```powershell
cd $HOME\bahawatch
git pull "$HOME\Downloads\bahawatch.bundle" main
git push
```

GitHub Pages then serves the national map at the plain link.
