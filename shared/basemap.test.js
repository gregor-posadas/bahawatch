import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bwCluster, bwCoverage, bwFitVB, bwCampusBox, bwStyleUrl } from './basemap.js';

test('points closer than the radius share a cluster, in list order, at their mean', () => {
  const g = bwCluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 30, y: 0 }, { id: 'c', x: 100, y: 0 }], 36);
  assert.deepEqual(g, [{ x: 15, y: 0, ids: ['a', 'b'] }, { x: 100, y: 0, ids: ['c'] }]);
});
test('a point joins the first cluster whose first point is near', () => {
  const g = bwCluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 50, y: 0 }, { id: 'c', x: 25, y: 0 }], 36);
  assert.deepEqual(g.map((x) => x.ids), [['a', 'c'], ['b']]);
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
