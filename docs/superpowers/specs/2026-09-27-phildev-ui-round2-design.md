# PhilDev UI round 2: fixes, map-first national tab, vector basemap, phone mock-up

Date: 2026-09-27 · Status: approved in conversation (sections 1–5), awaiting written-spec review
Branch: `phildev-ui-round2` (from `main` at 9bf8529) · Profile: `.ux-profile.md` (Custom look, WCAG 2.1 AA with
48 px targets, plain voice, project SVG icons)

## 1. Why

Gregor tested the merged PhilDev prototype and listed what is broken or weak (his numbering is kept in §2). The
aim of this round is a page that:
- has no visible bugs;
- speaks all six languages on every tab;
- uses a wide screen fully;
- shows the whole Philippines with enough detail to find your way;
- makes the Try tab look like a real phone.

The model, the data files and the flood logic do not change.

**Success looks like this:**
- On a 1920 px monitor, the PhilDev tab is a full-window map with a side list, with no empty margins.
- Zooming into the Philippines is smooth, and roads and buildings appear as you go.
- A campus or pilot map can be zoomed out to the whole country and back.
- Picking Filipino (or any of the five) translates everything we wrote.
- Chrome's own translation no longer fights our menu.
- The Try tab shows a phone.
- Every existing test still passes.

## 2. Gregor's list and where each item is handled

| # | Item | Where |
|---|---|---|
| 1 | Stray "‹ All campuses · UPLB" bar and yellow strip mid-page | §3.1 |
| 2, 4.6 | Translation not working on the PhilDev tab | §3.3 |
| 3 | Chrome's translation conflicting with ours | §3.4 |
| 4.1 | Campus list too long; use horizontal space; pages too narrow in general | §4.1, §6.2 |
| 4.2 | Drop "Pilot sites" and "Try reporting" from the list | §4.1 |
| 4.3 | Weird "‹ All campuses" at bottom-left | §3.1 |
| 4.4 | Smooth zoom on the Philippines map | §4.2 |
| 4.5 | Roads and buildings on the national map when zoomed in | §4.2 |
| 5.1 | Real phone outline on the Try tab | §5 |
| 5.2 | Stretched, pixelated Try map | §3.2 |
| 6 | Zoom a campus / pilot map out to the whole Philippines | §6.1 |
| 7 | Colour the sea | §4.2, §7 |

## 3. Bug fixes and translation (section 1, approved)

### 3.1 The stray campus bar

