# BahaWatch API (Cloudflare Worker)

Free tier: Workers, D1, Turnstile. No card needed for these three.

## One-time setup (Gregor, Windows PowerShell)

1. Create a free account at https://dash.cloudflare.com/sign-up (email only).
2. Turnstile: Dashboard → Turnstile → Add widget → name "BahaWatch", hostname `gregor-posadas.github.io`,
   widget mode **Invisible**. Copy the **site key** and **secret key**.
3. **In `worker/`** (starting from the repo root):
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

## Endpoints

- `GET /status/<place>` → that place's current answer, cached 60 s. Body:
  `{ place, answer, reason, etaMin, updatedAt, checkedAt, serverNow, stillThere }`.
  `updatedAt` is that place's own newest input (sensor/report/rain), from the
  heartbeat's per-place freshness, not the max across every place at the site.
  `checkedAt` is when the cron last ran (so "how stale is this" is always relative
  to the *server's* clock, `serverNow` — never the phone's, which can be wrong).
  `stillThere` is `{ ageMin, distM }` when a nearby "Oo" report is still within its
  window, else `null`.
- `GET /recent/<site>` → the last hour's real (non-demo) reports for the details-view
  map and log, cached 60 s: `{ serverNow, reports: [{ lat, lon, answer, ageMin }] }`.
  Position is the already-rounded (~100 m) value stored at report time; no ids, no
  device info.
- `POST /report` → one-tap report. Body `{ place, answer, lat, lon, device, demo, token }`
  (`answer` one of `oo`/`hindi`/`di_sigurado`; `token` is the Turnstile response).
  Rejects with 400 on a bad/unknown place or malformed body, 403 if Turnstile fails,
  and **429 "already recorded"** if this phone (`device`) already reported this place
  in the last 10 minutes — the page shows that as a normal "Thanks, recorded", not an
  error, so a double-tap or an offline-queue retry is harmless. On success: `{ id }`.
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
  number is ever stored. `device` is a random per-browser id, not tied to an account.
- **Reports** (raw rows: place, rounded lat/lon, answer, device id, timestamp):
  deleted after 30 days.
- **Hourly counts** (place, hour, counts of oo/hindi/di_sigurado, rolled up from
  reports once an hour): kept indefinitely — small, aggregate, not personal.
- **Sensor readings**: kept, not deleted — this is field data (not personal), and
  the plan is to use the history to tune the rule's thresholds later.
- **Status/heartbeat**: one row per place plus one heartbeat row; overwritten each
  run, not a history.

## Cron

Runs every 5 minutes (`[triggers] crons` in `wrangler.toml`): refreshes rain per
site, reads recent sensor readings and reports, recomputes every place's verdict,
and writes only the places whose answer/reason/eta/still-there actually changed —
one `INSERT ... FROM json_each(...)` statement for however many places changed,
not one write per place, plus one heartbeat row — to stay under D1 Free's 50-query-
per-invocation cap. Measured at 9 queries on the very first run (nothing cached
yet), 8 on a steady run, 12 on the top of the hour (when the hourly rollup and the
30-day report purge also run).

## Tests

**In `worker/`**:
```
npm test
```

34 tests, Node 22, using `node:sqlite` as a stand-in for D1 (`test/fake-d1.js`).
The shared rule module (`../shared/verdict.js`) has its own tests one level up —
run those **from the repo root** as `node --test shared/*.test.js` (a bare
directory argument fails on Node 22).
