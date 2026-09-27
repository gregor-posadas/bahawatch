# "Try reporting" Tab and Reports-Only Cap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone on the GitHub Pages site try neighbour reporting in a "Try reporting" tab — one phone, pretend neighbours, one pretend sensor — and change the rule so that reports alone can raise the answer to Baka at most.

**Architecture:**
- The rule change lives in the shared `shared/verdict.js`, which the page inlines and the parked Worker imports.
- The tab is a fourth entry in the existing site-tab row. It is a local mode (`TRY`) of the existing simple view, like the existing `LIVE` mode. It reuses:
  - the answer band, report row and map canvas;
  - `drawReportDiamond` and the `showAnswer` announcer;
  - `liveSimple()` for hiding the simulated storm.
- Tab state lives in memory, and the tab makes no network calls.

**Tech Stack:**
- Vanilla JS/CSS in the single-file page `template.html`, built by `python3 build_html.py`.
- Node 22 `node:test` for the rule and the Worker.
- Playwright with Chromium at `/opt/pw-browsers/chromium` (`--no-sandbox`) for page tests.

**Spec:** `docs/superpowers/specs/2026-09-26-try-reporting-tab-design.md` (builds on `docs/superpowers/specs/2026-09-26-babaha-ba-reports-no-accounts-design.md`)

## Global Constraints

- **Page source:** `template.html` is the only page source. Rebuild with `python3 build_html.py` (demo build: no `BAHAWATCH_API`) and commit `bahawatch_dashboard.html` with it.
- **Rule:** reports alone may raise the answer to **Baka** at most. Only check 2 (sensors) may produce **Oo**.
  - 3+ "Yes" phones → Baka with reason `reports` (`{n}`).
  - With a dry, steady sensor within 500 m → Baka with reason `reports_vs_dry_sensor`.
- **Tab identity:**
  - Label "Try reporting", placed after UC Berkeley.
  - Link `#try`.
  - Fixed place **22 Malingap Street** (`tv:s:BW-H03`, sensor `BW-H03`).
- **Pretend neighbours:** at most **8**, at fixed spots within about 300 m of the place.
- **Sensor switch:** dry / 3 cm / 20 cm, with rate 0. No rain (0 mm/h).
- **No network:** nothing in the tab calls the network. The label "Simulation — nothing leaves this page." is shown.
- **State:** in memory only. A reload starts fresh, and the tab never writes `bw-place:*`, `bw-street:*` or `bw-asked:*`.
- **Languages:** every new string exists in en, fil, ceb, ilo, hil and pam. The four regional languages keep the page's existing review flag.
- **Accessibility:**
  - Buttons ≥ 48 px tall.
  - Contrast ≥ 4.5:1 in light and dark themes.
  - Answer changes are announced once, through the existing `#p-ans-announce`.
  - The map's diamonds are repeated as a text list.
- **Layout:**
  - Desktop: the phone on the left; the map, controls, explanation line and list on the right.
  - ≤ 1100 px: phone, then controls, then explanation, then map, then list.
  - No horizontal scroll at 390 px.
- **Existing suites stay green:**
  - `node --test shared/*.test.js`
  - `(cd worker && npm test)`
  - `python3 tools/test_places.py`
  - `bash test_build.sh`
  - `node` on each of `test_init test_tabs test_sites test_public test_figure test_car test_answer test_report test_recent test_noaccount`
  - Capture stderr: failures print lines starting with `FAIL` on stderr.
- **Commits:** the repo config already authors as Gregor. Put the trailers in a separate `-m`:
  `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + newline + `Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"`.

## Review Focus

