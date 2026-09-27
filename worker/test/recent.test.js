import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleRecent } from '../src/api.js';
import { envWith } from './fake-d1.js';

const NOW = Date.UTC(2026, 8, 26, 9, 0);
const add = (env, o) => env.DB.prepare('INSERT INTO reports(at,place,lat,lon,answer,device,demo) VALUES(?,?,?,?,?,?,?)')
  .bind(o.at ?? NOW - 12 * 60000, o.place ?? 'tv:s:BW-H01', 14.637, 121.062, o.answer ?? 'oo', 'a'.repeat(24), o.demo ?? 0).run();

test('recent: this site, last hour, real reports only, newest first, no device ids', async () => {
  const env = envWith();
  await add(env, {}); await add(env, { answer: 'hindi', at: NOW - 2 * 60000 });
  await add(env, { demo: 1 }); await add(env, { at: NOW - 61 * 60000 }); await add(env, { place: 'diliman:s:BW-D01' });
  const r = await handleRecent(new Request('https://api.test/recent/tv'), env, NOW, 'tv');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /max-age=60/);
  const b = await r.json();
  assert.deepEqual(b.reports, [{ lat: 14.637, lon: 121.062, answer: 'hindi', ageMin: 2 }, { lat: 14.637, lon: 121.062, answer: 'oo', ageMin: 12 }]);
  assert.ok(!JSON.stringify(b).includes('aaaa'), 'device id leaked');
});
test('recent: unknown site -> 404', async () => {
  assert.equal((await handleRecent(new Request('https://api.test/recent/xx'), envWith(), NOW, 'xx')).status, 404);
});
test('recent: routed at GET /recent/<site>', async () => {
  assert.equal((await worker.fetch(new Request('https://api.test/recent/tv'), envWith())).status, 200);
});
