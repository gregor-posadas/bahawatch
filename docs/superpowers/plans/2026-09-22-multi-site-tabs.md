# Multi-site tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One dashboard file with three site tabs — Teachers Village, UP Diliman, UC Berkeley — each on its own terrain, streets, sensors, hazard layer and wording, switchable without reload and addressable by URL hash.

**Architecture:** A `sites.py` config drives `build_data.py` to emit one `data_<id>.json` per site; `build_html.py` injects all three as `DATA_ALL`. In the page, every site-level constant becomes state built by `initSite(id)`; a tab bar and hash router call it. Wording profiles (`street` / `path`) key the strings that name streets or vehicles.

**Tech Stack:** Python 3 (numpy, scipy, rasterio, pyshp, pyproj), single-file HTML/JS/CSS (no framework), Playwright tests under Node.

**Spec:** `docs/superpowers/specs/2026-09-22-multi-site-tabs-design.md`

## Global Constraints

- Single self-contained HTML file; no external requests at runtime; embedded data ≤ 1.3 MB total.
- Teachers Village behavior must not change: its data file must be byte-identical to today's `data.json` after Task 1, and every existing test (`test_figure.js`, `test_public.js`, `test_sites.js`, `test_car.js`) must keep passing at every task.
- Thresholds stay as shipped in v17: shapes at 5 / 33 cm, passability at 25 / 33 / 66 cm.
- Site hashes: `#tv`, `#diliman`, `#berkeley`; details view via `/details` suffix; no hash = Teachers Village, public view.
- Per-site `localStorage` keys: `bw-street:<site>`, `bw-lang:<site>`; theme stays `bw-theme`.
- Berkeley: English only, language menu hidden, imperial first; sensor labels are building names; scenarios "Dry day / Winter storm / Atmospheric river" with P 0 / 0.14 / 0.40.
- Diliman grid 200 × 200; Berkeley grid 240 × 180 with no minimum filter, σ = 0.8, carve 0.25 m.
- Every sensor must sit on a building carrying its configured name or address, within 60 m of its labeled creek or street; the build fails otherwise.
- Playwright runs with `executablePath:'/opt/pw-browsers/chromium'` and `args:['--no-sandbox']`; each test script prints `ok` lines and sets a nonzero exit code on `FAIL`.
- Workspace has no git repository: "commit" steps copy the deliverable into `pkg/` and rebuild `bahawatch_dashboard_package.zip` instead (see Task 7 step 6 for the command).

## Review Focus

1. Switching tabs while a unit is selected: `selected` must be cleared, the street highlight removed and the figure re-rendered from the new site — test in Task 5.
2. A stored `bw-street:<site>` id that no longer exists in that site's sensor list (renamed unit): the page must fall back to "choose my street", not throw — test in Task 5.
3. An unknown hash (`#nowhere`) or a malformed one (`#berkeley/x`): default to Teachers Village public view, and rewrite the hash — test in Task 5.
4. Berkeley lidar `nodata` (−999999) under a sensor or a street: masked before filtering, and the build must fail loudly if a sensor cell is masked — test in Task 2.
5. A non-English language stored from another site when Berkeley loads (menu hidden): the page must force `en` on Berkeley and restore the other site's language when switching back — test in Task 6.

---

### Task 1: Site config module and site-driven `build_data.py` (Teachers Village unchanged)

**Files:**
- Create: `sites.py`
- Modify: `build_data.py` (lines 24–67: inputs, frame, conditioning, sensors, labels, road classes)
- Test: `test_build.sh` (new)

**Interfaces:**
- Produces: `sites.SITES: dict[str, dict]` with keys per site: `id, name, place, bbox (LON0,LAT0,LON1,LAT1), W, H, GW, GH, dem, dem_kind ("dsm"|"dtm"), min_filter (int|None), sigma, carve, osm, noah (dict|None), sensors (list of (id, label, lon, lat)), site_by ("address"|"name"), labels, road_class (dict), creek_tags (set), profile ("street"|"path"), langs ("all"|"en"), units ("metric"|"imperial"), scen (dict), emergency (str), attribution (str)`.
- Produces: `build_data.py` reads `SITE=<id>` from the environment (default `tv`) and writes `data_<id>.json`; the JSON gains a top-level `site` object copied from the config (`id, name, place, profile, langs, units, scen, emergency, attribution, hazard: bool`).

- [ ] **Step 1: Write the regression test**

`test_build.sh`:
```bash
#!/bin/bash
# Teachers Village must build byte-identically from the site config.
set -e
cd "$(dirname "$0")"
SITE=tv OUTPUT=/tmp/data_tv_check.json python3 build_data.py > /tmp/build_tv.log
python3 - <<'EOF'
import json
a=json.load(open("data.json")); b=json.load(open("/tmp/data_tv_check.json"))
b.pop("site",None)
assert a==b, "Teachers Village data changed"
print("ok   tv data identical")
EOF
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash test_build.sh`
Expected: FAIL — `build_data.py` ignores `SITE` and writes today's layout without a `site` key only if run with the old defaults; with `SITE=tv` set it still passes accidentally. Make it fail on purpose by asserting the `site` key exists first:
```bash
python3 -c "import json;d=json.load(open('/tmp/data_tv_check.json'));assert d['site']['id']=='tv';print('ok   site key present')"
```
Expected: `KeyError: 'site'`.

- [ ] **Step 3: Write `sites.py`**

