# "Babaha ba?", Neighbour Reports and No Accounts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every place on the BahaWatch page a next-hour answer (Oo / Baka / Hindi, or "Walang bagong datos"), let neighbours report flooding with one tap, and keep everything account-free.

**Architecture:** One pure rule file (`shared/verdict.js`) is inlined into the static page for the simulated demo and imported by a Cloudflare Worker for live use. A pipeline step builds `places.json` (sensor streets and barangays with NOAH flags and connected sensors) that both sides share. The Worker stores reports, readings and answers in D1, recomputes every 5 minutes, and serves one small status file per place.

**Tech Stack:** Vanilla JS in `template.html` (built by `build_html.py`); Node 22 `node:test` for the rule and Worker (Worker tests use a D1 stand-in over `node:sqlite`); Cloudflare Workers + D1 + Turnstile (free tier), deployed with `wrangler`; Python 3 (`pyshp`, `numpy`, `qrcode`, `Pillow`) for the pipeline; Playwright (`/opt/pw-browsers/chromium`, `--no-sandbox`) for page tests.

**Spec:** `docs/superpowers/specs/2026-09-26-babaha-ba-reports-no-accounts-design.md`

## Global Constraints

- Freshness: if the newest input is more than **20 minutes** old the answer is **"nodata"** ("Walang bagong datos"); the page must never show "Hindi" on stale data.
- Rule constants (named, in one place, `RULE` in `shared/verdict.js`): wet **5 cm**, trace **1 cm**, look-ahead **60 min**, reports for Oo **3** distinct phones, report radius **1 km**, dry-sensor radius **500 m**, rain yellow **7.5 mm/h**, orange **15 mm/h**.
- Reports: count for **60 min**; one per place per **10 min** per phone; raw rows deleted after **30 days**, hourly counts kept; Undo window **10 s** on the page (server accepts undo for 15 s); offline hold **≤ 10 min** then dropped; demo reports tagged `demo` and never counted live.
- Location: GPS rounded to **3 decimals (~100 m)** on the phone and again on the server. No names, numbers or exact positions are stored.
- Worker cron **every 5 minutes**; `/status` cached **60 s**; status rows written **only when they change**; one heartbeat row per run. Free tier only ($0).
- Answer shown as word + shape + colour: Oo = filled square, Baka = triangle, Hindi = ring circle, nodata = dashed grey box — the same shapes as the map markers.
- All new UI strings exist in **en, fil, ceb, ilo, hil, pam**; ceb/ilo/hil/pam stay behind the existing `REVIEW_TAG` notice. Berkeley (`langs:"en"`) stays English-only.
- Touch targets ≥ **48 px**; text contrast ≥ **4.5:1** in light and dark themes; the answer is announced through a live region.
- `template.html` is the only page source; the page is rebuilt with `python3 build_html.py`. The existing suites (`bash test_build.sh` 4 ok; `test_init`, `test_tabs`, `test_sites`, `test_public`, `test_figure`, `test_car` — 163 ok) stay green after every task.
- Commits use author "Gregor <gregor500man.gerp@gmail.com>" and end with the two `Co-Authored-By` / `Claude-Session` trailer lines already used in this repo.

## Review Focus

1. **Phone clock is wrong** (common on cheap Android phones). Ages must come from the server's clock (`serverNow` in `/status`), never `Date.now()` on the phone; a phone 3 hours fast must still see "updated 2 min ago". Test in Task 6.
2. **A stored place no longer exists** (places.json rebuilt, barangay renamed). The page must fall back to the "Saan ka?" picker, not throw or show a blank answer. Test in Task 5.
3. **Location denied or times out after the person tapped "Oo"**. The report must still send, pinned to the picked place's centre. Test in Task 6.
4. **Open-Meteo is down for a run**. Sensors and reports must still be evaluated; the answer becomes "nodata" only when every input is older than 20 min; the heartbeat still records the run. Test in Task 4.
5. **Double-tap on a report button** (or the offline queue re-sending). The server's 429 must be shown as "Thanks, recorded", not as an error. Test in Task 6.

## File map

| File | Responsibility | Task |
|---|---|---|
| `shared/package.json`, `shared/verdict.js`, `shared/verdict.test.js` | The rule, pure; its table test | 1 |
| `tools/extract_barangays.py` | Runs on Gregor's PC: barangay polygons for each site → `sites/<id>/barangays.geojson` | 2 |
| `tools/build_places.py`, `tools/test_places.py`, `places.json` | Places with NOAH flags and connected sensors | 2 |
| `worker/package.json`, `worker/wrangler.toml`, `worker/migrations/0001_init.sql` | Worker project and schema | 3 |
| `worker/src/geo.js`, `worker/src/http.js`, `worker/src/api.js`, `worker/src/index.js` | Router, report/undo/ingest/subscribe/status/recent endpoints | 3, 4, 7 |
| `worker/src/rain.js`, `worker/src/cron.js` | Rain adapter, 5-minute recompute | 4 |
| `worker/test/fake-d1.js`, `worker/test/*.test.js` | D1 stand-in and Worker tests | 3, 4 |
| `build_html.py` | Also inlines `verdict.js`, `places.json`, `API_BASE`, `TURNSTILE_SITEKEY`; `OUT` env | 5, 6 |
| `template.html` | Answer band, "Saan ka?" picker, report row, live status, details-view report diamonds and log, share link, offline answer | 5, 6, 7, 8 |
| `test_answer.js`, `test_report.js`, `test_recent.js`, `test_noaccount.js` | Playwright tests | 5, 6, 7, 8 |
| `tools/make_qr.py`, `qr/` | QR code per place | 8 |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` | Add to Home Screen, offline shell | 8 |
| `worker/README.md`, `README.md` | Deploy runbook, docs | 9 |

---

### Task 1: The rule — `shared/verdict.js`

**Files:**
- Create: `shared/package.json`, `shared/verdict.js`
- Test: `shared/verdict.test.js`

**Interfaces:**
- Produces:
  - `RULE` — `{FRESH_MIN:20, WET_CM:5, TRACE_CM:1, LOOKAHEAD_MIN:60, REPORTS_YES:3, REPORT_RADIUS_M:1000, DRY_SENSOR_M:500, RAIN_YELLOW:7.5, RAIN_ORANGE:15}`
  - `babahaBa(x)` where `x = {now:number(ms), place:{noah5:boolean, noah25:boolean, noahMapped:boolean}, sensors:Array<{id:string, name:string, here:boolean, distM:number, travelMin:number|null, depthCm:number, rateCmPerHr:number, at:number}>, reports:{yesPhones:number, newestAt:number|null}, rain:{nowMmH:number, nextMmH:number, at:number}|null}`
  - returns `{answer:'oo'|'baka'|'hindi'|'nodata', reason:{key:string, vars:object}, updatedAt:number|null, etaMin:number|null}`
  - reason keys: `stale, sensor_now, sensor_soon, upstream, reports, reports_vs_dry_sensor, rain_flood_zone, rain_heavy, reports_few, sensor_trace, clear`

- [ ] **Step 1: Write the failing test**

`shared/package.json`:
```json
{ "type": "module", "private": true }
```

`shared/verdict.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { babahaBa, RULE } from './verdict.js';

const NOW = Date.UTC(2026, 8, 26, 9, 0);
const MIN = 60000;
const place = (o = {}) => ({ noah5: false, noah25: false, noahMapped: true, ...o });
const sensor = (o = {}) => ({ id: 'S1', name: 'Maginhawa St', here: true, distM: 0, travelMin: null,
  depthCm: 0, rateCmPerHr: 0, at: NOW - 2 * MIN, ...o });
const rain = (now, next = 0, ageMin = 2) => ({ nowMmH: now, nextMmH: next, at: NOW - ageMin * MIN });
const run = (o) => babahaBa({ now: NOW, place: place(), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(0), ...o });

test('constants match the spec', () => {
  assert.deepEqual(RULE, { FRESH_MIN: 20, WET_CM: 5, TRACE_CM: 1, LOOKAHEAD_MIN: 60, REPORTS_YES: 3,
    REPORT_RADIUS_M: 1000, DRY_SENSOR_M: 500, RAIN_YELLOW: 7.5, RAIN_ORANGE: 15 });
});

test('no inputs at all -> nodata', () => {
  const v = babahaBa({ now: NOW, place: place(), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: null });
  assert.equal(v.answer, 'nodata'); assert.equal(v.reason.key, 'stale'); assert.equal(v.updatedAt, null);
});
test('freshness edge: 21 min old -> nodata, 19 min old -> evaluated', () => {
  assert.equal(run({ rain: rain(0, 0, 21) }).answer, 'nodata');
  assert.equal(run({ rain: rain(0, 0, 19) }).answer, 'hindi');
});
test('updatedAt is the newest input', () => {
  const v = run({ sensors: [sensor({ at: NOW - 7 * MIN })], rain: rain(0, 0, 3) });
  assert.equal(v.updatedAt, NOW - 3 * MIN);
});

test('sensor here 5.0 cm -> oo sensor_now; 4.9 cm steady -> baka sensor_trace', () => {
  const a = run({ sensors: [sensor({ depthCm: 5.0 })] });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'sensor_now'); assert.deepEqual(a.reason.vars, { name: 'Maginhawa St', cm: 5 });
  const b = run({ sensors: [sensor({ depthCm: 4.9 })] });
  assert.equal(b.answer, 'baka'); assert.equal(b.reason.key, 'sensor_trace');
});
test('sensor here rising: reaches 5 cm in exactly 60 min -> oo; in 63 min -> not oo', () => {
  const a = run({ sensors: [sensor({ depthCm: 3, rateCmPerHr: 2 })] });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'sensor_soon'); assert.equal(a.etaMin, 60);
  const b = run({ sensors: [sensor({ depthCm: 3, rateCmPerHr: 1.9 })] });
  assert.equal(b.answer, 'baka'); assert.equal(b.reason.key, 'sensor_trace');
});
test('connected sensor: wet with 40 min travel -> oo upstream; 61 min -> hindi', () => {
  const up = (travelMin) => sensor({ id: 'S2', name: 'Malingap St', here: false, distM: 800, travelMin, depthCm: 12 });
  const a = run({ sensors: [up(40)] });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'upstream'); assert.equal(a.etaMin, 40);
  assert.equal(run({ sensors: [up(61)] }).answer, 'hindi');
});
test('stale sensor (25 min) is ignored when rain is fresh', () => {
  const v = run({ sensors: [sensor({ depthCm: 30, at: NOW - 25 * MIN })] });
  assert.equal(v.answer, 'hindi');
});

test('reports: 3 phones -> oo; 2 phones -> baka reports_few', () => {
  const a = run({ reports: { yesPhones: 3, newestAt: NOW - MIN } });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'reports'); assert.deepEqual(a.reason.vars, { n: 3 });
  const b = run({ reports: { yesPhones: 2, newestAt: NOW - MIN } });
  assert.equal(b.answer, 'baka'); assert.equal(b.reason.key, 'reports_few');
});
test('reports vs dry sensor: dry+steady within 500 m -> baka; at 600 m or rising -> oo', () => {
  const rep = { yesPhones: 3, newestAt: NOW - MIN };
  const dry = (o) => sensor({ id: 'S3', here: false, distM: 400, depthCm: 0, rateCmPerHr: 0, ...o });
  assert.equal(run({ reports: rep, sensors: [dry()] }).reason.key, 'reports_vs_dry_sensor');
  assert.equal(run({ reports: rep, sensors: [dry({ distM: 600 })] }).answer, 'oo');
  assert.equal(run({ reports: rep, sensors: [dry({ rateCmPerHr: 0.5 })] }).answer, 'oo');
});

