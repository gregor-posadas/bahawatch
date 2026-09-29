// Sensor-seeded terrain fill (spec §6.2). Water from each wet sensor sets a surface at ground + measured depth and
// spreads to neighbouring cells that surface can reach, losing DECAY_PER_CELL per step, never into a blocked cell
// (≥ 75 % built, or sea). Pure: the page and the tests run this same function.
export const DECAY_PER_CELL = 0.010;
export const MAX_STEPS = 80;

// g: {elev: Float32Array, block: Uint8Array|null, GW, GH}
// sources: [{idx, cx, cy, gElev, depth}] (depth in metres)
// s: scratch reused between calls {depth: Float32Array, src: Int8Array, gen: Int32Array, dist: Int32Array, q: Int32Array, g: number}
export function fillFlood(g, sources, s) {
  const { elev, block, GW, GH } = g, N = GW * GH;
  s.depth.fill(0); s.src.fill(-1);
  for (const w of sources) {
    if (w.depth <= 0.02) continue;
    const WSE = w.gElev + w.depth;
    const cap = w.depth + 0.45;   // extrapolate only within the observed depth band
    s.g++;
    let qh = 0, qt = 0;
    const start = w.cy * GW + w.cx;
    s.gen[start] = s.g; s.dist[start] = 0; s.q[qt++] = start;
    while (qh < qt) {
      const i = s.q[qh++], x = i % GW, dstep = s.dist[i];
      const d = WSE - DECAY_PER_CELL * dstep - elev[i];
      if (d <= 0.02 || d > cap) continue;   // dry ground, or far below the observed surface: no claim, no traverse
      if (d > s.depth[i]) { s.depth[i] = d; s.src[i] = w.idx; }
      if (dstep >= MAX_STEPS) continue;
      for (const j of [i - 1, i + 1, i - GW, i + GW]) {
        if (j < 0 || j >= N) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === GW - 1)) continue;
        if (s.gen[j] === s.g) continue;
        s.gen[j] = s.g;
        if (block && block[j]) continue;    // buildings and sea: water goes around
        s.dist[j] = dstep + 1; s.q[qt++] = j;
      }
    }
  }
}

export function scratch(N) {
  return { depth: new Float32Array(N), src: new Int8Array(N), gen: new Int32Array(N), dist: new Int32Array(N), q: new Int32Array(N), g: 0 };
}

// The drawn water: a signed field on the model grid. Wet cells carry their depth; a dry cell next to water carries the
// neighbouring water surface minus its own ground (negative), so the edge — drawn where the field crosses zero between
// cells — lands where the surface meets the terrain, not on a cell boundary. A dry cell the surface would still cover
// (the fill stopped short of it) stays just below zero: the drawing never floods more than the model did. Built cells
// (≥ 75 %) take the neighbouring depth only when `open` (the building footprints will be cut out of the drawing, so the
// water shows in the alleys between them); the sea is never flood.
export function shoreField(g, depth, open) {
  const { elev, block, sea, GW, GH } = g, N = GW * GH, F = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (depth[i] > 0.03) { F[i] = depth[i]; continue; }
    if (sea && sea[i]) { F[i] = -1; continue; }
    const x = i % GW, y = (i / GW) | 0;
    let surf = -Infinity, deep = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue;
      const j = Y * GW + X;
      if (depth[j] > 0.03) { surf = Math.max(surf, elev[j] + depth[j]); deep = Math.max(deep, depth[j]); }
    }
    if (surf === -Infinity) { F[i] = -0.3; continue; }
    if (open && block && block[i]) { F[i] = Math.min(deep, surf - elev[i]); continue; }
    F[i] = Math.min(-0.01, surf - elev[i]);
  }
  return F;
}
// F sampled at fractional cell coordinates (cell centres at integers), bilinear, clamped at the grid edge
export function bilerp(F, GW, GH, gx, gy) {
  gx = Math.max(0, Math.min(GW - 1, gx)); gy = Math.max(0, Math.min(GH - 1, gy));
  const x0 = Math.min(GW - 2, Math.floor(gx)), y0 = Math.min(GH - 2, Math.floor(gy)), tx = gx - x0, ty = gy - y0, i = y0 * GW + x0;
  return (F[i] * (1 - tx) + F[i + 1] * tx) * (1 - ty) + (F[i + GW] * (1 - tx) + F[i + GW + 1] * tx) * ty;
}