```python
"""Per-site configuration for build_data.py. One entry per dashboard tab."""
ROAD_STREET = {"primary":"major","primary_link":"major","secondary":"major","secondary_link":"major",
               "tertiary":"mid","residential":"minor","unclassified":"minor","busway":"minor",
               "service":"alley"}
# Campus profile: footpaths are the streets. Steps are excluded (not walkable in water anyway).
ROAD_PATH = dict(ROAD_STREET, **{"footway":"minor","path":"minor","pedestrian":"minor","cycleway":"minor","living_street":"minor"})

NOAH = {"5":"inputs/noah/MetroManila_Flood_5year","25":"inputs/noah/MetroManila_Flood_25year","100":"inputs/noah/MetroManila_Flood_100year"}

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
   scen={"clear":("Dry day",0,0,0),"monsoon":("Habagat rain",0.16,300,180),"typhoon":("Typhoon",0.50,340,150)},
   emergency="911 or your barangay",
   attribution="Map data © OpenStreetMap contributors · Terrain: Copernicus GLO-30 © ESA · Hazard reference: UP Project NOAH"),
 "diliman": dict(id="diliman", name="UP Diliman", place="UP Diliman, Quezon City",
   bbox=(121.0560,14.6440,121.0820,14.6700), W=1200, H=1200, GW=200, GH=200,
   dem="sites/diliman/output_hh.tif", dem_kind="dsm", min_filter=3, sigma=1.6, carve=0.5,
   osm="sites/diliman/export.geojson", noah=NOAH,
   sensors=[("BW-D01","Bulwagang Pambarangay ng San Vicente",121.05677,14.65320),
            ("BW-D02","UP Checkpoint- Carabao Horn R",121.06199,14.65465),
            ("BW-D03","Tech Portal",121.05613,14.65749),
            ("BW-D04","Josefa Llanes Escoda Memorial Hall",121.08202,14.65522),
            ("BW-D05","Orosa Hall",121.08144,14.65480),
            ("BW-D06","BPI",121.07400,14.64520),
            ("BW-D07","Parroquia dela Nuestra Señora dela Paz y Buen Viaje de Balara",121.07463,14.66323),
            ("BW-D08","Tierra Bella Multi-Purpose Hall",121.06380,14.66829)],
   site_by="name",
   labels=["University Avenue","Commonwealth Avenue","C.P. Garcia Avenue","Katipunan Avenue","Tandang Sora Avenue","Magsaysay Avenue","Osmeña Avenue","Roxas Avenue"],
   road_class=ROAD_STREET, creek_tags={"river","stream","drain"}, profile="street", langs="all", units="metric",
   scen={"clear":("Dry day",0,0,0),"monsoon":("Habagat rain",0.16,300,180),"typhoon":("Typhoon",0.50,340,150)},
   emergency="911 or your barangay",
   attribution="Map data © OpenStreetMap contributors · Terrain: Copernicus GLO-30 © ESA · Hazard reference: UP Project NOAH"),
 "berkeley": dict(id="berkeley", name="UC Berkeley", place="UC Berkeley, California",
   bbox=(-122.2700,37.8660,-122.2480,37.8790), W=1200, H=880, GW=240, GH=180,
   dem="sites/berkeley/output_USGS1m.tif", dem_kind="dtm", min_filter=None, sigma=0.8, carve=0.25,
   osm="sites/berkeley/export.geojson", noah=None,
   sensors=[("BW-B00","Oxford Hall",-122.26621,37.86985),          # demo unit placeholder: Oxford Hall footbridge
            ("BW-B01","Oxford Hall",-122.26621,37.86985),
            ("BW-B02","Creekside Center",-122.26127,37.87035),
            ("BW-B03","César E. Chavez Student Center",-122.26012,37.86976),
            ("BW-B04","Anthony Hall",-122.25820,37.87068),
            ("BW-B05","Faculty Club",-122.25586,37.87181),
            ("BW-B06","Women's Faculty Club",-122.25491,37.87205),
            ("BW-B07","Chou Hall (North Academic Building)",-122.25437,37.87239),
            ("BW-B08","Stebbins Hall",-122.25932,37.87634)],
   site_by="name",
   labels=["Oxford Street","Bancroft Way","Hearst Avenue","Piedmont Avenue","Gayley Road","University Drive","Strawberry Creek","Strawberry Creek North Fork"],
   road_class=ROAD_PATH, creek_tags={"river","stream"}, profile="path", langs="en", units="imperial",
   scen={"clear":("Dry day",0,0,0),"monsoon":("Winter storm",0.14,300,180),"typhoon":("Atmospheric river",0.40,340,150)},
   emergency="911 or UCPD (510-642-3333)",
   attribution="Map data © OpenStreetMap contributors · Terrain: USGS 3DEP 1 m via OpenTopography"),
}
```
Note the demo unit BW-B00 and BW-B01 share a building until real coordinates arrive; the siting step must allow two units on one building (it already allows two on Maginhawa).

- [ ] **Step 4: Make `build_data.py` read the config**

Replace lines 24–67 (the `INPUT_*`, frame, conditioning, `SENSOR_TARGETS`, `LABEL_STREETS`, `ROAD_CLASS` blocks) with:
```python
from sites import SITES
SITE_ID = os.environ.get("SITE", "tv")
CFG = SITES[SITE_ID]
INPUT_OSM, INPUT_DEM, INPUT_NOAH = CFG["osm"], CFG["dem"], CFG["noah"]
OUTPUT = os.environ.get("OUTPUT", f"data_{SITE_ID}.json")
LON0, LAT0, LON1, LAT1 = CFG["bbox"]
W, H, GW, GH = CFG["W"], CFG["H"], CFG["GW"], CFG["GH"]
DSM_MIN_FILTER, DSM_SMOOTH_SIGMA, STREET_CARVE_M = CFG["min_filter"], CFG["sigma"], CFG["carve"]
SENSOR_TARGETS, LABEL_STREETS, ROAD_CLASS = CFG["sensors"], CFG["labels"], CFG["road_class"]
CREEK_TAGS = CFG["creek_tags"]
```
Then, in the encode block (line ~252), add the site object:
```python
data["site"]={k:CFG[k] for k in ("id","name","place","profile","langs","units","emergency","attribution")}
data["site"]["scen"]={k:{"label":v[0],"P":v[1],"dur":v[2],"start":v[3]} for k,v in CFG["scen"].items()}
data["site"]["hazard"]=CFG["noah"] is not None
```
Guard the minimum filter (line 109): `if DSM_MIN_FILTER: elev=minimum_filter(elev,size=DSM_MIN_FILTER)`. Guard NOAH (line 178): `noah={k:rasterize_noah(v) for k,v in INPUT_NOAH.items()} if INPUT_NOAH else {}`. Use `CREEK_TAGS` at line 127: `p["waterway"] in CREEK_TAGS`.

- [ ] **Step 5: Run the regression test**

Run: `bash test_build.sh && python3 -c "import json;d=json.load(open('/tmp/data_tv_check.json'));assert d['site']['id']=='tv';print('ok   site key present')"`
Expected: both `ok` lines. If `a==b` fails, diff keys: `python3 -c "import json;a=json.load(open('data.json'));b=json.load(open('/tmp/data_tv_check.json'));print([k for k in a if a[k]!=b.get(k)])"` — the only allowed difference is the new `site` key, which the test already pops.

