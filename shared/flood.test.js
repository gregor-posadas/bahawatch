import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillFlood, scratch, shoreField, bilerp } from './flood.js';

const GW = 20, GH = 20, N = GW * GH;
const flat = () => new Float32Array(N);                       // flat ground at 0 m
const src = (cx, cy, depth) => ({ idx: 0, cx, cy, gElev: 0, depth });
const wet = (s, x, y) => s.depth[y * GW + x] > 0;

test('a wall of fully built cells keeps the water on one side', () => {
  const block = new Uint8Array(N); for (let y = 0; y < GH; y++) block[y * GW + 10] = 1;
  const s = scratch(N); fillFlood({ elev: flat(), block, GW, GH }, [src(3, 10, 0.3)], s);
  assert.ok(wet(s, 9, 10) && wet(s, 3, 3));
  for (let y = 0; y < GH; y++) for (let x = 10; x < GW; x++) assert.ok(!wet(s, x, y), `(${x},${y}) is past the wall`);
});

test('the same wall with a street cell through it lets the water pass', () => {
  const block = new Uint8Array(N); for (let y = 0; y < GH; y++) block[y * GW + 10] = 1;
  block[10 * GW + 10] = 0;                                     // the street is never blocked
  const s = scratch(N); fillFlood({ elev: flat(), block, GW, GH }, [src(3, 10, 0.3)], s);
  assert.ok(wet(s, 10, 10) && wet(s, 14, 10) && wet(s, 14, 3));
});

test('blocked cells themselves stay dry', () => {
  const block = new Uint8Array(N); block[10 * GW + 5] = 1;
  const s = scratch(N); fillFlood({ elev: flat(), block, GW, GH }, [src(3, 10, 0.3)], s);
  assert.ok(!wet(s, 5, 10) && wet(s, 6, 10));
});

test('with no obstacles it matches the fill the page used before (same depths, same sources)', () => {
  // the pre-obstacle algorithm, copied from template.html v24 computeFlood()
  function legacy(elev, sources) {
    const depth = new Float32Array(N), srcIdx = new Int8Array(N).fill(-1), gen = new Int32Array(N), dist = new Int32Array(N), q = new Int32Array(N); let G = 0;
    for (const s of sources) {
      if (s.depth <= 0.02) continue;
      const WSE = s.gElev + s.depth, cap = s.depth + 0.45; G++; let qh = 0, qt = 0; const start = s.cy * GW + s.cx;
      gen[start] = G; dist[start] = 0; q[qt++] = start;
      while (qh < qt) {
        const i = q[qh++], x = i % GW, dstep = dist[i]; const d = WSE - 0.010 * dstep - elev[i];
        if (d <= 0.02 || d > cap) continue; if (d > depth[i]) { depth[i] = d; srcIdx[i] = s.idx; } if (dstep >= 80) continue;
        for (const j of [i - 1, i + 1, i - GW, i + GW]) { if (j < 0 || j >= N) continue; if ((j === i - 1 && x === 0) || (j === i + 1 && x === GW - 1)) continue; if (gen[j] === G) continue; gen[j] = G; dist[j] = dstep + 1; q[qt++] = j; }
      }
    }
    return { depth, srcIdx };
  }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const elev = new Float32Array(N).map(() => rnd() * 0.6);
  const sources = [{ idx: 0, cx: 4, cy: 4, gElev: elev[4 * GW + 4], depth: 0.35 }, { idx: 1, cx: 15, cy: 12, gElev: elev[12 * GW + 15], depth: 0.5 }];
  const s = scratch(N); fillFlood({ elev, block: null, GW, GH }, sources, s);
  const L = legacy(elev, sources);
  assert.deepEqual(Array.from(s.depth), Array.from(L.depth));
  assert.deepEqual(Array.from(s.src), Array.from(L.srcIdx));
});

// The drawn water (2026-09-29): a signed field on the model grid — the depth where wet, and where dry the (negative)
// height of the neighbouring water surface above this cell's ground — so the edge, drawn where the field crosses zero
// between cells, sits where the water surface meets the terrain instead of on a cell boundary.
test('shoreField: wet cells carry their depth; a dry neighbour carries the water surface minus its own ground', () => {
  const elev = flat(); elev[5 * GW + 6] = 0.5;               // a step up beside the water
  const depth = new Float32Array(N); depth[5 * GW + 5] = 0.3;
  const F = shoreField({ elev, block: null, sea: null, GW, GH }, depth, false);
  assert.ok(Math.abs(F[5 * GW + 5] - 0.3) < 1e-6);
  assert.ok(Math.abs(F[5 * GW + 6] - (0.3 - 0.5)) < 1e-6);   // surface 0.3 m, ground 0.5 m: 0.2 m above the water
  assert.ok(F[5 * GW + 6] < 0 && F[0] < 0);                  // dry stays dry, and far cells are dry
});
test('shoreField: a dry cell the surface would reach (outside the fill) stays dry, just below zero', () => {
  const depth = new Float32Array(N); depth[5 * GW + 5] = 0.3;  // flat ground: the neighbour is below the surface
  const F = shoreField({ elev: flat(), block: null, sea: null, GW, GH }, depth, false);
  assert.ok(F[5 * GW + 6] < 0 && F[5 * GW + 6] > -0.05);
});
test('shoreField: built cells are dry unless footprints will be cut out; the sea is never water', () => {
  const block = new Uint8Array(N), sea = new Uint8Array(N); block[5 * GW + 6] = 1; block[5 * GW + 4] = 1; sea[5 * GW + 4] = 1;
  const depth = new Float32Array(N); depth[5 * GW + 5] = 0.3;
  const g = { elev: flat(), block, sea, GW, GH };
  assert.ok(shoreField(g, depth, false)[5 * GW + 6] < 0);    // no footprints to cut out: the built cell stays dry
  const open = shoreField(g, depth, true);
  assert.ok(Math.abs(open[5 * GW + 6] - 0.3) < 1e-6);        // footprints will be cut out: water runs between the buildings
  assert.ok(open[5 * GW + 4] < 0);                           // sea: never drawn as flood
});
test('bilerp: exact at cell centres, linear between, clamped at the edges', () => {
  const F = new Float32Array(N); F[5 * GW + 5] = 1; F[5 * GW + 6] = -1;
  assert.equal(bilerp(F, GW, GH, 5, 5), 1);
  assert.ok(Math.abs(bilerp(F, GW, GH, 5.5, 5)) < 1e-6);     // the zero crossing halfway between +1 and -1
  assert.equal(bilerp(F, GW, GH, -3, -3), F[0]);
});
