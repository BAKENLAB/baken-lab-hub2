import { next } from '@vercel/functions';
import { isAuthenticated } from './auth-utils.js';

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
  // Password rotation invalidates all existing viewer sessions.
  if (await isAuthenticated(request.headers.get('cookie'), secret + ':' + password)) return next();

  if (url.pathname.startsWith('/api/')) {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const login = new URL('/login.html', request.url);
  login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}
