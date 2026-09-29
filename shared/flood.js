// Sensor-seeded terrain fill (spec §6.2). Water from each wet sensor sets a surface at ground + measured depth and
// spreads to neighbouring cells that surface can reach, losing DECAY_PER_CELL per step, never into a blocked cell
// (≥ 75 % built, or sea). Pure: the page and the tests run this same function.
export const DECAY_PER_CELL = 0.010;
export const MAX_STEPS = 80;

// g: {elev: Float32Array, block: Uint8Array|null, GW, GH}
// sources: [{idx, cx, cy, gElev, depth}] (depth in metres)
// s: scratch reused between calls {depth: Float32Array, src: Int8Array, gen: Int32Array, dist: Int32Array, q: Int32Array, g: number}
// g.cellM (metres per cell) makes the decay and the reach metric — 1 cm per 15 m, at most 1.2 km — so a finer grid
// changes where water can go (obstacles), not how far it spreads; without it, the original per-cell values.
export function fillFlood(g, sources, s) {
  const { elev, block, GW, GH } = g, N = GW * GH;
  const DECAY = g.cellM ? DECAY_PER_CELL * g.cellM / 15 : DECAY_PER_CELL, STEPS = g.cellM ? Math.round(MAX_STEPS * 15 / g.cellM) : MAX_STEPS;
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
      const d = WSE - DECAY * dstep - elev[i];
      if (d <= 0.02 || d > cap) continue;   // dry ground, or far below the observed surface: no claim, no traverse
      if (d > s.depth[i]) { s.depth[i] = d; s.src[i] = w.idx; }
      if (dstep >= STEPS) continue;
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
// (the fill stopped short of it) mirrors the water depth, so the edge sits on the cell boundary: the drawing never
// floods more than the model did. Built cells
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
    const v = surf - elev[i];
    F[i] = v < -0.01 ? v : -deep;   // terrain stops the water: its own crossing; the fill stopped short: the cell boundary
  }
  return F;
}
// F sampled at fractional cell coordinates (cell centres at integers), bilinear, clamped at the grid edge
export function bilerp(F, GW, GH, gx, gy) {
  gx = Math.max(0, Math.min(GW - 1, gx)); gy = Math.max(0, Math.min(GH - 1, gy));
  const x0 = Math.min(GW - 2, Math.floor(gx)), y0 = Math.min(GH - 2, Math.floor(gy)), tx = gx - x0, ty = gy - y0, i = y0 * GW + x0;
  return (F[i] * (1 - tx) + F[i + 1] * tx) * (1 - ty) + (F[i + GW] * (1 - tx) + F[i + GW + 1] * tx) * ty;
}

// The model's terrain on its fine grid: bilinear interpolation of the file's coarse elevation (decimetres) at fine
// cell centres, street cells carved `carve` m below the lowest cell of the win×win window around them (3 at 15 m, 5 at
// 7.5 m: about the same 40 m). model/grids.py fine_elev()
// does the same arithmetic (tested against the same numbers).
export function fineElev(coarseDm, EW, EH, GW, GH, street, carve, win = 3) {
  const e = new Float64Array(GW * GH);
  const axis = (nf, nc) => { const i0 = new Int32Array(nf), t = new Float64Array(nf);
    for (let k = 0; k < nf; k++) { const u = Math.max(0, Math.min(nc - 1, (k + 0.5) * nc / nf - 0.5)); i0[k] = Math.min(Math.floor(u), Math.max(nc - 2, 0)); t[k] = u - i0[k]; }
    return [i0, t]; };
  const [x0, tx] = axis(GW, EW), [y0, ty] = axis(GH, EH), c = (x, y) => coarseDm[y * EW + x] / 10;
  for (let y = 0; y < GH; y++) {
    const ya = y0[y], yb = Math.min(ya + 1, EH - 1);
    for (let x = 0; x < GW; x++) {
      const xa = x0[x], xb = Math.min(xa + 1, EW - 1);
      const top = c(xa, ya) * (1 - tx[x]) + c(xb, ya) * tx[x], bot = c(xa, yb) * (1 - tx[x]) + c(xb, yb) * tx[x];
      e[y * GW + x] = top * (1 - ty[y]) + bot * ty[y];
    }
  }
  const out = Float32Array.from(e);
  if (street && carve) {   // only street cells, each from the uncarved terrain (so the order doesn't matter)
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (!street[y * GW + x]) continue;
      let m = Infinity; const r = (win - 1) >> 1;
      for (let dy = -r; dy <= r; dy++) { const Y = Math.max(0, Math.min(GH - 1, y + dy)) * GW;
        for (let dx = -r; dx <= r; dx++) m = Math.min(m, e[Y + Math.max(0, Math.min(GW - 1, x + dx))]); }
      out[y * GW + x] = m - carve;
    }
  }
  return out;
}