- [ ] **Step 6: Commit**

```bash
SITE=tv python3 build_data.py && mv data_tv.json data.json && cp sites.py build_data.py test_build.sh pkg/
```

---

### Task 2: DEM reprojection, nodata masking, and building the Diliman and Berkeley data files

**Files:**
- Modify: `build_data.py` (lines 97–110: DEM read and resample; sensor siting at lines 199–215)
- Test: `test_build.sh` (extend)

**Interfaces:**
- Consumes: `CFG` from Task 1.
- Produces: `data_diliman.json`, `data_berkeley.json` with the same schema as `data.json` (plus `site`), and `sensors[i].bld` = the building's OSM name (for name-sited units).

- [ ] **Step 1: Extend the build test**

Append to `test_build.sh`:
```bash
for s in diliman berkeley; do
  SITE=$s python3 build_data.py > /tmp/build_$s.log
  python3 - "$s" <<'EOF'
import json,sys,base64,numpy as np
s=sys.argv[1]; d=json.load(open(f"data_{s}.json"))
assert d["site"]["id"]==s
assert len(d["sensors"])==(9 if s=="berkeley" else 8), len(d["sensors"])
e=np.frombuffer(base64.b64decode(d["elev"]),dtype="<i2")/10.0
assert e.size==d["GW"]*d["GH"]
assert (e>0).all(), "nodata leaked into the terrain grid"
if s=="berkeley":
    assert 45<e.min()<60 and 300<e.max()<330, (e.min(),e.max())
    assert not d["site"]["hazard"] and d["noah"]=={}
    assert d["site"]["profile"]=="path" and d["site"]["units"]=="imperial"
    assert any(r.get("n")=="Strawberry Creek" for r in d["waters"]) or any(w["n"]=="Strawberry Creek" for w in d["waters"])
else:
    assert d["site"]["hazard"] and set(d["noah"])=={"5","25","100"}
for u in d["sensors"]:
    assert u["g"]>0 and 0<=u["cx"]<d["GW"] and 0<=u["cy"]<d["GH"]
print(f"ok   {s} data builds: {len(d['sensors'])} units, terrain {e.min():.1f}-{e.max():.1f} m, {len(d['roads'])} ways")
EOF
done
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash test_build.sh`
Expected: `SITE=diliman` fails inside the sensor step (`no addressed building on Bulwagang…`) because siting still requires `addr:street`; Berkeley fails earlier in `dem_at` (UTM bounds vs. degrees).

- [ ] **Step 3: Reproject and mask the DEM**

Replace lines 97–104 (`ds=rasterio.open…` through the end of `dem_at`) with:
```python
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
```
After the resample loop (line ~108) and before the filters, fill holes from neighbours so filters never see NaN, but remember where they were:
```python
hole=np.isnan(elev)
if hole.any():
    from scipy.ndimage import distance_transform_edt
    idx=distance_transform_edt(hole,return_distances=False,return_indices=True)
    elev=elev[tuple(idx)]
    print(f"  filled {int(hole.sum())} nodata cells from nearest neighbours")
```
In the sensor loop, after computing `best`, add: `assert not hole[best[1],best[0]], f"{sid}: sensor cell is a DEM hole"`.

- [ ] **Step 4: Site units by building name or address**

Replace the candidate selection (line ~202, `cands=[b for b in addressed if b["street"]==st]`) with:
```python
if CFG["site_by"]=="address":
    cands=[b for b in addressed if b["street"]==st]
else:
    cands=[b for b in named if b["name"]==st]
```
and collect `named` next to `addressed` in the OSM loop (line ~137):
```python
            if p.get("name"):
                named.append({"x":wx(cx),"y":wy(cy),"lon":cx,"lat":cy,"name":p["name"]})
```
(initialise `named=[]` beside `addressed=[]`). For name-sited units the "street" is the building name, so the 30 m street-distance assertion must instead check the creek: replace `dst=dist_to_street(x,y,st); assert dst<30…` with:
```python
if CFG["site_by"]=="address":
    dst=dist_to_street(x,y,st); assert dst<30, f"{sid}: {dst:.0f} m from {st}"
    near_ref=st
else:
    dst=min((dist_pt_seg(x,y,*w["p"][i],*w["p"][i+1]) for w in waters for i in range(len(w["p"])-1)),default=1e9)
    assert dst<90, f"{sid}: {dst:.0f} m from any creek"
    dn_st,near_ref=nearest_other_street(x,y,"")          # nearest named way = the unit's street
```
and store `"street":near_ref if CFG["site_by"]=="name" else st, "bld":st if CFG["site_by"]=="name" else None` in the sensor record. The street-cell snap (`own` mask) then uses `near_ref` for name-sited units; if no cell of that way is within 10 cells, fall back to any street cell (`street[...]`) — keep the existing ring search but try `own` first, then `street`.

- [ ] **Step 5: Run the build test**

Run: `bash test_build.sh`
Expected: three `ok` lines. Read `/tmp/build_berkeley.log`: every unit line should show a creek distance under 90 m and a plausible street (Oxford Hall → "Oxford Street"; Faculty Club → "Faculty Glade" or similar). If a unit fails the 90 m assertion, move its target coordinate in `sites.py` to the building's centroid printed by the candidate list, not by loosening the assertion.

- [ ] **Step 6: Commit**

```bash
cp build_data.py sites.py test_build.sh data_diliman.json data_berkeley.json pkg/
```

---

### Task 3: Inject all sites and make site state rebuildable (`initSite`)

**Files:**
- Modify: `build_html.py`
- Modify: `template.html` lines 447–522 (site constants), 571–583 (canvases, elevation range), 999–1002 (`SEG_SAMPLES`), 483–488 (`SCEN`)
- Test: `test_public.js`, `test_figure.js`, `test_car.js`, `test_sites.js` (must keep passing unchanged)

**Interfaces:**
- Consumes: `data.json`, `data_diliman.json`, `data_berkeley.json`.
- Produces: page globals `DATA_ALL`, `SITE` (current id), `SITE_CFG` (= `DATA.site`), and `function initSite(id)` that rebuilds `DATA, W, H, GW, GH, N, elev, NOAH, STREETMASK, BLDS, HOUSEHOLD, SCEN, depth, srcIdx, fillGen, fillDist, fq, baseCv, noahCv, floodCv, eMinD, eMaxD, SEG_SAMPLES`. No UI yet; the page still loads `tv`.

