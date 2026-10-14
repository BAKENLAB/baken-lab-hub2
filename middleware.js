import { next } from '@vercel/functions';
import { COOKIE_NAME, SESSION_TTL_SECONDS, SESSION_REFRESH_WINDOW_SECONDS, authenticatedSessionExpiresAt, createSession } from './auth-utils.js';

// Applied before cached/static content: fail closed if either secret is missing.
export default async function middleware(request) {
  const url = new URL(request.url);
  // OAuth consent is independently authenticated by Supabase Auth; keep plugin connection flows functional.
  if (url.pathname === '/login.html' || url.pathname === '/api/lab-login' || url.pathname.startsWith('/oauth/consent/')) return next();

  const password = process.env.LAB_HUB_ACCESS_PASSWORD;
  const secret = process.env.LAB_HUB_SESSION_SECRET;
  if (!password || !secret || secret.length < 32) {
    return new Response('LAB HUB is temporarily unavailable.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  // Session signatures are bound to the current password; changing it revokes all older sessions.
  const signingKey = secret + ':' + password;
  const expiresAt = await authenticatedSessionExpiresAt(request.headers.get('cookie'), signingKey);
  if (expiresAt !== null) {
    // Also upgrade valid 7-day cookies issued before this deployment, without another login.
    const response = next();
    if (expiresAt - Math.floor(Date.now() / 1000) < SESSION_REFRESH_WINDOW_SECONDS) {
      const token = await createSession(signingKey);
      response.headers.set('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`);
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  }

  if (url.pathname.startsWith('/api/')) {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const login = new URL('/login.html', request.url);
  login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}
