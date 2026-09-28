import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bwCluster, bwCoverage, bwFitVB, bwCampusBox, bwStyleUrl, bwOpenMap, bwCoopLocale, bwSetLocale } from './basemap.js';

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
