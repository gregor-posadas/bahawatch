// Static server for the page tests: the repo over http://127.0.0.1:<port>/ with gzip, the way GitHub Pages serves it.
// The page fetches data/<site>.json, which file:// URLs can't do.  node tools/test_server.js  (BW_PORT, default 8765)
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
function start(port = Number(process.env.BW_PORT || 8765)) {
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    // BW_TEST_BASEMAP=offline: the basemap styles point at tiles.openfreemap.org, which the test machine can't reach, so
    // they are served as the offline test style — unless a test asks for the real one with ?real
    if (process.env.BW_TEST_BASEMAP === 'offline' && /^shared\/basemap-style(-dark)?\.json$/.test(rel) && !url.searchParams.has('real'))
      rel = 'tests/fixtures/basemap-offline.json';
    const f = path.resolve(ROOT, rel);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    const body = fs.readFileSync(f), head = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); res.end(zlib.gzipSync(body)); }
    else { res.writeHead(200, head); res.end(body); }
  });
  return new Promise((resolve) => srv.listen(port, '127.0.0.1', () => resolve(srv)));
}
if (require.main === module) start().then(() => console.log('serving', ROOT));
module.exports = { start };
