import { json, safeEqual } from './http.js';
import { placeById, round3, PLACES, haversineM } from './geo.js';

const ANSWERS = new Set(['oo', 'hindi', 'di_sigurado']);
const DEVICE_RE = /^[a-f0-9]{24}$/;
const LIMIT_MS = 10 * 60000, UNDO_MS = 15000;
const MAX_FROM_PLACE_M = 2000;   // a report pinned farther than this from its place's centre is not about that place

async function turnstileOk(env, token, fetchImpl) {
  const form = new FormData(); form.append('secret', env.TURNSTILE_SECRET); form.append('response', token || '');
  try {
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    return (await r.json()).success === true;
  } catch { return false; }
}

export async function handleReport(req, env, now, fetchImpl = fetch) {
  let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, env); }
  const place = placeById(b.place);
  if (!place || !ANSWERS.has(b.answer) || !DEVICE_RE.test(b.device || '')
      || !Number.isFinite(b.lat) || !Number.isFinite(b.lon) || Math.abs(b.lat) > 90 || Math.abs(b.lon) > 180)
    return json({ error: 'invalid report' }, 400, env);
  if (haversineM(place.lat, place.lon, b.lat, b.lon) > MAX_FROM_PLACE_M) return json({ error: 'position too far from place' }, 400, env);
  if (!(await turnstileOk(env, b.token, fetchImpl))) return json({ error: 'bot check failed' }, 403, env);
  const demo = b.demo ? 1 : 0, lat = round3(b.lat), lon = round3(b.lon);
  // One row per phone per place per 10 min: the same answer again is a double tap or a re-send (429, shown as
  // "Thanks, recorded"); a different answer (e.g. Hindi to "Still there?" after its own Oo) replaces it - latest wins.
  const prev = await env.DB.prepare('SELECT id, answer FROM reports WHERE device=? AND place=? AND demo=? AND at>? ORDER BY at DESC LIMIT 1')
    .bind(b.device, b.place, demo, now - LIMIT_MS).first();
  if (prev && prev.answer === b.answer) return json({ error: 'already recorded' }, 429, env);
  if (prev) {
    await env.DB.prepare('UPDATE reports SET answer=?, at=?, lat=?, lon=? WHERE id=?').bind(b.answer, now, lat, lon, prev.id).run();
    return json({ id: prev.id }, 201, env);
  }
  const r = await env.DB.prepare('INSERT INTO reports(at,place,lat,lon,answer,device,demo) VALUES(?,?,?,?,?,?,?)')
    .bind(now, b.place, lat, lon, b.answer, b.device, demo).run();
  return json({ id: r.meta.last_row_id }, 201, env);
}

export async function handleUndo(req, env, now, id) {
  let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, env); }
  const r = await env.DB.prepare('DELETE FROM reports WHERE id=? AND device=? AND at>=?').bind(Number(id), String(b.device || ''), now - UNDO_MS).run();
  return r.meta.changes ? json({ ok: true }, 200, env) : json({ error: 'too late' }, 410, env);
}

export async function handleIngest(req, env, now) {
  let keys = {}; try { keys = JSON.parse(env.DEVICE_KEYS || '{}'); } catch {}
  let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, env); }
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  // Always hash-compare against something, even for an unknown sensor, so an unknown
  // sensor and a wrong key take the same code path and cost the same time (no early
  // exit on `!keys[b.sensor]` that would let a timing difference reveal which sensors
  // exist).
  const expected = typeof keys[b.sensor] === 'string' ? keys[b.sensor] : `\0no-such-sensor:${b.sensor}`;
  if (!(await safeEqual(expected, auth))) return json({ error: 'unauthorized' }, 401, env);
  const at = Number.isFinite(b.at) ? b.at : now;
  if (at > now + 5 * 60000 || !Number.isFinite(b.depthCm) || b.depthCm < 0 || b.depthCm > 500) return json({ error: 'invalid reading' }, 400, env);
  await env.DB.prepare('INSERT OR REPLACE INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind(b.sensor, at, b.depthCm).run();
  return json({ ok: true }, 201, env);
}

export async function handleSubscribe(req, env) {
  return json({ error: 'alerts not enabled yet' }, 501, env);
}

export async function handleStatus(req, env, now, placeId) {
  if (!placeById(placeId)) return json({ error: 'unknown place' }, 404, env);
  const s = await env.DB.prepare('SELECT * FROM status WHERE place=?').bind(placeId).first();
  const hb = await env.DB.prepare('SELECT ran_at, per_place FROM heartbeat WHERE id=1').first();
  // Per-place freshness: heartbeat.per_place is written every run (even when the verdict itself didn't
  // change), so this is that place's own newest input, not the max across every place at every site.
  let perPlace = {}; try { perPlace = hb?.per_place ? JSON.parse(hb.per_place) : {}; } catch {}
  const updatedAt = Object.prototype.hasOwnProperty.call(perPlace, placeId) ? perPlace[placeId] : null;
  // still_there stores the report's own timestamp and distance (not an age computed at cron time, which
  // would go stale between runs); the age shown here is always relative to serverNow.
  const stillThere = s?.still_there ? (() => { const st = JSON.parse(s.still_there); return { ageMin: Math.round((now - st.at) / 60000), distM: st.distM }; })() : null;
  const body = s
    ? { place: placeId, answer: s.answer, reason: JSON.parse(s.reason), etaMin: s.eta_min, updatedAt, checkedAt: hb?.ran_at ?? null, serverNow: now, stillThere }
    : { place: placeId, answer: 'nodata', reason: { key: 'stale', vars: {} }, etaMin: null, updatedAt: null, checkedAt: hb?.ran_at ?? null, serverNow: now, stillThere: null };
  return json(body, 200, env, { 'cache-control': 'public, max-age=60' });
}

export async function handleRecent(req, env, now, site) {
  if (!PLACES.sites[site]) return json({ error: 'unknown site' }, 404, env);
  const rows = (await env.DB.prepare('SELECT lat, lon, answer, at FROM reports WHERE demo=0 AND at>=? AND place LIKE ? ORDER BY at DESC LIMIT 200')
    .bind(now - 3600000, site + ':%').all()).results;
  const reports = rows.map((r) => ({ lat: r.lat, lon: r.lon, answer: r.answer, ageMin: Math.round((now - r.at) / 60000) }));
  return json({ serverNow: now, reports }, 200, env, { 'cache-control': 'public, max-age=60' });
}