- [ ] **Step 1: Write the test**

Create `test_init.js`:
```js
const {chromium}=require('playwright');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/claude/work/bahawatch_dashboard.html');await pg.waitForTimeout(400);
  const r=await pg.evaluate(()=>{
    const before={site:SITE,units:HOUSEHOLD.length,gw:GW,gh:GH,n:N};
    initSite("berkeley");
    const mid={site:SITE,units:HOUSEHOLD.length,gw:GW,gh:GH,n:N,eMin:eMinD,eMax:eMaxD,scen:Object.values(SCEN).map(s=>s.label).join("|"),profile:SITE_CFG.profile,hazard:SITE_CFG.hazard,depthLen:depth.length};
    initSite("tv");
    const after={site:SITE,units:HOUSEHOLD.length,gw:GW,gh:GH,n:N};
    return {before,mid,after,keys:Object.keys(DATA_ALL)};
  });
  assert(r.keys.join()==="tv,diliman,berkeley","three sites embedded");
  assert(r.before.site==="tv"&&r.before.units===8,"boots on Teachers Village with 8 units");
  assert(r.mid.site==="berkeley"&&r.mid.units===9&&r.mid.gw===240&&r.mid.gh===180&&r.mid.n===43200,"initSite(berkeley) swaps grid and units");
  assert(r.mid.depthLen===43200,"model buffers resized to the new grid");
  assert(r.mid.eMin>45&&r.mid.eMax>300,"elevation range is Berkeley's");
  assert(r.mid.scen==="Dry day|Winter storm|Atmospheric river","scenario labels come from the site");
  assert(r.mid.profile==="path"&&r.mid.hazard===false,"site config exposed");
  assert(r.after.site==="tv"&&r.after.units===8&&r.after.n===35400,"initSite(tv) restores");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node test_init.js`
Expected: `ReferenceError: SITE is not defined` (first `evaluate` throws).

- [ ] **Step 3: Inject three data files**

`build_html.py`:
```python
#!/usr/bin/env python3
"""Inject the site data files into template.html → bahawatch_dashboard.html."""
import json, os
tpl=open("template.html",encoding="utf-8").read()
sites={"tv":"data.json","diliman":"data_diliman.json","berkeley":"data_berkeley.json"}
blob="{"+",".join(f'"{k}":{open(f,encoding="utf-8").read()}' for k,f in sites.items())+"}"
assert "__DATA_ALL__" in tpl, "template.html is missing the __DATA_ALL__ placeholder"
out=tpl.replace("__DATA_ALL__",blob)
open("bahawatch_dashboard.html","w",encoding="utf-8").write(out)
print(f"bahawatch_dashboard.html written ({os.path.getsize('bahawatch_dashboard.html')//1024} KB)")
```

- [ ] **Step 4: Turn the site constants into `initSite`**

In `template.html`, replace line 447 `const DATA=__DATA_JSON__;` and lines 450–456, 470–488, 518–522, 571, 582–583, 633, 655, 999–1002 with `let` declarations and one builder. Keep every function body as is; only the declarations move:

```js
const DATA_ALL=__DATA_ALL__;
let SITE="tv", DATA=null, SITE_CFG=null;
let W,H,GW,GH,N, elev,NOAH,STREETMASK,BLDS,HOUSEHOLD,SCEN, depth,srcIdx,fillGen,fillDist,fq, eMinD,eMaxD, SEG_SAMPLES;
let baseCv=document.createElement("canvas"), noahCv=document.createElement("canvas"), floodCv=document.createElement("canvas");
function b64bytes(s){/* unchanged */}
function unrle(s){const b=b64bytes(s);const g=new Uint8Array(N);let o=0;for(let i=0;i<b.length;i+=2){g.fill(b[i+1],o,o+b[i]);o+=b[i];}return g;}
const cellAt=(x,y)=>Math.min(GH-1,Math.max(0,(y/H*GH)|0))*GW+Math.min(GW-1,Math.max(0,(x/W*GW)|0));
function initSite(id){
  SITE=id; DATA=DATA_ALL[id]; SITE_CFG=DATA.site;
  W=DATA.W;H=DATA.H;GW=DATA.GW;GH=DATA.GH;N=GW*GH;
  elev=(()=>{const v=new Int16Array(b64bytes(DATA.elev).buffer);const f=new Float32Array(N);for(let i=0;i<N;i++)f[i]=v[i]/10;return f;})();
  NOAH=SITE_CFG.hazard?{"5":unrle(DATA.noah["5"]),"25":unrle(DATA.noah["25"]),"100":unrle(DATA.noah["100"])}:{"5":new Uint8Array(N),"25":new Uint8Array(N),"100":new Uint8Array(N)};
  STREETMASK=unrle(DATA.street);
  BLDS=(()=>{const v=new Uint16Array(b64bytes(DATA.blds).buffer);const a=[];for(let i=0;i<v.length;i+=2)a.push([v[i]/10,v[i+1]/10]);return a;})();
  // storm-response reference: the site's median sensor street elevation (was the constant 56 m)
  const gs=DATA.sensors.map(s=>s.g).sort((a,b)=>a-b), gRef=gs[Math.floor(gs.length/2)];
  HOUSEHOLD=DATA.sensors.map((s,k)=>{
    const gx=Math.min((s.x/W*GW)|0,GW-1),gy=Math.min((s.y/H*GH)|0,GH-1);
    const h5=noah3x3(NOAH["5"],gx,gy),h25=noah3x3(NOAH["25"],gx,gy),h100=noah3x3(NOAH["100"],gx,gy);
    const lowness=(gRef-s.g)/4, wNoah=h5*0.5+h25*0.3+h100*0.2;
    const sus=Math.min(2.6,Math.max(0.15,0.35+0.5*lowness+0.45*wNoah));
    const r=mulberry32(500+k)();
    return {id:s.id,idx:k,name:"Household unit · "+(s.hn?s.hn+" ":"")+(s.bld||s.street),street:s.street,bld:s.bld||null,
      x:s.x,y:s.y,cx:s.cx,cy:s.cy,lon:s.lon,lat:s.lat,gElev:s.g,gRef,hn:s.hn||"",near:s.near||null,
      labelPos:s.id==="BW-H06"?"above":(s.id==="BW-H01"||s.id==="BW-H02")?"left":"right",
      noahCls:Math.max(h5,h25,h100),sus,expos:0.92+r*0.2,readings:[],depth:0,rate:0,status:"ok"};
  });
  SCEN={};for(const k in SITE_CFG.scen)SCEN[k]={label:SITE_CFG.scen[k].label,P:SITE_CFG.scen[k].P,dur:SITE_CFG.scen[k].dur,start:SITE_CFG.scen[k].start};
  depth=new Float32Array(N);srcIdx=new Int8Array(N);fillGen=new Int32Array(N);fillDist=new Int32Array(N);fq=new Int32Array(N);
  for(const c of[baseCv,noahCv,floodCv]){c.width=Math.round(W*RES);c.height=Math.round(H*RES);}
  eMinD=1e9;eMaxD=-1e9;for(let i=0;i<N;i++){if(elev[i]<eMinD)eMinD=elev[i];if(elev[i]>eMaxD)eMaxD=elev[i];}
  SEG_SAMPLES=[];for(const r of DATA.roads){if(r.c==="alley")continue;for(let k=1;k<r.p.length;k+=2)SEG_SAMPLES.push(r.p[k]);}
}
```
`hhDepth` line 498 becomes `pulse(t,10+(s.gRef-s.gElev)*4)`. `RES` (line 407) must be declared before `initSite` runs — move `const RES=2.2;` up beside `DATA_ALL`. Remove the old `const` declarations the builder now owns (they would throw "already declared"). At boot (line ~1560) call `initSite("tv")` before `setView(VIEW)`.

