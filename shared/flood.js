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
