export function corsHeaders(env) {
  return { 'access-control-allow-origin': env.ALLOW_ORIGIN, 'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization', vary: 'origin' };
}
export function json(body, status = 200, env = {}, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...corsHeaders(env), ...extra } });
}

// Constant-time-ish string comparison for secrets on public endpoints. Hashes both
// sides with SHA-256 (fixed 32-byte output regardless of input length) then XORs
// every byte, so neither the early-exit-on-mismatch nor the input length itself
// is observable via timing. Works unchanged in Cloudflare Workers and Node 22
// (both expose the Web Crypto `crypto.subtle` global) — crypto.subtle.timingSafeEqual
// does not exist outside Node, so it is avoided.
export async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a ?? ''))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b ?? ''))),
  ]);
  const va = new Uint8Array(da), vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}