- [ ] **Step 5: Run all tests**

Run: `python3 build_html.py && node test_init.js && node test_public.js && node test_figure.js && node test_car.js && node test_sites.js`
Expected: every script prints only `ok` lines. `test_sites.js` still targets `tv` (it reads `HOUSEHOLD` at boot).

- [ ] **Step 6: Commit**

```bash
cp template.html build_html.py bahawatch_dashboard.html test_init.js pkg/
```

---

### Task 4: `switchSite` — tear-down and rebuild of the live page

**Files:**
- Modify: `template.html` (`setView`, `selectSensor`, `resetView`/`fitSensors`, `renderBase`, `renderNoah`, `renderFlood`, `buildCards`, the scenario-button handler, `log`, the theme)
- Test: `test_init.js` (extend)

**Interfaces:**
- Consumes: `initSite(id)` from Task 3.
- Produces: `function switchSite(id)` — saves per-site state, clears selection and highlight, rebuilds data and DOM (unit cards, labels, place lines, scenario buttons), re-renders, resets the clock (`tMin=0`, scenario = second key of `SCEN`), fits the sensor cluster, restores that site's `bw-street`/`bw-lang`.

- [ ] **Step 1: Extend the test**

Append before the `errs` assertion in `test_init.js`:
```js
  const sw=await pg.evaluate(()=>{
    selectSensor(HOUSEHOLD[1]);                       // a highlighted street on tv
    switchSite("diliman");
    const a={sel:selected,hl:selectedStreetWays().length,place:document.getElementById("p-place").textContent,
      rows:document.querySelectorAll("#p-all .p-row").length,cards:document.querySelectorAll("#house-cards .house-card").length,
      scen:[...document.querySelectorAll(".scenarios button")].map(b=>b.textContent).join("|"),t:tMin,z:ZOOM.z>1};
    switchSite("berkeley");
    const b2={rows:document.querySelectorAll("#p-all .p-row").length,scen:[...document.querySelectorAll(".scenarios button")].map(b=>b.textContent).join("|"),cap:document.getElementById("p-fig-cap").textContent};
    switchSite("tv");
    return {a,b2,back:HOUSEHOLD.length};
  });
  assert(sw.a.sel===null&&sw.a.hl===0,"switching clears selection and highlight");
  assert(sw.a.place==="UP Diliman, Quezon City"&&sw.a.rows===8&&sw.a.cards===8,"Diliman place line, 8 rows, 8 cards");
  assert(sw.a.scen==="Dry day|Habagat rain|Typhoon"&&sw.a.t===0&&sw.a.z,"clock reset, scenarios relabelled, map fitted");
  assert(sw.b2.rows===9&&sw.b2.scen==="Dry day|Winter storm|Atmospheric river","Berkeley: 9 rows, storm names");
  assert(/Oxford Hall|Creekside|Chavez|Anthony|Faculty|Chou|Stebbins/.test(sw.b2.cap),"Berkeley caption names a campus building: "+sw.b2.cap);
  assert(sw.back===8,"back to Teachers Village");
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 build_html.py && node test_init.js`
Expected: `switchSite is not defined`.

- [ ] **Step 3: Implement `switchSite`**

Add after `setView` in `template.html`:
```js
function siteKey(k){return k+":"+SITE;}
function switchSite(id){
  if(!DATA_ALL[id])id="tv";
  // save per-site state
  try{localStorage.setItem(siteKey("bw-lang"),LANG);}catch(e){}
  selected=null;pickMode=false;
  initSite(id);
  // DOM that was built once at boot
  document.getElementById("house-cards").innerHTML="";buildCards();
  document.getElementById("p-place").textContent=SITE_CFG.place;
  document.querySelector(".brand-sub").textContent=SITE_CFG.place+" · household sensor network on real terrain";
  document.title="BahaWatch — "+SITE_CFG.name+" Flood Monitor";
  const keys=Object.keys(SCEN);
  document.querySelectorAll(".scenarios button").forEach((b,i)=>{b.dataset.sc=keys[i];b.textContent=SCEN[keys[i]].label;b.classList.toggle("active",i===1);b.setAttribute("aria-pressed",i===1?"true":"false");});
  scenario=keys[1];tMin=0;lastEmit=-999;cutSegs=[];noahSel="off";
  document.querySelectorAll(".noah-chips button").forEach(b=>{b.classList.toggle("active",b.dataset.noah==="off");});
  document.querySelector(".map-attr").textContent=SITE_CFG.attribution;document.getElementById("p-attr").textContent=SITE_CFG.attribution;
  // restore per-site state
  myStreet=null;try{myStreet=localStorage.getItem(siteKey("bw-street"));}catch(e){}
  if(myStreet&&!HOUSEHOLD.some(s=>s.id===myStreet))myStreet=null;
  applySiteLang();                                    // Task 6 fills this in; define as a no-op here
  logEl.innerHTML="";log(`Site: <b>${SITE_CFG.name}</b>`);
  renderBase();renderNoah();resize();resetView();
  step(0,true);
  if(VIEW==="public")renderPublic();else refreshCards();
}
function applySiteLang(){}
```
Make `buildCards` a named function (it is an IIFE at line ~692): change `(function buildCards(){` … `})();` to `function buildCards(){` … `}` and call `buildCards();` once after `initSite("tv")` at boot. Give the footer attribution a `id="p-attr"` and the place line `id="p-place"` in the HTML. In `myStreet` and language reads/writes elsewhere (`public_view` code), replace `"bw-street"` with `siteKey("bw-street")` and `"bw-lang"` with `siteKey("bw-lang")`. `fitSensors` already reads `HOUSEHOLD`; `resetView` calls it in public view.