1. **Leaving the tab must restore the demo exactly.** That means the storm playing, the person's own place and street list, and the map back in the street list's column. The tab must never overwrite their stored place. Test in Task 2.
2. **A `#try` link or reload opens the tab directly**, with no "Saan ka?" dialog and no storm playing. Test in Task 2.
3. **Pressing Details (or the details view's own tab row) while in the tab leaves it cleanly**, with no panel left showing and the map in the details layout. Test in Task 2.
4. **Switching language inside the tab updates every string** — the phone, the controls, the explanation and the list — with no English left behind. Test in Task 3.
5. **Phone-width layout (390 px) and dark theme:**
   - Order is phone, then controls, then map.
   - No horizontal scroll.
   - All text in the phone and the panel ≥ 4.5:1 contrast.

   Test in Task 3.

## File map

| File | Responsibility | Task |
|---|---|---|
| `shared/verdict.js`, `shared/verdict.test.js` | Reports-only cap; the multi-sensor fix | 1 |
| `worker/test/cron.test.js` | Expectation update for the cap (the Worker code itself is unchanged) | 1 |
| `docs/superpowers/specs/2026-09-26-babaha-ba-reports-no-accounts-design.md`, `docs/superpowers/specs/2026-09-26-babaha-ba-flowchart.html`, `README.md` (§6.6 rule list) | Rule text matches the code | 1 |
| `template.html` | The Try tab: markup, CSS, `TRY` mode, strings, map drawing, routing; the demo-page link | 2, 3 |
| `test_try.js` (new) | Playwright tests for the tab | 2, 3 |
| `README.md` | New §6.7 "Try reporting" + the test file table | 3 |

---

### Task 1: The rule — reports alone cap at Baka; several sensors "here" all count

**Files:**
- Modify: `shared/verdict.js` (the `here` selection block and the reports block)
- Modify: `shared/verdict.test.js`
- Modify: `worker/test/cron.test.js:27`
- Modify: `docs/superpowers/specs/2026-09-26-babaha-ba-reports-no-accounts-design.md` (§3 item 3)
- Modify: `docs/superpowers/specs/2026-09-26-babaha-ba-flowchart.html`
- Modify: `README.md` (§6.6 rule item 5)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `babahaBa(x)` keeps its signature and return shape.
  - Report-only inputs now return `answer:'baka'` with reason `reports` or `reports_vs_dry_sensor` and vars `{n}`.
  - With several `here` sensors, the three sensor tests below use the right sensor for each:
    - **wet now:** the deepest sensor;
    - **wet soon:** the soonest to reach 5 cm;
    - **trace:** the deepest.

- [ ] **Step 1: Write the failing tests**

In `shared/verdict.test.js`, replace the two report tests (`'reports: 3 phones -> oo; 2 phones -> baka reports_few'` and `'reports vs dry sensor: …'`) with:

```js
test('reports alone cap at baka: 3, 5 and 8 phones -> baka reports; 2 -> baka reports_few', () => {
  for (const n of [3, 5, 8]) {
    const v = run({ reports: { yesPhones: n, newestAt: NOW - MIN } });
    assert.equal(v.answer, 'baka'); assert.equal(v.reason.key, 'reports'); assert.deepEqual(v.reason.vars, { n });
  }
  const b = run({ reports: { yesPhones: 2, newestAt: NOW - MIN } });
  assert.equal(b.answer, 'baka'); assert.equal(b.reason.key, 'reports_few');
});
test('reports vs dry sensor: dry+steady within 500 m -> baka reports_vs_dry_sensor; at 600 m or rising -> baka reports', () => {
  const rep = { yesPhones: 3, newestAt: NOW - MIN };
  const dry = (o) => sensor({ id: 'S3', here: false, distM: 400, depthCm: 0, rateCmPerHr: 0, ...o });
  const a = run({ reports: rep, sensors: [dry()] });
  assert.equal(a.answer, 'baka'); assert.equal(a.reason.key, 'reports_vs_dry_sensor');
  assert.equal(run({ reports: rep, sensors: [dry({ distM: 600 })] }).reason.key, 'reports');
  assert.equal(run({ reports: rep, sensors: [dry({ rateCmPerHr: 0.5 })] }).reason.key, 'reports');
  assert.equal(run({ reports: rep, sensors: [dry({ distM: 600 })] }).answer, 'baka');
});
test('only a sensor makes oo: wet sensor here plus 5 reports -> oo sensor_now', () => {
  const v = run({ reports: { yesPhones: 5, newestAt: NOW - MIN }, sensors: [sensor({ depthCm: 20 })] });
  assert.equal(v.answer, 'oo'); assert.equal(v.reason.key, 'sensor_now');
});
test('several sensors here: a slowly rising dry one never hides a 4 cm trace on another', () => {
  const slow = sensor({ id: 'S1', name: 'Slow St', depthCm: 0, rateCmPerHr: 0.1 });
  const trace = sensor({ id: 'S2', name: 'Trace St', depthCm: 4, rateCmPerHr: 0 });
  for (const order of [[slow, trace], [trace, slow]]) {
    const v = run({ sensors: order });
    assert.equal(v.answer, 'baka'); assert.equal(v.reason.key, 'sensor_trace'); assert.equal(v.reason.vars.name, 'Trace St');
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/claude/work && node --test shared/*.test.js 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: FAIL. `reports alone cap` fails with `'oo' !== 'baka'`, and `several sensors here` fails with `'hindi' !== 'baka'`.

- [ ] **Step 3: Implement**

In `shared/verdict.js`, replace the block from the comment `// A place can have several sensors "here"` through the end of the `if (here) { … }` block with:

```js
  // A place can have several sensors "here" (a barangay with sensors inside it). Each test looks at the sensor
  // that matters for it: wet now → the deepest; wet soon → the soonest to reach WET_CM; trace → the deepest.
  const hereS = live.filter((s) => s.here);
  const deepest = hereS.reduce((a, s) => (!a || s.depthCm > a.depthCm ? s : a), null);
  if (deepest && deepest.depthCm >= RULE.WET_CM) return out('oo', 'sensor_now', { name: deepest.name, cm: Math.round(deepest.depthCm) });
  const soonest = hereS.reduce((a, s) => { const t = minutesToWet(s); return !a || t < a.t ? { s, t } : a; }, null);
  if (soonest && soonest.t <= RULE.LOOKAHEAD_MIN) {
    return out('oo', 'sensor_soon', { name: soonest.s.name, min: roundEta(soonest.t) }, roundEta(soonest.t));
  }
```

Replace the reports block:

```js
  const yes = reports.yesPhones || 0;
  if (yes >= RULE.REPORTS_YES) {
    // Reports alone never say "Oo" (anyone can make new phone ids): 3+ phones is Baka, with the count in the reason.
    const dry = live.some((s) => s.distM <= RULE.DRY_SENSOR_M && s.depthCm < RULE.TRACE_CM && !(s.rateCmPerHr > 0));
    return out('baka', dry ? 'reports_vs_dry_sensor' : 'reports', { n: yes });
  }
```

Replace the trace line near the end:

```js
  if (deepest && deepest.depthCm >= RULE.TRACE_CM) return out('baka', 'sensor_trace', { name: deepest.name, cm: Math.round(deepest.depthCm) });
```

(The variable `here` no longer exists. `grep -n "\bhere\b" shared/verdict.js` must show only property accesses `s.here`.)

- [ ] **Step 4: Run the rule tests**

Run: `node --test shared/*.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 20` and `# fail 0` (18 before; 2 tests replaced and 2 added).

- [ ] **Step 5: Update the Worker expectation and run the Worker tests**

In `worker/test/cron.test.js` line 27, change:
```js
  assert.equal(s.answer, 'oo'); assert.deepEqual(s.reason, { key: 'reports', vars: { n: 3 } });
```
to:
```js
  assert.equal(s.answer, 'baka'); assert.deepEqual(s.reason, { key: 'reports', vars: { n: 3 } });   // reports alone cap at Baka
```

Run: `cd worker && npm test 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: `# pass 46`, `# fail 0`. If any other test fails because it expected `oo` from reports only, change that single expectation to `baka` in the same way and note it in the report. Do not change a test whose `oo` comes from a sensor.

- [ ] **Step 6: Make the docs match**

In the original spec (`docs/superpowers/specs/2026-09-26-babaha-ba-reports-no-accounts-design.md`), replace item 3 of §3 with:
```markdown
3. **Reports.** 3 or more "Yes" reports from different phones within 1 km in the last
   hour → **Baka** ("N neighbours report flooding"), or **Baka** with "Neighbours report
   flooding; sensor here is dry" when a sensor within 500 m is dry and steady. Reports
   alone never say **Oo** (spam protection, decided 2026-09-26); only check 2 does.
```

In `README.md` §6.6, replace rule item 5 with:
```markdown
5. **`REPORTS_YES`** (3) distinct phones reporting "Oo" within `REPORT_RADIUS_M`
   (1 km) in the last hour → `baka` with reason `reports` ("N neighbours report
   flooding"), or `reports_vs_dry_sensor` when a sensor within `DRY_SENSOR_M`
   (500 m) is dry with no rise. Reports alone never produce `oo`; only a sensor does.
```

In `docs/superpowers/specs/2026-09-26-babaha-ba-flowchart.html`:
1. In the `<desc id="d">` text, replace `answer Baka if a sensor within 500 m is dry and steady, otherwise Oo.` with `answer Baka (reports alone never say Oo; the reason says how many, or that a nearby sensor is dry).`
2. In the list item at line ~193, replace `say <b>Baka</b> if a sensor within 500 m is dry and steady, otherwise say <b>Oo</b>.` with `say <b>Baka</b>. Reports alone never say <b>Oo</b>; only a sensor can.`
3. In the SVG, replace everything from `<!-- Q3b dry sensor -->` up to (not including) `<!-- Q4 conditions -->`, and the Q3 "YES" arrow line just above it (`<line class="ln" x1="240" y1="406" x2="240" y2="446" …/>` and its `YES` label), with:
```html
  <path class="ln" d="M240 406 V494 H548" marker-end="url(#ah)"/>
  <text class="yl" x="250" y="430">YES</text>
  <text class="sm" x="258" y="462">Reports alone never say Oo (spam protection).</text>
  <text class="sm" x="258" y="480">The reason names the count, or says a nearby sensor is dry.</text>
```
Then render the file to a PNG to check for overlaps:
```bash
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1100,height:1400}});await p.goto('file:///home/claude/work/docs/superpowers/specs/2026-09-26-babaha-ba-flowchart.html');await p.screenshot({path:'/tmp/flow.png',fullPage:true});await b.close();})()"
```
Look at `/tmp/flow.png`. The CHECK 3 YES arrow must end at the Baka box, no text may overlap another element, and no arrow may lead from CHECK 3 to Oo. If the two note lines collide with the CHECK 4 label, move them up or down by up to 20 px.

- [ ] **Step 7: Rebuild the page, run every suite, and commit**

```bash
cd /home/claude/work && python3 build_html.py && node --test shared/*.test.js 2>&1 | grep -E "^# (pass|fail)" && (cd worker && npm test 2>&1 | grep -E "^# (pass|fail)") && bash test_build.sh 2>&1 | grep -c "^ok" && for f in test_init test_tabs test_sites test_public test_figure test_car test_answer test_report test_recent test_noaccount; do node $f.js 2>&1 | grep -E "^FAIL" && echo "FAIL in $f"; done; echo DONE
```
Expected: shared 20 pass, worker 46 pass, build 4, no `FAIL` lines.
```bash
git add shared worker/test/cron.test.js docs/superpowers/specs/2026-09-26-babaha-ba-reports-no-accounts-design.md docs/superpowers/specs/2026-09-26-babaha-ba-flowchart.html README.md bahawatch_dashboard.html
git commit -m "Rule: reports alone cap at Baka; every sensor here counts (deepest / soonest)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 2: The "Try reporting" tab — routing, phone, controls, map, list

**Files:**
- Modify: `template.html`, in these places:
  - the markup of both `.site-tabs` navs;
  - `#public` (after its tab nav);
  - `#p-status` (after `</figure>` of `#p-fig`);
  - `#p-rep` (after `#p-rep-undo`);
  - CSS (append at the end of the `<style>` element);
  - JS: `liveSimple`, `resetView`, `currentPlace`, `showAnswer`, `renderAnswer`, `renderReportRow`, `sendReport`, the Undo handler, `drawOverlayCanvas`, `renderPublic`, `switchSite`, `parseHash`, `writeHash`, `syncTabs`, the tab click handler, the `hashchange` handler, the `#p-details` handler and boot.
- Create: `test_try.js`

**Interfaces:**
- Consumes (existing page globals):
  - `PLACES`, `HOUSEHOLD`, `SITE`, `VIEW`, `LIVE`, `LANG`;
  - `A()`, `R()`, `fill`, `esc`, `addr`, `babahaBa`, `RULE`, `statusOf`;
  - `showAnswer(v, serverNow)`, `repMsg(text, undoId)`;
  - `drawMarker(ctx,X,Y,R,status,col,P,bold)`, `drawReportDiamond(ctx,X,Y,col,P)`, `lonLatToWorld(lon,lat)`, `STATUS_COL`, `mapPal()`;
  - `zoomTo(x,y,z)`, `resize()`, `setPlay(p)`, `setView(v)`, `switchSite(id)`, `syncTabs()`, `writeHash()`, `renderPublic()`, `drawOverlayCanvas()`;
  - `drawnReports`, `mapDrawn`.
- Produces (page globals used by Task 3 and tests):
  - `TRY` (boolean);
  - `TRY_PLACE="tv:s:BW-H03"`, `TRY_SENSOR="BW-H03"`, `TRY_MAX_NEIGHBOURS=8`, `TRY_SPOTS`;
  - `tryState={mine, neighbours, sensorCm}`;
  - `tryInputs()`, `tryReports()`, `tryYes()`, `tryReport(answer)`, `tryUndo()`, `tryAdd(answer)`, `trySetSensor(cm)`, `tryReset()`;
  - `enterTry()`, `exitTry(nextSite)`, `selectTab(key)`, `syncTryUI()`, `renderTry(v)`;
  - `TRY_LANGS`, `TL()`.
  - Element ids: `try-sim`, `try-panel`, `try-map`, `try-ctrls`, `try-add-oo`, `try-add-hindi`, `try-sensor-l`, `try-reset`, `try-full`, `try-why`, `try-log-h`, `try-log`, `p-try-link`.

- [ ] **Step 1: Write the failing test**

Create `test_try.js`:

```js
const {chromium}=require('playwright');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U='file:///home/claude/work/bahawatch_dashboard.html';
const ans=pg=>pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,k:document.getElementById('p-ans-reason').textContent,why:document.getElementById('try-why').textContent}));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");localStorage.setItem("bw-lang:tv","en");localStorage.setItem("bw-place:tv","tv:s:BW-H07");localStorage.setItem("bw-street:tv","BW-H07");localStorage.setItem("bw-asked:tv","1");}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const net=[];pg.on('request',r=>{const u=r.url();if(!u.startsWith('file:')&&!u.startsWith('data:'))net.push(u);});
  await pg.goto(U);await pg.waitForTimeout(400);
  let s=await pg.evaluate(()=>[...document.querySelectorAll('#public .site-tabs [role=tab]')].map(t=>t.dataset.site));
  assert(s.join()==="tv,diliman,berkeley,try","fourth tab 'Try reporting' after UC Berkeley: "+s);
  await pg.focus('#public .site-tabs [data-site="berkeley"]');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({t:TRY,hash:location.hash,sel:document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site,place:document.getElementById('p-ans-place').textContent,playing,panel:!document.getElementById('try-panel').hidden,sim:document.getElementById('try-sim').textContent,where:document.getElementById('p-where').hidden}));
  assert(s.t&&s.hash==="#try"&&s.sel==="try","keyboard: ArrowRight from UC Berkeley opens the Try reporting tab (#try)");
  assert(/22 Malingap/.test(s.place)&&!s.playing&&s.panel&&s.where&&/nothing leaves this page/i.test(s.sim),"fixed place 22 Malingap Street, storm stopped, controls and simulation label shown, no Saan ka?");
  s=await ans(pg);
  assert(s.a==="hindi","start: dry sensor, no reports -> Hindi ("+s.k+")");
  await pg.click('#p-rep [data-ans="oo"]');await pg.waitForTimeout(150);
  s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,msg:document.getElementById('p-rep-msg').textContent,undo:!document.getElementById('p-rep-undo').hidden,d:drawnReports,log:[...document.querySelectorAll('#try-log li')].map(l=>l.textContent)}));
  assert(s.a==="baka"&&/Thanks/.test(s.msg)&&s.undo,"your Yes -> Baka, 'Thanks, recorded.' with Undo");
  assert(s.d===1&&s.log.length===1&&/^You: Yes$/.test(s.log[0]),"your report is a diamond on the map and a line in the list: "+s.log);
  await pg.click('#p-rep-undo');await pg.waitForTimeout(150);
  s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,d:drawnReports,m:tryState.mine}));
  assert(s.a==="hindi"&&s.d===0&&s.m===null,"Undo removes your report and its diamond");
  await pg.click('#p-rep [data-ans="oo"]');await pg.click('#try-add-oo');await pg.click('#try-add-oo');await pg.waitForTimeout(150);
  s=await ans(pg);
  assert(s.a==="baka"&&/sensor here is dry/.test(s.k),"3 phones say Yes, sensor dry -> Baka, reason names the dry sensor: "+s.k);
  assert(/^3 phones say .Yes. within 1 km · sensor dry · no rain → Maybe/.test(s.why)&&/can.t say .Yes./.test(s.why),"explanation line: "+s.why);
  await pg.click('#try-ctrls [data-cm="3"]');await pg.waitForTimeout(100);
  s=await ans(pg);
  assert(s.a==="baka"&&/^3 neighbours report flooding/.test(s.k)&&/sensor 3 cm/.test(s.why),"sensor 3 cm -> still Baka, '3 neighbours report flooding': "+s.k);
  await pg.click('#try-ctrls [data-cm="20"]');await pg.waitForTimeout(100);
  s=await ans(pg);
  assert(s.a==="oo"&&/20 cm/.test(s.k)&&!/can.t say/.test(s.why),"sensor 20 cm -> Oo from the sensor");
  s=await pg.evaluate(()=>({q:document.getElementById('p-rep-q').textContent,p:[...document.querySelectorAll('#try-ctrls [data-cm]')].map(x=>x.getAttribute('aria-pressed')).join()}));
  assert(/still there/i.test(s.q)&&s.p==="false,false,true","a neighbour's Yes turns the question into 'still there?'; the sensor switch shows 20 cm pressed");
  await pg.click('#try-add-hindi');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({n:document.querySelectorAll('#try-log li').length,d:drawnReports,a:document.getElementById('p-answer').dataset.answer}));
  assert(s.n===4&&s.d===4&&s.a==="oo","a neighbour's No is recorded on the map and in the list");
  await pg.evaluate(()=>{for(let i=0;i<10;i++)document.getElementById('try-add-oo').click();});await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({n:tryState.neighbours.length,dis:document.getElementById('try-add-oo').disabled&&document.getElementById('try-add-hindi').disabled,full:document.getElementById('try-full').textContent}));
  assert(s.n===8&&s.dis&&/8/.test(s.full),"at most 8 pretend neighbours; the add buttons disable and say why");
  await pg.click('#try-reset');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,d:drawnReports,n:tryState.neighbours.length,m:tryState.mine,cm:tryState.sensorCm,dis:document.getElementById('try-add-oo').disabled}));
  assert(s.a==="hindi"&&s.d===0&&s.n===0&&s.m===null&&s.cm===0&&!s.dis,"Reset -> no reports, dry sensor, Hindi, add buttons enabled");
  s=await pg.evaluate(()=>({flood:mapDrawn.flood,markers:mapDrawn.statusMarkers,inTry:document.getElementById('try-map').contains(document.getElementById('map-wrap'))}));
  assert(!s.flood&&s.markers===1&&s.inTry,"map: no simulated flood layer, only the Malingap sensor, inside the tab");
  assert(net.length===0,"no network requests from the tab: "+net.join(","));
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({t:TRY,hash:location.hash,place:document.getElementById('p-ans-place').textContent,stored:localStorage.getItem("bw-place:tv"),playing,list:!document.getElementById('p-col-list').hidden,panel:document.getElementById('try-panel').hidden,map:document.getElementById('public-map').contains(document.getElementById('map-wrap')),flood:mapDrawn.flood}));
  assert(!s.t&&s.hash===""&&/Mayaman/.test(s.place)&&s.stored==="tv:s:BW-H07","back on Teachers Village: your own place (43 Mayaman) untouched");
  assert(s.playing&&s.list&&s.panel&&s.map&&s.flood,"demo restored: storm playing, street list shown, Try panel hidden, map and flood layer back");
  await pg.click('#public .site-tabs [data-site="try"]');await pg.waitForTimeout(200);
  await pg.click('#p-details');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({t:TRY,view:VIEW,panel:document.getElementById('try-panel').hidden,inMain:document.querySelector('main').contains(document.getElementById('map-wrap'))}));
  assert(!s.t&&s.view==="details"&&s.panel&&s.inMain,"Details from the Try tab leaves the tab cleanly");
  await pg.click('header + .site-tabs [data-site="try"]');await pg.waitForTimeout(300);   // the details view's own tab row
  s=await pg.evaluate(()=>({t:TRY,view:VIEW}));
  assert(s.t&&s.view==="public","the details view's tab row also opens the Try tab (in the simple layout)");
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto(U+'#try');await pg2.waitForTimeout(400);
  s=await pg2.evaluate(()=>({t:TRY,sel:document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site,where:document.getElementById('p-where').hidden,a:document.getElementById('p-answer').dataset.answer,playing}));
  assert(s.t&&s.sel==="try"&&s.where&&s.a==="hindi"&&!s.playing,"#try link opens the tab directly: no Saan ka?, no storm");
  const pg3=await ctx.newPage();pg3.on('pageerror',e=>errs.push(e.message));await pg3.goto(U);await pg3.waitForTimeout(400);
  await pg3.click('#p-rep [data-ans="oo"]');await pg3.waitForTimeout(100);
  s=await pg3.evaluate(()=>({m:document.getElementById('p-rep-msg').textContent,l:!document.getElementById('p-try-link').hidden,t:document.getElementById('p-try-link').textContent}));
  assert(/Demo — not sent/.test(s.m)&&s.l&&/Try reporting/.test(s.t),"demo tabs: 'Demo — not sent' plus a link to the Try reporting tab");
  await pg3.click('#p-try-link');await pg3.waitForTimeout(300);
  assert(await pg3.evaluate(()=>TRY&&location.hash==="#try"),"the link opens the Try reporting tab");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/claude/work && python3 build_html.py && node test_try.js 2>&1 | head -3`
Expected: `FAIL: fourth tab 'Try reporting' after UC Berkeley: tv,diliman,berkeley`.

- [ ] **Step 3: Markup**

In **both** `<nav class="site-tabs" …>` blocks, add after the UC Berkeley button:
```html
  <button role="tab" data-site="try" aria-selected="false">Try reporting</button>
```
In `#public`, directly after its `</nav>`:
```html
  <p class="try-sim" id="try-sim" hidden></p>
```
In `#p-rep`, directly after `<button class="p-link" id="p-rep-undo" hidden></button>`:
```html
        <button class="p-link" id="p-try-link" hidden></button>
```
In `#p-status`, directly after the `</figure>` that closes `#p-fig`:
```html
    <section class="try-panel" id="try-panel" aria-label="Try reporting" hidden>
      <div class="try-map" id="try-map"></div>
      <div class="try-ctrls" id="try-ctrls">
        <div class="try-row"><button id="try-add-oo"></button><button id="try-add-hindi"></button></div>
        <div class="try-row" role="group" aria-labelledby="try-sensor-l"><span class="try-l" id="try-sensor-l"></span><button data-cm="0" aria-pressed="true"></button><button data-cm="3" aria-pressed="false"></button><button data-cm="20" aria-pressed="false"></button></div>
        <div class="try-row"><button id="try-reset"></button></div>
        <p class="try-full" id="try-full" role="status" aria-live="polite"></p>
      </div>
      <p class="try-why" id="try-why"></p>
      <div class="try-log"><h2 id="try-log-h"></h2><ul id="try-log"></ul></div>
    </section>
```

- [ ] **Step 4: CSS**

Append at the end of the `<style>` element:
```css
/* "Try reporting" tab: the simple view's answer band inside a phone outline, the map and controls beside it */
.try-sim{margin:10px 0 0; font-size:14px; font-weight:700; color:var(--ink)}
.try-sim[hidden],.try-panel[hidden],.p-body[hidden]{display:none}
body[data-try="1"] .p-status{grid-template-columns:380px minmax(0,1fr)}
body[data-try="1"] .p-left{border:3px solid var(--ink); border-radius:32px; padding:22px 16px 26px; background:var(--panel); max-width:380px; box-sizing:border-box}
body[data-try="1"] .p-coach{display:none}
body[data-try="1"] #map-wrap{margin:0; height:min(60vh,480px); min-height:320px; border-radius:6px; border:1px solid var(--ink)}
.try-panel{display:flex; flex-direction:column; gap:12px; min-width:0}
.try-map{order:1} .try-ctrls{order:2; display:flex; flex-direction:column; gap:8px} .try-why{order:3} .try-log{order:4}
.try-row{display:flex; flex-wrap:wrap; gap:8px; align-items:center}
.try-row button{min-height:48px; padding:0 14px; font-size:15px; font-weight:700; border:1px solid var(--ink); border-radius:4px; background:var(--panel); color:var(--ink)}
.try-row button[aria-pressed="true"]{background:var(--ink); color:var(--panel)}
.try-row button:disabled{opacity:.6; cursor:not-allowed}
.try-l{font-size:14px; font-weight:700; color:var(--ink); margin-right:4px}
.try-why{font-size:15px; line-height:1.45; color:var(--ink); margin:0}
.try-log h2{font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-2); margin:0 0 4px}
.try-log ul{list-style:none; padding:0; margin:0; font-size:14px; color:var(--ink)}
.try-log li{padding:3px 0; border-top:1px solid var(--line)}
.try-log li:first-child{border-top:none}
.try-full{font-size:13.5px; color:var(--ink-2); margin:0}
.try-full:empty{display:none}
@media (max-width:1100px){
  body[data-try="1"] .p-status{grid-template-columns:1fr}
  body[data-try="1"] .p-left{justify-self:center; width:100%}
  .try-ctrls{order:1} .try-why{order:2} .try-map{order:3} .try-log{order:4}
}
```

- [ ] **Step 5: Strings**

Directly after the line `const R=()=>SITE_CFG&&SITE_CFG.langs==="en"?REP_LANGS.en:(REP_LANGS[LANG]||REP_LANGS.en);`, add:

```js
// "Try reporting" tab strings. {oo}/{hindi} are the report buttons' own words in the current language.
const TRY_LANGS={
 en:{tab:"Try reporting",sim:"Simulation — nothing leaves this page.",addOo:"+ Neighbour says “{oo}”",addHindi:"+ Neighbour says “{hindi}”",sensor:"Sensor at 22 Malingap St:",dry:"dry",reset:"Reset",why:"{n} {phones} say “{oo}” within 1 km · sensor {s} · no rain → {word}",phone1:"phone",phoneN:"phones",cap:"Reports alone can't say “{oo}”; only a sensor can.",logH:"Reports on this map",logNone:"No reports yet.",you:"You",nb:"Neighbour {i}",full:"8 neighbours is the most in this simulation.",link:"Try it in the Try reporting tab →"},
 fil:{tab:"Subukang mag-ulat",sim:"Simulasyon — walang ipinapadala mula sa pahinang ito.",addOo:"+ Kapitbahay: “{oo}”",addHindi:"+ Kapitbahay: “{hindi}”",sensor:"Sensor sa 22 Malingap St:",dry:"tuyo",reset:"I-reset",why:"{n} {phones} ang nagsabing “{oo}” sa loob ng 1 km · sensor: {s} · walang ulan → {word}",phone1:"telepono",phoneN:"telepono",cap:"Hindi makapagsasabi ng “{oo}” ang mga ulat lang; sensor lang ang makapagsasabi.",logH:"Mga ulat sa mapang ito",logNone:"Wala pang ulat.",you:"Ikaw",nb:"Kapitbahay {i}",full:"Hanggang 8 kapitbahay lang sa simulasyong ito.",link:"Subukan sa tab na Try reporting →"},
 ceb:{tab:"Sulayi ang pagtaho",sim:"Simulasyon — walay mogawas gikan niining panid.",addOo:"+ Silingan: “{oo}”",addHindi:"+ Silingan: “{hindi}”",sensor:"Sensor sa 22 Malingap St:",dry:"uga",reset:"I-reset",why:"{n} ka {phones} ang miingon og “{oo}” sulod sa 1 km · sensor: {s} · walay ulan → {word}",phone1:"telepono",phoneN:"telepono",cap:"Dili makaingon og “{oo}” ang mga taho ra; sensor ra ang makahimo.",logH:"Mga taho niining mapa",logNone:"Wala pay taho.",you:"Ikaw",nb:"Silingan {i}",full:"Hangtod 8 ka silingan lang niining simulasyon.",link:"Sulayi sa tab nga Try reporting →"},
 ilo:{tab:"Padasen ti agipadamag",sim:"Simulasion — awan ti rummuar manipud iti daytoy a panid.",addOo:"+ Kaarruba: “{oo}”",addHindi:"+ Kaarruba: “{hindi}”",sensor:"Sensor iti 22 Malingap St:",dry:"namaga",reset:"I-reset",why:"{n} a {phones} ti nangibaga iti “{oo}” iti uneg ti 1 km · sensor: {s} · awan ti tudo → {word}",phone1:"telepono",phoneN:"telepono",cap:"Saan a makaibaga iti “{oo}” dagiti padamag laeng; sensor laeng ti makaibaga.",logH:"Dagiti padamag iti daytoy a mapa",logNone:"Awan pay ti padamag.",you:"Sika",nb:"Kaarruba {i}",full:"Agingga iti 8 a kaarruba laeng iti daytoy a simulasion.",link:"Padasem iti tab a Try reporting →"},
 hil:{tab:"Tilawi ang pag-report",sim:"Simulasyon — wala sang nagaguwa halin sa sini nga pahina.",addOo:"+ Kaingod: “{oo}”",addHindi:"+ Kaingod: “{hindi}”",sensor:"Sensor sa 22 Malingap St:",dry:"uga",reset:"I-reset",why:"{n} ka {phones} ang nagsiling “{oo}” sa sulod sang 1 km · sensor: {s} · wala sang ulan → {word}",phone1:"telepono",phoneN:"telepono",cap:"Indi makasiling sang “{oo}” ang mga report lang; sensor lang ang makahimo.",logH:"Mga report sa sini nga mapa",logNone:"Wala pa sang report.",you:"Ikaw",nb:"Kaingod {i}",full:"Tubtob 8 ka kaingod lang sa sini nga simulasyon.",link:"Tilawi sa tab nga Try reporting →"},
 pam:{tab:"Subukan ing pamag-report",sim:"Simulasyun — alang lalwal manibat king pahinang iti.",addOo:"+ Kapitbale: “{oo}”",addHindi:"+ Kapitbale: “{hindi}”",sensor:"Sensor king 22 Malingap St:",dry:"mamala",reset:"I-reset",why:"{n} a {phones} ing mesabing “{oo}” king lub ning 1 km · sensor: {s} · alang uran → {word}",phone1:"telepono",phoneN:"telepono",cap:"E makasabi “{oo}” deng report mu; sensor mu ing makasabi.",logH:"Deng report king mapang iti",logNone:"Ala pang report.",you:"Ika",nb:"Kapitbale {i}",full:"Anggang 8 kapitbale mu king simulasyun a iti.",link:"Subukan mu king tab a Try reporting →"},
};
const TL=()=>TRY_LANGS[LANG]||TRY_LANGS.en;
```
The tab button label stays "Try reporting" in every language, like the site names in the same row. `TRY_LANGS[*].tab` is used only as the panel's accessible name (Step 6, `syncTryUI`).

- [ ] **Step 6: The TRY mode**

Add this block directly after `const TL=…`:

```js
/* ---------- "Try reporting" tab (spec 2026-09-26-try-reporting-tab §4): one phone, pretend neighbours, one pretend sensor ---------- */
let TRY=false;
const TRY_PLACE="tv:s:BW-H03", TRY_SENSOR="BW-H03", TRY_MAX_NEIGHBOURS=8;
// fixed spots around the place (metres east, north), all within ~300 m, so the tab looks the same every time
const TRY_SPOTS=[[120,40],[-90,150],[200,-110],[-160,-80],[60,-230],[-240,60],[30,270],[260,160]];
const TRY_YOU=[-25,25];
let tryState={mine:null,neighbours:[],sensorCm:0};
const tryPlace=()=>PLACES.sites.tv.find(p=>p.id===TRY_PLACE);
function tryAt(dx,dy){const p=tryPlace();return {lat:p.lat+dy/111320,lon:p.lon+dx/(111320*Math.cos(p.lat*Math.PI/180))};}
function tryReports(){return [...(tryState.mine?[{who:"you",...tryState.mine}]:[]),...tryState.neighbours.map((n,i)=>({who:"n"+(i+1),...n}))];}
function tryYes(){return tryReports().filter(r=>r.answer==="oo").length;}   // each pretend phone counts once, by its only report
function tryInputs(){
  const now=Date.now(),p=tryPlace(),h=HOUSEHOLD.find(s=>s.id===TRY_SENSOR),reps=tryReports();
  return {now,place:p,
    sensors:[{id:TRY_SENSOR,name:addr(h),here:true,distM:0,travelMin:null,depthCm:tryState.sensorCm,rateCmPerHr:0,at:now}],
    reports:{yesPhones:tryYes(),newestAt:reps.length?Math.max(...reps.map(r=>r.at)):null},
    rain:{nowMmH:0,nextMmH:0,at:now}};
}
function tryRedraw(){renderPublic();drawOverlayCanvas();}
function tryReport(answer){
  const at=tryAt(...TRY_YOU);
  tryState.mine={answer,at:Date.now(),lat:at.lat,lon:at.lon};
  repMsg(R().thanks,"try");                                     // same 10-second Undo as the live page
  tryRedraw();
}
function tryUndo(){tryState.mine=null;repMsg(R().undone);tryRedraw();}
function tryAdd(answer){
  if(tryState.neighbours.length>=TRY_MAX_NEIGHBOURS)return;
  const [dx,dy]=TRY_SPOTS[tryState.neighbours.length],at=tryAt(dx,dy);
  tryState.neighbours.push({answer,at:Date.now(),lat:at.lat,lon:at.lon});
  tryRedraw();
}
function trySetSensor(cm){tryState.sensorCm=cm;tryRedraw();}
function tryReset(){tryState={mine:null,neighbours:[],sensorCm:0};repMsg("");}
function renderTry(v){
  const L=TL(),Rr=R(),Aa=A();
  $("try-sim").textContent=L.sim;
  $("try-add-oo").textContent=fill(L.addOo,{oo:Rr.oo});
  $("try-add-hindi").textContent=fill(L.addHindi,{hindi:Rr.hindi});
  const full=tryState.neighbours.length>=TRY_MAX_NEIGHBOURS;
  ["try-add-oo","try-add-hindi"].forEach(id=>{$(id).disabled=full;$(id).setAttribute("aria-disabled",full?"true":"false");});
  $("try-full").textContent=full?L.full:"";
  $("try-sensor-l").textContent=L.sensor;
  document.querySelectorAll("#try-ctrls [data-cm]").forEach(b=>{const cm=+b.dataset.cm;b.textContent=cm?cm+" cm":L.dry;b.setAttribute("aria-pressed",cm===tryState.sensorCm?"true":"false");});
  $("try-reset").textContent=L.reset;
  const n=tryYes(),s=tryState.sensorCm?tryState.sensorCm+" cm":L.dry;
  let why=fill(L.why,{n,phones:n===1?L.phone1:L.phoneN,oo:Rr.oo,s,word:Aa.word[v.answer]});
  if(n>=RULE.REPORTS_YES&&v.answer!=="oo")why+=" "+fill(L.cap,{oo:Rr.oo});
  $("try-why").textContent=why;
  $("try-log-h").textContent=L.logH;
  const reps=tryReports();
  $("try-log").innerHTML=reps.length
    ?reps.map(r=>`<li>${esc(r.who==="you"?L.you:fill(L.nb,{i:r.who.slice(1)}))}: ${esc(Rr[r.answer])}</li>`).join("")
    :`<li>${esc(L.logNone)}</li>`;
}
// Where the map canvas lives, the body flag CSS keys on, the panel and label.
function syncTryUI(){
  document.body.dataset.try=TRY?"1":"0";
  $("try-panel").hidden=!TRY;$("try-sim").hidden=!TRY;
  $("try-panel").setAttribute("aria-label",TL().tab);
  const mw=$("map-wrap"),home=TRY?$("try-map"):(VIEW==="public"?$("public-map"):null);
  if(home&&mw.parentElement!==home){home.insertBefore(mw,home.firstChild);}
  resize();resetView();renderFlood();
}
function enterTry(){
  TRY=true;LIVE=false;
  if(SITE!=="tv")switchSite("tv");                              // switchSite() keeps the storm stopped and skips "Saan ka?" in TRY
  if(VIEW!=="public")setView("public");
  $("p-where").hidden=true;
  setPlay(false);
  tryReset();
  syncTryUI();renderPublic();drawOverlayCanvas();syncTabs();writeHash();
}
function exitTry(nextSite){
  TRY=false;
  syncTryUI();
  switchSite(nextSite||SITE);                                    // restores the demo exactly: storm, place, list, map
  syncTabs();
}
function selectTab(key){
  if(key==="try"){if(!TRY)enterTry();return;}
  if(TRY){exitTry(key);writeHash();return;}
  if(key!==SITE){switchSite(key);syncTabs();writeHash();}
}
$("try-add-oo").addEventListener("click",()=>tryAdd("oo"));
$("try-add-hindi").addEventListener("click",()=>tryAdd("hindi"));
$("try-ctrls").addEventListener("click",e=>{const b=e.target.closest("[data-cm]");if(b)trySetSensor(+b.dataset.cm);});
$("try-reset").addEventListener("click",()=>{tryReset();tryRedraw();});
$("p-try-link").addEventListener("click",()=>{selectTab("try");$("p-rep").querySelector("[data-ans]").focus();});
```

- [ ] **Step 7: Hook TRY into existing functions**

Make each of these edits:

1. `const liveSimple=()=>LIVE&&VIEW==="public";` → `const liveSimple=()=>(LIVE||TRY)&&VIEW==="public";   // no simulated storm under a live or Try-tab answer`
2. `resetView`: make its first statement
   ```js
   if(TRY&&VIEW==="public"){const h=HOUSEHOLD.find(s=>s.id===TRY_SENSOR);if(h&&view.w){zoomTo(h.x,h.y,2.2);return;}}
   ```
3. `currentPlace`:
   ```js
   const currentPlace=()=>TRY?tryPlace():placesForSite().find(p=>p.id===myPlace)||null;
   ```
4. `showAnswer`: change the key line to
   ```js
   const triple=SITE+"|"+(TRY?TRY_PLACE:myPlace)+"|"+v.answer+"|"+v.reason.key+"|"+LANG+"|"+(TRY?"try":LIVE?"live":"demo");
   ```
   and the announcement line to
   ```js
   $("p-ans-announce").textContent=sentences([LIVE||TRY?"":L.demoChip,L.word[v.answer],L.gloss[v.answer],reasonText]);
   ```
5. `renderAnswer`:
   - `chip.hidden=LIVE;` → `chip.hidden=LIVE||TRY;`
   - `sh.hidden=!p;` → `sh.hidden=!p||TRY;`
   - replace the final `if(LIVE){…}` / `else showAnswer(babahaBa(demoInputs(p)));` pair with:
   ```js
   if(TRY){const v=babahaBa(tryInputs());showAnswer(v,v.updatedAt);renderTry(v);}
   else if(LIVE){if(lastLive&&lastLive.place===p.id)renderLive();else showAnswer({answer:"nodata",reason:{key:"stale",vars:{}},updatedAt:null,etaMin:null});}
   else showAnswer(babahaBa(demoInputs(p)));
   ```
6. `renderReportRow`:
   ```js
   function renderReportRow(){
     const L=R();
     const still=TRY?tryState.neighbours.some(n=>n.answer==="oo"):!!(lastLive&&lastLive.stillThere);
     $("p-rep-q").textContent=still?L.still:L.q;
     document.querySelectorAll("#p-rep [data-ans]").forEach(b=>{b.textContent=L[b.dataset.ans];});
     $("p-rep").hidden=!currentPlace();
     const tl=$("p-try-link");tl.textContent=TL().link;if(TRY||LIVE)tl.hidden=true;
   }
   ```
7. `sendReport`: directly after `const L=R();`, insert `if(TRY){tryReport(answer);return;}`. Replace `if(!LIVE){repMsg(L.demoNote);return;}` with:
   ```js
   if(!LIVE){repMsg(L.demoNote);const tl=$("p-try-link");tl.textContent=TL().link;tl.hidden=false;return;}   // demo: nothing sent; point to the Try tab
   ```
8. The Undo click handler: make its first statement `if(TRY){tryUndo();return;}`.
9. `drawOverlayCanvas`: replace
   ```js
   drawnReports=0;
   if(VIEW!=="public"&&LIVE)for(const r of recentReports){
   ```
   with
   ```js
   drawnReports=0;
   const mapReports=TRY?tryReports():(VIEW!=="public"&&LIVE?recentReports:[]);
   for(const r of mapReports){
   ```
   Then, directly after `mapDrawn.statusMarkers=0;mapDrawn.placeMarker=false;`, insert:
   ```js
   if(TRY){                                                      // the Try tab: one pretend sensor, status from the switch
     const h=HOUSEHOLD.find(s=>s.id===TRY_SENSOR),st=statusOf({depth:tryState.sensorCm/100}),X=wx(h.x),Y=wy(h.y);
     drawMarker(ctx,X,Y,9*1.45,st,STATUS_COL[st],P,true);mapDrawn.statusMarkers=1;
     ctx.font="700 12.5px Helvetica, Arial, sans-serif";ctx.textAlign="left";ctx.textBaseline="middle";
     ctx.lineWidth=5;ctx.strokeStyle=P.labelHalo;ctx.strokeText("22 Malingap",X+22,Y);
     ctx.fillStyle=P.markerInk;ctx.fillText("22 Malingap",X+22,Y);
     return;
   }
   ```
10. `renderPublic`:
    - `$("p-demo").hidden=LIVE;if(!LIVE)$("p-demo").textContent=L.demo;` → `$("p-demo").hidden=LIVE||TRY;if(!LIVE&&!TRY)$("p-demo").textContent=L.demo;`
    - `$("p-fig").hidden=LIVE;` → `$("p-fig").hidden=LIVE||TRY;`
    - `$("p-area").hidden=LIVE;` → `$("p-area").hidden=LIVE||TRY;`
    - after `$("p-col-list").hidden=LIVE;` add `document.querySelector(".p-body").hidden=TRY;`
11. `switchSite`:
    - `setPlay(!reducedMotion&&!LIVE);` → `setPlay(!reducedMotion&&!LIVE&&!TRY);`
    - in its `{let asked=null;…if(!myPlace&&!asked)openWhere();}` line, change the condition to `if(!TRY&&!myPlace&&!asked)`.
12. `parseHash`: make its first statement
    ```js
    TRY=(location.hash||"")==="#try";if(TRY){LIVE=false;return {site:"tv",view:"public"};}
    ```
13. `writeHash`: make its first statement
    ```js
    if(TRY){history.replaceState(null,"",location.pathname+location.search+"#try");try{localStorage.setItem("bw-last-hash","#try");}catch(e){}return;}
    ```
14. `syncTabs`: `const on=b.dataset.site===SITE;` → `const on=TRY?b.dataset.site==="try":b.dataset.site===SITE;`
15. The tab click handler: `b.addEventListener("click",()=>{if(b.dataset.site!==SITE){switchSite(b.dataset.site);syncTabs();writeHash();}});` → `b.addEventListener("click",()=>selectTab(b.dataset.site));`
16. The `hashchange` handler: replace the whole handler with
    ```js
    window.addEventListener("hashchange",()=>{const wasLive=LIVE,wasTry=TRY;const h=parseHash();
      if(TRY){if(!wasTry)enterTry();return;}
      if(wasTry){exitTry(h.site);if(h.view!==VIEW)setView(h.view);writeHash();return;}
      if(h.site!==SITE){switchSite(h.site);syncTabs();}if(h.view!==VIEW)setView(h.view);
      if(LIVE!==wasLive){setPlay(!reducedMotion&&!LIVE);syncLiveUI();renderPublic();drawMap();drawOverlayCanvas();pollNow();}});
    ```
17. `$("p-details").addEventListener("click",()=>setView("details"));` → `$("p-details").addEventListener("click",()=>{if(TRY)exitTry();setView("details");});`
18. Boot:
    - After `setView(VIEW);switchSite(h0.site);syncTabs();writeHash();` add `if(TRY)enterTry();`.
    - In the boot `{let asked=null;…openWhere();}` line, change the condition to `if(!TRY&&!myPlace&&!asked)`.

- [ ] **Step 8: Run the tests**

Run: `cd /home/claude/work && python3 build_html.py && node test_try.js 2>&1`
Expected: every line `ok` (25 lines), exit code 0.

Run the existing suites:
```bash
bash test_build.sh 2>&1 | grep -c "^ok"; for f in test_init test_tabs test_sites test_public test_figure test_car test_answer test_report test_recent test_noaccount; do node $f.js 2>&1 | grep -E "^FAIL" && echo "FAIL in $f"; done; echo DONE
```
Expected: `4`, then `DONE` with no `FAIL` lines. If `test_tabs.js` fails only because it counts three tabs or wraps ArrowRight from UC Berkeley back to Teachers Village, update that expectation to the four-tab row, keep the rest of the test, and say so in the report.

- [ ] **Step 9: Look at it**

```bash
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});for(const [w,h,n] of [[1280,900,'desk'],[390,844,'phone']]){const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('file:///home/claude/work/bahawatch_dashboard.html#try');await p.waitForTimeout(400);await p.click('#p-rep [data-ans=\"oo\"]');await p.click('#try-add-oo');await p.click('#try-add-oo');await p.waitForTimeout(200);await p.screenshot({path:'/home/claude/work/.superpowers/try-'+n+'.png',fullPage:true});}await b.close();})()"
```
Open both PNGs. Check four things:
- the phone outline wraps the answer band and report buttons;
- the Malingap marker and three diamonds are visible on the map;
- nothing overlaps;
- the phone PNG has no horizontal scroll and reads phone → controls → explanation → map → list.

Fix anything that fails and re-run Step 8.

- [ ] **Step 10: Commit**

```bash
git add template.html test_try.js bahawatch_dashboard.html
git commit -m "Try reporting tab: a phone, pretend neighbours and a pretend sensor on the Teachers Village map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 3: Languages, contrast, phone layout, docs

**Files:**
- Modify: `test_try.js` (append checks)
- Modify: `template.html` only if a check fails
- Modify: `README.md` (new §6.7 after §6.6; the test file table in §1)

**Interfaces:**
- Consumes: everything Task 2 produces (`TRY_LANGS`, `TL()`, `enterTry()`, element ids).
- Produces: nothing new.

- [ ] **Step 1: Write the failing checks**

In `test_try.js`, insert before the final `assert(errs.length===0,…)` line:

```js
  // every language: all Try strings exist and the tab shows no English leftovers
  s=await pg2.evaluate(()=>{const need=Object.keys(TRY_LANGS.en);const miss=[];for(const k of ["en","fil","ceb","ilo","hil","pam"])for(const n of need)if(!TRY_LANGS[k]||!TRY_LANGS[k][n])miss.push(k+"."+n);return miss;});
  assert(s.length===0,"Try strings complete in six languages: "+s.join(","));
  await pg2.selectOption('#p-lang','fil');await pg2.click('#p-rep [data-ans="oo"]');await pg2.click('#try-add-oo');await pg2.click('#try-add-oo');await pg2.waitForTimeout(150);
  s=await pg2.evaluate(()=>({sim:document.getElementById('try-sim').textContent,add:document.getElementById('try-add-oo').textContent,why:document.getElementById('try-why').textContent,log:document.getElementById('try-log').textContent,q:document.getElementById('p-rep-q').textContent,word:document.getElementById('p-ans-word').textContent}));
  assert(/Simulasyon/.test(s.sim)&&/Kapitbahay: “Oo”/.test(s.add)&&/walang ulan → Baka/.test(s.why)&&/Ikaw: Oo/.test(s.log)&&/Nandiyan pa ba/.test(s.q)&&s.word==="Baka","Filipino: panel, explanation, list, question and answer all switch: "+s.why);
  assert(!/Neighbour|Reports on this map|nothing leaves|Sensor at/.test(s.sim+s.add+s.why+s.log),"Filipino: no English left in the Try panel");
  // contrast: every text element in the phone and the panel, both themes, three answer states
  const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(m[0])+0.7152*f(m[1])+0.0722*f(m[2]);};
  for(const theme of ["light","dark"]){
    await pg2.evaluate(t=>setTheme(t,true),theme);
    for(const cm of [0,3,20]){
      await pg2.evaluate(c=>trySetSensor(c),cm);await pg2.waitForTimeout(80);
      const pairs=await pg2.evaluate(()=>{const bg=e=>{for(let x=e;x;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return c;}return getComputedStyle(document.body).backgroundColor;};
        return [...document.querySelectorAll('#p-answer *, #p-rep *, #try-panel *, #try-sim')].filter(e=>e.offsetParent&&e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('.sr-only')).map(e=>({id:e.id||e.tagName,fg:getComputedStyle(e).color,bg:bg(e),op:getComputedStyle(e).opacity}));});
      const bad=pairs.filter(p=>p.op==="1").map(p=>{const a=lum(p.fg),b2=lum(p.bg);return {...p,r:(Math.max(a,b2)+0.05)/(Math.min(a,b2)+0.05)};}).filter(p=>p.r<4.5);
      assert(bad.length===0,`contrast ≥ 4.5:1 (${theme}, sensor ${cm} cm): `+bad.map(p=>p.id+" "+p.r.toFixed(2)).join(", "));
    }
  }
  // phone width: order phone → controls → explanation → map → list; no horizontal scroll; 48 px buttons
  const pg4=await b.newPage({viewport:{width:390,height:844}});pg4.on('pageerror',e=>errs.push(e.message));
  await pg4.goto(U+'#try');await pg4.waitForTimeout(400);
  s=await pg4.evaluate(()=>{const y=id=>document.getElementById(id).getBoundingClientRect().top;
    return {order:[y('p-answer'),y('try-ctrls'),y('try-why'),y('try-map'),y('try-log-h')],sw:document.documentElement.scrollWidth,btn:Math.min(...[...document.querySelectorAll('#try-ctrls button, #p-rep [data-ans]')].map(b=>b.getBoundingClientRect().height))};});
  assert(s.order.every((v,i,a)=>i===0||v>a[i-1]),"390 px: phone, then controls, explanation, map, list: "+s.order.map(Math.round));
  assert(s.sw<=390,"390 px: no horizontal scroll ("+s.sw+")");
  assert(s.btn>=48,"all Try and report buttons ≥ 48 px ("+s.btn+")");
  // keyboard: the controls are reachable and operable with Tab and Enter
  await pg4.focus('#try-add-oo');await pg4.keyboard.press('Enter');await pg4.waitForTimeout(100);
  assert(await pg4.evaluate(()=>tryState.neighbours.length===1),"keyboard: Enter on '+ Neighbour' adds one");
