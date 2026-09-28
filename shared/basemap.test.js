import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bwCluster, bwCoverage, bwFitVB, bwCampusBox, bwStyleUrl, bwOpenMap, bwCoopLocale, bwSetLocale, BwSource } from './basemap.js';

// A minimal stand-in for a MapLibre Map: an event emitter with the handful of members bwOpenMap touches.
function fakeMap() {
  const handlers = {};
  const m = {
    removed: 0,
    styleLoaded: false,
    on(ev, cb) { (handlers[ev] ||= []).push(cb); },
    emit(ev, arg) { for (const cb of handlers[ev] || []) cb(arg); },
    remove() { m.removed++; },
    isStyleLoaded() { return m.styleLoaded; },
    touchZoomRotate: { disableRotation() {} },
    keyboard: { disableRotation() {} },
  };
  return m;
}
// `new lib.Map(opts)` must hand back our fake: a constructor that returns an object overrides `this`.
function fakeLib(map, seen) { return { Map: function FakeMap(o) { if (seen) seen.opts = o; return map; } } }

test('points closer than the radius share a cluster, in list order, at their mean', () => {
  const g = bwCluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 30, y: 0 }, { id: 'c', x: 100, y: 0 }], 36);
  assert.deepEqual(g, [{ x: 15, y: 0, ids: ['a', 'b'] }, { x: 100, y: 0, ids: ['c'] }]);
});
test('a point joins the first cluster whose first point is near', () => {
  const g = bwCluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 50, y: 0 }, { id: 'c', x: 25, y: 0 }], 36);
  assert.deepEqual(g.map((x) => x.ids), [['a', 'c'], ['b']]);
});
test('clusters whose centres end up closer than the radius merge, so no two overlap', () => {
  const g = bwCluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 40, y: 0 }, { id: 'c', x: 20, y: 0 }], 36);
  assert.deepEqual(g, [{ x: 20, y: 0, ids: ['a', 'c', 'b'] }]);
});
test("coverage is the box's span over the view's shorter side", () => {
  assert.equal(bwCoverage({ x0: 0, y0: 0, x1: 400, y1: 300 }, 800, 400), 1);
  assert.ok(bwCoverage({ x0: 10, y0: 10, x1: 110, y1: 60 }, 800, 400) < 0.9);
  assert.equal(bwCoverage({ x0: 5, y0: 5, x1: 5, y1: 5 }, 0, 0), 0);
});
test('a viewBox grows around its centre to the box shape', () => {
  assert.deepEqual(bwFitVB([0, 0, 100, 100], 200, 100), [-50, 0, 200, 100]);
  assert.deepEqual(bwFitVB([0, 0, 100, 100], 100, 200), [0, -50, 100, 200]);
});
test('the campus box matches the pipeline cut (UP Diliman)', () => {
  assert.deepEqual(bwCampusBox(14.650376, 121.067643), [[121.053716, 14.636819], [121.08157, 14.663933]]);
});
test('style URLs: light, dark, and the test override', () => {
  assert.equal(bwStyleUrl('light'), 'shared/basemap-style.json');
  assert.equal(bwStyleUrl('dark'), 'shared/basemap-style-dark.json');
  globalThis.window = { BW_BASEMAP_STYLE: 'tests/x.json' };
  try { assert.equal(bwStyleUrl('dark'), 'tests/x.json'); } finally { delete globalThis.window; }
});

