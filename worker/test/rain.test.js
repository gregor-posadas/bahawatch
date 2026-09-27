import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRain } from '../src/rain.js';

const NOW = Date.UTC(2026, 8, 26, 9, 20);
const loc = (p) => ({ hourly: { time: ['2026-09-26T08:00', '2026-09-26T09:00', '2026-09-26T10:00', '2026-09-26T11:00'], precipitation: p } });

test('two locations: now = max(hour ending before, current hour), next = following hour', async () => {
  let url = '';
  const f = async (u) => { url = u; return new Response(JSON.stringify([loc([1, 3, 9, 20]), loc([0, 0, 0, 0])])); };
  const m = await fetchRain([{ key: 'tv', lat: 14.64, lon: 121.06 }, { key: 'diliman', lat: 14.657, lon: 121.069 }], f, NOW);
  assert.match(url, /latitude=14\.64,14\.657/);
  assert.deepEqual(m.get('tv'), { nowMmH: 9, nextMmH: 20, at: NOW });
  assert.deepEqual(m.get('diliman'), { nowMmH: 0, nextMmH: 0, at: NOW });
});
test('one location: Open-Meteo returns an object, not an array', async () => {
  const f = async () => new Response(JSON.stringify(loc([0, 2, 4, 6])));
  const m = await fetchRain([{ key: 'tv', lat: 14.64, lon: 121.06 }], f, NOW);
  assert.equal(m.get('tv').nowMmH, 4);
});
test('network failure -> empty map, no throw', async () => {
  const m = await fetchRain([{ key: 'tv', lat: 14.64, lon: 121.06 }], async () => { throw new Error('down'); }, NOW);
  assert.equal(m.size, 0);
});
