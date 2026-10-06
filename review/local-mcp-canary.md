# LOCAL read-only MCP canary — preparation only

Function: local-claimed-mcp-canary. Read-only function-name discovery found no
existing function with that name on 2026-10-06. No deployment or secret changes.

Planned endpoint (not deployed or HTTPS-verified):
https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/local-claimed-mcp-canary

## Gate before deployment

Reuse the existing LOCAL_MCP_ALLOWED_USER_ID allowlist. No new canary secret is
required. Secret values are never fetched, displayed, edited or committed.
Missing configuration still fails closed. This preparation stops before deploy.
The function does not request or read any service-role key.

Planned deployment: verify_jwt=false, matching the production local-claimed-mcp
configuration reported by the user. This disables only gateway JWT validation,
not authentication: internal OAuth protected-resource middleware, Supabase user
verification and allowed-user comparison remain mandatory for discovery and
invocation. No public unauthenticated business tool path is introduced.

Existing project OAuth configuration is reused without modification, but its
runtime discovery and redirect compatibility remain unverified until deployment.

## Implementation and schema parity

Same OAuth protected-resource and withSupabase(auth:user, detailed:false)
middleware as candidate. Existing allowlist checks before discovery or calls;
missing allowlist fails closed, wrong/missing user denied, exceptions sanitized.
One getUser per authenticated HTTP request. Middleware authentication internals
are not mocked proof of live OAuth behavior.

Only three tools. Registration configuration (including descriptions, inputSchema
and annotations) is copied verbatim from the current candidate. Server identity
explicitly labels this a no-DB canary. Queue returns claimed=false/resumed=false;
all responses include canary=true and code=CANARY_READ_ONLY. None returns a
prediction ID, claim token, job ownership, run or production context.

| tool | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
| --- | --- | --- | --- | --- |
| lab_queue_claim_next | false | false | false | false |
| lab_claimed_context | true | false | true | true |
| lab_save_claimed_prediction | false | false | true | false |

Write-oriented annotations deliberately match candidate although canary performs
no business writes. Queue input worker_id fixed enum; context input job_id UUID;
save input job_id UUID, protocol_version, exact seven-key payload. The MCP SDK
validates schemas; no LOCAL prediction evaluation or save is performed.

## Local evidence

node --test --test-isolation=none tests/canary-registration.test.mjs
11 PASS / 0 SKIP / 0 FAIL. Covers exact registration/config parity, three fixed
callback responses, user allowlist/auth error paths, no DB calls and no logs.
Existing candidate regression: 88 PASS / 0 SKIP / 0 FAIL.
These are Node/SDK mocks. Canary-specific Deno check is included in GitHub Actions; consult the run result.
HTTPS/OAuth checks are NOT executed.
The previous candidate's Deno check is not counted as a canary Deno check.

## After separate deploy approval

1. Reconfirm the distinct function name; run canary Deno check/import resolution.
2. Reuse existing allowlist and OAuth configuration; do not modify any secrets.
3. Deploy only this new function with existing middleware authentication intact;
   set verify_jwt=false as described above; retain internal OAuth authentication.
   Do not weaken auth or change the existing production function.
4. Validate actual HTTPS initialization/auth challenge/metadata and OAuth login.
5. User action: add a separate custom MCP app named BAKEN LOCAL MCP Canary;
   use the endpoint above and OAuth. Never edit/disconnect BAKEN LOCAL MCP or
   BAKEN Task MCP Test. Current documented route is Settings > Apps > Advanced
   settings > Developer mode > Create app, subject to workspace permissions.
   Source: https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt
6. User completes OAuth login/consent. Do not request or print access/refresh tokens.
7. Authenticated tools/list: verify only the three names; compare JSON schemas and
   the four annotations to candidate, not merely to mocked registration.
8. Invoke each tool once using synthetic job_id and synthetic seven-key payload.
   Verify CANARY_READ_ONLY markers, no secrets/stack/SQL details. Since no DB path
   exists, no production queue/prediction fixtures or cleanup are required.
9. Leave existing task/plugin/function unchanged. Report real evidence before
   considering any production queue migration or deployment.

No authenticated tools/list, live tool invocation, OAuth acceptance, endpoint
availability or production rollout readiness is asserted by these local tests.
