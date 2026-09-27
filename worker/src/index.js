import { corsHeaders, json } from './http.js';
import { handleReport, handleUndo, handleIngest, handleSubscribe, handleStatus, handleRecent } from './api.js';
import { runCron } from './cron.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url), now = Date.now();
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
    if (req.method === 'POST' && url.pathname === '/report') return handleReport(req, env, now);
    const undo = url.pathname.match(/^\/report\/(\d+)\/undo$/);
    if (req.method === 'POST' && undo) return handleUndo(req, env, now, undo[1]);
    if (req.method === 'POST' && url.pathname === '/ingest') return handleIngest(req, env, now);
    if (req.method === 'POST' && url.pathname === '/subscribe') return handleSubscribe(req, env);
    const st = url.pathname.match(/^\/status\/(.+)$/);
    if (req.method === 'GET' && st) return handleStatus(req, env, now, decodeURIComponent(st[1]));
    const rc = url.pathname.match(/^\/recent\/([a-z]+)$/);
    if (req.method === 'GET' && rc) return handleRecent(req, env, now, rc[1]);
    return json({ error: 'not found' }, 404, env);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(runCron(env, event.scheduledTime ?? Date.now())); },
};
