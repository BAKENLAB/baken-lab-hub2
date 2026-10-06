# LOCAL execution path review (2026-10-06)

This is an isolated additive-source Git working directory at
/workspace/local-queue-execution-review, not a checkout of GitHub main.
Review branch was published; no production migration, deploy, cleanup or automation update was performed.
Source import and implementation are separate local commits. To publish later,
a review branch from GitHub main holds these additions;
do not merge this standalone root-history branch into main.

## Source import

Read-only Supabase export: local-claimed-mcp v8 (2 source files),
lab-claimed-context v8 (entrypoint, handler, 5 automation modules),
local-data-refresh v7 (1 file), plus queue RPC/view definitions.
The database baseline is reference/test material, NEVER a deployment migration.
It does not include complete production table/trigger/RLS DDL. The test scaffold
is representative and cannot establish production-trigger parity.
hub2-api, JRA and other unrelated functions are intentionally not imported.

IMPORTANT: production local-data-refresh contained an embedded refresh credential.
The exported repository candidate replaces only that literal with env
LOCAL_DATA_REFRESH_KEY and fails closed when unset. Secret value is not included.
The first local source commit was amended and unreachable objects pruned before
publishing. Do not deploy local-data-refresh as part of this queue change.
Separate secret rotation/configuration requires its own reviewed production work.

## Transaction and authorization

lab_queue_claim_next_v1(text): SECURITY INVOKER, pg_catalog search_path,
worker advisory xact lock (namespace 72816), fixed worker->region mapping, DB JST
date, existing enqueue RPC, locked runs -> locked jobs, conservative live-claim
validation and resume, no-live RUNNING -> ABANDONED through existing finish RPC,
existing start+claim(1,900), empty new run -> SUCCEEDED. Malformed/multiple live
claims fail closed. No history deleted. Token never returned.
Existing LOCAL jobs have CHECK(circuit='LOCAL'); captured production view also
filters LOCAL. Existing claim uses SKIP LOCKED and never takes a live lease.
The wrapper has 5s lock_timeout/12s statement_timeout; MCP RPC timeout is 14s.
Function grants: service_role EXECUTE only. No table permission expansion for
existing queue tables. Service-role privileges/BYPASSRLS are prerequisites.

Old direct start/claim RPC callers do NOT take the new advisory lock. Mixed
old/new dispatch cannot guarantee one live claim per worker. Cutover requires
pausing the relevant OLD LOCAL task entries, allowing live work to finish/expire,
then enabling only the new entry for that worker. This is not done now.
The existing expiry reclaim/attempt budget and acquisition windows are unchanged.
No guarantee of success after a race becomes too late or exhausts max attempts.

lab_queue_save_prediction_v1(uuid,uuid,text,jsonb,jsonb) is service-only INVOKER.
Advisory namespace 72817 serializes same-job new-route saves. Run -> job locks
match existing save. A currently approved LOCAL worker/run/live claim is checked;
the unchanged guarded lab_save_claimed_prediction performs the ONLY prediction
write, then a service-only RLS receipt is inserted in that SAME transaction.
Receipt failure rolls back the nested save. PUBLIC/anon/authenticated/service_role table grants are all explicitly revoked before SELECT/INSERT is granted back to service_role, including production-like default ACL grants. For a DONE retry, receipt user/job
and the existing FROZEN LOCAL prediction's three-column identity, protocol and
JSONB normalized payload must match. Receipt original_payload stores the pre-normalization input as JSONB and must also match (object key order/whitespace ignored; array order retained). No digest or extension is used. Changed payload, another user, or a legacy DONE without
receipt is rejected. No retroactive success claim or prediction mutation.
Cleanup may close completed runs on the NEXT entry; save doesn't bypass its
existing final RUNNING requirement. No pending snapshot feature is combined here.

## MCP contract