test('rain: yellow in 5/25-yr zone -> baka; 7.4 -> hindi; yellow in 100-yr-only area -> hindi', () => {
  const zone = place({ noah5: true });
  assert.equal(babahaBa({ now: NOW, place: zone, sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(7.5) }).reason.key, 'rain_flood_zone');
  assert.equal(babahaBa({ now: NOW, place: zone, sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(7.4) }).answer, 'hindi');
  assert.equal(run({ rain: rain(7.5) }).answer, 'hindi');
});
test('rain: next-hour value counts', () => {
  const v = babahaBa({ now: NOW, place: place({ noah25: true }), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(0, 8) });
  assert.equal(v.answer, 'baka'); assert.deepEqual(v.reason.vars, { mm: 8 });
});
test('rain: orange anywhere mapped -> baka rain_heavy; unmapped (Berkeley) -> hindi', () => {
  assert.equal(run({ rain: rain(15) }).reason.key, 'rain_heavy');
  const v = babahaBa({ now: NOW, place: place({ noahMapped: false }), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(40) });
  assert.equal(v.answer, 'hindi');
});
test('stale rain alone does not trigger baka, but a fresh report keeps the answer alive', () => {
  const v = babahaBa({ now: NOW, place: place({ noah5: true }), sensors: [], reports: { yesPhones: 1, newestAt: NOW - MIN }, rain: rain(20, 0, 30) });
  assert.equal(v.answer, 'baka'); assert.equal(v.reason.key, 'reports_few');
});
test('nothing going on -> hindi clear', () => {
  const v = run({ sensors: [sensor()] });
  assert.equal(v.answer, 'hindi'); assert.equal(v.reason.key, 'clear'); assert.equal(v.etaMin, null);
});
test('eta rounds to 5 min, never below 5', () => {
  assert.equal(run({ sensors: [sensor({ depthCm: 4.9, rateCmPerHr: 60 })] }).etaMin, 5);
  assert.equal(run({ sensors: [sensor({ depthCm: 1, rateCmPerHr: 10 })] }).etaMin, 25);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/claude/work && node --test shared/`
Expected: FAIL — `Cannot find module '.../shared/verdict.js'`.

- [ ] **Step 3: Write the implementation**

`shared/verdict.js`:
```js
// The "Babaha ba?" rule (spec §3). Pure: no network, no clock, no DOM.
// Imported by the Cloudflare Worker; inlined into the page by build_html.py (which strips `export `).
export const RULE = {
  FRESH_MIN: 20, WET_CM: 5, TRACE_CM: 1, LOOKAHEAD_MIN: 60, REPORTS_YES: 3,
  REPORT_RADIUS_M: 1000, DRY_SENSOR_M: 500, RAIN_YELLOW: 7.5, RAIN_ORANGE: 15,
};
const VERDICT_MIN_MS = 60000;

function minutesToWet(s) {
  if (s.depthCm >= RULE.WET_CM) return 0;
  if (!(s.rateCmPerHr > 0)) return Infinity;
  return (RULE.WET_CM - s.depthCm) / s.rateCmPerHr * 60;
}
function roundEta(t) { return Math.max(5, Math.round(t / 5) * 5); }

export function babahaBa(x) {
  const now = x.now, place = x.place, sensors = x.sensors || [];
  const reports = x.reports || { yesPhones: 0, newestAt: null }, rain = x.rain || null;
  const fresh = (t) => Number.isFinite(t) && now - t <= RULE.FRESH_MIN * VERDICT_MIN_MS;
  const times = [...sensors.map((s) => s.at), reports.newestAt, rain && rain.at].filter((t) => Number.isFinite(t));
  const updatedAt = times.length ? Math.max(...times) : null;
  const out = (answer, key, vars = {}, etaMin = null) => ({ answer, reason: { key, vars }, updatedAt, etaMin });

  if (updatedAt === null || !fresh(updatedAt)) return out('nodata', 'stale');

  const live = sensors.filter((s) => fresh(s.at));
  const here = live.find((s) => s.here);
  if (here) {
    if (here.depthCm >= RULE.WET_CM) return out('oo', 'sensor_now', { name: here.name, cm: Math.round(here.depthCm) });
    const t = minutesToWet(here);
    if (t <= RULE.LOOKAHEAD_MIN) return out('oo', 'sensor_soon', { name: here.name, min: roundEta(t) }, roundEta(t));
  }
  let best = null;
  for (const s of live) {
    if (s.here || s.travelMin == null) continue;
    const t = minutesToWet(s) + s.travelMin;
    if (t <= RULE.LOOKAHEAD_MIN && (!best || t < best.t)) best = { s, t };
  }
  if (best) return out('oo', 'upstream', { name: best.s.name, min: roundEta(best.t) }, roundEta(best.t));

  const yes = reports.yesPhones || 0;
  if (yes >= RULE.REPORTS_YES) {
    const dry = live.some((s) => s.distM <= RULE.DRY_SENSOR_M && s.depthCm < RULE.TRACE_CM && !(s.rateCmPerHr > 0));
    return dry ? out('baka', 'reports_vs_dry_sensor', { n: yes }) : out('oo', 'reports', { n: yes });
  }

  if (rain && fresh(rain.at)) {
    const mm = Math.max(rain.nowMmH || 0, rain.nextMmH || 0);
    if (mm >= RULE.RAIN_YELLOW && (place.noah5 || place.noah25)) return out('baka', 'rain_flood_zone', { mm: Math.round(mm) });
    if (mm >= RULE.RAIN_ORANGE && place.noahMapped) return out('baka', 'rain_heavy', { mm: Math.round(mm) });
  }
  if (yes >= 1) return out('baka', 'reports_few', { n: yes });
  if (here && here.depthCm >= RULE.TRACE_CM) return out('baka', 'sensor_trace', { name: here.name, cm: Math.round(here.depthCm) });
  return out('hindi', 'clear');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test shared/`
Expected: all 16 tests pass (`# pass 16`, `# fail 0`).

- [ ] **Step 5: Commit**

```bash
git add shared/
git commit -m "Babaha ba? rule as a pure shared module, with table tests"
```

---

### Task 2: Places — barangays and `places.json`

**Files:**
- Create: `tools/extract_barangays.py` (runs on Gregor's PC through the device shell), `tools/build_places.py`, `tools/test_places.py`
- Create (generated, committed): `sites/tv/barangays.geojson`, `sites/diliman/barangays.geojson`, `places.json`

**Interfaces:**
- Consumes: `data.json`, `data_diliman.json`, `data_berkeley.json` (existing: `W,H,GW,GH,bbox,elev,street,noah,sensors,site`), `sites.py` (`SITES[id]["bbox"]`), `RULE.LOOKAHEAD_MIN` value 60.
- Produces: `places.json`:
  ```json
  {"version":1,
   "sensors":{"BW-H01":{"site":"tv","name":"195 Maginhawa St","lat":14.63695,"lon":121.06165}},
   "sites":{"tv":[{"id":"tv:s:BW-H01","kind":"sensor","sensor":"BW-H01","name":"195 Maginhawa St",
                   "lat":14.63695,"lon":121.06165,"noah5":false,"noah25":true,"noahMapped":true,
                   "lowM":-2.3,"connected":[{"sensor":"BW-H02","travelMin":14}]},
                  {"id":"tv:b:PH1380403009","kind":"barangay","name":"Teachers Village East","muni":"Quezon City", "...":"same fields"}]}}
  ```
  Place ids: `<site>:s:<sensorId>` for sensor streets, `<site>:b:<adm4_pcode>` for barangays. `connected` lists other sensors whose water can reach this place within 60 min, with travel time in minutes.

- [ ] **Step 1: Extract barangay polygons on the PC**

`tools/extract_barangays.py`:
```python
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
```

Run on the PC (device shell, connected folder `Nationwide Update`), after copying the script there with `device_commit_files`:
```bash
cd "$HOME/mnt/Nationwide Update" && python3 -m pip install --user -q pyshp && python3 extract_barangays.py phl_admin_boundaries.shp.zip .
```
Expected: `tv N barangays` and `diliman M barangays`, each N, M between 10 and 80.

Bring the two files into the repo with `device_stage_files`, then:
```bash
cp /mnt/user-data/uploads/Nationwide\ Update/barangays_tv.geojson sites/tv/barangays.geojson
cp /mnt/user-data/uploads/Nationwide\ Update/barangays_diliman.geojson sites/diliman/barangays.geojson
```
(`sites/tv/` is new: Teachers Village inputs live in `inputs/`; the directory holds only this file.)

- [ ] **Step 2: Write the failing test**

`tools/test_places.py`:
```python
import json, math, os, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open(os.path.join(ROOT, "places.json"), encoding="utf-8"))
DATA = {"tv": "data.json", "diliman": "data_diliman.json", "berkeley": "data_berkeley.json"}

def hav(a, b, c, d):
    r = math.radians
    x = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))

class Places(unittest.TestCase):
    def test_every_sensor_has_a_sensor_place(self):
        for site, f in DATA.items():
            ids = {s["id"] for s in json.load(open(os.path.join(ROOT, f)))["sensors"]}
            got = {p["sensor"] for p in P["sites"][site] if p["kind"] == "sensor"}
            self.assertEqual(ids, got, site)
    def test_ids_and_fields(self):
        for site, places in P["sites"].items():
            for p in places:
                self.assertRegex(p["id"], rf"^{site}:(s|b):[A-Za-z0-9-]+$")
                for k in ("name", "lat", "lon", "noah5", "noah25", "noahMapped", "lowM", "connected"):
                    self.assertIn(k, p)
                for c in p["connected"]:
                    self.assertIn(c["sensor"], P["sensors"])
                    self.assertTrue(0 <= c["travelMin"] <= 60)
                    if p["kind"] == "sensor":
                        self.assertNotEqual(c["sensor"], p["sensor"])
    def test_barangays_only_in_philippine_sites(self):
        kinds = lambda s: {p["kind"] for p in P["sites"][s]}
        self.assertIn("b", {p["id"].split(":")[1] for p in P["sites"]["tv"]})
        self.assertIn("b", {p["id"].split(":")[1] for p in P["sites"]["diliman"]})
        self.assertEqual(kinds("berkeley"), {"sensor"})
    def test_noah_flags(self):
        self.assertFalse(any(p["noahMapped"] for p in P["sites"]["berkeley"]))
        self.assertTrue(all(p["noahMapped"] for p in P["sites"]["tv"]))
        self.assertTrue(any(p["noah5"] or p["noah25"] for p in P["sites"]["tv"]))
    def test_connectivity_found_somewhere(self):
        self.assertTrue(any(p["connected"] for p in P["sites"]["tv"]))
    def test_sensor_place_sits_on_its_sensor(self):
        for site, places in P["sites"].items():
            for p in places:
                if p["kind"] == "sensor":
                    s = P["sensors"][p["sensor"]]
                    self.assertLess(hav(p["lat"], p["lon"], s["lat"], s["lon"]), 1.0)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `python3 tools/test_places.py`
Expected: FAIL — `FileNotFoundError: ... places.json`.

- [ ] **Step 4: Write the builder**

`tools/build_places.py`:
```python
#!/usr/bin/env python3
"""places.json: every sensor street and barangay the page can answer for, with NOAH flags and
connected sensors (spec §3, §7). Run from the repo root: python3 tools/build_places.py"""
import base64, heapq, json, math, os, statistics
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = {"tv": "data.json", "diliman": "data_diliman.json", "berkeley": "data_berkeley.json"}
FLOW_SPEED_MS = 0.5          # overland flow along streets, m/s (tunable)
LOOKAHEAD_MIN = 60           # RULE.LOOKAHEAD_MIN
SPILL_M = 0.10               # water from a sensor spreads to cells no higher than its ground + 10 cm

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

def reach(elev, start, cell_m):
    """Minutes for water to travel from `start` to every cell it can spill into (≤ LOOKAHEAD_MIN)."""
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
                nd = dd + cell_m * (1.4142 if dy and dx else 1.0)
                if nd <= lim and nd < dist.get((ny, nx), 1e18):
                    dist[(ny, nx)] = nd; heapq.heappush(pq, (nd, (ny, nx)))
    return {k: v / FLOW_SPEED_MS / 60 for k, v in dist.items()}

def build_site(site, d):
    GH, GW = d["GH"], d["GW"]; N = GH * GW
    elev = elev_grid(d); street = unrle(d["street"], N).reshape(GH, GW)
    hazard = bool(d["site"].get("hazard"))
    noah = {k: (unrle(d["noah"][k], N).reshape(GH, GW) if hazard else np.zeros((GH, GW), np.uint8)) for k in ("5", "25")}
    x0, y0, x1, y1 = d["bbox"]
    cell_m = (x1 - x0) * 111320 * math.cos(math.radians((y0 + y1) / 2)) / GW
    gref = statistics.median(s["g"] for s in d["sensors"])
    reaches = {s["id"]: reach(elev, (s["cy"], s["cx"]), cell_m) for s in d["sensors"]}

    def place(pid, kind, name, lat, lon, cells, rep, extra):
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
        out.append(place(f"{site}:s:{s['id']}", "sensor", name, s["lat"], s["lon"], cells, (s["cy"], s["cx"]), {"sensor": s["id"]}))
    gj = os.path.join(ROOT, "sites", site, "barangays.geojson")
    if os.path.exists(gj):
        for f in json.load(open(gj, encoding="utf-8"))["features"]:
            pr = f["properties"]; rings = [r for p in polys(f["geometry"]) for r in p]
            cells = [(cy, cx) for cy in range(GH) for cx in range(GW) if point_in_poly(*cell_center(d, cx, cy), rings)]
            if not cells: continue
            st = [c for c in cells if street[c]] or cells
            rep = min(st, key=lambda c: elev[c])
            out.append(place(f"{site}:b:{pr['pcode']}", "barangay", pr["name"], pr["lat"], pr["lon"], cells, rep, {"muni": pr["muni"]}))
    return out

def main():
    res = {"version": 1, "sensors": {}, "sites": {}}
    for site, f in DATA.items():
        d = json.load(open(os.path.join(ROOT, f), encoding="utf-8"))
        res["sites"][site] = build_site(site, d)
        for s in d["sensors"]:
            name = s.get("bld") or ((s.get("hn") + " " if s.get("hn") else "") + s["street"])
            res["sensors"][s["id"]] = {"site": site, "name": name, "lat": s["lat"], "lon": s["lon"]}
        print(site, len(res["sites"][site]), "places")
    json.dump(res, open(os.path.join(ROOT, "places.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Build and run the tests**

Run: `python3 tools/build_places.py && python3 tools/test_places.py -v`
Expected: three `<site> N places` lines (tv ≥ 18, diliman ≥ 18, berkeley 9), then `OK` for 6 tests.

If `test_sensor_place_sits_on_its_sensor` fails, the sensor place uses the wrong coordinates (it must use the sensor record's `lat`/`lon`). If `test_connectivity_found_somewhere` fails, print `reaches` sizes: a start cell on a local peak reaches nothing, which is expected for some units but not all eight.

- [ ] **Step 6: Commit**

```bash
git add tools/extract_barangays.py tools/build_places.py tools/test_places.py sites/tv/barangays.geojson sites/diliman/barangays.geojson places.json
git commit -m "places.json: sensor streets and barangays with NOAH flags and connected sensors"
```

---

### Task 3: Worker — project, schema, reports

**Files:**
- Create: `worker/package.json`, `worker/wrangler.toml`, `worker/migrations/0001_init.sql`, `worker/src/geo.js`, `worker/src/http.js`, `worker/src/api.js`, `worker/src/index.js`, `worker/test/fake-d1.js`, `worker/test/api.test.js`

**Interfaces:**
- Consumes: `places.json` (Task 2) — imported as JSON.
- Produces:
  - `geo.js`: `round3(x:number):number`, `haversineM(lat1, lon1, lat2, lon2):number`, `placeById(id:string):object|null`
  - `http.js`: `json(body, status=200, env, extraHeaders={})`, `corsHeaders(env)`
  - `api.js`: `handleReport(req, env, now, fetchImpl)`, `handleUndo(req, env, now, id)`, `handleIngest(req, env, now)`, `handleSubscribe(req, env)`, `handleStatus(req, env, now, placeId)` (the last is written in Task 4; Task 3 exports a stub returning 404)
  - `index.js`: `export default { fetch(req, env, ctx), scheduled(event, env, ctx) }` (scheduled wired in Task 4)
  - Report POST body `{place, answer:'oo'|'hindi'|'di_sigurado', lat, lon, device, token, demo}` → `201 {id}` · `400 {error}` · `403 {error:'bot check failed'}` · `429 {error:'already recorded'}`
  - Env: `DB` (D1), `TURNSTILE_SECRET`, `DEVICE_KEYS` (JSON string `{"BW-H01":"key"}`), `ALLOW_ORIGIN`

- [ ] **Step 1: Project files and schema**

`worker/package.json`:
```json
{
  "name": "bahawatch-api",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test --no-warnings test/", "deploy": "wrangler deploy" },
  "devDependencies": { "wrangler": "^4" }
}
```

`worker/wrangler.toml`:
```toml
name = "bahawatch-api"
main = "src/index.js"
compatibility_date = "2026-09-01"

[vars]
ALLOW_ORIGIN = "https://gregor-posadas.github.io"

[[d1_databases]]
binding = "DB"
database_name = "bahawatch"
database_id = "REPLACE_WITH_ID_FROM_wrangler_d1_create"   # Task 9, Step 2 fills this in

[triggers]
crons = ["*/5 * * * *"]
```

`worker/migrations/0001_init.sql`:
```sql
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  place TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  answer TEXT NOT NULL CHECK (answer IN ('oo','hindi','di_sigurado')),
  device TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX reports_at ON reports(at);
CREATE INDEX reports_dev ON reports(device, place, at);
CREATE TABLE readings (sensor TEXT NOT NULL, at INTEGER NOT NULL, depth_cm REAL NOT NULL, PRIMARY KEY (sensor, at));
CREATE TABLE rain (site TEXT PRIMARY KEY, now_mm REAL NOT NULL, next_mm REAL NOT NULL, at INTEGER NOT NULL);
CREATE TABLE status (place TEXT PRIMARY KEY, answer TEXT NOT NULL, reason TEXT NOT NULL, eta_min INTEGER,
  updated_at INTEGER, still_there TEXT, changed_at INTEGER NOT NULL);
CREATE TABLE heartbeat (id INTEGER PRIMARY KEY CHECK (id = 1), ran_at INTEGER NOT NULL, newest_at INTEGER);
CREATE TABLE hourly_counts (place TEXT NOT NULL, hour INTEGER NOT NULL, oo INTEGER NOT NULL, hindi INTEGER NOT NULL,
  unsure INTEGER NOT NULL, PRIMARY KEY (place, hour));
-- Round two (spec §5): anonymous push subscriptions. Created now, not used yet.
CREATE TABLE push_subs (endpoint TEXT PRIMARY KEY, place TEXT NOT NULL, created_at INTEGER NOT NULL);
```

- [ ] **Step 2: The D1 stand-in and the failing test**

`worker/test/fake-d1.js`:
```js
// Minimal D1 API over node:sqlite so Worker code runs unchanged in tests.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; }, _db: db };
}
export function envWith(extra = {}) {
  return { DB: fakeD1(), TURNSTILE_SECRET: 'test-secret', DEVICE_KEYS: JSON.stringify({ 'BW-H01': 'k-h01' }),
    ALLOW_ORIGIN: 'https://gregor-posadas.github.io', ...extra };
}
export const turnstileOK = async () => new Response(JSON.stringify({ success: true }));
export const turnstileFail = async () => new Response(JSON.stringify({ success: false }));
```

`worker/test/api.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleReport, handleUndo } from '../src/api.js';
import { envWith, turnstileOK, turnstileFail } from './fake-d1.js';
import { round3, haversineM } from '../src/geo.js';

const NOW = Date.UTC(2026, 8, 26, 9, 0);
const DEV = 'a1b2c3d4e5f6a7b8c9d0e1f2';
const body = (o = {}) => ({ place: 'tv:s:BW-H01', answer: 'oo', lat: 14.636954, lon: 121.061649, device: DEV, token: 'tok', demo: false, ...o });
const req = (b, method = 'POST', path = '/report') => new Request('https://api.test' + path, { method, headers: { 'content-type': 'application/json', origin: 'https://gregor-posadas.github.io' }, body: b ? JSON.stringify(b) : undefined });

test('geo helpers', () => {
  assert.equal(round3(14.636954), 14.637);
  assert.ok(Math.abs(haversineM(14.6, 121.0, 14.609, 121.0) - 1001) < 5);
});
test('report: stored with rounded position', async () => {
  const env = envWith();
  const r = await handleReport(req(body()), env, NOW, turnstileOK);
  assert.equal(r.status, 201);
  const row = await env.DB.prepare('SELECT * FROM reports').first();
  assert.equal(row.lat, 14.637); assert.equal(row.lon, 121.062); assert.equal(row.answer, 'oo'); assert.equal(row.demo, 0);
});
test('report: validation', async () => {
  const env = envWith();
  assert.equal((await handleReport(req(body({ answer: 'maybe' })), env, NOW, turnstileOK)).status, 400);
  assert.equal((await handleReport(req(body({ place: 'tv:s:NOPE' })), env, NOW, turnstileOK)).status, 400);
  assert.equal((await handleReport(req(body({ device: 'short' })), env, NOW, turnstileOK)).status, 400);
  assert.equal((await handleReport(req(body({ lat: 95 })), env, NOW, turnstileOK)).status, 400);
});
test('report: bot check failure -> 403, nothing stored', async () => {
  const env = envWith();
  assert.equal((await handleReport(req(body()), env, NOW, turnstileFail)).status, 403);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reports').first()).n, 0);
});
test('report: one per place per 10 min per phone', async () => {
  const env = envWith();
  assert.equal((await handleReport(req(body()), env, NOW, turnstileOK)).status, 201);
  assert.equal((await handleReport(req(body({ answer: 'hindi' })), env, NOW + 9 * 60000, turnstileOK)).status, 429);
  assert.equal((await handleReport(req(body({ place: 'tv:s:BW-H02' })), env, NOW + 60000, turnstileOK)).status, 201);
  assert.equal((await handleReport(req(body()), env, NOW + 10 * 60000, turnstileOK)).status, 201);
});
test('report: demo flag stored', async () => {
  const env = envWith();
  await handleReport(req(body({ demo: true })), env, NOW, turnstileOK);
  assert.equal((await env.DB.prepare('SELECT demo FROM reports').first()).demo, 1);
});
test('undo: same phone within 15 s deletes; later or other phone -> 410', async () => {
  const env = envWith();
  const { id } = await (await handleReport(req(body()), env, NOW, turnstileOK)).json();
  assert.equal((await handleUndo(req({ device: 'x'.repeat(24) }, 'POST', `/report/${id}/undo`), env, NOW + 5000, id)).status, 410);
  assert.equal((await handleUndo(req({ device: DEV }, 'POST', `/report/${id}/undo`), env, NOW + 16000, id)).status, 410);
  assert.equal((await handleUndo(req({ device: DEV }, 'POST', `/report/${id}/undo`), env, NOW + 5000, id)).status, 200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reports').first()).n, 0);
});
test('ingest: device key required', async () => {
  const env = envWith();
  const mk = (key, b) => new Request('https://api.test/ingest', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await worker.fetch(mk('wrong', { sensor: 'BW-H01', depthCm: 3 }), env)).status, 401);
  assert.equal((await worker.fetch(mk('k-h01', { sensor: 'BW-H01', depthCm: 3 }), env)).status, 201);
  assert.equal((await env.DB.prepare('SELECT depth_cm FROM readings').first()).depth_cm, 3);
});
test('subscribe: alerts not enabled yet -> 501', async () => {
  const r = await worker.fetch(new Request('https://api.test/subscribe', { method: 'POST', body: '{}' }), envWith());
  assert.equal(r.status, 501);
});
test('CORS preflight and headers', async () => {
  const env = envWith();
  const pre = await worker.fetch(new Request('https://api.test/report', { method: 'OPTIONS', headers: { origin: 'https://gregor-posadas.github.io' } }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://gregor-posadas.github.io');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd worker && npm install && npm test`
Expected: FAIL — `Cannot find module '.../src/index.js'`.

- [ ] **Step 4: Write the implementation**

`worker/src/geo.js`:
```js
import PLACES from '../../places.json' with { type: 'json' };
export { PLACES };
const BY_ID = new Map(Object.values(PLACES.sites).flat().map((p) => [p.id, p]));
export const placeById = (id) => BY_ID.get(id) || null;
export const round3 = (x) => Math.round(x * 1000) / 1000;
export function haversineM(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
```

`worker/src/http.js`:
```js
export function corsHeaders(env) {
  return { 'access-control-allow-origin': env.ALLOW_ORIGIN, 'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization', vary: 'origin' };
}
export function json(body, status = 200, env = {}, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...corsHeaders(env), ...extra } });
}
```

`worker/src/api.js`:
```js
import { json } from './http.js';
import { placeById, round3 } from './geo.js';

const ANSWERS = new Set(['oo', 'hindi', 'di_sigurado']);
const DEVICE_RE = /^[a-f0-9]{24}$/;
const LIMIT_MS = 10 * 60000, UNDO_MS = 15000;

async function turnstileOk(env, token, fetchImpl) {
  const form = new FormData(); form.append('secret', env.TURNSTILE_SECRET); form.append('response', token || '');
  try {
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    return (await r.json()).success === true;
  } catch { return false; }
}

export async function handleReport(req, env, now, fetchImpl = fetch) {
  let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, env); }
  const place = placeById(b.place);
  if (!place || !ANSWERS.has(b.answer) || !DEVICE_RE.test(b.device || '')
      || !Number.isFinite(b.lat) || !Number.isFinite(b.lon) || Math.abs(b.lat) > 90 || Math.abs(b.lon) > 180)
    return json({ error: 'invalid report' }, 400, env);
  if (!(await turnstileOk(env, b.token, fetchImpl))) return json({ error: 'bot check failed' }, 403, env);
  const dup = await env.DB.prepare('SELECT 1 FROM reports WHERE device=? AND place=? AND at>?').bind(b.device, b.place, now - LIMIT_MS).first();
  if (dup) return json({ error: 'already recorded' }, 429, env);
  const r = await env.DB.prepare('INSERT INTO reports(at,place,lat,lon,answer,device,demo) VALUES(?,?,?,?,?,?,?)')
    .bind(now, b.place, round3(b.lat), round3(b.lon), b.answer, b.device, b.demo ? 1 : 0).run();
  return json({ id: r.meta.last_row_id }, 201, env);
}

export async function handleUndo(req, env, now, id) {
  let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, env); }
  const r = await env.DB.prepare('DELETE FROM reports WHERE id=? AND device=? AND at>=?').bind(Number(id), String(b.device || ''), now - UNDO_MS).run();
  return r.meta.changes ? json({ ok: true }, 200, env) : json({ error: 'too late' }, 410, env);
}

export async function handleIngest(req, env, now) {
  let keys = {}; try { keys = JSON.parse(env.DEVICE_KEYS || '{}'); } catch {}
  let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, env); }
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!b.sensor || !keys[b.sensor] || keys[b.sensor] !== auth) return json({ error: 'unauthorized' }, 401, env);
  const at = Number.isFinite(b.at) ? b.at : now;
  if (at > now + 5 * 60000 || !Number.isFinite(b.depthCm) || b.depthCm < 0 || b.depthCm > 500) return json({ error: 'invalid reading' }, 400, env);
  await env.DB.prepare('INSERT OR REPLACE INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind(b.sensor, at, b.depthCm).run();
  return json({ ok: true }, 201, env);
}

export async function handleSubscribe(req, env) {
  return json({ error: 'alerts not enabled yet' }, 501, env);
}

export async function handleStatus(req, env, now, placeId) {
  return json({ error: 'not implemented' }, 404, env);   // Task 4
}
```

`worker/src/index.js`:
```js
import { corsHeaders, json } from './http.js';
import { handleReport, handleUndo, handleIngest, handleSubscribe, handleStatus } from './api.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url), now = Date.now();
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
    if (req.method === 'POST' && url.pathname === '/report') return handleReport(req, env, now);
    const undo = url.pathname.match(/^\/report\/(\d+)\/undo$/);
    if (req.method === 'POST' && undo) return handleUndo(req, env, now, undo[1]);
    if (req.method === 'POST' && url.pathname === '/ingest') return handleIngest(req, env, now);
    if (req.method === 'POST' && url.pathname === '/subscribe') return handleSubscribe(req, env);
    const st = url.pathname.match(/^\/status\/(.+)$/);
    if (req.method === 'GET' && st) return handleStatus(req, env, now, decodeURIComponent(st[1]));
    return json({ error: 'not found' }, 404, env);
  },
  async scheduled() { /* Task 4 */ },
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd worker && npm test`
Expected: 10 tests pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add worker/package.json worker/package-lock.json worker/wrangler.toml worker/migrations worker/src worker/test
printf 'node_modules/\n.wrangler/\n' > worker/.gitignore && git add worker/.gitignore
git commit -m "Worker: schema, report/undo/ingest endpoints, D1 stand-in tests"
```

---

### Task 4: Worker — rain, 5-minute recompute, `/status`

**Files:**
- Create: `worker/src/rain.js`, `worker/src/cron.js`, `worker/test/rain.test.js`, `worker/test/cron.test.js`
- Modify: `worker/src/api.js` (replace the `handleStatus` stub), `worker/src/index.js` (wire `scheduled`)

**Interfaces:**
- Consumes: `babahaBa`, `RULE` from `../../shared/verdict.js`; `PLACES`, `haversineM` from `geo.js`; tables from Task 3.
- Produces:
  - `rain.js`: `fetchRain(points:Array<{key, lat, lon}>, fetchImpl, now) → Promise<Map<key,{nowMmH, nextMmH, at}>>` (empty Map on failure)
  - `cron.js`: `runCron(env, now, fetchImpl)` → `{places:number, changed:number}`
  - `GET /status/<place>` → `200 {place, answer, reason:{key,vars}, etaMin, updatedAt, checkedAt, serverNow, stillThere:{ageMin, distM}|null}` with `cache-control: public, max-age=60`; unknown place → 404.

- [ ] **Step 1: Write the failing tests**

`worker/test/rain.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRain } from '../src/rain.js';

const NOW = Date.UTC(2026, 8, 26, 9, 20);
const loc = (p) => ({ hourly: { time: ['2026-09-26T08:00', '2026-09-26T09:00', '2026-09-26T10:00', '2026-09-26T11:00'], precipitation: p } });

test('two locations: now = max(hour ending before, current hour), next = following hour', async () => {
  let url = '';
  const f = async (u) => { url = u; return new Response(JSON.stringify([loc([1, 3, 9, 20]), loc([0, 0, 0, 0])])); };
  const m = await fetchRain([{ key: 'tv', lat: 14.64, lon: 121.06 }, { key: 'diliman', lat: 14.657, lon: 121.069 }], f, NOW);
  assert.match(url, /latitude=14\.64,14\.657/);
  assert.deepEqual(m.get('tv'), { nowMmH: 9, nextMmH: 20, at: NOW });
  assert.deepEqual(m.get('diliman'), { nowMmH: 0, nextMmH: 0, at: NOW });
});
test('one location: Open-Meteo returns an object, not an array', async () => {
  const f = async () => new Response(JSON.stringify(loc([0, 2, 4, 6])));
  const m = await fetchRain([{ key: 'tv', lat: 14.64, lon: 121.06 }], f, NOW);
  assert.equal(m.get('tv').nowMmH, 4);
});
test('network failure -> empty map, no throw', async () => {
  const m = await fetchRain([{ key: 'tv', lat: 14.64, lon: 121.06 }], async () => { throw new Error('down'); }, NOW);
  assert.equal(m.size, 0);
});
```

`worker/test/cron.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { runCron } from '../src/cron.js';
import { handleStatus } from '../src/api.js';
import { envWith } from './fake-d1.js';
import { PLACES } from '../src/geo.js';

const NOW = Date.UTC(2026, 8, 26, 9, 5);
const P = PLACES.sites.tv.find((p) => p.kind === 'sensor' && p.sensor === 'BW-H01');
const rainOK = (mm = 0) => async () => new Response(JSON.stringify(
  Object.keys(PLACES.sites).map(() => ({ hourly: { time: ['2026-09-26T08:00', '2026-09-26T09:00', '2026-09-26T10:00', '2026-09-26T11:00'], precipitation: [mm, mm, mm, mm] } }))));
const rainDown = async () => { throw new Error('down'); };
const addReport = (env, o) => env.DB.prepare('INSERT INTO reports(at,place,lat,lon,answer,device,demo) VALUES(?,?,?,?,?,?,?)')
  .bind(o.at ?? NOW - 60000, o.place ?? P.id, o.lat ?? P.lat, o.lon ?? P.lon, o.answer ?? 'oo', o.device, o.demo ?? 0).run();
const status = async (env, now = NOW) => (await handleStatus(new Request('https://api.test/status/x'), env, now, P.id)).json();

test('3 phones say oo within 1 km -> oo; demo reports and repeats from one phone do not count', async () => {
  const env = envWith();
  await addReport(env, { device: 'a'.repeat(24) }); await addReport(env, { device: 'a'.repeat(24), at: NOW - 30000 });
  await addReport(env, { device: 'b'.repeat(24) }); await addReport(env, { device: 'c'.repeat(24), demo: 1 });
  await runCron(env, NOW, rainOK());
  assert.equal((await status(env)).answer, 'baka');          // 2 real phones
  await addReport(env, { device: 'd'.repeat(24) });
  await runCron(env, NOW + 300000, rainOK());
  const s = await status(env, NOW + 300000);
  assert.equal(s.answer, 'oo'); assert.deepEqual(s.reason, { key: 'reports', vars: { n: 3 } });
});
test("a phone's latest report wins: 'hindi' to Still there? stops it counting", async () => {
  const env = envWith();
  for (const d of ['a', 'b', 'c']) await addReport(env, { device: d.repeat(24), at: NOW - 600000 });
  await addReport(env, { device: 'c'.repeat(24), answer: 'hindi', at: NOW - 60000 });
  await runCron(env, NOW, rainOK());
  assert.equal((await status(env)).answer, 'baka');
});
test('reports farther than 1 km or older than 60 min are ignored', async () => {
  const env = envWith();
  for (const d of ['a', 'b']) await addReport(env, { device: d.repeat(24) });
  await addReport(env, { device: 'c'.repeat(24), lat: P.lat + 0.02 });
  await addReport(env, { device: 'e'.repeat(24), at: NOW - 61 * 60000 });
  await runCron(env, NOW, rainOK());
  assert.equal((await status(env)).reason.key, 'reports_few');
});
test('status is written only when it changes; heartbeat every run', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  const a = await env.DB.prepare('SELECT changed_at FROM status WHERE place=?').bind(P.id).first();
  await runCron(env, NOW + 300000, rainOK());
  const b = await env.DB.prepare('SELECT changed_at FROM status WHERE place=?').bind(P.id).first();
  assert.equal(a.changed_at, b.changed_at);
  const hb = await env.DB.prepare('SELECT ran_at FROM heartbeat').first();
  assert.equal(hb.ran_at, NOW + 300000);
});
test('Open-Meteo down: last stored rain kept; answer turns nodata only after 20 min with no fresh input', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  await runCron(env, NOW + 10 * 60000, rainDown);
  assert.equal((await status(env, NOW + 10 * 60000)).answer, 'hindi');
  await runCron(env, NOW + 25 * 60000, rainDown);
  assert.equal((await status(env, NOW + 25 * 60000)).answer, 'nodata');
  assert.equal((await env.DB.prepare('SELECT ran_at FROM heartbeat').first()).ran_at, NOW + 25 * 60000);
});
test('a fresh report keeps a place evaluated while rain is down', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  await addReport(env, { device: 'a'.repeat(24), at: NOW + 24 * 60000 });
  await runCron(env, NOW + 25 * 60000, rainDown);
  assert.equal((await status(env, NOW + 25 * 60000)).reason.key, 'reports_few');
});
test('ingested sensor reading drives the answer', async () => {
  const env = envWith();
  await env.DB.prepare('INSERT INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind('BW-H01', NOW - 60000, 12).run();
  await runCron(env, NOW, rainOK());
  const s = await status(env);
  assert.equal(s.answer, 'oo'); assert.equal(s.reason.key, 'sensor_now');
});
test('stillThere: latest oo report within 300 m and 30 min', async () => {
  const env = envWith();
  await addReport(env, { device: 'a'.repeat(24), at: NOW - 12 * 60000, lat: P.lat + 0.001 });
  await runCron(env, NOW, rainOK());
  const s = await status(env);
  assert.equal(s.stillThere.ageMin, 12); assert.ok(s.stillThere.distM > 50 && s.stillThere.distM < 300);
});
test('status carries serverNow and checkedAt; unknown place 404; cache header', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  const r = await handleStatus(new Request('https://api.test/status/x'), env, NOW + 1000, P.id);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=60');
  const s = await r.json();
  assert.equal(s.serverNow, NOW + 1000); assert.equal(s.checkedAt, NOW);
  assert.equal((await handleStatus(new Request('https://api.test/status/x'), env, NOW, 'tv:s:NOPE')).status, 404);
});
test('on the hour: hourly counts rolled up, reports older than 30 days deleted', async () => {
  const env = envWith();
  const HOUR = Date.UTC(2026, 8, 26, 10, 0);
  await addReport(env, { device: 'a'.repeat(24), at: HOUR - 20 * 60000 });
  await addReport(env, { device: 'b'.repeat(24), at: HOUR - 31 * 24 * 3600000 });
  await runCron(env, HOUR, rainOK());
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reports').first()).n, 1);
  const hc = await env.DB.prepare('SELECT * FROM hourly_counts WHERE place=?').bind(P.id).first();
  assert.equal(hc.oo, 1);
});
test('scheduled handler runs the cron', async () => {
  const env = envWith();
  let ran = false;
  await worker.scheduled({ scheduledTime: NOW }, env, { waitUntil: (p) => { ran = true; return p; } });
  assert.ok(ran);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd worker && npm test`
Expected: FAIL — `Cannot find module '.../src/rain.js'`.

- [ ] **Step 3: Write the rain adapter**

`worker/src/rain.js`:
```js
// Rain now / next hour per point (spec §7 "rain adapter"). Open-Meteo hourly `precipitation` at time T is the
// sum over (T-1h, T]. "now" = max(hour ending before now, hour in progress); "next" = the hour after that.
export async function fetchRain(points, fetchImpl = fetch, now = Date.now()) {
  const out = new Map();
  if (!points.length) return out;
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + points.map((p) => p.lat).join(',')
    + '&longitude=' + points.map((p) => p.lon).join(',') + '&hourly=precipitation&past_hours=2&forecast_hours=3&timezone=GMT';
  try {
    const r = await fetchImpl(u);
    if (!r.ok) return out;
    let data = await r.json();
    if (!Array.isArray(data)) data = [data];
    data.forEach((d, i) => {
      const t = d.hourly.time.map((s) => Date.parse(s + ':00Z')), p = d.hourly.precipitation;
      let k = t.findIndex((x) => x > now);
      if (k < 1) return;
      out.set(points[i].key, { nowMmH: Math.max(p[k - 1] ?? 0, p[k] ?? 0), nextMmH: p[k + 1] ?? 0, at: now });
    });
  } catch { /* leave empty: caller keeps last stored rain */ }
  return out;
}
```

- [ ] **Step 4: Write the cron and status**

`worker/src/cron.js`:
```js
import { babahaBa, RULE } from '../../shared/verdict.js';
import { PLACES, haversineM } from './geo.js';
import { fetchRain } from './rain.js';

const MIN = 60000;
const siteCentre = (site) => {
  const ps = PLACES.sites[site];
  return { key: site, lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lon: ps.reduce((a, p) => a + p.lon, 0) / ps.length };
};

export async function runCron(env, now, fetchImpl = fetch) {
  const DB = env.DB;
  // 1. rain: refresh what we can, keep the rest
  const fresh = await fetchRain(Object.keys(PLACES.sites).map(siteCentre), fetchImpl, now);
  for (const [site, r] of fresh) {
    await DB.prepare('INSERT OR REPLACE INTO rain(site,now_mm,next_mm,at) VALUES(?,?,?,?)').bind(site, r.nowMmH, r.nextMmH, r.at).run();
  }
  const rainRows = new Map((await DB.prepare('SELECT * FROM rain').all()).results.map((r) => [r.site, { nowMmH: r.now_mm, nextMmH: r.next_mm, at: r.at }]));

  // 2. sensors: latest reading and rate from a reading 10-40 min earlier
  const rd = (await DB.prepare('SELECT sensor, at, depth_cm FROM readings WHERE at > ? ORDER BY at DESC').bind(now - 60 * MIN).all()).results;
  const latest = new Map();
  for (const r of rd) {
    const l = latest.get(r.sensor);
    if (!l) latest.set(r.sensor, { at: r.at, depthCm: r.depth_cm, rateCmPerHr: 0 });
    else if (!l.prev && l.at - r.at >= 10 * MIN && l.at - r.at <= 40 * MIN) {
      l.prev = true; l.rateCmPerHr = (l.depthCm - r.depth_cm) / ((l.at - r.at) / 3600000);
    }
  }

  // 3. reports: last 60 min, not demo; each phone counts by its latest report per place-area
  const reps = (await DB.prepare('SELECT at, place, lat, lon, answer, device FROM reports WHERE demo=0 AND at > ? ORDER BY at DESC').bind(now - 60 * MIN).all()).results;

  let changed = 0, newest = null, count = 0;
  for (const [site, places] of Object.entries(PLACES.sites)) {
    for (const p of places) {
      count++;
      const conn = new Map(p.connected.map((c) => [c.sensor, c.travelMin]));
      const sensors = [];
      for (const [id, l] of latest) {
        const s = PLACES.sensors[id]; if (!s) continue;
        const distM = haversineM(p.lat, p.lon, s.lat, s.lon);
        const here = p.kind === 'sensor' && p.sensor === id;
        if (!here && !conn.has(id) && distM > RULE.REPORT_RADIUS_M) continue;
        sensors.push({ id, name: s.name, here, distM, travelMin: conn.has(id) ? conn.get(id) : null, depthCm: l.depthCm, rateCmPerHr: l.rateCmPerHr, at: l.at });
      }
      const seen = new Set(); let yesPhones = 0, newestAt = null, still = null;
      for (const r of reps) {
        const d = haversineM(p.lat, p.lon, r.lat, r.lon);
        if (d > RULE.REPORT_RADIUS_M) continue;
        if (r.answer === 'oo' && !still && d <= 300 && now - r.at <= 30 * MIN) still = { ageMin: Math.round((now - r.at) / MIN), distM: Math.round(d) };
        if (seen.has(r.device)) continue;
        seen.add(r.device);
        if (r.answer === 'oo') { yesPhones++; newestAt = Math.max(newestAt ?? 0, r.at); }
      }
      const v = babahaBa({ now, place: p, sensors, reports: { yesPhones, newestAt }, rain: rainRows.get(site) || null });
      if (v.updatedAt) newest = Math.max(newest ?? 0, v.updatedAt);
      const reason = JSON.stringify(v.reason), stillJ = still ? JSON.stringify(still) : null;
      const old = await DB.prepare('SELECT answer, reason, eta_min, still_there FROM status WHERE place=?').bind(p.id).first();
      if (!old || old.answer !== v.answer || old.reason !== reason || old.eta_min !== v.etaMin || old.still_there !== stillJ) {
        await DB.prepare('INSERT OR REPLACE INTO status(place,answer,reason,eta_min,updated_at,still_there,changed_at) VALUES(?,?,?,?,?,?,?)')
          .bind(p.id, v.answer, reason, v.etaMin, v.updatedAt, stillJ, now).run();
        changed++;
      }
    }
  }
  await DB.prepare('INSERT OR REPLACE INTO heartbeat(id, ran_at, newest_at) VALUES(1,?,?)').bind(now, newest).run();

  // 4. on the hour: roll up the previous hour, apply retention
  if (new Date(now).getUTCMinutes() < 5) {
    const h1 = now - (now % 3600000), h0 = h1 - 3600000;
    const rows = (await DB.prepare("SELECT place, SUM(answer='oo') AS oo, SUM(answer='hindi') AS hindi, SUM(answer='di_sigurado') AS unsure FROM reports WHERE demo=0 AND at>=? AND at<? GROUP BY place").bind(h0, h1).all()).results;
    for (const r of rows) await DB.prepare('INSERT OR REPLACE INTO hourly_counts(place,hour,oo,hindi,unsure) VALUES(?,?,?,?,?)').bind(r.place, h0, r.oo, r.hindi, r.unsure).run();
    await DB.prepare('DELETE FROM reports WHERE at < ?').bind(now - 30 * 24 * 3600000).run();
    await DB.prepare('DELETE FROM readings WHERE at < ?').bind(now - 30 * 24 * 3600000).run();
  }
  return { places: count, changed };
}
```

In `worker/src/api.js`, replace the `handleStatus` stub with:
```js
export async function handleStatus(req, env, now, placeId) {
  if (!placeById(placeId)) return json({ error: 'unknown place' }, 404, env);
  const s = await env.DB.prepare('SELECT * FROM status WHERE place=?').bind(placeId).first();
  const hb = await env.DB.prepare('SELECT ran_at, newest_at FROM heartbeat WHERE id=1').first();
  const body = s
    ? { place: placeId, answer: s.answer, reason: JSON.parse(s.reason), etaMin: s.eta_min, updatedAt: hb?.newest_at ?? s.updated_at,
        checkedAt: hb?.ran_at ?? null, serverNow: now, stillThere: s.still_there ? JSON.parse(s.still_there) : null }
    : { place: placeId, answer: 'nodata', reason: { key: 'stale', vars: {} }, etaMin: null, updatedAt: null, checkedAt: hb?.ran_at ?? null, serverNow: now, stillThere: null };
  return json(body, 200, env, { 'cache-control': 'public, max-age=60' });
}
```

In `worker/src/index.js`, add `import { runCron } from './cron.js';` and replace the `scheduled` line with:
```js
  async scheduled(event, env, ctx) { ctx.waitUntil(runCron(env, event.scheduledTime ?? Date.now())); },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd worker && npm test`
Expected: 24 tests pass (10 from Task 3, 3 rain, 11 cron), 0 fail.

- [ ] **Step 6: Commit**

```bash
git add worker/src worker/test
git commit -m "Worker: Open-Meteo rain adapter, 5-minute recompute with write-on-change, /status"
```

---

### Task 5: Page — answer band, "Saan ka?", demo verdict, six languages

**Files:**
- Modify: `build_html.py`, `template.html`
- Test: `test_answer.js` (new)

**Interfaces:**
- Consumes: `shared/verdict.js` (inlined, `export ` stripped), `places.json` (inlined as `PLACES`), existing page globals `SITE, SITE_CFG, HOUSEHOLD, SCEN, scenario, tMin, BASE, pulse, LANG, T(), REVIEW_TAG, myStreet, siteKey, $, esc, renderPublic, switchSite`.
- Produces (page globals later tasks use): `PLACES`, `myPlace` (place id or null), `currentPlace()`, `placesForSite()`, `demoInputs(place)`, `showAnswer(v, serverNow)`, `setPlace(id)`, `A()` (answer strings for the current language), `DEMO_RAIN_MMH_PER_P = 60`.

- [ ] **Step 1: Write the failing test**

`test_answer.js`:
```js
const {chromium}=require('playwright');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U='file:///home/claude/work/bahawatch_dashboard.html';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForTimeout(400);
  // first visit: "Saan ka?" shows with four choices
  let s=await pg.evaluate(()=>({open:!document.getElementById('p-where').hidden,btns:[...document.querySelectorAll('#p-where button')].map(b=>b.dataset.act)}));
  assert(s.open&&s.btns.join()==="loc,brgy,sensor,skip","first visit opens Saan ka? with four choices: "+s.btns);
  await pg.click('#p-where [data-act="skip"]');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({open:!document.getElementById('p-where').hidden,top:document.getElementById('p-top-area').contains(document.getElementById('p-area')),pick:!document.getElementById('p-ans-pick').hidden}));
  assert(!s.open&&s.top&&s.pick,"skip: area status on top and a Pick your place button");
  // places are embedded
  s=await pg.evaluate(()=>({n:PLACES.sites.tv.length,b:PLACES.sites.tv.some(p=>p.kind==="barangay"),berk:PLACES.sites.berkeley.every(p=>p.kind==="sensor")}));
  assert(s.n>=18&&s.b&&s.berk,"places.json embedded with barangays for Philippine sites only");
  // pick a sensor street, storm peak -> Oo with square shape, reason names the street
  await pg.evaluate(()=>{setPlace("tv:s:BW-H07");playing=false;scenario="typhoon";tMin=495;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>({ans:document.getElementById('p-answer').dataset.answer,word:document.getElementById('p-ans-word').textContent,shape:getComputedStyle(document.getElementById('p-ans-shape')).borderRadius,reason:document.getElementById('p-ans-reason').textContent,live:document.querySelector('#p-answer [role=status]').getAttribute('aria-live'),bottom:document.getElementById('p-bottom-area').contains(document.getElementById('p-area'))}));
  assert(s.ans==="oo"&&s.shape==="3px"&&/Mayaman/.test(s.reason),"storm peak on Mayaman: Oo, square shape, reason naming the street: "+s.reason);
  assert(s.live==="polite","answer announced through a polite live region");
  assert(s.bottom,"with a place chosen, the area headline moves under the list");
  // dry day -> Hindi
  await pg.evaluate(()=>{scenario="clear";tMin=100;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>document.getElementById('p-answer').dataset.answer);
  assert(s==="hindi","dry day: Hindi");
  // nodata rendering is grey and dashed, never Hindi
  s=await pg.evaluate(()=>{showAnswer({answer:"nodata",reason:{key:"stale",vars:{}},updatedAt:null,etaMin:null});const e=document.getElementById('p-answer');return {a:e.dataset.answer,bs:getComputedStyle(e).borderStyle,w:document.getElementById('p-ans-word').textContent};});
  assert(s.a==="nodata"&&/dashed/.test(s.bs)&&!/Hindi|^No$/.test(s.w),"nodata: dashed grey box, not Hindi: "+s.w);
  // Filipino words
  await pg.selectOption('#p-lang','fil');await pg.evaluate(()=>{scenario="typhoon";tMin=495;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>({q:document.getElementById('p-ans-q').textContent,w:document.getElementById('p-ans-word').textContent}));
  assert(/Babaha ba\?/.test(s.q)&&s.w==="Oo","Filipino: Babaha ba? · Oo");
  // every language has every string
  s=await pg.evaluate(()=>{const need=["q","pick","pickBtn","whereQ","useLoc","pickBrgy","pickSensor","skip","age","justNow","locFail"];const miss=[];for(const k of Object.keys(ANS_LANGS)){const L=ANS_LANGS[k];for(const n of need)if(!L[n])miss.push(k+"."+n);for(const w of ["oo","baka","hindi","nodata"]){if(!L.word[w])miss.push(k+".word."+w);if(!L.gloss[w])miss.push(k+".gloss."+w);}for(const r of ["stale","sensor_now","sensor_soon","upstream","reports","reports_vs_dry_sensor","rain_flood_zone","rain_heavy","reports_few","sensor_trace","clear"])if(!L.reason[r])miss.push(k+".reason."+r);}return miss;});
  assert(s.length===0,"all six languages complete: "+s.join(","));
  // barangay pick
  await pg.evaluate(()=>{const b=PLACES.sites.tv.find(p=>p.kind==="barangay");setPlace(b.id);});
  s=await pg.evaluate(()=>({place:document.getElementById('p-ans-place').textContent,id:myPlace}));
  assert(/:b:/.test(s.id)&&s.place.length>2,"barangay place shows its name: "+s.place);
  // stored place that no longer exists -> picker opens again
  await pg.evaluate(()=>{localStorage.setItem("bw-place:tv","tv:b:GONE");});
  await pg.reload();await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({open:!document.getElementById('p-where').hidden,my:myPlace}));
  assert(s.open&&s.my===null,"unknown stored place -> Saan ka? again");
  // old street picks migrate
  await pg.evaluate(()=>{localStorage.removeItem("bw-place:tv");localStorage.setItem("bw-street:tv","BW-H03");});
  await pg.reload();await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>myPlace);
  assert(s==="tv:s:BW-H03","old My street pick migrates to a place");
  // Berkeley: no barangay choice
  await pg.click('.site-tabs [data-site="berkeley"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>{openWhere();return document.querySelector('#p-where [data-act="brgy"]').hidden;});
  assert(s===true,"Berkeley has no barangay choice");
  // 48 px targets, contrast of the answer word
  s=await pg.evaluate(()=>[...document.querySelectorAll('#p-where button')].filter(b=>!b.hidden).every(b=>b.getBoundingClientRect().height>=48));
  assert(s,"Saan ka? buttons are at least 48 px tall");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python3 build_html.py && node test_answer.js`
Expected: FAIL — `Cannot read properties of null (reading 'hidden')` (no `#p-where` yet).

- [ ] **Step 3: Inline the shared rule and places in `build_html.py`**

Replace the body of `build_html.py` after the `sites=` line with:
```python
blob="{"+",".join(f'"{k}":{open(f,encoding="utf-8").read()}' for k,f in sites.items())+"}"
assert "__DATA_ALL__" in tpl, "template.html is missing the __DATA_ALL__ placeholder"
verdict=open("shared/verdict.js",encoding="utf-8").read().replace("export const ","const ").replace("export function ","function ")
places=open("places.json",encoding="utf-8").read()
api_base=os.environ.get("BAHAWATCH_API","")
sitekey=os.environ.get("TURNSTILE_SITEKEY","")
for ph in ("/*__VERDICT_JS__*/","__PLACES__","__API_BASE__","__TURNSTILE_SITEKEY__"):
    assert ph in tpl, f"template.html is missing {ph}"
out=(tpl.replace("__DATA_ALL__",blob).replace("/*__VERDICT_JS__*/",verdict).replace("__PLACES__",places)
        .replace("__API_BASE__",json.dumps(api_base)).replace("__TURNSTILE_SITEKEY__",json.dumps(sitekey)))
dest=os.environ.get("OUT","bahawatch_dashboard.html")
open(dest,"w",encoding="utf-8").write(out)
print(f"{dest} written ({os.path.getsize(dest)//1024} KB)")
```

- [ ] **Step 4: Add the markup**

In `template.html`, replace the `<div class="p-status" id="p-status">` block's first child (the `<div role="status" aria-live="polite">` … `</div>` holding `p-headline`, `p-subline`, `p-updated`) with:
```html
    <div class="p-left">
      <section class="p-answer" id="p-answer" data-answer="nodata" aria-labelledby="p-ans-q">
        <div class="p-ans-q" id="p-ans-q">Babaha ba? · <span id="p-ans-place">—</span></div>
        <div class="p-ans-row" role="status" aria-live="polite" aria-atomic="true">
          <span class="p-ans-shape" id="p-ans-shape" aria-hidden="true"></span>
          <span class="p-ans-word" id="p-ans-word">—</span>
          <span class="p-ans-gloss" id="p-ans-gloss"></span>
        </div>
        <div class="p-ans-reason" id="p-ans-reason"></div>
        <div class="p-ans-age" id="p-ans-age"></div>
        <button class="p-link p-ans-pick" id="p-ans-pick" hidden></button>
      </section>
      <div id="p-rep-slot"></div>
      <div id="p-top-area"></div>
    </div>
```
Right after the closing `</div>` of `.p-rows#p-all`'s parent `.p-sec` (inside `.p-col-list`), add:
```html
      <div id="p-bottom-area"></div>
```
Right before `<div class="p-review" id="p-review"></div>`, add the moved area block (held here until `placeArea()` moves it) and the picker:
```html
  <div class="p-area" id="p-area" role="status" aria-live="polite">
    <h1 class="p-head-line" id="p-headline">—</h1>
    <div class="p-sub" id="p-subline"></div>
    <div class="p-upd" id="p-updated"></div>
  </div>
  <div class="p-where" id="p-where" role="dialog" aria-modal="false" aria-labelledby="p-where-q" hidden>
    <h2 id="p-where-q">Saan ka?</h2>
    <button data-act="loc"></button>
    <button data-act="brgy"></button>
    <button data-act="sensor"></button>
    <button data-act="skip" class="p-where-skip"></button>
    <div class="p-where-list" id="p-where-list" hidden></div>
  </div>
```

- [ ] **Step 5: Add the styles**

In the public-view CSS (after the `.p-status .p-upd` rule), add:
```css
.p-left{display:flex; flex-direction:column; gap:10px}
.p-answer{border:2px solid var(--line); border-radius:6px; padding:12px 16px}
.p-answer[data-answer="oo"]{border-color:var(--alert); background:var(--alert-bg)}
.p-answer[data-answer="baka"]{border-color:var(--warn); background:var(--warn-bg)}
.p-answer[data-answer="hindi"]{border-color:var(--ok)}
.p-answer[data-answer="nodata"]{border-style:dashed; border-color:var(--ink-2); background:var(--panel-2)}
.p-ans-q{font-size:14px; font-weight:700; color:var(--ink-2)}
.p-ans-row{display:flex; align-items:center; gap:12px; margin-top:4px; flex-wrap:wrap}
.p-ans-shape{width:26px; height:26px; flex:none}
.p-answer[data-answer="oo"] .p-ans-shape{background:var(--alert); border-radius:3px; outline:1.5px solid var(--ink); outline-offset:-1.5px}
.p-answer[data-answer="baka"] .p-ans-shape{background:var(--warn); clip-path:polygon(50% 0,100% 100%,0 100%)}
.p-answer[data-answer="hindi"] .p-ans-shape{border:5px solid var(--ok); border-radius:50%; background:var(--marker-fill)}
.p-answer[data-answer="nodata"] .p-ans-shape{border:3px dashed var(--ink-2); border-radius:3px}
.p-ans-word{font-size:36px; font-weight:700; letter-spacing:-.01em; line-height:1.05}
.p-answer[data-answer="oo"] .p-ans-word{color:var(--alert)}
.p-answer[data-answer="baka"] .p-ans-word{color:var(--warn-ink)}
.p-answer[data-answer="hindi"] .p-ans-word{color:var(--ok)}
.p-answer[data-answer="nodata"] .p-ans-word{color:var(--ink-2); font-size:24px}
.p-ans-gloss{font-size:15px; color:var(--ink)}
.p-ans-reason{font-size:16px; margin-top:6px}
.p-ans-age{font-size:13px; color:var(--ink-2); margin-top:2px; font-variant-numeric:tabular-nums}
.p-ans-pick{margin-top:8px; min-height:48px}
.p-area .p-head-line{font-size:22px}
#p-top-area .p-area .p-head-line{font-size:30px}
.p-where{position:fixed; inset:auto 0 0 0; z-index:20; background:var(--panel); border-top:3px solid var(--ink); padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px)); display:grid; gap:8px; max-width:560px; margin:0 auto; box-shadow:0 -6px 24px rgba(0,0,0,.18)}
.p-where h2{font-size:22px; margin:0 0 4px}
.p-where button{min-height:48px; font-size:16px; font-weight:600; border:1px solid var(--ink); border-radius:4px; background:var(--panel); text-align:left; padding:10px 14px}
.p-where button:hover{background:var(--panel-2)}
.p-where .p-where-skip{border-color:transparent; color:var(--ink-2); font-weight:400}
.p-where-list{display:grid; gap:6px; max-height:40vh; overflow-y:auto}
```
(`--alert-bg` and `--warn-bg` already exist in the details-view tokens; `--warn-ink` in the public tokens.)

- [ ] **Step 6: Add the answer strings for all six languages**

Directly after the `PATH_EN` object, add:
```js
/* ---------- "Babaha ba?" answer strings (spec §3, §5, §6). ceb/ilo/hil/pam pending professional review. ---------- */
const ANS_LANGS={
 en:{q:"Will it flood here?",word:{oo:"Yes",baka:"Maybe",hindi:"No",nodata:"No fresh data"},
  gloss:{oo:"Flooding here now, or expected within the hour.",baka:"Conditions for flooding, but no water measured yet.",hindi:"No sign of flooding in the next hour.",nodata:"Check again soon."},
  reason:{stale:"The newest data is over 20 minutes old.",sensor_now:"Water on {name}: {cm} cm.",sensor_soon:"Water rising on {name}, about {min} min away.",upstream:"Water rising near {name}, about {min} min away.",reports:"{n} neighbours report flooding nearby.",reports_vs_dry_sensor:"Neighbours report flooding; sensor here is dry.",rain_flood_zone:"Heavy rain ({mm} mm/h), and this area floods in a 5- or 25-year storm.",rain_heavy:"Very heavy rain ({mm} mm/h) in a mapped flood area.",reports_few:"Neighbours report flooding nearby ({n}).",sensor_trace:"A little water on {name} ({cm} cm).",clear:"No flood signs from sensors, reports or rain."},
  age:"updated {m} min ago",justNow:"updated just now",pick:"Pick your place to get an answer.",pickBtn:"Pick your place",
  whereQ:"Where are you?",useLoc:"Use my location",pickBrgy:"Pick my barangay",pickSensor:"Pick a street with a sensor",skip:"Skip",
  locFail:"Couldn't get your location. Pick your barangay instead."},
 fil:{q:"Babaha ba?",word:{oo:"Oo",baka:"Baka",hindi:"Hindi",nodata:"Walang bagong datos"},
  gloss:{oo:"May baha rito ngayon, o inaasahan sa loob ng isang oras.",baka:"May palatandaan ng baha, pero wala pang nasusukat na tubig.",hindi:"Walang palatandaan ng baha sa susunod na isang oras.",nodata:"Tingnan ulit mamaya."},
  reason:{stale:"Mahigit 20 minuto na ang pinakabagong datos.",sensor_now:"May tubig sa {name}: {cm} cm.",sensor_soon:"Tumataas ang tubig sa {name}, mga {min} minuto pa.",upstream:"Tumataas ang tubig malapit sa {name}, mga {min} minuto pa.",reports:"{n} kapitbahay ang nag-ulat ng baha malapit dito.",reports_vs_dry_sensor:"May nag-ulat ng baha, pero tuyo ang sensor dito.",rain_flood_zone:"Malakas na ulan ({mm} mm/oras), at binabaha ang lugar na ito sa 5- o 25-taong bagyo.",rain_heavy:"Napakalakas na ulan ({mm} mm/oras) sa lugar na may flood map.",reports_few:"May nag-ulat ng baha malapit dito ({n}).",sensor_trace:"Kaunting tubig sa {name} ({cm} cm).",clear:"Walang palatandaan ng baha mula sa sensor, ulat, o ulan."},
  age:"na-update {m} min na ang nakalipas",justNow:"kaka-update lang",pick:"Piliin ang lugar mo para makita ang sagot.",pickBtn:"Piliin ang lugar mo",
  whereQ:"Saan ka?",useLoc:"Gamitin ang lokasyon ko",pickBrgy:"Piliin ang barangay ko",pickSensor:"Piliin ang kalyeng may sensor",skip:"Laktawan",
  locFail:"Hindi makuha ang lokasyon mo. Piliin na lang ang barangay mo."},
 ceb:{q:"Mobaha ba?",word:{oo:"Oo",baka:"Basin",hindi:"Dili",nodata:"Walay bag-ong datos"},
  gloss:{oo:"Naay baha diri karon, o gipaabot sulod sa usa ka oras.",baka:"Naay timailhan sa baha, pero wala pay nasukod nga tubig.",hindi:"Walay timailhan sa baha sa sunod nga usa ka oras.",nodata:"Tan-awa pag-usab unya."},
  reason:{stale:"Kapin na sa 20 minutos ang pinakabag-ong datos.",sensor_now:"Naay tubig sa {name}: {cm} cm.",sensor_soon:"Nagsaka ang tubig sa {name}, mga {min} minutos pa.",upstream:"Nagsaka ang tubig duol sa {name}, mga {min} minutos pa.",reports:"{n} ka silingan ang nagtaho og baha duol diri.",reports_vs_dry_sensor:"Naay nagtaho og baha, pero uga ang sensor diri.",rain_flood_zone:"Kusog nga ulan ({mm} mm/oras), ug mobaha kini nga lugar sa 5- o 25-ka-tuig nga bagyo.",rain_heavy:"Kusog kaayo nga ulan ({mm} mm/oras) sa lugar nga naay flood map.",reports_few:"Naay nagtaho og baha duol diri ({n}).",sensor_trace:"Gamay nga tubig sa {name} ({cm} cm).",clear:"Walay timailhan sa baha gikan sa sensor, taho, o ulan."},
  age:"gi-update {m} min na ang milabay",justNow:"bag-o lang gi-update",pick:"Pilia ang imong lugar aron makita ang tubag.",pickBtn:"Pilia ang imong lugar",
  whereQ:"Asa ka?",useLoc:"Gamita ang akong lokasyon",pickBrgy:"Pilia ang akong barangay",pickSensor:"Pilia ang dalan nga naay sensor",skip:"Laktawi",
  locFail:"Dili makuha ang imong lokasyon. Pilia na lang ang imong barangay."},
 ilo:{q:"Aglayus kadi?",word:{oo:"Wen",baka:"Mabalin",hindi:"Saan",nodata:"Awan ti baro a datos"},
  gloss:{oo:"Adda layus ditoy ita, wenno mapakpakadaan iti uneg ti maysa nga oras.",baka:"Adda pagilasinan ti layus, ngem awan pay nasukat a danum.",hindi:"Awan ti pagilasinan ti layus iti sumaruno a maysa nga oras.",nodata:"Kitaen manen no madamdama."},
  reason:{stale:"Nasurok a 20 minuto ti kabaruan a datos.",sensor_now:"Adda danum iti {name}: {cm} cm.",sensor_soon:"Ngumatngato ti danum iti {name}, agarup {min} minuto pay.",upstream:"Ngumatngato ti danum iti asideg ti {name}, agarup {min} minuto pay.",reports:"{n} a kaarruba ti nangipadamag iti layus iti asideg.",reports_vs_dry_sensor:"Adda nangipadamag iti layus, ngem namaga ti sensor ditoy.",rain_flood_zone:"Napigsa a tudo ({mm} mm/oras), ken aglayus daytoy a lugar iti 5- wenno 25-tawen a bagyo.",rain_heavy:"Napigsa unay a tudo ({mm} mm/oras) iti lugar nga adda flood map-na.",reports_few:"Adda nangipadamag iti layus iti asideg ({n}).",sensor_trace:"Bassit a danum iti {name} ({cm} cm).",clear:"Awan ti pagilasinan ti layus manipud iti sensor, padamag, wenno tudo."},
  age:"naipabaro {m} min ti napalabas",justNow:"kaipapabaro",pick:"Pilien ti lugarmo tapno makita ti sungbat.",pickBtn:"Pilien ti lugarmo",
  whereQ:"Sadino ti ayanmo?",useLoc:"Usaren ti lokasionko",pickBrgy:"Pilien ti barangayko",pickSensor:"Pilien ti kalsada nga adda sensorna",skip:"Laktawan",
  locFail:"Saan a makuha ti lokasionmo. Pilien laengen ti barangaymo."},
 hil:{q:"Magabaha bala?",word:{oo:"Huo",baka:"Basi",hindi:"Indi",nodata:"Wala sang bag-o nga datos"},
  gloss:{oo:"May baha diri subong, ukon ginapaabot sa sulod sang isa ka oras.",baka:"May mga tanda sang baha, pero wala pa sang nasukat nga tubig.",hindi:"Wala sang tanda sang baha sa masunod nga isa ka oras.",nodata:"Tan-awa liwat sa ulihi."},
  reason:{stale:"Labaw na sa 20 minutos ang pinakabag-o nga datos.",sensor_now:"May tubig sa {name}: {cm} cm.",sensor_soon:"Nagataas ang tubig sa {name}, mga {min} minutos pa.",upstream:"Nagataas ang tubig malapit sa {name}, mga {min} minutos pa.",reports:"{n} ka kaingod ang nag-report sang baha malapit diri.",reports_vs_dry_sensor:"May nag-report sang baha, pero uga ang sensor diri.",rain_flood_zone:"Mabaskog nga ulan ({mm} mm/oras), kag ginabaha ini nga lugar sa 5- ukon 25-ka-tuig nga bagyo.",rain_heavy:"Mabaskog gid nga ulan ({mm} mm/oras) sa lugar nga may flood map.",reports_few:"May nag-report sang baha malapit diri ({n}).",sensor_trace:"Diutay nga tubig sa {name} ({cm} cm).",clear:"Wala sang tanda sang baha halin sa sensor, report, ukon ulan."},
  age:"gin-update {m} min na ang nagligad",justNow:"bag-o lang gin-update",pick:"Pilia ang imo lugar para makita ang sabat.",pickBtn:"Pilia ang imo lugar",
  whereQ:"Diin ka?",useLoc:"Gamita ang akon lokasyon",pickBrgy:"Pilia ang akon barangay",pickSensor:"Pilia ang dalan nga may sensor",skip:"Laktawan",
  locFail:"Indi makuha ang imo lokasyon. Pilia na lang ang imo barangay."},
 pam:{q:"Albugan kaya?",word:{oo:"Wa",baka:"Malyari",hindi:"Ali",nodata:"Alang bayung datos"},
  gloss:{oo:"Atin albug keni ngeni, o aasanan king loob ning metung a oras.",baka:"Atin tanda ning albug, oneng ala pang masukat a danum.",hindi:"Alang tanda ning albug king datang a metung a oras.",nodata:"Lawen mu pasibayu mamaya."},
  reason:{stale:"Mayigit 20 minutu ne ing pekabayung datos.",sensor_now:"Atin danum king {name}: {cm} cm.",sensor_soon:"Sasampa ing danum king {name}, lagyu {min} minutu pa.",upstream:"Sasampa ing danum malapit king {name}, lagyu {min} minutu pa.",reports:"{n} a kapitbale ing mengreport albug malapit keni.",reports_vs_dry_sensor:"Atin mengreport albug, oneng mamalang ing sensor keni.",rain_flood_zone:"Makusug a uran ({mm} mm/oras), at albugan ya ining lugal king 5- o 25-banwang bagyu.",rain_heavy:"Makusug dili a uran ({mm} mm/oras) king lugal a atin flood map.",reports_few:"Atin mengreport albug malapit keni ({n}).",sensor_trace:"Kakaunti a danum king {name} ({cm} cm).",clear:"Alang tanda ning albug manibat king sensor, report, o uran."},
  age:"me-update {m} min ne ing milabas",justNow:"bayu pa mu me-update",pick:"Pilinan me ing lugal mu ban akit me ing sagut.",pickBtn:"Pilinan me ing lugal mu",
  whereQ:"Nokarin ka?",useLoc:"Gamitan me ing lokasyun ku",pickBrgy:"Pilinan me ing barangay ku",pickSensor:"Pilinan me ing dalan a atin sensor",skip:"Laktawan",
  locFail:"E makuha ing lokasyun mu. Pilinan mu ne mu ing barangay mu."},
};
const A=()=>SITE_CFG&&SITE_CFG.langs==="en"?ANS_LANGS.en:(ANS_LANGS[LANG]||ANS_LANGS.en);
const fill=(s,v)=>s.replace(/\{(\w+)\}/g,(_,k)=>v[k]!=null?v[k]:"");
```

- [ ] **Step 7: Add the place logic and the demo verdict**

Directly after the `ANS_LANGS` block, add:
```js
/*__VERDICT_JS__*/
const PLACES=__PLACES__;
const DEMO_RAIN_MMH_PER_P=60;          // simulated storm intensity P → mm/h (typhoon peak ≈ 30 mm/h = PAGASA red)
let myPlace=null;
const placesForSite=()=>PLACES.sites[SITE]||[];
const currentPlace=()=>placesForSite().find(p=>p.id===myPlace)||null;
function haversineM(a,b,c,d){const r=x=>x*Math.PI/180,s=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*6371000*Math.asin(Math.sqrt(s));}
function loadPlace(){
  myPlace=null;let v=null;
  try{v=localStorage.getItem(siteKey("bw-place"));}catch(e){}
  if(!v){let st=null;try{st=localStorage.getItem(siteKey("bw-street"));}catch(e){}if(st)v=SITE+":s:"+st;}   // migrate old My street picks
  if(v&&placesForSite().some(p=>p.id===v))myPlace=v;
  else if(v){try{localStorage.removeItem(siteKey("bw-asked"));}catch(e){}}   // stored place no longer exists → ask again
}
function setPlace(id){
  myPlace=id;try{localStorage.setItem(siteKey("bw-place"),id);}catch(e){}
  const p=currentPlace();
  if(p&&p.kind==="sensor"){myStreet=p.sensor;try{localStorage.setItem(siteKey("bw-street"),p.sensor);}catch(e){}}
  closeWhere();renderPublic();
}
function demoInputs(p){
  const now=BASE.getTime()+tMin*60000;
  const conn=new Map(p.connected.map(c=>[c.sensor,c.travelMin]));
  const sensors=HOUSEHOLD.map(s=>({id:s.id,name:addr(s),here:p.kind==="sensor"&&p.sensor===s.id,distM:haversineM(p.lat,p.lon,s.lat,s.lon),
    travelMin:conn.has(s.id)?conn.get(s.id):null,depthCm:s.depth*100,rateCmPerHr:s.rate*100,at:now}));
  const P=SCEN[scenario].P;
  const rain={nowMmH:P*pulse(tMin,0)*DEMO_RAIN_MMH_PER_P,nextMmH:P*pulse(tMin+60,0)*DEMO_RAIN_MMH_PER_P,at:now};
  return {now,place:p,sensors,reports:{yesPhones:0,newestAt:null},rain};
}
function showAnswer(v,serverNow){
  const L=A(),box=$("p-answer");
  box.dataset.answer=v.answer;
  $("p-ans-word").textContent=L.word[v.answer];
  $("p-ans-gloss").textContent=L.gloss[v.answer];
  $("p-ans-reason").textContent=fill(L.reason[v.reason.key]||"",v.reason.vars||{});
  const ref=serverNow!=null?serverNow:BASE.getTime()+tMin*60000;
  const m=v.updatedAt!=null?Math.max(0,Math.round((ref-v.updatedAt)/60000)):null;
  $("p-ans-age").textContent=m==null?"":m<1?L.justNow:fill(L.age,{m});
}
function placeArea(){
  const area=$("p-area"),target=myPlace?$("p-bottom-area"):$("p-top-area");
  if(area.parentElement!==target)target.appendChild(area);
}
function renderAnswer(){
  const L=A(),p=currentPlace();
  $("p-ans-q").firstChild.textContent=L.q+" · ";
  $("p-ans-place").textContent=p?p.name:"—";
  const pick=$("p-ans-pick");pick.textContent=L.pickBtn;pick.hidden=!!p;
  placeArea();
  if(!p){$("p-answer").dataset.answer="nodata";$("p-ans-word").textContent="";$("p-ans-gloss").textContent="";$("p-ans-reason").textContent=L.pick;$("p-ans-age").textContent="";return;}
  showAnswer(babahaBa(demoInputs(p)));
}
/* ---------- "Saan ka?" ---------- */
function openWhere(){
  const L=A(),w=$("p-where");
  $("p-where-q").textContent=L.whereQ;
  const set=(act,txt)=>{const b=w.querySelector(`[data-act="${act}"]`);b.textContent=txt;return b;};
  set("loc",L.useLoc);set("sensor",L.pickSensor);set("skip",L.skip);
  set("brgy",L.pickBrgy).hidden=!placesForSite().some(p=>p.kind==="barangay");
  $("p-where-list").hidden=true;w.hidden=false;
  w.querySelector('button:not([hidden])').focus();
}
function closeWhere(){$("p-where").hidden=true;try{localStorage.setItem(siteKey("bw-asked"),"1");}catch(e){}}
function listPlaces(kind){
  const list=$("p-where-list");
  list.innerHTML=placesForSite().filter(p=>p.kind===kind).sort((a,b)=>a.name.localeCompare(b.name))
    .map(p=>`<button data-place="${esc(p.id)}">${esc(p.name)}${p.muni?`<small> · ${esc(p.muni)}</small>`:""}</button>`).join("");
  list.hidden=false;list.querySelector("button")?.focus();
}
function nearestPlace(lat,lon){
  let best=null;
  for(const p of placesForSite()){
    const d=haversineM(lat,lon,p.lat,p.lon);
    if(p.kind==="sensor"&&d>300)continue;
    if(!best||d<best.d)best={p,d};
  }
  return best&&best.p;
}
$("p-where").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.place)return setPlace(b.dataset.place);
  const act=b.dataset.act;
  if(act==="skip"){closeWhere();renderPublic();}
  else if(act==="brgy")listPlaces("barangay");
  else if(act==="sensor")listPlaces("sensor");
  else if(act==="loc"){
    if(!navigator.geolocation){$("p-ans-reason").textContent=A().locFail;return listPlaces("barangay");}
    navigator.geolocation.getCurrentPosition(pos=>{const p=nearestPlace(pos.coords.latitude,pos.coords.longitude);if(p)setPlace(p.id);else listPlaces(placesForSite().some(q=>q.kind==="barangay")?"barangay":"sensor");},
      ()=>{$("p-ans-reason").textContent=A().locFail;listPlaces(placesForSite().some(q=>q.kind==="barangay")?"barangay":"sensor");},{timeout:8000,maximumAge:600000});
  }
});
$("p-ans-pick").addEventListener("click",openWhere);
```

In `renderPublic()`, add `renderAnswer();` as the last line before the closing `}`.

In `initSite(id)`, add at the end (before its closing `}`): `loadPlace();`.

In the boot block (after `setView(VIEW);switchSite(h0.site);syncTabs();writeHash();`), add:
```js
{let asked=null;try{asked=localStorage.getItem(siteKey("bw-asked"));}catch(e){}if(!myPlace&&!asked)openWhere();}
```
And at the end of `switchSite(id)` add the same line so a first visit to each site asks once. (`loadPlace` above already clears `bw-asked` when a stored place no longer exists, so the picker reopens.)

In the existing street picker handler (`$("p-pick").addEventListener("click",…)`), after `myStreet=b.dataset.pick;…`, add `myPlace=SITE+":s:"+myStreet;try{localStorage.setItem(siteKey("bw-place"),myPlace);}catch(x){}`.

- [ ] **Step 8: Run the tests**

Run: `python3 build_html.py && node test_answer.js`
Expected: every line `ok` (12 lines), exit code 0.

Run the existing suites:
```bash
bash test_build.sh && for f in test_init test_tabs test_sites test_public test_figure test_car; do node $f.js | grep -E "FAIL" && exit 1; done; echo ALL GREEN
```
Expected: `ALL GREEN`. If `test_tabs.js` fails on "stale stored street id → choose again", the migration made `BW-GONE` a place: `loadPlace` must only accept ids present in `placesForSite()` (it does, via the `some(...)` check) — check the order of `loadPlace()` vs the existing `myStreet` validation in `switchSite`.

- [ ] **Step 9: Commit**

```bash
git add build_html.py template.html test_answer.js bahawatch_dashboard.html
git commit -m "Page: Babaha ba? answer band, Saan ka? picker, demo verdict in six languages"
```

---

### Task 6: Page — reports and live status

**Files:**
- Modify: `template.html`
- Test: `test_report.js` (new)

**Interfaces:**
- Consumes: Task 5 globals (`myPlace`, `currentPlace()`, `showAnswer(v, serverNow)`, `A()`, `fill`), `API_BASE`, `TURNSTILE_SITEKEY`, Worker endpoints from Tasks 3–4.
- Produces: `LIVE` (boolean), `REP_LANGS`, `R()`, `deviceId()`, `sendReport(answer)`, `pollStatus()`, `lastLive` (last `/status` body), `flushPending()`, `turnstileToken()`.

- [ ] **Step 1: Write the failing test**

`test_report.js`:
```js
const {chromium}=require('playwright');
const {execSync}=require('child_process');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
execSync('BAHAWATCH_API=https://api.test.local TURNSTILE_SITEKEY=1x00000000000000000000AA OUT=/tmp/bw_live_test.html python3 build_html.py',{cwd:'/home/claude/work'});
const U='file:///tmp/bw_live_test.html#tv/live';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  await ctx.addInitScript(()=>{localStorage.setItem("bw-place:tv","tv:s:BW-H01");localStorage.setItem("bw-asked:tv","1");
    window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("tok-ok"),0);return "w1";},remove(){}};});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const posted=[];let reportStatus=201;let statusBody=null;let statusFail=false;
  await pg.route('https://api.test.local/**',async r=>{
    const u=r.request().url(),m=r.request().method();
    if(m==="POST"&&/\/report$/.test(u)){posted.push(JSON.parse(r.request().postData()));return r.fulfill({status:reportStatus,contentType:'application/json',body:JSON.stringify(reportStatus===201?{id:41}:{error:'already recorded'})});}
    if(m==="POST"&&/\/undo$/.test(u))return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
    if(/\/status\//.test(u)){if(statusFail)return r.abort();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});}
    return r.fulfill({status:404,body:'{}'});
  });
  const SN=Date.UTC(2026,8,26,9,0);
  statusBody={place:"tv:s:BW-H01",answer:"baka",reason:{key:"rain_flood_zone",vars:{mm:9}},etaMin:null,updatedAt:SN-3*60000,checkedAt:SN-60000,serverNow:SN,stillThere:null};
  await pg.goto(U);await pg.waitForTimeout(600);
  // live answer comes from the Worker; age uses the server clock even if the phone clock is 3 h fast
  await pg.evaluate(()=>{const d=Date.now;Date.now=()=>d()+3*3600000;});
  await pg.evaluate(()=>pollStatus());await pg.waitForTimeout(200);
  let s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,age:document.getElementById('p-ans-age').textContent}));
  assert(s.a==="baka","live mode shows the Worker's answer: "+s.a);
  assert(/3 min/.test(s.age),"age uses the server clock, not the phone's: "+s.age);
  // report row: three buttons, 48 px, question in the current language
  s=await pg.evaluate(()=>({q:document.getElementById('p-rep-q').textContent,btns:[...document.querySelectorAll('#p-rep [data-ans]')].map(b=>[b.dataset.ans,b.getBoundingClientRect().height])}));
  assert(s.btns.map(x=>x[0]).join()==="oo,hindi,di_sigurado"&&s.btns.every(x=>x[1]>=48),"report row: Oo · Hindi · Hindi sigurado, 48 px tall");
  // location denied -> report still sent at the place centre, rounded to 3 decimals
  await pg.evaluate(()=>{navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});});
  await pg.click('#p-rep [data-ans="oo"]');await pg.waitForTimeout(400);
  const P=await pg.evaluate(()=>currentPlace());
  assert(posted.length===1&&posted[0].lat===Math.round(P.lat*1000)/1000&&posted[0].token==="tok-ok"&&posted[0].demo===false&&/^[a-f0-9]{24}$/.test(posted[0].device),"denied location: report sent at the place centre with bot token and anonymous id");
  s=await pg.evaluate(()=>({t:document.getElementById('p-rep-msg').textContent,undo:!document.getElementById('p-rep-undo').hidden}));
  assert(/Thanks|Salamat/.test(s.t)&&s.undo,"thanks message with Undo");
  await pg.click('#p-rep-undo');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>document.getElementById('p-rep-undo').hidden);
  assert(s,"Undo sent and hidden");
  // double tap: server 429 shows as recorded, not as an error
  reportStatus=429;
  await pg.click('#p-rep [data-ans="hindi"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>document.getElementById('p-rep-msg').textContent);
  assert(/Thanks|Salamat/.test(s),"429 is shown as recorded: "+s);
  // Still there? prompt
  reportStatus=201;statusBody={...statusBody,stillThere:{ageMin:12,distM:140}};
  await pg.evaluate(()=>pollStatus());await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>document.getElementById('p-rep-q').textContent);
  assert(/still there|Nandiyan pa ba/i.test(s),"Still there? replaces the question when a nearby report exists: "+s);
  // offline: report held, sent when back online within 10 min; older than 10 min dropped
  const n0=posted.length;
  await ctx.setOffline(true);
  await pg.evaluate(()=>{localStorage.removeItem("bw-lastrep");});
  await pg.click('#p-rep [data-ans="oo"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>JSON.parse(localStorage.getItem("bw-pending")||"null"));
  assert(s&&s.body.answer==="oo","offline report held on the phone");
  await ctx.setOffline(false);await pg.evaluate(()=>flushPending());await pg.waitForTimeout(400);
  assert(posted.length===n0+1&&!(await pg.evaluate(()=>localStorage.getItem("bw-pending"))),"held report sent when back online");
  await pg.evaluate(()=>localStorage.setItem("bw-pending",JSON.stringify({madeAt:Date.now()-11*60000,body:{place:"tv:s:BW-H01",answer:"oo",lat:1,lon:1,device:"a".repeat(24),demo:false}})));
  await pg.evaluate(()=>flushPending());await pg.waitForTimeout(200);
  assert(posted.length===n0+1&&!(await pg.evaluate(()=>localStorage.getItem("bw-pending"))),"a held report older than 10 min is dropped");
  // Worker unreachable for 25 min -> nodata, never Hindi
  statusFail=true;
  await pg.evaluate(()=>{lastLive={...lastLive,answer:"hindi",checkedAt:lastLive.serverNow-25*60000,updatedAt:lastLive.serverNow-25*60000};pollStatus();});await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>document.getElementById('p-answer').dataset.answer);
  assert(s==="nodata","Worker unreachable and data older than 20 min -> nodata");
  // demo page: reports tagged demo, no network without API_BASE
  const pg2=await ctx.newPage();await pg2.goto('file:///home/claude/work/bahawatch_dashboard.html');await pg2.waitForTimeout(400);
  s=await pg2.evaluate(()=>({live:LIVE,api:API_BASE}));
  assert(s.live===false&&s.api==="","the published demo page has no API and stays in demo mode");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node test_report.js`
Expected: FAIL — `pollStatus is not defined`.

- [ ] **Step 3: Constants, live mode and hash routing**

After `const PLACES=__PLACES__;` add:
```js
const API_BASE=__API_BASE__, TURNSTILE_SITEKEY=__TURNSTILE_SITEKEY__;
let LIVE=false, lastLive=null;
```
In `parseHash()`, after computing `site` and `view`, add `LIVE=!!API_BASE&&m.slice(1).includes("live");` — so `#tv/live` (simple view) and `#tv/details/live` (details view) are both live; `view` is still `details` only when `m[1]==="details"`. Replace `writeHash()` with:
```js
function writeHash(){const plain=SITE==="tv"&&VIEW==="public"&&!LIVE;
  history.replaceState(null,"",plain?location.pathname+location.search:"#"+SITE+(VIEW==="details"?"/details":"")+(LIVE?"/live":""));}
```

- [ ] **Step 4: Report row markup and strings**

Replace `<div id="p-rep-slot"></div>` (Task 5) with:
```html
      <section class="p-rep" id="p-rep" aria-labelledby="p-rep-q">
        <div class="p-rep-q" id="p-rep-q">May baha ba rito?</div>
        <div class="p-rep-btns">
          <button data-ans="oo"></button><button data-ans="hindi"></button><button data-ans="di_sigurado"></button>
        </div>
        <div class="p-rep-msg" id="p-rep-msg" role="status" aria-live="polite"></div>
        <button class="p-link" id="p-rep-undo" hidden></button>
      </section>
```
CSS:
```css
.p-rep{border-top:1px solid var(--line); padding-top:10px}
.p-rep-q{font-size:16px; font-weight:700}
.p-rep-btns{display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:8px}
.p-rep-btns button{min-height:48px; font-size:16px; font-weight:700; border:1px solid var(--ink); border-radius:4px; background:var(--panel)}
.p-rep-btns button:hover{background:var(--panel-2)}
.p-rep-msg{font-size:14px; margin-top:6px; min-height:1.4em}
#p-rep-undo{min-height:44px; margin-top:4px}
```
Strings (after `ANS_LANGS`):
```js
const REP_LANGS={
 en:{q:"Is there flooding here?",still:"Someone reported flooding nearby. Is it still there?",oo:"Yes",hindi:"No",di_sigurado:"Not sure",thanks:"Thanks, recorded.",undo:"Undo",undone:"Removed.",fail:"Couldn't send. Try again.",held:"No signal. We'll send it when you're back online."},
 fil:{q:"May baha ba rito?",still:"May nag-ulat ng baha malapit dito. Nandiyan pa ba?",oo:"Oo",hindi:"Hindi",di_sigurado:"Hindi sigurado",thanks:"Salamat, naitala.",undo:"Bawiin",undone:"Binawi na.",fail:"Hindi naipadala, subukan ulit.",held:"Walang signal. Ipapadala namin pagbalik ng signal."},
 ceb:{q:"Naay baha diri?",still:"Naay nagtaho og baha duol diri. Naa pa ba?",oo:"Oo",hindi:"Dili",di_sigurado:"Dili sigurado",thanks:"Salamat, natala na.",undo:"Bawia",undone:"Gibawi na.",fail:"Wala napadala, sulayi pag-usab.",held:"Walay signal. Ipadala namo inig balik sa signal."},
 ilo:{q:"Adda kadi layus ditoy?",still:"Adda nangipadamag iti layus iti asideg. Adda pay laeng kadi?",oo:"Wen",hindi:"Saan",di_sigurado:"Saan a sigurado",thanks:"Agyamanak, naitala.",undo:"Ibabawi",undone:"Naibabawin.",fail:"Saan a naipatulod, padasem manen.",held:"Awan ti signal. Ipatulodmi no agsubli ti signal."},
 hil:{q:"May baha bala diri?",still:"May nag-report sang baha malapit diri. Yara pa bala?",oo:"Huo",hindi:"Indi",di_sigurado:"Indi sigurado",thanks:"Salamat, natala na.",undo:"Bawia",undone:"Ginbawi na.",fail:"Wala napadala, tilawi liwat.",held:"Wala sang signal. Ipadala namon kon magbalik ang signal."},
 pam:{q:"Atin albug keni?",still:"Atin mengreport albug malapit keni. Atyu pa?",oo:"Wa",hindi:"Ali",di_sigurado:"Ali sigurado",thanks:"Salamat, me-record ne.",undo:"Bawian",undone:"Mebawi ne.",fail:"E me-padala, subukan mu pasibayu.",held:"Alang signal. Ipadala mi pamanyulit ning signal."},
};
const R=()=>SITE_CFG&&SITE_CFG.langs==="en"?REP_LANGS.en:(REP_LANGS[LANG]||REP_LANGS.en);
```

- [ ] **Step 5: Reporting, Turnstile, offline hold, Undo**

After the "Saan ka?" code, add:
```js
/* ---------- neighbour reports (spec §4) ---------- */
const HOLD_MS=10*60000, UNDO_UI_MS=10000;
function deviceId(){
  let d=null;try{d=localStorage.getItem("bw-device");}catch(e){}
  if(!/^[a-f0-9]{24}$/.test(d||"")){const a=new Uint8Array(12);crypto.getRandomValues(a);d=[...a].map(x=>x.toString(16).padStart(2,"0")).join("");try{localStorage.setItem("bw-device",d);}catch(e){}}
  return d;
}
function loadTurnstile(){
  return new Promise((res,rej)=>{if(window.turnstile)return res(window.turnstile);
    const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload=()=>res(window.turnstile);s.onerror=rej;document.head.appendChild(s);});
}
async function turnstileToken(){
  const ts=await loadTurnstile();
  return new Promise((res,rej)=>{const el=document.createElement("div");el.className="sr-only";document.body.appendChild(el);
    ts.render(el,{sitekey:TURNSTILE_SITEKEY,appearance:"interaction-only",callback:t=>{res(t);setTimeout(()=>el.remove(),0);},"error-callback":()=>{el.remove();rej(new Error("turnstile"));}});});
}
const round3=x=>Math.round(x*1000)/1000;
function where(p){
  return new Promise(res=>{
    const centre={lat:round3(p.lat),lon:round3(p.lon)};
    if(!navigator.geolocation)return res(centre);
    navigator.geolocation.getCurrentPosition(pos=>res({lat:round3(pos.coords.latitude),lon:round3(pos.coords.longitude)}),()=>res(centre),{timeout:5000,maximumAge:600000});
  });
}
let undoTimer=null;
function repMsg(t,undoId){
  $("p-rep-msg").textContent=t;const u=$("p-rep-undo");u.textContent=R().undo;u.hidden=!undoId;u.dataset.id=undoId||"";
  clearTimeout(undoTimer);if(undoId)undoTimer=setTimeout(()=>{u.hidden=true;},UNDO_UI_MS);
}
async function postReport(body){
  const token=await turnstileToken();
  const r=await fetch(API_BASE+"/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,token})});
  if(r.status===201)return (await r.json()).id;
  if(r.status===429)return 0;                      // already recorded: a double tap or a re-send
  throw new Error("report "+r.status);
}
async function sendReport(answer){
  const p=currentPlace();if(!p)return openWhere();
  const L=R();
  if(!LIVE){repMsg(L.thanks);return;}              // demo page: acknowledged on the phone only
  const pos=await where(p);
  const body={place:p.id,answer,lat:pos.lat,lon:pos.lon,device:deviceId(),demo:false};
  if(!navigator.onLine){try{localStorage.setItem("bw-pending",JSON.stringify({madeAt:Date.now(),body}));}catch(e){}repMsg(L.held);return;}
  try{const id=await postReport(body);repMsg(L.thanks,id||null);}
  catch(e){try{localStorage.setItem("bw-pending",JSON.stringify({madeAt:Date.now(),body}));}catch(x){}repMsg(L.fail);}
}
async function flushPending(){
  let p=null;try{p=JSON.parse(localStorage.getItem("bw-pending")||"null");}catch(e){}
  if(!p)return;
  if(Date.now()-p.madeAt>HOLD_MS){try{localStorage.removeItem("bw-pending");}catch(e){}return;}
  try{await postReport(p.body);try{localStorage.removeItem("bw-pending");}catch(e){}repMsg(R().thanks);}catch(e){}
}
window.addEventListener("online",flushPending);
$("p-rep").addEventListener("click",e=>{const b=e.target.closest("[data-ans]");if(b)sendReport(b.dataset.ans);});
$("p-rep-undo").addEventListener("click",async()=>{
  const id=$("p-rep-undo").dataset.id;if(!id)return;
  try{await fetch(API_BASE+"/report/"+id+"/undo",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({device:deviceId()})});}catch(e){}
  repMsg(R().undone);
});
function renderReportRow(){
  const L=R();
  $("p-rep-q").textContent=lastLive&&lastLive.stillThere?L.still:L.q;
  document.querySelectorAll("#p-rep [data-ans]").forEach(b=>{b.textContent=L[b.dataset.ans];});
  $("p-rep").hidden=!currentPlace();
}
```
In `renderPublic()`, add `renderReportRow();` after `renderAnswer();`.

- [ ] **Step 6: Live status polling**

After the reports code, add:
```js
/* ---------- live status (spec §7) ---------- */
const FRESH_MS=20*60000, POLL_MS=60000;
async function pollStatus(){
  if(!LIVE||!myPlace)return;
  try{
    const r=await fetch(API_BASE+"/status/"+encodeURIComponent(myPlace),{cache:"no-store"});
    if(!r.ok)throw new Error("status "+r.status);
    lastLive=await r.json();
    try{localStorage.setItem("bw-last:"+myPlace,JSON.stringify({...lastLive,receivedAt:Date.now()}));}catch(e){}
  }catch(e){
    if(lastLive)lastLive={...lastLive,serverNow:lastLive.serverNow+(Date.now()-(lastLive._t||Date.now()))};
  }
  if(lastLive)lastLive._t=Date.now();
  renderLive();
}
function renderLive(){
  if(!lastLive)return;
  const stale=lastLive.checkedAt==null||lastLive.serverNow-lastLive.checkedAt>FRESH_MS||lastLive.updatedAt==null||lastLive.serverNow-lastLive.updatedAt>FRESH_MS;
  const v=stale?{answer:"nodata",reason:{key:"stale",vars:{}},updatedAt:lastLive.updatedAt,etaMin:null}:lastLive;
  showAnswer(v,lastLive.serverNow);
  renderReportRow();
}
setInterval(()=>{if(document.visibilityState==="visible")pollStatus();},POLL_MS);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")pollStatus();});
```
In `renderAnswer()`, replace `showAnswer(babahaBa(demoInputs(p)));` with:
```js
  if(LIVE){if(lastLive&&lastLive.place===p.id)renderLive();else{showAnswer({answer:"nodata",reason:{key:"stale",vars:{}},updatedAt:null,etaMin:null});pollStatus();}}
  else showAnswer(babahaBa(demoInputs(p)));
```
At boot, after the `openWhere` check, add `if(LIVE){flushPending();pollStatus();}`.

- [ ] **Step 7: Run the tests**

Run: `python3 build_html.py && node test_report.js && node test_answer.js`
Expected: every line `ok`.

Run the existing suites as in Task 5 Step 8. Expected: `ALL GREEN`.

- [ ] **Step 8: Commit**

```bash
git add template.html test_report.js bahawatch_dashboard.html
git commit -m "Page: one-tap reports with Undo, Still there?, offline hold; live status from the Worker"
```

---

### Task 7: Details view — neighbours' reports on the map and in a log

Spec §4 *Display*: "The details view shows each report as a hollow diamond on the map (a shape no sensor uses) and a report log." The simple view's count in words is already the `reports` / `reports_few` reason from Task 1.

**Files:**
- Modify: `worker/src/api.js` (add `handleRecent`), `worker/src/index.js` (route), `template.html`
- Create: `worker/test/recent.test.js`
- Test: `test_recent.js` (new)

**Interfaces:**
- Consumes: `PLACES`, `json` (Task 3); `LIVE`, `API_BASE`, `REP_LANGS`, `setInterval` poll and `visibilitychange` hook (Task 6); existing page globals `DATA`, `W`, `H`, `VIEW`, `SITE`, `HOUSEHOLD`, `STATUS_COL`, `mapPal()`, `drawOverlayCanvas()`, `setView(v)`, `switchSite(id)`, `$`, `esc`.
- Produces:
  - `GET /recent/<site>` → `200 {serverNow, reports:[{lat, lon, answer, ageMin}]}` — this site's non-demo reports from the last 60 min, newest first, at most 200, **no ids and no device**, `cache-control: public, max-age=60`; unknown site → 404.
  - Page globals: `recentReports`, `pollRecent()`, `renderRecent()`, `lonLatToWorld(lon, lat) → {x, y}`, `drawnReports` (count drawn in the last overlay frame, for tests).

- [ ] **Step 1: Write the failing Worker test**

`worker/test/recent.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleRecent } from '../src/api.js';
import { envWith } from './fake-d1.js';

const NOW = Date.UTC(2026, 8, 26, 9, 0);
const add = (env, o) => env.DB.prepare('INSERT INTO reports(at,place,lat,lon,answer,device,demo) VALUES(?,?,?,?,?,?,?)')
  .bind(o.at ?? NOW - 12 * 60000, o.place ?? 'tv:s:BW-H01', 14.637, 121.062, o.answer ?? 'oo', 'a'.repeat(24), o.demo ?? 0).run();

test('recent: this site, last hour, real reports only, newest first, no device ids', async () => {
  const env = envWith();
  await add(env, {}); await add(env, { answer: 'hindi', at: NOW - 2 * 60000 });
  await add(env, { demo: 1 }); await add(env, { at: NOW - 61 * 60000 }); await add(env, { place: 'diliman:s:BW-D01' });
  const r = await handleRecent(new Request('https://api.test/recent/tv'), env, NOW, 'tv');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /max-age=60/);
  const b = await r.json();
  assert.deepEqual(b.reports, [{ lat: 14.637, lon: 121.062, answer: 'hindi', ageMin: 2 }, { lat: 14.637, lon: 121.062, answer: 'oo', ageMin: 12 }]);
  assert.ok(!JSON.stringify(b).includes('aaaa'), 'device id leaked');
});
test('recent: unknown site -> 404', async () => {
  assert.equal((await handleRecent(new Request('https://api.test/recent/xx'), envWith(), NOW, 'xx')).status, 404);
});
test('recent: routed at GET /recent/<site>', async () => {
  assert.equal((await worker.fetch(new Request('https://api.test/recent/tv'), envWith())).status, 200);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd worker && npm test`
Expected: FAIL — `handleRecent` is not exported (SyntaxError on the import).

- [ ] **Step 3: Implement `/recent/<site>`**

In `worker/src/api.js`, add `PLACES` to the import from `./geo.js` and append:
```js
export async function handleRecent(req, env, now, site) {
  if (!PLACES.sites[site]) return json({ error: 'unknown site' }, 404, env);
  const rows = (await env.DB.prepare('SELECT lat, lon, answer, at FROM reports WHERE demo=0 AND at>=? AND place LIKE ? ORDER BY at DESC LIMIT 200')
    .bind(now - 3600000, site + ':%').all()).results;
  const reports = rows.map((r) => ({ lat: r.lat, lon: r.lon, answer: r.answer, ageMin: Math.round((now - r.at) / 60000) }));
  return json({ serverNow: now, reports }, 200, env, { 'cache-control': 'public, max-age=60' });
}
```
In `worker/src/index.js`, add `handleRecent` to the import from `./api.js` and, before the final `return json({ error: 'not found' } …)`, add:
```js
    const rc = url.pathname.match(/^\/recent\/([a-z]+)$/);
    if (req.method === 'GET' && rc) return handleRecent(req, env, now, rc[1]);
```

- [ ] **Step 4: Run the Worker tests**

Run: `cd worker && npm test`
Expected: 27 tests pass (24 from Tasks 3–4, 3 recent), 0 fail.

- [ ] **Step 5: Write the failing page test**

`test_recent.js`:
```js
const {chromium}=require('playwright');
const {execSync}=require('child_process');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
execSync('BAHAWATCH_API=https://api.test.local TURNSTILE_SITEKEY=1x00000000000000000000AA OUT=/tmp/bw_live_test.html python3 build_html.py',{cwd:'/home/claude/work'});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{localStorage.setItem("bw-place:tv","tv:s:BW-H01");localStorage.setItem("bw-asked:tv","1");});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const SN=Date.UTC(2026,8,26,9,0);
  const recent={serverNow:SN,reports:[{lat:14.638,lon:121.060,answer:"oo",ageMin:4},{lat:14.642,lon:121.058,answer:"hindi",ageMin:12},{lat:14.644,lon:121.057,answer:"di_sigurado",ageMin:30}]};
  let recentHits=0;
  await pg.route('https://api.test.local/**',r=>{const u=r.request().url();
    if(/\/recent\/tv$/.test(u)){recentHits++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(recent)});}
    if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({place:"tv:s:BW-H01",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,updatedAt:SN-60000,checkedAt:SN-60000,serverNow:SN,stillThere:null})});
    return r.fulfill({status:404,body:'{}'});});
  // simple live view does not fetch the per-site report list
  await pg.goto('file:///tmp/bw_live_test.html#tv/live');await pg.waitForTimeout(500);
  assert(recentHits===0,"simple view: report list not fetched");
  // details + live: hash kept, list fetched, diamonds drawn, log filled
  await pg.goto('file:///tmp/bw_live_test.html#tv/details/live');await pg.waitForTimeout(700);
  let s=await pg.evaluate(()=>({live:LIVE,view:VIEW,hash:location.hash,drawn:drawnReports,items:[...document.querySelectorAll('#rep-log li')].map(li=>li.textContent),shown:!document.getElementById('rep-log-wrap').hidden}));
  assert(s.live&&s.view==="details"&&s.hash==="#tv/details/live","details + live parsed and kept in the hash: "+s.hash);
  assert(recentHits>=1&&s.drawn===3,"three reports drawn as diamonds: "+s.drawn);
  assert(s.shown&&s.items.length===3&&/4 min ago.*Yes/.test(s.items[0])&&/Not sure/.test(s.items[2]),"report log, newest first, with the answer: "+s.items.join(" | "));
  // a report at a sensor's own coordinate lands on that sensor's map position
  s=await pg.evaluate(()=>{const h=HOUSEHOLD[0],w=lonLatToWorld(h.lon,h.lat);return Math.hypot(w.x-h.x,w.y-h.y);});
  assert(s<1,"lon/lat → map position agrees with the sensors' positions (off by "+s.toFixed(2)+")");
  // an hour with no reports
  recent.reports=[];await pg.evaluate(()=>pollRecent());await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({drawn:drawnReports,t:document.getElementById('rep-log').textContent}));
  assert(s.drawn===0&&/No reports in the last hour/.test(s.t),"empty hour: no diamonds, and the log says so");
  // published demo page: no report log, no diamonds
  const pg2=await ctx.newPage();await pg2.goto('file:///home/claude/work/bahawatch_dashboard.html#tv/details');await pg2.waitForTimeout(400);
  s=await pg2.evaluate(()=>({hidden:document.getElementById('rep-log-wrap').hidden,drawn:drawnReports}));
  assert(s.hidden&&s.drawn===0,"demo page: no report log, no diamonds");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 6: Run it to verify it fails**

Run: `node test_recent.js`
Expected: FAIL — `drawnReports is not defined`.

- [ ] **Step 7: Implement the diamonds and the log**

Markup, right after the existing `<details class="log" open>…Event log…</details>`:
```html
    <details class="log" id="rep-log-wrap" open hidden>
      <summary>Neighbour reports, last hour (◇ on the map)</summary>
      <ul id="rep-log"></ul>
    </details>
```
CSS, next to the `#log-list` rules:
```css
#rep-log{list-style:none; padding:0 0 12px; font-size:12px; color:var(--ink-2); max-height:168px; overflow-y:auto}
#rep-log li{padding:4px 0; border-top:1px solid var(--line)}
#rep-log li:first-child{border-top:none}
#rep-log time{font-variant-numeric:tabular-nums; font-weight:600; color:var(--ink); margin-right:6px}
```
Script, after the live-status code from Task 6 (the details view is English-only, like the event log, so the words come from `REP_LANGS.en`):
```js
/* ---------- details view: neighbours' reports (spec §4 Display) ---------- */
let recentReports=[], drawnReports=0;
function lonLatToWorld(lon,lat){const b=DATA.bbox;return {x:(lon-b[0])/(b[2]-b[0])*W,y:(b[3]-lat)/(b[3]-b[1])*H};}
async function pollRecent(){
  if(!LIVE||VIEW==="public")return;
  try{const r=await fetch(API_BASE+"/recent/"+SITE,{cache:"no-store"});if(!r.ok)throw new Error("recent "+r.status);recentReports=(await r.json()).reports||[];}
  catch(e){}                                                  // keep the last list; the Worker's own freshness shows in the answer band
  renderRecent();drawOverlayCanvas();
}
function renderRecent(){
  const wrap=$("rep-log-wrap");wrap.hidden=!LIVE;if(!LIVE)return;
  const E=REP_LANGS.en;
  $("rep-log").innerHTML=recentReports.length
    ?recentReports.map(r=>`<li><time>${r.ageMin} min ago</time>${esc(E[r.answer]||r.answer)}</li>`).join("")
    :"<li>No reports in the last hour.</li>";
}
function drawReportDiamond(ctx,X,Y,col,P){            // hollow diamond: a shape no sensor uses
  const d=()=>{ctx.beginPath();ctx.moveTo(X,Y-8);ctx.lineTo(X+8,Y);ctx.lineTo(X,Y+8);ctx.lineTo(X-8,Y);ctx.closePath();};
  d();ctx.lineWidth=6;ctx.strokeStyle=P.labelHalo;ctx.stroke();
  d();ctx.lineWidth=2.5;ctx.strokeStyle=col;ctx.stroke();
}
```
In `drawOverlayCanvas()`, immediately before `for(const s of HOUSEHOLD){`, add:
```js
  drawnReports=0;
  if(VIEW!=="public"&&LIVE)for(const r of recentReports){
    const w=lonLatToWorld(r.lon,r.lat);
    drawReportDiamond(ctx,wx(w.x),wy(w.y),r.answer==="oo"?STATUS_COL.alert:r.answer==="hindi"?STATUS_COL.ok:P.label,P);drawnReports++;
  }
```
Hooks: at the end of `setView(v)` and of `switchSite(id)` add `recentReports=[];renderRecent();pollRecent();`. In Task 6's `setInterval(…POLL_MS)` callback and its `visibilitychange` handler, add `pollRecent();` after `pollStatus();`.

- [ ] **Step 8: Run the tests**

Run: `python3 build_html.py && node test_recent.js && node test_report.js && node test_answer.js && (cd worker && npm test)`
Expected: every line `ok`; Worker 27 pass.
Run the existing suites as in Task 5 Step 8. Expected: `ALL GREEN`.

- [ ] **Step 9: Commit**

```bash
git add worker/src worker/test template.html test_recent.js bahawatch_dashboard.html
git commit -m "Details view: neighbours' reports as hollow diamonds and a last-hour log (GET /recent/<site>)"
```

---

### Task 8: No accounts — share link, QR codes, Add to Home Screen, offline answer

**Files:**
- Modify: `template.html`
- Create: `tools/make_qr.py`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `qr/` (generated)
- Test: `test_noaccount.js` (new)

**Interfaces:**
- Consumes: `setPlace`, `currentPlace`, `placesForSite`, `LIVE`, `lastLive`, `renderLive`, `A()`.
- Produces: share token format `#p.<site>.<s|b>.<code>` (e.g. `#p.tv.s.BW-H01`, `#p.tv.b.PH1380403009`); `shareLink()`; `qr/<site>/<kind>-<code>.png` + `qr/index.csv` (`place_id,name,url,file`).

- [ ] **Step 1: Write the failing test**

`test_noaccount.js`:
```js
const {chromium}=require('playwright');
const fs=require('fs');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  // share link sets the place and skips the picker
  await pg.goto('file:///home/claude/work/bahawatch_dashboard.html#p.tv.s.BW-H05');await pg.waitForTimeout(500);
  let s=await pg.evaluate(()=>({my:myPlace,open:!document.getElementById('p-where').hidden,hash:location.hash,site:SITE}));
  assert(s.my==="tv:s:BW-H05"&&!s.open&&s.site==="tv","share link sets the place with no picking: "+JSON.stringify(s));
  assert(s.hash===""||s.hash==="#tv","share token is cleared from the address bar after use: "+s.hash);
  s=await pg.evaluate(()=>shareLink());
  assert(/#p\.tv\.s\.BW-H05$/.test(s),"shareLink() builds the same token: "+s);
  // share button exists, labelled in the current language, 48 px
  s=await pg.evaluate(()=>{const e=document.getElementById('p-share');return {t:e.textContent,h:e.getBoundingClientRect().height,hid:e.hidden};});
  assert(!s.hid&&s.h>=44&&/Share my place|Ibahagi/.test(s.t),"Share my place button: "+s.t);
  // unknown token falls back to the picker
  await pg.evaluate(()=>{localStorage.clear();});
  await pg.goto('file:///home/claude/work/bahawatch_dashboard.html#p.tv.b.NOPE');await pg.reload();await pg.waitForTimeout(500);
  s=await pg.evaluate(()=>({my:myPlace,open:!document.getElementById('p-where').hidden}));
  assert(s.my===null&&s.open,"unknown share token -> Saan ka?");
  // manifest and service worker registration guard
  s=await pg.evaluate(()=>({m:document.querySelector('link[rel=manifest]')?.getAttribute('href'),ic:document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href')}));
  assert(s.m==="manifest.webmanifest"&&s.ic==="icon-192.png","manifest and touch icon linked");
  const man=JSON.parse(fs.readFileSync('/home/claude/work/manifest.webmanifest','utf8'));
  assert(man.start_url==="./"&&man.display==="standalone"&&man.icons.length===2,"manifest: standalone, two icons");
  assert(fs.existsSync('/home/claude/work/sw.js')&&/bahawatch_dashboard\.html/.test(fs.readFileSync('/home/claude/work/sw.js','utf8')),"service worker caches the page");
  // offline: last live answer shown with its age; turns nodata after 20 min
  s=await pg.evaluate(()=>{const now=Date.now();
    LIVE=true;myPlace="tv:s:BW-H01";
    localStorage.setItem("bw-last:tv:s:BW-H01",JSON.stringify({place:"tv:s:BW-H01",answer:"baka",reason:{key:"reports_few",vars:{n:2}},etaMin:null,updatedAt:now-5*60000,checkedAt:now-4*60000,serverNow:now-4*60000,stillThere:null,receivedAt:now-4*60000}));
    lastLive=null;restoreLast();return document.getElementById('p-answer').dataset.answer;});
  assert(s==="baka","offline: last answer restored from the phone");
  s=await pg.evaluate(()=>{const now=Date.now();
    localStorage.setItem("bw-last:tv:s:BW-H01",JSON.stringify({place:"tv:s:BW-H01",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,updatedAt:now-30*60000,checkedAt:now-30*60000,serverNow:now-30*60000,stillThere:null,receivedAt:now-30*60000}));
    lastLive=null;restoreLast();return document.getElementById('p-answer').dataset.answer;});
  assert(s==="nodata","offline: a stored Hindi older than 20 min shows as nodata");
  // QR files
  const idx=fs.readFileSync('/home/claude/work/qr/index.csv','utf8').trim().split('\n');
  assert(idx[0]==="place_id,name,url,file"&&idx.length>20,"QR index lists every place");
  const row=idx.find(l=>l.startsWith('tv:s:BW-H01,'));
  assert(row&&/#p\.tv\.s\.BW-H01,/.test(row)&&fs.existsSync('/home/claude/work/'+row.split(',').pop()),"QR for BW-H01 exists and points at its share link");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python3 build_html.py && node test_noaccount.js`
Expected: FAIL on the first assertion (`myPlace` is `null`).

- [ ] **Step 3: Share token in the router and the Share button**

In `parseHash()`, before the existing split, add:
```js
  const tok=(location.hash||"").match(/^#p\.([a-z]+)\.(s|b)\.([A-Za-z0-9-]+)$/);
  if(tok&&DATA_ALL[tok[1]]){SHARED_PLACE=tok[1]+":"+tok[2]+":"+tok[3];return {site:tok[1],view:"public"};}
```
Declare `let SHARED_PLACE=null;` next to `let LIVE=false`. In the boot block, right after `initSite(h0.site)` and before the `openWhere` check, add:
```js
if(SHARED_PLACE){if(placesForSite().some(p=>p.id===SHARED_PLACE)){myPlace=SHARED_PLACE;try{localStorage.setItem(siteKey("bw-place"),myPlace);localStorage.setItem(siteKey("bw-asked"),"1");}catch(e){}}
  else{try{localStorage.removeItem(siteKey("bw-asked"));}catch(e){}}SHARED_PLACE=null;}
```
(`writeHash()` then rewrites the address bar to the normal form.)

Add `shareLink()`:
```js
function shareLink(){const p=currentPlace();if(!p)return location.href.split("#")[0];
  return location.href.split("#")[0]+"#p."+p.id.split(":").join(".");}
```
Markup: inside `#p-answer`, after `#p-ans-pick`, add `<button class="p-link p-share" id="p-share" hidden></button>`. CSS: `.p-share{margin-top:8px; min-height:44px}`. Strings — add to every language in `ANS_LANGS`: `share` and `copied`:
en `share:"Share my place",copied:"Link copied"` · fil `"Ibahagi ang lugar ko","Nakopya ang link"` · ceb `"Ipakigbahin ang akong lugar","Nakopya ang link"` · ilo `"Iranud ti lugarko","Nakopia ti link"` · hil `"Ipaambit ang akon lugar","Nakopya ang link"` · pam `"Ibahagi me ing lugal ku","Me-kopya ne ing link"`.
In `renderAnswer()`, add: `const sh=$("p-share");sh.textContent=L.share;sh.hidden=!p;`. Handler:
```js
$("p-share").addEventListener("click",async()=>{
  const url=shareLink();
  if(navigator.share){try{await navigator.share({title:"BahaWatch",url});return;}catch(e){}}
  try{await navigator.clipboard.writeText(url);$("p-share").textContent=A().copied;}catch(e){window.prompt(A().share,url);}   // no share sheet, no clipboard (old browsers): show the link to copy by hand
});
```

- [ ] **Step 4: Offline last answer**

Add after `renderLive()`:
```js
function restoreLast(){
  if(!myPlace)return;
  let s=null;try{s=JSON.parse(localStorage.getItem("bw-last:"+myPlace)||"null");}catch(e){}
  if(!s)return;
  const elapsed=Date.now()-s.receivedAt;
  lastLive={...s,serverNow:s.serverNow+elapsed,_t:Date.now()};
  renderLive();
}
```
At boot, change `if(LIVE){flushPending();pollStatus();}` to `if(LIVE){restoreLast();flushPending();pollStatus();}`.

- [ ] **Step 5: Manifest, icons, service worker**

Icons: `python3 -c "from PIL import Image; im=Image.open('logo.png').convert('RGBA'); [im.resize((n,n),Image.LANCZOS).save(f'icon-{n}.png') for n in (192,512)]"`

`manifest.webmanifest`:
```json
{
  "name": "BahaWatch",
  "short_name": "BahaWatch",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#232120",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`sw.js`:
```js
// Offline shell: the page opens without signal and shows the last answer with its age (spec §5).
const CACHE = 'bahawatch-v1';
const SHELL = ['./', 'index.html', 'bahawatch_dashboard.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;          // API calls: network only
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((m) => m || caches.match('bahawatch_dashboard.html'))));
});
```
In `template.html` `<head>`, add:
```html
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="theme-color" content="#232120">
```
At the end of the boot block:
```js
if("serviceWorker" in navigator&&location.protocol==="https:"){navigator.serviceWorker.register("sw.js").catch(()=>{});}
```

- [ ] **Step 6: QR codes**

`tools/make_qr.py`:
```python
#!/usr/bin/env python3
"""One QR code per place, pointing at its share link (spec §5). python3 tools/make_qr.py [base_url]"""
import csv, json, os, sys, qrcode
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://gregor-posadas.github.io/bahawatch/"
P = json.load(open(os.path.join(ROOT, "places.json"), encoding="utf-8"))
out = os.path.join(ROOT, "qr"); os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "index.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["place_id", "name", "url", "file"])
    for site, places in P["sites"].items():
        os.makedirs(os.path.join(out, site), exist_ok=True)
        for p in places:
            site_, kind, code = p["id"].split(":")
            url = BASE + "#p." + ".".join((site_, kind, code))
            rel = f"qr/{site}/{kind}-{code}.png"
            qrcode.make(url, box_size=10, border=4).save(os.path.join(ROOT, rel))
            w.writerow([p["id"], p["name"], url, rel])
print("QR codes written to qr/")
```
Run: `pip install --break-system-packages -q qrcode && python3 tools/make_qr.py`

- [ ] **Step 7: Run the tests**

Run: `python3 build_html.py && node test_noaccount.js && node test_report.js && node test_answer.js`
Expected: every line `ok`. Then the existing suites as in Task 5 Step 8: `ALL GREEN`.

- [ ] **Step 8: Commit**

```bash
git add template.html test_noaccount.js tools/make_qr.py qr manifest.webmanifest sw.js icon-192.png icon-512.png bahawatch_dashboard.html
git commit -m "No accounts: share link, QR per place, Add to Home Screen, offline last answer"
```

---

### Task 9: Deploy runbook, docs, publish

**Files:**
- Create: `worker/README.md`
- Modify: `README.md`, `worker/wrangler.toml` (database id)

**Interfaces:**
- Consumes: everything above.
- Produces: a deployed Worker at `https://bahawatch-api.<account>.workers.dev`, the live page at `https://gregor-posadas.github.io/bahawatch/#tv/live`, updated demo artifact.

- [ ] **Step 1: Write the runbook**

`worker/README.md`:
````markdown
# BahaWatch API (Cloudflare Worker)

Free tier: Workers, D1, Turnstile. No card needed for these three.

## One-time setup (Gregor, Windows PowerShell)
1. Create a free account at https://dash.cloudflare.com/sign-up (email only).
2. Turnstile: Dashboard → Turnstile → Add widget → name "BahaWatch", hostname `gregor-posadas.github.io`,
   widget mode **Invisible**. Copy the **site key** and **secret key**.
3. In the repo folder:
   ```powershell
   cd worker
   npm install
   npx wrangler login
   npx wrangler d1 create bahawatch      # copy the database_id it prints into wrangler.toml
   npx wrangler d1 migrations apply bahawatch --remote
   npx wrangler secret put TURNSTILE_SECRET   # paste the Turnstile secret key
   npx wrangler secret put DEVICE_KEYS        # paste {} until sensor units exist
   npx wrangler deploy                        # prints https://bahawatch-api.<you>.workers.dev
   ```
4. Build the live page with the two public values:
   ```powershell
   $env:BAHAWATCH_API="https://bahawatch-api.<you>.workers.dev"; $env:TURNSTILE_SITEKEY="<site key>"; python build_html.py
   ```
   Commit and push; GitHub Pages redeploys in about a minute.

## Endpoints
- `GET /status/<place>` → the answer for one place (cached 60 s)
- `GET /recent/<site>` → last hour's real reports for the details map: rounded position, answer, age; no ids (cached 60 s)
- `POST /report` → one-tap report (Turnstile token required)
- `POST /report/<id>/undo` → within 15 s, same phone
- `POST /ingest` → sensor unit reading, `Authorization: Bearer <device key>`
- `POST /subscribe` → 501 until alerts are switched on (round two)

## Tests
`npm test` (Node 22; uses node:sqlite as a stand-in for D1).
````

- [ ] **Step 2: STOP — Gregor's account steps**

Deploying creates resources on Gregor's Cloudflare account and publishes to his GitHub; both are his to approve. Send Gregor `worker/README.md` steps 1–3 and wait. When he returns the Worker URL, the database id and the Turnstile site key: put the database id into `worker/wrangler.toml`, run the step 4 build with his values, and commit.

- [ ] **Step 3: Verify the live Worker**

Run (container): `curl -s https://bahawatch-api.<you>.workers.dev/status/tv:s:BW-H01`
Expected: JSON with `"answer"` and a `checkedAt` within the last 5 minutes (after the first cron run). If the shell cannot reach the host, open the URL through WebFetch instead.

- [ ] **Step 4: README**

Add a section `## 6.6 Babaha ba?, reports and no accounts` to `README.md` covering: the rule (link the flowchart artifact), `places.json` and how to rebuild it (`python3 tools/build_places.py`, barangays via `tools/extract_barangays.py`), demo vs live (`#tv` vs `#tv/live`, `#tv/details/live` for the report map and log), the Worker (`worker/README.md`), the share-token format and `qr/`, what is stored and for how long, and the review flags on the four regional languages. Add the new tests to the file table in §1.

- [ ] **Step 5: Full check, publish, package**

```bash
node --test shared/ && (cd worker && npm test) && python3 tools/test_places.py && bash test_build.sh \
 && for f in test_init test_tabs test_sites test_public test_figure test_car test_answer test_report test_recent test_noaccount; do node $f.js | grep -E "FAIL" && exit 1; done; echo ALL GREEN
```
Expected: `ALL GREEN`.
Then rebuild the demo page without API values (`python3 build_html.py`), republish the artifact at `https://claude.ai/artifact/Mjsm9genvWF9sFdXxuKis9`, rebuild the package zip, make the PDF of this plan and the spec (`python3 tools/md_to_pdf.py <md> <pdf>`), commit, and re-export the git bundle for Gregor to push.

```bash
git add README.md worker/README.md worker/wrangler.toml bahawatch_dashboard.html
git commit -m "Deploy runbook and docs for Babaha ba?, reports and no accounts"
```
