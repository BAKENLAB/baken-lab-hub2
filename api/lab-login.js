import { COOKIE_NAME, SESSION_TTL_SECONDS, createSession, passwordMatches, safeDestination } from '../auth-utils.js';

export const config = { runtime: 'edge' };
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

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
  const correct = await passwordMatches(form.get('password'), expected);
  if (!correct) return Response.redirect(new URL('/login.html?error=1&next=' + encodeURIComponent(destination), request.url), 303);

  const token = await createSession(secret);
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      Location: destination,
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`,
    },
  });
}
