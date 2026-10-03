// Independent LOCAL-only MCP bridge. SELECT-only claim lookup; no queue mutations or save client.
import { timingSafeEqual, createHash } from 'node:crypto';
import {createClaimResolver, sameClaim, ClaimError} from './claim-resolver.mjs';
export const UPSTREAM_URL = 'https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/lab-claimed-context';
export const PROTOCOL_VERSION = '2025-06-18';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEYS = ['job_id'];
export const TOOL = Object.freeze({
  name: 'lab_claimed_context',
  description: 'Get verified context for an already CLAIMED LOCAL job owned by this MCP server\'s authorized worker. Current run and claim capability are resolved server-side. Does not enqueue, claim, renew, rank, predict or save.',
  inputSchema: {type: 'object', additionalProperties: false, required: ['job_id'], properties: {
    job_id: {type: 'string', format: 'uuid'},
  }},
  annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true},
});
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const digest = x => createHash('sha256').update(x).digest();
const fail = code => Object.assign(new Error(code), { safeCode: code });
const respond = (status, data) => new Response(data === undefined ? null : JSON.stringify(data), {
  status, headers: {'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'},
});
const rpc = (id, result) => respond(200, {jsonrpc: '2.0', id, result});
const rpcError = (id, code, message) => respond(200, {jsonrpc: '2.0', id, error: {code, message}});
const toolError = (id, code) => rpc(id, {isError: true, content: [{type: 'text', text: code}]});
const upstreamCodes = new Set(['STALE_OR_EXPIRED_CLAIM','RACE_MISMATCH','PRE_RACE_DEADLINE',
  'RACE_NOT_PENDING','CONTEXT_CHANGED','CONTEXT_READ_FAILED','CONTEXT_NOT_UNIQUE','ACTIVE_PROTOCOL_REQUIRED',
  'OFFICIAL_FIELD_UNVERIFIED','FIELD_STATUS_CONFLICT','UNSAFE_HISTORY','INVALID_OUTPUT',
  'SUPPLEMENTATION_BUDGET_EXHAUSTED','SOURCE_TIMEOUT','HISTORY_LIMIT_EXCEEDED','CONTEXT_UNAVAILABLE']);
