// The service worker's offline fallbacks (Review Focus 4). Run: node --test --no-warnings sw.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), vm = require('vm');

function load(cached) {
  const handlers = {};
  const cache = { put: async () => {} };
  const ctx = {
    self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: { origin: 'https://bw.test' }, URL, Response,
    fetch: () => Promise.reject(new TypeError('offline')),
    caches: { open: async () => cache, keys: async () => [], match: async (req) => cached[typeof req === 'string' ? req : new URL(req.url).pathname.slice(1)] },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), ctx);
  return (url, mode) => new Promise((resolve) => handlers.fetch({ request: { method: 'GET', url, mode }, respondWith: (p) => resolve(p) }));
}
const HTML = { page: 'dashboard' };

test('offline, a page navigation falls back to the cached dashboard', async () => {
  const get = load({ 'bahawatch_dashboard.html': HTML });
  assert.equal(await get('https://bw.test/bahawatch_dashboard.html?source=pwa', 'navigate'), HTML);
});
test('offline, an uncached data file fails instead of returning the HTML page', async () => {
  const get = load({ 'bahawatch_dashboard.html': HTML });
  const r = await get('https://bw.test/data/xu.json', 'cors');
  assert.notEqual(r, HTML); assert.equal(r.type, 'error');
});
test('offline, a data file visited before comes from the cache', async () => {
  const XU = { site: 'xu' };
  const get = load({ 'bahawatch_dashboard.html': HTML, 'data/xu.json': XU });
  assert.equal(await get('https://bw.test/data/xu.json', 'cors'), XU);
});
test('the cache name moved to v4 so old shells are cleared', () => {
  assert.match(fs.readFileSync(__dirname + '/sw.js', 'utf8'), /bahawatch-v4/);
});
test('tiles and fonts from OpenFreeMap are left to the network: never cached, never answered', () => {
  const handlers = {}; let answered = false;
  const ctx = { self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: { origin: 'https://bw.test' }, URL, Response, fetch: () => Promise.reject(new Error('offline')), caches: {} };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), ctx);
  for (const url of ['https://tiles.openfreemap.org/planet/20250101_001001_pt/9/428/231.pbf', 'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf'])
    handlers.fetch({ request: { method: 'GET', url, mode: 'cors' }, respondWith: () => { answered = true; } });
  assert.equal(answered, false);
});
// After a push, a normal reload must show the new page: the browser keeps GitHub Pages' HTML for 10 minutes, so the
// page itself is always re-checked with the server (a tiny "not modified" when nothing changed). Seen 2026-09-29: the
// page loaded 39 s before the push went live stayed on the old version until the 10 minutes ran out.
test('a page navigation re-checks the server instead of taking the 10-minute browser copy; data files do not', async () => {
  const seen = [];
  const handlers = {};
  const ctx = { self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: { origin: 'https://bw.test' }, URL, Response,
    fetch: (req, o) => { seen.push({ url: typeof req === 'string' ? req : req.url, cache: o && o.cache }); return Promise.resolve({ status: 304 }); },
    caches: { open: async () => ({ put: async () => {} }), keys: async () => [], match: async () => null } };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), ctx);
  const go = (url, mode) => new Promise((resolve) => handlers.fetch({ request: { method: 'GET', url, mode, headers: { has: () => false } }, respondWith: (p) => resolve(p) }));
  await go('https://bw.test/bahawatch_dashboard.html#tv', 'navigate');
  await go('https://bw.test/data/xu.json', 'cors');
  assert.equal(seen[0].cache, 'no-cache');
  assert.equal(seen[1].cache, undefined);
});