- [ ] **Step 4: Run the tests**

Run: `python3 build_html.py && node test_init.js && node test_public.js && node test_figure.js && node test_car.js`
Expected: all `ok`. If `selectedStreetWays` reports ways after the switch, `selected` was read before `initSite` — the order in `switchSite` is: null the selection, then init.

- [ ] **Step 5: Commit**

```bash
cp template.html bahawatch_dashboard.html test_init.js pkg/
```

---

### Task 5: Tab bar and hash routing

**Files:**
- Modify: `template.html` (HTML: a `<nav class="site-tabs">` under `.p-head` in the public section and under `header` in details; CSS; boot routing)
- Test: `test_tabs.js` (new)

**Interfaces:**
- Consumes: `switchSite(id)`, `setView(v)`.
- Produces: `function routeFromHash()`; `function writeHash()`; tabs with `role="tab"`, `aria-selected`, arrow-key navigation.

- [ ] **Step 1: Write the test**

`test_tabs.js`:
```js
const {chromium}=require('playwright');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const U='file:///home/claude/work/bahawatch_dashboard.html';
  await pg.goto(U+'#berkeley');await pg.waitForTimeout(400);
  let s=await pg.evaluate(()=>({site:SITE,view:VIEW,tab:document.querySelector('.site-tabs [aria-selected="true"]').textContent}));
  assert(s.site==="berkeley"&&s.view==="public"&&s.tab==="UC Berkeley","#berkeley opens Berkeley public view");
  await pg.goto(U+'#diliman/details');await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW}));
  assert(s.site==="diliman"&&s.view==="details","#diliman/details opens Diliman details");
  await pg.goto(U+'#nowhere');await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW,hash:location.hash}));
  assert(s.site==="tv"&&s.view==="public"&&(s.hash===""||s.hash==="#tv"),"unknown hash falls back to Teachers Village: "+s.hash);
  await pg.goto(U+'#berkeley/x');await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW}));
  assert(s.site==="berkeley"&&s.view==="public","malformed view suffix → public view of that site");
  // clicking tabs
  await pg.goto(U);await pg.waitForTimeout(400);
  await pg.click('.site-tabs [data-site="diliman"]');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({site:SITE,hash:location.hash,rows:document.querySelectorAll('#p-all .p-row').length}));
  assert(s.site==="diliman"&&s.hash==="#diliman"&&s.rows===8,"tab click switches site and writes the hash");
  // per-site my-street memory; stale id falls back
  await pg.evaluate(()=>{localStorage.setItem("bw-street:diliman","BW-D04");localStorage.setItem("bw-street:tv","BW-GONE");});
  await pg.click('.site-tabs [data-site="tv"]');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({my:myStreet,btn:document.getElementById("p-my-btn").textContent}));
  assert(s.my===null&&/Choose/.test(s.btn),"stale stored street id → choose again");
  await pg.click('.site-tabs [data-site="diliman"]');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({my:myStreet,cap:document.getElementById("p-fig-cap").textContent}));
  assert(s.my==="BW-D04"&&/Escoda/.test(s.cap),"Diliman remembers its own street: "+s.cap);
  // keyboard
  await pg.focus('.site-tabs [aria-selected="true"]');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>SITE);
  assert(s==="berkeley","ArrowRight moves to the next tab");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node test_tabs.js`
Expected: first assertion fails (`SITE` is `tv`; no `.site-tabs`).

- [ ] **Step 3: Add the tab bar and router**

HTML (twice: right after `.p-head` in `#public`, and right after `</header>` for the details view; the second is hidden by `[data-view="public"] header` rules already):
```html
<nav class="site-tabs" role="tablist" aria-label="Site">
  <button role="tab" data-site="tv" aria-selected="true">Teachers Village</button>
  <button role="tab" data-site="diliman" aria-selected="false">UP Diliman</button>
  <button role="tab" data-site="berkeley" aria-selected="false">UC Berkeley</button>
</nav>
```
CSS:
```css
.site-tabs{display:flex; gap:22px; border-bottom:1px solid var(--line); padding:0}
.site-tabs button{font-size:14px; font-weight:700; color:var(--ink-2); padding:10px 0 9px; border-bottom:3px solid transparent; margin-bottom:-1px; min-height:40px}
.site-tabs button[aria-selected="true"]{color:var(--ink); border-bottom-color:var(--ink)}
.site-tabs button:hover{color:var(--ink)}
[data-view="details"] .site-tabs{padding:0 22px}
@media (max-width:560px){.site-tabs{gap:14px}.site-tabs button{font-size:13px}}
```
JS (before boot):
```js
function parseHash(){
  const m=(location.hash||"").replace(/^#/,"").split("/");
  const site=DATA_ALL[m[0]]?m[0]:"tv", view=m[1]==="details"?"details":"public";
  return {site,view};
}
function writeHash(){history.replaceState(null,"",(SITE==="tv"&&VIEW==="public")?location.pathname+location.search:"#"+SITE+(VIEW==="details"?"/details":""));}
function syncTabs(){document.querySelectorAll('.site-tabs [role="tab"]').forEach(b=>{const on=b.dataset.site===SITE;b.setAttribute("aria-selected",on?"true":"false");b.tabIndex=on?0:-1;});}
document.querySelectorAll('.site-tabs [role="tab"]').forEach(b=>{
  b.addEventListener("click",()=>{if(b.dataset.site!==SITE){switchSite(b.dataset.site);syncTabs();writeHash();}});
  b.addEventListener("keydown",e=>{
    const tabs=[...b.parentElement.querySelectorAll('[role="tab"]')],i=tabs.indexOf(b);
    const j=e.key==="ArrowRight"?(i+1)%tabs.length:e.key==="ArrowLeft"?(i-1+tabs.length)%tabs.length:-1;
    if(j<0)return;e.preventDefault();tabs[j].click();tabs[j].focus();
  });
});
window.addEventListener("hashchange",()=>{const h=parseHash();if(h.site!==SITE){switchSite(h.site);syncTabs();}if(h.view!==VIEW)setView(h.view);});
```
Boot becomes:
```js
const h0=parseHash();
initSite(h0.site);buildCards();VIEW=h0.view;
if(VIEW==="public")speed=720;
setView(VIEW);switchSite(h0.site);syncTabs();writeHash();
```
In `setView`, replace the existing `history.replaceState(...)` line with `writeHash();`.

