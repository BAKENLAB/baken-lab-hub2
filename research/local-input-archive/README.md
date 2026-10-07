# LOCAL INPUT ARCHIVE — candidate only

Production baseline: Supabase qjlvsndiqjfsfjinilig, local-ai-worker v6.
No production migration, deployment, cron, protocol, LOCAL prediction, HUB, or JRA changes.

## Implementation
- Capture the same in-memory context after active-protocol validation, before API-key retrieval.
- Prompt context is exactly JSON.stringify(context); canonical key-sorted JSON is archive-only.
- Separate archive_format_version, context_hash, prompt_context_hash, protocol_hash.
- No invented context revision: context_version is NULL unless genuinely supplied upstream.
- Retry with changed context gets another snapshot; unchanged context/protocol reuses it.
- Exact prompt text/hash lives on each attempt too, preserving key order when a snapshot is reused.
- Capture RPC inserts snapshot and attempt atomically; trace is independent of claim_token.
- FROZEN link points to snapshot AND archive_event_id; already_saved skips new link.
- No horse_runs reads, no context enrichment, no OpenAI calls in archive module.
- SQL proposal uses non-exposed local_shadow, invoker RPCs, fixed search_path, explicit ACLs.
- UPDATE/DELETE/TRUNCATE rejected; table owner/superuser remains a trusted administrator.

## Timing and fail-open
Capture budget 500 ms (hash + RPC); link budget 500 ms.
Database function statement_timeout 400 ms; lock_timeout 100 ms.
Skip capture when post_time is invalid or <=185 seconds away, or lease invalid/<=5 seconds.
Budget is a JavaScript timer, not a hard real-time CPU bound: synchronous serialization,
event-loop delay and DB cancellation/commit races may exceed it. Nominal added waits:
<=500 ms before OpenAI and <=500 ms after FROZEN, plus synchronous CPU/event-loop overhead.
Capture or link failure never calls releaseClaim or retries OpenAI. DB late completion can
leave an orphan snapshot/event, which is excluded unless an exact valid FROZEN link exists.
Timeout does NOT guarantee the server rolled back. No archive RPC retry is performed.

## Verification
Run each file directly to preserve per-test reporting in this environment:
```sh
node research/local-input-archive/tests/input-archive.test.mjs
node research/local-input-archive/tests/worker-flow.test.mjs
```
Node 24 required for worker-flow TS stripping; all fetches/DB operations mocked.
25 assertions/tests passed (23 module/static + 2 actual candidate worker flow tests).
No real OpenAI calls made. This is NOT the lost 44-test or existing 88-test suite.

SQL test file is prepared but NOT executed. Use a disposable PostgreSQL database with
Supabase roles and minimal synthetic public receipt/prediction fixture tables, apply
the proposal there only, then run the SQL test. Never run its fixture INSERTs in production.
Additional required checks before production: concurrent inserts, role execution via
PostgREST, Data API non-exposure, real Deno/Supabase type-check/runtime, short lease
latency under load, SQL constraints/collision paths, isolated post-migration security advisor.

## Environment constraints
Docker previously denied; no local PostgreSQL/psql; no isolated Supabase branch returned
(list_branches returned only production main). No repeat Docker/CLI/escalation attempt.
Production SQL and security-advisor reads only; no production writes or settings changes.
Existing LOCAL 88 tests unavailable (GitHub main has frontend assets only).

## Advisor baseline (read-only production, 2026-10-07)
Existing: 2 ERROR (JRA public tables RLS disabled), WARN counts 1 mutable search_path,
1 pg_net in public, 8 anon + 8 authenticated executable definer functions,
1 leaked-password protection disabled; INFO 72 RLS tables without policies.
These are existing findings, not changes from this candidate. No repairs made.
https://supabase.com/docs/guides/database/database-linter
Migration-after advisor remains UNVERIFIED because proposal was not applied.

## Release decision
NO: actual PostgreSQL, PostgREST permissions, Deno runtime and isolated migration-after
advisor remain unverified. Unit PASS does not establish deploy readiness.

Read-only PostgreSQL 17.6 SHA-256 standard vector verified via Supabase MCP;
local_shadow does not exist in production. This does not validate proposed DDL.
