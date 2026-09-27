import { test } from 'node:test';
import assert from 'node:assert/strict';
import { babahaBa, RULE } from './verdict.js';

const NOW = Date.UTC(2026, 8, 26, 9, 0);
const MIN = 60000;
const place = (o = {}) => ({ noah5: false, noah25: false, noahMapped: true, ...o });
const sensor = (o = {}) => ({ id: 'S1', name: 'Maginhawa St', here: true, distM: 0, travelMin: null,
  depthCm: 0, rateCmPerHr: 0, at: NOW - 2 * MIN, ...o });
const rain = (now, next = 0, ageMin = 2) => ({ nowMmH: now, nextMmH: next, at: NOW - ageMin * MIN });
const run = (o) => babahaBa({ now: NOW, place: place(), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(0), ...o });

test('constants match the spec', () => {
  assert.deepEqual(RULE, { FRESH_MIN: 20, WET_CM: 5, TRACE_CM: 1, LOOKAHEAD_MIN: 60, REPORTS_YES: 3,
    REPORT_RADIUS_M: 1000, DRY_SENSOR_M: 500, RAIN_YELLOW: 7.5, RAIN_ORANGE: 15 });
});

test('no inputs at all -> nodata', () => {
  const v = babahaBa({ now: NOW, place: place(), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: null });
  assert.equal(v.answer, 'nodata'); assert.equal(v.reason.key, 'stale'); assert.equal(v.updatedAt, null);
});
test('freshness edge: 21 min old -> nodata, 19 min old -> evaluated', () => {
  assert.equal(run({ rain: rain(0, 0, 21) }).answer, 'nodata');
  assert.equal(run({ rain: rain(0, 0, 19) }).answer, 'hindi');
});
test('updatedAt is the newest input', () => {
  const v = run({ sensors: [sensor({ at: NOW - 7 * MIN })], rain: rain(0, 0, 3) });
  assert.equal(v.updatedAt, NOW - 3 * MIN);
});

test('sensor here 5.0 cm -> oo sensor_now; 4.9 cm steady -> baka sensor_trace', () => {
  const a = run({ sensors: [sensor({ depthCm: 5.0 })] });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'sensor_now'); assert.deepEqual(a.reason.vars, { name: 'Maginhawa St', cm: 5 });
  const b = run({ sensors: [sensor({ depthCm: 4.9 })] });
  assert.equal(b.answer, 'baka'); assert.equal(b.reason.key, 'sensor_trace');
});
test('sensor here rising: reaches 5 cm in exactly 60 min -> oo; in 63 min -> not oo', () => {
  const a = run({ sensors: [sensor({ depthCm: 3, rateCmPerHr: 2 })] });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'sensor_soon'); assert.equal(a.etaMin, 60);
  const b = run({ sensors: [sensor({ depthCm: 3, rateCmPerHr: 1.9 })] });
  assert.equal(b.answer, 'baka'); assert.equal(b.reason.key, 'sensor_trace');
});
test('connected sensor: wet with 40 min travel -> oo upstream; 61 min -> hindi', () => {
  const up = (travelMin) => sensor({ id: 'S2', name: 'Malingap St', here: false, distM: 800, travelMin, depthCm: 12 });
  const a = run({ sensors: [up(40)] });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'upstream'); assert.equal(a.etaMin, 40);
  assert.equal(run({ sensors: [up(61)] }).answer, 'hindi');
});
test('stale sensor (25 min) is ignored when rain is fresh', () => {
  const v = run({ sensors: [sensor({ depthCm: 30, at: NOW - 25 * MIN })] });
  assert.equal(v.answer, 'hindi');
});

test('reports: 3 phones -> oo; 2 phones -> baka reports_few', () => {
  const a = run({ reports: { yesPhones: 3, newestAt: NOW - MIN } });
  assert.equal(a.answer, 'oo'); assert.equal(a.reason.key, 'reports'); assert.deepEqual(a.reason.vars, { n: 3 });
  const b = run({ reports: { yesPhones: 2, newestAt: NOW - MIN } });
  assert.equal(b.answer, 'baka'); assert.equal(b.reason.key, 'reports_few');
});
test('reports vs dry sensor: dry+steady within 500 m -> baka; at 600 m or rising -> oo', () => {
  const rep = { yesPhones: 3, newestAt: NOW - MIN };
  const dry = (o) => sensor({ id: 'S3', here: false, distM: 400, depthCm: 0, rateCmPerHr: 0, ...o });
  assert.equal(run({ reports: rep, sensors: [dry()] }).reason.key, 'reports_vs_dry_sensor');
  assert.equal(run({ reports: rep, sensors: [dry({ distM: 600 })] }).answer, 'oo');
  assert.equal(run({ reports: rep, sensors: [dry({ rateCmPerHr: 0.5 })] }).answer, 'oo');
});

test('rain: yellow in 5/25-yr zone -> baka; 7.4 -> hindi; yellow in 100-yr-only area -> hindi', () => {
  const zone = place({ noah5: true });
  assert.equal(babahaBa({ now: NOW, place: zone, sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(7.5) }).reason.key, 'rain_flood_zone');
  assert.equal(babahaBa({ now: NOW, place: zone, sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(7.4) }).answer, 'hindi');
  assert.equal(run({ rain: rain(7.5) }).answer, 'hindi');
});
test('rain: next-hour value counts', () => {
  const v = babahaBa({ now: NOW, place: place({ noah25: true }), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(0, 8) });
  assert.equal(v.answer, 'baka'); assert.deepEqual(v.reason.vars, { mm: 8 });
});
test('rain: orange anywhere mapped -> baka rain_heavy; unmapped (Berkeley) -> hindi', () => {
  assert.equal(run({ rain: rain(15) }).reason.key, 'rain_heavy');
  const v = babahaBa({ now: NOW, place: place({ noahMapped: false }), sensors: [], reports: { yesPhones: 0, newestAt: null }, rain: rain(40) });
  assert.equal(v.answer, 'hindi');
});
test('stale rain alone does not trigger baka, but a fresh report keeps the answer alive', () => {
  const v = babahaBa({ now: NOW, place: place({ noah5: true }), sensors: [], reports: { yesPhones: 1, newestAt: NOW - MIN }, rain: rain(20, 0, 30) });
  assert.equal(v.answer, 'baka'); assert.equal(v.reason.key, 'reports_few');
});
test('nothing going on -> hindi clear', () => {
  const v = run({ sensors: [sensor()] });
  assert.equal(v.answer, 'hindi'); assert.equal(v.reason.key, 'clear'); assert.equal(v.etaMin, null);
});
test('I9: nothing going on and no fresh sensor input -> hindi clear_no_sensor (no sensor at all, or only a stale one)', () => {
  const a = run({ sensors: [] });
  assert.equal(a.answer, 'hindi'); assert.equal(a.reason.key, 'clear_no_sensor'); assert.deepEqual(a.reason.vars, {});
  const b = run({ sensors: [sensor({ at: NOW - 25 * MIN })] });
  assert.equal(b.answer, 'hindi'); assert.equal(b.reason.key, 'clear_no_sensor');
  const c = run({ sensors: [sensor({ here: false, distM: 700, travelMin: null })] });
  assert.equal(c.answer, 'hindi'); assert.equal(c.reason.key, 'clear');
});
test('eta rounds to 5 min, never below 5', () => {
  assert.equal(run({ sensors: [sensor({ depthCm: 4.9, rateCmPerHr: 60 })] }).etaMin, 5);
  assert.equal(run({ sensors: [sensor({ depthCm: 1, rateCmPerHr: 10 })] }).etaMin, 25);
});
