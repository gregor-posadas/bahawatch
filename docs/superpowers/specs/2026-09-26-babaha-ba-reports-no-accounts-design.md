# "Babaha ba?", neighbour reports and no accounts — design

Date: 2026-09-26 · Status: approved in conversation, awaiting written-spec review
Flowchart for sharing: https://claude.ai/artifact/6EmnCVpoKj743RrE9PSFfL

## 1. Purpose

Residents who see rain want one answer: **will it flood here, soon?** BahaWatch answers
that for the **next hour** at the person's own place, lets neighbours confirm what they
see with one tap, and asks nobody to make an account. This round prepares the ground for
the nationwide PhilDev prototype (§9), which gets its own spec.

**What Gregor said:** the horizon is the next hour, not days; the UI must stay as simple as
the current public view; reporting should feel like Google Maps / Waze (yes / no / not
sure, no photos); no accounts, with older Filipinos in mind; spend as little as possible;
the model should be as true to reality as the free data allows.

**Assumptions (not said):** phone-first users on patchy data; the answer must be honest
about uncertainty; the public page stays static on GitHub Pages.

**Success looks like:**
- Anyone opening the page for a place sees Oo / Baka / Hindi with one reason and its age,
  and everyone looking at the same place sees the same answer.
- A report takes one tap, needs no login, and cannot be spammed cheaply.
- The page never shows "Hindi" on stale data.
- Running cost is $0 at prototype scale.
- The PhilDev demo runs the same rule as the live system.

## 2. Decisions taken in conversation

| # | Decision | Chosen | Rejected and why |
|---|---|---|---|
| D1 | Forecast horizon | Next hour | 3 h (more "maybe", weaker); layered (more complex than needed now) |
| D2 | Report location | GPS if allowed (rounded ~100 m on the phone), else picked street / barangay | GPS only (permission prompt confuses older users); pick only (less precise) |
| D3 | Photos | None in v1 | Moderated photos (needs volunteers on duty during storms); auto-blur (misses faces, plates) |
| D4 | Can reports alone say "Oo"? | Yes: 3+ from different phones within 1 km in 60 min, unless a dry sensor within 500 m contradicts | Sensors only (silent where no sensor exists); reports cap at "Baka" |
| D5 | Where the answer is decided | Server decides (Cloudflare Worker), shared rule file also used by the page | Each phone decides (answers diverge, rate limits); demo-only (reports not real) |
| D6 | Alerts | Built to support now, switched on in round two | Ship on day one before reports are trusted |
| D7 | Terrain for the model | FABDEM V1-2 (bare earth, 30 m), LiPAD 1 m where granted | Raw Copernicus (rooftops and canopy raise the ground) |
| D8 | Buildings | VIDA Google + Microsoft + OSM footprints, used as obstacles (porosity) in the fill model | OSM only (thin outside cities) |

## 3. The "Babaha ba?" rule

"Here" is, in order: the picked street if it has a sensor; else within ~1 km of the phone's
location if allowed; else the picked barangay.

Inputs per place, refreshed every 5 minutes: sensor depth, rate of rise and the travel-time
estimate from connected sensors; distinct Yes/No reports within 1 km in the last hour;
rain in the past hour and next hour; NOAH hazard class (5 / 25 / 100-year) and terrain
lowness.

Checks run top to bottom; the first match wins.

1. **Freshness.** If the newest input is more than 20 minutes old → **Walang bagong datos**
   (grey, dashed). Never "Hindi".
2. **Sensors.** A sensor here reads ≥ 5 cm, or will reach 5 cm within 60 min at its
   current rate, or water from a connected sensor arrives within 60 min → **Oo**.
3. **Reports.** 3 or more "Yes" reports from different phones within 1 km in the last
   hour → **Oo**, unless a sensor within 500 m is dry and steady → **Baka**
   ("Neighbours report flooding; sensor here is dry").
4. **Conditions.** Any of: PAGASA yellow rain or heavier (≥ 7.5 mm/h, now or next hour)
   and the place is in NOAH's 5- or 25-year flood zone; orange or red rain (≥ 15 mm/h)
   anywhere NOAH-mapped; 1–2 "Yes" reports nearby; a sensor here showing 1–4 cm → **Baka**.
5. Otherwise → **Hindi**.

Every answer carries one plain reason line and its age, e.g. "Water rising on Maginhawa St,
~20 min away · updated 3 min ago". For "Oo" from sensors the reason includes the
time-to-flood.

**Counting reports:** each phone counts once, by its latest report in the window. "Oo" counts
are phones whose latest report is Oo, so a phone that answers "Hindi" to "Nandiyan pa ba?"
stops counting. Other phones' "Hindi" reports are stored but do not subtract in v1.

Thresholds (5 cm, 3 reports, 1 km, 500 m, 20 min, 60 min) are starting values, kept as named
constants in one place and tuned later against field data.

## 4. Neighbours' reports

- **Ask:** one line under the answer, "May baha ba rito?", with Oo / Hindi / Hindi sigurado.
  Confirmation "Salamat, naitala" with a 10-second Undo.
- **Still there?:** if a flooding report exists within ~300 m in the last 30 min, the
  question becomes "May nag-ulat ng baha malapit dito. Nandiyan pa ba?"; the answer counts
  as a report.
- **Location:** GPS rounded to ~100 m on the phone before sending, else the picked place.
  The server never receives an exact position.
- **Different phones without accounts:** a random ID generated on the phone at first
  report and stored there; Cloudflare Turnstile (invisible) on every report; one report per
  place per 10 minutes per phone.
