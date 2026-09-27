import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { runCron } from '../src/cron.js';
import { handleStatus } from '../src/api.js';
import { envWith } from './fake-d1.js';
import { PLACES } from '../src/geo.js';

const NOW = Date.UTC(2026, 8, 26, 9, 5);
const P = PLACES.sites.tv.find((p) => p.kind === 'sensor' && p.sensor === 'BW-H01');
const rainOK = (mm = 0) => async () => new Response(JSON.stringify(
  Object.keys(PLACES.sites).map(() => ({ hourly: { time: ['2026-09-26T08:00', '2026-09-26T09:00', '2026-09-26T10:00', '2026-09-26T11:00'], precipitation: [mm, mm, mm, mm] } }))));
const rainDown = async () => { throw new Error('down'); };
const addReport = (env, o) => env.DB.prepare('INSERT INTO reports(at,place,lat,lon,answer,device,demo) VALUES(?,?,?,?,?,?,?)')
  .bind(o.at ?? NOW - 60000, o.place ?? P.id, o.lat ?? P.lat, o.lon ?? P.lon, o.answer ?? 'oo', o.device, o.demo ?? 0).run();
const status = async (env, now = NOW) => (await handleStatus(new Request('https://api.test/status/x'), env, now, P.id)).json();

test('3 phones say oo within 1 km -> oo; demo reports and repeats from one phone do not count', async () => {
  const env = envWith();
  await addReport(env, { device: 'a'.repeat(24) }); await addReport(env, { device: 'a'.repeat(24), at: NOW - 30000 });
  await addReport(env, { device: 'b'.repeat(24) }); await addReport(env, { device: 'c'.repeat(24), demo: 1 });
  await runCron(env, NOW, rainOK());
  assert.equal((await status(env)).answer, 'baka');          // 2 real phones
  await addReport(env, { device: 'd'.repeat(24) });
  await runCron(env, NOW + 300000, rainOK());
  const s = await status(env, NOW + 300000);
  assert.equal(s.answer, 'oo'); assert.deepEqual(s.reason, { key: 'reports', vars: { n: 3 } });
});
test("a phone's latest report wins: 'hindi' to Still there? stops it counting", async () => {
  const env = envWith();
  for (const d of ['a', 'b', 'c']) await addReport(env, { device: d.repeat(24), at: NOW - 600000 });
  await addReport(env, { device: 'c'.repeat(24), answer: 'hindi', at: NOW - 60000 });
  await runCron(env, NOW, rainOK());
  assert.equal((await status(env)).answer, 'baka');
});
test('reports farther than 1 km or older than 60 min are ignored', async () => {
  const env = envWith();
  for (const d of ['a', 'b']) await addReport(env, { device: d.repeat(24) });
  await addReport(env, { device: 'c'.repeat(24), lat: P.lat + 0.02 });
  await addReport(env, { device: 'e'.repeat(24), at: NOW - 61 * 60000 });
  await runCron(env, NOW, rainOK());
  assert.equal((await status(env)).reason.key, 'reports_few');
});
test('status is written only when it changes; heartbeat every run', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  const a = await env.DB.prepare('SELECT changed_at FROM status WHERE place=?').bind(P.id).first();
  await runCron(env, NOW + 300000, rainOK());
  const b = await env.DB.prepare('SELECT changed_at FROM status WHERE place=?').bind(P.id).first();
  assert.equal(a.changed_at, b.changed_at);
  const hb = await env.DB.prepare('SELECT ran_at FROM heartbeat').first();
  assert.equal(hb.ran_at, NOW + 300000);
});
test('Open-Meteo down: last stored rain kept; answer turns nodata only after 20 min with no fresh input', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  await runCron(env, NOW + 10 * 60000, rainDown);
  assert.equal((await status(env, NOW + 10 * 60000)).answer, 'hindi');
  await runCron(env, NOW + 25 * 60000, rainDown);
  assert.equal((await status(env, NOW + 25 * 60000)).answer, 'nodata');
  assert.equal((await env.DB.prepare('SELECT ran_at FROM heartbeat').first()).ran_at, NOW + 25 * 60000);
});
test('a fresh report keeps a place evaluated while rain is down', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  await addReport(env, { device: 'a'.repeat(24), at: NOW + 24 * 60000 });
  await runCron(env, NOW + 25 * 60000, rainDown);
  assert.equal((await status(env, NOW + 25 * 60000)).reason.key, 'reports_few');
});
test('ingested sensor reading drives the answer', async () => {
  const env = envWith();
  await env.DB.prepare('INSERT INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind('BW-H01', NOW - 60000, 12).run();
  await runCron(env, NOW, rainOK());
  const s = await status(env);
  assert.equal(s.answer, 'oo'); assert.equal(s.reason.key, 'sensor_now');
});
test('stillThere: latest oo report within 300 m and 30 min', async () => {
  const env = envWith();
  await addReport(env, { device: 'a'.repeat(24), at: NOW - 12 * 60000, lat: P.lat + 0.001 });
  await runCron(env, NOW, rainOK());
  const s = await status(env);
  assert.equal(s.stillThere.ageMin, 12); assert.ok(s.stillThere.distM > 50 && s.stillThere.distM < 300);
});
test('status carries serverNow and checkedAt; unknown place 404; cache header', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  const r = await handleStatus(new Request('https://api.test/status/x'), env, NOW + 1000, P.id);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=60');
  const s = await r.json();
  assert.equal(s.serverNow, NOW + 1000); assert.equal(s.checkedAt, NOW);
  assert.equal((await handleStatus(new Request('https://api.test/status/x'), env, NOW, 'tv:s:NOPE')).status, 404);
});
test('on the hour: hourly counts rolled up, reports older than 30 days deleted', async () => {
  const env = envWith();
  const HOUR = Date.UTC(2026, 8, 26, 10, 0);
  await addReport(env, { device: 'a'.repeat(24), at: HOUR - 20 * 60000 });
  await addReport(env, { device: 'b'.repeat(24), at: HOUR - 31 * 24 * 3600000 });
  await runCron(env, HOUR, rainOK());
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reports').first()).n, 1);
  const hc = await env.DB.prepare('SELECT * FROM hourly_counts WHERE place=?').bind(P.id).first();
  assert.equal(hc.oo, 1);
});
test('scheduled handler runs the cron to completion, with no live network call', async () => {
  const env = envWith();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(
    Object.keys(PLACES.sites).map(() => ({ hourly: { time: ['2026-09-26T08:00', '2026-09-26T09:00', '2026-09-26T10:00', '2026-09-26T11:00'], precipitation: [0, 0, 0, 0] } }))));
  try {
    let waited;
    await worker.scheduled({ scheduledTime: NOW }, env, { waitUntil: (p) => { waited = p; } });
    await waited;
    const hb = await env.DB.prepare('SELECT ran_at FROM heartbeat').first();
    assert.equal(hb.ran_at, NOW);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test('readings are kept past 30 days; only raw reports are retention-deleted', async () => {
  const env = envWith();
  const HOUR = Date.UTC(2026, 8, 26, 10, 0);
  await env.DB.prepare('INSERT INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind('BW-H01', HOUR - 31 * 24 * 3600000, 2).run();
  await runCron(env, HOUR, rainOK());
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM readings').first()).n, 1);
});
test('per-place freshness: a place with no fresh input of its own stays nodata even when another place just got fresh reports', async () => {
  const env = envWith();
  const Q = PLACES.sites.berkeley.find((pl) => pl.kind === 'sensor');
  for (const d of ['a', 'b', 'c']) await addReport(env, { device: d.repeat(24) });
  await runCron(env, NOW, rainDown);
  const sp = await status(env, NOW);
  assert.equal(sp.answer, 'oo');
  const sq = await (await handleStatus(new Request('https://api.test/status/x'), env, NOW, Q.id)).json();
  assert.equal(sq.answer, 'nodata');
  assert.equal(sq.updatedAt, null);
});
test('a still-there report does not force a status rewrite as time passes (age is computed at read time)', async () => {
  const env = envWith();
  await addReport(env, { device: 'a'.repeat(24), at: NOW - 5 * 60000, lat: P.lat + 0.001 });
  await runCron(env, NOW, rainOK());
  const a = await env.DB.prepare('SELECT changed_at, still_there FROM status WHERE place=?').bind(P.id).first();
  await runCron(env, NOW + 300000, rainOK());
  const b = await env.DB.prepare('SELECT changed_at, still_there FROM status WHERE place=?').bind(P.id).first();
  assert.equal(a.changed_at, b.changed_at);
  assert.equal(a.still_there, b.still_there);
  const s1 = await status(env, NOW), s2 = await status(env, NOW + 300000);
  assert.equal(s1.stillThere.ageMin, 5); assert.equal(s2.stillThere.ageMin, 10);
});
test('D1 free-plan query budget: first run (every place changes) stays at or under 50 queries', async () => {
  const env = envWith();
  env.DB.resetQueryCount();
  await runCron(env, NOW, rainOK());
  assert.ok(env.DB.queryCount <= 50, `used ${env.DB.queryCount} queries`);
});
test('D1 free-plan query budget: steady run (nothing changes) stays at or under 50 queries', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  env.DB.resetQueryCount();
  await runCron(env, NOW + 300000, rainOK());
  assert.ok(env.DB.queryCount <= 50, `used ${env.DB.queryCount} queries`);
});
test('D1 free-plan query budget: on-the-hour run (rollup + retention) stays at or under 50 queries', async () => {
  const env = envWith();
  const HOUR = Date.UTC(2026, 8, 26, 10, 0);
  await addReport(env, { device: 'a'.repeat(24), at: HOUR - 20 * 60000 });
  env.DB.resetQueryCount();
  await runCron(env, HOUR, rainOK());
  assert.ok(env.DB.queryCount <= 50, `used ${env.DB.queryCount} queries`);
});

// ---- final-review fix wave ----
test('C1: the cron readings query uses the readings_at index (SEARCH, not a full SCAN)', async () => {
  const { READINGS_SQL } = await import('../src/cron.js');
  const env = envWith();
  const plan = env.DB._db.prepare('EXPLAIN QUERY PLAN ' + READINGS_SQL).all(NOW).map((r) => r.detail).join(' | ');
  assert.match(plan, /SEARCH readings USING (COVERING )?INDEX readings_at/, plan);
  assert.doesNotMatch(plan, /SCAN readings(?! USING)/, plan);
});
test("I1: Still there? is only offered from phones whose latest report is 'oo'", async () => {
  const env = envWith();
  await addReport(env, { device: 'a'.repeat(24), at: NOW - 12 * 60000, lat: P.lat + 0.001 });
  await addReport(env, { device: 'a'.repeat(24), at: NOW - 3 * 60000, lat: P.lat + 0.001, answer: 'hindi' });
  await runCron(env, NOW, rainOK());
  assert.equal((await status(env)).stillThere, null);
  await addReport(env, { device: 'b'.repeat(24), at: NOW - 2 * 60000, lat: P.lat + 0.001 });
  await runCron(env, NOW + 60000, rainOK());
  assert.equal((await status(env, NOW + 60000)).stillThere.ageMin, 3);
});
test('I4: the hourly job blanks device ids on reports older than 61 min, and stays in the query budget', async () => {
  const env = envWith();
  const HOUR = Date.UTC(2026, 8, 26, 10, 0);
  await addReport(env, { device: 'a'.repeat(24), at: HOUR - 62 * 60000 });
  await addReport(env, { device: 'b'.repeat(24), at: HOUR - 30 * 60000 });
  env.DB.resetQueryCount();
  await runCron(env, HOUR, rainOK());
  assert.ok(env.DB.queryCount <= 50, `used ${env.DB.queryCount} queries`);
  const rows = (await env.DB.prepare('SELECT device FROM reports ORDER BY at').all()).results.map((r) => r.device);
  assert.deepEqual(rows, ['', 'b'.repeat(24)]);
  // not on the hour: device ids are left alone
  const env2 = envWith();
  await addReport(env2, { device: 'a'.repeat(24), at: NOW - 62 * 60000 });
  await runCron(env2, NOW, rainOK());
  assert.equal((await env2.DB.prepare('SELECT device FROM reports').first()).device, 'a'.repeat(24));
});
test('I7: Open-Meteo nulls for a site leave its last stored rain in place (no fake 0 mm/h)', async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK(20));
  const nullRain = async () => new Response(JSON.stringify(
    Object.keys(PLACES.sites).map(() => ({ hourly: { time: ['2026-09-26T08:00', '2026-09-26T09:00', '2026-09-26T10:00', '2026-09-26T11:00'], precipitation: [null, null, null, null] } }))));
  await runCron(env, NOW + 5 * 60000, nullRain);
  const r = await env.DB.prepare('SELECT now_mm, at FROM rain WHERE site=?').bind('tv').first();
  assert.equal(r.now_mm, 20); assert.equal(r.at, NOW);
});
test('m4: a hung Open-Meteo request times out; the run still completes and writes the heartbeat', async () => {
  const env = envWith();
  const hung = () => new Promise(() => {});
  await runCron({ ...env, RAIN_TIMEOUT_MS: 50 }, NOW, hung);
  assert.equal((await env.DB.prepare('SELECT ran_at FROM heartbeat').first()).ran_at, NOW);
});
test("I9: a place with no sensor reporting says 'clear_no_sensor', not 'clear'; with a fresh reading, 'clear'", async () => {
  const env = envWith();
  await runCron(env, NOW, rainOK());
  const a = await status(env);
  assert.equal(a.answer, 'hindi'); assert.equal(a.reason.key, 'clear_no_sensor');
  await env.DB.prepare('INSERT INTO readings(sensor,at,depth_cm) VALUES(?,?,?)').bind('BW-H01', NOW + 4 * 60000, 0).run();
  await runCron(env, NOW + 5 * 60000, rainOK());
  const b = await status(env, NOW + 5 * 60000);
  assert.equal(b.answer, 'hindi'); assert.equal(b.reason.key, 'clear');
});
