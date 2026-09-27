// Rain now / next hour per point (spec §7 "rain adapter"). Open-Meteo hourly `precipitation` at time T is the
// sum over (T-1h, T]. "now" = max(hour ending before now, hour in progress); "next" = the hour after that.
export async function fetchRain(points, fetchImpl = fetch, now = Date.now()) {
  const out = new Map();
  if (!points.length) return out;
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + points.map((p) => p.lat).join(',')
    + '&longitude=' + points.map((p) => p.lon).join(',') + '&hourly=precipitation&past_hours=2&forecast_hours=3&timezone=GMT';
  try {
    const r = await fetchImpl(u);
    if (!r.ok) return out;
    let data = await r.json();
    if (!Array.isArray(data)) data = [data];
    data.forEach((d, i) => {
      const t = d.hourly.time.map((s) => Date.parse(s + ':00Z')), p = d.hourly.precipitation;
      let k = t.findIndex((x) => x > now);
      if (k < 1) return;
      out.set(points[i].key, { nowMmH: Math.max(p[k - 1] ?? 0, p[k] ?? 0), nextMmH: p[k + 1] ?? 0, at: now });
    });
  } catch { /* leave empty: caller keeps last stored rain */ }
  return out;
}
