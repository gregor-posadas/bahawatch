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
test('the cache name moved to v2 so old shells are cleared', () => {
  assert.match(fs.readFileSync(__dirname + '/sw.js', 'utf8'), /bahawatch-v2/);
});
