# PhilDev UI round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three reported bugs, translate the national and campus text into all six languages, make the PhilDev tab a full-window map-and-list screen on a free vector basemap with smooth zoom, a coloured sea and roads and buildings, let every site map zoom out to the whole country, widen the pages, and show the Try tab inside a phone.

**Architecture:** The page stays one file built from `template.html` by `build_html.py`. New:
- `shared/basemap.js`: an ES module like `shared/flood.js`, inlined with its `export`s stripped. It loads the vendored MapLibre GL JS 6.11.2 and opens OpenFreeMap vector tiles in our own style, with a hard 8-second limit. It also holds the pure helpers (clustering, box maths, coverage, view fitting) that node tests cover.
- National and campus strings move to `i18n/nat.json`, also inlined.
- Our HTML overlays stay the source of truth for pins, boxes and labels. They are positioned from `map.project()` when the vector map is up, and from the outline SVG's viewBox when it isn't, so both modes share one code path.

**Tech Stack:** Vanilla JS in one HTML page; MapLibre GL JS 6.11.2 (vendored, BSD-3-Clause); OpenFreeMap tiles (OpenMapTiles schema); Python 3 for build and style tools; Playwright page tests; `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-27-phildev-ui-round2-design.md` (approved 2026-09-27). The UX profile is `.ux-profile.md`.

## Global Constraints

- **UX profile** (`.ux-profile.md`):
  - Custom look (subway signage on warm paper).
  - WCAG 2.1 AA: text ≥ 4.5:1; large text, borders and map markers ≥ 3:1; both themes.
  - Every tap target ≥ 48 × 48 px.
  - No page-level sideways scroll at 375 and 390 px.
  - Screen-reader text for every map.
  - Motion off under `prefers-reduced-motion`.
  - Sentence case.
  - No emoji as UI icons.
  - Only one icon set: inline SVG and the text glyphs ☾ ☀ ▾ ‹ ⌂ + −.
- **Type** (spec §7):
  - Weights 400 / 600 / 700 only.
  - HTML text sizes on the scale 12 / 14 / 16 / 20 / 25 / 31 px, plus the answer word at 39 px.
  - Nothing below 12 px.
  - 12 px is for credits, timestamps and helper lines only.
- **Six languages:** `en fil ceb ilo hil pam`. Non-English strings carry `_review:true`.
- **The page** always declares its language in `<html lang>`. It has `translate="no"` exactly when the language isn't English.
- **MapLibre GL JS 6.11.2**, served from `lib/maplibre-gl-6.11.2/`:
  - `maplibre-gl.mjs`, `maplibre-gl-shared.mjs`, `maplibre-gl-worker.mjs`, `maplibre-gl.css` and `LICENSE.txt`, copied byte-for-byte from the npm package.
  - Not `vendor/`: GitHub Pages' Jekyll build can drop vendor folders.
- **Tiles and fonts:**
  - Tiles: `https://tiles.openfreemap.org/planet`.
  - Glyphs: `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`.
  - Our styles are self-hosted at `shared/basemap-style.json` and `shared/basemap-style-dark.json`.
- **Credit line:** `© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre`. Source attribution: `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`.
- **Fallback:** the outline map shows first, always. Any failure keeps it, with the note "Detailed map needs an internet connection.":
  - no WebGL;
  - the library fails;
  - the style fails;
  - no tile has arrived within 8 s.
- **Budgets:** the opening page stays ≤ 250 KB gzipped; each `data/<id>.json` ≤ 250 KB gzipped; a campus page appears within 3 s on Fast 3G.
- **Handover:**
  - Out: after zooming out past the whole box, a pull of ×0.75 (one "−" press, two wheel notches, or pinching in 25 %).
  - Back: "Back to the flood map", or the box covering ≥ 0.9 of the view's shorter side.
  - Never in the Try tab.
