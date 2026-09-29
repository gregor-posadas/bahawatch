# BahaWatch: handoff for a new chat

Last updated: 2026-09-28, 2 a.m. Pacific. **PhilDev UI round 2 is live on GitHub Pages** (`main` at `efbb216`, pushed by
Gregor 2026-09-28 00:05). A **fix on top** (maps no longer give up while the page is hidden; §3 item 7) is committed on
`phildev-ui-round2` and sent as a small bundle; check `git ls-remote https://github.com/gregor-posadas/bahawatch` to see
whether Gregor has pushed it.

Kept as `claude/BahaWatch_Handoff.md` in the "Berkeley PhD" Project. The repo copy
(`docs/superpowers/handoff/BahaWatch_Handoff.md`) is older and should be replaced with this text and committed in the
next session.

---

## 1. How to resume in a new chat

1. **Start the chat inside the "Berkeley PhD" Project**, so this document is readable.
2. **Link the chat to your computer** (desktop app, "Link to this computer") only if the work needs files on your PC
   (rebuilding the map tiles or the campus cuts does).
3. **Paste this as the first message:**

> Continue BahaWatch from the handoff document `claude/BahaWatch_Handoff.md` in this Project (read it first, all of
> it). Clone the repo from GitHub into `/home/claude/work`. Next I want to: [say what].

**What the new chat does first.** The repo is public and GitHub is reachable from the workspace, so no bundle is needed
once Gregor has pushed:

```bash
git clone https://github.com/gregor-posadas/bahawatch /home/claude/work
cd /home/claude/work && git config user.name "Gregor" && git config user.email "gregor500man.gerp@gmail.com"
git log --oneline -5          # main should be at efbb216 or later
```

If `main` is still at `9bf8529` (push not done), ask Gregor to attach `bahawatch-round2.part0/1/2.bin` (or the rejoined
`bahawatch-round2.bundle`) and run `git fetch /mnt/user-data/uploads/bahawatch-round2.bundle phildev-ui-round2:phildev-ui-round2`
after the clone.

**Not in git (a new container lacks these; needed only to rebuild data or tiles):**
- `inputs/noah/`: Metro Manila NOAH shapefiles (from the NOAH zips in `Nationwide Update`).
- `inputs/campuses/`: the per-campus cuts. Stage `…\bahawatch-data\campuses\_stage_cuts*.zip` from the PC and unzip.
  Needed to rebuild `shared/tiles/site-<id>.pmtiles`.
- `inputs/ph_land_detailed.json`: PSA admin0 simplified to 0.0002°, made from `_phl_admin0.*` in
  `bahawatch-data/campuses/`. Needed to rebuild `ph-land.pmtiles`.
- tippecanoe: build from source (`git clone https://github.com/felt/tippecanoe`, `make`); it was at `/tmp/tippecanoe-src/`.
- The national inputs for `ph-base.pmtiles`: `_national_osm.geojsonl` and `_built_density.csv` in
  `Nationwide Update/bahawatch-data/campuses/` on the PC.
- Python: `pip install --break-system-packages -q duckdb pyarrow osmium shapely`. Node 22 and Playwright are present,
  Chromium at `/opt/pw-browsers/chromium`.

---

## 2. The project in one page

**BahaWatch** is Gregor's flood dashboard. It combines low-cost household water-level sensors with a terrain-fill flood
model and answers residents' question **"Babaha ba?"** ("Will it flood?") for the next hour, at their street or barangay.

| What | Where |
|---|---|
| Public site (GitHub Pages, serves `main`) | https://gregor-posadas.github.io/bahawatch/ (`index.html` redirects to `bahawatch_dashboard.html`) |
| Repo (public) | `gregor-posadas/bahawatch`. Gregor pushes; Claude has no GitHub credentials |
| Gregor's clone on Windows | `C:\Users\grego\bahawatch` (SSH key set up) |
| Private demo artifact | https://claude.ai/artifact/Mjsm9genvWF9sFdXxuKis9 (version 34; update in place) |
| Flowchart artifact (the answer rule) | https://claude.ai/artifact/6EmnCVpoKj743RrE9PSFfL |
| Data folder on Gregor's PC | `C:\Users\grego\OneDrive\Desktop\Research\BahaWatch\Nationwide Update` (device_bash: `$HOME/mnt/Nationwide Update`) |