- **Retention:** a report counts for 60 minutes in the rule; raw reports are deleted after
  30 days; anonymous hourly counts per area are kept for model checking.
- **Display:** the simple view shows counts in words ("3 neighbours report flooding · 12
  min ago"). The details view shows each report as a hollow diamond on the map (a shape no
  sensor uses) and a report log.

## 5. No accounts

- **On the phone only:** the chosen place (street, barangay or "use my location"),
  language, theme, and the random report ID. Nothing on the server identifies a person.
- **Share my place:** "Ibahagi ang lugar ko" makes a short link (`#<token>`, a bare hash
  token) that sets the place on any phone.
- **QR per barangay / campus** for posters, generated by the pipeline.
- **Add to Home Screen:** web app manifest and icon. Opened offline it shows the last
  answer with its age, turning grey "Walang bagong datos" once older than 20 minutes.
- **Forgotten phone:** re-pick in two taps or scan the QR.
- **Alerts (round two):** anonymous Web Push per place. The server holds only the push
  address and the place; unsubscribing deletes both. Android works directly; iPhone after
  Add to Home Screen. This round builds the storage and endpoint shape but does not
  subscribe anyone.
- **Privacy:** no names, numbers or exact locations collected. PhilDev's counsel to review
  against the Data Privacy Act before a public launch.

## 6. Simple-view layout

Phone, top to bottom: header → **answer band** ("Babaha ba? · <place>", word + shape +
colour, reason, age) → **report row** → depth figure → nearby streets list with
"Show map". Desktop: figure to the right of the answer; map beside the list, as now.

- Today's area-wide headline moves to a smaller line under the list.
- **First visit:** "Saan ka?" with Use my location / Pick my barangay / Pick a street with
  a sensor. Skippable; if skipped, the top shows area-wide status and a "Pick your place"
  button.
- Map behind "Show map" on phones; always visible on desktop.

**Accessibility:** answer in word + shape + colour (square Oo, triangle Baka, circle
Hindi, dashed grey no-data), matching the map markers; announced to screen readers on
change via a live region; report buttons ≥ 48 px with visible focus; Undo reachable by
keyboard; contrast ≥ 4.5:1 in both themes; all strings in the six languages with the
existing review flags.

## 7. Architecture

```
GitHub Pages (static)                 Cloudflare Worker (free tier)
  bahawatch_dashboard.html              cron every 5 min
  verdict.js  ◄──── same file ────►     verdict.js
  places.json ◄──── same file ────►     places.json
      │  GET /status/<place> (60 s cache)      ▲ Open-Meteo (batched), later GSMaP
      │  POST /report  (Turnstile token)       ▲ POST /ingest (sensor units, per-device key)
      ▼                                         D1: reports, readings, status (write on change)
```

- **verdict.js:** pure function, no I/O. Input: place facts, sensor series, report counts,
  rain now / next hour, clock. Output: `{answer, reason, updatedAt, eta}`.
- **places.json:** built by the pipeline. Per place: id, name, kind (sensor street /
  barangay), centroid, NOAH class, lowness, connected sensors with travel times.
- **Active places:** sensor streets, barangays within the campus areas, and any place picked
  or reported in the last 24 h.
- **Rain adapter:** one module that returns rain now / next hour per place; Open-Meteo first,
  GSMaP added behind the same interface once JAXA registration is approved.
- **Freshness signal:** each cron run writes one heartbeat row (newest input time per data
  source). `/status` combines the stored answer with that heartbeat, so an unchanged answer
  still reports how fresh its inputs are.
- **Free-tier budget:** status written only when it changes; `/status` served from cache;
  cron CPU per place is microseconds. Stays within 100k requests/day and 100k D1
  writes/day at prototype scale.

**Failure handling:** Worker unreachable or data older than 20 min → "Walang bagong datos";
report fails → "Hindi naipadala, subukan ulit" with retry; offline report held ≤ 10 min
then dropped; reports made during a demo playback are tagged `demo` and excluded from live
counts.

**Demo mode:** the page runs verdict.js locally on the simulated storm so the answer moves
Hindi → Baka → Oo on cue, with the existing "Demo: simulated" label.

## 8. Testing

- **verdict.js:** table test covering every flowchart branch and the edges (4.9 / 5.0 cm,
  2 / 3 reports, 19 / 21 min freshness, dry-sensor override, yellow rain outside vs inside
  the 5/25-year zone).
- **Worker:** local runs with Cloudflare's dev tool: rate limit, ~100 m rounding, Turnstile
  failure path, write-only-on-change, demo tag exclusion.
- **Page (Playwright):** answer band states and live-region announcement, report row and
  Undo, "Still there?" prompt, first-visit picker, share link sets the place, offline →
  grey no-data, contrast in both themes. The existing 163 assertions stay green.

## 9. Out of scope here (next spec: nationwide PhilDev prototype)

All 25 PhilDev partner campuses on a national map; per-campus model runs on FABDEM +
buildings; building-aware (porosity) water in the fill model; NOAH provincial layers.
Data already downloaded to `OneDrive\Desktop\Research\BahaWatch\Nationwide Update`:
FABDEM (109 tiles), PHL buildings parquet (5.0 GB), OSM Philippines pbf, PSA/NAMRIA admin
boundaries (levels 0–4), NOAH flood shapefiles (100-yr 79 provinces usable; 25-yr and
5-yr with gaps that also exist in NOAH's published data).

Also out of scope: photos, alerts switched on, SMS, PhilSensors / PAGASA data agreements.

## 10. What Gregor does once

Create a free Cloudflare account (email), and paste the Turnstile secret when asked.
Register for JAXA GSMaP (optional, for the rain adapter's second source).
