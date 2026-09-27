import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleReport, handleUndo } from '../src/api.js';
import { envWith, turnstileOK, turnstileFail } from './fake-d1.js';
import { round3, haversineM } from '../src/geo.js';
import { safeEqual } from '../src/http.js';

const NOW = Date.UTC(2026, 8, 26, 9, 0);
const DEV = 'a1b2c3d4e5f6a7b8c9d0e1f2';
const body = (o = {}) => ({ place: 'tv:s:BW-H01', answer: 'oo', lat: 14.636954, lon: 121.061649, device: DEV, token: 'tok', demo: false, ...o });
const req = (b, method = 'POST', path = '/report') => new Request('https://api.test' + path, { method, headers: { 'content-type': 'application/json', origin: 'https://gregor-posadas.github.io' }, body: b ? JSON.stringify(b) : undefined });

test('geo helpers', () => {
  assert.equal(round3(14.636954), 14.637);
  assert.ok(Math.abs(haversineM(14.6, 121.0, 14.609, 121.0) - 1001) < 5);
});
test('report: stored with rounded position', async () => {
  const env = envWith();
  const r = await handleReport(req(body()), env, NOW, turnstileOK);
  assert.equal(r.status, 201);
  const row = await env.DB.prepare('SELECT * FROM reports').first();
  assert.equal(row.lat, 14.637); assert.equal(row.lon, 121.062); assert.equal(row.answer, 'oo'); assert.equal(row.demo, 0);
});
test('report: validation', async () => {
  const env = envWith();
  assert.equal((await handleReport(req(body({ answer: 'maybe' })), env, NOW, turnstileOK)).status, 400);
  assert.equal((await handleReport(req(body({ place: 'tv:s:NOPE' })), env, NOW, turnstileOK)).status, 400);
  assert.equal((await handleReport(req(body({ device: 'short' })), env, NOW, turnstileOK)).status, 400);
  assert.equal((await handleReport(req(body({ lat: 95 })), env, NOW, turnstileOK)).status, 400);
});
test('report: bot check failure -> 403, nothing stored', async () => {
  const env = envWith();
  assert.equal((await handleReport(req(body()), env, NOW, turnstileFail)).status, 403);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reports').first()).n, 0);
});
test('report: one per place per 10 min per phone', async () => {
  const env = envWith();
  assert.equal((await handleReport(req(body()), env, NOW, turnstileOK)).status, 201);
  assert.equal((await handleReport(req(body({ answer: 'hindi' })), env, NOW + 9 * 60000, turnstileOK)).status, 429);
  assert.equal((await handleReport(req(body({ place: 'tv:s:BW-H02' })), env, NOW + 60000, turnstileOK)).status, 201);
  assert.equal((await handleReport(req(body()), env, NOW + 10 * 60000, turnstileOK)).status, 201);
});
test('report: demo flag stored', async () => {
  const env = envWith();
  await handleReport(req(body({ demo: true })), env, NOW, turnstileOK);
  assert.equal((await env.DB.prepare('SELECT demo FROM reports').first()).demo, 1);
});
test('undo: same phone within 15 s deletes; later or other phone -> 410', async () => {
  const env = envWith();
  const { id } = await (await handleReport(req(body()), env, NOW, turnstileOK)).json();
  assert.equal((await handleUndo(req({ device: 'x'.repeat(24) }, 'POST', `/report/${id}/undo`), env, NOW + 5000, id)).status, 410);
  assert.equal((await handleUndo(req({ device: DEV }, 'POST', `/report/${id}/undo`), env, NOW + 16000, id)).status, 410);
  assert.equal((await handleUndo(req({ device: DEV }, 'POST', `/report/${id}/undo`), env, NOW + 5000, id)).status, 200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reports').first()).n, 0);
});
test('safeEqual: constant-time comparison', async () => {
  assert.equal(await safeEqual('k-h01', 'k-h01'), true);
  assert.equal(await safeEqual('k-h01', 'k-h02'), false);
  assert.equal(await safeEqual('k-h01', 'k-h010'), false);
  assert.equal(await safeEqual('', 'k-h01'), false);
});
test('ingest: device key required', async () => {
  const env = envWith();
  const mk = (key, b) => new Request('https://api.test/ingest', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await worker.fetch(mk('wrong', { sensor: 'BW-H01', depthCm: 3 }), env)).status, 401);
  assert.equal((await worker.fetch(mk('k-h01', { sensor: 'BW-H01', depthCm: 3 }), env)).status, 201);
  assert.equal((await env.DB.prepare('SELECT depth_cm FROM readings').first()).depth_cm, 3);
});
test('subscribe: alerts not enabled yet -> 501', async () => {
  const r = await worker.fetch(new Request('https://api.test/subscribe', { method: 'POST', body: '{}' }), envWith());
  assert.equal(r.status, 501);
});
test('CORS preflight and headers', async () => {
  const env = envWith();
  const pre = await worker.fetch(new Request('https://api.test/report', { method: 'OPTIONS', headers: { origin: 'https://gregor-posadas.github.io' } }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://gregor-posadas.github.io');
});
