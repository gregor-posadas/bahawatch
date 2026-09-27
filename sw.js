// Offline shell: the page opens without signal and shows the last answer with its age (spec §5).
const CACHE = 'bahawatch-v1';
const SHELL = ['./', 'index.html', 'bahawatch_dashboard.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;          // API calls: network only
  // ignoreSearch: the PWA start_url launches as bahawatch_dashboard.html?source=pwa (so a relaunch can restore
  // the person's last view), but the shell was cached without that query string — match it either way.
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match('bahawatch_dashboard.html'))));
});
