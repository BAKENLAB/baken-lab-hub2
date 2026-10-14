import { COOKIE_NAME, SESSION_TTL_SECONDS, createSession, passwordMatches, safeDestination } from '../auth-utils.js';

export const config = { runtime: 'edge' };
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
// Best-effort per-instance throttling for the shared beta access code.
// Edge instances can recycle; this does not substitute for durable WAF throttling.
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;


export default async function handler(request) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'POST' } });
  const expected = process.env.LAB_HUB_ACCESS_PASSWORD;
  const secret = process.env.LAB_HUB_SESSION_SECRET;
  if (!expected || !secret || secret.length < 32) return new Response('Authentication unavailable', { status: 503, headers });

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response('Forbidden', { status: 403, headers });
  if (Number(request.headers.get('content-length') || 0) > 4096) return new Response('Request too large', { status: 413, headers });
  let form;
  try { form = await request.formData(); } catch { return new Response('Bad request', { status: 400, headers }); }
  const destination = safeDestination(form.get('next'));
  const ip = String(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 80);
  const now = Date.now();
  if (attempts.size > 3000) attempts.clear();
  let state = attempts.get(ip);
  if (state && state.until <= now) { attempts.delete(ip); state = undefined; }
  if (state && state.count >= MAX_FAILURES) return new Response('Too many attempts. Wait 10 minutes.', {
    status: 429, headers: { ...headers, 'Retry-After': String(Math.ceil((state.until - now) / 1000)) }
  });
  const correct = await passwordMatches(form.get('password'), expected);
  if (!correct) {
    attempts.set(ip, { count: (state?.count || 0) + 1, until: state?.until || now + WINDOW_MS });
    return Response.redirect(new URL('/login.html?error=1&next=' + encodeURIComponent(destination), request.url), 303);
  }
  attempts.delete(ip);

  const token = await createSession(secret + ':' + expected);
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      Location: destination,
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`,
    },
  });
}
