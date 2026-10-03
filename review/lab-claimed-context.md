# lab-claimed-context: local review

No deployment, Task change, prediction, RPC call, migration, commit or push performed.

## HTTP contract

POST /functions/v1/lab-claimed-context
Authorization: Bearer <server SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json

Body exactly: {"run_id":"uuid","job_id":"uuid","claim_token":"uuid"}.
No caller-supplied race identity, protocol, URL, field data or history accepted.
Server credential must never be placed in a Task prompt/browser/log. Handler compares
against configured server credential; fabricated role claims/user/anon tokens fail.
Keep default platform JWT verification for the existing legacy service-role JWT.
Modern non-JWT API keys are not supported by this implementation.

200: {ok:true,context:{race:{identity,post_time,conditions},protocol:{protocol_key,
version,content},protocol_version,runners,missing_conditions,field_integrity_checked,
stage,supplementation_audit}}. Protocol content is JSONB, verified against live schema.
Each runner includes current official attributes, identity_refs, max five recent_runs,
source/identity evidence and missing_items. No raw HTML/diagnostic JSON, market fields,
or returned service credential/claim token. Caller retains its own fencing tuple.
Context.race.conditions and runner source references support assessComparison.

400 malformed request; 401 invalid credential; 405 wrong method; 413 oversized body;
409 claim/protocol/field/collection safety failure; 500 unexpected failure; 503 missing
handler authentication configuration. Errors never return DB/provider messages.
History fetch failure is recorded as missing by collector and can return 200; this
endpoint does not decide ranking or semantic full-depth comparison and never retries
or modifies a job. Latest field failure/conflict safely fails collection.

## Execution

SELECT run/job/race/active protocol → existing collectClaimedContext with read-only
DB adapter and existing nar-schedule-probe reader → SELECT state again → final
history boundary and scalar allowlist → return safe input.
No INSERT/UPDATE/UPSERT/DELETE, RPC, claim, save, finish or queue operations.
All input SELECTs limited to two rows for uniqueness checks; history reads limited
by existing adapter to five. Read queries have five-second abort timeout.

Claim verification includes RUNNING, CLAIMED, owner/run/token, future lease,
attempts <= max_attempts, matching LOCAL race and PENDING/RETRY status, >3-minute
pre-race deadline. Final reread catches changed token, lease, status, protocol or field.
Reads are not a DB transaction: a claim can change immediately after return. This
response never extends ownership; existing atomic save is the final authority.

Final projection rechecks historyBeforeRace, identity verification/source, five-run
limit and available_at/observed_at/fetched_at when present. Same-day history is
conservatively excluded, as official parser lacks trustworthy result-finality times.
Past race facts remain nested recent_runs; never copied to current attributes.
Generic collector/parser perform first leakage checks, endpoint adds last barrier.
Scalar projection excludes unwanted keys, not arbitrary market-related prose embedded
inside otherwise accepted source text; no semantic content classifier is claimed.

Normal verified five-run horses skip additional readHistory, but current official
card verification is mandatory. Five name-matched DB rows alone are not same-horse
proof and may still need official witnesses. No prediction/model call is performed.

## Task calling path investigation

Current available Supabase connector tools include execute_sql, get/list/deploy Edge
Function and logs/doc tools. There is no invoke Edge Function/HTTP POST tool in this
connector's exposed inventory. get_edge_function retrieves source; it does not invoke.
An authenticated HTTP client or supabase.functions.invoke can invoke the endpoint,
but a Scheduled Task tool implementing that path is not confirmed.
Live extension catalog: pg_net present; http absent. pg_net is asynchronous and its
requests are enqueued in DB, not a synchronous read-only SELECT bridge. Not used.
Changing to a write RPC wrapper would neither provide direct Edge invocation nor
prove removal of ChatGPT approval requirements.

Recommended separate next design: authenticated read-only MCP/action tool wrapping
this POST, with server-held credential and per-call ownership tuple. Verify that the
connector can actually be used by Scheduled Tasks and its approval behavior before
connecting/enabling any Task. Existing baken-lab-mcp could be reviewed as a candidate,
but is not changed or certified as a Scheduled Task route here. No credential should
be embedded in SQL or Task prompts. External authorized orchestrator is an alternative
if no supported scheduled tool route exists; not implemented.

## Verification and deployment boundary

33 new local cases; complete suite: 284 total, 190 PASS, 94 SKIP, 0 FAIL.
94 skipped PostgreSQL integration cases retained. Real collector missing-history
path exercised with SELECT-only injected client/official adapter. Live protocol schema
and extension metadata read only. No live invocation of undeployed function.
node checks and TypeScript syntax stripping/check pass; Deno is unavailable, so actual
Deno module resolution, npm/JSR imports and deployed gateway auth remain unverified.
Full source bundling must include the six transitively imported automation modules;
a source-only index/handler deployment is insufficient. Do not deploy other functions.

Before deployment review: validate Deno dependency bundle and service JWT gateway,
confirm an authorized HTTP test client. After later deployment authorization: first
unauthenticated/anon rejection; then one already-owned valid pre-race claim, context
read only, inspecting exclusions/missing/evidence and unchanged job/run/prediction
records. Do not create a synthetic production claim or generate predictions as part
of this diagnostic. Do not enable/connect Tasks.
