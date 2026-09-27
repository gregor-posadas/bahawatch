// The "Babaha ba?" rule (spec §3). Pure: no network, no clock, no DOM.
// Imported by the Cloudflare Worker; inlined into the page by build_html.py (which strips `export `).
export const RULE = {
  FRESH_MIN: 20, WET_CM: 5, TRACE_CM: 1, LOOKAHEAD_MIN: 60, REPORTS_YES: 3,
  REPORT_RADIUS_M: 1000, DRY_SENSOR_M: 500, RAIN_YELLOW: 7.5, RAIN_ORANGE: 15,
};
const VERDICT_MIN_MS = 60000;

function minutesToWet(s) {
  if (s.depthCm >= RULE.WET_CM) return 0;
  if (!(s.rateCmPerHr > 0)) return Infinity;
  return (RULE.WET_CM - s.depthCm) / s.rateCmPerHr * 60;
}
function roundEta(t) { return Math.max(5, Math.round(t / 5) * 5); }

export function babahaBa(x) {
  const now = x.now, place = x.place, sensors = x.sensors || [];
  const reports = x.reports || { yesPhones: 0, newestAt: null }, rain = x.rain || null;
  const fresh = (t) => Number.isFinite(t) && now - t <= RULE.FRESH_MIN * VERDICT_MIN_MS;
  const times = [...sensors.map((s) => s.at), reports.newestAt, rain && rain.at].filter((t) => Number.isFinite(t));
  const updatedAt = times.length ? Math.max(...times) : null;
  const out = (answer, key, vars = {}, etaMin = null) => ({ answer, reason: { key, vars }, updatedAt, etaMin });

  if (updatedAt === null || !fresh(updatedAt)) return out('nodata', 'stale');

  const live = sensors.filter((s) => fresh(s.at));
  const here = live.find((s) => s.here);
  if (here) {
    if (here.depthCm >= RULE.WET_CM) return out('oo', 'sensor_now', { name: here.name, cm: Math.round(here.depthCm) });
    const t = minutesToWet(here);
    if (t <= RULE.LOOKAHEAD_MIN) return out('oo', 'sensor_soon', { name: here.name, min: roundEta(t) }, roundEta(t));
  }
  let best = null;
  for (const s of live) {
    if (s.here || s.travelMin == null) continue;
    const t = minutesToWet(s) + s.travelMin;
    if (t <= RULE.LOOKAHEAD_MIN && (!best || t < best.t)) best = { s, t };
  }
  if (best) return out('oo', 'upstream', { name: best.s.name, min: roundEta(best.t) }, roundEta(best.t));

  const yes = reports.yesPhones || 0;
  if (yes >= RULE.REPORTS_YES) {
    const dry = live.some((s) => s.distM <= RULE.DRY_SENSOR_M && s.depthCm < RULE.TRACE_CM && !(s.rateCmPerHr > 0));
    return dry ? out('baka', 'reports_vs_dry_sensor', { n: yes }) : out('oo', 'reports', { n: yes });
  }

  if (rain && fresh(rain.at)) {
    const mm = Math.max(rain.nowMmH || 0, rain.nextMmH || 0);
    if (mm >= RULE.RAIN_YELLOW && (place.noah5 || place.noah25)) return out('baka', 'rain_flood_zone', { mm: Math.round(mm) });
    if (mm >= RULE.RAIN_ORANGE && place.noahMapped) return out('baka', 'rain_heavy', { mm: Math.round(mm) });
  }
  if (yes >= 1) return out('baka', 'reports_few', { n: yes });
  if (here && here.depthCm >= RULE.TRACE_CM) return out('baka', 'sensor_trace', { name: here.name, cm: Math.round(here.depthCm) });
  // "No sign" means less with no sensor to look at: say so, rather than claim sensors were checked.
  return out('hindi', live.length ? 'clear' : 'clear_no_sensor');
}
