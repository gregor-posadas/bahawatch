export function corsHeaders(env) {
  return { 'access-control-allow-origin': env.ALLOW_ORIGIN, 'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization', vary: 'origin' };
}
export function json(body, status = 200, env = {}, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...corsHeaders(env), ...extra } });
}
