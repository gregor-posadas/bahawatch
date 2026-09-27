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
test('scheduled handler runs the cron', async () => {
  const env = envWith();
  let ran = false;
  await worker.scheduled({ scheduledTime: NOW }, env, { waitUntil: (p) => { ran = true; return p; } });
  assert.ok(ran);
});