**Deploy (how Gregor gets commits onto GitHub).**
- Files sent to Gregor are capped at **30 MB**. Send a bundle of only the new commits
  (`git bundle create /mnt/user-data/outputs/bw.bundle origin-main-sha..<branch>`). Code-only rounds are small.
  If it is over 30 MB, split it (`split -b 28M -d -a 1 bw.bundle bw.part`, rename to `.bin`) and give the SHA-256.
- Round 2 went out as three parts. The PowerShell Gregor was given:

```powershell
cd $HOME\Downloads
cmd /c copy /b bahawatch-round2.part0.bin+bahawatch-round2.part1.bin+bahawatch-round2.part2.bin bahawatch-round2.bundle
(Get-FileHash bahawatch-round2.bundle).Hash   # 58FC9173BE6DB7E862E5867D099923D9AA503694EE77F3C7A00C95939756A94C
cd C:\Users\grego\bahawatch
git checkout main
git pull
git fetch $HOME\Downloads\bahawatch-round2.bundle phildev-ui-round2:phildev-ui-round2
git merge --ff-only phildev-ui-round2
git push origin main phildev-ui-round2
```

- **Giving Claude push access** was discussed 2026-09-28 and not set up. Pushing from his PC stays the default.

**The original four-point request** (all done): the "Babaha ba?" answer; Waze-style reports with no login; no accounts;
a nationwide PhilDev prototype at all 25 partner campuses.

---

## 3. Round 2 and the follow-up changes (branch `phildev-ui-round2`, 33 commits on `main` 9bf8529)

**Planned round 2** (spec, plan and build report in `docs/superpowers/{specs,plans,reports}/2026-09-27-phildev-ui-round2*`,
PDFs sent): fixes, six-language national and campus text, visual pass, PhilDev tab as a full-window map, site maps that
zoom out to the country, Try reporting in a phone outline. Reviewed per task and as a whole branch; build report written.

**Gregor's follow-up changes** (fast mode, no spec or report; he said "just change the code now, I'll ask for the detailed
review and reports"). Commits `62a9601` → `efbb216`:

1. **Own vector tiles, no outside tile server** (`62a9601`). PMTiles built with tippecanoe by `tools/build_basemap.py`:
   - `shared/tiles/ph-base.pmtiles` (~13.9 MB, z0–11): built-up density from Open Buildings, main roads, rivers, places;
   - `shared/tiles/ph-land.pmtiles` (~4.3 MB, z0–13): land polygon and coastline lines (PSA admin0);
   - `shared/tiles/site-<id>.pmtiles` (26, z12–15): streets, waterways, buildings per site.
   - Fonts in `shared/fonts/` (Noto Sans, OFL). pmtiles 4.5.0 bundled to `lib/pmtiles-4.5.0/pmtiles.mjs`.
   - OpenFreeMap is now used only for the UC Berkeley country fallback (`basemap-style-world*.json`).
   - The flood figure grows with the page.
2. **Partnership card removed** from campus pages (`d6cb878`).
3. **One map from country to street** (`4710036`): a MapLibre map sits under the flood canvases and follows their camera;
   sensors fade out when zoomed out and back in at campus zoom; other campuses show as pins; units on the national map.
4. **Receding water, wheel, coastline, country-wide typhoon** (`b29d00e`, `aa1533c`): "Oo" plus a "Receding" chip when a
   wet sensor falls ≥ 2 cm/h; wheel over HTML pins zooms the map; black coastline; "Simulate a typhoon" on the PhilDev map
   floods all campuses at once.
5. **Campus pages pick the weather** (`7b911a0`): "Simulated weather: Dry day / Habagat rain / Typhoon" above the map,
   in step with Details; "typhoon" wording throughout; UC Berkeley map restored (own canvas base, not GL); national map
   lets go of a selected campus (zoom < 8, off view, empty click, Escape) and keeps the Philippines in view; iPhone
   proportions for the Try phone.
