// The vector basemap (spec §4.2, §4.3): the vendored MapLibre GL JS opens our own vector tiles (PMTiles archives in
// shared/tiles/, built by tools/build_basemap.py — no outside tile server) in our own style, with a
// hard limit — no WebGL, a failed library or style, or no tile within 8 s, and the caller keeps its outline map.
// Pure helpers (clustering, box maths, coverage, view fitting) are tested in basemap.test.js; build_html.py inlines
// this file into the page with its `export`s removed.
export const BW_LIB = "lib/maplibre-gl-6.11.2/";
export const BW_PMTILES = "lib/pmtiles-4.5.0/pmtiles.mjs";
export const BW_TIMEOUT_MS = 8000;
export const BW_M_PER_DEG_LAT = 110640;                      // pipeline/common.py's constants
export const BW_BOX_HALF_M = 1500;

// Screen points closer than r px become one cluster, in list order; its position is the members' mean. Moving to the
// mean can bring two clusters' centres within r of each other (one would cover the other), so those merge until none do.
export function bwCluster(pts, r) {
  const gs = [];
  for (const p of pts) {
    const g = gs.find((g) => Math.hypot(g.x0 - p.x, g.y0 - p.y) < r);
    if (g) { g.ids.push(p.id); g.sx += p.x; g.sy += p.y; } else gs.push({ x0: p.x, y0: p.y, sx: p.x, sy: p.y, ids: [p.id] });
  }
  const at = (g) => [g.sx / g.ids.length, g.sy / g.ids.length];
  for (let i = 0; i < gs.length; i++) {
    for (let j = i + 1; j < gs.length; j++) {
      const [ax, ay] = at(gs[i]), [bx, by] = at(gs[j]);
      if (Math.hypot(ax - bx, ay - by) < r) {
        gs[i].ids.push(...gs[j].ids); gs[i].sx += gs[j].sx; gs[i].sy += gs[j].sy; gs.splice(j, 1);
        i = -1; break;                                        // the merged centre moved: check every pair again
      }
    }
  }
  return gs.map((g) => { const [x, y] = at(g); return { x, y, ids: g.ids }; });
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
// set "" = our Philippine tiles; "world" = OpenFreeMap (only UC Berkeley's zoomed-out view, outside our tiles).
export function bwStyleUrl(theme, set) {
  const o = typeof window !== "undefined" && window.BW_BASEMAP_STYLE;
  return o || "shared/basemap-style" + (set ? "-" + set : "") + (theme === "dark" ? "-dark" : "") + ".json";
}
// A PMTiles archive read with HTTP range requests; a server that ignores Range (sends the whole file with 200) is fine
// too — the file is kept and sliced.
// Every piece is checked before use: after a redeploy Chrome's cache can hand back a stale or zero-filled piece
// ("Wrong magic number for PMTiles archive", every map down; Gregor's Chrome, 2026-09-28). Our archives are gzip
// throughout, so the header starts "PMTiles" and every other piece 1f 8b; a piece that doesn't is fetched once more
// past the cache, and fails (that one tile only) if it is still wrong.
export class BwSource {
  constructor(key) { this.key = key; this.whole = null; this.gz = false; }
  getKey() { return this.key; }
  sound(off, buf) {
    const u = new Uint8Array(buf, 0, Math.min(99, buf.byteLength));
    if (off === 0) {
      if (u.length < 7 || String.fromCharCode(...u.slice(0, 7)) !== "PMTiles") return false;
      this.gz = u.length > 98 && u[97] === 2 && u[98] === 2;   // internal and tile compression both gzip
      return true;
    }
    return !this.gz || (u[0] === 0x1f && u[1] === 0x8b);
  }
  async getBytes(off, len, signal) {
    if (!this.whole) {
      for (const cache of [undefined, "reload"]) {
        const o = { signal, headers: { range: "bytes=" + off + "-" + (off + len - 1) } };
        if (cache) o.cache = cache;
        const r = await fetch(this.key, o);
        if (r.status === 206) { const data = await r.arrayBuffer(); if (this.sound(off, data)) return { data }; continue; }
        if (!r.ok) throw new Error("tiles: " + r.status + " " + this.key);
        const whole = await r.arrayBuffer();                   // a server without ranges: the whole file, checked once
        if (this.sound(0, whole)) { this.whole = whole; break; }
      }
      if (!this.whole) throw new Error("tiles: corrupt piece at " + off + " of " + this.key);
    }
    return { data: this.whole.slice(off, off + len) };
  }
}
export function bwHasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}
// MapLibre's cooperative-gesture help lines (two fingers to move the map on a touch screen), from our strings.
export function bwCoopLocale(c) {
  const k = "CooperativeGesturesHandler.";
  return { [k + "WindowsHelpText"]: c.win, [k + "MacHelpText"]: c.mac, [k + "MobileHelpText"]: c.mobile };
}
// A language change: MapLibre 6 has no public setter for its UI strings, and the gesture screen reads them once when
// it is built, so update its table and rebuild the screen if it is on.
export function bwSetLocale(map, loc) {
  Object.assign(map._locale, loc);
  const cg = map.cooperativeGestures;
  if (cg && cg.isEnabled()) { cg.disable(); cg.enable(); }
}
let bwLib = null;
// The library, loaded once; rejects (so the caller keeps its outline) without WebGL or when the files don't load.
export function bwLoadMapLibre() {
  if (bwLib) return bwLib;
  bwLib = new Promise((res, rej) => {
    if (window.BW_NO_BASEMAP) return rej(new Error("basemap turned off"));
    if (!bwHasWebGL()) return rej(new Error("no WebGL"));
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = BW_LIB + "maplibre-gl.css"; document.head.appendChild(l);
    Promise.all([import("./" + BW_LIB + "maplibre-gl.mjs"), import("./" + BW_PMTILES)]).then(([m, pm]) => {
      const lib = m.Map ? m : m.default;
      const proto = new pm.Protocol(), arcs = new Map();       // every archive through BwSource
      proto.tiles = { get: (k) => { if (!arcs.has(k)) arcs.set(k, new pm.PMTiles(new BwSource(k))); return arcs.get(k); },
                      set: (k, v) => arcs.set(k, v) };
      lib.addProtocol("pmtiles", proto.tile);
      res(lib);
    }, rej);
  });
  return bwLib;
}
// A map in `container`, resolved once a tile has arrived (at the next `idle`, or at the time limit if `idle` is slow
// to follow — a still-loading map on a slow connection is not a failed one); rejected (and removed) on a style error
// before any tile, or if the time limit passes with no tile at all. Tile errors after that are ignored.
export function bwOpenMap(lib, container, o) {
  return new Promise((res, rej) => {
    let done = false, gotTile = false, map = null, t = 0;
    const ms = o.timeout || BW_TIMEOUT_MS;
    // A hidden page (a background tab, a tab restored after sleep) draws no frames, so no tile is ever asked for:
    // the limit counts only while the page is on screen, and starts over each time it comes back.
    const doc = o.doc || (typeof document !== "undefined" ? document : null);
    const arm = () => { clearTimeout(t); t = 0;
      if (!doc || doc.visibilityState !== "hidden") t = setTimeout(() => (gotTile ? settle(map) : fail(new Error("no tile within " + ms + " ms"))), ms); };
    const stop = () => { clearTimeout(t); if (doc) doc.removeEventListener("visibilitychange", arm); };
    const settle = (m) => { if (done) return; done = true; stop(); res(m); };
    const fail = (e) => {
      if (done) return; done = true; stop();
      try { if (map) map.remove(); } catch (x) { /* already gone */ }
      rej(e instanceof Error ? e : new Error(String((e && e.error) || e)));
    };
    if (doc) doc.addEventListener("visibilitychange", arm);
    arm();
    try {
      map = new lib.Map({ container, style: bwStyleUrl(o.theme, o.styleSet), bounds: o.bounds, fitBoundsOptions: { padding: o.padding ?? 24 },
        minZoom: o.minZoom ?? 3, maxZoom: o.maxZoom ?? 17, attributionControl: false, interactive: o.interactive ?? true, dragRotate: false, pitchWithRotate: false,
        touchPitch: false, fadeDuration: o.reduced ? 0 : 300,
        // our style's glyph and tile paths are relative to the page
        transformRequest: (url) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? undefined : { url: new URL(url, location.href).href }), cooperativeGestures: !!o.cooperativeGestures, locale: o.locale });
    } catch (e) { fail(e); return; }
    if (map.touchZoomRotate) map.touchZoomRotate.disableRotation(); if (map.keyboard) map.keyboard.disableRotation();
    // a failed style, font or library before any tile gives up; a failed tile source (one campus's archive) does not:
    // the other sources still draw, and the time limit still catches a map with no tile at all
    map.on("error", (e) => { if (!gotTile && !map.isStyleLoaded() && !(e && e.sourceId)) fail(e); });
    map.on("sourcedata", (e) => { if (e.tile) gotTile = true; });
    map.on("idle", () => { if (gotTile) settle(map); });
  });
}