New lab_queue_claim_next input: strict worker_id enum of WEST/KANTO/CHUBU/
HOKKAIDO_TOHOKU/RESCUE. Authorized OAuth user must match existing secret allowlist.
No region/run/claim-token input. Returns ok/claimed/resumed plus job_id/run_id/
region/lease_until only when claimed. The existing authenticated user is allowed
the same five-worker set as the production v8 context/save design.
Existing context input/output unchanged. Invalid lease timestamps now reject.
Existing save input remains job_id/protocol_version/strict seven-key payload;
existing pair evidence normalization and production local-eye validator unchanged.
Save success retains ok/prediction_id, adds already_saved. Validator runs before
RPC even on retries. Internal user ID is passed server-side, never returned.
No business scoring/rank/TOP5/EYE/market/bets change.

Public error allowlist: WORKER_NOT_ALLOWED, QUEUE_START_FAILED,
QUEUE_STATE_UNAVAILABLE, FORBIDDEN, AUTHORIZATION_NOT_CONFIGURED,
SERVER_CONFIGURATION_ERROR, CLAIM_UNAVAILABLE, CLAIM_CHANGED,
CONTEXT_UNAVAILABLE, CONTEXT_CHANGED, SAVE_REJECTED, SAVE_RESULT_INVALID,
SAVE_RETRY_MISMATCH, and fallback OPERATION_FAILED.
Unknown upstream/SQL/validator exception details are not echoed. No logging.
OAuth lookups and wrapper calls are bounded. Database may commit after client
response timeout; subsequent queue resume or exact receipt retry handles it.

## Verification and limitations

