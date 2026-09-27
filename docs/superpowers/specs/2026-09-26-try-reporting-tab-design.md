# "Try reporting" tab, reports-cap rule, GitHub-Pages-only prototype — design

Date: 2026-09-26 · Status: design approved in conversation, awaiting written-spec review
Builds on: `2026-09-26-babaha-ba-reports-no-accounts-design.md` (branch `babaha-ba`)

## 1. Purpose

The prototype stays on GitHub Pages with no server for now. PhilDev and others still need to
see how neighbour reporting works, so the page gets a **"Try reporting" tab**: one phone on the
left as a resident sees it, and the neighbourhood map and answer on the right. Visitors tap the
phone, add pretend neighbours, set a pretend sensor, and watch the answer change. Nothing leaves the page.

**What Gregor said:**
- Reports alone may raise the answer to Baka at most (spam protection).
- The reporting feature does not need to be fully operational now; keep the prototype on GitHub
  Pages, but show a proof of concept there.
- Wants a dedicated tab to simulate a phone reporting, kept simple: phone and map.
- Plain link opening live mode, and the Cloudflare setup, wait until real reports are wanted.

**Assumptions (not said):** the tab uses Teachers Village, because it has the densest sensor
set and real terrain. The tab is a teaching tool, so it explains the rule in one plain line.

**Success looks like:**
- In under a minute, a visitor can get "Oo" from a sensor and "Baka" from three neighbours, and
  sees why each time.
- The tab runs the same rule file as the live system.
- Nothing is sent over the network from the tab.

## 2. Decisions

| # | Decision | Chosen | Rejected and why |
|---|---|---|---|
| E1 | Spam protection | Reports alone cap at **Baka**; only a sensor makes **Oo** | Group reports by network address (undercounts neighbours who share a carrier address); keep 3 reports → Oo (cheap to fake) |
| E2 | Proof of concept | A dedicated **"Try reporting" tab** (phone + map + controls) | Pretend neighbours inside the storm timeline (harder to follow); three phones side by side (no map) |
| E3 | Default mode | Plain link stays the **demo**; live mode and Cloudflare are parked | Plain link opens live (it would show only "Walang bagong datos" without a server) |
| E4 | Residual bugs | Fix the multi-sensor **trace** bug now (the demo and the tab run the rule) | The two live-only bugs (polling stall, screen-reader map description) wait with the server work |

## 3. The rule change

In §3 of the original spec, check 3 ("Reports") changes:

3. **Reports.** If 3 or more "Yes" reports come from different phones within 1 km in the last hour, the answer is **Baka**. The reason is "N neighbours report flooding".
   - If a sensor within 500 m is dry and steady, the answer is still **Baka**, with the reason "Neighbours report flooding; sensor here is dry".
   - Reports never produce **Oo**. Only check 2 (sensors) does.

Everything else stays as it is: check 4 (1–2 reports → Baka), counting (each phone counts once, by its latest report), and the order of the checks. Check 3 now produces the same answer as check 4, but it stays as a separate step so its reason line can say how many neighbours reported.

**Multi-sensor fix.** A place may have several sensors "here", for example a barangay with sensors inside it. The rule applies three tests across all of them:
- **Wet or rising:** any sensor ≥ 5 cm now, or reaching 5 cm within 60 min → **Oo**.
- **Upstream:** water from a connected sensor arrives within 60 min → **Oo**.
- **Trace:** the deepest sensor here reads 1–4 cm → **Baka**.

No sensor is dropped because a different one was picked first.

