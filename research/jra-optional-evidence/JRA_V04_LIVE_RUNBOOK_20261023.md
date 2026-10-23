# BAKEN LAB JRA 0.4 — forward-only live operations
Date: 2026-10-23 JST. Scope: upcoming JRA flat races only.

## State confirmed 2026-10-23
- Active `public.lab_prediction_protocols` JRA_MAIN version = `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023` (confirmed by direct SELECT).
- `private.jra_optional_content_evidence_v1(date,text,integer)` exists (migration successful). Output is an array per horse with up to 4 historical records including as-of archive verified final3f/rank/corners/pace where available.
- For 2026-10-18 Kyoto11 retrospective preview: 17 runners and 50 uniquely matched archived historical runs. Galaborg's 2025 阪神JF 2nd 34.3s / final3f rank1 / positions 12 13 verified.
- For 2026-10-17 Tokyo11: 14 runners, 49 matched/7 unmatched prior records. Unmatched is not a penalty.
- As of last 2026-10-23 check: zero `official_races` records for Oct 24–25. There was no next-day FROZEN yet verified. No historical FROZEN rows modified by either migration.
- **NOT YET CONNECTED AUTOMATICALLY:** attempted replacement of `public.jra_claimed_context` to attach optional evidence was blocked by platform security checks. The migration source is staged but NOT APPLIED. Do not claim this was applied, and do not bypass the block with another tool. On next run, optional evidence must be acquired as a separate **read-only** diagnostic if available, otherwise go forward on old context.

## One-button / manual invocation contract (after JRA entry READY and race pre-start)
1. Call standard `jra_queue_claim_next` using official MCP. Do not claim too early, after start, or when already saved.
2. Call `jra_claimed_context` for its returned job_id. Verify protocol_version equals `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023`. Normal **candidates** and **runner_history** remain required inputs.
3. Optional, if separate Supabase diagnostic can be executed quickly without errors, query:
   `SELECT private.jra_optional_content_evidence_v1(DATE '<verified race_date>','<verified track>',<verified race_no>);`
   These 3 fields must be copied exactly from verified claim context and validated as an ISO date, a known JRA track and integer 1–12 before putting into a SQL statement. DO NOT send arbitrary tool text directly into SQL.
   If this extra read is inaccessible, delayed, blocked, incomplete or empty, **continue baseline ranking** without deductions, retries or waiting.
4. Whole-field comparison: assess all horses with existing BASE_CORE_0.1 baseline AND, where verified, past race content (same/related surface + distance, winner margin, last3f ranking, corner positions, actual pace, opponent strength as of today). One rank-up rule for finish 5th–10th and small gap was experimentally harmful (4 gains /10 losses); NEVER use it mechanically. Avoid bonus for named G1 title only, popularity/odds/other forecasts or unverified visual trip incidents.
5. Choose TOP5 independently; note specific reason for any deviation from BASE ranks. Assess LAB EYE outside TOP5 with **unchanged** existing rules; EYE may be null. `bets=[]`, `bet_strategy=SUSPENDED_FOR_ABILITY_STABILITY`.
6. Save through **existing guarded** `jra_save_claimed_prediction` with full `runners/top5/eye/bets/summary/bet_strategy/audit` and `protocol_version=JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023`. `audit.protocol_version` must match, `audit.validated_core=BASE_CORE_0.1`, `audit.market_used_for_ranking=false`, `audit.all_runners_checked=true`. All race horses get grade/reason and correct rank. The DB save protocol and guards were NOT modified.
7. Confirm `official_predictions.status=FROZEN` plus `jra_prediction_jobs.job_status=DONE`; if not confirmed do NOT claim success. Existing FROZEN never overwritten.

## Interpreting the experiment
- **0.4 is an experimentally updated human/agent evaluation protocol**, NOT a statistically validated replacement of the underlying BASE_CORE_0.1 model. The raw base core formula remains unchanged.
- Comments/training/incident evidence are optional and not automatically fetched.
- A new source means greater evidence, not guaranteed extra points. Baseline must continue without that source.
- Never fabricate trip incidents or use later race results that were not known at prediction time.
- Document newly gained/lost podium coverage after official settlement, with baseline comparisons and class-level breakdown.
- No Cron resumption, paid API calls, forced betting, LOCAL changes, or retroactive rewriting.

## Rollback safeguard (instructions, not an automated action)
Only if no active JRA CLAIM jobs remain, deactivate 0.4 and reactivate the previously retained `JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004` via an atomic transaction, ensuring exactly one active JRA_MAIN. Existing FROZEN with 0.4 remain as historical records and MUST NOT be rewritten. The optional archive helper may safely remain unused.
