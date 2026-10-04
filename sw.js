// Offline shell: the page opens without signal and shows the last answer with its age (spec §5). Site files
// (data/<site>.json) are cached as they are fetched, so a campus visited once opens offline too.
const CACHE = 'bahawatch-v4';
const SHELL = ['./', 'index.html', 'bahawatch_dashboard.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'favicon-32.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;          // API calls, map tiles and fonts: network only
  // ignoreSearch: the PWA start_url launches as bahawatch_dashboard.html?source=pwa (so a relaunch can restore
  // the person's last view), but the shell was cached without that query string — match it either way.
  // Only a page navigation may fall back to the dashboard HTML; a data file that isn't cached must fail, so the
  // page shows "didn't load · Try again" instead of trying to read HTML as JSON.
  // Map tiles are read in byte ranges (206): those are never cached (the Cache API refuses partial responses).
  // A page load always re-checks the server (a tiny 304 when unchanged), so a new push shows on a normal reload instead
  // of after GitHub Pages' 10-minute browser copy runs out. Redirects stay manual, as a navigation's must.
  const net = e.request.mode === 'navigate' ? fetch(e.request.url, { cache: 'no-cache', redirect: 'manual', credentials: 'same-origin' }) : fetch(e.request);
  e.respondWith(net.then((r) => { if (r.status === 200 && !e.request.headers.has('range')) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })
      .then((m) => m || (e.request.mode === 'navigate' ? caches.match('bahawatch_dashboard.html') : Response.error()))));
});
