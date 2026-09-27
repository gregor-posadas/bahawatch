// Minimal D1 API over node:sqlite so Worker code runs unchanged in tests.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; }, _db: db };
}
export function envWith(extra = {}) {
  return { DB: fakeD1(), TURNSTILE_SECRET: 'test-secret', DEVICE_KEYS: JSON.stringify({ 'BW-H01': 'k-h01' }),
    ALLOW_ORIGIN: 'https://gregor-posadas.github.io', ...extra };
}
export const turnstileOK = async () => new Response(JSON.stringify({ success: true }));
export const turnstileFail = async () => new Response(JSON.stringify({ success: false }));
