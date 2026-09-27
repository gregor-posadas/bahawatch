// Minimal D1 API over node:sqlite so Worker code runs unchanged in tests.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  // D1's free plan caps a Worker invocation at 50 queries, and every statement inside a batch()
  // counts individually. This counter lets tests assert runCron stays under that cap.
  const counter = { n: 0 };
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => { counter.n++; return { results: db.prepare(sql).all(...args) }; },
    first: async () => { counter.n++; return db.prepare(sql).get(...args) ?? null; },
    run: async () => { counter.n++; const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; },
    _db: db,
    get queryCount() { return counter.n; },
    resetQueryCount() { counter.n = 0; },
  };
}
export function envWith(extra = {}) {
  return { DB: fakeD1(), TURNSTILE_SECRET: 'test-secret', DEVICE_KEYS: JSON.stringify({ 'BW-H01': 'k-h01' }),
    ALLOW_ORIGIN: 'https://gregor-posadas.github.io', ...extra };
}
export const turnstileOK = async () => new Response(JSON.stringify({ success: true }));
export const turnstileFail = async () => new Response(JSON.stringify({ success: false }));
