# CLASSIC EYE restoration candidate — 2026-10-08

## Purpose / user request
Recover the **late-September 2026 LAB 🧪EYE selection process** without touching production LOCAL/JRA, frozen predictions, ranks, odds separation or bet suspension. This is a restoration *candidate*, not a verified historical byte-for-byte rollback and not deployed.

## Sources and confidence
- 2026-09-23/24 conversation notes: rank all ACTIVE runners without popularity/odds; fix TOP5; re-audit ALL outside-TOP5 horses once more; pick **one** horse whose *current* race conditions permit it to outperform its baseline ranking. Position 6 is not automatically EYE. Review course, distance, pace, passing order, margins, class, weight, going, draw, direct comparisons and meaningful condition changes.
- 2026-09-25 notes: where field size > 5, intended one EYE; no EYE for 5 or fewer. No invented evidence if source data is missing.
- 2026-10-04 frontend changelog, commit `6aecd817eeacbdf9bce715b9f75a064b09e34a15`: LOCAL 1.5 claims all outside-TOP5 pairwise comparison and permits EYE abstention.
- Present LOCAL v6 baseline copied from branch `codex/local-input-archive-20261008`, file `research/local-input-archive/baseline/local-ai-worker-v6/index.ts`.
- Historical 2026-09-23/24 *exact worker code*, full DB protocol rows and representative pre-race context snapshots remain unavailable/UNVERIFIED. A retrospective hit rate cannot be used as a proven performance comparison without first checking original FROZEN selections and results.

## Candidate change
- Modify **only prompt-side EYE criteria** in the LOCAL v6 code; retain model, API call count, full-field ability ranking, fixed TOP5, S–F grading, protocol string, JSON shape, frozen save route and suspended bets as baseline for review.
- Replace *unanimous win in all unordered candidate pairs* as a selection requirement. Keep unordered pairs as diagnostic audit records to preserve current JSON/save expectations, but choose EYE based on concrete current-condition upside versus other excluded horses.
- Restore one EYE per race with >5 ACTIVE runners when evidence is sufficient; allow null with explicit missing-evidence explanation instead of inventing facts.
- Add guards: full unique outside-TOP5 candidate set, exactly one matching EYE flag, and unique comparison pairs. LAB RANK is neither recomputed nor subjected to an additional rank-validation gate.
- Does **not** reproduce historical judgment quality merely by matching prose. Current protocol content may still conflict; no model output quality or DB save acceptance tested.

## Mandatory checks before any real deploy
1. Retrieve and diff historical `LOCAL_MAIN` protocols and current `CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004` content, including DB-side validation. The candidate currently still passes active LOCAL 1.5 into the prompt — possible conflicting EYE rules **BLOCK DEPLOY**.
2. Preserve originals; select a new versioned protocol / explicit rollout gate. Do not label changed behavior as unchanged LOCAL 1.5 in a real system.
3. Run `node --test research/classic-eye-restore-20261008/tests/classic-eye-worker.test.mjs` in Node 24; tests use synthetic contexts and no OpenAI calls. Then run all existing LOCAL tests, schema/runtime, verified DB validation.
4. For **forward** SHADOW comparison, archive the identical pre-race context and independent EYE choices before off time. Compare classic to 1.5 without changing FROZEN and without results contamination.
5. Validate expected error/abstention behavior, market separation, no forced rank6 selection, deploy access rights/security and no unapproved API spend.
6. Request explicit confirmation before editing any production protocol, function, queue, FROZEN row or related scheduled worker. No JRA changes.

## Status
- GitHub isolated branch ONLY; no production migration, worker deploy or API call.
- The isolated pure `expandPayload` function was executed with synthetic fixtures using basic TypeScript type stripping: **6 PASS / 0 FAIL** (selected rank7, coverage, flag agreement, pair uniqueness, rank unchanged, null abstention). This is **not** the Node 24 suite, OpenAI inference, backend save, or DB test.
- Node 24 full worker test file is **written, not yet run**. New candidate is **NOT production-ready**.
- API credits were exhausted on 2026-10-08, so even a safe rollout would not resume paid LOCAL calls without a separate approved funding/architecture decision.