- [ ] **Step 4: Run the tests**

Run: `python3 build_html.py && node test_tabs.js && node test_init.js && node test_public.js && node test_figure.js && node test_car.js && node test_sites.js`
Expected: all `ok`. If `test_sites.js` now fails, it booted on a non-tv hash from a stale `localStorage` — the script opens the file without a hash, so `SITE` must be `tv`; check `parseHash` isn't reading a stored site.

- [ ] **Step 5: Commit**

```bash
cp template.html bahawatch_dashboard.html test_tabs.js pkg/
```

---

### Task 6: Wording profiles, units, language rules and per-site chrome

**Files:**
- Modify: `template.html` (`LANGS.en` gets a `path` overlay; `T()`; `unitLabel`; `renderFigure` caption; `applySiteLang`; language `<select>` visibility; footer; NOAH chips and "NOAH class" hide when `!SITE_CFG.hazard`; `renderBase` tint)
- Test: `test_tabs.js` (extend)

**Interfaces:**
- Consumes: `SITE_CFG` (`profile`, `langs`, `units`, `emergency`, `attribution`, `hazard`).
- Produces: `PATH_EN` string overlay; `T()` returns the profile-merged table; `fmtDepth(cm)` → `"14 in · 35 cm"` or `"35 cm (14 in)"` by site units.

- [ ] **Step 1: Extend the test**

Append to `test_tabs.js` before the `errs` assertion:
```js
  // wording profile + units + language rules on Berkeley
  await pg.goto(U+'#tv');await pg.waitForTimeout(300);
  await pg.selectOption('#p-lang','fil');await pg.waitForTimeout(100);
  await pg.click('.site-tabs [data-site="berkeley"]');await pg.waitForTimeout(300);
  await pg.evaluate(()=>{playing=false;for(const s of HOUSEHOLD){s.depth=0;s.rate=0;s.status="ok";}HOUSEHOLD[3].depth=0.40;HOUSEHOLD[3].status=statusOf(HOUSEHOLD[3]);computeFlood(0);renderFlood();drawMap();renderPublic();});
  s=await pg.evaluate(()=>({lang:LANG,menu:getComputedStyle(document.getElementById('p-lang')).display,
     head:document.getElementById('p-headline').textContent,row:document.querySelector('#p-all .p-row .r-pass').textContent,
     cap:document.getElementById('p-fig-cap').textContent,foot:document.getElementById('p-emerg').textContent,
     myh:document.getElementById('p-my-h').textContent,noahChips:getComputedStyle(document.querySelector('.noah-chips')).display}));
  assert(s.lang==="en"&&s.menu==="none","Berkeley forces English and hides the language menu");
  assert(/1 path closed/.test(s.head),"path headline: "+s.head);
  assert(/Path closed/.test(s.row),"path row wording: "+s.row);
  assert(/16 in · 40 cm/.test(s.cap)&&/do not drive/.test(s.cap),"imperial-first caption with car verdict: "+s.cap);
  assert(/UCPD/.test(s.foot),"Berkeley emergency line");
  assert(s.myh==="My path","'My path' heading");
  assert(s.noahChips==="none","no hazard chips on a site without a layer");
  await pg.click('.site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({lang:LANG,menu:getComputedStyle(document.getElementById('p-lang')).display}));
  assert(s.lang==="fil"&&s.menu!=="none","Teachers Village restores Filipino and shows the menu");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node test_tabs.js`
Expected: "Berkeley forces English" fails (`LANG` is `fil`).

- [ ] **Step 3: Implement**

Overlay for the `path` profile (add after `LANGS`):
```js
const PATH_EN={
  none:"No flooding reported.",allPass:"All monitored paths open.",
  wet:n=>`Water on ${n} ${n===1?"path":"paths"}.`,wetPass:"All still open.",
  cut1:s=>`${s}: path closed.`,cutN:n=>`${n} paths closed.`,
  my:"My path",choose:"Choose my path",change:"Change",all:"Monitored paths",
  pickHint:"Pick the path you take across campus.",
  pass:["Path open","Path open","Water on the path — walk with care","Path closed","Path closed"],
  lg:["Water on the path","Deeper water","Sensor · no water","Water on path","Path closed"],
  mapHint:"Tap a building on the map or in the list to see where its water reaches.",
  notEmergency:"Not for emergency use. In an emergency call 911 or UCPD (510-642-3333).",
  carPass:["Cars: passable","Cars: passable","Cars: drive slowly","Cars: do not drive through","Cars: do not drive through"],
};
const T=()=>SITE_CFG&&SITE_CFG.profile==="path"?Object.assign({},LANGS.en,PATH_EN):LANGS[LANG];
```
(replace the existing `const T=()=>LANGS[LANG];`). The car caption uses `L.carPass?L.carPass[passIdx(d)]:L.pass[passIdx(d)]`.

Depth formatting — add `function fmtDepth(cm){return SITE_CFG.units==="imperial"?`${inchesOf(cm)} in · ${cm} cm`:`${cm} cm (${inchesOf(cm)} in)`;}` and use it in the caption and the row's `.r-cm` (`fmtDepth(Math.round(s.depth*100))`).

Labels: `unitLabel` and `addr` use `s.bld||shortSt(s.street)` and, for name-sited units, the "near" small text is the street: `near:` becomes `s.bld?shortSt(s.street):s.near`. The station-style map label uses the same `addr(s)`.