6. **Simulation timeline on campus pages** (`efbb216`): play/pause, simulated PHT clock, scrub bar beside the weather
   buttons (captions above both groups so they share one row at 1280 px; wraps under at 390 px); one clock with Details;
   no speed buttons (plays at the Details speed). New strings `simPlay`, `simPause`, `simTimeline`, `simClock` in six
   languages (non-English marked for review).

7. **Maps wait while the page is hidden** (2026-09-28, after the push). Gregor saw "The detailed map can't be shown on
   this device" on every map a few hours after it worked. Cause: a page loaded while not on screen (background tab, tab
   restored after sleep) draws no frames, so MapLibre asks for no tiles and `bwOpenMap`'s 8 s limit rejected every map
   until a reload. Fix in `shared/basemap.js`: the limit counts only while `document.visibilityState` is not hidden and
   restarts when the page comes back. Tests: two in `shared/basemap.test.js`, and `test_hidden.js` (fails on the old code
   with exactly that note). If a user still sees the note after a visible reload, suspect the browser's WebGL (check
   `chrome://gpu`).

8. **Corrupted tile pieces from Chrome's cache** (2026-09-28, the real cause of Gregor's "can't be shown on this
   device" in Chrome but not Brave; his Chrome had WebGL hardware accelerated). After a redeploy, GitHub Pages gives
   every file a new ETag, and Chrome's cache served a zero-filled 16 KB start of `site-upd.pmtiles` (and
   `site-tv.pmtiles`) labelled with the old ETag. PMTiles threw "Wrong magic number", and because every map's style
   lists all 26 site archives, one bad archive took down every map. Fix in `shared/basemap.js`: `BwSource` checks each
   piece (header "PMTiles"; every other piece gzip `1f 8b`, as all our archives are gzip) and fetches a bad piece once
   more with `cache:'reload'`; `bwOpenMap` no longer gives up on an error from one tile source (`e.sourceId`). Tests:
   three `BwSource` tests and one `bwOpenMap` test in `shared/basemap.test.js`, and `test_tiles_corrupt.js` (real style
   via `window.BW_BASEMAP_STYLE='shared/basemap-style.json?real'`). Note: the other page suites run on the offline
   fixture style, so they never touch the real tile files; new tile-path tests should use the real style.