Cause: `template.html` has two campus bars (`[data-cbar]`): one inside `#public`, and one after the Details header
and tabs. CSS hides the Details header, tabs, `main` and timeline in the simple view, but not that second bar.
`syncCampusUI()` un-hides both on a campus page, so in the simple view the Details copy renders between the card and
the headline (Gregor's screenshot, y ≈ 830).

Fix: `[data-view="public"] header ~ [data-cbar]{display:none}`. Also, the reverse: the simple view's bar never shows in
the Details view.

Test (`test_campus.js`): on `#uplb`, `#uplb/details`, `#tv`, `#try` and `#ph`, every visible `[data-cbar]` sits
inside the current view's container. At most one bar is visible.

### 3.2 The stretched Try map

Cause, reproduced at `deviceScaleFactor` 1.5 going `#tv` → Try: `resize()` measured the map box before the Try
layout settled. The result was `view.w` 378 against a box 666 px wide, so the canvas was stretched by CSS.

Fix: a `ResizeObserver` on `#map-wrap` calls `resize()` (throttled to one call per animation frame) whenever its
content box changes. The existing explicit calls stay.

Test (`test_try.js`): contexts at `deviceScaleFactor` 1, 1.25 and 1.5. Go to Try from `#uplb` and from `#tv`.
After 500 ms, the canvas backing size must equal `round(box × dpr)` in both axes (±1 px).

### 3.3 Translation on the national map, campus bar and card

Cause: `NAT_LANGS.fil|ceb|ilo|hil|pam` are `Object.assign({_review:true}, NAT_EN)`, i.e. English copies.

Fix: write the Filipino, Cebuano, Ilokano, Hiligaynon and Kapampangan text for every `NAT_EN` key, including the
strings added in this round. Each stays `_review:true` (drafted by Claude, pending native review). Proper names and
pure numbers stay as they are.

Test (`test_a11y.js` six-language check, extended): for each non-English language, every string key differs from
English. The exceptions are listed in one constant (`NAT_SAME_OK`: e.g. campus short names, `OpenStreetMap`).
Picking Filipino on `#ph`, then opening `#xu`, shows Filipino in the list heading, search label, bar and card.

### 3.4 Chrome's translation

The page's `<html lang>` always matches the language shown. This includes the national map and every route change.

When the language comes from our menu and is not English, `<html translate="no">` is set, so Chrome stops offering or
applying its translation. In English the attribute is removed, so visitors whose language we don't offer can still
use Chrome.

Test: `translate` is absent in English and `"no"` after choosing `fil`, on `#ph` and on a campus page. `lang` matches
`LANG` after every language change and route change.

## 4. The national map (section 2, approved)

### 4.1 Layout

Page pattern: **split pane** (list + map).

**At ≥ 900 px wide.** `#nat` fills the window below the header and tabs (`height: calc(100dvh − header)`), and the
page itself does not scroll.
- **Left panel** (360 px): the intro sentence, the search box with its visible label, the count line, and the grouped
  list. Only the list scrolls, as one region.
- **Right:** the map fills the rest, with the zoom buttons at top right, and the legend and credits at bottom left.

**Below 900 px.** Normal page flow: header, map at 60 vh, then intro, search and list.

**List rows.** Each row is two lines:
- line 1: pin shape + **short name** + full name;
- line 2: city, province.

No " · " joins. The type (state / local / private) is carried by the pin shape and colour, explained in the legend,
and spoken in the row's accessible name. Rows are ≥ 48 px tall, with body text at 16 px and the second line at 14 px.

The "Pilot sites" group and the "Try reporting" link are removed (they are tabs).

Hovering or focusing a row highlights its pin (ring). Clicking or pressing Enter flies the map to the campus.

### 4.2 The map: MapLibre + OpenFreeMap

**Library.** MapLibre GL JS 6.11.2 (BSD-3-Clause), loaded after first paint from
`https://cdn.jsdelivr.net/npm/maplibre-gl@6.11.2/dist/maplibre-gl.js` (+ `.css`), with Subresource Integrity hashes.

**Style.** Our own style JSON, `shared/basemap-style.json`, committed and served next to the page (OpenFreeMap requires
custom styles to be self-hosted). It is based on the OpenMapTiles schema used by OpenFreeMap's Positron style:
- source `openmaptiles`: `{type:"vector", url:"https://tiles.openfreemap.org/planet"}`;
- glyphs: `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`;
- no sprite and no raster hillshade;
- layers: `water`, `waterway`, `landuse` (residential tint only), `park`, `boundary` (admin level 4, faint), `transportation`
  (by class, white with sand casing), `building` (from z14), `place` and `transportation_name` labels.

A build step writes a dark-theme variant from the same file.

**Colours**, from the profile:

| Feature | Light | Dark |
|---|---|---|
| Land | paper `#f8f4ec` | `#1f1e1c` |
| Sea and lakes | `#d3dfe6` | `#1f2c35` |
| Rivers | creek blue `#70c0e0` | `#70c0e0` |
| Roads | white, casing `#e3dccd` | per dark theme |
| Buildings | `#e9e1d2` | per dark theme |
| Labels | ink `#232120` with paper halo; ≥ 3:1 against land at every zoom | per dark theme |

The sea colour must stay distinguishable from the three flood-depth blues (`#8fc6e2`, `#2f86c2`, `#0030a0`):
ΔE2000 ≥ 15 from each, checked in a test.

**Zoom.** Smooth: wheel, pinch, double-click, drag, and keyboard (MapLibre's own: arrows, +/−). Our +/− and ⌂ buttons
(48 px) animate `easeTo`. The view opens fitted to the country. The range is z4.5–z17.

**Pins and clusters** stay our own HTML buttons: `maplibregl.Marker` with our shape and colour SVG and
`aria-label="<short>: <name>, <city>, <province>. <type>."`.
- Clustering is recomputed on `zoomend` from screen distance (pins closer than 36 px merge). The cluster button shows
  the count, and clicking it zooms to fit its members.
- Clicking a pin flies to the campus (`flyTo`, 1.2 s; instant under reduced motion) and draws its 3 km box (dashed ink).
  A button, "Open <short>", then goes to `#<id>`.

**Legend** (bottom left): ● State ■ Local ▲ Private, and a sea swatch "Sea".

**Credits:** "© OpenStreetMap contributors · OpenFreeMap © OpenMapTiles · MapLibre".

### 4.3 Fallback, when there is no library, no WebGL or no tiles

The outline SVG map (today's) renders first, always. MapLibre replaces it only after the style has loaded and the
first tiles have rendered (`idle`).

The outline stays if any of these happen:
- the script fails;
- the SRI check fails;
- WebGL is unavailable;
- the style fails;
- no tile has arrived after 8 s.

In that case a note under the map says "Detailed map needs an internet connection." The outline keeps smooth
zoom (CSS transform on the SVG `viewBox`, animated), clusters, pins, the list and search.

The sea colour applies to the outline map's background too (the ocean around the islands), in both themes.

## 5. Try reporting: a phone (section 4, approved)

- The phone column is an original inline SVG outline, not a copy of the reference image (a stock iPhone render). It
  has a 12 px black frame, 48 px corner radius, a camera pill at the top centre, and two short side buttons.
- The screen area is 390 px wide × up to 760 px high. It holds the answer band and the report buttons exactly as a
  resident's phone shows them, with no page chrome. "Simulation — nothing leaves this page" stays above, outside.
- Below 560 px the outline is hidden (the page is already a phone) and the content shows as today.
- The Try map opens fitted to about 700 m around 22 Malingap Street, so the pretend neighbours' diamonds are in view.
  The map gets the §3.2 fix.
- The controls stay under the map, unchanged.

Test (`test_try.js`):
- at 1280 px the outline SVG is present and the screen area is 390 ± 2 px wide;
- at 390 px the outline is hidden and there is no sideways scroll;
- the answer word and report buttons are inside the screen area.

## 6. Zooming out to the country, and wider pages (section 3, approved)

### 6.1 Handover from a site map

This applies on campus pages, Teachers Village and UC Berkeley.

**Handing over.**
- When the flood map is at minimum zoom and the person zooms out further (wheel down, pinch in, "−" at 1×, or a new
  48 px button "Whole country"), the view hands over.
- The flood canvas fades out (200 ms; instant under reduced motion) and a MapLibre map appears in the same box. It
  is centred on the site's bbox at the zoom that fits it, then eases out 1.5 zoom levels.
- The site box is outlined and labelled "Simulated area". The 25 campus pins show.
- The person can keep zooming out to the whole Philippines. For Berkeley it's the Bay Area and beyond, with no
  PhilDev pins.

**Coming back.**
- A 48 px button "Back to the flood map" is always visible in this mode.
- Zooming in until the box covers ≥ 90 % of the view's shorter side also returns. The threshold is higher than the
  one used to hand over, so the view can't flicker back and forth.
- The flood map returns at 1× centred on the site.

**Offline.** If MapLibre isn't available, the handover shows the outline map with the box drawn instead.

**Unchanged.** Timeline, scenario, readings and selection are not touched by the handover. The flood simulation keeps
running underneath.

Test (`test_zoomout.js`, new):
- zoom out on `#tv` → MapLibre is shown and `siteZoomedOut` is true;
- the box is on screen;
- "Back to the flood map" returns;
- zooming in to 90 % returns;
- a zoom out then a small zoom in does not flip back (the slack);
- the same on `#upd` and `#berkeley`;
- with the library blocked, the outline fallback shows.

### 6.2 Wider pages

- `.p-inner` becomes fluid up to `max-width: 1600px`, with 24 px side padding.
- The simple view's two columns (list | map) share the extra width at 5 : 6.
- Paragraph text (intro, footnotes, card notes) keeps `max-width: 72ch`.
- The Details view already fills the window and is unchanged.
- The national tab follows §4.1.

## 7. Visual pass (frontend-design plan, approved)

- **Look:** unchanged per the profile (Custom: subway signage on warm paper). The one bold element is the map; the
  chrome stays quiet.
- **Weights:** three only, 400 text / 600 labels and buttons / 700 headlines. Today's 500 becomes 600.
- **Sizes:** HTML text on the scale 12 / 14 / 16 / 20 / 25 / 31 px, plus the answer word at 39 px.
  - 12 px is for credits, timestamps and helper lines only.
  - Nothing renders below 12 px: today's 10.5, 11 and 11.5 px rise to 12, and 12.5/13 px round to 12 or 14 by role.
  - List rows, street rows and card lists are 16 / 14 px.
  - Line-height: 1.2 for headings, 1.5 for body.
- **Capitals:** the four all-caps tracked labels ("Monitored streets", "Household units…", "Modeled impact…", the card's
  barangay summary) become sentence-case 14 px bold.
- **Middle dots:** " · " joins are removed from list rows and card unit lines. Units become "BW-UPLB-01, near Andres P.
  Aglibut Ave, Batong Malake — on campus" as a two-line row. Headers and credits may keep them.
- **Theme button:** the national map's ☾ button gets full ink contrast (today ~2:1) and a 48 px target.
- **Sea colour:** used everywhere water is sea (vector map, outline map, and the campus canvas map's `P.sea`), with a
  "Sea" legend entry on campus maps too. This resolves the deferred minor.

## 8. Speed, caching, credits, privacy

- **Opening page:** stays ≤ 250 KB gzipped. MapLibre (~250 KB gzipped) and the style load after first paint, and
  only on the national tab or at the first handover.
- **Fast 3G check:** a campus page appears within 3 s (unchanged).
- **Service worker:** caches the pinned MapLibre files and `shared/basemap-style.json` (same-origin or CORS, fixed
  versions). It never caches tiles or fonts from `tiles.openfreemap.org`, and never answers them with the page.
- **`DATA-LICENSE.md`:** adds OpenFreeMap / OpenMapTiles (attribution as required: "OpenFreeMap © OpenMapTiles Data
  from OpenStreetMap"), OpenStreetMap ODbL, and MapLibre GL JS BSD-3-Clause. The README gets a "Basemap" section.
- **Privacy:** each visitor's browser requests tiles from OpenFreeMap, which sees their IP address and the map area.
  This is added to the privacy notes for the PhilDev counsel check. Nothing new is stored by BahaWatch.

## 9. Testing

**Offline test setup.**
- The test server serves `node_modules/maplibre-gl/dist/*` (npm, pinned 6.11.2). Tests route the jsDelivr URLs there
  with Playwright's `page.route`.
- A small offline style, `tests/fixtures/basemap-offline.json`, has GeoJSON sources only: the country outline, one
  sea polygon and a few roads.
- A test flag (`window.BW_BASEMAP_STYLE`) points the page at the offline style.
- Headless Chromium renders WebGL through SwiftShader. Where it can't, the fallback test covers the path.

**New and extended tests:**
- `test_campus.js`: §3.1 bar visibility; language carry.
- `test_try.js`: §3.2 display scale; §5 phone.
- `test_a11y.js`, extended:
  - §3.3 completeness; §3.4 `lang` and `translate`;
  - 375 / 390 / 1280 / 1920 px layouts with no sideways scroll;
  - national tab: one scroll region at ≥ 900 px;
  - no text below 12 px (computed);
  - ≤ 3 font weights;
  - sea ΔE vs flood blues;
  - contrast of labels and the theme button.
- `test_national.js`, extended:
  - MapLibre replaces the outline after `idle`;
  - pins are buttons with labels;
  - clusters split on zoom;
  - fly-to and box;
  - "Open <short>";
  - fallback when the script is blocked, when WebGL is disabled, and when tiles time out;
  - no "Pilot sites" or "Try reporting" in the list.
- `test_zoomout.js` (new): §6.1.
- `sw.test.js`: MapLibre cached; tiles never cached and never answered with the page.
- Every existing suite passes.

Before finishing: `ux-audit` with screenshots at 375, 1280 and 1920 px of `#ph`, `#uplb`, `#tv`, `#try`, then a
whole-branch review by a fresh reviewer.

## 10. Out of scope

- Translating map labels (towns, roads keep their local OSM names).
- Caching tiles offline.
- Self-hosting tiles.
- Changing the flood model, data files or Worker.
- Native-speaker review (still standing).
- The Details view's own layout.

## 11. Honest limits

- **Service dependency.** The detailed map depends on a free, donation-funded service (OpenFreeMap) with no stated
  limits or service guarantee. If it stops, the page falls back to the outline map. Self-hosting (§10) is the remedy.
- **Translation quality.** The five language translations are drafted by Claude and marked for native review; quality
  will vary most in Ilokano, Hiligaynon and Kapampangan.
- **OSM coverage.** Buildings in the vector map come from OSM only, and are sparser than the VIDA footprints used in the
  flood maps (Google + Microsoft + OSM). So the country map and the flood map can differ at street level.
