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