const sensitiveKey = /^(authorization|proxy.authorization|password|passwd|secret|service.?role(?:.?key)?|api.?key|bearer(?:.?token)?|claim.?token)$/i;
export function containsSensitive(value, secretValues, depth = 0) {
  if (depth > 40) return true;
  if (typeof value === 'string') return secretValues.some(s => UUID.test(s)
    ? value.toLowerCase().includes(s.toLowerCase()) : value.includes(s)) || /\bBearer\s+\S+/i.test(value);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([k,v]) => sensitiveKey.test(k) || containsSensitive(k, secretValues, depth + 1)
    || containsSensitive(v, secretValues, depth + 1));
}
export async function readJson(response, maxBytes, signal) {
  const reader = response.body?.getReader();
  if (!reader) throw fail('INVALID_JSON');
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, {once: true});
  let size = 0, text = ''; const decoder = new TextDecoder();
  try {
    if (signal.aborted) throw fail('TIMEOUT');
    while (true) {
      const part = await reader.read();
      if (signal.aborted) throw fail('TIMEOUT');
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw fail('BODY_TOO_LARGE');
      text += decoder.decode(part.value, {stream: true});
    }
    try { return JSON.parse(text + decoder.decode()); } catch { throw fail('INVALID_JSON'); }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function validContext(c) {
  return object(c) && c.race?.circuit === 'LOCAL' && c.protocol?.protocol_key === 'LOCAL_MAIN'
    && c.field_integrity_checked === true && c.stage === 'AWAITING_FULL_DEPTH_COMPARISON'
    && typeof c.protocol_version === 'string' && c.protocol.version === c.protocol_version
    && Array.isArray(c.runners) && c.runners.length > 0 && c.runners.length <= 20
    && Array.isArray(c.missing_conditions) && Array.isArray(c.supplementation_audit)
    && Object.keys(c).every(k => ['race','protocol','runners','missing_conditions','field_integrity_checked',
      'stage','protocol_version','supplementation_audit'].includes(k));
}
export function createLocalMcp({env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 30000, now = Date.now} = {}) {
  const token = env.LOCAL_MCP_BEARER_TOKEN, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof token !== 'string' || token.length < 32 || /\s/.test(token)
    || typeof serviceKey !== 'string' || !serviceKey || /\s/.test(serviceKey) || serviceKey === token
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || typeof fetchImpl !== 'function'
    || typeof now !== 'function' || Object.hasOwn(env, 'LOCAL_MCP_CLAIM_JSON'))
    throw new Error('LOCAL_MCP_CONFIGURATION_INVALID');
  const resolver = createClaimResolver({serviceKey,workerId:env.LOCAL_MCP_WORKER_ID,fetchImpl,readJson,now});
  const expected = digest(token);
  return async function handle(request) {
    // No HTTP mode and no x-forwarded-proto bypass, including local tests.
    const url = new URL(request.url);
    if (url.protocol !== 'https:') return respond(400, {error: 'HTTPS_REQUIRED'});
    const bearer = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!bearer || bearer.length > 4096 || !timingSafeEqual(digest(bearer), expected))
      return respond(401, {error: 'UNAUTHORIZED'});
    if (url.pathname !== '/mcp' || url.search) return respond(404, {error: 'NOT_FOUND'});
    // Browser origins require a separate reviewed allowlist; tools don't need CORS.
    if (request.headers.has('origin')) return respond(403, {error: 'ORIGIN_NOT_ALLOWED'});
    if (request.method !== 'POST') return respond(405, {error: 'POST_REQUIRED'});
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? ''))
      return respond(415, {error: 'JSON_REQUIRED'});
    const controller = new AbortController(); let timer, id = null, phase = 'request';
    const abort = () => controller.abort(); request.signal.addEventListener('abort', abort, {once: true});
    if (request.signal.aborted) abort();
    try {
      const work = (async () => {
        const message = await readJson(request, 8192, controller.signal);
        if (!object(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string')
          return rpcError(null, -32600, 'INVALID_REQUEST');
        const notification = !Object.hasOwn(message, 'id');
        if (!notification) {
          if (!(typeof message.id === 'string' || Number.isSafeInteger(message.id))
            || (typeof message.id === 'string' && message.id.length > 128)
            // Claim capabilities are UUIDs; never echo UUID-shaped IDs, even before lookup fails.
            || (typeof message.id === 'string' && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(message.id))
            || containsSensitive(message.id, [token, serviceKey])) return rpcError(null, -32600, 'INVALID_REQUEST');
          id = message.id;
        }
        if (notification) return respond(202); // No side effects for any notification.
        if (message.method === 'initialize') {
          if (!object(message.params) || typeof message.params.protocolVersion !== 'string')
            return rpcError(id, -32602, 'INVALID_PARAMS');
          return rpc(id, {protocolVersion: PROTOCOL_VERSION, capabilities: {tools: {}},
            serverInfo: {name: 'BAKEN LOCAL Claimed Context MCP', version: '0.1.0'}});
        }
        const version = request.headers.get('mcp-protocol-version');
        if (version && version !== PROTOCOL_VERSION) return respond(400, {error: 'UNSUPPORTED_PROTOCOL_VERSION'});
        if (message.method === 'ping') return rpc(id, {});
        if (message.method === 'tools/list') return rpc(id, {tools: [TOOL]});
        if (message.method !== 'tools/call') return rpcError(id, -32601, 'METHOD_NOT_FOUND');
        if (!object(message.params) || message.params.name !== TOOL.name) return rpcError(id, -32602, 'UNKNOWN_TOOL');
        const args = message.params.arguments;
        if (!object(args) || Object.keys(args).some(k => !KEYS.includes(k))) return toolError(id, 'INVALID_TOOL_INPUT');
        if (Object.hasOwn(args, 'circuit') && args.circuit !== 'LOCAL') return toolError(id, 'LOCAL_ONLY');
        if (typeof args.job_id !== 'string' || !UUID.test(args.job_id))
          return toolError(id, 'INVALID_TOOL_INPUT');
        if (controller.signal.aborted) throw fail('TIMEOUT');
        phase = 'upstream';
        const claim = await resolver.resolve(args.job_id, controller.signal);
        if (typeof id === 'string' && id.includes(claim.claim_token)) return rpcError(null, -32600, 'INVALID_REQUEST');
        const body = {run_id:claim.run_id,job_id:claim.job_id,claim_token:claim.claim_token};
        const upstream = await fetchImpl(UPSTREAM_URL, {method: 'POST', redirect: 'error',
          headers: {'content-type': 'application/json', authorization: `Bearer ${serviceKey}`, apikey: serviceKey},
          body: JSON.stringify(body), signal: controller.signal});
        if ([401,403].includes(upstream.status)) { upstream.body?.cancel().catch(() => {}); return toolError(id, 'UPSTREAM_AUTH_FAILED'); }
        if (upstream.status !== 200 && upstream.status !== 409) { upstream.body?.cancel().catch(() => {}); return toolError(id, 'UPSTREAM_UNAVAILABLE'); }
        const result = await readJson(upstream, 1024 * 1024, controller.signal);
        if (upstream.status === 409 || result.ok !== true)
          return toolError(id, upstreamCodes.has(result?.error) ? result.error : 'UPSTREAM_UNAVAILABLE');
        if (!validContext(result.context)) return toolError(id, 'UPSTREAM_INVALID_CONTEXT');
        if (containsSensitive(result.context, [token, serviceKey, claim.claim_token])) return toolError(id, 'UPSTREAM_UNSAFE_RESPONSE');
        if (['race_date','track','race_no','circuit'].some(k => result.context.race[k] !== claim[k]))
          return toolError(id, 'UPSTREAM_INVALID_CONTEXT');
        const fresh = await resolver.resolve(args.job_id, controller.signal);
        if (!sameClaim(claim,fresh)) return toolError(id, 'CLAIM_CHANGED');
        if (Date.parse(fresh.lease_until) <= now()) return toolError(id, 'CLAIM_UNAVAILABLE');
        // Preserve the upstream context; never rank, supplement, claim or save here.
        return rpc(id, {content: [{type: 'text', text: JSON.stringify(result.context)}], structuredContent: {context: result.context}});
      })();
      return await Promise.race([work, new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(phase === 'upstream'
          ? toolError(id, 'UPSTREAM_TIMEOUT') : respond(408, {error: 'REQUEST_TIMEOUT'})); }, timeoutMs);
      })]);
    } catch (error) {
      // No raw upstream text/error, credentials or headers leave this boundary; no logging.
      if (phase === 'upstream') return toolError(id, controller.signal.aborted ? 'UPSTREAM_TIMEOUT'
        : error instanceof ClaimError ? 'CLAIM_UNAVAILABLE' : 'UPSTREAM_UNAVAILABLE');
      return rpcError(null, -32700, error.safeCode === 'BODY_TOO_LARGE' ? 'REQUEST_TOO_LARGE' : 'INVALID_REQUEST');
    } finally { clearTimeout(timer); controller.abort(); request.signal.removeEventListener('abort', abort); }
  };
}
