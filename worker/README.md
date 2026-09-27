# BahaWatch API (Cloudflare Worker)

Free tier: Workers, D1, Turnstile. No card needed for these three.

## One-time setup (Gregor, Windows PowerShell)

0. **Confirm the page's public URL first.** Everything below assumes the page is served
   from `https://gregor-posadas.github.io/bahawatch/` (GitHub Pages for the `bahawatch`
   repo). Open the Pages URL in a browser and check it. If it's different (another user
   or repo name, or a custom domain), use *that* URL everywhere below — the Turnstile
   hostname (step 2), `ALLOW_ORIGIN` in `wrangler.toml` (step 3), and the QR codes
   (step 6). A mismatch fails quietly: the page loads but every report and status call
   is refused.
1. Create a free account at https://dash.cloudflare.com/sign-up (email only).
2. Turnstile: Dashboard → Turnstile → Add widget → name "BahaWatch", hostname = the
   Pages URL's host (`gregor-posadas.github.io` for the default), widget mode
   **Invisible**. Copy the **site key** and **secret key**.
3. **In `worker/`** (starting from the repo root). First set `ALLOW_ORIGIN` under
   `[vars]` in `wrangler.toml` to the Pages URL's origin — scheme and host only, no
   path (`https://gregor-posadas.github.io` for the default). Then:
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
4. **Back at the repo root** (`build_html.py` lives there, not in `worker/`), build the
   live page with the two public values:
   ```powershell
   cd ..
   $env:BAHAWATCH_API="https://bahawatch-api.<you>.workers.dev"; $env:TURNSTILE_SITEKEY="<site key>"; python build_html.py
   ```
   Commit and push; GitHub Pages redeploys in about a minute.
