# PhilDev UI round 2 — build report

Date: 2026-09-27 · Branch `phildev-ui-round2` (from `main` at `9bf8529`)
Spec `docs/superpowers/specs/2026-09-27-phildev-ui-round2-design.md` · Plan `docs/superpowers/plans/2026-09-27-phildev-ui-round2.md`

## 1. What changed, against your list

Each row is one item from your list (spec §2). "What you'll see" describes the fix; the commit(s) are on the branch.

**1. Stray "‹ All campuses · UPLB" bar and yellow strip mid-page.** The page had two copies of that bar; hiding the
Details-view header didn't hide the second copy, so it showed inside the simple view. Fixed: the simple view never
shows that bar, and vice versa. `5d83d89`

**2, 4.6. Translation not working on the PhilDev tab.** The five non-English languages were English text in
disguise. All of it — national map, campus bar, campus card — is now written in Filipino, Cebuano, Ilokano,
Hiligaynon and Kapampangan (Claude-drafted, marked for native review). `2c4e2b5`

**3. Chrome's translation fighting ours.** The page now tells Chrome its actual language on every screen and every
route change, and tells it not to auto-translate once you've picked a non-English language from our own menu.
Chrome's banner stops appearing. `2c4e2b5`, `c492b68`

**4.1. Campus list too long; pages too narrow.** The PhilDev tab is now a full-window map with a list beside it,
using the whole screen instead of a narrow center column. Every page can now stretch to 1600 px wide, so wide
monitors aren't wasted. `99dc4c3`, `809db5d`, `86e51aa`, `f767b85`

**4.2. Drop "Pilot sites" and "Try reporting" from the list.** Both are gone from the campus list — they're
already reachable from the tab row above. `99dc4c3`

**4.3. Weird "‹ All campuses" at bottom-left.** Same bug and fix as item 1. `5d83d89`

**4.4. Smooth zoom on the Philippines map.** The map is a real, tile-based map now (see item 4.5), so wheel,
pinch, drag and the on-screen +/−/⌂ buttons all animate smoothly, with a fallback to today's outline map if the
tile map can't load. `99dc4c3`, `96f0a83`

**4.5. Roads and buildings on the national map when zoomed in.** The national map now loads real street and
building data from OpenFreeMap/OpenStreetMap as you zoom in, replacing the plain outline once it's ready.
`96f0a83`, `99dc4c3`

**5.1. Real phone outline on Try tab.** The Try screen now sits inside a drawn phone frame (rounded corners,
camera pill, side buttons) at desktop widths; below 560 px the frame disappears since the page is already a phone.
`70ed71d`

**5.2. Stretched, pixelated Try map.** The map was measuring its box before the Try layout had settled, so it drew
undersized and got stretched by CSS. It now re-measures itself whenever its box changes, so it's always crisp.
`5d83d89`

**6. Zoom a campus/pilot map out to the whole Philippines.** Every campus, Teachers Village and the UC Berkeley
pilot can now be zoomed out past their own boundary into a whole-country (or whole-region, for Berkeley) view,
with a "Back to the flood map" button to return. `e11a0dd`, `0afe5bf`, `05784ac`, `c16906e`, `f072da3`

**7. Colour the sea.** The sea now has its own colour everywhere water is sea — the vector map, the outline map,
and the campus flood maps — with a "Sea" legend entry added to campus maps too. `809db5d`, `99dc4c3`

## 2. Screenshots

Retaken against the offline test basemap (light style; the offline fixture doesn't carry a separate dark
palette — see §6). All at 1280 px unless noted.

![PhilDev tab, national map](/mnt/user-data/outputs/round2_final_ph_1280.png)

The PhilDev tab: full-window map and list, 25 campuses grouped by island group, legend with the Sea entry, no
"Pilot sites" or "Try reporting" rows.

![PhilDev tab, XU chosen](/mnt/user-data/outputs/round2_final_ph-selected_1280.png)

Choosing Xavier University in the list flies the map to it, draws its 3 km box, and offers "Open XU".

![UPLB campus page](/mnt/user-data/outputs/round2_final_uplb_1280.png)

UPLB's campus page: no stray bar, the partnership card and unit list beside the flood map.

![Teachers Village, whole-country view](/mnt/user-data/outputs/round2_final_tv-country_1280.png)

Teachers Village zoomed out to the whole country: its box is outlined and labelled "Simulated area", with UP
Diliman's pin visible nearby.

![Try reporting, 1280 px](/mnt/user-data/outputs/round2_final_try_1280.png)

Try reporting inside the drawn phone frame, with the neighbourhood map opened on 22 Malingap Street.

![PhilDev tab, 390 px](/mnt/user-data/outputs/round2_final_ph_390.png)

The PhilDev tab at phone width: map on top, list below, no sideways scroll.