Run node --test --test-isolation=none tests/*.test.mjs.
The actual TypeScript tool callbacks are transpiled with Node stripTypeScriptTypes
and executed with SDK/OAuth/Supabase mocks. Exactly three registrations verified;
this is NOT real HTTPS tools/list or Deno dependency/build/OAuth verification.
Validator tests reuse the existing review fixtures; only the production-required
running_style_reference fixture field was added. Original tests were untouched.
The 138 existing LOCAL MCP tests remain independently runnable in their workspace.
No separate existing PostgreSQL queue test suite is available here.

tests/postgres.test.mjs provides real SQL A-I/permissions/transactions/concurrency
checks, but refuses non-local hosts, nonempty DBs or database names outside
local_queue_test_*. Requires psql, a disposable superuser-owned local database,
and env LOCAL_QUEUE_TEST_DATABASE_URL. No credentials printed. Actual captured
legacy functions are compiled with the candidate migration, using representative
test-only tables/freeze trigger; original production EYE/FROZEN triggers and
Supabase gateway/RLS configuration parity still require isolated Supabase checks.
Local PostgreSQL/CLI is unavailable. .github/workflows/local-queue-pg17.yml provisions an ephemeral PostgreSQL 17 GitHub Actions service with synthetic fixtures only and no production secrets; REQUIRE_POSTGRES prevents silent SKIP. Its real run status must be reported separately from local SKIP. No network retries/Pro plan.
JRA isolation is static: no JRA source/import/RPC/table modifications, no production
SQL writes. No JRA functionality tests were run for this LOCAL-only task.

## Rollout (requires further approval)

1. First complete real PostgreSQL suite and fix findings; obtain Deno SDK build,
   actual authenticated tools/list, error/secret tests and production trigger parity.
2. Copy reviewed additions onto GitHub review branch from current main. Review PR.
3. Use installed Supabase CLI migration new local_queue_execution_v1 to generate
   the proper timestamped file and copy ONLY local-queue-execution-migration.sql
   into it. CLI missing here, so this remains a review candidate, not a falsely
   generated deployment migration. Never apply production-queue-baseline.sql or
   tests/postgres/scaffold.sql to production.
4. Check fresh schema/function names/grants, approve the reviewed additive DDL,
   apply it to the authorized target only. Existing RPCs are not replaced.
5. Deploy ONLY local-claimed-mcp with index.ts/local-eye.mjs/queue-operation.mjs;
   keep existing OAuth/allowlist/service-role env and original middleware.
6. Authenticated tools/list must advertise the three tools. Reload/reconnect
   ChatGPT if discovery cache differs; don't disguise a missing registration.
7. Retire old direct-RPC entries per worker without stealing live claims. Switch
   approved LOCAL task instruction to claim_next -> context -> LLM -> save.
   Do not change prediction instructions or automatically disable tasks on failure.
8. Authorized one-race E2E: resume/concurrency/save retry/no duplicates; then
   progressively enable other LOCAL workers. Platform write blocking may remain;
   dedicated tool does NOT bypass platform safety policy. Monitor run/job errors.

## Rollback

Stop new LOCAL entries first; preserve live claims until complete or expired.
Restore source-import v8 MCP (three new wrapper-dependent changes removed), and
reviewed previous LOCAL task instructions. Revoke/drop ONLY the two new wrapper
functions using local-queue-execution-rollback.sql. Keep receipt evidence and all
existing jobs/runs/predictions. Do not rewrite FROZEN, delete history, change JRA,
or roll back by applying the reference baseline. Previous path retains blocking
risk; rollback is not a guarantee of successful unattended execution.

## Final MCP authentication / error / Deno gate

Queue and save handlers authorize once with getUser and the unchanged
LOCAL_MCP_ALLOWED_USER_ID comparison. Internal helpers do not authenticate;
queueSave accepts only the handler-supplied userId, not a tool input field.
SAVE_RETRY_MISMATCH and SAVE_REJECTED are the only DB save-message codes retained;
unknown SQL messages map to SAVE_REJECTED. Existing public error sanitization stays.
Save idempotentHint=true: retries with identical job/user/protocol/original JSONB/
normalized JSONB/FROZEN return the same result without another write. Different
inputs reject. Queue idempotentHint remains false.

Production READ ONLY inspection on 2026-10-06 confirmed the five legacy signatures:
enqueue(date), start(text,text), claim(uuid,integer,integer), finish(uuid,text,text),
save(uuid,uuid,uuid,text,jsonb), all SECURITY INVOKER. The existing LOCAL 1.5 BEFORE
INSERT guard, AFTER INSERT registry trigger and BEFORE UPDATE rewrite prevention
trigger remain unchanged. Candidate save delegates to the existing guarded RPC;
receipt retry only SELECTs the frozen prediction. Validator/7 keys/bets=[]/strategy
are unchanged. This inspection does not replace full production-trigger testing.

CI now runs deno check against the same index.ts and its npm/jsr/local import
graph, without runtime secrets or a production connection. Real HTTPS/OAuth
execution remains a separate gate.

## Three mandatory audit fixes and CI gate

Expired CLAIMED ownership is checked across claimed_by/worker_run_id/run.worker_id/
run.region/job.region before cleanup, regardless of lease expiry. Inconsistency
raises QUEUE_STATE_UNAVAILABLE and rolls back enqueue/cleanup/claim changes.
Correct expired claims linked to a terminal run may still be reclaimed; cleanup
only closes RUNNING runs. Live claims remain protected.

The workflow uses push on codex/local-queue-pg17-validation-* only, a fresh
local_queue_test_ci database, read-only repository token permissions, no secrets,
no production URL, no deployment steps. It installs only a PostgreSQL client.
Service trust auth is test-only on the isolated runner; no password is committed.
A-N use the captured LOCAL RPCs and minimal schema; E/F use independent psql
connections held at an exclusive/shared advisory barrier until both are waiting.
Owner/run/token/attempts and second-loser attempts are asserted. Default ACLs
mirror production and permission failures execute under actual client roles.
No test directly inserts/updates/deletes official_predictions; guarded save alone
writes synthetic FROZEN rows. Setup of a synthetic non-LOCAL canary in this
disposable DB is not access to JRA production schema/data.

Workflow and DB success do not establish Deno/OAuth/HTTPS/ChatGPT tool discovery or
full production trigger parity. These remain a separate approval gate.