```

- [ ] **Step 2: Run them**

Run: `cd /home/claude/work && node test_try.js 2>&1 | grep -E "^FAIL|^ok" | tail -12`
Expected: these new checks run against Task 2's code. Any `FAIL` line names what to fix (a missing string, a low-contrast element, or a layout order). If all pass on the first run, that is acceptable. Say so in the report, since Task 2 was written to these constraints.

- [ ] **Step 3: Fix whatever failed**

Edit only `template.html`, keeping to the Global Constraints. Typical fixes:
- For a disabled button's text, use full opacity and a muted border (`opacity:1; color:var(--ink-2)`) rather than `opacity:.6`. Check the contrast of `--ink-2` on `--panel` in both themes; the test measures only fully opaque text.
- Give a panel element a background.
- Adjust the ≤ 1100 px `order` rules.

Re-run until every line is `ok`.

- [ ] **Step 4: README**

Add after §6.6:
```markdown
### 6.7 Try reporting (proof of concept on the static site)

The fourth tab, **Try reporting** (`#try`), shows how neighbour reports work without a server.

- **The phone:** the same answer band and report buttons as the live page, for one fixed place (22 Malingap Street, sensor BW-H03, Teachers Village).
- **The controls:**
  - **+ Neighbour says "Oo" / "Hindi"** adds up to 8 pretend phones at fixed spots within about 300 m.
  - **Sensor at 22 Malingap St** switches between dry, 3 cm and 20 cm.
  - **Reset** clears the reports and the sensor.
