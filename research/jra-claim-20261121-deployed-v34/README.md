# JRA regular claim: official-debut exclusion recovery (2026-11-21 JST)

## Production state and user-safe objective
- Supabase project: `qjlvsndiqjfsfjinilig`.
- Production Edge Function: `jra-claimed-mcp` updated from **v33 to v34**. The new v34 code is archived here as `index.ts`.
- The existing owner-restricted Supabase OAuth MCP authorization middleware and admin service-role access were preserved exactly; `verify_jwt=false` was **preserved**, not newly relaxed, because OAuth-protected MCP authenticates internally. All 15 production dependency files were preserved byte for byte.
- ONLY two changes to production `index.ts`: replace RPC call `jra_manual_claim_next_v1` with existing installed and role-restricted `jra_manual_claim_next_v2`; update the public tool description accordingly.
- No direct prediction SQL, no FROZEN alteration, no Cron changes, no new SQL migration, no paid APIs or guessing.
- Existing `v2` Postgres RPC was already installed as `public.jra_manual_claim_next_v2()` with `EXECUTE` for `service_role` and not `authenticated`; both RPC variants use the same 3-to-70-minute window, `BASIC_READY/READY`, 15-minute lease, identical worker ID `JRA_QUEUE_RESCUE`, same transaction advisory lock and `official_predictions` exclusion.
- The only v2 logic differences are in resume, insert, and select candidate predicates: `class_name NOT LIKE '%新馬%'` and `race_name NOT LIKE '%メイクデビュー%'`. In particular, **pre-existing Kyoto5R/6R debut jobs are ignored**, even if they were enqueued under v1.
- This is a *safe narrowing* of candidate eligibility: the official unpublished debut races remain PENDING, no false rank or save.

## Observed verification
At approximately 11:23 JST, before 福島6R's 11:30 claim opening:
1. `jra_queue_claim_next` returned `claimed:false`, `queued:0`, `NO_READY_UNSAVED_JRA_RACE_IN_3_TO_70_MIN_WINDOW`, rather than claiming 京都5R.
2. Re-fetched live `jra-claimed-mcp` and confirmed `c.rpc("jra_manual_claim_next_v2")` is present, and v1 claim call is absent.
3. `official_races`: 22 flat official BASIC_READY; `official_predictions`: 7 sealed FROZEN as of this verification, all before post time.
4. 京都5R has 16 / 16 debutants with zero prior runs, 京都6R 7 / 7; 福島6R has 15 valid horse IDs and 59 recent prior runs, official numbered card dry-run PASS, and post time **12:40 JST** (eligible for claim from **11:30 JST**).

## Next action
After 11:30 JST, call the existing `jra_queue_claim_next` MCP to claim 福島6R and perform the full independent 100pt historical score, complete field TOP5 / EYE audit, source-verified evidence rank preview, guarded official save, and DB receipt check. No tools should claim or save before eligibility.

This branch is an archive of what was **already deployed** and should remain DRAFT. It is not a request to merge an alternate production entrypoint that lacks the associated production function's private dependencies.

## Additional verifications
- GitHub Actions regression: workflow `JRA v34 debut-safe claim gateway regression` two successful runs, including run `44855847767`.
- Production read-only post-deploy SQL at 11:26 JST: official BASIC_READY 22, immutable pre-post empty-bets FROZEN 7, active claims 0, and at exactly 11:30 JST v2-eligible predicted next race count 1.
- 福島6R official preclaim source snapshot with all 15 horse IDs and 59 genuine historical rows archived as `fukushima6-preclaim-official-evidence.json` (not a prediction or claim). It must be used only to review as-of evidence; after real CLAIM, the official claimed context is authoritative.
- Draft PR #77 (archive only) is https://github.com/BAKENLAB/baken-lab-hub2/pull/77.