test('bwOpenMap: a tile before the time limit resolves even when idle has not fired yet (Fast 3G)', async () => {
  const map = fakeMap();
  const p = bwOpenMap(fakeLib(map), {}, { timeout: 15 });
  map.emit('sourcedata', { tile: {} });               // the one tile arrives well inside the limit
  const resolved = await p;                            // idle never fires; the limit itself must resolve, not fail
  assert.equal(resolved, map);
  assert.equal(map.removed, 0);
});
test('bwOpenMap: no tile within the time limit rejects and removes the map once', async () => {
  const map = fakeMap();
  const p = bwOpenMap(fakeLib(map), {}, { timeout: 15 });
  await assert.rejects(p);
  assert.equal(map.removed, 1);
});
// A page loaded in a background tab (or a hidden pane) draws no frames, so MapLibre never asks for a tile: the time
// limit must only count while the page is on screen, or every map gives up before anyone looks (seen 2026-09-28).
function fakeDoc(state) {
  const hs = [];
  return { visibilityState: state, added: 0, removed: 0,
    addEventListener(ev, cb) { if (ev === 'visibilitychange') { hs.push(cb); this.added++; } },
    removeEventListener(ev, cb) { const i = hs.indexOf(cb); if (i >= 0) { hs.splice(i, 1); this.removed++; } },
    set(state) { this.visibilityState = state; for (const cb of [...hs]) cb(); } };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
test('bwOpenMap: the time limit does not run while the page is hidden', async () => {
  const map = fakeMap(), doc = fakeDoc('hidden');
  let out = 'pending';
  bwOpenMap(fakeLib(map), {}, { timeout: 15, doc }).then(() => { out = 'resolved'; }, () => { out = 'rejected'; });
  await wait(60);
  assert.equal(out, 'pending');                        // hidden four times the limit: still waiting, map kept
  assert.equal(map.removed, 0);
  doc.set('visible');                                  // on screen: the frames start, and so does the limit
  map.emit('sourcedata', { tile: {} });
  map.emit('idle');
  await wait(5);
  assert.equal(out, 'resolved');
  assert.equal(doc.removed, doc.added);                // no listener left behind
});
test('bwOpenMap: hidden part-way, the limit starts over when the page is back on screen', async () => {
  const map = fakeMap(), doc = fakeDoc('visible');
  let out = 'pending';
  bwOpenMap(fakeLib(map), {}, { timeout: 40, doc }).then(() => { out = 'resolved'; }, () => { out = 'rejected'; });
  await wait(20);
  doc.set('hidden');
  await wait(80);
  assert.equal(out, 'pending');
  doc.set('visible');
  await wait(90);
  assert.equal(out, 'rejected');                       // on screen for the full limit with no tile: a real failure
  assert.equal(map.removed, 1);
  assert.equal(doc.removed, doc.added);
});
test('bwOpenMap: a style error before any tile rejects and removes the map once', async () => {
  const map = fakeMap();
  const p = bwOpenMap(fakeLib(map), {}, { timeout: 1000 });
  map.emit('error', { error: new Error('style failed') });
  await assert.rejects(p);
  assert.equal(map.removed, 1);
});
test('bwOpenMap: a tile then idle before the time limit resolves once, with no double settle', async () => {
  const map = fakeMap();
  const p = bwOpenMap(fakeLib(map), {}, { timeout: 15 });
  map.emit('sourcedata', { tile: {} });
  map.emit('idle');
  const resolved = await p;
  assert.equal(resolved, map);
  assert.equal(map.removed, 0);
  await new Promise((r) => setTimeout(r, 25));          // let the (already-settled) timer fire too
  assert.equal(map.removed, 0);                         // it must not remove an already-resolved map
});

// finding 1 (whole-branch review): on a phone one finger scrolls the page over the national map; two move the map
test('bwOpenMap: cooperative gestures and the UI strings are passed through only when asked for', async () => {
  const seen = {}, map = fakeMap();
  const loc = bwCoopLocale({ win: 'w', mac: 'm', mobile: 'two fingers' });
  const p = bwOpenMap(fakeLib(map, seen), {}, { timeout: 15, cooperativeGestures: true, locale: loc });
  map.emit('sourcedata', { tile: {} }); await p;
  assert.equal(seen.opts.cooperativeGestures, true);
  assert.equal(seen.opts.locale['CooperativeGesturesHandler.MobileHelpText'], 'two fingers');
  const seen2 = {}, map2 = fakeMap();
  const p2 = bwOpenMap(fakeLib(map2, seen2), {}, { timeout: 15 });
  map2.emit('sourcedata', { tile: {} }); await p2;
  assert.equal(seen2.opts.cooperativeGestures, false);   // other callers (the country view) keep one-finger panning
  assert.equal(seen2.opts.locale, undefined);
});
test("bwCoopLocale names MapLibre's three cooperative-gesture strings", () => {
  assert.deepEqual(bwCoopLocale({ win: 'a', mac: 'b', mobile: 'c' }), {
    'CooperativeGesturesHandler.WindowsHelpText': 'a', 'CooperativeGesturesHandler.MacHelpText': 'b', 'CooperativeGesturesHandler.MobileHelpText': 'c' });
});
test('bwSetLocale updates the strings and rebuilds the gesture screen, which reads them once, only when it is on', () => {
  const calls = [];
  const cg = { on: true, isEnabled() { return this.on; }, disable() { calls.push('off'); this.on = false; }, enable() { calls.push('on'); this.on = true; } };
  const map = { _locale: { keep: 'x', 'CooperativeGesturesHandler.MobileHelpText': 'old' }, cooperativeGestures: cg };
  bwSetLocale(map, { 'CooperativeGesturesHandler.MobileHelpText': 'bago' });
  assert.equal(map._locale['CooperativeGesturesHandler.MobileHelpText'], 'bago');
  assert.equal(map._locale.keep, 'x');
  assert.deepEqual(calls, ['off', 'on']);
  cg.on = false; calls.length = 0;
  bwSetLocale(map, { 'CooperativeGesturesHandler.MobileHelpText': 'again' });
  assert.deepEqual(calls, []);
});

// Chrome's cache can hand back a stale or zero-filled piece of a tile file after a redeploy (seen 2026-09-28 in Gregor's
// Chrome: "Wrong magic number for PMTiles archive", every map down). Our archives are gzip throughout, so every piece
// has a known first bytes: the header starts "PMTiles", every other piece 1f 8b. A piece that doesn't is fetched again
// past the cache.
const HEAD = () => { const b = new Uint8Array(16384); b.set([...'PMTiles'].map((c) => c.charCodeAt(0))); b[7] = 3; b[97] = 2; b[98] = 2; return b; };
const GZ = (n) => { const b = new Uint8Array(n); b[0] = 0x1f; b[1] = 0x8b; return b; };
function fakeFetch(answers) {
  const calls = [];
  const f = async (url, o) => { calls.push({ url, cache: o.cache, range: o.headers.range }); const b = answers.shift();
    return { status: 206, ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  f.calls = calls; return f;
}
test('BwSource: a zero-filled header from the cache is fetched again past the cache', async () => {
  const f = fakeFetch([new Uint8Array(16384), HEAD()]); globalThis.fetch = f;
  const r = await new BwSource('t.pmtiles').getBytes(0, 16384);
  assert.equal(String.fromCharCode(...new Uint8Array(r.data).slice(0, 7)), 'PMTiles');
  assert.deepEqual(f.calls.map((c) => c.cache), [undefined, 'reload']);
});
test('BwSource: a tile piece that is not gzip is fetched again past the cache; a good one is fetched once', async () => {
  const f = fakeFetch([HEAD(), new Uint8Array(500), GZ(500), GZ(300)]); globalThis.fetch = f;
  const s = new BwSource('t.pmtiles');
  await s.getBytes(0, 16384);
  const r = await s.getBytes(20000, 500);
  assert.equal(new Uint8Array(r.data)[0], 0x1f);
  await s.getBytes(30000, 300);
  assert.deepEqual(f.calls.map((c) => c.cache), [undefined, undefined, 'reload', undefined]);
});
test('BwSource: still wrong after the second fetch, the piece fails (one bad tile, not a silent blank)', async () => {
  const f = fakeFetch([new Uint8Array(16384), new Uint8Array(16384)]); globalThis.fetch = f;
  await assert.rejects(new BwSource('t.pmtiles').getBytes(0, 16384), /corrupt/);
});
test('bwOpenMap: an error from one tile source before any tile does not take the whole map down', async () => {
  const map = fakeMap();
  let out = 'pending';
  bwOpenMap(fakeLib(map), {}, { timeout: 1000 }).then(() => { out = 'resolved'; }, () => { out = 'rejected'; });
  map.emit('error', { sourceId: 'site-upd', error: new Error('Wrong magic number for PMTiles archive') });
  await wait(5);
  assert.equal(out, 'pending');
  assert.equal(map.removed, 0);
  map.emit('sourcedata', { tile: {} }); map.emit('idle');
  await wait(5);
  assert.equal(out, 'resolved');
});