- **The explanation line** under the map says what the rule saw and decided. The rule is the same `shared/verdict.js` the Worker uses. Reports alone reach Baka at most; only a sensor makes Oo.
- **The map** shows each report as a hollow diamond, and the list under it repeats them as text.
- **Nothing is sent.** State is in memory and a reload starts fresh. The tab never changes the place chosen on the other tabs.
- **Demo tabs:** tapping a report button says "Demo — not sent" and links here.
```
Add `test_try.js` to the test file table in §1 ("Try reporting tab: rule steps, Undo, neighbours cap, reset, no network, restore on leave, #try link, six languages, contrast, phone layout").

- [ ] **Step 5: Full check and commit**

```bash
cd /home/claude/work && python3 build_html.py && node --test shared/*.test.js 2>&1 | grep -E "^# (pass|fail)" && (cd worker && npm test 2>&1 | grep -E "^# (pass|fail)") && python3 tools/test_places.py 2>&1 | tail -1 && bash test_build.sh 2>&1 | grep -c "^ok" && for f in test_init test_tabs test_sites test_public test_figure test_car test_answer test_report test_recent test_noaccount test_try; do node $f.js 2>&1 | grep -E "^FAIL" && echo "FAIL in $f"; done; echo DONE
```
Expected: shared 20, worker 46, places OK, build 4, no `FAIL` lines.
```bash
git add template.html test_try.js README.md bahawatch_dashboard.html
git commit -m "Try reporting: six languages, contrast and phone-layout checks; README §6.7" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

## After the tasks (controller, not an implementer task)

1. **Final whole-branch review.** It covers these commits plus the three items parked earlier:
   - the multi-sensor bug, fixed by Task 1;
   - the live polling stall, parked with live mode;
   - the live map description, parked with live mode.
2. **Republish the flowchart artifact** from the updated HTML, and the private demo artifact from `bahawatch_dashboard.html`.
3. **Merge into `main`** (Gregor chooses on the finishing menu), then export the git bundle and PowerShell steps so Gregor can push to GitHub Pages.