The rule file's tests, the Worker's tests, the original spec §3 and the shareable flowchart
(https://claude.ai/artifact/6EmnCVpoKj743RrE9PSFfL, source in this folder) are updated to match.

## 4. The "Try reporting" tab

**Where.**
- A fourth tab after UC Berkeley, labelled "Try reporting". Its link is `#try`, and it is part of the tab row with the same keyboard behaviour as the others.
- It uses the Teachers Village map and one fixed place: **22 Malingap Street** (sensor BW-H03, place `tv:s:BW-H03`).
- The language menu works as on the other tabs.

**Phone (left).**
- The same answer band and report row as the live page, drawn inside a phone outline:
  - "Babaha ba? · 22 Malingap Street";
  - the word, shape and colour;
  - the reason line;
  - the report buttons Oo / Hindi / Hindi sigurado.
- Tapping a button records "your" report: "Salamat, naitala" appears with a 10-second Undo, and your diamond appears on the map.
- "Still there?" works too. After a pretend neighbour says Oo, the question becomes "Nandiyan pa ba?"

**Controls (right, under the map).**
- **+ Neighbour says Oo** and **+ Neighbour says Hindi**: each adds a new pretend phone at a fixed spot within about 300 m of the place.
  - The spots come from a fixed list, so the tab looks the same each time.
  - At most 8 pretend neighbours.
- **Sensor at Malingap:** dry / 3 cm / 20 cm. The sensor's rate is 0. No rain is simulated; the rain line reads 0 mm/h.
- **Reset:** clears your report, the neighbours and the sensor (back to dry).

**Explanation line.** One sentence under the map says what the rule saw and decided. Example:
"3 phones say Oo within 1 km · sensor dry · no rain → Baka (reports alone can't say Oo)."
This sentence is in all six languages.

**Map.**
- The Teachers Village basemap, the Malingap sensor marker, and each report as a hollow diamond.
- There is no simulated flood layer.
- The same reports also appear as a short text list, the "Reports on this map" log, for screen readers.

**Label.** "Simulation — nothing leaves this page" is shown at the top of the tab.
Nothing in the tab calls the network.

**Layout.**
- Desktop: the phone on the left, the map with its controls on the right.
- Phone screen: the phone view first, then the controls, then the map.
- Buttons are at least 48 px.
- Contrast is at least 4.5:1 in both themes.
- Answer changes are announced once, through the existing announcer.

**State.**
- State is kept in memory only: your report, the neighbours and the sensor. A reload starts fresh.
- The tab does not touch the place you chose on the other tabs.

## 5. The rest of the page

- **Demo tabs:** report buttons keep saying "Demo — not sent". A link is added: "Try it in the Try reporting tab" (six languages).
- **Live mode, the Worker, share links, QR codes and Add to Home Screen:** unchanged, and parked until real reports are wanted.
- **After review:** the branch is merged into `main`. The demo page is rebuilt without server values, and Gregor pushes to GitHub Pages. The private demo artifact is updated at the same time, so the tab can be tried before the push.

## 6. Testing

- **Rule:** new table tests.
  - 3, 5 and 8 "Yes" phones with no sensor → Baka `reports`.
  - With a dry sensor → Baka `reports_vs_dry_sensor`.
  - A wet sensor plus reports → Oo `sensor_now`.
  - Multi-sensor: a slowly rising sensor at 0 cm plus a flat sensor at 4 cm → Baka `sensor_trace`.
- **Worker:** tests that expected Oo from reports now expect Baka.
- **Page (Playwright, new `test_try.js`):**
  - The `#try` tab opens, and it is keyboard reachable.
  - Your Oo alone → Baka (1 report).
  - Plus 2 neighbours → Baka "3 neighbours".
  - Sensor 3 cm → still Baka.
  - Sensor 20 cm → Oo.
  - Reset → Hindi.
  - The explanation line matches each step.
  - Undo removes your diamond.
  - "Still there?" appears after a neighbour's Oo.
  - Zero network requests.
  - Six languages are complete.
  - Contrast holds in both themes.
  - Phone-width layout order.
- **Existing suites:** all stay green.

## 7. Out of scope

- The Cloudflare deploy, live-mode default, and the two live-only bugs.
- The nationwide PhilDev prototype (its own spec).
- Rain in the tab.
- Saving the tab's state across reloads.
