# BahaWatch: handoff for a new chat

Last updated: 2026-09-27 (Sunday), after plan Task 5 of 13 (pipeline run on Gregor's PC).
Kept at `docs/superpowers/handoff/BahaWatch_Handoff.md` in the repo and as `claude/BahaWatch_Handoff.md` in the
"Berkeley PhD" Project. It is refreshed at milestones (after plan Tasks 5, 7 and 13) and whenever work stops mid-plan.

---

## 1. How to resume in a new chat

1. **Start the chat inside the "Berkeley PhD" Project.** That way this document, the spec and the plan are readable
   from the Project.
2. **Attach `bahawatch.bundle`** from your Downloads. It is the whole git history, including the unmerged
   `phildev-campuses` branch. The newest copy is the one Claude sent last in the previous chat.
3. **Link the chat to your computer** (desktop app → "Link to this computer") if the work needs your PC.
   The pipeline step (plan Task 5), and re-staging the campus cuts, both need it.
4. **Paste this as the first message:**

> Continue BahaWatch from the handoff document `claude/BahaWatch_Handoff.md` in this Project (read it first, all
> of it). Restore the repo from the attached `bahawatch.bundle` into `/home/claude/work` on branch
> `phildev-campuses`, then continue executing `docs/superpowers/plans/2026-09-27-philippines-phildev-campuses.md`
> natively (superpowers:executing-plans) from the first task not marked done in the handoff's progress table,
> checking `git log` too. Don't redo finished tasks. Ask me only what the plan says to ask.

**What the new chat should do first:**

```bash
git clone -b phildev-campuses /mnt/user-data/uploads/bahawatch.bundle /home/claude/work
cd /home/claude/work && git config user.name "Gregor" && git config user.email "gregor500man.gerp@gmail.com"
git branch -a && git log --oneline -12
```

**Restore the ignored folders.** These are not in git, so a new container lacks them:

- `inputs/noah/`: the Metro Manila NOAH shapefiles that Teachers Village uses. Copy the `MetroManila_Flood_{5,25,100}year`
  shapefiles out of the NOAH zips in `Nationwide Update` (`5yr/MetroManila.zip` and so on) into `inputs/noah/`.
- `inputs/campuses/`: the per-campus cuts (after Task 5). Stage `…\bahawatch-data\campuses\_stage_cuts*.zip` from
  your PC and unzip it into `inputs/campuses/` (plan Task 5 Step 8). Your PC keeps them, so the pipeline need not re-run.

**Also:**

- **Python packages:** `pip install --break-system-packages -q duckdb pyarrow osmium shapely` (rasterio, pyproj, pyshp,
  scipy and numpy are usually present). Node 22 and Playwright are present, with Chromium at `/opt/pw-browsers/chromium`.
- **The execution ledger** (`.superpowers/sdd/…/progress.md`) is git-ignored and does not survive. Section 3 below and the
  commit messages are the record. Start a fresh ledger whose first line names the plan, and copy in the rulings from §3.

---

## 2. The project in one page

**BahaWatch** is Gregor's flood dashboard. It combines low-cost household water-level sensors with a terrain-fill flood
model, and answers residents' question **"Babaha ba?"** ("Will it flood?") for the next hour, at their own street or
barangay.

| What | Where |
|---|---|
| Public site (GitHub Pages) | https://gregor-posadas.github.io/bahawatch/ |
| Repo | `gregor-posadas/bahawatch` (Gregor pushes; Claude never does) |
| Gregor's clone on Windows | `C:\Users\grego\bahawatch` |
| Private demo artifact | https://claude.ai/artifact/Mjsm9genvWF9sFdXxuKis9 (update in place; read it first) |
| Flowchart artifact (the answer rule) | https://claude.ai/artifact/6EmnCVpoKj743RrE9PSFfL |
| Data folder on Gregor's PC | `C:\Users\grego\OneDrive\Desktop\Research\BahaWatch\Nationwide Update` (device_bash: `$HOME/mnt/Nationwide Update`) |

**Deploy.** Claude makes `git bundle create /mnt/user-data/outputs/bahawatch.bundle main` (plus the branch while one is open)
and sends it. Gregor then runs, in PowerShell:

```powershell
cd $HOME\bahawatch
git pull "$HOME\Downloads\bahawatch.bundle" main
git push
```

**The original four-point request:**
1. The "Babaha ba?" next-hour answer.
2. Waze-style reports with no login (yes / no / not sure, no photos).
3. No accounts.
4. A nationwide Philippines prototype for PhilDev showing "what a partnership would look like" at all 25 PhilDev partner
   institutions.

Points 1–3 are live, and so is the "Try reporting" tab. **Point 4 is in progress** (§3).

---

## 3. Where the work is now: the nationwide PhilDev prototype

**Status and documents:**

| Item | Status | File (repo) | PDF sent |
|---|---|---|---|
| Design spec | approved 2026-09-27 | `docs/superpowers/specs/2026-09-27-philippines-phildev-campuses-design.md` | BahaWatch_PhilDev-Campuses_Spec_2026-09-27.pdf |
| Implementation plan | approved; **execution: Native** | `docs/superpowers/plans/2026-09-27-philippines-phildev-campuses.md` | BahaWatch_PhilDev-Campuses_Plan_2026-09-27.pdf |
| Branch | `phildev-campuses` (from `main` at 539d17d) | — | — |

**Progress table.** Claude updates this at each refresh. "Done" means committed on the branch; check `git log`.

| Task | What | Status |
|---|---|---|
| 1 | Campus list (`pipeline/campuses.csv`) and box maths | **done** (a239034) |
| 2 | OSM passes (campus outlines; streets and creeks) | **done** (f44047a; faster streets pass in Task 5) |
| 3 | FABDEM clip, buildings scan, NOAH, barangays, country outline | **done** (d54413a; NOAH index + numpy reader in Task 5) |
| 4 | `run_pc.py find/cut` (the PC command line) | **done** (11a0b78) |
| 5 | **Run on Gregor's PC**; choose outlines; fill centres; bring the cuts in | **done** — cuts for 25 campuses + tv in `inputs/campuses/` (and `…\campuses\_stage_cuts.zip` on the PC) |
| 6 | Model: grids, placement, card | not started |
| 7 | Build the 27 site data files | not started |
| 8 | Page: one site file at a time, router, old links, test server | not started |
| 9 | Page: shared flood fill, obstacles, sea, counts | not started |
| 10 | Page: national map and campus list | not started |
| 11 | Page: campus bar, simulation label, card, service worker | not started |
| 12 | Accessibility, speed and size checks | not started |
| 13 | Docs, QR codes, screenshots, final review, build report PDF, demo, bundle | not started |

**Rulings made during execution (Task 5):**
- PC steps run in the foreground, because background jobs die when a call ends. `cut` ran in groups of 3–5 boxes.
- Streets pass: every 8th node is checked first, with a 0.05° pad.
- NOAH: a province-extent index (`_noah_index.json`), a numpy shapefile reader, and empty zips skipped.
- Outline choices, e.g. upd r20670730 and uplb w517120243. The wider pattern for QCU found the Quezon City Polytechnic University main campus.
- LLCC isn't in OpenStreetMap, so it uses the Wikipedia point 10.29297, 123.95040 as a `manual` centre. Gregor was asked to correct it if wrong.
- The country outline is 70 KB. Task 7 simplifies it further.

**Before these:** The plan's own rulings are listed in the plan: synthetic fixtures,
dark pin colours, `#nat-count` as the national status region, and the Task 7/8 allowances.

**Decisions Gregor made for point 4** (spec §2):

- **Depth and coverage:** all 25 campuses at full depth, each covering the campus plus its neighbours in a 3 km box.
- **Units:** placed automatically only, 8 per campus, one on campus.
- **Terrain:** FABDEM bare earth for all Philippine sites, including Teachers Village and UP Diliman; Berkeley keeps USGS 1 m.
- **Buildings** are obstacles: a cell that is ≥ 75 % built blocks water, and streets and creeks never block.
- **Loading:** the page opens on a national map and loads one campus file at a time. Pilot sites (Teachers Village, UC
  Berkeley) and the Try reporting tab stay.
- **UP Diliman** becomes a normal campus page (`#upd`), and old `#diliman` links redirect there.
- **Where the cutting runs:** on Gregor's PC, only after plan approval (given 2026-09-27). It reads the downloads and writes
  only under `bahawatch-data/campuses/`.
- **The three spec notes Gregor accepted:**
  - "Central Luzon University" is read as Central Luzon State University;
  - USC uses the Talamban campus;
  - UMak's city is Taguig.

**Main-campus picks and ids** are in the spec §4 table. Ids are lowercase letters only: `bsu clsu cmu dlsu feutech jru mapua
plp ptc pup qcu sti udm umak ust upd uplb ctu usc llcc mcc upc msuiit ustp xu`.

---

## 4. Gregor's preferences and constraints (apply always)

**Accuracy and cost**
- Accuracy first ("as true to reality as possible"); state limits honestly.
- $0: free tiers only.

**Documents**
- Specs, plans and reports go out **as PDF** too (`python3 tools/md_to_pdf.py <md> <pdf>`).

**Accessibility, in all work**
- Contrast ≥ 4.5:1 for text.
- 48 px tap targets.
- Shape as well as colour.
- Screen-reader text.
- No sideways scroll at 390 px.

**Figures**
- Figures follow Jack Baker's guidance. The categorical palette, in order: #385F96, #CF5921, #9EB8DB, #E7B800, #800000.
- Crameri colormaps (Davos for sequential, Vik for diverging); never rainbow.
- Figures must stay readable in grayscale.
- Check with a colour-blind simulation.

**His computer and approvals**
- Windows PC with PowerShell.
- Deploying (GitHub, Cloudflare) or publishing needs his approval; Claude prepares the bundle and he pushes.
- Never send his email address to outside services.

**Workflow**
- Superpowers: brainstorming → spec (+PDF) → writing-plans (+PDF) → execution. He chose subagent-driven before and
  **Native** now. The whole-branch review runs at the end.

**Commits**
- Author: `Gregor <gregor500man.gerp@gmail.com>` (set in the repo config).
- The second `-m` of every commit:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and a line `Claude-Session: https://claude.ai/code/session_01ERMBTgFv3dco765efQ5BjG`.
  A new chat uses its own session link if its system reminder gives one.

---

## 5. Technical reference

**Build.**
- `template.html` is the only page source. `build_html.py` builds `bahawatch_dashboard.html` (env `OUT`, `BAHAWATCH_API`,
  `TURNSTILE_SITEKEY`).
- Before plan Task 8, site data was embedded from `data.json`, `data_diliman.json` and `data_berkeley.json`. From Task 8,
  the page fetches `data/<site>.json` and embeds only the campus list and the country outline.
- `build_data.py`: `SITE=<id> python3 build_data.py`, with config in `sites.py`.
- `tools/build_places.py` writes the places: `places.json` for the Worker, plus each data file after Task 7.

**The answer rule** is `shared/verdict.js`, a pure function shared by the page and the Worker.
- Constants: `FRESH_MIN 20`, `WET_CM 5`, `TRACE_CM 1`, `LOOKAHEAD_MIN 60`, `REPORTS_YES 3`, `REPORT_RADIUS_M 1000`,
  `DRY_SENSOR_M 500`, `RAIN_YELLOW 7.5`, `RAIN_ORANGE 15`.
- Order:
  1. stale data;
  2. a sensor here, wet now (the deepest) or soon (the soonest), or upstream within 60 min → **Oo**;
  3. 3+ phones → **Baka** (reports alone never say Oo);
  4. rain in a NOAH zone, or heavy rain → Baka;
  5. 1–2 reports → Baka;
  6. a trace of 1–4 cm → Baka;
  7. otherwise **Hindi** (`clear` / `clear_no_sensor`).
- Place ids: `<site>:s:<sensor>` and `<site>:b:<pcode>`. Share links: `#p.<site>.<s|b>.<code>`.

**Modes and links.**
- Demo is the default. Live mode is `#<site>/live` (only when the build has an API).
- Try reporting is `#try`: Teachers Village, place BW-H03 "22 Malingap Street", no network.
- The PWA `start_url` is `bahawatch_dashboard.html?source=pwa`, which restores `bw-last-hash`.

**Worker** (Cloudflare Workers + D1 + Turnstile): **written but not deployed**; it waits until real reports are wanted.
- Endpoints: `/status/<place>`, `/recent/<site>`, `/report`, `/report/<id>/undo`, `/ingest`, `/subscribe` (501).
- D1 Free allows 50 queries per invocation, and each statement in a batch counts. With 27 sites a cron run makes about 27 rain
  writes plus about 6 queries: re-count before deploying.

**Tests.**
- Rule: `node --test --no-warnings shared/*.test.js` (a folder argument fails on Node 22).
- Worker: `cd worker && node --test --no-warnings test/*.test.js`.
- Places: `python3 tools/test_places.py`.
- Build: `./test_build.sh`.
- Page suites: from Task 8, `./test_pages.sh` runs every `test_*.js` over `http://127.0.0.1:8765/`. Before Task 8, `node test_x.js`
  opens `file://`.
- Failures print `FAIL` at the start of a line.

**Gregor's PC (desktop app workspace).**
- Linux, 3.9 GB RAM, 2 cores, Python 3.10; pip works.
- Up to 180 s per `device_bash` call, so run long steps with `setsid nohup … &` and poll.
- At most 400 MB per staged file.
- Inputs in `Nationwide Update`:
  - `bahawatch-data/fabdem`: 109 FABDEM V1-2 tiles;
  - `bahawatch-data/barangays`;
  - `PHL_buildings.parquet`: 5 GB, VIDA Google+Microsoft+OSM; columns `bf_source`, `bbox` struct, WKB `geometry`;
  - `philippines-260925.osm.pbf`: 607 MB;
  - `phl_admin_boundaries.shp.zip`: admin0–4, admin4 fields `adm4_name`, `adm4_pcode`, `adm3_name`, `center_lat`, `center_lon`;
  - NOAH zips `5yr/25yr/100yr-*.zip`, holding `<rp>yr/<Province>.zip` with a `Var` field. Every province the 25 campuses need
    is covered at all three periods.

---

## 6. Parked and standing items

**Parked until real reports are wanted:**
- the Cloudflare setup walkthrough;
- "plain link opens live mode";
- the live-only bugs: live polling can stall after a hidden-tab timer, and the live map description still describes simulated
  sensors.

**Deferred minors** (from the earlier build reports):
- a home-screen relaunch can restore `#try`;
- the Try tab label stays English;
- the Undo text keeps the old language;
- the `online` flush is unguarded;
- a test title still says "-> oo".

**Standing:**
- real coordinates for the Berkeley demo unit;
- native-speaker review of the ceb, ilo, hil and pam strings, and of all `_review` strings from this round;
- LiPAD 1 m DTM when granted (it would replace FABDEM);
- optional JAXA GSMaP rain;
- a PhilDev counsel privacy check before any launch.

---

## 7. Other PDFs already sent (in `/mnt/user-data/outputs/` of the old session; Gregor has copies)

- BahaWatch_Babaha-ba_Spec / Plan / Build_Report_2026-09-26.pdf
- BahaWatch_Try-Reporting_Spec / Plan_2026-09-26.pdf
- BahaWatch_PhilDev-Campuses_Spec / Plan_2026-09-27.pdf
