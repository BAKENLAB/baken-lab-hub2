// Read-only HUB API proxy. Only logged-in visitors may use this endpoint.
import { isAuthenticated, isPublicFreeWindow } from '../auth-utils.js';

// Use Web Request/Response API to match middleware and login session parsing.
export const config = { runtime: 'edge' };

const allowed = new Set(['health','updates','lab_next','lab_jockey','lab_blood','lab_course','list','prediction','market','results']);
const head = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export default async function handler(request) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { ...head, Allow: 'GET' } });
  const secret = process.env.LAB_HUB_SESSION_SECRET;
  const password = process.env.LAB_HUB_ACCESS_PASSWORD;
  if (!isPublicFreeWindow() && (!secret || !password || !await isAuthenticated(request.headers.get('cookie'), secret + ':' + password))) {
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
    const response = await fetch(upstream.toString(), { headers, method: 'GET', redirect: 'follow' });
    const data = await response.text();
    const type = response.headers.get('content-type') || '';
    if (!type.toLowerCase().includes('application/json')) return new Response(JSON.stringify({ok:false,error:'upstream_non_json'}), { status: 502, headers: { ...head, 'Content-Type': 'application/json; charset=utf-8' } });
    // 'list' duplicates each complete saved prediction in predictions[] AND races[].prediction.
    // LOCAL's 17-item EYE audit contains tens of KB per race. Once many races are
    // frozen, the uncompressed JSON crosses the original 5 MB response guard.
    // The large audit is never rendered by TODAY / RESULT, so omit it ONLY from
    // this authenticated DISPLAY response. The official saved payload is untouched.
    const isDisplayCollection = response.ok && (action === 'list' || action === 'results');
    const sourceMax = isDisplayCollection ? 16000000 : 5000000;
    if (data.length > sourceMax) return new Response(JSON.stringify({ok:false,error:'response_too_large'}), { status: 502, headers: { ...head, 'Content-Type': 'application/json; charset=utf-8' } });
    let outbound = data;
    if (isDisplayCollection) {
      const body = JSON.parse(data);
      const displayPrediction = p => {
        if (!p || typeof p !== 'object') return p;
        const result = { ...p };
        if (p.payload && typeof p.payload === 'object') {
          const { audit, ...rest } = p.payload;
          // Preserve the sole audit flag used in the TODAY UI.
          result.payload = { ...rest, ...(audit && typeof audit === 'object'
            ? { audit: { partial_coverage: audit.partial_coverage === true } } : {}) };
        }
        if (p.integrity && typeof p.integrity === 'object') {
          const { saved, ...receipt } = p.integrity;
          result.integrity = receipt; // Omit redundant full-payload snapshot in view only.
        }
        return result;
      };
      if (action === 'list') {
        if (Array.isArray(body.predictions)) body.predictions = body.predictions.map(displayPrediction);
        if (Array.isArray(body.races)) body.races = body.races.map(r =>
          r && r.prediction ? { ...r, prediction: displayPrediction(r.prediction) } : r);
      } else if (Array.isArray(body.results)) {
        body.results = body.results.map(r =>
          r && r.prediction ? { ...r, prediction: displayPrediction(r.prediction) } : r);
      }
      outbound = JSON.stringify(body);
    }
    if (outbound.length > 5000000) return new Response(JSON.stringify({ok:false,error:'display_response_too_large'}), { status: 502, headers: { ...head, 'Content-Type': 'application/json; charset=utf-8' } });
    return new Response(outbound, { status: response.status, headers: { ...head, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (error) {
    // Log only the generic transport error, never URLs, cookies or secret headers.
    console.error('HUB_PROXY_FETCH_FAIL', String(error?.name || 'Error'), String(error?.message || 'unknown').slice(0, 180));
    return new Response(JSON.stringify({ ok: false, error: 'upstream_unavailable' }), {
      status: 502, headers: { ...head, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
