import { babahaBa, RULE } from '../../shared/verdict.js';
import { PLACES, haversineM } from './geo.js';
import { fetchRain } from './rain.js';

const MIN = 60000;
const siteCentre = (site) => {
  const ps = PLACES.sites[site];
  return { key: site, lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lon: ps.reduce((a, p) => a + p.lon, 0) / ps.length };
};

export async function runCron(env, now, fetchImpl = fetch) {
  const DB = env.DB;
  // 1. rain: refresh what we can, keep the rest
  const fresh = await fetchRain(Object.keys(PLACES.sites).map(siteCentre), fetchImpl, now);
  for (const [site, r] of fresh) {
    await DB.prepare('INSERT OR REPLACE INTO rain(site,now_mm,next_mm,at) VALUES(?,?,?,?)').bind(site, r.nowMmH, r.nextMmH, r.at).run();
  }
  const rainRows = new Map((await DB.prepare('SELECT * FROM rain').all()).results.map((r) => [r.site, { nowMmH: r.now_mm, nextMmH: r.next_mm, at: r.at }]));

  // 2. sensors: latest reading and rate from a reading 10-40 min earlier
  const rd = (await DB.prepare('SELECT sensor, at, depth_cm FROM readings WHERE at > ? ORDER BY at DESC').bind(now - 60 * MIN).all()).results;
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

  let changed = 0, newest = null, count = 0;
  for (const [site, places] of Object.entries(PLACES.sites)) {
    for (const p of places) {
      count++;
      const conn = new Map(p.connected.map((c) => [c.sensor, c.travelMin]));
      const sensors = [];
      for (const [id, l] of latest) {
        const s = PLACES.sensors[id]; if (!s) continue;
        const distM = haversineM(p.lat, p.lon, s.lat, s.lon);
        const here = p.kind === 'sensor' && p.sensor === id;
        if (!here && !conn.has(id) && distM > RULE.REPORT_RADIUS_M) continue;
        sensors.push({ id, name: s.name, here, distM, travelMin: conn.has(id) ? conn.get(id) : null, depthCm: l.depthCm, rateCmPerHr: l.rateCmPerHr, at: l.at });
      }
      const seen = new Set(); let yesPhones = 0, newestAt = null, still = null;
      for (const r of reps) {
        const d = haversineM(p.lat, p.lon, r.lat, r.lon);
        if (d > RULE.REPORT_RADIUS_M) continue;
        if (r.answer === 'oo' && !still && d <= 300 && now - r.at <= 30 * MIN) still = { ageMin: Math.round((now - r.at) / MIN), distM: Math.round(d) };
        if (seen.has(r.device)) continue;
        seen.add(r.device);
        if (r.answer === 'oo') { yesPhones++; newestAt = Math.max(newestAt ?? 0, r.at); }
      }
      const v = babahaBa({ now, place: p, sensors, reports: { yesPhones, newestAt }, rain: rainRows.get(site) || null });
      if (v.updatedAt) newest = Math.max(newest ?? 0, v.updatedAt);
      const reason = JSON.stringify(v.reason), stillJ = still ? JSON.stringify(still) : null;
      const old = await DB.prepare('SELECT answer, reason, eta_min, still_there FROM status WHERE place=?').bind(p.id).first();
      if (!old || old.answer !== v.answer || old.reason !== reason || old.eta_min !== v.etaMin || old.still_there !== stillJ) {
        await DB.prepare('INSERT OR REPLACE INTO status(place,answer,reason,eta_min,updated_at,still_there,changed_at) VALUES(?,?,?,?,?,?,?)')
          .bind(p.id, v.answer, reason, v.etaMin, v.updatedAt, stillJ, now).run();
        changed++;
      }
    }
  }
  await DB.prepare('INSERT OR REPLACE INTO heartbeat(id, ran_at, newest_at) VALUES(1,?,?)').bind(now, newest).run();

  // 4. on the hour: roll up the previous hour, apply retention
  if (new Date(now).getUTCMinutes() < 5) {
    const h1 = now - (now % 3600000), h0 = h1 - 3600000;
    const rows = (await DB.prepare("SELECT place, SUM(answer='oo') AS oo, SUM(answer='hindi') AS hindi, SUM(answer='di_sigurado') AS unsure FROM reports WHERE demo=0 AND at>=? AND at<? GROUP BY place").bind(h0, h1).all()).results;
    for (const r of rows) await DB.prepare('INSERT OR REPLACE INTO hourly_counts(place,hour,oo,hindi,unsure) VALUES(?,?,?,?,?)').bind(r.place, h0, r.oo, r.hindi, r.unsure).run();
    await DB.prepare('DELETE FROM reports WHERE at < ?').bind(now - 30 * 24 * 3600000).run();
    await DB.prepare('DELETE FROM readings WHERE at < ?').bind(now - 30 * 24 * 3600000).run();
  }
  return { places: count, changed };
}