9. **How the flood is drawn** (2026-09-29, Gregor's items 1–4). `renderFlood` samples the model grid 4× finer through
   a signed field (`shoreField` in `shared/flood.js`: depth where wet; neighbouring water surface minus own ground where
   dry), so the edge follows the terrain; colours blend between the legend's bands; the shallowest ~8 cm fade out; with
   the detailed map on, building footprints from the site tiles (`footLoad`, `querySourceFeatures`, zoom ≥ 13) are cut
   out of the water, and at zoom ≥ 14.5 water shows in the alleys of fully built cells; a gentle non-directional shimmer
   (`drawShimmer`, off under reduced motion; non-directional because the model has no flow direction). Never more water
   than the model (tested). Test: `test_flood_look.js`. The model itself is unchanged.
   **Discussed, not done:** a benchmark against observed floods (Sentinel-1 / Copernicus EMS / geotagged photos) before
   changing the model; FathomDEM (Uhe et al. 2025, ERL 20 034002; CC BY-NC-SA, covers PH) in place of FABDEM (Hawker et
   al. 2022, ERL 17 024016); sensor ground from its surroundings; water surface sloping between sensors; resident
   reports as constraints; uncertainty bands; later LiPAD 1 m and a pre-run 2D scenario library or a GPU shallow-water
   model (the model is static: a level pool per sensor with a 1 cm/cell decay, 80 cells max).

**Still to do for round 2:**
- **Push the hidden-page fix**, then **check the live site**: tiles and fonts load (`.pmtiles` range requests, `.mjs` served as
  JavaScript), dark vector style, campus zoom-out, the new timeline. Claude has not seen the real dark style or the demo in
  a signed-in browser.
- When Gregor asks: the detailed review and reports (PDF) for the follow-up changes, and a refreshed build report.
- Gregor said more feedback items are coming.

---

## 4. Gregor's preferences and constraints (apply always)

- **Accuracy first**, honest limits; **$0** (free tiers only).
- **Documents:** specs, plans and reports also as PDF (`python3 tools/md_to_pdf.py <md> <pdf>`), but in fast mode only
  when he asks.
- **Accessibility in all work:** text contrast ≥ 4.5:1; 48 px targets; shape as well as colour; screen-reader text; no
  sideways scroll at 390 px.
- **UI:** `.ux-profile.md` ("subway signage on warm paper"; sentence case; no emoji; glyphs only ☾ ☀ ▾ ‹ ⌂ + −; weights
  400/600/700; sizes 12/14/16/20/25/31 (+39); nothing under 12 px, 12 px only for credits, timestamps, helper lines).
- **Figures:** Jack Baker palette (#385F96, #CF5921, #9EB8DB, #E7B800, #800000), Crameri colormaps, grayscale-safe,
  colour-blind check.
- **His PC:** Windows, PowerShell. Via the bridge: read only the downloads in `Nationwide Update`; write only under
  `bahawatch-data/campuses/`; never delete.
- **Approvals:** deploying (GitHub, Cloudflare) or publishing needs his yes. Never send his email to outside services.
- **Commits:** `git -c user.name=Gregor -c user.email=gregor500man.gerp@gmail.com commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` +
  newline + `Claude-Session: <this chat's session link>"`. Never push.

---

## 5. Technical reference

**Build.** `template.html` is the only page source; `python3 build_html.py` writes `bahawatch_dashboard.html`
(placeholders `__CAMPUSES__`, `__PH_OUTLINE__`, `__NAT_I18N__`, `/*__VERDICT_JS__*/`, `/*__FLOOD_JS__*/`,
`/*__BASEMAP_JS__*/`). Site data: `data/<id>.json` (25 campuses 200×200, tv 200×177, berkeley 240×180).
National/campus strings: `i18n/nat.json` (compact format: keep 1-space language indent, 2-space keys).

**Maps.**
- MapLibre GL JS 6.11.2 vendored in `lib/maplibre-gl-6.11.2/`. `shared/basemap.js`: `BwSource` (HTTP range requests,
  whole-file fallback on a 200), `bwStyleUrl(theme,set)`, `bwOpenMap`.
- Styles from `tools/basemap_style.py` → `shared/basemap-style.json`, `-dark.json` (our tiles), `-world*.json`
  (OpenFreeMap, Berkeley only). Coast line light `#232120`, dark `#c9c1b4`.
- Site map (`SITEGL`): non-interactive map `#site-gl` under the flood canvases, synced in `applyView()` via
  `siteGLSync()`; `GL_K=111320/110640` vertical stretch; `zoomFloor()`, `siteFade()`, `#site-pins`, `#to-country`
  ("Whole country" / "Back to the flood map"). `glOn()` requires `phSite()`; GL starts 800 ms after `switchSite`.
  Without WebGL the old country overlay is used (`window.BW_SITE_NO_GL` test hook).
- National map (`NATGL`): HTML pins and clusters, `natDeselect`/`natSelCheck`, `natLimits` (maxBounds PH ±6°/±5°).
  Typhoon sim `NSIM` on canvas `#nat-flood`, button `#nat-storm`.
- Rebuild tiles: `python3 tools/build_basemap.py --national <_national_osm.geojsonl> --density <_built_density.csv>
  --tippecanoe <path>`. Size limits that shaped it: 15 MB per file for artifact publishing.

**The answer rule** (`shared/verdict.js`, shared with the Worker): constants `FRESH_MIN 20`, `WET_CM 5`, `TRACE_CM 1`,
`LOOKAHEAD_MIN 60`, `REPORTS_YES 3`, `REPORT_RADIUS_M 1000`, `DRY_SENSOR_M 500`, `RAIN_YELLOW 7.5`, `RAIN_ORANGE 15`,
`RECEDE_CM_H 2`. Order: stale → sensor wet now/soon/upstream (Oo; falling ≥ 2 cm/h adds `trend:'falling'`) → 3+ reports
Baka → rain in NOAH zone or heavy rain Baka → 1–2 reports Baka → trace Baka → Hindi.

**Simulation clock.** `tMin` (0 to `T_END`=2160 min), `playing`, `speed` (Details 1×/4×/12×), `step()`,
`setPlay()`, `drawScrub(canvas)`, `scrubTo(clientX, canvas)`; bars `#scrub` (Details) and `#p-scrub` (campus page).
Demo chip `demoChip(L)`; weather buttons `.scen-group [data-sc=clear|monsoon|typhoon]`.

**Modes and links.** Demo default; live `#<site>/live` (only with an API build); Try `#try`. Service worker cache
`bahawatch-v4`, network-first, never caches range/206 responses.

**Worker** (Cloudflare Workers + D1 + Turnstile): written, not deployed, unchanged in round 2.

**Tests** (all green at `efbb216`):
- Page suites: `./test_pages.sh` (21 suites, incl. `test_flood_look.js`, `test_hidden.js`, `test_tiles_corrupt.js`,, incl. `test_zoomout.js` 26 checks and `test_zoomout_fallback.js`), served on
  8765 with `BW_TEST_BASEMAP=offline`. One suite: `./test_pages.sh test_x.js`; logs in `/tmp/bw_test_x.js.log`.
- `node --test --no-warnings shared/*.test.js sw.test.js` (54); `(cd worker && node --test --no-warnings test/*.test.js)`
  (46); `python3 -m unittest tools.test_basemap_style`; `./test_build.sh`.
- **Gotchas:** a probe server left running on 8765 (started without `BW_TEST_BASEMAP=offline`) makes `test_noaccount`
  and others fail: kill it by PID before `./test_pages.sh`. Never `pkill -f`/`pgrep -f` a pattern that appears in the
  same command line (kills the shell). Probes: write `_probe.js` in the repo so it can `require('playwright')`, delete after.

**Artifact publishing.** Absolute `file_path` (`/home/claude/work/bahawatch_dashboard.html`); for `files`, `root`
`/home/claude/work`; `.pmtiles`/`.pbf` need contentType `application/wasm`, `.mjs` `text/javascript`; ≤ 64 MB per
publish (batch), ≤ 15 MB per file; only changed files need re-sending.

**Gregor's PC (desktop workspace, Linux VM).** 180 s per `device_bash` call, foreground only; 400 MB per staged file;
`device_commit_files` ≤ 20 MB per file and can deliver a cached copy when a path is reused (stage under a fresh name).

---

## 6. Parked and standing items

**Parked until real reports are wanted:** Cloudflare setup; "plain link opens live mode"; live-only bugs (polling can
stall after a hidden-tab timer; live map description still describes simulated sensors).

**Deferred minors:** the list-only scroll layout (reverted; redo with a min-height condition); the country view's 44 px
box can surround a cluster; edge pins half-clipped; `.house-grid` clips unit ids in the Details rail; campus-page header
controls 36 px not 48; fil review tag empty in the menu; Kapampangan "taludtud" and Ilokano "putput-ol" to check;
`bwSetLocale` uses MapLibre's private `_locale`; a home-screen relaunch can restore `#try`; Try tab label stays English;
Undo text keeps the old language; unguarded `online` flush; a test title says "-> oo"; no sea legend entry;
`md_to_pdf.py` hard-codes its cwd.

**Standing:** real coordinates for the Berkeley demo unit; native-speaker review of all non-English strings (ceb, ilo,
hil, pam, and every `_review` string); LiPAD 1 m DTM when granted; optional JAXA GSMaP rain; a PhilDev counsel privacy
check before any launch (tile requests now go to our own GitHub Pages site, except the Berkeley fallback to
OpenFreeMap).

---

## 7. PDFs already sent (Gregor has copies)

- BahaWatch_Babaha-ba_Spec / Plan / Build_Report_2026-09-26.pdf
- BahaWatch_Try-Reporting_Spec / Plan_2026-09-26.pdf
- BahaWatch_PhilDev-Campuses_Spec / Plan / Build_Report_2026-09-27.pdf
- BahaWatch_PhilDev-UI-Round2_Spec / Plan / Build_Report_2026-09-27.pdf
- BahaWatch_Handoff_2026-09-27.pdf (superseded by this document)