![Try reporting, 390 px](/mnt/user-data/outputs/round2_final_try_390.png)

Try reporting at phone width: the phone frame is hidden (the screen is already a phone), content unchanged.

## 3. Test results

All suites green. `./test_pages.sh` (17 browser suites, run against the offline test map so tiles never leave the
machine):

| Suite | Checks |
|---|---|
| `test_a11y.js` | 72 ok |
| `test_answer.js` | 42 ok |
| `test_campus.js` | 29 ok |
| `test_car.js` | 22 ok |
| `test_figure.js` | 16 ok |
| `test_init.js` | 16 ok |
| `test_national.js` | 92 ok |
| `test_noaccount.js` | 27 ok |
| `test_obstacles.js` | 10 ok |
| `test_public.js` | 15 ok |
| `test_recent.js` | 25 ok |
| `test_report.js` | 70 ok |
| `test_routes.js` | 16 ok |
| `test_sites.js` | 56 ok |
| `test_tabs.js` | 31 ok |
| `test_try.js` | 52 ok |
| `test_zoomout.js` | 57 ok |

Plus: `node --test shared/*.test.js sw.test.js` — 43/43. Worker (`node --test test/*.test.js`) — 46/46.
`./test_build.sh` — ok (pipeline and 27-site checks all pass). `python3 -m unittest tools.test_basemap_style` — OK.
`python3 tools/test_places.py` — OK. Opening page: 101,683 bytes gzipped, under the 250 KB budget.

## 4. Rulings

Decisions made while planning and building that departed from the spec's exact wording, or that a reviewer flagged
and I had to settle. Each one names what it costs if it turns out to be the wrong call.

**From the plan (settled before building started):**

1. MapLibre (the map library) is bundled directly into the repo instead of loaded from a public content-delivery
   network with a checksum. The newer version of the library ships as three linked files, and a checksum on just
   the main one wouldn't cover the other two; files served from our own site need no checksum anyway, and they
   also work offline once cached. Cost if wrong: about 300 KB more to download the first time a detailed map
   opens, and 1.1 MB more in the repository.
2. The sea's light-mode colour was changed slightly from the spec's suggested value, because that value didn't
   pass its own contrast rule against one of the three flood-depth colours. The replacement passes and still
   reads clearly different from the paper background. Cost if wrong: the sea colour would need another pass to
   keep it distinguishable from the flood colours.
3. The phone outline on the Try tab is drawn with plain CSS (borders and shapes) instead of an SVG image, because
   an SVG stretched over a box whose height can change can't keep a fixed corner radius. Cost if wrong: none — the
   look is the same either way.
4. Campus pins on the map stay as the app's own on-screen buttons rather than the map library's built-in markers,
   so one piece of code serves both the detailed map and the plain-outline fallback. Cost if wrong: none.
5. Below 900 px wide, tapping a campus in the list opens its page directly, since the map sits off-screen above
   the list and flying it there wouldn't be visible; at 900 px and wider, tapping flies the map to it and offers
   "Open". Cost if wrong: none — matches how each layout already behaves.
6. The coloured boxes and "Simulated area" label are ordinary page overlays, not drawn on the map itself, so they
   need no special map fonts and survive switching between light and dark map styles. Cost if wrong: none.
7. Offline, a Philippine campus's whole-country view still shows the outline of the Philippines with its box;
   Berkeley's whole-country view offline shows only a note, because the repo carries no outline for the United
   States. Cost if wrong: Berkeley's offline zoomed-out view stays a blank note until a US outline is added.
8. The dark-mode map style is generated automatically from the light one by a script, and both are checked into
   the repo. Cost if wrong: the dark style would need a manual edit if the light one's colours change later.

**Made or confirmed during the build, in order:**

9. A deep link straight into a campus's Details view (e.g. `#xu/details`) skipped the step that tells the page,
   and Chrome, what language is showing — so it silently stayed in English even when your browser's language was
   Filipino. Fixed by running that step wherever the language gets set. Cost if wrong: one extra, harmless call.
10. The simple-view map was capped at 540 px wide, but the spec says the two columns should share the extra room
    at a 5:6 ratio on wide screens. Removed the cap and fixed the actual cause (keeping the selected street in
    view). Cost if wrong: a change to how the simple view frames its map.
11. Three font sizes (11, 11.5, 12.5 px) were all rounding down to 12 px for buttons, chips, the legend and place
    text. The spec says 12 px is only for credits, timestamps and helper lines, and everything else should round
    to 12 or 14 by its role — so those move up to 14 px. Cost if wrong: slightly larger buttons and labels.
12. The detailed map's 8-second loading limit was failing even when a tile had already arrived, because it only
    resolved once the map was fully idle. Fixed so it counts as loaded at 8 seconds if any tile arrived, and only
    falls back to the outline if none did. Cost if wrong: on a slow connection, a partly loaded map shows instead
    of the plain outline.