5. **Smoke test** (any folder), once the first cron run has happened (wait ~5 min
   after deploy):
   ```powershell
   curl https://bahawatch-api.<you>.workers.dev/status/tv:s:BW-H01
   curl https://bahawatch-api.<you>.workers.dev/recent/tv
   ```
   or just open each URL in a browser. `/status/...` should come back with a recent
   `checkedAt` (the cron's last run time) — that also confirms the write-on-change
   `json_each` statement in `runCron` runs cleanly on real D1, not just the
   `node:sqlite` stand-in the tests use. `/recent/tv` should come back with
   `{"serverNow":...,"reports":[]}` (empty until real reports exist).
6. **Before printing any posters**, regenerate the QR codes for the confirmed Pages URL
   (from the repo root; the argument is the full page URL, ending in `/`):
   ```powershell
   python tools\make_qr.py https://gregor-posadas.github.io/bahawatch/
   ```
   then scan one with a phone and check it opens that place in live mode. Commit the
   regenerated `qr/` folder.

**Any change to `places.json`** (re-running `tools/build_places.py` after a `sites.py`,
data or boundary change) needs **both** a Worker redeploy (`npx wrangler deploy` in
`worker/` — the Worker bundles its own copy of `places.json`) **and** a page rebuild
(`python build_html.py` at the repo root, then commit and push), together. If only one
side is updated, the page asks for places the Worker doesn't know (404) or the Worker
computes answers for places the page can't show. If place ids changed, re-run
`tools\make_qr.py` too.

## Endpoints

- `GET /status/<place>` → that place's current answer. Sent with `Cache-Control:
  public, max-age=60`, but Cloudflare does **not** edge-cache Worker responses, so
  every request runs the Worker (100k requests/day on the free plan). The page
  therefore polls once per cron run — at `checkedAt` + 5 min + 0–30 s, never sooner
  than 60 s — about 12 requests per hour per open tab. Body:
  `{ place, answer, reason, etaMin, updatedAt, checkedAt, serverNow, stillThere }`.
  `updatedAt` is that place's own newest input (sensor/report/rain), from the
  heartbeat's per-place freshness, not the max across every place at the site.
  `checkedAt` is when the cron last ran (so "how stale is this" is always relative
  to the *server's* clock, `serverNow` — never the phone's, which can be wrong).
  `stillThere` is `{ ageMin, distM }` when a nearby "Oo" report is still within its
  window, else `null`.
- `GET /recent/<site>` → the last hour's real (non-demo) reports for the details-view
  map and log (same 60 s `Cache-Control`, same caveat: not edge-cached; the details view
  fetches it once a minute): `{ serverNow, reports: [{ lat, lon, answer, ageMin }] }`.
  Position is the already-rounded (~100 m) value stored at report time; no ids, no
  device info.
- `POST /report` → one-tap report. Body `{ place, answer, lat, lon, device, demo, token }`
  (`answer` one of `oo`/`hindi`/`di_sigurado`; `token` is the Turnstile response).
  Rejects with 400 on a bad/unknown place, a malformed body, or a position more than
  2 km from the place's centre; 403 if Turnstile fails. One row per phone (`device`)
  per place per 10 minutes: **429 "already recorded"** if this phone sends the *same*
  answer for this place again within 10 minutes — the page shows that as a normal
  "Thanks, recorded", not an error, so a double-tap or an offline-queue retry is
  harmless. A *different* answer within the 10 minutes (e.g. "Hindi" to "Still
  there?" after its own "Oo") updates that phone's row (answer, time, position) and
  returns 201 with the same id — latest wins. On success: `{ id }`.
- `POST /report/<id>/undo` → body `{ device }`; deletes the report only if it's the
  same device and it's still within 15 s of the original report (the page's own Undo
  button times out at 10 s, so this always leaves it margin). 410 once too late.
- `POST /ingest` → sensor unit reading. Header `Authorization: Bearer <device key>`,
  body `{ sensor, at, depthCm }`. The device key is checked against `DEVICE_KEYS`
  (a `{sensor: key}` JSON secret) in constant time — an unknown sensor id and a wrong
  key take the same code path and cost the same time, so neither is distinguishable
  by timing.
- `POST /subscribe` → 501 "alerts not enabled yet" (round two).

## What's stored, and for how long

- **Location**: the phone rounds GPS to 3 decimal places (~100 m) before sending it,
  and the server rounds again on the way in — no exact position, name or phone
  number is ever stored. The phone only sends its GPS fix when it's within 1 km of the
  place; otherwise it sends the place's centre. `device` is a random per-browser id,
  not tied to an account.
- **Reports** (raw rows: place, rounded lat/lon, answer, device id, timestamp):
  the device id is blanked (`device=''`) by the hourly job once a report is more than
  61 minutes old — after it has stopped counting, so nothing that runs later needs it
  (counting, the 10-minute repeat check and Undo all look back 60 minutes or less).
  Rows are deleted after 30 days.
- **Hourly counts** (place, hour, counts of oo/hindi/di_sigurado, rolled up from
  reports once an hour): kept indefinitely — small, aggregate, not personal.
- **Sensor readings**: kept, not deleted — this is field data (not personal), and
  the plan is to use the history to tune the rule's thresholds later.
- **Status/heartbeat**: one row per place plus one heartbeat row; overwritten each
  run, not a history.

## Cron

Runs every 5 minutes (`[triggers] crons` in `wrangler.toml`): refreshes rain per
site (Open-Meteo, 10 s timeout; a failed or timed-out call, or a site whose values
come back null, keeps that site's last stored rain, which then ages out on its own),
reads recent sensor readings (by time, through the `readings_at` index — readings are
kept forever, so this must never be a full scan) and reports, recomputes every place's verdict,
and writes only the places whose answer/reason/eta/still-there actually changed —
one `INSERT ... FROM json_each(...)` statement for however many places changed,
not one write per place, plus one heartbeat row — to stay under D1 Free's 50-query-
per-invocation cap. Measured at 9 queries on the very first run (nothing cached
yet), 8 on a steady run, 13 on the top of the hour (when the hourly rollup, the
30-day report purge and the device-id blanking also run).

## Tests

**In `worker/`**:
```
npm test
```

46 tests, Node 22, using `node:sqlite` as a stand-in for D1 (`test/fake-d1.js`).
The shared rule module (`../shared/verdict.js`) has its own tests one level up —
run those **from the repo root** as `node --test shared/*.test.js` (a bare
directory argument fails on Node 22).
