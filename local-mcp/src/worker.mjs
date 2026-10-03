// Sites-only entrypoint. Deploy only behind Sites' documented OAuth dispatch.
// An arbitrary standalone/public host must not trust these request headers.
import {createSitesAuthAdapter,hasSitesHostedUser} from './sites-auth.mjs';
export function createSitesWorker({verifyHostingRequest = hasSitesHostedUser,fetchImpl = globalThis.fetch} = {}) {
  return {async fetch(request,env) {
    return createSitesAuthAdapter({env,verifyHostingRequest,fetchImpl})(request);
  }};
}
export default createSitesWorker();
