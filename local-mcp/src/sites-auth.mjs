import {createLocalMcp, containsSensitive, readJson} from './mcp.mjs';

// Sites dispatch authenticates OAuth and provides this trusted site-scoped ID.
// This helper is ONLY for requests delivered by Sites hosting, never an arbitrary host.
export const SITES_USER_HEADER = 'oai-authenticated-user-id';
const reply = (status,error) => Response.json({error},{status,headers:{
  'cache-control':'no-store','x-content-type-options':'nosniff'}});
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 256
  && !/[\s,\x00-\x1f\x7f]/.test(id);
export function hasSitesHostedUser(request) {
  // OAuth verification belongs to Sites dispatch; do not parse/reverify its token here.
  return validId(request.headers.get(SITES_USER_HEADER));
}
function allowedUsers(env) {
  const raw = env.LOCAL_MCP_ALLOWED_SITES_USER_IDS;
  if (typeof raw !== 'string' || raw.length > 8192) throw new Error();
  const ids = JSON.parse(raw);
  if (!Array.isArray(ids) || !ids.length || ids.length > 64 || ids.some(id=>!validId(id))) throw new Error();
  return new Set(ids);
}
function requestSecrets(request,env) {
  const values = Object.entries(env).filter(([k,v])=> /secret|token|password|(?:^|_)key$/i.test(k)
    && typeof v === 'string' && v.length > 0).map(([,v])=>v);
  for (const name of ['authorization','oai-sites-authorization']) {
    const raw = request.headers.get(name);
    if (raw) { values.push(raw); const bearer = /^Bearer\s+(.+)$/i.exec(raw)?.[1]; if(bearer)values.push(bearer); }
  }
  return values;
}

/**
 * verifyHostingRequest(request, {signal}) -> true ONLY for an authenticated,
 * current user request whose identity headers were stripped/injected by Sites.
 * This is our dependency-injection contract, NOT a documented Sites API.
 * The Sites-only worker binds hasSitesHostedUser to consume dispatch's trusted ID.
 * Other hosts must supply their own verified boundary; no JWT guess or bearer fallback.
 */
export function createSitesAuthAdapter({env = process.env, verifyHostingRequest,
  fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 30000} = {}) {
  let users, core;
  try {
    if (typeof verifyHostingRequest !== 'function' || !Number.isInteger(timeoutMs)
      || timeoutMs < 1 || timeoutMs > 30000) throw new Error();
    users = allowedUsers(env);
    core = createLocalMcp({env,fetchImpl,now,timeoutMs});
  } catch {
    return async () => reply(503,'LOCAL_MCP_UNAVAILABLE');
  }
  return async request => {
    let controller, timer;
    try {
      const url = new URL(request.url);
      if (url.protocol !== 'https:') return reply(400,'HTTPS_REQUIRED');
      if (url.pathname !== '/mcp' || url.search) return reply(404,'NOT_FOUND');
      if (request.method !== 'POST') return reply(405,'POST_REQUIRED');
      if (request.headers.has('origin')) return reply(403,'ORIGIN_NOT_ALLOWED');
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??''))
        return reply(415,'JSON_REQUIRED');
      controller = new AbortController();
      const abort = () => controller.abort();
      request.signal.addEventListener('abort',abort,{once:true});
      if(request.signal.aborted)controller.abort();
      const secrets = requestSecrets(request,env);
      const authenticate = async () => {
        if(controller.signal.aborted)return false;
        try { return await verifyHostingRequest(request,{signal:controller.signal}) === true; }
        catch { return false; }
      };
      const work = (async () => {
        if(!await authenticate())return reply(401,'UNAUTHORIZED');
        const userId = request.headers.get(SITES_USER_HEADER);
        if(!validId(userId))return reply(401,'UNAUTHORIZED');
        if(!users.has(userId))return reply(403,'FORBIDDEN');
        let message;
        try { message = await readJson(request,8192,controller.signal); }
        catch { return reply(400,'INVALID_REQUEST'); }
        // Never echo OAuth credentials through a JSON-RPC id or other input.
        if(containsSensitive(message,secrets))return reply(400,'INVALID_REQUEST');
        const headers = {'content-type':'application/json',authorization:`Bearer ${env.LOCAL_MCP_BEARER_TOKEN}`};
        const version = request.headers.get('mcp-protocol-version');
        if(version)headers['mcp-protocol-version']=version;
        // Copy neither OAuth/identity headers nor any caller-selected auth fields.
        const result = await core(new Request('https://local-mcp.internal/mcp',{
          method:'POST',headers,body:JSON.stringify(message),signal:controller.signal}));
        if(!await authenticate())return reply(401,'UNAUTHORIZED');
        if(result.status===202)return result;
        let data;
        try { data = await readJson(result,3*1024*1024,controller.signal); }
        catch { return reply(502,'LOCAL_MCP_UNAVAILABLE'); }
        if(containsSensitive(data,secrets))return reply(502,'UNSAFE_RESPONSE');
        return Response.json(data,{status:result.status,headers:{'cache-control':'no-store',
          'x-content-type-options':'nosniff'}});
      })();
      try {
        return await Promise.race([work,new Promise(resolve=>{
          timer=setTimeout(()=>{controller.abort();resolve(reply(504,'REQUEST_TIMEOUT'));},timeoutMs);
        })]);
      } finally {request.signal.removeEventListener('abort',abort);}
    } catch { return reply(503,'LOCAL_MCP_UNAVAILABLE'); }
    finally {clearTimeout(timer);controller?.abort();}
  };
}