- **Sea colours:** light `#d6ddde`, dark `#1f2c35`. They are ΔE2000 ≥ 15 from the flood-depth blues, the NOAH purples and the creek blue.
- **Commits:**
  - Author `Gregor <gregor500man.gerp@gmail.com>`.
  - The second `-m` is:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG
    ```
- **Test commands:**
  - `./test_pages.sh [file]` (runs the gzip test server with `BW_TEST_BASEMAP=offline`, from Task 4);
  - `node --test --no-warnings shared/*.test.js sw.test.js`;
  - `./test_build.sh`;
  - `python3 -W ignore tools/test_places.py`;
  - `(cd worker && node --test --no-warnings test/*.test.js)`;
  - `python3 -m unittest tools.test_basemap_style` (from Task 4).

## Plan rulings (deviations from the spec's wording, made while planning, with the reason)

1. **MapLibre is vendored under `lib/`, not loaded from jsDelivr with an integrity hash (spec §4.2, §8).**
   - Why: MapLibre 6 ships only as three ES modules. An integrity hash on the entry file does not cover the two files it imports.
   - Same-origin files need no hash. They also load in the private demo and come from the service worker's cache offline.
   - Cost: +1.1 MB in the repo; about 300 KB gzipped fetched once, only when a vector map opens.
2. **The light sea is `#d6ddde`, not `#d3dfe6`.** The spec's example colour fails its own ΔE2000 ≥ 15 rule against the ankle band `#8fc6e2` (13.4). `#d6ddde` scores 15.4 and is still visibly different from the paper (ΔE 8.0).
3. **The phone outline is drawn with CSS (a 12 px border, 48 px radius, and `::before`/`::after` for the camera pill and side buttons), not inline SVG.** An SVG stretched over a box whose height changes can't keep a fixed corner radius. The look is the same.
4. **Campus pins stay our HTML overlay (`#nat-pins`), positioned with `map.project()`, instead of `maplibregl.Marker`.** They're the same focusable buttons with the same labels. One code path serves the vector map and the outline fallback.
5. **List rows depend on screen width.** On screens narrower than 900 px, a list row opens the campus page directly: the map is above the list, off-screen, so flying it would be invisible. At 900 px and wider, a row flies the map and shows "Open <short>" (spec §4.1).
6. **Boxes and the "Simulated area" label are HTML overlays, not map layers.** They need no map fonts and survive a theme's style swap.
7. **Country view offline.** Offline, a Philippine site's country view shows the whole-country outline with its box. Berkeley offline shows only the note, because the repo has no outline for the United States.
8. **The dark style is generated** by `tools/basemap_style.py` (the spec's "build step") and committed next to the light one.

## Review Focus

1. **Real network, tiles never arrive.** This happens when a firewall or an ad blocker blocks `tiles.openfreemap.org`, or the connection is very slow. Within 8 s the outline map and the note show. The page is never blank, and it doesn't jump to the vector map later in the same visit. (Task 5: "tiles blocked".)
2. **Theme switch while a vector map is showing.** The map restyles to the other theme, and the pins, box, label and "Open" button stay where they were. (Task 5 national; Task 6 country view.)
3. **Window resize or phone rotation with the vector map showing.** The map fills its new box, and every pin is re-placed inside it. (Task 5.)
4. **Leaving a site while its country view is open** (another tab, the national map, Try reporting, or Back). The country view closes, and the next site starts on its own flood map. (Task 6.)
5. **Language change while the vector map is showing.** Our words change: pin labels, legend, "Open …" and the note. The map's own place names stay as they are. (Task 5.)

## Files

| File | Change | Responsibility |
|---|---|---|
| `template.html` | modify | Page: CSS, markup, JS (bugs, language, type pass, national tab, country view, phone) |
| `build_html.py` | modify | Inline `i18n/nat.json` and `shared/basemap.js` |
| `i18n/nat.json` | new | National and campus strings in six languages |
| `shared/basemap.js` | new | MapLibre loader and map opener with limits; pure helpers |
| `shared/basemap.test.js` | new | Node tests of the pure helpers |
| `lib/maplibre-gl-6.11.2/*` | new | Vendored MapLibre (5 files) |
| `tools/basemap_style.py` | new | Writes both basemap styles and the offline test style |
| `tools/test_basemap_style.py` | new | Checks the styles: sources, layers, contrast, ΔE of the sea |
| `shared/basemap-style.json`, `shared/basemap-style-dark.json` | new | Generated styles |
| `tests/fixtures/basemap-offline.json` | new | Offline style: outline, sea, two roads (GeoJSON only) |
| `tools/test_server.js`, `test_pages.sh` | modify | `.mjs` type; offline style swap; `?real` pass-through |
| `sw.js`, `sw.test.js` | modify | Cache v3; tiles are never handled |
| `test_campus.js`, `test_try.js`, `test_a11y.js`, `test_national.js`, `test_tabs.js` | modify | New checks, as each task says |
| `test_zoomout.js` | new | The country view |
| `README.md`, `DATA-LICENSE.md` | modify | Basemap section, licences, privacy note |

---

### Task 1: The stray campus bar and the stretched Try map (spec §3.1, §3.2)

**Files:**
- Modify: `template.html` (CSS after the `.c-bar[hidden]` rule; JS after `function resize(){…}`)
- Test: `test_campus.js`, `test_try.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `#map-wrap` re-measures itself on any size change (a `ResizeObserver`). Later tasks rely on this when they move or resize the map box.

- [ ] **Step 1: Write the failing tests**

Append to `test_campus.js`, just before its final `  await b.close();\n})();`:

```bash
cd /home/claude/work && python3 - <<'PY'
p="test_campus.js"; s=open(p).read()
end="  await b.close();\n})();"
add='''  // each campus bar belongs to one view (Gregor's screenshot: the Details copy showed mid-page in the simple view)
  {const p4=await ctx.newPage();
   for(const [h,want] of [["#uplb","public"],["#uplb/details","details"],["#tv",null],["#try",null]]){
     await p4.goto(U+h);await p4.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="");await p4.waitForTimeout(300);
     const v=await p4.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=="hidden").map(b=>b.closest('#public')?"public":"details"));
     assert(want?v.length===1&&v[0]===want:v.length===0,`${h}: the campus bars shown are ${JSON.stringify(v)}`);}
   await p4.close();}
'''
assert s.count(end)==1; s=s.replace(end,add+end); open(p,"w").write(s)
PY
```

Append to `test_try.js`, just before its final `  await b.close();\n})();`:

```bash
cd /home/claude/work && python3 - <<'PY'
p="test_try.js"; s=open(p).read()
end="  await b.close();\n})();"
add='''  // the map re-measures itself when it moves into the Try panel, at any display scale (spec §3.2)
  for(const dpr of [1.25,1.5])for(const from of ["#uplb","#tv"]){
    const c2=await b.newContext({viewport:{width:1169,height:873},deviceScaleFactor:dpr});
    await c2.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");localStorage.setItem("bw-asked:tv","1");}catch(e){}});
    const p=await c2.newPage();await p.goto(U+from);
    await p.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="");await p.waitForTimeout(400);
    await p.locator('.site-tabs [data-site="try"]:visible').first().click();await p.waitForTimeout(600);
    const m=await p.evaluate(()=>{const w=document.getElementById('map-wrap'),c=document.getElementById('map'),d=Math.min(devicePixelRatio,2);
      return {bw:Math.round(w.clientWidth*d),bh:Math.round(w.clientHeight*d),cw:c.width,ch:c.height};});
    assert(Math.abs(m.bw-m.cw)<=1&&Math.abs(m.bh-m.ch)<=1,`Try map sharp at ${dpr}x from ${from}: box ${m.bw}x${m.bh}, canvas ${m.cw}x${m.ch}`);
    await c2.close();
  }
'''
assert s.count(end)==1; s=s.replace(end,add+end); open(p,"w").write(s)
PY
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /home/claude/work && python3 build_html.py && ./test_pages.sh test_campus.js test_try.js`

Expected:
- `FAIL test_campus.js` with `FAIL: #uplb: the campus bars shown are ["public","details"]`;
- `FAIL test_try.js` with at least `FAIL: Try map sharp at 1.5x from #tv` (reproduced while planning: the canvas was sized for a 378 px box inside a 666 px box).

- [ ] **Step 3: Fix both**

```bash
cd /home/claude/work && python3 - <<'PY'
p="template.html"; s=open(p,encoding="utf-8").read()
a=".c-bar[hidden]{display:none}\n"
b=a+"/* each campus bar belongs to one view: the simple view's sits inside #public, the Details view's after the header */\n[data-view=\"public\"] header ~ .c-bar{display:none !important}\n"
assert s.count(a)==1; s=s.replace(a,b)
a="""  applyView();
  drawMap();
}
// every OSM way that carries the selected unit's street name"""
b="""  applyView();
  drawMap();
}
// Re-measure whenever the map's box changes size (moving into the Try panel, a window or display-scale change);
// otherwise a canvas sized for an old box is stretched by CSS (spec §3.2).
if(typeof ResizeObserver!=="undefined"){let roF=0;
  new ResizeObserver(()=>{cancelAnimationFrame(roF);roF=requestAnimationFrame(()=>{
    const w=document.getElementById("map-wrap"),d=Math.min(window.devicePixelRatio||1,2);
    if(w.clientWidth&&(Math.round(w.clientWidth*d)!==mapCv.width||Math.round(w.clientHeight*d)!==mapCv.height))resize();});})
  .observe(document.getElementById("map-wrap"));}
// every OSM way that carries the selected unit's street name"""
assert s.count(a)==1; s=s.replace(a,b)
open(p,"w",encoding="utf-8").write(s)
PY
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/claude/work && python3 build_html.py && ./test_pages.sh test_campus.js test_try.js`
Expected: `ok   test_campus.js (21 checks)` and `ok   test_try.js (49 checks)`.

- [ ] **Step 5: Run every page suite, then commit**

Run: `cd /home/claude/work && ./test_pages.sh`
Expected: every line `ok`.

```bash
cd /home/claude/work && git add template.html bahawatch_dashboard.html test_campus.js test_try.js && git commit -q -m "Fix: Details campus bar hidden in the simple view; map re-measures itself (sharp Try map at any display scale)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 2: National and campus text in six languages; Chrome's translation (spec §3.3, §3.4)

**Files:**
- Create: `i18n/nat.json`
- Modify: `build_html.py`; `template.html` (the `NAT_EN`/`NAT_LANGS` block; the `documentElement.lang` line; `natRender`)
- Test: `test_a11y.js`, `test_campus.js`, `test_national.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `NAT_LANGS` (from `i18n/nat.json`), with keys used by later tasks:
    - `typesShort.{SUC,LUC,Private}`, `zin`, `zout`, `home`, `open` (`{short}`), `mapNote`, `sea`, `credit`, `wholeCountry`, `backFlood`, `simArea`;
    - the old keys `zoomOut`, `pilots`, `tryLink` and `shapes` stay until Task 5 deletes them;
    - `desc` now ends "The campus list has the same campuses.".
  - `syncDocLang()`: sets `<html lang>` to `LANG`, and `translate="no"` unless `LANG==="en"`.

- [ ] **Step 1: Write the failing tests**

```bash
cd /home/claude/work && python3 - <<'PY'
# test_a11y.js: every national/campus string is really translated
p="test_a11y.js"; s=open(p).read()
a='''  assert(s.length===0,"national and campus strings in six languages, non-English marked for review: "+s.join(","));
'''
b=a+'''  s=await pg.evaluate(()=>{const SAME_OK=new Set(["groups.Luzon","groups.Visayas","groups.Mindanao","credit","brgy1"]),same=[];
    const walk=(en,xx,path)=>{for(const k of Object.keys(en)){const p=path?path+"."+k:k;
      if(en[k]&&typeof en[k]==="object")walk(en[k],xx[k],p);else if(xx[k]===en[k]&&!SAME_OK.has(p))same.push(p);}};
    for(const k of ["fil","ceb","ilo","hil","pam"])walk(NAT_LANGS.en,NAT_LANGS[k],"");return same;});
  assert(s.length===0,"every national and campus string is translated, not an English copy: "+s.slice(0,8).join(", "));
'''
assert s.count(a)==1; s=s.replace(a,b); open(p,"w").write(s)
# test_campus.js: the language carry test also checks Filipino text, <html lang> and translate="no"
p="test_campus.js"; s=open(p).read()
a='''    await p3.goto(U+'#xu');await ready(p3,"xu");
    const a1=await p3.evaluate(()=>LANG);'''
b='''    const d0=await p3.evaluate(()=>({lang:document.documentElement.lang,tr:document.documentElement.getAttribute("translate"),h:document.getElementById("nat-q-l").textContent}));
    assert(d0.lang==="fil"&&d0.tr==="no"&&d0.h==="Maghanap ng kampus","Filipino on the national map: <html lang=fil translate=no>, search label in Filipino: "+JSON.stringify(d0));
    await p3.goto(U+'#xu');await ready(p3,"xu");
    const card=await p3.evaluate(()=>({h:document.getElementById("c-card-h").textContent,fil:NAT_LANGS.fil.cardH,en:NAT_LANGS.en.cardH}));
    assert(card.h===card.fil&&card.h!==card.en,"the partnership card is in Filipino: "+card.h);
    const a1=await p3.evaluate(()=>LANG);'''
assert s.count(a)==1; s=s.replace(a,b)
a='''    assert(a1==="fil"&&a2==="ceb"&&a3[0]==="ceb"&&a3[1]==="ceb",'''
b='''    await p3.selectOption('#nat-lang','en');
    const d1=await p3.evaluate(()=>({lang:document.documentElement.lang,tr:document.documentElement.getAttribute("translate")}));
    assert(d1.lang==="en"&&d1.tr===null,"back to English: <html lang=en>, and Chrome may translate again: "+JSON.stringify(d1));
    assert(a1==="fil"&&a2==="ceb"&&a3[0]==="ceb"&&a3[1]==="ceb",'''
assert s.count(a)==1; s=s.replace(a,b); open(p,"w").write(s)
# test_national.js: the description no longer says "below" (the list sits beside the map on wide screens)
p="test_national.js"; s=open(p).read()
a="The list below has the same campuses."
assert s.count(a)==1; s=s.replace(a,"The campus list has the same campuses."); open(p,"w").write(s)
PY
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /home/claude/work && ./test_pages.sh test_a11y.js test_campus.js test_national.js`

Expected:
- `FAIL: every national and campus string is translated, not an English copy: …`;
- `FAIL: Filipino on the national map: …` (`translate` is null; the label is English);
- `FAIL: screen-reader description of the map`.

- [ ] **Step 3: Write `i18n/nat.json`**

Create `i18n/nat.json` with exactly this content:

```json
{
 "en": {
  "loading": "Loading {name}…",
  "fail": "{name} didn't load. Check your connection.",
  "retry": "Try again",
  "back": "‹ All campuses",
  "title": "PhilDev partner campuses",
  "intro": "Choose a campus to see what a BahaWatch partnership would look like there: eight household water-level units, the barangays they cover, and the flood hazard around the campus.",
  "mapL": "Map of PhilDev partner campuses",
  "desc": "Map of the Philippines with {n} PhilDev partner campuses: {luzon} in Luzon, {visayas} in Visayas, {mindanao} in Mindanao. The campus list has the same campuses.",
  "search": "Find a campus",
  "count0": "No campus matches “{q}”.",
  "count1": "1 campus matches.",
  "countN": "{n} campuses match.",
  "groups": {"Luzon": "Luzon", "Visayas": "Visayas", "Mindanao": "Mindanao"},
  "types": {"SUC": "State university or college", "LUC": "Local university or college", "Private": "Private"},
  "typesShort": {"SUC": "State", "LUC": "Local", "Private": "Private"},
  "shapes": {"SUC": "circle", "LUC": "square", "Private": "triangle"},
  "cluster": "{n} campuses: {names}. Zoom in",
  "zoomOut": "‹ Whole country",
  "pilots": "Pilot sites",
  "tryLink": "Try reporting",
  "zin": "Zoom in",
  "zout": "Zoom out",
  "home": "Show the whole country",
  "open": "Open {short}",
  "mapNote": "Detailed map needs an internet connection.",
  "sea": "Sea",
  "credit": "© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre",
  "wholeCountry": "Whole country",
  "backFlood": "Back to the flood map",
  "simArea": "Simulated area",
  "change": "Change campus (now {name})",
  "sim": "Simulation: sensor readings are simulated; unit spots are proposals. Terrain: FABDEM (30 m). Not a forecast; not for emergency use.",
  "cardH": "What a partnership looks like",
  "unitsH": "Proposed units: {n} household water-level units, placed automatically",
  "onCampus": "on campus",
  "brgyH": "Barangays covered",
  "brgy1": "1 barangay",
  "brgyN": "{n} barangays",
  "noahH": "NOAH flood hazard in this area (share of the land in a hazard zone)",
  "noahRp": "{rp}-year rain",
  "noahNA": "not available from NOAH",
  "noah0": "no hazard zone mapped in this area",
  "roleH": "University role",
  "role": ["Students install and look after the units with residents.", "Faculty check the data.", "The campus hosts one unit and the local dashboard."],
  "foot": "Campus list: PhilDev partners across the Philippines (PhilDev Starter Pack). Map: PSA/NAMRIA administrative boundaries via OCHA HDX (CC BY-IGO), simplified. Main campuses are shown where a university has several."
 },
 "fil": {
  "_review": true,
  "loading": "Nilo-load ang {name}…",
  "fail": "Hindi na-load ang {name}. Tingnan ang iyong koneksyon.",
  "retry": "Subukan muli",
  "back": "‹ Lahat ng kampus",
  "title": "Mga kampus na katuwang ng PhilDev",
  "intro": "Pumili ng kampus para makita kung ano ang magiging hitsura ng pakikipagtulungan sa BahaWatch doon: walong water-level unit sa mga bahay, ang mga barangay na saklaw nila, at ang panganib ng baha sa paligid ng kampus.",
  "mapL": "Mapa ng mga kampus na katuwang ng PhilDev",
  "desc": "Mapa ng Pilipinas na may {n} kampus na katuwang ng PhilDev: {luzon} sa Luzon, {visayas} sa Visayas, {mindanao} sa Mindanao. Nasa listahan ng kampus ang parehong mga kampus.",
  "search": "Maghanap ng kampus",
  "count0": "Walang kampus na tugma sa “{q}”.",
  "count1": "1 kampus ang tugma.",
  "countN": "{n} kampus ang tugma.",
  "groups": {"Luzon": "Luzon", "Visayas": "Visayas", "Mindanao": "Mindanao"},
  "types": {"SUC": "Unibersidad o kolehiyo ng estado", "LUC": "Lokal na unibersidad o kolehiyo", "Private": "Pribado"},
  "typesShort": {"SUC": "Estado", "LUC": "Lokal", "Private": "Pribado"},
  "shapes": {"SUC": "bilog", "LUC": "parisukat", "Private": "tatsulok"},
  "cluster": "{n} kampus: {names}. I-zoom in",
  "zoomOut": "‹ Buong bansa",
  "pilots": "Mga pilot site",
  "tryLink": "Subukang mag-ulat",
  "zin": "Palakihin",
  "zout": "Paliitin",
  "home": "Ipakita ang buong bansa",
  "open": "Buksan ang {short}",
  "mapNote": "Kailangan ng internet para sa detalyadong mapa.",
  "sea": "Dagat",
  "credit": "© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre",
  "wholeCountry": "Buong bansa",
  "backFlood": "Bumalik sa mapa ng baha",
  "simArea": "Lugar ng simulasyon",
  "change": "Palitan ang kampus (ngayon: {name})",
  "sim": "Simulasyon: kunwari lamang ang mga reading ng sensor; mungkahi lamang ang mga puwesto ng unit. Terrain: FABDEM (30 m). Hindi ito forecast; hindi para sa emergency.",
  "cardH": "Ganito ang isang pakikipagtulungan",
  "unitsH": "Mga mungkahing unit: {n} water-level unit sa mga bahay, awtomatikong inilagay",
  "onCampus": "nasa kampus",
  "brgyH": "Mga barangay na saklaw",
  "brgy1": "1 barangay",
  "brgyN": "{n} barangay",
  "noahH": "Panganib ng baha ayon sa NOAH sa lugar na ito (bahagi ng lupa na nasa hazard zone)",
  "noahRp": "{rp}-taong ulan",
  "noahNA": "walang datos mula sa NOAH",
  "noah0": "walang naka-mapang hazard zone sa lugar na ito",
  "roleH": "Papel ng unibersidad",
  "role": ["Ang mga estudyante ang nagkakabit at nag-aalaga ng mga unit kasama ang mga residente.", "Sinusuri ng mga guro ang datos.", "Ang kampus ang may hawak ng isang unit at ng lokal na dashboard."],
  "foot": "Listahan ng kampus: mga katuwang ng PhilDev sa buong Pilipinas (PhilDev Starter Pack). Mapa: mga hangganang administratibo ng PSA/NAMRIA mula sa OCHA HDX (CC BY-IGO), pinasimple. Ipinapakita ang pangunahing kampus kung may ilang kampus ang unibersidad."
 },
 "ceb": {
  "_review": true,
  "loading": "Gikarga ang {name}…",
  "fail": "Wala makarga ang {name}. Susiha ang imong koneksyon.",
  "retry": "Sulayi pag-usab",
  "back": "‹ Tanang kampus",
  "title": "Mga kampus nga kauban sa PhilDev",
  "intro": "Pagpili og kampus aron makita kon unsa ang dagway sa pakigtambayayong sa BahaWatch didto: walo ka water-level unit sa mga balay, ang mga barangay nga ilang nasakpan, ug ang peligro sa baha palibot sa kampus.",
  "mapL": "Mapa sa mga kampus nga kauban sa PhilDev",
  "desc": "Mapa sa Pilipinas nga adunay {n} ka kampus nga kauban sa PhilDev: {luzon} sa Luzon, {visayas} sa Visayas, {mindanao} sa Mindanao. Anaa sa lista sa kampus ang samang mga kampus.",
  "search": "Pangitaa ang kampus",
  "count0": "Walay kampus nga mohaom sa “{q}”.",
  "count1": "1 ka kampus ang mohaom.",
  "countN": "{n} ka kampus ang mohaom.",
  "groups": {"Luzon": "Luzon", "Visayas": "Visayas", "Mindanao": "Mindanao"},
  "types": {"SUC": "Unibersidad o kolehiyo sa estado", "LUC": "Lokal nga unibersidad o kolehiyo", "Private": "Pribado"},
  "typesShort": {"SUC": "Estado", "LUC": "Lokal", "Private": "Pribado"},
  "shapes": {"SUC": "lingin", "LUC": "kwadrado", "Private": "trayanggulo"},
  "cluster": "{n} ka kampus: {names}. I-zoom in",
  "zoomOut": "‹ Tibuok nasod",
  "pilots": "Mga pilot site",
  "tryLink": "Sulayi ang pagreport",
  "zin": "Padakua",
  "zout": "Pagamya",
  "home": "Ipakita ang tibuok nasod",
  "open": "Ablihi ang {short}",
  "mapNote": "Kinahanglan og internet alang sa detalyado nga mapa.",
  "sea": "Dagat",
  "credit": "© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre",
  "wholeCountry": "Tibuok nasod",
  "backFlood": "Balik sa mapa sa baha",
  "simArea": "Dapit sa simulasyon",
  "change": "Usba ang kampus (karon: {name})",
  "sim": "Simulasyon: dili tinuod ang mga basa sa sensor; sugyot lamang ang mga dapit sa unit. Terrain: FABDEM (30 m). Dili kini forecast; dili para sa emerhensya.",
  "cardH": "Ingon niini ang usa ka pakigtambayayong",
  "unitsH": "Gisugyot nga mga unit: {n} ka water-level unit sa mga balay, awtomatikong gibutang",
  "onCampus": "sulod sa kampus",
  "brgyH": "Mga barangay nga nasakpan",
  "brgy1": "1 ka barangay",
  "brgyN": "{n} ka barangay",
  "noahH": "Peligro sa baha sumala sa NOAH niini nga dapit (bahin sa yuta nga anaa sa hazard zone)",
  "noahRp": "{rp}-ka-tuig nga ulan",
  "noahNA": "walay datos gikan sa NOAH",
  "noah0": "walay hazard zone nga namapa niini nga dapit",
  "roleH": "Papel sa unibersidad",
  "role": ["Ang mga estudyante ang mobutang ug moatiman sa mga unit uban sa mga residente.", "Ang mga magtutudlo ang mosusi sa datos.", "Ang kampus ang magkupot og usa ka unit ug sa lokal nga dashboard."],
  "foot": "Lista sa kampus: mga kauban sa PhilDev sa tibuok Pilipinas (PhilDev Starter Pack). Mapa: mga utlanan sa administrasyon gikan sa PSA/NAMRIA pinaagi sa OCHA HDX (CC BY-IGO), gipasimple. Gipakita ang main campus kon daghan og kampus ang unibersidad."
 },
 "ilo": {
  "_review": true,
  "loading": "Ikarkarga ti {name}…",
  "fail": "Saan a naikarga ti {name}. Kitaem ti koneksionmo.",
  "retry": "Padasen manen",
  "back": "‹ Amin a kampus",
  "title": "Dagiti kampus a kadua ti PhilDev",
  "intro": "Mangpili iti kampus tapno makitam no kasano ti panagtitinnulong iti BahaWatch sadiay: walo a water-level unit kadagiti balay, dagiti barangay a sakupenda, ken ti peggad ti layus iti aglawlaw ti kampus.",
  "mapL": "Mapa dagiti kampus a kadua ti PhilDev",
  "desc": "Mapa ti Filipinas nga addaan iti {n} a kampus a kadua ti PhilDev: {luzon} idiay Luzon, {visayas} idiay Visayas, {mindanao} idiay Mindanao. Adda iti listaan ti kampus dagiti isu met laeng a kampus.",
  "search": "Agbiruk iti kampus",
  "count0": "Awan ti kampus a maitunos iti “{q}”.",
  "count1": "1 a kampus ti maitunos.",
  "countN": "{n} a kampus ti maitunos.",
  "groups": {"Luzon": "Luzon", "Visayas": "Visayas", "Mindanao": "Mindanao"},
  "types": {"SUC": "Unibersidad wenno kolehio ti estado", "LUC": "Lokal nga unibersidad wenno kolehio", "Private": "Pribado"},
  "typesShort": {"SUC": "Estado", "LUC": "Lokal", "Private": "Pribado"},
  "shapes": {"SUC": "nagbukel", "LUC": "kuadrado", "Private": "trianggulo"},
  "cluster": "{n} a kampus: {names}. I-zoom in",
  "zoomOut": "‹ Intero a pagilian",
  "pilots": "Dagiti pilot site",
  "tryLink": "Padasen ti agireport",
  "zin": "Padakkelen",
  "zout": "Pabassiten",
  "home": "Ipakita ti intero a pagilian",
  "open": "Luktan ti {short}",
  "mapNote": "Masapul ti internet para iti detalyado a mapa.",
  "sea": "Baybay",
  "credit": "© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre",
  "wholeCountry": "Intero a pagilian",
  "backFlood": "Agsubli iti mapa ti layus",
  "simArea": "Lugar ti simulasion",
  "change": "Sukatan ti kampus (ita: {name})",
  "sim": "Simulasion: saan a pudno dagiti basa ti sensor; singasing laeng dagiti lugar ti unit. Terrain: FABDEM (30 m). Saan daytoy a forecast; saan a para iti emerhensia.",
  "cardH": "Kastoy ti maysa a panagtitinnulong",
  "unitsH": "Dagiti maisingasing a unit: {n} a water-level unit kadagiti balay, awtomatiko a naikabil",
  "onCampus": "adda iti kampus",
  "brgyH": "Dagiti barangay a nasakupan",
  "brgy1": "1 a barangay",
  "brgyN": "{n} a barangay",
  "noahH": "Peggad ti layus segun iti NOAH iti daytoy a lugar (paset ti daga nga adda iti hazard zone)",
  "noahRp": "{rp}-a-tawen a tudo",
  "noahNA": "awan ti datos manipud iti NOAH",
  "noah0": "awan ti hazard zone a namapa iti daytoy a lugar",
  "roleH": "Akem ti unibersidad",
  "role": ["Dagiti estudiante ti mangikabil ken mangaywan kadagiti unit a kadua dagiti residente.", "Dagiti mannursuro ti mangsukimat iti datos.", "Ti kampus ti mangtengngel iti maysa a unit ken ti lokal a dashboard."],
  "foot": "Listaan dagiti kampus: dagiti kadua ti PhilDev iti intero a Filipinas (PhilDev Starter Pack). Mapa: dagiti administratibo a beddeng ti PSA/NAMRIA manipud iti OCHA HDX (CC BY-IGO), napasimple. Maipakita ti kangrunaan a kampus no adu ti kampus ti unibersidad."
 },
 "hil": {
  "_review": true,
  "loading": "Ginakarga ang {name}…",
  "fail": "Wala makarga ang {name}. Tan-awa ang imo koneksyon.",
  "retry": "Tilawi liwat",
  "back": "‹ Tanan nga kampus",
  "title": "Mga kampus nga kaupod sang PhilDev",
  "intro": "Magpili sang kampus agod makita kon ano ang itsura sang pagbinuligay sa BahaWatch didto: walo ka water-level unit sa mga balay, ang mga barangay nga ila nasakop, kag ang katalagman sang baha sa palibot sang kampus.",
  "mapL": "Mapa sang mga kampus nga kaupod sang PhilDev",
  "desc": "Mapa sang Pilipinas nga may {n} ka kampus nga kaupod sang PhilDev: {luzon} sa Luzon, {visayas} sa Visayas, {mindanao} sa Mindanao. Ara sa listahan sang kampus ang amo man nga mga kampus.",
  "search": "Mangita sang kampus",
  "count0": "Wala sing kampus nga nagapareho sa “{q}”.",
  "count1": "1 ka kampus ang nagapareho.",
  "countN": "{n} ka kampus ang nagapareho.",
  "groups": {"Luzon": "Luzon", "Visayas": "Visayas", "Mindanao": "Mindanao"},
  "types": {"SUC": "Unibersidad ukon kolehiyo sang estado", "LUC": "Lokal nga unibersidad ukon kolehiyo", "Private": "Pribado"},
  "typesShort": {"SUC": "Estado", "LUC": "Lokal", "Private": "Pribado"},
  "shapes": {"SUC": "lingin", "LUC": "kwadrado", "Private": "tatsulok"},
  "cluster": "{n} ka kampus: {names}. I-zoom in",
  "zoomOut": "‹ Bug-os nga pungsod",
  "pilots": "Mga pilot site",
  "tryLink": "Tilawi ang pagreport",
  "zin": "Padakua",
  "zout": "Pagamya",
  "home": "Ipakita ang bug-os nga pungsod",
  "open": "Buksi ang {short}",
  "mapNote": "Kinahanglan ang internet para sa detalyado nga mapa.",
  "sea": "Dagat",
  "credit": "© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre",
  "wholeCountry": "Bug-os nga pungsod",
  "backFlood": "Balik sa mapa sang baha",
  "simArea": "Lugar sang simulasyon",
  "change": "Ilisan ang kampus (subong: {name})",
  "sim": "Simulasyon: indi matuod ang mga basa sang sensor; panugda lang ang mga lugar sang unit. Terrain: FABDEM (30 m). Indi ini forecast; indi para sa emerhensya.",
  "cardH": "Amo ini ang isa ka pagbinuligay",
  "unitsH": "Ginapanugda nga mga unit: {n} ka water-level unit sa mga balay, awtomatiko nga ginbutang",
  "onCampus": "sa sulod sang kampus",
  "brgyH": "Mga barangay nga nasakop",
  "brgy1": "1 ka barangay",
  "brgyN": "{n} ka barangay",
  "noahH": "Katalagman sang baha suno sa NOAH sa sini nga lugar (bahin sang duta nga ara sa hazard zone)",
  "noahRp": "{rp}-ka-tuig nga ulan",
  "noahNA": "wala sing datos halin sa NOAH",
  "noah0": "wala sing hazard zone nga namapa sa sini nga lugar",
  "roleH": "Papel sang unibersidad",
  "role": ["Ang mga estudyante ang magabutang kag magaatipan sang mga unit upod ang mga residente.", "Ang mga manunudlo ang magausisa sang datos.", "Ang kampus ang magauyat sang isa ka unit kag sang lokal nga dashboard."],
  "foot": "Listahan sang kampus: mga kaupod sang PhilDev sa bug-os nga Pilipinas (PhilDev Starter Pack). Mapa: mga administratibo nga dulunan halin sa PSA/NAMRIA paagi sa OCHA HDX (CC BY-IGO), ginpasimple. Ginapakita ang main campus kon madamo ang kampus sang unibersidad."
 },
 "pam": {
  "_review": true,
  "loading": "Iloload ya ing {name}…",
  "fail": "E melyari ing pamag-load king {name}. Lawan me ing koneksyun mu.",
  "retry": "Subukan ya pasibayu",
  "back": "‹ Deng eganagang kampus",
  "title": "Deng kampus a kayabe ning PhilDev",
  "intro": "Mamili kang kampus ban akit mu nung makananu ing pamikiabe king BahaWatch karin: walung water-level unit kareng bale, deng barangay a sasakupan da, ampo ing panganib ning albug king palibut ning kampus.",
  "mapL": "Mapa da reng kampus a kayabe ning PhilDev",
  "desc": "Mapa ning Filipinas a atin {n} a kampus a kayabe ning PhilDev: {luzon} king Luzon, {visayas} king Visayas, {mindanao} king Mindanao. Atyu king listaan da reng kampus deng pareung kampus.",
  "search": "Manintun kang kampus",
  "count0": "Alang kampus a tutugma king “{q}”.",
  "count1": "1 a kampus ing tutugma.",
  "countN": "{n} a kampus ing tutugma.",
  "groups": {"Luzon": "Luzon", "Visayas": "Visayas", "Mindanao": "Mindanao"},
  "types": {"SUC": "Unibersidad o kolehiyu ning estadu", "LUC": "Lokal a unibersidad o kolehiyu", "Private": "Pribadu"},
  "typesShort": {"SUC": "Estadu", "LUC": "Lokal", "Private": "Pribadu"},
  "shapes": {"SUC": "bilug", "LUC": "kwadradu", "Private": "tatsulok"},
  "cluster": "{n} a kampus: {names}. I-zoom in",
  "zoomOut": "‹ Sablang bansa",
  "pilots": "Deng pilot site",
  "tryLink": "Subukan ing pamag-report",
  "zin": "Palagwan",
  "zout": "Paditak",
  "home": "Ipakit ing sablang bansa",
  "open": "Buksan ya ing {short}",
  "mapNote": "Kailangan ing internet para king detalyadung mapa.",
  "sea": "Dayat",
  "credit": "© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre",
  "wholeCountry": "Sablang bansa",
  "backFlood": "Mibalik king mapa ning albug",
  "simArea": "Lugal ning simulasyun",
  "change": "Sukatan ya ing kampus (ngeni: {name})",
  "sim": "Simulasyun: e tutu deng basa ning sensor; mungkai mu deng lugal ning unit. Terrain: FABDEM (30 m). E ini forecast; e para king emerhensya.",
  "cardH": "Makanini ing metung a pamikiabe",
  "unitsH": "Deng mungkaing unit: {n} a water-level unit kareng bale, awtomatikung mikabit",
  "onCampus": "keng kampus",
  "brgyH": "Deng barangay a sasakupan",
  "brgy1": "1 a barangay",
  "brgyN": "{n} a barangay",
  "noahH": "Panganib ning albug agpang king NOAH keng lugal a iti (bage ning gabun a atyu king hazard zone)",
  "noahRp": "{rp}-banuang uran",
  "noahNA": "alang datos manibat king NOAH",
  "noah0": "alang hazard zone a mipamapa keng lugal a iti",
  "roleH": "Papel ning unibersidad",
  "role": ["Deng estudyanti ing mangabit at mangalaga kareng unit kayabe da reng residenti.", "Deng maestru ing manyusi king datos.", "Ing kampus ing mamyalaga king metung a unit ampo king lokal a dashboard."],
  "foot": "Listaan da reng kampus: deng kayabe ning PhilDev king sablang Filipinas (PhilDev Starter Pack). Mapa: deng administratibung hanggan ning PSA/NAMRIA manibat king OCHA HDX (CC BY-IGO), pepasimple. Ipakit ya ing main campus nung dakal ya kampus ing unibersidad."
 }
}
```

- [ ] **Step 4: Inline it and declare the page's language**

```bash
cd /home/claude/work && python3 - <<'PY'
p="build_html.py"; s=open(p,encoding="utf-8").read()
a='outline = open("data/ph_outline.json", encoding="utf-8").read()\n'
b=a+'nat_i18n = json.dumps(json.load(open("i18n/nat.json", encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))\n'
assert s.count(a)==1; s=s.replace(a,b)
a='for ph in ("__CAMPUSES__", "__PH_OUTLINE__",'
assert s.count(a)==1; s=s.replace(a,'for ph in ("__CAMPUSES__", "__PH_OUTLINE__", "__NAT_I18N__",')
a='out = (tpl.replace("__CAMPUSES__", json.dumps(campuses, ensure_ascii=False, separators=(",", ":"))).replace("__PH_OUTLINE__", outline)'
assert s.count(a)==1; s=s.replace(a,a+'.replace("__NAT_I18N__", nat_i18n)')
open(p,"w",encoding="utf-8").write(s)
p="template.html"; s=open(p,encoding="utf-8").read()
i=s.index("/* Strings for the national map, campus pages and loading")
end="pam:Object.assign({_review:true},NAT_EN)};"
j=s.index(end)+len(end)
s=s[:i]+"""/* Strings for the national map, campus pages and loading: i18n/nat.json (English, and five languages drafted by
   Claude and marked _review for native-speaker review). */
const NAT_LANGS=__NAT_I18N__;
const NAT_EN=NAT_LANGS.en;"""+s[j:]
a='  document.documentElement.lang=LANG==="fil"?"fil":LANG==="ceb"?"ceb":LANG==="ilo"?"ilo":LANG==="hil"?"hil":LANG==="pam"?"pam":"en";\n'
assert s.count(a)==1; s=s.replace(a,"  syncDocLang();\n")
a="function siteKey(k){return k+\":\"+SITE;}\n"
b=a+"""// The page says which language it shows; when that isn't English (chosen from our menu), Chrome is asked not to
// translate it too: its translation and our re-renders would fight over the same text (spec §3.4).
function syncDocLang(){const d=document.documentElement;d.lang=LANGS[LANG]?LANG:"en";
  if(LANG==="en")d.removeAttribute("translate");else d.setAttribute("translate","no");}
"""
assert s.count(a)==1; s=s.replace(a,b)
a='  $("nat-lang").value=LANG;\n'
assert s.count(a)==1; s=s.replace(a,'  $("nat-lang").value=LANG;syncDocLang();\n')
open(p,"w",encoding="utf-8").write(s)
PY
python3 build_html.py
```

Expected: `bahawatch_dashboard.html written (27x KB, 25 campuses)`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /home/claude/work && ./test_pages.sh test_a11y.js test_campus.js test_national.js`

Expected: all three `ok`. If a string is flagged as an English copy:
- if it is a place or product name, add it to `SAME_OK` in `test_a11y.js`, with a ledger ruling;
- translate anything else.

- [ ] **Step 6: Run every page suite, then commit**

Run: `cd /home/claude/work && ./test_pages.sh && gzip -c bahawatch_dashboard.html | wc -c`
Expected: every suite `ok`; the gzipped size ≤ 256000.

```bash
cd /home/claude/work && git add i18n build_html.py template.html bahawatch_dashboard.html test_a11y.js test_campus.js test_national.js && git commit -q -m "National and campus text in six languages (i18n/nat.json, marked for review); page declares its language and stops Chrome translating non-English" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 3: Visual pass, wider pages and the sea on campus maps (spec §6.2, §7)

**Files:**
- Modify: `template.html` (CSS sizes and weights, four label rules, `.p-inner`/`.p-body`, the theme button, sea tokens, `mapPal()`, the banner icon, both map legends, `HAS_SEA`, the card's unit lines)
- Test: `test_a11y.js`, `test_campus.js`

**Interfaces:**
- Consumes: `NL().sea` (Task 2).
- Produces:
  - CSS tokens `--sea` (light `#d6ddde`, dark `#1f2c35`) and the class `.sea-sw` (a swatch). Tasks 5 and 6 use both.
  - The global `HAS_SEA` (boolean, per site).

- [ ] **Step 1: Write the failing tests**

```bash
cd /home/claude/work && python3 - <<'PY'
p="test_a11y.js"; s=open(p).read()
end="  await b.close();\n})();"
add=r'''  // visual pass (spec §7): nothing below 12 px, three weights, sentence case, no emoji icons
  const TYPE=`()=>{const small=[],weights=new Set(),upper=[];
    for(const e of document.querySelectorAll('body *')){if(!(e instanceof HTMLElement)||!e.getClientRects().length||e.closest('.sr-only,svg,canvas'))continue;
      if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
      const cs=getComputedStyle(e);if(cs.visibility==="hidden")continue;
      if(parseFloat(cs.fontSize)<12)small.push((e.id||e.className||e.tagName)+" "+cs.fontSize);
      weights.add(cs.fontWeight);if(cs.textTransform==="uppercase")upper.push(e.id||e.className||e.tagName);}
    const emoji=[...document.querySelectorAll('body *:not(script):not(style)')].some(e=>[...e.childNodes].some(n=>n.nodeType===3&&/\u26A0|\uFE0F/.test(n.textContent)));
    return {small:small.slice(0,6),weights:[...weights].sort(),upper:upper.slice(0,6),emoji};}`;
  for(const [w,h] of [[1280,900],[375,812]])for(const r of ["","#uplb","#uplb/details","#tv","#try"]){
    const v=await b.newPage({viewport:{width:w,height:h}});
    await v.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");localStorage.setItem("bw-asked:tv","1");}catch(e){}});
    await v.goto(U+r);await v.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="");await v.waitForTimeout(500);
    const t=await v.evaluate(TYPE);
    assert(t.small.length===0,`${w}px ${r||"#ph"}: no text below 12 px: ${t.small}`);
    assert(t.weights.every(x=>["400","600","700"].includes(x)),`${w}px ${r||"#ph"}: only weights 400/600/700: ${t.weights}`);
    assert(t.upper.length===0&&!t.emoji,`${w}px ${r||"#ph"}: sentence case, no emoji icons: ${t.upper} ${t.emoji}`);
    await v.close();
  }
  // wide screens: the campus page uses the width (spec §6.2)
  const wide=await b.newPage({viewport:{width:1920,height:1080}});
  await wide.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");}catch(e){}});
  await wide.goto(U+'#uplb');await ready(wide,"uplb");
  s=await wide.evaluate(()=>document.querySelector('#public .p-inner').getBoundingClientRect().width);
  assert(s>=1500,"at 1920 px the campus page uses the width (content "+Math.round(s)+" px, was 1120)");
  await wide.close();
  // the national map's theme button is visible: a boundary ≥ 3:1, the glyph ≥ 4.5:1, 48 px
  const tb=await b.newPage({viewport:{width:1280,height:900}});await tb.goto(U);await ready(tb,"ph");
  for(const theme of ["light","dark"]){await tb.evaluate(t=>setTheme(t,true),theme);
    s=await tb.evaluate(()=>{const e=document.getElementById('nat-theme'),cs=getComputedStyle(e),r=e.getBoundingClientRect();
      return {fg:cs.color,bd:cs.borderTopColor,bw:parseFloat(cs.borderTopWidth),page:getComputedStyle(document.body).backgroundColor,fs:parseFloat(cs.fontSize),w:r.width,h:r.height};});
    assert(s.bw>=1&&ratio(s.bd,s.page)>=3&&ratio(s.fg,s.page)>=4.5&&s.fs>=16&&s.w>=48&&s.h>=48,`${theme}: the national theme button is visible: `+JSON.stringify(s));}
  await tb.evaluate(()=>setTheme("light",true));await tb.close();
  // the sea on campus maps: its own colour and a legend entry where the box has sea
  const sp=await b.newPage({viewport:{width:1280,height:900}});
  await sp.addInitScript(()=>{try{localStorage.setItem("bw-asked:ctu","1");localStorage.setItem("bw-asked:upd","1");}catch(e){}});
  await sp.goto(U+'#ctu');await ready(sp,"ctu");
  s=await sp.evaluate(()=>({pal:mapPal().sea.join(),lg:!document.getElementById('p-lg-sea').hidden,t:document.getElementById('p-lg6').textContent,has:HAS_SEA}));
  assert(s.has&&s.lg&&s.t==="Sea"&&s.pal==="214,221,222","CTU has sea: the map legend says Sea, drawn in #d6ddde: "+JSON.stringify(s));
  await sp.goto(U+'#upd');await ready(sp,"upd");
  assert(await sp.evaluate(()=>!HAS_SEA&&document.getElementById('p-lg-sea').hidden),"UP Diliman has no sea: no Sea legend entry");
  await sp.close();
'''
assert s.count(end)==1; s=s.replace(end,add+end); open(p,"w").write(s)
p="test_campus.js"; s=open(p).read()
a='''  assert(/^BW-XU-01 · .+ · on campus$/.test(s.units[0])&&s.units.slice(1).every(u=>!/on campus/.test(u)),"unit 01, and only unit 01, is marked on campus: "+s.units[0]);'''
b='''  assert(/^BW-XU-01 — on campusnear .+, .+$/.test(s.units[0])&&s.units.slice(1).every(u=>/^BW-XU-0\\dnear /.test(u)&&!/on campus/.test(u))&&!s.units.some(u=>/ · /.test(u)),"unit 01, and only unit 01, is marked on campus; unit lines are plain (no ' · '): "+s.units[0]);'''
assert s.count(a)==1; s=s.replace(a,b); open(p,"w").write(s)
PY
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /home/claude/work && ./test_pages.sh test_a11y.js test_campus.js`

Expected FAILs:
- `no text below 12 px` (e.g. `bands-lab 10.5px`);
- `only weights 400/600/700` (500 is present);
- `sentence case` (`rail-h`);
- `emoji` (the banner's warning emoji, even while the banner is hidden);
- `at 1920 px … 1120`;
- `the national theme button is visible` (no border, 14 px);
- `CTU has sea` (`HAS_SEA` is not defined);
- the unit-line assertion in `test_campus.js`.

- [ ] **Step 3: Apply the visual pass**

```bash
cd /home/claude/work && python3 - <<'PY'
import re
p="template.html"; s=open(p,encoding="utf-8").read()
def rep(a,b,n=1):
    global s; assert s.count(a)==n,(a[:70],s.count(a)); s=s.replace(a,b)
# 1. the four all-caps labels become sentence-case 14 px bold (the words are already sentence case in the markup)
rep(".rail-h{font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2); margin:0 0 8px}",
    ".rail-h{font-size:14px; font-weight:700; color:var(--ink-2); margin:0 0 8px}")
rep("details summary{padding:0 0 12px; font-weight:700; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2);",
    "details summary{padding:0 0 12px; font-weight:700; font-size:14px; color:var(--ink-2);")
rep(".p-sec-h{font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2);",
    ".p-sec-h{font-size:14px; font-weight:700; color:var(--ink-2);")
rep(".try-log h2{font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-2); margin:0 0 4px}",
    ".try-log h2{font-size:14px; font-weight:700; color:var(--ink-2); margin:0 0 4px}")
assert "text-transform:uppercase" not in s
# 2. every CSS font size onto the scale 12/14/16/20/25/31 (+39 for the answer word); nothing below 12
SCALE={"10.5":"12","11":"12","11.5":"12","12":"12","12.5":"12","13":"14","13.5":"14","14":"14","14.5":"14","15":"16","16":"16",
       "17":"16","18":"20","19":"20","20":"20","22":"25","24":"25","26":"25","30":"31","36":"39"}
def sz(m):
    v=m.group(1); assert v in SCALE, "font-size not on the map: "+v
    return "font-size:"+SCALE[v]+"px"
s=re.sub(r"font-size:(\d+(?:\.\d+)?)px",sz,s)
# canvas labels too
rep('font="700 11px Helvetica, Arial, sans-serif"','font="700 12px Helvetica, Arial, sans-serif"')
# 3. three weights: 500 becomes 600
s=s.replace("font-weight:500","font-weight:600")
# 4. wider pages; paragraphs keep a readable line length
rep(".p-inner{max-width:1120px; width:100%; margin:0 auto; padding:0 16px;",".p-inner{max-width:1600px; width:100%; margin:0 auto; padding:0 24px;")
rep(".p-body{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr);",".p-body{display:grid; grid-template-columns:minmax(0,5fr) minmax(0,6fr);")
rep(".try-why{font-size:16px; line-height:1.45;",".p-review,.nat-intro,.foot-note,.c-card p{max-width:72ch}\n.try-why{font-size:16px; line-height:1.45;")
# 5. the national theme button gets a visible boundary and a readable glyph
rep(".nat-top .p-tools button, .nat-top .p-tools select{min-height:48px; min-width:48px}\n",
    ".nat-top .p-tools button, .nat-top .p-tools select{min-height:48px; min-width:48px}\n#nat-theme{border:1px solid var(--ink); border-radius:4px; background:var(--panel); color:var(--ink); font-size:16px}\n")
# 6. the sea: tokens, swatch, canvas palette
rep(':root[data-theme="dark"]{--pin-suc:#7FA8E0; --pin-luc:#F08A4B; --pin-pvt:#F2F2F2}\n',
    ':root[data-theme="dark"]{--pin-suc:#7FA8E0; --pin-luc:#F08A4B; --pin-pvt:#F2F2F2}\n'
    '/* the sea: a grey blue kept ΔE2000 ≥ 15 from the flood blues, the NOAH purples and the creek blue (plan ruling 2) */\n'
    ':root{--sea:#d6ddde} :root[data-theme="dark"]{--sea:#1f2c35}\n'
    '.sea-sw{display:inline-block; flex:none; width:18px; height:10px; background:var(--sea); border:1px solid var(--ink-2); border-radius:2px; vertical-align:middle}\n')
rep("sea:[31,52,66]","sea:[31,44,53]")
rep("sea:[204,226,238]","sea:[214,221,222]")
# 7. the banner's warning emoji becomes our own triangle shape
rep('<div id="banner" role="status"><span>⚠️</span><span id="banner-text"></span></div>',
    '<div id="banner" role="status"><span class="shape warn" aria-hidden="true"></span><span id="banner-text"></span></div>')
# 8. "Sea" in both map legends, only where the box has sea
rep('          <span><span class="shape alert"></span><span id="p-lg5"></span></span>\n',
    '          <span><span class="shape alert"></span><span id="p-lg5"></span></span>\n          <span id="p-lg-sea" hidden><span class="sea-sw"></span><span id="p-lg6"></span></span>\n')
rep('      <div class="row"><span class="shape alert"></span>Not passable to light vehicles (≥33 cm)</div>\n',
    '      <div class="row"><span class="shape alert"></span>Not passable to light vehicles (≥33 cm)</div>\n      <div class="row" id="lg-sea" hidden><span class="sea-sw"></span><span id="lg-sea-t">Sea</span></div>\n')
rep("let BLOCK=null, SEA=null, BC=null;","let BLOCK=null, SEA=null, BC=null, HAS_SEA=false;")
rep("  SEA=DATA.sea?unrle(DATA.sea):null;\n","  SEA=DATA.sea?unrle(DATA.sea):null;HAS_SEA=!!SEA&&SEA.some(v=>v===1);\n")
rep('$("p-lg5").textContent=L.lg[4];\n',
    '$("p-lg5").textContent=L.lg[4];\n  $("p-lg6").textContent=NL().sea;$("p-lg-sea").hidden=!HAS_SEA;$("lg-sea").hidden=!HAS_SEA;$("lg-sea-t").textContent=NL().sea;\n')
# 9. the card's unit lines: two plain lines, no " · "
rep("""  $("c-units").innerHTML=D.units.map(u=>`<li><b>${esc(u.id)}</b> · ${esc(u.name)}${u.oc?` · <span class="c-oc">${esc(L.onCampus)}</span>`:""}</li>`).join("");""",
    """  $("c-units").innerHTML=D.units.map(u=>`<li><b>${esc(u.id)}</b>${u.oc?` — <span class="c-oc">${esc(L.onCampus)}</span>`:""}<span class="c-u-name">${esc(u.name.replace(/ · /g,", "))}</span></li>`).join("");""")
rep(".c-oc{font-weight:700}\n",".c-oc{font-weight:700}\n.c-u-name{display:block; font-size:14px; color:var(--ink-2)}\n")
open(p,"w",encoding="utf-8").write(s)
PY
python3 build_html.py
```

Expected: the script finishes without an assertion error, and `bahawatch_dashboard.html written`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/claude/work && ./test_pages.sh test_a11y.js test_campus.js`
Expected: both `ok`.

If a size or weight check names an element the plan didn't list, it is one of:
- a `font-size` in an inline `style=` attribute;
- an element with `font-weight:bold` from the browser (e.g. `th`).

Fix it at its rule, using the same scale, and ledger a ruling.

- [ ] **Step 5: Look at it**

Screenshot `#uplb` at 1920 × 1080 and `#uplb/details` at 1280 × 900 (Playwright, as in the Task 13 sheet of the previous plan). Check that:
- the headline still fits beside the depth figure;
- the side panel's labels read as sentence case;
- the card's unit lines are two lines each.

Note anything off in the ledger.

- [ ] **Step 6: Run every suite, then commit**

Run: `cd /home/claude/work && ./test_pages.sh && gzip -c bahawatch_dashboard.html | wc -c`
Expected: every suite `ok`; ≤ 256000.

```bash
cd /home/claude/work && git add template.html bahawatch_dashboard.html test_a11y.js test_campus.js && git commit -q -m "Visual pass: type scale (≥ 12 px), three weights, sentence-case labels, no emoji icon, pages up to 1600 px, sea colour and legend, plain unit lines" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 4: The basemap foundation: vendored MapLibre, our styles, the loader, test plumbing (spec §4.2, §8)

**Files:**
- Create:
  - `lib/maplibre-gl-6.11.2/{maplibre-gl.mjs,maplibre-gl-shared.mjs,maplibre-gl-worker.mjs,maplibre-gl.css,LICENSE.txt}`;
  - `tools/basemap_style.py`, `tools/test_basemap_style.py`;
  - `shared/basemap-style.json`, `shared/basemap-style-dark.json`;
  - `tests/fixtures/basemap-offline.json`;
  - `shared/basemap.js`, `shared/basemap.test.js`.
- Modify:
  - `build_html.py` (inline `shared/basemap.js`);
  - `template.html` (the `/*__BASEMAP_JS__*/` placeholder);
  - `tools/test_server.js`, `test_pages.sh`;
  - `sw.js`, `sw.test.js`.

**Interfaces:**
- Consumes: nothing new.
- Produces, as page globals:
  - `bwCluster(pts, r)`: `pts` is `[{id,x,y}]`; returns `[{x,y,ids}]`.
  - `bwCoverage({x0,y0,x1,y1}, w, h)`: returns a number.
  - `bwFitVB([x,y,w,h], boxW, boxH)`: returns `[x,y,w,h]`.
  - `bwCampusBox(lat, lon)`: returns `[[W,S],[E,N]]`.
  - `bwStyleUrl(theme)`: returns a string.
  - `bwHasWebGL()`: returns a boolean.
  - `bwLoadMapLibre()`: returns a `Promise` of the module namespace (with `.Map`).
  - `bwOpenMap(lib, container, {bounds, theme, reduced, padding, minZoom, timeout})`: returns a `Promise` of the map.
  - Test hooks: `window.BW_NO_BASEMAP` (turns the vector map off) and `window.BW_BASEMAP_STYLE` (a style URL override).
- Produces, in the test server: with `BW_TEST_BASEMAP=offline`, `shared/basemap-style*.json` serves `tests/fixtures/basemap-offline.json`, unless the request has `?real`.

- [ ] **Step 1: Vendor MapLibre 6.11.2**

```bash
cd /tmp && rm -rf mlpack && mkdir mlpack && cd mlpack && npm pack maplibre-gl@6.11.2 --silent && tar xzf maplibre-gl-6.11.2.tgz && \
mkdir -p /home/claude/work/lib/maplibre-gl-6.11.2 && \
cp package/dist/maplibre-gl.mjs package/dist/maplibre-gl-shared.mjs package/dist/maplibre-gl-worker.mjs package/dist/maplibre-gl.css package/LICENSE.txt /home/claude/work/lib/maplibre-gl-6.11.2/ && \
cd /home/claude/work/lib/maplibre-gl-6.11.2 && ls -la && head -3 maplibre-gl.mjs && sha256sum *
```

Expected:
- five files, `maplibre-gl.mjs` ≈ 590 KB;
- the header line `* @license 3-Clause BSD. Full text of license: https://github.com/maplibre/maplibre-gl-js/blob/v6.11.2/LICENSE.txt`.

Record the sha256 lines in the ledger.

- [ ] **Step 2: Write the failing tests (helpers, styles, service worker)**

Create `shared/basemap.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bwCluster, bwCoverage, bwFitVB, bwCampusBox, bwStyleUrl } from './basemap.js';

test('points closer than the radius share a cluster, in list order, at their mean', () => {
  const g = bwCluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 30, y: 0 }, { id: 'c', x: 100, y: 0 }], 36);
  assert.deepEqual(g, [{ x: 15, y: 0, ids: ['a', 'b'] }, { x: 100, y: 0, ids: ['c'] }]);
});
test('a point joins the first cluster whose first point is near', () => {
  const g = bwCluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 50, y: 0 }, { id: 'c', x: 25, y: 0 }], 36);
  assert.deepEqual(g.map((x) => x.ids), [['a', 'c'], ['b']]);
});
test("coverage is the box's span over the view's shorter side", () => {
  assert.equal(bwCoverage({ x0: 0, y0: 0, x1: 400, y1: 300 }, 800, 400), 1);
  assert.ok(bwCoverage({ x0: 10, y0: 10, x1: 110, y1: 60 }, 800, 400) < 0.9);
  assert.equal(bwCoverage({ x0: 5, y0: 5, x1: 5, y1: 5 }, 0, 0), 0);
});
test('a viewBox grows around its centre to the box shape', () => {
  assert.deepEqual(bwFitVB([0, 0, 100, 100], 200, 100), [-50, 0, 200, 100]);
  assert.deepEqual(bwFitVB([0, 0, 100, 100], 100, 200), [0, -50, 100, 200]);
});
test('the campus box matches the pipeline cut (UP Diliman)', () => {
  assert.deepEqual(bwCampusBox(14.650376, 121.067643), [[121.053716, 14.636819], [121.08157, 14.663933]]);
});
test('style URLs: light, dark, and the test override', () => {
  assert.equal(bwStyleUrl('light'), 'shared/basemap-style.json');
  assert.equal(bwStyleUrl('dark'), 'shared/basemap-style-dark.json');
  globalThis.window = { BW_BASEMAP_STYLE: 'tests/x.json' };
  try { assert.equal(bwStyleUrl('dark'), 'tests/x.json'); } finally { delete globalThis.window; }
});
```

Create `tools/test_basemap_style.py`:

```python
"""The basemap styles (spec §4.2, §7): OpenFreeMap tiles and fonts, our layers, the sea kept apart from the flood and
hazard colours, readable labels, committed files current. Run: python3 -m unittest tools.test_basemap_style"""
import json, math, os, sys, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import basemap_style as B  # noqa: E402


def lab(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    r, g, b = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    return 116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))


def de2000(a, b):
    L1, a1, b1 = lab(a); L2, a2, b2 = lab(b)
    Cb = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2; G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2; C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360; h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p; dh = h2p - h1p
    dh = 0 if C1p * C2p == 0 else dh - 360 if dh > 180 else dh + 360 if dh < -180 else dh
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2)); Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hb = h1p + h2p if C1p * C2p == 0 else (h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb)) + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.20 * math.cos(math.radians(4 * hb - 63))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)); Rt = -math.sin(math.radians(2 * 30 * math.exp(-((hb - 275) / 25) ** 2))) * Rc
    Sl = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2); Sc = 1 + 0.045 * Cbp; Sh = 1 + 0.015 * Cbp * T
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def contrast(a, b):
    def lum(h):
        h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        r, g, bb = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * r + 0.7152 * g + 0.0722 * bb
    x, y = lum(a), lum(b); return (max(x, y) + 0.05) / (min(x, y) + 0.05)


# the page's flood-depth bands per theme (template.html mapPal), the NOAH purples (light) and the creek blue
AVOID = {"light": ["#8fc6e2", "#2f86c2", "#0030a0", "#d9c2ea", "#a978cf", "#5b2a8f", "#70c0e0"],
         "dark": ["#2e5a7a", "#3f93bf", "#a7e0f5", "#70c0e0"]}


class Styles(unittest.TestCase):
    def test_committed_files_are_current(self):
        for theme, name in (("light", "basemap-style.json"), ("dark", "basemap-style-dark.json")):
            self.assertEqual(json.load(open(os.path.join(ROOT, "shared", name), encoding="utf-8")), B.style(theme), name)
        self.assertEqual(json.load(open(os.path.join(ROOT, "tests", "fixtures", "basemap-offline.json"), encoding="utf-8")), B.fixture())

    def test_openfreemap_tiles_and_fonts(self):
        s = B.style("light"); src = s["sources"]["openmaptiles"]
        self.assertEqual((src["type"], src["url"]), ("vector", "https://tiles.openfreemap.org/planet"))
        self.assertEqual(src["attribution"], "OpenFreeMap © OpenMapTiles Data from OpenStreetMap")
        self.assertEqual(s["glyphs"], "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf")
        self.assertNotIn("sprite", s)

    def test_layers(self):
        for theme in ("light", "dark"):
            s = B.style(theme); ids = [l["id"] for l in s["layers"]]
            for need in ("land", "water", "river", "boundary-province", "road-major", "road-mid", "road-minor", "building", "road-label", "place-label"):
                self.assertIn(need, ids, need)
            self.assertLess(ids.index("water"), ids.index("road-major"))
            self.assertEqual(next(l for l in s["layers"] if l["id"] == "building")["minzoom"], 14)
            self.assertEqual(s["layers"][0]["paint"]["background-color"], B.PALETTES[theme]["land"])

    def test_sea_is_far_from_flood_hazard_and_creek_colours(self):
        for theme in ("light", "dark"):
            sea = B.PALETTES[theme]["sea"]
            for c in AVOID[theme]:
                self.assertGreaterEqual(de2000(sea, c), 15, f"{theme} sea {sea} vs {c}")
            self.assertGreaterEqual(de2000(sea, B.PALETTES[theme]["land"]), 7, f"{theme} sea vs land")

    def test_labels_are_readable(self):
        for theme in ("light", "dark"):
            p = B.PALETTES[theme]
            self.assertGreaterEqual(contrast(p["label"], p["land"]), 4.5, theme)
            for l in B.style(theme)["layers"]:
                if l["type"] == "symbol":
                    ts = l["layout"]["text-size"]; sizes = [ts] if isinstance(ts, (int, float)) else [v for v in ts if isinstance(v, (int, float))]
                    self.assertTrue(all(v >= 12 for v in sizes), (l["id"], sizes))


if __name__ == "__main__":
    unittest.main()
```

In `sw.test.js`, replace the v2 test and add the tiles guard:

```bash
cd /home/claude/work && python3 - <<'PY'
p="sw.test.js"; s=open(p).read()
a="""test('the cache name moved to v2 so old shells are cleared', () => {
  assert.match(fs.readFileSync(__dirname + '/sw.js', 'utf8'), /bahawatch-v2/);
});"""
b="""test('the cache name moved to v3 so old shells are cleared', () => {
  assert.match(fs.readFileSync(__dirname + '/sw.js', 'utf8'), /bahawatch-v3/);
});
test('tiles and fonts from OpenFreeMap are left to the network: never cached, never answered', () => {
  const handlers = {}; let answered = false;
  const ctx = { self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: { origin: 'https://bw.test' }, URL, Response, fetch: () => Promise.reject(new Error('offline')), caches: {} };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), ctx);
  for (const url of ['https://tiles.openfreemap.org/planet/20250101_001001_pt/9/428/231.pbf', 'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf'])
    handlers.fetch({ request: { method: 'GET', url, mode: 'cors' }, respondWith: () => { answered = true; } });
  assert.equal(answered, false);
});"""
assert s.count(a)==1; s=s.replace(a,b); open(p,"w").write(s)
PY
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd /home/claude/work && node --test --no-warnings shared/basemap.test.js sw.test.js 2>&1 | grep -E '^# (pass|fail)|not ok' ; python3 -m unittest tools.test_basemap_style 2>&1 | tail -3`

Expected:
- `basemap.test.js` fails to import (`Cannot find module …/shared/basemap.js`);
- `not ok … v3`. The tiles guard already passes: it pins today's behaviour;
- the Python test errors with `ModuleNotFoundError: No module named 'basemap_style'`.

- [ ] **Step 4: Write `tools/basemap_style.py` and generate the three styles**

```python
#!/usr/bin/env python3
"""BahaWatch basemap styles for MapLibre (spec §4.2): our paper look over OpenFreeMap's OpenMapTiles vector tiles.
  python3 tools/basemap_style.py     # writes shared/basemap-style.json, shared/basemap-style-dark.json and the
                                     # offline test style tests/fixtures/basemap-offline.json (GeoJSON only)
One definition, two palettes (plan ruling 8); tools/test_basemap_style.py checks them."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = "https://tiles.openfreemap.org/planet"
GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf"
ATTRIBUTION = "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"
PALETTES = {
    "light": dict(land="#f8f4ec", sea="#d6ddde", river="#70c0e0", residential="#f1ebdf", park="#e6e8d8", boundary="#a39a8a",
                  road="#ffffff", casing="#e3dccd", building="#e9e1d2", label="#232120", halo="#f8f4ec"),
    "dark": dict(land="#1f1e1c", sea="#1f2c35", river="#70c0e0", residential="#262421", park="#232821", boundary="#6b645b",
                 road="#4a4640", casing="#1c1a18", building="#302d29", label="#f3efe7", halo="#1f1e1c"),
}
MAJOR, MID, MINOR = ["motorway", "trunk", "primary"], ["secondary", "tertiary"], ["minor", "service"]


def width(z0, w0, z1, w1):
    return ["interpolate", ["exponential", 1.5], ["zoom"], z0, w0, z1, w1]


def road(id_, classes, minzoom, w, casing, p):
    f = ["match", ["get", "class"], classes, True, False]
    base = {"type": "line", "source": "openmaptiles", "source-layer": "transportation", "minzoom": minzoom, "filter": f,
            "layout": {"line-cap": "round", "line-join": "round"}}
    return [dict(base, id=id_ + "-casing", paint={"line-color": p["casing"], "line-width": casing}),
            dict(base, id=id_, paint={"line-color": p["road"], "line-width": w})]


def label_paint(p):
    return {"text-color": p["label"], "text-halo-color": p["halo"], "text-halo-width": 1.5}


def style(theme):
    p = PALETTES[theme]
    name = ["coalesce", ["get", "name:latin"], ["get", "name"]]
    layers = [
        {"id": "land", "type": "background", "paint": {"background-color": p["land"]}},
        {"id": "residential", "type": "fill", "source": "openmaptiles", "source-layer": "landuse",
         "filter": ["==", ["get", "class"], "residential"], "paint": {"fill-color": p["residential"]}},
        {"id": "park", "type": "fill", "source": "openmaptiles", "source-layer": "park", "paint": {"fill-color": p["park"]}},
        {"id": "water", "type": "fill", "source": "openmaptiles", "source-layer": "water", "paint": {"fill-color": p["sea"]}},
        {"id": "river", "type": "line", "source": "openmaptiles", "source-layer": "waterway", "minzoom": 8,
         "filter": ["match", ["get", "class"], ["river", "stream", "canal"], True, False],
         "paint": {"line-color": p["river"], "line-width": width(8, 0.6, 16, 4)}},
        {"id": "boundary-province", "type": "line", "source": "openmaptiles", "source-layer": "boundary",
         "filter": ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
         "paint": {"line-color": p["boundary"], "line-width": 0.8, "line-dasharray": [3, 2]}},
        *road("road-minor", MINOR, 12, width(12, 0.5, 18, 8), width(12, 1.5, 18, 10), p),
        *road("road-mid", MID, 9, width(9, 0.5, 18, 12), width(9, 1.5, 18, 14), p),
        *road("road-major", MAJOR, 6, width(6, 0.6, 18, 16), width(6, 1.6, 18, 18), p),
        {"id": "building", "type": "fill", "source": "openmaptiles", "source-layer": "building", "minzoom": 14,
         "paint": {"fill-color": p["building"], "fill-outline-color": p["casing"]}},
        {"id": "road-label", "type": "symbol", "source": "openmaptiles", "source-layer": "transportation_name", "minzoom": 13,
         "layout": {"symbol-placement": "line", "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 12},
         "paint": label_paint(p)},
        {"id": "place-label", "type": "symbol", "source": "openmaptiles", "source-layer": "place",
         "filter": ["match", ["get", "class"], ["city", "town", "village", "suburb"], True, False],
         "layout": {"text-field": name, "text-font": ["Noto Sans Bold"],
                    "text-size": ["match", ["get", "class"], "city", 15, "town", 13, 12]},
         "paint": label_paint(p)},
    ]
    return {"version": 8, "name": f"BahaWatch {theme}", "glyphs": GLYPHS,
            "sources": {"openmaptiles": {"type": "vector", "url": TILES, "attribution": ATTRIBUTION}}, "layers": layers}


def fixture():
    """The offline style for the page tests: the country outline on the sea and two roads, no network at all."""
    p = PALETTES["light"]
    outline = json.load(open(os.path.join(ROOT, "data", "ph_outline.json"), encoding="utf-8"))
    roads = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[120.98, 14.55], [121.07, 14.65]]}},
        {"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[123.88, 10.29], [123.93, 10.35]]}}]}
    return {"version": 8, "name": "BahaWatch offline test",
            "sources": {"land": {"type": "geojson", "data": {"type": "Feature", "properties": {}, "geometry": outline}},
                        "roads": {"type": "geojson", "data": roads}},
            "layers": [{"id": "water", "type": "background", "paint": {"background-color": p["sea"]}},
                       {"id": "land", "type": "fill", "source": "land", "paint": {"fill-color": p["land"]}},
                       {"id": "road-major", "type": "line", "source": "roads", "paint": {"line-color": p["casing"], "line-width": 3}}]}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    write(os.path.join(ROOT, "shared", "basemap-style.json"), style("light"))
    write(os.path.join(ROOT, "shared", "basemap-style-dark.json"), style("dark"))
    write(os.path.join(ROOT, "tests", "fixtures", "basemap-offline.json"), fixture())
    print("wrote shared/basemap-style.json, shared/basemap-style-dark.json, tests/fixtures/basemap-offline.json")
```

Run: `cd /home/claude/work && python3 tools/basemap_style.py && ls -la shared/basemap-style*.json tests/fixtures/basemap-offline.json`
Expected: the "wrote …" line; three files. The fixture is ≈ 35 KB (it includes the outline).

- [ ] **Step 5: Write `shared/basemap.js`**

```js
// The vector basemap (spec §4.2, §4.3): the vendored MapLibre GL JS opens OpenFreeMap tiles in our own style, with a
// hard limit — no WebGL, a failed library or style, or no tile within 8 s, and the caller keeps its outline map.
// Pure helpers (clustering, box maths, coverage, view fitting) are tested in basemap.test.js; build_html.py inlines
// this file into the page with its `export`s removed.
export const BW_LIB = "lib/maplibre-gl-6.11.2/";
export const BW_TIMEOUT_MS = 8000;
export const BW_M_PER_DEG_LAT = 110640;                      // pipeline/common.py's constants
export const BW_BOX_HALF_M = 1500;

// Screen points closer than r px become one cluster, in list order; its position is the members' mean.
export function bwCluster(pts, r) {
  const gs = [];
  for (const p of pts) {
    const g = gs.find((g) => Math.hypot(g.x0 - p.x, g.y0 - p.y) < r);
    if (g) { g.ids.push(p.id); g.sx += p.x; g.sy += p.y; } else gs.push({ x0: p.x, y0: p.y, sx: p.x, sy: p.y, ids: [p.id] });
  }
  return gs.map((g) => ({ x: g.sx / g.ids.length, y: g.sy / g.ids.length, ids: g.ids }));
}
// How much of the view's shorter side the box (in px) spans: 1 = it fills it. The country view hands back at ≥ 0.9.
export function bwCoverage(b, w, h) {
  return Math.max(Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)) / Math.max(1, Math.min(w, h));
}
// Grow a viewBox [x, y, w, h] around its centre to the box's shape, so nothing is stretched.
export function bwFitVB(vb, w, h) {
  let [x, y, vw, vh] = vb; const ar = (w || 1) / (h || 1);
  if (vw / vh < ar) { const n = vh * ar; x -= (n - vw) / 2; vw = n; } else { const n = vw / ar; y -= (n - vh) / 2; vh = n; }
  return [x, y, vw, vh];
}
// A campus's 3 km box, [[west, south], [east, north]], exactly as pipeline/common.py box_around() cuts it.
export function bwCampusBox(lat, lon) {
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const dx = BW_BOX_HALF_M / (111320 * Math.cos(lat * Math.PI / 180)), dy = BW_BOX_HALF_M / BW_M_PER_DEG_LAT;
  return [[r6(lon - dx), r6(lat - dy)], [r6(lon + dx), r6(lat + dy)]];
}
export function bwStyleUrl(theme) {
  const o = typeof window !== "undefined" && window.BW_BASEMAP_STYLE;
  return o || "shared/basemap-style" + (theme === "dark" ? "-dark" : "") + ".json";
}
export function bwHasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}
let bwLib = null;
// The library, loaded once; rejects (so the caller keeps its outline) without WebGL or when the files don't load.
export function bwLoadMapLibre() {
  if (bwLib) return bwLib;
  bwLib = new Promise((res, rej) => {
    if (window.BW_NO_BASEMAP) return rej(new Error("basemap turned off"));
    if (!bwHasWebGL()) return rej(new Error("no WebGL"));
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = BW_LIB + "maplibre-gl.css"; document.head.appendChild(l);
    import("./" + BW_LIB + "maplibre-gl.mjs").then((m) => res(m.Map ? m : m.default), rej);
  });
  return bwLib;
}
// A map in `container`, resolved at its first `idle` after a tile has arrived; rejected (and removed) on a style error
// before any tile, or after the time limit with no tile. Tile errors after that are ignored.
export function bwOpenMap(lib, container, o) {
  return new Promise((res, rej) => {
    let done = false, gotTile = false, map = null, t = 0;
    const fail = (e) => {
      if (done) return; done = true; clearTimeout(t);
      try { if (map) map.remove(); } catch (x) { /* already gone */ }
      rej(e instanceof Error ? e : new Error(String((e && e.error) || e)));
    };
    t = setTimeout(() => fail(new Error("no tile within " + (o.timeout || BW_TIMEOUT_MS) + " ms")), o.timeout || BW_TIMEOUT_MS);
    try {
      map = new lib.Map({ container, style: bwStyleUrl(o.theme), bounds: o.bounds, fitBoundsOptions: { padding: o.padding ?? 24 },
        minZoom: o.minZoom ?? 3, maxZoom: 17, attributionControl: false, dragRotate: false, pitchWithRotate: false,
        touchPitch: false, fadeDuration: o.reduced ? 0 : 300 });
    } catch (e) { fail(e); return; }
    map.touchZoomRotate.disableRotation(); map.keyboard.disableRotation();
    map.on("error", (e) => { if (!gotTile && !map.isStyleLoaded()) fail(e); });
    map.on("sourcedata", (e) => { if (e.tile) gotTile = true; });
    map.on("idle", () => { if (done || !gotTile) return; done = true; clearTimeout(t); res(map); });
  });
}
```

- [ ] **Step 6: Inline it, bump the service worker, teach the test server the offline style**

```bash
cd /home/claude/work && python3 - <<'PY'
p="build_html.py"; s=open(p,encoding="utf-8").read()
a='verdict, flood = strip("shared/verdict.js"), strip("shared/flood.js")\n'
assert s.count(a)==1; s=s.replace(a,'verdict, flood, basemap = strip("shared/verdict.js"), strip("shared/flood.js"), strip("shared/basemap.js")\n')
a='"/*__VERDICT_JS__*/", "/*__FLOOD_JS__*/",'
assert s.count(a)==1; s=s.replace(a,'"/*__VERDICT_JS__*/", "/*__FLOOD_JS__*/", "/*__BASEMAP_JS__*/",')
a='.replace("/*__FLOOD_JS__*/", flood)'
assert s.count(a)==1; s=s.replace(a,a+'.replace("/*__BASEMAP_JS__*/", basemap)')
open(p,"w",encoding="utf-8").write(s)
p="template.html"; s=open(p,encoding="utf-8").read()
a="/* ---------- the national map: PhilDev partner campuses ---------- */\n"
assert s.count(a)==1; s=s.replace(a,"/*__BASEMAP_JS__*/\n"+a)
open(p,"w",encoding="utf-8").write(s)
p="sw.js"; s=open(p).read()
assert s.count("bahawatch-v2")==1; s=s.replace("bahawatch-v2","bahawatch-v3")
a="  if (e.request.method !== 'GET' || u.origin !== location.origin) return;          // API calls: network only\n"
assert s.count(a)==1; s=s.replace(a,"  if (e.request.method !== 'GET' || u.origin !== location.origin) return;          // API calls, map tiles and fonts: network only\n")
open(p,"w").write(s)
p="tools/test_server.js"; s=open(p).read()
a="'.webmanifest': 'application/manifest+json',"
assert s.count(a)==1; s=s.replace(a,a+" '.mjs': 'text/javascript',")
a="    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\\/+/, '') || 'index.html';\n"
b="""    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname).replace(/^\\/+/, '') || 'index.html';
    // BW_TEST_BASEMAP=offline: the basemap styles point at tiles.openfreemap.org, which the test machine can't reach, so
    // they are served as the offline test style — unless a test asks for the real one with ?real
    if (process.env.BW_TEST_BASEMAP === 'offline' && /^shared\\/basemap-style(-dark)?\\.json$/.test(rel) && !url.searchParams.has('real'))
      rel = 'tests/fixtures/basemap-offline.json';
"""
assert s.count(a)==1; s=s.replace(a,b)
open(p,"w").write(s)
p="test_pages.sh"; s=open(p).read()
a="node tools/test_server.js > /tmp/bw_test_server.log 2>&1 & SRV=$!"
assert s.count(a)==1; s=s.replace(a,"BW_TEST_BASEMAP=offline node tools/test_server.js > /tmp/bw_test_server.log 2>&1 & SRV=$!")
open(p,"w").write(s)
PY
python3 build_html.py && grep -c "function bwOpenMap" bahawatch_dashboard.html
```

Expected: `bahawatch_dashboard.html written …`, then `1`.

- [ ] **Step 7: Run the tests to verify they pass**

Run:
```bash
cd /home/claude/work && node --test --no-warnings shared/*.test.js sw.test.js 2>&1 | grep -E '^# (pass|fail)' && python3 -m unittest tools.test_basemap_style 2>&1 | tail -2 && BW_TEST_BASEMAP=offline node -e "
require('./tools/test_server.js').start(8799).then(async s=>{const g=async u=>{const r=await fetch('http://127.0.0.1:8799/'+u);return [r.status,r.headers.get('content-type'),(await r.text()).slice(0,40)];};
console.log(await g('shared/basemap-style.json'));console.log(await g('shared/basemap-style.json?real'));console.log(await g('lib/maplibre-gl-6.11.2/maplibre-gl.mjs'));s.close();});"
```

Expected:
- `# pass 36`, `# fail 0` (28 before, plus 6 basemap tests, plus 1 v3 test that replaces the old one, plus the tiles guard);
- the Python test ends `OK` (5 tests);
- the three fetches show:
  - `[200, 'application/json', '{"version":8,"name":"BahaWatch offline test"'…]`;
  - `…"name":"BahaWatch light"…`;
  - `[200, 'text/javascript', '/**…']`.

- [ ] **Step 8: Run every suite, then commit**

Run: `cd /home/claude/work && ./test_pages.sh && gzip -c bahawatch_dashboard.html | wc -c`
Expected: every suite `ok` (nothing uses the basemap yet); ≤ 256000.

```bash
cd /home/claude/work && git add lib shared/basemap.js shared/basemap.test.js shared/basemap-style.json shared/basemap-style-dark.json tests tools/basemap_style.py tools/test_basemap_style.py tools/test_server.js test_pages.sh build_html.py template.html bahawatch_dashboard.html sw.js sw.test.js && git commit -q -m "Basemap foundation: MapLibre 6.11.2 vendored, our OpenFreeMap styles (light, dark, offline test), loader with an 8 s limit, helpers tested; SW v3" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 5: The PhilDev tab: full-window map and list on the vector basemap (spec §4, §7)

**Files:**
- Modify:
  - `template.html`:
    - replace the national CSS block (the `.nat-inner{` line through the `.nat-foot{` line);
    - replace the `<section id="nat">` markup;
    - replace the national JS (from `/* ---------- the national map: PhilDev partner campuses ---------- */` through the end of `natEnter`);
    - add a hook in `setTheme`.
  - `i18n/nat.json` (drop `zoomOut`, `pilots`, `tryLink` and `shapes`).
- Test: `test_national.js` (rewritten), `test_a11y.js`

**Interfaces:**
- Consumes:
  - `bwCluster`, `bwFitVB`, `bwCampusBox`, `bwStyleUrl`, `bwLoadMapLibre`, `bwOpenMap` (Task 4);
  - `NL().typesShort|zin|zout|home|open|mapNote|sea|credit` (Task 2);
  - `--sea` and `.sea-sw` (Task 3).
- Produces, as page globals:
  - `natProj(lon,lat)`, `phOutline()`, `PH_PATH`, `PH_BOUNDS` (`[[W,S],[E,N]]`), `phVB()`;
  - `pinHTML(campus, extraClass)`, `clusterHTML(ids)`;
  - `curTheme()`, `natDur(ms)`, `natBusy()`;
  - `NAT`, `NATGL` (`{map,state:"none"|"loading"|"on"|"off",theme}`);
  - `bwThemeChanged(t)`, which calls `countryThemeChanged(t)` once Task 6 defines it;
  - the elements `#nat-gl`, `#nat-pins`, `#nat-box`, `#nat-zin`, `#nat-zout`, `#nat-home`, `#nat-open`, `#nat-legend`, `#nat-credit`, `#nat-note`.

- [ ] **Step 1: Write the failing tests**

Replace `test_national.js` with:

```bash
cd /home/claude/work && cat > test_national.js <<'JS'
// The national map (spec §4): a full-window map and a side list; the vector basemap with an outline fallback; pins,
// clusters, fly-to with the campus box and "Open"; search; smooth zoom. Run: ./test_pages.sh test_national.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
const settle=pg=>pg.waitForFunction(()=>!natBusy(),null,{timeout:10000}).then(()=>pg.waitForTimeout(80));
const glUp=pg=>pg.waitForFunction(()=>NATGL.state==="on"||NATGL.state==="off",null,{timeout:15000}).then(()=>pg.evaluate(()=>NATGL.state));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  for(const mode of ["vector","outline"]){
    const ctx=await b.newContext({viewport:{width:1280,height:900}});
    if(mode==="outline")await ctx.addInitScript(()=>{window.BW_NO_BASEMAP=true;});
    const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto(U);await ready(pg,"ph");
    const st=await glUp(pg);
    assert(st===(mode==="vector"?"on":"off"),`${mode}: basemap state ${st}`);
    if(mode==="outline")assert(await pg.evaluate(()=>!document.getElementById('nat-note').hidden&&document.getElementById('nat-note').textContent==="Detailed map needs an internet connection."),"outline: the note says the detailed map needs an internet connection");
    else assert(await pg.evaluate(()=>document.getElementById('nat-note').hidden&&document.body.dataset.natgl==="1"&&getComputedStyle(document.getElementById('nat-svg')).visibility==="hidden"),"vector: the basemap replaced the outline, no note");
    let s=await pg.evaluate(()=>{
      const pins=[...document.querySelectorAll('#nat-pins .pin')],cl=[...document.querySelectorAll('#nat-pins .pin-cluster')],m=document.getElementById('nat-map').getBoundingClientRect();
      return {n:CAMPUSES.length,shown:pins.length+cl.reduce((a,c)=>a+c.dataset.ids.split(",").length,0),
        inside:[...pins,...cl].every(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>=m.left&&x<=m.right&&y>=m.top&&y<=m.bottom;}),
        labels:pins.every(p=>/: .+, .+\. (State|Local|Private)/.test(p.getAttribute('aria-label'))),text:pins.every(p=>p.querySelector('.pin-t').textContent.length>1),
        clusters:cl.map(c=>c.getAttribute('aria-label')),legend:[...document.querySelectorAll('#nat-legend li')].map(l=>l.textContent),
        credit:document.getElementById('nat-credit').textContent,desc:document.getElementById('nat-desc').textContent,title:document.title,
        tabs:[...document.querySelectorAll('#nat .site-tabs [role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":""))};});
    assert(s.n===25&&s.shown===25&&s.inside,`${mode}: all 25 campuses are on the map, as pins or in clusters, inside the map box: ${s.shown}`);
    assert(s.labels&&s.text,`${mode}: each pin has a visible short label and a full spoken label`);
    assert(s.clusters.length>=1&&s.clusters.every(c=>/^\d+ campuses: .+Zoom in$/.test(c)),`${mode}: crowded pins become a cluster that says how many and which`);
    assert(s.legend.join("|")==="State|Local|Private|Sea",`${mode}: legend: the pin types and the sea: ${s.legend}`);
    assert(s.credit==="© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre",`${mode}: map credits`);
    assert(s.desc==="Map of the Philippines with 25 PhilDev partner campuses: 17 in Luzon, 5 in Visayas, 3 in Mindanao. The campus list has the same campuses.",`${mode}: screen-reader description`);
    assert(s.tabs.join()==="ph*,tv,berkeley,try"&&/PhilDev partner campuses/.test(s.title),`${mode}: tabs and title`);
    s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-list h2')].map(h=>h.dataset.group+h.dataset.n+":"+h.nextElementSibling.children.length));
    assert(s.join()==="Luzon17:17,Visayas5:5,Mindanao3:3",`${mode}: list grouped Luzon 17, Visayas 5, Mindanao 3`);
    s=await pg.evaluate(()=>({pilots:!!document.getElementById('nat-pilots-h')||[...document.querySelectorAll('#nat a')].some(a=>/^#(tv|berkeley|try)$/.test(a.getAttribute('href')||"")),
      rows:[...document.querySelectorAll('#nat-list .nat-item')].slice(0,2).map(a=>a.textContent)}));
    assert(!s.pilots,`${mode}: no Pilot sites or Try reporting in the list (they are tabs)`);
    assert(s.rows.every(t=>!/ · /.test(t))&&s.rows[0]==="BatStateU Batangas State UniversityBatangas City, Batangas",`${mode}: list rows are two plain lines: ${s.rows[0]}`);
    // search: accents, case, city names; announced once typing pauses
    const find=async q=>{await pg.fill('#nat-q',q);await pg.waitForTimeout(500);return pg.evaluate(()=>({ids:[...document.querySelectorAll('#nat-list .nat-item')].map(a=>a.dataset.id),count:document.getElementById('nat-count').textContent,none:document.getElementById('nat-list').textContent}));};
    for(const [q,want] of [["Xavier",["xu"]],["xavier",["xu"]],["UPLB",["uplb"]],["banos",["uplb"]],["mapua",["mapua"]],["Iligan",["msuiit"]],["cebu city",["ctu","usc","upc"]]]){
      s=await find(q);assert(s.ids.join()===want.join(),`${mode}: search "${q}" finds ${want}: ${s.ids}`);}
    s=await find("Xavier");assert(s.count==="1 campus matches.",`${mode}: search announces how many matched`);
    s=await find("zzz");assert(s.ids.length===0&&/No campus matches “zzz”/.test(s.none),`${mode}: no match says so`);
    await pg.fill('#nat-q','');await pg.waitForTimeout(450);
    // zoom: a cluster zooms in and separates pins; + − ⌂ zoom smoothly
    const before=await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length);
    await pg.click('#nat-pins .pin-cluster');await settle(pg);
    s=await pg.evaluate(()=>({pins:document.querySelectorAll('#nat-pins .pin').length,focus:!!document.activeElement.closest('#nat-pins')}));
    assert(s.pins>before&&s.focus,`${mode}: a cluster zooms in to separate pins and keeps focus on the map: ${before} → ${s.pins}`);
    for(let i=0;i<4&&await pg.$('#nat-pins .pin-cluster');i++){await pg.click('#nat-pins .pin-cluster');await settle(pg);}
    assert(await pg.evaluate(()=>!document.querySelector('#nat-pins .pin-cluster')||document.querySelectorAll('#nat-pins .pin').length>1),`${mode}: zooming further separates even the closest campuses`);
    await pg.click('#nat-home');await settle(pg);
    assert(await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length)===before,`${mode}: ⌂ returns to the whole country`);
    const zoomState=()=>pg.evaluate(()=>NATGL.state==="on"?NATGL.map.getZoom():NAT.full[2]/NAT.vb[2]);
    const z0=await zoomState();await pg.click('#nat-zin');
    const mid=await pg.evaluate(()=>natBusy());await settle(pg);const z1=await zoomState();
    assert(z1>z0&&mid,`${mode}: + zooms in smoothly (still moving right after the click): ${z0.toFixed(2)} → ${z1.toFixed(2)}`);
    await pg.click('#nat-zout');await settle(pg);
    assert(Math.abs(await zoomState()-z0)<0.05,`${mode}: − zooms back out`);
    // a list row flies the map to the campus, outlines its box and offers "Open XU"; Open opens the campus
    await pg.click('#nat-list a[data-id="xu"]');await settle(pg);
    s=await pg.evaluate(()=>{const o=document.getElementById('nat-open'),bx=document.getElementById('nat-box').getBoundingClientRect(),m=document.getElementById('nat-map').getBoundingClientRect(),
      pin=document.querySelector('#nat-pins .pin[data-id="xu"]');
      return {route:ROUTE,open:!o.hidden&&o.textContent==="Open XU"&&o.getAttribute('href')==="#xu",focus:document.activeElement===o,
        box:!document.getElementById('nat-box').hidden&&bx.width>=12&&bx.left>=m.left&&bx.right<=m.right,sel:!!pin&&pin.classList.contains('pin-sel')};});
    assert(s.route==="ph"&&s.open&&s.focus&&s.box&&s.sel,`${mode}: choosing XU in the list flies there, draws its box, offers 'Open XU' with focus: `+JSON.stringify(s));
    await pg.click('#nat-open');await ready(pg,"xu");
    assert(await pg.evaluate(()=>SITE==="xu"&&location.hash==="#xu"),`${mode}: 'Open XU' opens its page`);
    await pg.goBack();await ready(pg,"ph");
    assert(await pg.evaluate(()=>ROUTE==="ph"&&getComputedStyle(document.getElementById('nat')).display!=="none"),`${mode}: Back returns to the national map`);
    // a pin works the same way
    await pg.click('#nat-home');await settle(pg);
    await pg.click('#nat-pins .pin >> nth=0');await settle(pg);
    s=await pg.evaluate(()=>({route:ROUTE,open:!document.getElementById('nat-open').hidden}));
    assert(s.route==="ph"&&s.open,`${mode}: choosing a pin selects it on the map and offers Open`);
    // Review Focus 5: a language change reaches our words on the map (the map's own place names are not ours)
    await pg.selectOption('#nat-lang','fil');await pg.waitForTimeout(150);
    s=await pg.evaluate(()=>({pin:document.querySelector('#nat-pins .pin').getAttribute('aria-label'),legend:document.getElementById('nat-legend').textContent,open:document.getElementById('nat-open').textContent,zin:document.getElementById('nat-zin').getAttribute('aria-label')}));
    assert(/(ng estado|unibersidad o kolehiyo|Pribado)\.$/.test(s.pin)&&/Dagat/.test(s.legend)&&/^Buksan ang /.test(s.open)&&s.zin==="Palakihin",`${mode}: Filipino reaches the pins, legend, Open and the zoom buttons: `+JSON.stringify(s));
    await pg.selectOption('#nat-lang','en');await pg.waitForTimeout(150);
    // Review Focus 3: a resize keeps the map filling its box and every pin inside it
    await pg.setViewportSize({width:1000,height:700});await pg.waitForTimeout(400);await settle(pg);
    s=await pg.evaluate(()=>{const m=document.getElementById('nat-map').getBoundingClientRect(),g=document.querySelector('#nat-gl canvas');
      return {fill:!g||Math.abs(g.getBoundingClientRect().width-m.width)<=2,inside:[...document.querySelectorAll('#nat-pins > *')].every(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>=m.left-1&&x<=m.right+1&&y>=m.top-1&&y<=m.bottom+1;})};});
    assert(s.fill&&s.inside,`${mode}: after a resize the map fills its box and every pin is inside it`);
    // Review Focus 2: a theme switch restyles the vector map and keeps the overlays
    const n0=await pg.evaluate(()=>document.querySelectorAll('#nat-pins > *').length);
    await pg.click('#nat-theme');await pg.waitForTimeout(600);
    s=await pg.evaluate(()=>({theme:NATGL.theme,n:document.querySelectorAll('#nat-pins > *').length,open:!document.getElementById('nat-open').hidden}));
    assert((mode==="outline"||s.theme==="dark")&&s.n===n0&&s.open,`${mode}: switching theme restyles the map and keeps the pins and Open: `+JSON.stringify(s));
    await pg.click('#nat-theme');
    assert(errs.length===0,`${mode}: no page errors: `+errs.join("; "));
    await ctx.close();
  }
  // Review Focus 1: the real style with its tiles unreachable: the outline, pins and note within 8 s, no late switch
  {const ctx=await b.newContext({viewport:{width:1280,height:900}});
   await ctx.addInitScript(()=>{window.BW_BASEMAP_STYLE="shared/basemap-style.json?real";});
   const pg=await ctx.newPage();const t0=Date.now();await pg.goto(U);await ready(pg,"ph");
   await pg.waitForFunction(()=>NATGL.state==="off"||NATGL.state==="on",null,{timeout:12000});
   const dt=Date.now()-t0;
   const s=await pg.evaluate(()=>({st:NATGL.state,note:!document.getElementById('nat-note').hidden,pins:document.querySelectorAll('#nat-pins > *').length,gl:document.body.dataset.natgl}));
   assert(s.st==="off"&&s.note&&s.pins>0&&!s.gl&&dt<=10000,`tiles unreachable: the outline, pins and the note after ${dt} ms`);
   await pg.waitForTimeout(3000);
   assert(await pg.evaluate(()=>NATGL.state==="off"&&!document.body.dataset.natgl),"no late switch to the vector map in the same visit");
   await ctx.close();}
  // no WebGL: the outline stays
  {const b2=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--disable-webgl','--disable-3d-apis']});
   const pg=await b2.newPage({viewport:{width:1280,height:900}});await pg.goto(U);await ready(pg,"ph");
   const st=await glUp(pg);
   assert(st==="off"&&await pg.evaluate(()=>!document.getElementById('nat-note').hidden),"no WebGL: the outline stays, with the note");
   await b2.close();}
  // narrow screens: the map above the list; a list row opens the campus directly (plan ruling 5)
  {const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();await pg.goto(U);await ready(pg,"ph");
   const s=await pg.evaluate(()=>({mapTop:document.querySelector('.nat-mapcol').getBoundingClientRect().top,listTop:document.querySelector('.nat-listcol').getBoundingClientRect().top,sw:document.documentElement.scrollWidth}));
   assert(s.mapTop<s.listTop&&s.sw<=390,"390 px: the map sits above the list, no sideways scroll");
   await pg.click('#nat-list a[data-id="xu"]');await ready(pg,"xu");
   assert(await pg.evaluate(()=>location.hash==="#xu"),"390 px: a list row opens the campus directly");
   await ctx.close();}
  await b.close();
})();
JS
python3 - <<'PY'
p="test_a11y.js"; s=open(p).read()
a="getComputedStyle(document.getElementById('nat-map')).backgroundColor"
assert s.count(a)==1; s=s.replace(a,"getComputedStyle(document.getElementById('nat-land')).fill")    # pins sit on land; the map box is now sea
a='"the theme button works on the national map before any site is opened");\n'
b=a+'''  // wide screens: the national tab is one screen; only the campus list scrolls (spec §4.1)
  const one=await pg.evaluate(()=>{const l=document.querySelector('#nat .nat-listcol'),cs=getComputedStyle(l);return {page:document.scrollingElement.scrollHeight,vh:innerHeight,list:l.scrollHeight>l.clientHeight,ov:cs.overflowY};});
  assert(one.page<=one.vh+1&&one.list&&one.ov==="auto","1280 px national tab: the page doesn't scroll, the campus list does: "+JSON.stringify(one));
'''
assert s.count(a)==1; s=s.replace(a,b); open(p,"w").write(s)
PY
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /home/claude/work && ./test_pages.sh test_national.js test_a11y.js`

Expected:
- `FAIL test_national.js` (e.g. `NATGL is not defined` inside `waitForFunction`: a timeout);
- `FAIL: 1280 px national tab: the page doesn't scroll…`.

- [ ] **Step 3: Replace the national CSS, markup and code**

```bash
cd /home/claude/work && python3 - <<'PY'
import json
p="template.html"; s=open(p,encoding="utf-8").read()
def block(start,end,new):
    global s
    i=s.index(start); j=s.index(end,i)+len(end); assert s.count(start)==1; s=s[:i]+new+s[j:]
# --- CSS: the .nat-inner line through the .nat-foot line
i=s.index(".nat-inner{"); j=s.index("\n",s.index(".nat-foot{",i))+1
s=s[:i]+NAT_CSS+s[j:]
# --- markup
block('<section id="nat" aria-labelledby="nat-h">',"</section>",NAT_HTML)
# --- code
block("/* ---------- the national map: PhilDev partner campuses ---------- */",
      '  if(natFocusSearch){natFocusSearch=false;$("nat-q").focus();}}',NAT_JS)
# --- a theme switch restyles the vector maps
a="  document.documentElement.dataset.theme=t;\n"
assert s.count(a)==1; s=s.replace(a,a+'  if(typeof bwThemeChanged==="function")bwThemeChanged(t);\n')
open(p,"w",encoding="utf-8").write(s)
# --- strings nobody uses any more
q="i18n/nat.json"; d=json.load(open(q,encoding="utf-8"))
for l in d.values():
    for k in ("zoomOut","pilots","tryLink","shapes"): l.pop(k)
json.dump(d,open(q,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
PY
```

where the script's three constants are defined at its top, exactly as follows.

`NAT_CSS = r'''` … `'''`:

```css
.nat-inner{margin:0; padding:14px 24px 16px}
.nat-top{display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:8px}
.nat-top .p-tools{margin-left:auto; display:flex; gap:8px; align-items:center}
.nat-top .p-tools button, .nat-top .p-tools select{min-height:48px; min-width:48px}
#nat-theme{border:1px solid var(--ink); border-radius:4px; background:var(--panel); color:var(--ink); font-size:16px}
.nat-h{font-size:20px; font-weight:700}
/* split pane (page pattern): the list on the left, the map filling the rest */
.nat-body{display:grid; grid-template-columns:360px minmax(0,1fr); gap:24px; margin-top:12px}
.nat-listcol,.nat-mapcol{min-width:0}
.nat-intro{max-width:72ch; margin:0 0 16px; font-size:16px}
.nat-map{position:relative; width:100%; height:calc(100dvh - 160px); min-height:420px; background:var(--sea); border:1px solid var(--ink); border-radius:6px; overflow:hidden}
@media (min-width:900px){
  body[data-route="ph"]{overflow:hidden}
  #nat .nat-inner{height:100dvh; display:flex; flex-direction:column}
  #nat .nat-body{flex:1; min-height:0}
  #nat .nat-listcol{overflow-y:auto; min-height:0; padding-right:8px}
  #nat .nat-mapcol{display:flex; flex-direction:column; min-height:0}
  #nat .nat-map{flex:1; height:auto; min-height:0}
}
@media (max-width:899px){
  .nat-body{grid-template-columns:1fr}
  .nat-mapcol{order:-1}
  .nat-map{height:60vh; min-height:300px}
}
#nat-svg{position:absolute; inset:0; width:100%; height:100%}
#nat-land{fill:var(--map-bg); stroke:var(--ink-2); stroke-width:1; vector-effect:non-scaling-stroke}
#nat-gl{position:absolute; inset:0; opacity:0; transition:opacity .3s}
body[data-natgl="1"] #nat-gl{opacity:1}
body[data-natgl="1"] #nat-svg{visibility:hidden}
.nat-pins{position:absolute; inset:0; pointer-events:none; z-index:2}
.nat-pins > *{pointer-events:auto}
.pin,.pin-cluster{position:absolute; transform:translate(-50%,-50%); width:48px; height:48px; display:flex; align-items:center; justify-content:center}
.pin{color:var(--ink); text-decoration:none}
.pin-shape{display:inline-block; flex:none; width:16px; height:16px; background:var(--pin); filter:drop-shadow(0 0 1px var(--bg)) drop-shadow(0 0 1px var(--bg))}
.pin-suc{--pin:var(--pin-suc)} .pin-luc{--pin:var(--pin-luc)} .pin-private{--pin:var(--pin-pvt)}
.pin-suc .pin-shape, .pin-shape.pin-suc{border-radius:50%}
.pin-private .pin-shape, .pin-shape.pin-private{clip-path:polygon(50% 0,100% 100%,0 100%); width:18px; height:17px}
.pin-t{position:absolute; left:34px; top:50%; transform:translateY(-50%); white-space:nowrap; font-size:12px; font-weight:700; color:var(--ink); background:var(--map-bg); padding:0 3px; border-radius:3px; pointer-events:none}
.pin-cluster span{min-width:32px; height:32px; border-radius:16px; background:var(--ink); color:var(--bg); font-weight:700; display:flex; align-items:center; justify-content:center; padding:0 6px}
.pin-sel .pin-shape{outline:3px solid var(--ink); outline-offset:3px}
.pin-hl .pin-shape{outline:3px solid var(--brand); outline-offset:3px}
.pin:focus-visible,.pin-cluster:focus-visible,.nat-item:focus-visible,.nat-btn:focus-visible,.nat-q:focus-visible,.nat-zoom button:focus-visible{outline:3px solid var(--brand); outline-offset:2px; border-radius:6px}
.nat-box{position:absolute; z-index:1; border:2px dashed var(--ink); pointer-events:none}
.nat-box[hidden]{display:none}
.nat-zoom{position:absolute; top:12px; right:12px; z-index:3; display:flex; flex-direction:column; gap:4px}
.nat-zoom button{width:48px; height:48px; border:1px solid var(--ink); border-radius:6px; background:var(--panel); color:var(--ink); font-size:20px; font-weight:700}
.nat-btn{min-height:48px; padding:0 14px; border:2px solid var(--ink); border-radius:6px; font-weight:700; background:var(--panel); color:var(--ink); display:inline-flex; align-items:center; text-decoration:none}
.nat-open{position:absolute; right:12px; bottom:12px; z-index:3}
.nat-open[hidden]{display:none}
.nat-legend{position:absolute; left:12px; bottom:44px; z-index:3; list-style:none; margin:0; padding:6px 10px; display:flex; flex-wrap:wrap; gap:4px 14px; font-size:14px; background:var(--panel); border:1px solid var(--line); border-radius:6px; max-width:calc(100% - 96px)}
.nat-legend li{display:flex; align-items:center; gap:6px}
.nat-credit{position:absolute; left:12px; bottom:10px; z-index:3; margin:0; font-size:12px; color:var(--ink-2); background:var(--panel); padding:2px 6px; border-radius:4px}
.nat-note{margin:8px 0 0; color:var(--ink)}
.nat-note[hidden]{display:none}
.nat-ql{display:block; font-weight:700; margin-bottom:6px}
.nat-q{width:100%; min-height:48px; font:inherit; font-size:16px; padding:0 12px; border:2px solid var(--ink); border-radius:6px; background:var(--panel); color:var(--ink)}
.nat-count{min-height:1.4em; margin:6px 0; color:var(--ink-2)}
.nat-g{font-size:16px; font-weight:700; margin:16px 0 4px}
.nat-ul{list-style:none; padding:0; margin:0}
.nat-item{display:grid; grid-template-columns:24px 1fr; align-items:center; column-gap:8px; min-height:48px; padding:6px 4px; border-bottom:1px solid var(--line); color:var(--ink); text-decoration:none; font-size:16px}
.nat-item .pin-shape{justify-self:center}
.nat-item:hover .nat-name b{text-decoration:underline}
.nat-where{grid-column:2; color:var(--ink-2); font-size:14px}
.nat-foot{font-size:12px; color:var(--ink-2); margin-top:20px}
@media (prefers-reduced-motion: reduce){#nat-gl{transition:none}}
```

`NAT_HTML = r'''` … `'''`:

```html
<section id="nat" aria-labelledby="nat-h">
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
  <div class="nat-body">
    <div class="nat-listcol">
      <p class="nat-intro" id="nat-intro"></p>
      <label class="nat-ql" for="nat-q" id="nat-q-l"></label>
      <input class="nat-q" type="search" id="nat-q" autocomplete="off" aria-describedby="nat-count">
      <p class="nat-count" id="nat-count" role="status" aria-live="polite"></p>
      <div id="nat-list"></div>
      <p class="nat-foot" id="nat-foot"></p>
    </div>
    <div class="nat-mapcol">
      <div class="nat-map" id="nat-map" role="group" aria-labelledby="nat-map-l" aria-describedby="nat-desc">
        <svg id="nat-svg" aria-hidden="true" focusable="false" preserveAspectRatio="none"><path id="nat-land"/></svg>
        <div id="nat-gl"></div>
        <div class="nat-box" id="nat-box" hidden></div>
        <div class="nat-pins" id="nat-pins"></div>
        <div class="nat-zoom"><button id="nat-zin">+</button><button id="nat-zout">−</button><button id="nat-home">⌂</button></div>
        <ul class="nat-legend" id="nat-legend"></ul>
        <p class="nat-credit" id="nat-credit"></p>
        <a class="nat-btn nat-open" id="nat-open" hidden></a>
      </div>
      <p class="nat-note" id="nat-note" role="status" hidden></p>
      <span class="sr-only" id="nat-map-l"></span>
      <p class="sr-only" id="nat-desc"></p>
    </div>
  </div>
 </div>
</section>
```

`NAT_JS = r'''` … `'''`:

```js
/* ---------- the national map: PhilDev partner campuses ---------- */
// The outline (SVG, drawn first, always) and, when it loads, the vector basemap (spec §4). Pins, clusters and the chosen
// campus's box are our HTML overlay, placed through natPx(): the vector map's projection when it is up, the outline's
// viewBox otherwise (plan ruling 4).
const K_LAT=Math.cos(12.5*Math.PI/180);
const natProj=(lon,lat)=>[(lon-116)*K_LAT*100,(22-lat)*100];   // outline units; 100 per degree of latitude
const NAT={vb:null,full:null,built:false,sel:null,hl:null,anim:0};
const NATGL={map:null,state:"none",theme:null};                // none → loading → on | off (the outline stays)
let PH_PATH="",PH_BOUNDS=null;
const curTheme=()=>document.documentElement.dataset.theme==="dark"?"dark":"light";
const natDur=ms=>reducedMotion?0:ms;
const norm=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();   // "banos" finds "Baños"
const pinLabel=c=>`${c.short}: ${c.name}, ${c.city}, ${c.province}. ${NL().types[c.type]}.`;
function phOutline(){
  if(PH_PATH)return;
  let d="",lo0=1e9,la0=1e9,lo1=-1e9,la1=-1e9;
  for(const poly of PH_OUTLINE.coordinates)for(const ring of poly){
    ring.forEach(([lo,la],k)=>{const [x,y]=natProj(lo,la);d+=(k?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
      lo0=Math.min(lo0,lo);lo1=Math.max(lo1,lo);la0=Math.min(la0,la);la1=Math.max(la1,la);});d+="Z";}
  PH_PATH=d;PH_BOUNDS=[[lo0,la0],[lo1,la1]];
}
function phVB(){const [[lo0,la0],[lo1,la1]]=PH_BOUNDS,[x0,y0]=natProj(lo0,la1),[x1,y1]=natProj(lo1,la0);return [x0-20,y0-20,x1-x0+40,y1-y0+40];}
const natBox=()=>$("nat-map");
function natFull(){const m=natBox();return bwFitVB(phVB(),m.clientWidth||600,m.clientHeight||600);}
function natClamp(vb){const f=NAT.full;if(vb[2]>=f[2])return f.slice();
  return [Math.max(f[0],Math.min(f[0]+f[2]-vb[2],vb[0])),Math.max(f[1],Math.min(f[1]+f[3]-vb[3],vb[1])),vb[2],vb[3]];}
// screen px inside #nat-map for a longitude/latitude, in whichever map is showing
function natPx(lon,lat){
  if(NATGL.state==="on"){const p=NATGL.map.project([lon,lat]);return [p.x,p.y];}
  const [x,y]=natProj(lon,lat),vb=NAT.vb,m=natBox();return [(x-vb[0])/vb[2]*m.clientWidth,(y-vb[1])/vb[3]*m.clientHeight];
}
const natBusy=()=>NAT.anim!==0||(NATGL.state==="on"&&NATGL.map.isMoving());
function natInit(){
  if(NAT.built)return;NAT.built=true;
  phOutline();$("nat-land").setAttribute("d",PH_PATH);
  $("nat-logo").src=document.querySelector(".p-head img").src;
  const sel=$("nat-lang");sel.innerHTML=$("p-lang").innerHTML;
  sel.addEventListener("change",()=>{LANG=sel.value;try{localStorage.setItem(LANG_KEY_PH,LANG);}catch(e){}natRender();});
  $("nat-theme").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark",true));
  $("nat-q").addEventListener("input",natList);
  $("nat-pins").addEventListener("click",natPinClick);
  $("nat-list").addEventListener("click",natRowClick);
  for(const [ev,on] of [["pointerover",1],["focusin",1],["pointerout",0],["focusout",0]])
    $("nat-list").addEventListener(ev,e=>{const a=on&&e.target.closest(".nat-item");natHighlight(a?a.dataset.id:null);});
  $("nat-zin").addEventListener("click",()=>natZoomBy(1.5));
  $("nat-zout").addEventListener("click",()=>natZoomBy(1/1.5));
  $("nat-home").addEventListener("click",natHome);
  natBox().addEventListener("wheel",natWheel,{passive:false});
  window.addEventListener("resize",()=>{if(ROUTE==="ph")natResize();});
}
function natSetView(vb){NAT.vb=vb;$("nat-svg").setAttribute("viewBox",vb.join(" "));natPins();}
function natAnimateTo(to){
  cancelAnimationFrame(NAT.anim);NAT.anim=0;
  const from=NAT.vb.slice(),t0=performance.now(),d=natDur(300);
  if(!d){natSetView(to);return;}
  const step=now=>{const k=Math.min(1,(now-t0)/d),e=1-Math.pow(1-k,3);natSetView(from.map((v,i)=>v+(to[i]-v)*e));
    NAT.anim=k<1?requestAnimationFrame(step):0;};
  NAT.anim=requestAnimationFrame(step);
}
function natZoomBy(f){
  if(NATGL.state==="on"){if(f>1)NATGL.map.zoomIn({duration:natDur(300)});else NATGL.map.zoomOut({duration:natDur(300)});return;}
  const [x,y,w,h]=NAT.vb,nw=w/f,nh=h/f;natAnimateTo(natClamp([x+(w-nw)/2,y+(h-nh)/2,nw,nh]));
}
function natHome(){if(NATGL.state==="on")NATGL.map.fitBounds(PH_BOUNDS,{padding:24,duration:natDur(600)});else natAnimateTo(NAT.full);}
function natWheel(e){
  if(NATGL.state==="on")return;                            // the vector map zooms itself
  e.preventDefault();
  const r=natBox().getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height,f=Math.exp(-e.deltaY*0.0016);
  const [x,y,w,h]=NAT.vb,nw=w/f,nh=h/f;
  natSetView(natClamp([x+px*w-px*nw,y+py*h-py*nh,nw,nh]));
}
function natResize(){
  if(!NAT.built)return;
  const m=natBox();NAT.full=natFull();
  NAT.vb=NAT.vb?natClamp(bwFitVB(NAT.vb,m.clientWidth,m.clientHeight)):NAT.full.slice();
  $("nat-svg").setAttribute("viewBox",NAT.vb.join(" "));
  if(NATGL.state==="on")NATGL.map.resize();
  natPins();
}
const pinHTML=(c,cls)=>`<a class="pin pin-${c.type.toLowerCase()}${cls||""}" href="#${c.id}" data-id="${c.id}" aria-label="${esc(pinLabel(c))}"><span class="pin-shape" aria-hidden="true"></span><span class="pin-t" aria-hidden="true">${esc(c.short)}</span></a>`;
const clusterHTML=ids=>`<button class="pin-cluster" data-ids="${ids.join(",")}" aria-label="${esc(fill(NL().cluster,{n:ids.length,names:ids.map(id=>CAMPUS_BY_ID[id].short).join(", ")}))}"><span aria-hidden="true">${ids.length}</span></button>`;
// Pins closer than 36 px become a numbered cluster; DOM order follows the list; focus survives a redraw.
function natPins(){
  if(!NAT.built||!NAT.vb)return;
  const m=natBox(),w=m.clientWidth,h=m.clientHeight,a=document.activeElement;
  const keep=a&&a.closest&&a.closest("#nat-pins")?(a.dataset.id||a.dataset.ids):null;
  const pts=CAMPUSES.map(c=>{const [x,y]=natPx(c.lon,c.lat);return {id:c.id,x,y};}).filter(p=>p.x>=-24&&p.x<=w+24&&p.y>=-24&&p.y<=h+24);
  $("nat-pins").innerHTML=bwCluster(pts,36).map(g=>{
    const html=g.ids.length===1?pinHTML(CAMPUS_BY_ID[g.ids[0]],(NAT.sel===g.ids[0]?" pin-sel":"")+(NAT.hl===g.ids[0]?" pin-hl":"")):clusterHTML(g.ids);
    return html.replace(/^<(a|button) /,`<$1 style="left:${g.x.toFixed(1)}px;top:${g.y.toFixed(1)}px" `);
  }).join("");
  if(keep){const f=[...$("nat-pins").children].find(e=>(e.dataset.id||e.dataset.ids)===keep);if(f)f.focus({preventScroll:true});}
  natBoxPlace();
}
let natPinsF=0;
const natPinsSoon=()=>{if(!natPinsF)natPinsF=requestAnimationFrame(()=>{natPinsF=0;natPins();});};
function natBoxPlace(){
  const b=$("nat-box");if(!NAT.sel){b.hidden=true;return;}
  const c=CAMPUS_BY_ID[NAT.sel],[[w0,s0],[e0,n0]]=bwCampusBox(c.lat,c.lon),[x0,y0]=natPx(w0,n0),[x1,y1]=natPx(e0,s0);
  const bw=Math.max(x1-x0,12),bh=Math.max(y1-y0,12),cx=(x0+x1)/2,cy=(y0+y1)/2;
  Object.assign(b.style,{left:(cx-bw/2)+"px",top:(cy-bh/2)+"px",width:bw+"px",height:bh+"px"});b.hidden=false;
}
function natHighlight(id){if(NAT.hl===id)return;NAT.hl=id;natPins();}
function natFocusFirstPin(){const f=$("nat-pins").querySelector("a,button");if(f)f.focus({preventScroll:true});}
function natPinClick(e){
  const cl=e.target.closest(".pin-cluster");if(cl){natZoomTo(cl.dataset.ids.split(","));return;}
  const p=e.target.closest(".pin");if(p){e.preventDefault();natSelect(p.dataset.id);}
}
function natRowClick(e){
  const a=e.target.closest(".nat-item");if(!a)return;
  if(!matchMedia("(min-width:900px)").matches)return;          // narrow: the map is above, off-screen; open the campus
  e.preventDefault();natSelect(a.dataset.id);
}
function natZoomTo(ids){
  const cs=ids.map(id=>CAMPUS_BY_ID[id]),lo=cs.map(c=>c.lon),la=cs.map(c=>c.lat);
  if(NATGL.state==="on"){
    NATGL.map.fitBounds([[Math.min(...lo),Math.min(...la)],[Math.max(...lo),Math.max(...la)]],{padding:80,maxZoom:12,duration:natDur(600)});
    NATGL.map.once("moveend",()=>{natPins();natFocusFirstPin();});return;
  }
  const ps=cs.map(c=>natProj(c.lon,c.lat)),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);
  const w=Math.max(Math.max(...xs)-Math.min(...xs),1.2)*1.8,h=Math.max(Math.max(...ys)-Math.min(...ys),1.2)*1.8;
  const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
  natAnimateTo(natClamp(bwFitVB([cx-w/2,cy-h/2,w,h],natBox().clientWidth,natBox().clientHeight)));
  setTimeout(natFocusFirstPin,natDur(300)+20);
}
// Choose a campus on the map: fly to it, outline its 3 km box, offer "Open <short>" (spec §4.2).
function natSelect(id){
  const c=CAMPUS_BY_ID[id];NAT.sel=id;
  const b=bwCampusBox(c.lat,c.lon);
  if(NATGL.state==="on")NATGL.map.fitBounds(b,{padding:60,maxZoom:15,duration:natDur(1200)});
  else{const [x0,y0]=natProj(b[0][0],b[1][1]),[x1,y1]=natProj(b[1][0],b[0][1]),p=(x1-x0)*6;
    natAnimateTo(natClamp(bwFitVB([x0-p,y0-p,x1-x0+2*p,y1-y0+2*p],natBox().clientWidth,natBox().clientHeight)));}
  const o=$("nat-open");o.href="#"+id;o.textContent=fill(NL().open,{short:c.short});o.hidden=false;
  natPins();o.focus({preventScroll:true});
}
// The vector basemap: tried once per visit; on any failure the outline stays, with the note (spec §4.3).
function natGLStart(){
  if(NATGL.state!=="none")return;NATGL.state="loading";
  bwLoadMapLibre().then(lib=>bwOpenMap(lib,$("nat-gl"),{bounds:PH_BOUNDS,theme:curTheme(),reduced:reducedMotion,padding:24,minZoom:3}))
    .then(map=>{NATGL.map=map;NATGL.state="on";NATGL.theme=curTheme();document.body.dataset.natgl="1";
      map.on("move",natPinsSoon);map.on("resize",natPinsSoon);
      if(NAT.sel){const c=CAMPUS_BY_ID[NAT.sel];map.fitBounds(bwCampusBox(c.lat,c.lon),{padding:60,maxZoom:15,duration:0});}
      natPins();},
      ()=>{NATGL.state="off";const n=$("nat-note");n.textContent=NL().mapNote;n.hidden=false;});
}
// A theme switch restyles the vector maps; our overlays are untouched.
function bwThemeChanged(t){
  if(NATGL.state==="on"&&NATGL.theme!==t){NATGL.map.setStyle(bwStyleUrl(t));NATGL.theme=t;}
  if(typeof countryThemeChanged==="function")countryThemeChanged(t);
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
      `<li><a class="nat-item" href="#${c.id}" data-id="${c.id}" aria-label="${esc(pinLabel(c))}"><span class="pin-shape pin-${c.type.toLowerCase()}" aria-hidden="true"></span><span class="nat-name"><b>${esc(c.short)}</b> ${esc(c.name)}</span><span class="nat-where">${esc(c.city)}, ${esc(c.province)}</span></a></li>`).join("")+"</ul>";
  }
  $("nat-list").innerHTML=html||`<p>${esc(fill(L.count0,{q}))}</p>`;
  clearTimeout(natAnnounceT);                         // announce once the typing pauses, and only when the query changed
  natAnnounceT=setTimeout(()=>{if(q===natLastQ)return;natLastQ=q;
    $("nat-count").textContent=!n?"":ms.length===0?fill(L.count0,{q}):ms.length===1?L.count1:fill(L.countN,{n:ms.length});},400);
}
function natRender(){
  natInit();
  const L=NL(),cnt=g=>CAMPUSES.filter(c=>c.group===g).length;
  $("nat-lang").value=LANG;syncDocLang();
  $("nat-h").textContent=L.title;$("nat-intro").textContent=L.intro;$("nat-map-l").textContent=L.mapL;
  $("nat-desc").textContent=fill(L.desc,{n:CAMPUSES.length,luzon:cnt("Luzon"),visayas:cnt("Visayas"),mindanao:cnt("Mindanao")});
  $("nat-legend").innerHTML=["SUC","LUC","Private"].map(t=>`<li><span class="pin-shape pin-${t.toLowerCase()}" aria-hidden="true"></span>${esc(L.typesShort[t])}</li>`).join("")+
    `<li><span class="sea-sw" aria-hidden="true"></span>${esc(L.sea)}</li>`;
  $("nat-credit").textContent=L.credit;
  for(const [id,k] of [["nat-zin","zin"],["nat-zout","zout"],["nat-home","home"]]){$(id).setAttribute("aria-label",L[k]);$(id).title=L[k];}
  $("nat-q-l").textContent=L.search;$("nat-foot").textContent=L.foot;$("nat-note").textContent=L.mapNote;
  if(NAT.sel)$("nat-open").textContent=fill(L.open,{short:CAMPUS_BY_ID[NAT.sel].short});
  document.title="BahaWatch — "+L.title;
  natResize();natList();natGLStart();
}
let natFocusSearch=false;             // the campus bar's "▾" opens the national list with the search box focused
function natEnter(){let saved=null;try{saved=localStorage.getItem(LANG_KEY_PH);}catch(e){}if(saved&&LANGS[saved])LANG=saved;natRender();
  if(natFocusSearch){natFocusSearch=false;$("nat-q").focus();}}
```

(The executor pastes the three blocks into the Python script as `NAT_CSS=r'''…'''`, `NAT_HTML=r'''…'''` and `NAT_JS=r'''…'''`, above its first line. They are raw strings, so the JavaScript's `\u0300` escapes and `\d` stay as written.)

- [ ] **Step 4: Build and run the tests to verify they pass**

Run: `cd /home/claude/work && python3 build_html.py && ./test_pages.sh test_national.js test_a11y.js`
Expected: `ok   test_national.js (~85 checks)` and `ok   test_a11y.js`.

- [ ] **Step 5: Look at it**

Screenshot `#` (the national tab) in both modes (vector with the offline style, and `BW_NO_BASEMAP`) at 1920 × 1080, 1280 × 900 and 390 × 844. Look at:
- the map fills the right side, and the list scrolls on the left;
- the sea is the grey blue, and the legend has four entries;
- no pins sit under the legend or the credits at the whole-country view.

If a pin does, raise the legend's `bottom` or move the legend top-left, and ledger it.

- [ ] **Step 6: Run every suite, then commit**

Run: `cd /home/claude/work && ./test_pages.sh && node --test --no-warnings shared/*.test.js sw.test.js 2>&1 | grep -E '^# (pass|fail)' && gzip -c bahawatch_dashboard.html | wc -c`
Expected: every page suite `ok`; `# pass 36`; ≤ 256000.

```bash
cd /home/claude/work && git add template.html bahawatch_dashboard.html i18n/nat.json test_national.js test_a11y.js && git commit -q -m "PhilDev tab: full-window map and list; vector basemap on OpenFreeMap with outline fallback; smooth zoom; fly-to, box and Open; legend with sea; no pilot links" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 6: Zoom a site map out to the whole country and back (spec §6.1)

**Files:**
- Modify: `template.html`:
  - markup in `#map-wrap`, before `<div id="map-tooltip">`;
  - CSS before `aside{display:flex`;
  - JS after `natEnter`;
  - hooks in `zoomAt`, the pinch branch, `switchSite`, `go()`, `enterTry` and `syncCampusUI`.
- Create: `test_zoomout.js`

**Interfaces:**
- Consumes:
  - `pinHTML`, `clusterHTML`, `natProj`, `phOutline`, `PH_PATH`, `phVB`, `curTheme`, `natDur` (Task 5);
  - `bwLoadMapLibre`, `bwOpenMap`, `bwCluster`, `bwCoverage`, `bwFitVB`, `bwStyleUrl` (Task 4);
  - `NL().wholeCountry|backFlood|simArea|mapNote` (Task 2);
  - `--sea` (Task 3).
- Produces, as page globals:
  - `COUNTRY` (`{on,map,state,theme,easing}`) and `siteZoomedOut` (boolean);
  - `canCountry()`, `countryOut()`, `countryBack(silent)`, `countryProj()`, `countryBoxPx(px)`, `countryThemeChanged(t)`, `syncCountryUI()`;
  - the elements `#country`, `#country-gl`, `#country-svg`, `#country-box`, `#country-label`, `#country-pins`, `#country-note`, `#country-back`, `#to-country`.

- [ ] **Step 1: Write the failing test**

```bash
cd /home/claude/work && cat > test_zoomout.js <<'JS'
// Zooming a site map out to the whole country and back (spec §6.1). Run: ./test_pages.sh test_zoomout.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const up=pg=>pg.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="",null,{timeout:15000}).then(()=>pg.waitForTimeout(300));
const glReady=pg=>pg.waitForFunction(()=>COUNTRY.state==="on"||COUNTRY.state==="off",null,{timeout:15000})
  .then(()=>pg.waitForFunction(()=>!COUNTRY.easing,null,{timeout:5000})).then(()=>pg.waitForTimeout(150));
// zoom out with the mouse wheel over the flood map, as a person would
async function wheelOut(pg){
  const r=await pg.evaluate(()=>{const b=document.getElementById('overlay').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};});
  await pg.mouse.move(r.x,r.y);
  for(let i=0;i<30&&!await pg.evaluate(()=>siteZoomedOut);i++){await pg.mouse.wheel(0,200);await pg.waitForTimeout(40);}
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{try{for(const k of ["tv","upd","berkeley"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const libReqs=[];pg.on('request',r=>{if(/maplibre-gl|basemap-style/.test(r.url()))libReqs.push(r.url());});
  await pg.goto(U+'#tv');await up(pg);
  let s=await pg.evaluate(()=>({btn:!document.getElementById('to-country').hidden&&document.getElementById('to-country').textContent,out:siteZoomedOut}));
  assert(s.btn==="Whole country"&&!s.out,"Teachers Village: a 'Whole country' button, flood map showing");
  assert(libReqs.length===0,"spec §8: a campus page loads no MapLibre and no basemap style before the first handover: "+libReqs.join(", "));
  await wheelOut(pg);await glReady(pg);
  assert(libReqs.some(u=>/maplibre-gl\.mjs/.test(u)),"the first handover loads MapLibre");
  s=await pg.evaluate(()=>{const el=document.getElementById('country'),r=el.getBoundingClientRect(),bx=document.getElementById('country-box').getBoundingClientRect();
    return {out:siteZoomedOut,shown:!el.hidden,gl:el.dataset.gl==="1",state:COUNTRY.state,
      box:!document.getElementById('country-box').hidden&&bx.left>=r.left&&bx.right<=r.right&&bx.top>=r.top&&bx.bottom<=r.bottom,
      label:document.getElementById('country-label').textContent,pins:document.querySelectorAll('#country-pins > *').length,
      back:document.activeElement.id,cov:bwCoverage(countryBoxPx(countryProj()),el.clientWidth,el.clientHeight)};});
  assert(s.out&&s.shown&&s.gl&&s.state==="on","wheeling out past the whole box hands over to the vector map: "+JSON.stringify(s));
  assert(s.box&&s.label==="Simulated area"&&s.cov<0.9,"the site's box is outlined and labelled 'Simulated area', smaller than the view: "+s.cov.toFixed(2));
  assert(s.pins>0&&s.back==="country-back","campus pins show, and focus is on 'Back to the flood map'");
  // the slack: a small zoom back in does not flip back
  await pg.evaluate(()=>COUNTRY.map.zoomTo(COUNTRY.map.getZoom()+0.3,{duration:0}));await pg.waitForTimeout(200);
  assert(await pg.evaluate(()=>siteZoomedOut),"a small zoom back in stays on the country view (no flicker)");
  // zooming in until the box fills the view returns to the flood map
  await pg.evaluate(()=>COUNTRY.map.fitBounds([[DATA.bbox[0],DATA.bbox[1]],[DATA.bbox[2],DATA.bbox[3]]],{padding:0,duration:0}));await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({out:siteZoomedOut,hidden:document.getElementById('country').hidden,z:ZOOM.z,min:ZOOM.min}));
  assert(!s.out&&s.hidden&&s.z===s.min,"zooming in until the box fills the view returns to the flood map, at the whole-box zoom");
  // the button, Back, and Escape
  await pg.click('#to-country');await glReady(pg);
  assert(await pg.evaluate(()=>siteZoomedOut),"'Whole country' hands over too");
  await pg.click('#country-back');
  assert(await pg.evaluate(()=>!siteZoomedOut&&document.getElementById('country').hidden&&document.activeElement.id==="to-country"),"'Back to the flood map' returns, with focus on 'Whole country'");
  await pg.click('#to-country');await glReady(pg);await pg.keyboard.press('Escape');
  assert(await pg.evaluate(()=>!siteZoomedOut),"Escape returns to the flood map");
  // Review Focus 2: a theme switch restyles the country map and keeps the box
  await pg.click('#to-country');await glReady(pg);
  await pg.click('#p-theme');await pg.waitForTimeout(500);
  s=await pg.evaluate(()=>({t:COUNTRY.theme,box:!document.getElementById('country-box').hidden,out:siteZoomedOut}));
  assert(s.t==="dark"&&s.box&&s.out,"switching theme restyles the country map and keeps the box: "+JSON.stringify(s));
  await pg.click('#p-theme');
  // Review Focus 4: leaving a site while zoomed out closes the country view; the next site starts on its flood map
  await pg.goto(U+'#upd');await up(pg);
  s=await pg.evaluate(()=>({out:siteZoomedOut,hidden:document.getElementById('country').hidden,site:SITE}));
  assert(!s.out&&s.hidden&&s.site==="upd","opening UP Diliman closes Teachers Village's country view");
  await wheelOut(pg);await glReady(pg);
  s=await pg.evaluate(()=>({out:siteZoomedOut,own:!!document.querySelector('#country-pins .pin-sel[data-id="upd"]')||[...document.querySelectorAll('#country-pins .pin-cluster')].some(c=>c.dataset.ids.split(",").includes("upd"))}));
  assert(s.out&&s.own,"UP Diliman zooms out too; its own pin is marked (or inside a cluster)");
  await pg.click('.site-tabs [data-site="ph"]:visible');await pg.waitForFunction(()=>ROUTE==="ph");
  await pg.goto(U+'#upd');await up(pg);
  assert(await pg.evaluate(()=>!siteZoomedOut&&document.getElementById('country').hidden),"after the national map and back, UP Diliman starts on its flood map");
  await wheelOut(pg);await glReady(pg);
  await pg.click('.site-tabs [data-site="try"]:visible');await pg.waitForTimeout(400);
  assert(await pg.evaluate(()=>TRY&&!siteZoomedOut&&document.getElementById('country').hidden&&document.getElementById('to-country').hidden),"Try reporting closes the country view and has no 'Whole country'");
  await wheelOut(pg);
  assert(await pg.evaluate(()=>!siteZoomedOut),"in Try reporting, zooming out never hands over");
  // UC Berkeley: its country view is California, with no PhilDev pins
  await pg.goto(U+'#berkeley');await up(pg);await wheelOut(pg);await glReady(pg);
  s=await pg.evaluate(()=>({out:siteZoomedOut,pins:document.querySelectorAll('#country-pins > *').length,min:COUNTRY.map.getMinZoom()}));
  assert(s.out&&s.pins===0&&s.min<=2,"UC Berkeley zooms out too, with no PhilDev pins: "+JSON.stringify(s));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await ctx.close();
  // offline: a Philippine site shows the outline with its box; Berkeley shows only the note (plan ruling 7)
  {const c2=await b.newContext({viewport:{width:1280,height:900}});
   await c2.addInitScript(()=>{window.BW_NO_BASEMAP=true;try{for(const k of ["tv","berkeley"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
   const p=await c2.newPage();await p.goto(U+'#tv');await up(p);await wheelOut(p);await glReady(p);
   s=await p.evaluate(()=>({out:siteZoomedOut,svg:getComputedStyle(document.getElementById('country-svg')).display!=="none",box:!document.getElementById('country-box').hidden,note:!document.getElementById('country-note').hidden}));
   assert(s.out&&s.svg&&s.box&&s.note,"offline: Teachers Village's country view is the outline with its box, and the note: "+JSON.stringify(s));
   await p.click('#country-back');
   await p.goto(U+'#berkeley');await up(p);await wheelOut(p);await glReady(p);
   s=await p.evaluate(()=>({out:siteZoomedOut,svg:getComputedStyle(document.getElementById('country-svg')).display!=="none",note:!document.getElementById('country-note').hidden}));
   assert(s.out&&!s.svg&&s.note,"offline: Berkeley shows the note only: "+JSON.stringify(s));
   await c2.close();}
  await b.close();
})();
JS
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/claude/work && ./test_pages.sh test_zoomout.js`
Expected: `FAIL test_zoomout.js` (`FAIL: Teachers Village: a 'Whole country' button…`, then errors: `COUNTRY is not defined`).

- [ ] **Step 3: Add the country view**

First save the JavaScript block shown after this script as `/tmp/bw_country.js` (the script reads it). Then run:

```bash
cd /home/claude/work && python3 - <<'PY'
p="template.html"; s=open(p,encoding="utf-8").read()
def rep(a,b):
    global s; assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
COUNTRY_JS=open("/tmp/bw_country.js",encoding="utf-8").read()
# markup: an overlay over the flood map, and the button that opens it
rep('    <div id="map-tooltip"></div>\n','''    <div id="country" hidden>
      <div id="country-gl"></div>
      <svg id="country-svg" aria-hidden="true" focusable="false" preserveAspectRatio="none"><path id="country-land"/></svg>
      <div class="country-box" id="country-box"></div>
      <p class="country-label" id="country-label"></p>
      <div class="nat-pins" id="country-pins"></div>
      <p class="country-note" id="country-note" role="status" hidden></p>
      <button class="nat-btn country-back" id="country-back"></button>
    </div>
    <button class="nat-btn to-country" id="to-country" hidden></button>
    <div id="map-tooltip"></div>
''')
# CSS
rep("aside{display:flex; flex-direction:column;",'''/* zoom out to the country (spec §6.1): an overlay over the flood map */
#country{position:absolute; inset:0; z-index:8; background:var(--sea)}
#country[hidden]{display:none}
#country-gl{position:absolute; inset:0; opacity:0; transition:opacity .3s}
#country[data-gl="1"] #country-gl{opacity:1}
#country-svg{position:absolute; inset:0; width:100%; height:100%}
#country-land{fill:var(--map-bg); stroke:var(--ink-2); stroke-width:1; vector-effect:non-scaling-stroke}
.country-box{position:absolute; z-index:2; border:2px dashed var(--ink); pointer-events:none}
.country-box[hidden],.country-label[hidden]{display:none}
.country-label{position:absolute; z-index:2; margin:0; font-size:14px; font-weight:700; color:var(--ink); background:var(--panel); padding:2px 6px; border-radius:4px; white-space:nowrap; pointer-events:none}
.country-note{position:absolute; left:12px; top:12px; z-index:3; margin:0; background:var(--panel); color:var(--ink); padding:6px 10px; border:1px solid var(--line); border-radius:6px}
.country-note[hidden]{display:none}
.country-back{position:absolute; right:12px; bottom:12px; z-index:3}
.to-country{position:absolute; right:14px; bottom:44px; z-index:5}
.to-country[hidden]{display:none}
#map-wrap.country-on #map,#map-wrap.country-on #overlay{visibility:hidden}
@media (prefers-reduced-motion: reduce){#country-gl{transition:none}}
aside{display:flex; flex-direction:column;''')
# hooks: zooming out past the whole box pulls towards the country view
rep("function zoomAt(factor,sx,sy){\n","function zoomAt(factor,sx,sy){\n  if(factor<1&&ZOOM.z<=ZOOM.min+1e-6&&countryPullBy(factor))return;   // spec §6.1\n  if(factor>1)countryPull=1;\n")
rep("    const target=Math.max(ZOOM.min,Math.min(ZOOM.max,pinchZ0*d/Math.max(pinchD0,1)));\n",
    "    if(pinchZ0*d/Math.max(pinchD0,1)<ZOOM.min*0.75&&!COUNTRY.on&&canCountry()){ptrs.clear();countryOut();return;}\n"
    "    const target=Math.max(ZOOM.min,Math.min(ZOOM.max,pinchZ0*d/Math.max(pinchD0,1)));\n")
rep('function switchSite(id){\n  if(!DATA_ALL[id])id="tv";\n','function switchSite(id){\n  if(!DATA_ALL[id])id="tv";\n  countryBack(true);\n')
rep('  if(h.route==="ph"){\n','  if(h.route==="ph"){\n    countryBack(true);\n')
rep("function enterTry(){\n","function enterTry(){\n  countryBack(true);\n")
rep("function syncCampusUI(){\n","function syncCampusUI(){\n  syncCountryUI();\n")
# code
end='  if(natFocusSearch){natFocusSearch=false;$("nat-q").focus();}}\n'
rep(end,end+COUNTRY_JS)
open(p,"w",encoding="utf-8").write(s)
PY
python3 build_html.py
```

`/tmp/bw_country.js` (the `COUNTRY_JS` the script splices in after the national code):

```js
/* ---------- zoom out to the country (spec §6.1) ---------- */
// Zooming out past the whole box hands the map box over to the vector basemap (or the outline, offline), centred on
// the site with its box outlined; zooming back in until the box fills the view, "Back to the flood map" or Escape
// returns. Never in the Try tab. Leaving the site closes it.
const COUNTRY={on:false,map:null,state:"none",theme:null,easing:false};
let siteZoomedOut=false,countryPull=1,countryPullT=0;
const canCountry=()=>ROUTE==="site"&&!TRY&&!!DATA&&!!DATA.bbox;
const siteLL=()=>{const b=DATA.bbox;return [[b[0],b[1]],[b[2],b[3]]];};
const phSite=()=>SITE!=="berkeley";
function syncCountryUI(){const b=$("to-country");b.textContent=NL().wholeCountry;b.hidden=!canCountry()||COUNTRY.on;}
// a pull of ×0.75 past the whole box (one "−", two wheel notches) hands over; it fades if the zooming stops
function countryPullBy(f){
  if(!canCountry())return false;
  countryPull*=f;clearTimeout(countryPullT);countryPullT=setTimeout(()=>{countryPull=1;},500);
  if(countryPull<0.75){countryPull=1;countryOut();}
  return true;
}
function countryOut(){
  if(COUNTRY.on||!canCountry())return;
  COUNTRY.on=siteZoomedOut=true;
  $("country").hidden=false;$("map-wrap").classList.add("country-on");syncCountryUI();
  $("country-back").textContent=NL().backFlood;
  if(COUNTRY.state==="on")countryEnterGL();
  else if(COUNTRY.state==="none"){COUNTRY.state="loading";
    bwLoadMapLibre().then(lib=>bwOpenMap(lib,$("country-gl"),{bounds:siteLL(),theme:curTheme(),reduced:reducedMotion,padding:0,minZoom:2}))
      .then(map=>{COUNTRY.map=map;COUNTRY.state="on";COUNTRY.theme=curTheme();
        map.on("move",countryDrawSoon);map.on("resize",countryDrawSoon);map.on("zoom",countryZoomCheck);
        if(COUNTRY.on)countryEnterGL();},
        ()=>{COUNTRY.state="off";countryDraw();});
  }
  countryDraw();
  $("country-back").focus({preventScroll:true});
}
function countryEnterGL(){
  const m=COUNTRY.map;$("country").dataset.gl="1";m.resize();m.setMinZoom(phSite()?4:2);
  COUNTRY.easing=true;m.fitBounds(siteLL(),{padding:0,duration:0});
  m.easeTo({zoom:m.getZoom()-1.5,duration:natDur(600)});
  m.once("moveend",()=>{COUNTRY.easing=false;countryDraw();});
  countryDraw();
}
function countryBack(silent){
  if(!COUNTRY.on)return;
  COUNTRY.on=siteZoomedOut=false;countryPull=1;COUNTRY.easing=false;
  $("country").hidden=true;delete $("country").dataset.gl;$("map-wrap").classList.remove("country-on");
  if(!silent){ZOOM.z=ZOOM.min;ZOOM.cx=W/2;ZOOM.cy=H/2;applyView();drawMap();}
  syncCountryUI();
  if(!silent)$("to-country").focus({preventScroll:true});
}
function countryZoomCheck(){
  if(!COUNTRY.on||COUNTRY.easing||$("country").dataset.gl!=="1")return;
  const el=$("country");
  if(bwCoverage(countryBoxPx(countryProj()),el.clientWidth,el.clientHeight)>=0.9)countryBack();
}
// px inside #country for a longitude/latitude: the vector map when it is up, else the whole-country outline
function countryProj(){
  const el=$("country"),w=el.clientWidth,h=el.clientHeight;
  if(COUNTRY.state==="on"&&el.dataset.gl==="1")return (lon,lat)=>{const p=COUNTRY.map.project([lon,lat]);return [p.x,p.y];};
  phOutline();const vb=bwFitVB(phVB(),w,h);$("country-svg").setAttribute("viewBox",vb.join(" "));
  return (lon,lat)=>{const [x,y]=natProj(lon,lat);return [(x-vb[0])/vb[2]*w,(y-vb[1])/vb[3]*h];};
}
function countryBoxPx(px){const b=DATA.bbox,[x0,y0]=px(b[0],b[3]),[x1,y1]=px(b[2],b[1]);return {x0,y0,x1,y1};}
function countryDraw(){
  if(!COUNTRY.on)return;
  const el=$("country"),w=el.clientWidth,h=el.clientHeight,gl=COUNTRY.state==="on"&&el.dataset.gl==="1",ph=phSite(),L=NL(),px=countryProj();
  $("country-land").setAttribute("d",PH_PATH);
  $("country-svg").style.display=!gl&&ph?"":"none";
  const note=$("country-note");note.textContent=L.mapNote;note.hidden=COUNTRY.state!=="off";
  const b=countryBoxPx(px),bw=Math.max(b.x1-b.x0,14),bh=Math.max(b.y1-b.y0,14),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
  const box=$("country-box"),lab=$("country-label");box.hidden=lab.hidden=!(gl||ph);
  Object.assign(box.style,{left:(cx-bw/2)+"px",top:(cy-bh/2)+"px",width:bw+"px",height:bh+"px"});
  lab.textContent=L.simArea;Object.assign(lab.style,{left:(cx-bw/2)+"px",top:Math.max(4,cy-bh/2-30)+"px"});
  const pts=ph?CAMPUSES.map(c=>{const [x,y]=px(c.lon,c.lat);return {id:c.id,x,y};}).filter(p=>p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h):[];
  $("country-pins").innerHTML=bwCluster(pts,36).map(g=>{
    const html=g.ids.length===1?pinHTML(CAMPUS_BY_ID[g.ids[0]],g.ids[0]===SITE?" pin-sel":""):clusterHTML(g.ids);
    return html.replace(/^<(a|button) /,`<$1 style="left:${g.x.toFixed(1)}px;top:${g.y.toFixed(1)}px" `);}).join("");
}
let countryF=0;
const countryDrawSoon=()=>{if(!countryF)countryF=requestAnimationFrame(()=>{countryF=0;countryDraw();});};
function countryThemeChanged(t){if(COUNTRY.state==="on"&&COUNTRY.theme!==t){COUNTRY.map.setStyle(bwStyleUrl(t));COUNTRY.theme=t;}}
$("country-back").addEventListener("click",()=>countryBack());
$("to-country").addEventListener("click",()=>countryOut());
$("country").addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();countryBack();}});
$("country-pins").addEventListener("click",e=>{
  const cl=e.target.closest(".pin-cluster");if(!cl||COUNTRY.state!=="on"||$("country").dataset.gl!=="1")return;
  const cs=cl.dataset.ids.split(",").map(id=>CAMPUS_BY_ID[id]);
  COUNTRY.map.fitBounds([[Math.min(...cs.map(c=>c.lon)),Math.min(...cs.map(c=>c.lat))],[Math.max(...cs.map(c=>c.lon)),Math.max(...cs.map(c=>c.lat))]],{padding:80,maxZoom:12,duration:natDur(600)});
});
window.addEventListener("resize",()=>{if(COUNTRY.on)countryDrawSoon();});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/claude/work && ./test_pages.sh test_zoomout.js`
Expected: `ok   test_zoomout.js (~22 checks)`.

If the Escape check fails because focus left `#country`, that's expected: the key listener sits on `#country`, and `#country-back` is inside it. Make sure `countryOut()` focuses `#country-back` before the key press.

- [ ] **Step 5: Run every suite, then commit**

Run: `cd /home/claude/work && ./test_pages.sh && node --test --no-warnings shared/*.test.js sw.test.js 2>&1 | grep -E '^# (pass|fail)'`
Expected: every page suite `ok` (17 suites now); `# pass 36`.

```bash
cd /home/claude/work && git add template.html bahawatch_dashboard.html test_zoomout.js && git commit -q -m "Site maps zoom out to the whole country (vector map or outline) with the simulated area outlined, and back" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 7: Try reporting in a phone (spec §5)

**Files:**
- Modify: `template.html` (the three `body[data-try="1"] .p-left/.p-status` rules; `resetView`)
- Test: `test_try.js`

**Interfaces:**
- Consumes: the Task 1 re-measuring map.
- Produces: `tryZoom()`, the zoom that shows about 700 m around 22 Malingap Street across the map's shorter side.

- [ ] **Step 1: Write the failing test**

```bash
cd /home/claude/work && python3 - <<'PY'
p="test_try.js"; s=open(p).read()
end="  await b.close();\n})();"
add='''  // a phone outline around the answer and the report buttons (spec §5), and the whole neighbourhood in view
  {const c3=await b.newContext({viewport:{width:1280,height:900}});
   await c3.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}});
   const p=await c3.newPage();await p.goto(U+'#try');await p.waitForFunction(()=>TRY&&document.body.dataset.ready);await p.waitForTimeout(500);
   let r=await p.evaluate(()=>{const l=document.querySelector('.p-left'),cs=getComputedStyle(l),pill=getComputedStyle(l,'::before'),
     a=document.getElementById('p-answer').getBoundingClientRect(),q=document.querySelector('#p-rep .p-rep-btns').getBoundingClientRect(),lr=l.getBoundingClientRect();
     return {bw:cs.borderTopWidth,rad:cs.borderTopLeftRadius,screen:l.clientWidth,pill:pill.content!=="none"&&pill.width==="96px",
       inside:a.left>=lr.left&&a.right<=lr.right&&q.bottom<=lr.bottom};});
   assert(r.bw==="12px"&&r.rad==="48px"&&Math.abs(r.screen-390)<=2&&r.pill&&r.inside,"Try: a phone outline (12 px frame, 48 px corners, camera pill) around a 390 px screen holding the answer and the buttons: "+JSON.stringify(r));
   for(let i=0;i<8;i++)await p.click(i%2?'#try-add-hindi':'#try-add-oo');await p.waitForTimeout(200);
   r=await p.evaluate(()=>{const b=DATA.bbox,lat=(b[1]+b[3])/2,mpu=(b[2]-b[0])*111320*Math.cos(lat*Math.PI/180)/W;
     const span=Math.min(view.w,view.h)/view.sc*mpu;
     const all=tryState.neighbours.every(n=>{const w=lonLatToWorld(n.lon,n.lat),x=view.ox+w.x*view.sc,y=view.oy+w.y*view.sc;return x>=0&&x<=view.w&&y>=0&&y<=view.h;});
     return {span:Math.round(span),all,n:tryState.neighbours.length};});
   assert(r.span>=630&&r.span<=770&&r.all&&r.n===8,"Try: the map opens on about 700 m around 22 Malingap St, all 8 pretend neighbours in view: "+JSON.stringify(r));
   await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
   r=await p.evaluate(()=>({bw:getComputedStyle(document.querySelector('.p-left')).borderTopWidth,sw:document.documentElement.scrollWidth}));
   assert(r.bw==="0px"&&r.sw<=390,"Try at 390 px: no phone outline (the page already is a phone), no sideways scroll");
   await c3.close();}
'''
assert s.count(end)==1; s=s.replace(end,add+end); open(p,"w").write(s)
PY
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/claude/work && ./test_pages.sh test_try.js`
Expected:
- `FAIL: Try: a phone outline…` (`bw` is `3px`, `rad` is `32px`);
- `FAIL: Try: the map opens on about 700 m…` (the span is set by zoom 2.2, ≈ 1.5 km).

- [ ] **Step 3: Draw the phone and fit the map**

```bash
cd /home/claude/work && python3 - <<'PY'
p="template.html"; s=open(p,encoding="utf-8").read()
def rep(a,b):
    global s; assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
rep('body[data-try="1"] .p-status{grid-template-columns:380px minmax(0,1fr)}',
    'body[data-try="1"] .p-status{grid-template-columns:414px minmax(0,1fr)}')
rep('body[data-try="1"] .p-left{border:3px solid var(--ink); border-radius:32px; padding:22px 16px 26px; background:var(--panel); max-width:380px; box-sizing:border-box}',
    '''/* the phone (plan ruling 3): a 12 px frame, 48 px corners, a camera pill and side buttons around a 390 px screen */
body[data-try="1"] .p-left{position:relative; box-sizing:border-box; width:414px; max-width:none; min-height:640px; border:12px solid var(--ink); border-radius:48px; padding:48px 16px 36px; background:var(--panel)}
body[data-try="1"] .p-left::before{content:""; position:absolute; top:12px; left:50%; width:96px; height:26px; margin-left:-48px; border-radius:13px; background:var(--ink)}
body[data-try="1"] .p-left::after{content:""; position:absolute; right:-17px; top:120px; width:5px; height:64px; border-radius:0 3px 3px 0; background:var(--ink); box-shadow:-419px -24px 0 var(--ink), -419px 56px 0 var(--ink)}
@media (max-width:560px){
  body[data-try="1"] .p-left{width:auto; min-height:0; border:0; border-radius:0; padding:0; background:none}
  body[data-try="1"] .p-left::before, body[data-try="1"] .p-left::after{display:none}
}''')
rep('  body[data-try="1"] .p-left{justify-self:center; width:100%}','  body[data-try="1"] .p-left{justify-self:center}')
rep("function resetView(){if(TRY&&VIEW===\"public\"){const h=HOUSEHOLD.find(s=>s.id===TRY_SENSOR);if(h&&view.w){zoomTo(h.x,h.y,2.2);return;}}",
    "function resetView(){if(TRY&&VIEW===\"public\"){const h=HOUSEHOLD.find(s=>s.id===TRY_SENSOR);if(h&&view.w){zoomTo(h.x,h.y,tryZoom());return;}}")
rep("function zoomTo(x,y,z){",
    """// The Try map opens on about 700 m around 22 Malingap St across its shorter side: every pretend phone in view (spec §5).
function tryZoom(){const b=DATA.bbox,lat=(b[1]+b[3])/2,mpu=(b[2]-b[0])*111320*Math.cos(lat*Math.PI/180)/W,fit=Math.min(view.w/W,view.h/H);
  return Math.min(view.w,view.h)/(700/mpu)/fit;}
function zoomTo(x,y,z){""")
open(p,"w",encoding="utf-8").write(s)
PY
python3 build_html.py
```

The `@media (max-width:560px)` block must come after the `(max-width:1100px)` block that already styles `.p-left`. The rule it replaces sits before both media blocks, so the new media block sits there too; its selectors are as specific as the 1100 px one's, and it only sets `width`, `border`, `padding`, `min-height` and `background`, which the 1100 px block doesn't set. If the 390 px check still sees a border, move the `@media (max-width:560px)` block below the `(max-width:1100px)` block and ledger it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/claude/work && ./test_pages.sh test_try.js`
Expected: `ok   test_try.js (52 checks)`.

- [ ] **Step 5: Look at it, run every suite, commit**

Screenshot `#try` at 1280 × 900 in light and dark, and at 390 × 844. Check that:
- the phone reads as a phone (frame, pill, side buttons clear of the page edge);
- the text inside is not clipped;
- the map shows the neighbourhood.

Run: `cd /home/claude/work && ./test_pages.sh`
Expected: every suite `ok`.

```bash
cd /home/claude/work && git add template.html bahawatch_dashboard.html test_try.js && git commit -q -m "Try reporting: the answer and report buttons inside a phone outline; map opens on the neighbourhood (~700 m)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

---

### Task 8: Hand-over: docs, audit, final review, report, demo, bundle, handoff

**Files:**
- Modify: `README.md`, `DATA-LICENSE.md`, `docs/superpowers/handoff/BahaWatch_Handoff.md`
- Create: `docs/superpowers/reports/2026-09-27-phildev-ui-round2-build-report.md` and its PDF

**Interfaces:**
- Consumes: everything above.
- Produces: the branch ready to merge; the report PDF; the updated private demo; `bahawatch.bundle`.

- [ ] **Step 1: README and data licences**

In `README.md`, add a section "§2.6 The vector basemap" after §2.5. It covers:
- **What it is:** MapLibre GL JS 6.11.2 vendored in `lib/maplibre-gl-6.11.2/` (BSD-3-Clause, plan ruling 1), and OpenFreeMap tiles and fonts.
- **Styles:** `shared/basemap-style.json` and `-dark.json`, generated by `python3 tools/basemap_style.py` and checked by `python3 -m unittest tools.test_basemap_style`.
- **Fallback:** the outline, with the 8 s rule.
- **Test plumbing:** `BW_TEST_BASEMAP=offline` and `?real`.
- **Privacy note:** every visitor's browser requests tiles from `tiles.openfreemap.org`, which sees their IP address and the map area.

Also add to `README.md`:
- the §6.5 routing text: the national tab is one screen with the list; list rows fly the map on wide screens and open the campus on narrow ones; "Whole country" and zoom-out on every site map; the Try tab's phone;
- the test table: `test_zoomout.js`, `shared/basemap.test.js`, `tools/test_basemap_style.py`;
- "UI/UX profile: `.ux-profile.md`".

In `DATA-LICENSE.md`, add rows:
- "Map tiles and fonts on the PhilDev tab and in the zoomed-out views (fetched live, not in the repo): OpenFreeMap © OpenMapTiles Data from OpenStreetMap: OpenStreetMap data ODbL 1.0; OpenMapTiles schema; attribution shown on the map";
- "`lib/maplibre-gl-6.11.2/*`: MapLibre GL JS, BSD-3-Clause (`LICENSE.txt` in that folder)".

- [ ] **Step 2: Every check, from clean**

Run:
```bash
cd /home/claude/work && python3 build_html.py && ./test_build.sh | tail -2 && node --test --no-warnings shared/*.test.js sw.test.js 2>&1 | grep -E '^# (pass|fail)' && (cd worker && node --test --no-warnings test/*.test.js 2>&1 | grep -E '^# (pass|fail)') && python3 -W ignore tools/test_places.py 2>&1 | tail -1 && python3 -m unittest tools.test_basemap_style 2>&1 | tail -1 && ./test_pages.sh
```

Expected:
- `ok   default output is data/<site>.json`;
- `# pass 36`, `# fail 0`;
- `# pass 46`, `# fail 0`;
- `OK`, `OK`;
- 17 page suites `ok`, including `test_zoomout.js`.

- [ ] **Step 3: UX audit (the `vectorlab-ux-skills:ux-audit` skill)**

Invoke `vectorlab-ux-skills:ux-audit`, with the profile `.ux-profile.md`. The working set is the files changed on this branch.

Take screenshots at 375, 1280 and 1920 px of `#`, `#uplb`, `#uplb/details`, `#tv`, `#try` and a zoomed-out `#tv`. Save them to `/mnt/user-data/outputs/round2_<page>_<w>.png`.

Fix any hard-rule fail test-first (it becomes a failing check in the owning suite, then the fix). Ledger heuristics as notes. Paste the audit report into the ledger.

- [ ] **Step 4: Whole-branch review**

Follow superpowers:executing-plans "Final Review":
- the review package from `git merge-base main HEAD` to `HEAD`; exclude `lib/` and the generated styles from the code diff;
- a fresh reviewer on the most capable model, with `code-reviewer.md`;
- this plan's Review Focus verbatim, and the ledger's rulings;
- one fix pass for Critical and Important findings, each RED→GREEN plus the Step 2 run;
- minor findings ledgered as deferred.

- [ ] **Step 5: Build report (PDF)**

Write `docs/superpowers/reports/2026-09-27-phildev-ui-round2-build-report.md`:
1. What changed, item by item against Gregor's list (spec §2 table).
2. Screenshots (the Step 3 set).
3. Test results (every suite with its count).
4. Rulings: the plan's 8, and every `Ruling:` line in the ledger, each with its cost if wrong.
5. Deferred minors.
6. Honest limits: spec §11, plus "the live site must serve `.mjs` as JavaScript: check the PhilDev tab after the push".

Then run:
```bash
cd /home/claude/work && python3 tools/md_to_pdf.py docs/superpowers/reports/2026-09-27-phildev-ui-round2-build-report.md /mnt/user-data/outputs/BahaWatch_PhilDev-UI-Round2_Build_Report_$(date +%F).pdf
```

Render pages 1 and 3 with `pdftoppm -r 60` and look at them.

Commit the docs and the report:

```bash
cd /home/claude/work && git add README.md DATA-LICENSE.md docs/superpowers/reports && git commit -q -m "Docs: vector basemap, licences, privacy note; round 2 build report" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG"
```

- [ ] **Step 6: Update the private demo artifact**

Read `https://claude.ai/artifact/Mjsm9genvWF9sFdXxuKis9` first. Then publish `bahawatch_dashboard.html` with `root` `/home/claude/work` and `files`:
- the 27 `data/<id>.json`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`;
- `shared/basemap-style.json` and `shared/basemap-style-dark.json`;
- `lib/maplibre-gl-6.11.2/maplibre-gl.css`;
- the three `lib/maplibre-gl-6.11.2/*.mjs`, each given as `{"from": …, "contentType": "text/javascript"}`.

The demo can't reach OpenFreeMap. Check with the files listing that everything is served; its PhilDev tab shows the outline and the note.

- [ ] **Step 7: Bundle, handoff, and Gregor's review**

Run: `cd /home/claude/work && git bundle create /mnt/user-data/outputs/bahawatch.bundle phildev-ui-round2 main && git bundle list-heads /mnt/user-data/outputs/bahawatch.bundle`
Expected: two heads.

Refresh `docs/superpowers/handoff/BahaWatch_Handoff.md`:
- this round's status and branch;
- the plan's progress;
- the open question of vendoring (plan ruling 1), if Gregor hasn't answered it.

Render its PDF, and `project_write` it to `claude/BahaWatch_Handoff.md`.

Send the report PDF, the handoff PDF and the bundle. Ask Gregor to review. On his go-ahead, merge into `main` with superpowers:finishing-a-development-branch, re-bundle, and give him the three PowerShell lines. After his push, ask him to open the PhilDev tab on the live site, to confirm the vector map loads there (GitHub Pages serving `.mjs`).
