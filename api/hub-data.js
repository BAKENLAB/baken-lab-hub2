// Read-only HUB API proxy. Only logged-in visitors may use this endpoint.
import { isAuthenticated } from '../auth-utils.js';

// Use Web Request/Response API to match middleware and login session parsing.
export const config = { runtime: 'edge' };

const allowed = new Set(['health','updates','lab_next','lab_jockey','lab_blood','lab_course','list','prediction','market','results']);
const head = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export default async function handler(request) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { ...head, Allow: 'GET' } });
  const secret = process.env.LAB_HUB_SESSION_SECRET;
  const password = process.env.LAB_HUB_ACCESS_PASSWORD;
  if (!secret || !password || !await isAuthenticated(request.headers.get('cookie'), secret + ':' + password)) {
    return new Response('Unauthorized', { status: 401, headers: head });
  }
  const input = new URL(request.url);
  const action = input.searchParams.get('action') || 'health';
  if (!allowed.has(action) || input.search.length > 2048) return new Response('Bad request', { status: 400, headers: head });
  const upstream = new URL('https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/hub2-api');
  upstream.search = input.search;
  const upstreamSecret = process.env.LAB_HUB_UPSTREAM_SECRET;
  if (!upstreamSecret || upstreamSecret.length < 40) return new Response('Proxy unavailable', { status: 503, headers: head });
  const headers = new Headers({ Accept: 'application/json', 'X-Lab-Hub-Gate': upstreamSecret });
  try {
    const response = await fetch(upstream, { headers, method: 'GET', cache: 'no-store', redirect: 'error' });
    const data = await response.text();
    if (data.length > 5000000) return new Response('Response too large', { status: 502, headers: head });
    const type = response.headers.get('content-type') || '';
    if (!type.toLowerCase().includes('application/json')) return new Response('Upstream error', { status: 502, headers: head });
    return new Response(data, { status: response.status, headers: { ...head, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch {
    return new Response('Upstream unavailable', { status: 502, headers: head });
  }
}
