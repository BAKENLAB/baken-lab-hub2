export const config = { runtime: 'edge' };

const ALLOWED = new Set([
  '/', '/index.html', '/today.html', '/result.html', '/next.html',
  '/course.html', '/blood.html', '/jockey.html', '/value.html', '/bet.html'
]);

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
  }

  const ownOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (!origin || origin !== ownOrigin) return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 2048) return new Response('Payload too large', { status: 413, headers: { 'Cache-Control': 'no-store' } });

  let body;
  try { body = await request.json(); } catch { return new Response('Bad request', { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
  const path = String(body?.path || '').trim();
  if (!ALLOWED.has(path)) return new Response('Invalid path', { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const secret = process.env.LAB_HUB_UPSTREAM_SECRET;
  if (!secret || secret.length < 40) return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });

  try {
    const response = await fetch('https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/hub-pageview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lab-Hub-Gate': secret
      },
      body: JSON.stringify({ path }),
      redirect: 'error',
      cache: 'no-store'
    });
    if (!response.ok) return new Response('Tracking unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('Tracking unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
