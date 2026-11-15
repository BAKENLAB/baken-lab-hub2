# Stage 2 — JRA short-turf EYE fill-null integration

Version: JRA_TURF_SHORT_FILL_NULL_20261115. Based on production MCP v23 and PR #49.

## What actually changes
The existing `jra_evidence_rank_preview` calls the fill decision on its rank-finalized proposed payload only when the existing rank bridge reports READY_FOR_OFFICIAL_SAVE. The actual `jra_save_claimed_prediction` calls the same decision AFTER its unchanged rank bridge and BEFORE the original `jra_save_claimed_prediction_with_shadow_v1` guarded RPC. No direct INSERT/UPDATE, new model request, new RPC, migration, Cron or LOCAL change exists.

- Existing EYE: preserve the supplied current selection byte-for-byte.
- Dirt and turf >1800m: return the original payload unchanged.
- Turf <=1800m and eye=null: fill only on an explicit completed `audit.eye_fill_review` supplied by the real evaluator. Missing review keeps null; invalid submitted review raises JRA_EYE_FILL_* BEFORE the save RPC. No placeholder review or automatic CHECKED flags are generated.
- Replay of a preview-filled EYE rechecks the original null-baseline review against current authoritative context; changing its EYE is rejected.
- Runner ranks, grades, scores, TOP5 and comments are not changed by this module.

The candidate order is inherited from v23: qualifying front-running performance count, mean early position, then existing rank. This is an audit lead, not a selection command. The real evaluator must independently compare ALL outside-TOP5 horses and explicitly name its selected candidate or null, with a reason. It need not claim guaranteed success or absolute dominance against every rival.

## Formal review contract
`eyeFillInstructions()` is included in every authorized claimed context. The request lives inside the existing audit object, leaving the seven top-level payload keys unchanged. See the helper's `required` schema and the explicitly synthetic fixture.

The gate checks official ACTIVE/identity/full-rank agreement, S–F with reasons, TOP5 agreement, race/protocol/time, independent all-runner review, all outside-TOP5 reviews, negative conditions/missingness, every outside pair comparison, no market/result use, no automatic rank6, and candidate eligibility.

For a selected candidate at least two DISTINCT positive types are supported:
1. RELATIVE_EARLY_POSITION: at least two verified early observations, dense rank <=3 among the whole eligible ACTIVE field.
2. NEAR_DISTANCE_PERFORMANCE: the referenced verified same-turf +/-200m front-good run has a win or <=0.6s loss. This factor records finish/distance/gap observations, not a second copy of early position.

Every factor needs an explicit current reason and independence explanation from the evaluator. Duplicate types, unsupported/fabricated evidence refs and empty explanations are rejected. The program verifies factual support and record coverage; it cannot prove the truth/quality of free-text causal reasoning. The evaluator is still responsible for genuine qualitative independence, current applicability, negative evidence and fair comparison. A qualifying run alone does not count as completed formal audit. No audits are fabricated from historical results.

## Tests actually run
- fill-null.test.mjs: 30 PASS / 0 FAIL.
- save-path.test.mjs: 8 PASS / 0 FAIL. Executes the exact extracted production hook with an isolated mock save boundary: accepted review -> fill -> guarded call; failed review -> zero mock writes. Existing rank re-audit is not bypassed.
- Removing the precise additions restores v23 byte-for-byte. The authoritative RPC invocation and every line after it are identical. Authentication and schemas remain unchanged. Zero extra RPCs.
- These 38 tests are new focused tests, not an inflated rerun of the previous 40 tests. Mock calls are NOT production saves or PostgreSQL tests.

## Real pre-save input / preservation validation
At 2026-11-15T01:40:18.994166Z, a read-only SELECT captured Fukushima7, 13:00 JST, turf1200m, 16 ACTIVE horses. It used the SAME normalized verified merged-four-history SQL expression as current claimed_context. Identity/field agreement, all 16 feature rows, pre-race timestamp and prior-only history checks passed. SHA-256 and details are in preflight-validation.json. The private raw export stays local, not in the public PR.

This was preflight READ ONLY, NOT an authorized CLAIM. No final live ranking or qualitative review existed, so no EYE was selected and no prediction was saved. 121 existing non-null EYE records from the previous 236-race export were passed through unchanged; this is preservation verification, NOT a new precision study.

User-provided 105R results (current16/66, integrated24/76, fill21/76) are reported research, NOT independently reproduced here: their full locked inputs, identities and audit artifacts are unavailable. The prior 15-race archive subset remains exploratory. Future independent outcomes and actual caller-authored audits must be monitored before claiming improved precision.

## Deploy / rollback / operation
Compare the current production bundle SHA with the v23 backup immediately before deployment. Abort on concurrent change. Upload the unchanged complete current bundle plus this helper and the small index patch. Keep auth, verify_jwt and guards. Roll back ONLY this deployed version using the local original bundle if needed; never overwrite unrelated later work.

Normal operation: authorized CLAIM -> context includes instructions -> evaluate all runners and current EYE normally -> if eye=null and short turf, perform the additional review and record it -> existing rank preview -> if membership changed finish existing independent EYE re-audit first -> preview again with valid final whole-field review -> inspect filled eye/grade/reasons and audit -> unchanged guarded save MCP. Never use research/preflight input as a substitute for a fresh authorized CLAIM. Respect lease and post-minus-three-minutes.

A real authorized CLAIM/preview/save confirmation must be reported separately. No new CLAIM or FROZEN is created solely to claim a successful test.

## Actual production outcome
MCP v24 deployed at 2026-11-15 10:48:39 JST. The v23 baseline hash and exact original source were compared before upload; all ten deployed files matched the submitted bundle on readback. Actual paths are preview READY proposed_payload and the real pre-save handler after existing ranking. No DB/protocol/guard change occurred.

The expired CLAIM read returned expected CONTEXT_UNAVAILABLE; this verifies runtime loading and continued denial, NOT successful valid-context execution. A SELECT found zero valid JRA_QUEUE_RESCUE CLAIMs. Actual formal live fill and production save are still UNVERIFIED; zero predictions were saved by this change. A future evaluator must submit a real audit through a normally authorized CLAIM. No unfinished audit is auto-marked complete.

Standalone Deno typecheck was unavailable. Node's --check (including its strip-types flag) rejected the existing TypeScript annotation syntax, so this is SKIP, not a candidate TypeScript test PASS. The plain JS modules and extracted production hook tests passed, deployment accepted the bundle, and the MCP loaded it for the denial smoke.

Before deployment, local exported baseline had one extra final newline from file materialization. That was corrected and exact equality against production confirmed before upload; the eight hook tests were rerun after this normalization, not counted twice. The public patch remains only the intended insertions.
