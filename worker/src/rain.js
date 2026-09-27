// Rain now / next hour per point (spec §7 "rain adapter"). Open-Meteo hourly `precipitation` at time T is the
// sum over (T-1h, T]. "now" = max(hour ending before now, hour in progress); "next" = the hour after that.
// A hung Open-Meteo request must never hold up the cron (and its heartbeat): after RAIN_TIMEOUT_MS it counts as a
// failure (empty Map -> the cron keeps the last stored rain).
export const RAIN_TIMEOUT_MS = 10000;
export async function fetchRain(points, fetchImpl = fetch, now = Date.now(), timeoutMs = RAIN_TIMEOUT_MS) {
  const out = new Map();
  if (!points.length) return out;
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + points.map((p) => p.lat).join(',')
    + '&longitude=' + points.map((p) => p.lon).join(',') + '&hourly=precipitation&past_hours=2&forecast_hours=3&timezone=GMT';
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('rain timeout')), timeoutMs); });
  try {
    // The abort signal cancels a real fetch; the race covers a fetch (or body read) that ignores it.
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
    const r = await Promise.race([fetchImpl(u, { signal }), timeout]);
    if (!r.ok) return out;
    let data = await Promise.race([r.json(), timeout]);
    if (!Array.isArray(data)) data = [data];
    data.forEach((d, i) => {
      const t = d.hourly.time.map((s) => Date.parse(s + ':00Z')), p = d.hourly.precipitation;
      let k = t.findIndex((x) => x > now);
      if (k < 1) return;
      const num = (x) => (Number.isFinite(x) ? x : null);
      const a = num(p[k - 1]), b = num(p[k]), c = num(p[k + 1]);
      // No value at all for now or next: omit the site rather than report a fresh 0 mm/h (a false "Hindi");
      // the cron then keeps the last stored rain, which ages out on its own.
      if (a === null && b === null && c === null) return;
      out.set(points[i].key, { nowMmH: Math.max(a ?? 0, b ?? 0), nextMmH: c ?? 0, at: now });
    });
  } catch { /* leave empty: caller keeps last stored rain */ } finally { clearTimeout(timer); }
  return out;
}
