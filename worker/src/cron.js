import { babahaBa, RULE } from '../../shared/verdict.js';
import { PLACES, haversineM } from './geo.js';
import { fetchRain } from './rain.js';

const MIN = 60000;
// Filtered by `at` alone: served by the readings_at index (migrations/0001_init.sql), never a full scan.
export const READINGS_SQL = 'SELECT sensor, at, depth_cm FROM readings WHERE at > ? ORDER BY at DESC';
const siteCentre = (site) => {
  const ps = PLACES.sites[site];
  return { key: site, lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lon: ps.reduce((a, p) => a + p.lon, 0) / ps.length };
};

export async function runCron(env, now, fetchImpl = fetch) {
  const DB = env.DB;
  // 1. rain: refresh what we can, keep the rest. One statement per site that answered (at most a
  // handful of sites), never per place, so this never threatens the 50-query cap below.
  const fresh = await fetchRain(Object.keys(PLACES.sites).map(siteCentre), fetchImpl, now, env.RAIN_TIMEOUT_MS);
  for (const [site, r] of fresh) {
    await DB.prepare('INSERT OR REPLACE INTO rain(site,now_mm,next_mm,at) VALUES(?,?,?,?)').bind(site, r.nowMmH, r.nextMmH, r.at).run();
  }
  const rainRows = new Map((await DB.prepare('SELECT * FROM rain').all()).results.map((r) => [r.site, { nowMmH: r.now_mm, nextMmH: r.next_mm, at: r.at }]));

  // 2. sensors: latest reading and rate from a reading 10-40 min earlier
  const rd = (await DB.prepare(READINGS_SQL).bind(now - 60 * MIN).all()).results;
  const latest = new Map();
  for (const r of rd) {
    const l = latest.get(r.sensor);
    if (!l) latest.set(r.sensor, { at: r.at, depthCm: r.depth_cm, rateCmPerHr: 0 });
    else if (!l.prev && l.at - r.at >= 10 * MIN && l.at - r.at <= 40 * MIN) {
      l.prev = true; l.rateCmPerHr = (l.depthCm - r.depth_cm) / ((l.at - r.at) / 3600000);
    }
  }

  // 3. reports: last 60 min, not demo; each phone counts by its latest report per place-area
  const reps = (await DB.prepare('SELECT at, place, lat, lon, answer, device FROM reports WHERE demo=0 AND at > ? ORDER BY at DESC').bind(now - 60 * MIN).all()).results;

  // Read every place's current status ONCE (not one SELECT per place - D1's free plan caps a Worker
  // invocation at 50 queries, and one place-by-place round trip would blow through it well before
  // reaching all ~50+ places).
  const statusRows = new Map((await DB.prepare('SELECT place, answer, reason, eta_min, still_there FROM status').all()).results.map((r) => [r.place, r]));

  const changedRows = [], perPlace = {};
  let count = 0;
  for (const [site, places] of Object.entries(PLACES.sites)) {
    for (const p of places) {
      count++;
      const conn = new Map(p.connected.map((c) => [c.sensor, c.travelMin]));
      const sensors = [];
      for (const [id, l] of latest) {
        const s = PLACES.sensors[id]; if (!s) continue;
        const distM = haversineM(p.lat, p.lon, s.lat, s.lon);
        const here = (p.inside || []).includes(id) || (p.kind === 'sensor' && p.sensor === id);   // inside the place = here
        if (!here && !conn.has(id) && distM > RULE.REPORT_RADIUS_M) continue;
        sensors.push({ id, name: s.name, here, distM, travelMin: conn.has(id) ? conn.get(id) : null, depthCm: l.depthCm, rateCmPerHr: l.rateCmPerHr, at: l.at });
      }
      const seen = new Set(); let yesPhones = 0, newestAt = null, still = null;
      for (const r of reps) {
        const d = haversineM(p.lat, p.lon, r.lat, r.lon);
        if (d > RULE.REPORT_RADIUS_M) continue;
        // Each phone counts once, by its latest report (rows are newest first) - for the Oo count AND for
        // "Still there?": a phone that answered Hindi after its own Oo no longer keeps the prompt alive.
        if (seen.has(r.device)) continue;
        seen.add(r.device);
        // Store the report's own timestamp and distance, not an age computed now: an age baked in at
        // cron time would grow stale between runs and, worse, change on every run purely because time
        // passed, defeating write-on-change. /status recomputes the age from serverNow when it's read.
        if (r.answer === 'oo' && !still && d <= 300 && now - r.at <= 30 * MIN) still = { at: r.at, distM: Math.round(d) };
        if (r.answer === 'oo') { yesPhones++; newestAt = Math.max(newestAt ?? 0, r.at); }
      }
      const v = babahaBa({ now, place: p, sensors, reports: { yesPhones, newestAt }, rain: rainRows.get(site) || null });
      perPlace[p.id] = v.updatedAt;
      const reason = JSON.stringify(v.reason), stillJ = still ? JSON.stringify(still) : null;
      const old = statusRows.get(p.id);
      if (!old || old.answer !== v.answer || old.reason !== reason || old.eta_min !== v.etaMin || old.still_there !== stillJ) {
        changedRows.push({ place: p.id, answer: v.answer, reason, etaMin: v.etaMin, updatedAt: v.updatedAt, stillThere: stillJ });
      }
    }
  }

  // One statement writes every changed place's status row, however many places changed - not one
  // INSERT per place. json_each unpacks the bound JSON array; changed_at is the same for every row
  // in this run so it's bound once, outside the array.
  if (changedRows.length) {
    await DB.prepare(`INSERT OR REPLACE INTO status(place,answer,reason,eta_min,updated_at,still_there,changed_at)
      SELECT json_extract(value,'$.place'), json_extract(value,'$.answer'), json_extract(value,'$.reason'),
             json_extract(value,'$.etaMin'), json_extract(value,'$.updatedAt'), json_extract(value,'$.stillThere'), ?2
      FROM json_each(?1)`).bind(JSON.stringify(changedRows), now).run();
  }
  const newest = Object.values(perPlace).filter((t) => Number.isFinite(t)).reduce((a, t) => Math.max(a, t), null);
  await DB.prepare('INSERT OR REPLACE INTO heartbeat(id, ran_at, newest_at, per_place) VALUES(1,?,?,?)').bind(now, newest, JSON.stringify(perPlace)).run();

  // 4. on the hour: roll up the previous hour, apply retention (raw reports only - spec only requires
  // dropping reports after 30 days; sensor readings are non-personal field data kept for tuning).
  if (new Date(now).getUTCMinutes() < 5) {
    const h1 = now - (now % 3600000), h0 = h1 - 3600000;
    const rows = (await DB.prepare("SELECT place, SUM(answer='oo') AS oo, SUM(answer='hindi') AS hindi, SUM(answer='di_sigurado') AS unsure FROM reports WHERE demo=0 AND at>=? AND at<? GROUP BY place").bind(h0, h1).all()).results;
    if (rows.length) {
      await DB.prepare(`INSERT OR REPLACE INTO hourly_counts(place,hour,oo,hindi,unsure)
        SELECT json_extract(value,'$.place'), ?2, json_extract(value,'$.oo'), json_extract(value,'$.hindi'), json_extract(value,'$.unsure')
        FROM json_each(?1)`).bind(JSON.stringify(rows), h0).run();
    }
    await DB.prepare('DELETE FROM reports WHERE at < ?').bind(now - 30 * 24 * 3600000).run();
    // Unlink the phone's random id from its ~100 m positions once a report no longer counts (60 min) -
    // nothing reads `device` on older rows (counting, the 10-min repeat check and Undo all look back <= 60 min).
    await DB.prepare("UPDATE reports SET device='' WHERE at < ? AND device<>''").bind(now - 61 * MIN).run();
  }
  return { places: count, changed: changedRows.length };
}