13. Two implementation choices were accepted as-is after review: the theme-switch hook only runs when you click
    the button (avoids an ordering bug on first load), and the clustering logic that merges pin groups drifting
    close together. Cost if wrong: the country view's clusters could be a little coarser — roughly 4 groups
    instead of more.
14. The "Open <campus>" button was overlapping the map's attribution line at narrow widths (920 px and 390 px).
    Fixed, since attribution needs to stay visible. Cost if wrong: none.
15. Hovering or focusing a campus in the list only highlighted a single pin, not the whole cluster containing it
    when campuses were grouped together. Fixed so the whole cluster gets the highlight ring. Cost if wrong: none.
16. Pin labels on the map were set to 12 px, but that size is reserved for credits and helper text only. Raised to
    14 px. Cost if wrong: slightly more crowding on the country view.
17. The plan's whole-country view showed OpenStreetMap/OpenFreeMap map tiles with no attribution line at all.
    Since attribution is required wherever those tiles show, the credit line was added there too, positioned so
    "Back to the flood map" never covers it. Cost if wrong: one small line of text on the map.
18. The whole-country view had no screen-reader text at all. Added a labelled region describing the site's
    simulated area, its region, and how many campuses are on screen (with a separate description for Berkeley).
    Cost if wrong: none.
19. A note in the build log claiming City of Malabon University (CMU) was landlocked was itself wrong — CMU sits
    on Manila Bay's shore, and University of Makati (UdM) is about a kilometre from the bay, so the sea drawn in
    those boxes is plausible. Not treated as a defect. Cost if wrong: a mislabelled body of water, visible on the
    live map.
20. Scrolling the mouse wheel down while it's over a campus's flood map, at minimum zoom, hands over to the
    whole-country view — even if you were just trying to scroll the page past the map. The spec requires this
    behaviour and the map already intercepted the wheel before this round, so it stands. Cost if wrong: an
    unexpected takeover for someone scrolling past a campus map.
21. Three small controls on campus pages (the theme button, a dropdown, and a text link) are below the 48 px
    minimum tap-target size. This predates this round and isn't on your list, so it was left alone and is
    reported here rather than fixed. Cost if wrong: those controls stay small and harder to tap until a later
    round.
22. A few things were confirmed as out of scope for this round rather than fixed: the Details view's legend and
    chrome staying English-only, overall translation quality, the service worker not pre-loading the map library
    ahead of time, and whether GitHub Pages will serve `.mjs` files with the right type. The last two need
    checking on the live site (see §6). Cost if wrong: if GitHub Pages serves `.mjs` incorrectly, the PhilDev tab
    stays stuck on the plain outline map instead of switching to the detailed one.
23. The handoff notes must say that OpenFreeMap (the tile provider) sees each visitor's IP address and the map
    area they're viewing, so BahaWatch's counsel can review that disclosure.
24. A fix meant to make only the campus list scroll — keeping the search box fixed in place — broke short, wide
    screens (a phone held sideways): the list shrank to a sliver 6–23 px tall and became unusable. Rather than
    layer on a second fix under time pressure, it was reverted to the original behaviour, where the whole left
    column scrolls together (search box included). The full suite passed green after the revert. Cost if wrong:
    the spec's "only the list scrolls" requirement stays unmet until a follow-up adds a height-based condition and
    a short-viewport test.

## 5. Deferred minors

Small issues found and knowingly left for later, grouped by what they affect.

**Visible to users**

- The on-campus unit still uses a " — " dash to join its label, instead of the plain style used elsewhere.
- The service worker only caches the map library and style after your first visit to a detailed map, not ahead
  of time — offline only works fully starting on your second visit.
- Merged pin clusters can read their names out of order to a screen reader.
- When the detailed map takes over from the outline, there's a brief flash of empty sea before it fades in.
- After rotating a phone and back, the outline map's view can drift outward over repeated rotations.
- The national map's zoom buttons and quick-language buttons are bold (700 weight); the spec calls for 600 there.
- If a theme switch fails partway on an open detailed map, there's no fallback to the outline map.
- At high zoom, pin labels can run under the zoom buttons or the legend; nothing currently checks for that
  overlap.
- Pin rendering on the whole-country view is duplicated from the national map's own code, and pins right at the
  edge of the view can be clipped.
- If the detailed map fails once, it stays off (falls back to the outline) for the rest of that browsing session,
  with no automatic retry.
- The phone frame on the Try tab has a minimum height but no maximum, so on a very tall window it can grow past
  the spec's suggested 760 px.