Language rules:
```js
function applySiteLang(){
  const sel=document.getElementById("p-lang");
  if(SITE_CFG.langs==="en"){LANG="en";sel.value="en";sel.style.display="none";document.querySelector('label[for=p-lang]').style.display="none";}
  else{sel.style.display="";let saved=null;try{saved=localStorage.getItem(siteKey("bw-lang"));}catch(e){}LANG=saved&&LANGS[saved]?saved:LANG;sel.value=LANG;}
}
```
The `change` handler on `#p-lang` writes `siteKey("bw-lang")`. Per-site chrome: `switchSite` already sets place and attribution; add `document.getElementById("p-emerg")` from `T().notEmergency` (already rendered by `renderPublic`), and hide hazard UI: `document.querySelector(".noah-chips").style.display=SITE_CFG.hazard?"":"none"; document.querySelector(".noah-h").style.display=…; document.getElementById("f-nh").parentElement.style.display=…`. In `renderBase`, the tint uses `eMinD/eMaxD` already (per site) — keep, but clamp the tint range to the 5th–95th percentile of `elev` so Berkeley's hills don't flatten the campus: compute `tLo,tHi` once in `initSite` from a sorted copy.

- [ ] **Step 4: Run all tests**

Run: `python3 build_html.py && node test_tabs.js && node test_init.js && node test_public.js && node test_figure.js && node test_car.js && node test_sites.js`
Expected: all `ok`.

- [ ] **Step 5: Commit**

```bash
cp template.html bahawatch_dashboard.html test_tabs.js pkg/
```

---

### Task 7: Per-site siting test, calibration check, screenshots, README, package, publish

**Files:**
- Modify: `test_sites.js` (loop over sites via hash)
- Modify: `README.md` (§2 inputs per site, §3 pipeline, §6 tabs and profiles, calibration table)
- Test: all scripts; screenshots at 390 and 1280 px for all three sites.

- [ ] **Step 1: Make `test_sites.js` run per site**

Wrap the body in `for(const site of ["tv","diliman","berkeley"])` opening `U+'#'+site`, and for units with `s.bld` check the creek instead of the street:
```js
    return HOUSEHOLD.map(s=>{
      let own=1e9,best=[1e9,null],creek=1e9;
      for(const r of DATA.roads){if(!r.n)continue;for(let i=0;i<r.p.length-1;i++){const d=dseg(s.x,s.y,r.p[i],r.p[i+1]);if(r.n===s.street)own=Math.min(own,d);if(d<best[0])best=[d,r.n];}}
      for(const w of DATA.waters)for(let i=0;i<w.p.length-1;i++)creek=Math.min(creek,dseg(s.x,s.y,w.p[i],w.p[i+1]));
      return {id:s.id,street:s.street,bld:s.bld,hn:s.hn,own:Math.round(own),nearest:best[1],creek:Math.round(creek)};
    });
```
and assert: address-sited → `own<=30 && nearest===street && hn`; name-sited → `creek<=90 && bld`.

- [ ] **Step 2: Calibration check**

Run this probe and record the numbers for the README:
```bash
node - <<'EOF'
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 for(const site of ["tv","diliman","berkeley"]){const pg=await b.newPage();await pg.goto('file:///home/claude/work/bahawatch_dashboard.html#'+site);await pg.waitForTimeout(400);
  const r=await pg.evaluate(()=>{const out={};for(const sc of Object.keys(SCEN).slice(1)){scenario=sc;let tPk=0,best=0;
    for(let t=0;t<=2160;t+=15){const v=Math.max(...HOUSEHOLD.map(s=>hhDepth(s,t)));if(v>best){best=v;tPk=t;}}
    for(const s of HOUSEHOLD)s.depth=hhDepth(s,tPk);computeFlood(tPk);let wet=0;for(let i=0;i<N;i++)if(depth[i]>0.03)wet++;
    out[sc]={peak:HOUSEHOLD.map(s=>Math.round(s.depth*100)),wetPct:+(100*wet/N).toFixed(2)};}return out;});
  console.log(site,JSON.stringify(r));await pg.close();}
 await b.close();})();
EOF
```
Expected: second scenario peaks 20–45 cm at the lowest unit, third 60–90 cm, wet area 0.2–2 %. If a site is far outside, adjust that site's `P` values in `sites.py` (not the formula), rebuild data and HTML, re-run.

- [ ] **Step 3: Screenshots**

Run `node /tmp/claude-0/-home-claude/af909c98-2485-5168-81ec-ddf768cb78e8/scratchpad/shot.js` adapted to open `#tv`, `#diliman`, `#berkeley` at 390 and 1280 px, then Read each PNG. Check: tab bar reads, Berkeley map shows the creek and path network with labeled buildings, Diliman shows creeks and the eight units, no label collisions worse than today's, figure caption fits at 390 px in all three.

- [ ] **Step 4: README**

Add per-site rows to §2 (Overpass boxes: Berkeley `37.8660,-122.2700,37.8790,-122.2480`; Diliman `14.6440,121.0560,14.6700,121.0820`; DEM sources: USGS 3DEP 1 m via OpenTopography `OTNED.012021.4269.3`, Copernicus via `OTSDEM.032021.4326.3`), a §6.x "Sites and tabs" section (hash routing, per-site memory, wording profiles, why Berkeley has no hazard layer, the placeholder demo-unit coordinates), the calibration table from Step 2, and the `sites.py` field list from Task 1.

- [ ] **Step 5: Run everything**

Run: `python3 build_html.py && bash test_build.sh && for f in test_init test_tabs test_sites test_public test_figure test_car; do node $f.js | grep -E "FAIL" && exit 1; done; echo ALL GREEN`
Expected: `ALL GREEN`.

- [ ] **Step 6: Package and publish**

```bash
cp bahawatch_dashboard.html /mnt/user-data/outputs/
rm -rf pkg && mkdir pkg && cp bahawatch_dashboard.html template.html sites.py data.json data_diliman.json data_berkeley.json build_data.py build_html.py logo.png README.md test_*.js test_build.sh pkg/ && (cd pkg && zip -q -r ../bahawatch_dashboard_package.zip .) && cp bahawatch_dashboard_package.zip README.md /mnt/user-data/outputs/
```
Then publish `/mnt/user-data/outputs/bahawatch_dashboard.html` to the existing artifact URL with the Artifact tool, label "Three sites: Teachers Village · UP Diliman · UC Berkeley", and send the package.
