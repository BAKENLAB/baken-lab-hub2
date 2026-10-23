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


## 2026-10-23 new verified research installation

Installed and SELECT-verified in unexposed private schema (all SECURITY INVOKER, execution revoked from PUBLIC/anon/authenticated):

1. private.jra_prior_opponent_evidence_v1(race_date,track,race_no,horse_no): match each runner's up-to-four historical flat runs by exact date/track/surface/distance and stable horse-code plus matching name; require exactly one archive race; link top-three historical rivals to subsequent 1st-3rd finishes strictly before target race date. Factual evidence, no score effect.
2. private.jra_v04_evidence_bundle_v1(race_date,track,race_no): combine all runners' verified prior content and subsequent known rival results in ONE read-only payload. This does not replace public.jra_claimed_context (that earlier modification was blocked, not deployed).
3. research/jra-optional-evidence/race-evidence-audit.mjs: pure JS evidence ledger with near-condition form, verified fast last3f, archive coverage, rival results and ambiguity notes; no score/rank/EYE effect. 11 isolated tests passed, not Node CI.

Optional operator read after a verified claim:
SELECT private.jra_v04_evidence_bundle_v1(DATE '<exact race date>','<verified JRA track>',<verified race number>);

Historical pilot confirmations:
- 2026-10-18 京都11R 秋華賞: 17 horses, 66 prior runs, 50 archive-linked, 84 later-rival podium records.
- 2026-10-17 東京11R 富士S: 14 horses, 56 prior runs, 49 archive-linked, 66 later-rival podium records.
- 2026-10-18 東京8R 1勝: 16 horses, 62 prior runs, 44 archive-linked, 107 later-rival podium records.
- 2026-10-18 新潟6R 1勝: 15 horses, 58 prior runs, 50 archive-linked, 102 later-rival podium records.

Counts are observations, not unique strong rivals. No current future official result is read. A historical archived record may not be an immutable old snapshot.

ギャラボーグ: 2025 阪神JF 2nd/last3f rank 1; winner スターアニス later won 桜花賞; third タイセイボーグ later won チューリップ賞. Both later achievements happened before the target 2026 秋華賞. No automatic bonus based on title alone.

CRITICAL: JRA 0.4 protocol is active and standalone optional evidence reads are installed, but actual guarded CLAIM payload and automated production scoring formula have NOT been rewritten. A human/agent whole-field comparison must intentionally use optional evidence as available; failure to fetch cannot block. There is no established improvement in predictive accuracy. Do not claim full automation.

Preserve bets=[] and bet_strategy=SUSPENDED_FOR_ABILITY_STABILITY. Preserve EYE rules and all existing FROZEN. No Cron restart, paid API or unauthorized write.


## 2026-10-23 43-race scoring trial — IMPORTANT NO-GO

The research-only code \`tie-shadow-v04.mjs\` tried reordering **only exactly equal validated_core_base_rate horses** based on corroborated past same-surface/near-distance evidence. Among 110 previously verified JRA FROZEN races, 43 had all-runner baseline probability fields; 66 had none, one was partial.

Of those 43, 27 had at least one rank change. TOP5 podium capture was **85 for original LAB**, **83 for shadow**, net -2. An example: 新潟9R 2nd-place エルナト demoted from rank5 to rank6; 新潟10R winning キャリーグレイス demoted rank5 to rank7. The trial is REJECTED for live rank selection, EYE, saved predictions, and automatic scoring. Do not optimize on the same already-inspected 43 and claim out-of-sample validation.

Instead use \`boundary-review-v04.mjs\` as an optional read-only **review ledger**, after \`race-evidence-audit.mjs\`. It compares ALL horses outside TOP5 with protected TOP5 evidence and flags conditions for *independent full-runner examination*, without determining replacements. This code is currently in the GitHub research branch, not in the live JRA CLAIM payload or server-side scorer. Verified in isolated JS (8 tests PASS), plus read-only 秋華賞 and 富士S historical packets.

For tomorrow's live JRA work, keep active JRA 0.4 contract but do not assert that the new numerical ranking is validated or integrated. If optional research tools are unavailable, proceed exactly through the original trusted model and guarded save flow; never wait on missing trainer comments. **No automatic TOP5 changes from tie-shadow.**


## JRA 0.5 new optional evidence (2026-10-23)
New read-only private functions installed: jra_optional_content_evidence_v2 and jra_v05_evidence_bundle_v1.
Optional SQL for a verified pre-race card: SELECT private.jra_v05_evidence_bundle_v1(DATE 'YYYY-MM-DD', 'TRACK', RACE_NO);
Replace these illustrative parameters only with the verified claimed JRA date, track and race number. Never pass untrusted values into SQL.
If this optional read fails or is blocked, default scoring and guarded FROZEN saving must proceed without delay or missing-data penalty.
The new numerical v0.5 shadow code remains research-only and is NOT applied automatically to live TOP5 or EYE.
38 inspected historical races: original 73 podium captures versus shadow 73, no net predictive uplift. Another 5 formerly studied races were not re-read.
Detailed records and methodology: v05-base-first-correction-20261023.md.
Production protocol JRA 0.4 remains active; production BASE_CORE, guarded CLAIM/SAVE, Cron, EYE and prior FROZEN unchanged.