- A status column on campus pages narrows awkwardly in a band just above 1100 px wide.
- "Whole country" is a button label that names a place, not an action — it doesn't follow the usual verb-first
  wording used elsewhere.
- The new zoom/home tooltips repeat the same text as the button's screen-reader label, so it gets announced twice.
- The Details view's right-rail unit list can silently clip a unit's id or name with no ellipsis — this predates
  this round and deserves its own fix.
- Scrolling the mouse wheel directly over a pin or cluster on the detailed map doesn't zoom it (only scrolling
  over open water does).
- The national map's closest zoom-out level is slightly looser than the spec's number, which is needed so the
  whole country still fits on a phone screen.
- The map's building layer is drawn above its road layer in the style file — worth checking on the live site at
  close zoom.
- While the whole-country view is loading, the dimmed flood map underneath temporarily loses its own attribution
  line, and its text contrast dips below the accessibility minimum for a few seconds.
- The whole-country view's screen-reader description mentions the box and pins before they've actually been
  drawn, during loading.

**Code quality**

- A single global style rule now bolds every `<b>`/`<strong>`, replacing a narrower one-off rule.
- Two places both re-check whether a campus has a sea legend entry, redundantly.
- The map loader leaves some event listeners attached after it's done with them, which could swallow a later
  error.
- Converting a map-loading error to our own error type loses the original error's details.
- The map library's stylesheet isn't waited on before deciding the library loaded successfully.
- A resize listener and a more precise resize-observer both react to the same size change, doing double work.
- The whole-country "Back to the flood map" button's label gets set twice.
- The whole-country view's live status text gets rewritten every time the map redraws, even when nothing changed.
- The "Whole country" button's vertical position is calculated from the zoom control's height, which could break
  if that control's size changes.
- The whole-country view's name and description use a plain `hidden` attribute instead of the project's usual
  screen-reader-only convention.
- Programmatically switching the theme (not by clicking the button) won't restyle an already-open detailed map.
- Setting the map's internal language directly isn't guarded against a future map-library update removing that
  internal field.
- The README's note about testing against real map tiles describes one style working for both light and dark
  themes, when it only covers one.

**Tests**

- The project's emoji-detection test only checks for one specific character rather than the full range of emoji.
- Some theme-related tests check an internal state flag rather than confirming the map actually restyled.
- The zoom-out handover threshold isn't tested at the exact trigger point (one button press, one pinch gesture).
- Nothing currently tests the layout in the narrow band just above 1100 px wide, or at 375 px for one positioning
  rule.

**Translations**

- The details-view legend's "Sea" label is only translated on the main list page; a direct link into a non-English
  Details view still shows it in English.
- The Filipino text isn't flagged for review in the menu the way the other four languages are (an internal
  bookkeeping gap, not a translation problem).
- Ilokano and Kapampangan have specific wording worth a native speaker's second look (see §6).

## 6. Honest limits

- **Live-tile behaviour.** The dark map style and real OpenFreeMap tiles were never seen rendered in this
  environment — the network here can't reach the tile service, so testing used the light-only offline style.
  Please check the live site once it's pushed: dark mode's map colours, and whether buildings sit correctly under
  roads at street-level zoom.
- **`.mjs` file serving.** The map library ships as `.mjs` files, and GitHub Pages needs to serve those as
  JavaScript for the detailed map to load at all. Please check the PhilDev tab on the live site after the push —
  if Pages serves `.mjs` with the wrong type, the tab will silently stay on the plain outline map.
- **Translation quality.** The Filipino, Cebuano, Ilokano, Hiligaynon and Kapampangan text was drafted by Claude
  and is marked for native review; quality will vary most in Ilokano, Hiligaynon and Kapampangan. Two specific
  spots are worth a native speaker's attention: the Kapampangan word for "finger" ("taludtud") looks like it may
  be wrong, and the Ilokano word "putput-ol" looks like it may be a typo.
- **Privacy.** Every visitor's browser contacts `tiles.openfreemap.org` directly to load the detailed map, and
  that service sees the visitor's IP address and the map area they're looking at. Nothing new is stored by
  BahaWatch itself, but this should be included in the disclosure PhilDev's counsel reviews.
- **Service dependency.** The detailed map depends on OpenFreeMap, a free, donation-funded service with no stated
  uptime guarantee. If it goes down, every page falls back to the plain outline map automatically.
- **OSM coverage.** Buildings on the detailed map come only from OpenStreetMap, which has sparser building data
  than the satellite-derived footprints used in the flood maps. So the country map and a campus's flood map can
  disagree at street level.
- **The "only the list scrolls" layout was reverted.** It broke short, wide screens (a phone held sideways), so
  the PhilDev tab's left column now scrolls as one piece — search box included — the way it did before this
  round. Re-applying the intended layout, with a fix for short screens, is a follow-up (ruling 24 in §4).
