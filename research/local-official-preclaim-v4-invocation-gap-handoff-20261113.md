# LOCAL official pre-CLAIM: acquisition bottleneck and bounded v4 handoff
Date checked: 2026-11-13 JST. RESEARCH / READ-ONLY LIVE AUDIT. Not a production deployment.

## Confirmed live observations
- Production project: qjlvsndiqjfsfjinilig.
- Supabase `lab-local-corner-preclaim`: ACTIVE v3 (server-only endpoint).
- `local-claimed-mcp`: ACTIVE v29 and declares `lab_preclaim_official_corners` among registered MCP tools.
- In the current assistant tool session, `lab_preclaim_official_corners` is **NOT** exposed by the installed ChatGPT connectors, so the assistant has NOT invoked it.
- `private.lab_preclaim_evidence_snapshots_v1`: 0 rows as of 2026-11-13 13:33 JST.
- Supabase gateway logs in the 24-hour window 2026-11-12 05:00Z through 2026-11-13 05:00Z: 152 HTTP 200 reads at `/rest/v1/rpc/lab_preclaim_local_corner_read_v1`; 0 corresponding `lab_preclaim_local_corner_insert_v1` requests.
- Supabase Function gateway logs over that same window: 282 HTTP 200 calls to `/functions/v1/local-claimed-mcp` but **no** requests matching `/functions/v1/lab-local-corner-preclaim`.
- Therefore, **the immediate observed bottleneck is absent invocation of the pre-CLAIM acquisition route**. A timeout is an independently verified design risk, not a proven cause of the 0-row current live status.
- No FROZEN, saved ranking or bets were updated in this investigation.

## Independently found latency hazard (before patch)
Existing ACTIVE endpoint v3 was called by an MCP handler with an outer 85-second timeout. Per-race configured maxima were roughly:
  - 5 seconds for official start card
  - up to 20 horses x 1.5 seconds for official horse history = 30 seconds
  - up to 40 official past races x 1.5 seconds each = 60 seconds
  - additional time for DB append-only RPC
Worst sequential configuration exceeded 95 seconds and could terminate before a snapshot was sealed. This is a potential failure when actual calls resume; it does not explain observed absence of calls.

## Staged v4 improvements (NOT deployed)
Source changes on this branch:
1. `automation/local-official-preclaim-workflow.mjs`: one capped 75-second operation window; 2.5-second allowance for final seal and response, 1.5-second final safety check, existing 5-minute before-post reserve preserved.
2. `automation/nar-corner-prefetch.mjs`: shared absolute operation deadline for all historic race reads, so 40 per-page timeouts cannot silently extend the overall call.
3. `automation/nar-official-corner-acquisition.mjs`: forwards that deadline to the bounded official source.
4. `research/staged-lab-local-corner-preclaim-v4-index.ts`: server-only wrapper prepared from currently ACTIVE v3 source. It requires exact user-requested JST race key, same-day, READY field, PENDING/RETRY, rejects debut, no CLAIM/SAVE or odds; passes `maxOperationMs:75000`.

## Verification run in this conversation
- `research/local-official-preclaim-workflow.test.mjs`: 12/12 passed (actual pure module + append-only stage in a deterministic V8 test harness).
- `research/nar-corner-prefetch.test.mjs`: 15/15 passed (actual pure module + injected official source).
- `research/local-preclaim-v4-deployment-contract.test.mjs`: 6/6 static safety tests passed.
- All examples are synthetic. No real official preclaim capture occurred, so real-source reliability and accuracy remain UNPROVEN.

## Deployment / connection gate
- No production edge function deployed from these staged changes.
- Do not directly insert official history or snapshots through SQL.
- Do not restart Cron, backdate any snapshot, force a CLAIM, reissue a rejected save, or change existing FROZEN.
- Only a currently available, correctly installed **authorized** MCP tool may request exact one-race official preclaim. The end-user should not be asked to paste service keys.
- Before any deployment: review full Deno import bundle, verify service-only authorization, budget tests on the actual environment and function logs. After enabling tool access, execute exactly one eligible fresh race on the canonical MCP path, inspect status/verified witnesses, and confirm append-only RPC row via read-only SELECT.
- Only once genuine as-of pre-CLAIM evidence exists, run a sealed LOCAL1.7 independent all-horse A/B and measure winner / podium capture after the official result. No adoption without paired evidence.

This handoff should not be treated as a claim of prediction accuracy improvement.
