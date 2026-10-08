# CLASSIC EYE restoration candidate — 2026-10-08

## Purpose / user request
Recover the **late-September 2026 LAB 🧪EYE selection process** without touching production LOCAL/JRA, frozen predictions, ranks, odds separation or bet suspension. This is a restoration *candidate*, not a verified historical byte-for-byte rollback and not deployed.

## Sources and confidence
- 2026-09-23/24 conversation notes: rank all ACTIVE runners without popularity/odds; fix TOP5; re-audit ALL outside-TOP5 horses once more; pick **one** horse whose *current* race conditions permit it to outperform its baseline ranking. Position 6 is not automatically EYE. Review course, distance, pace, passing order, margins, class, weight, going, draw, direct comparisons and meaningful condition changes.
- 2026-09-25 notes: where field size > 5, intended one EYE; no EYE for 5 or fewer. No invented evidence if source data is missing.
- 2026-10-04 frontend changelog, commit `6aecd817eeacbdf9bce715b9f75a064b09e34a15`: LOCAL 1.5 claims all outside-TOP5 pairwise comparison and permits EYE abstention.
- Present LOCAL v6 baseline copied from branch `codex/local-input-archive-20261008`, file `research/local-input-archive/baseline/local-ai-worker-v6/index.ts`.
- The exact preserved `lab_eye` subsection from `public.lab_prediction_protocols` version `CHAPPY_LOCAL_1.0_20260925` has now been read without modification and archived under `historical/local-1.0-eye.json`. This is an actual original policy, **not proof** it matches the later LOCAL 1.1 worker used on 2026-09-28. Historical LOCAL 1.1 exact worker source/pre-race context snapshots remain unavailable.
- Read-only DB checks: Sep 28 LOCAL 1.1 has 34 EYE selections, with 13 in the top 3 among only 18 matched finish positions (16 unverified); this matches the prior 13/34 recorded figure, but unknown outcomes must not be counted as confirmed losses.
- Popularity matched counts: LOCAL 1.1: 117 matched, popularity 1-3:38, 4-6:37, 7+:42; LOCAL 1.5: 40 matched, 1-3:8, 4-6:15, 7+:17. Differing dates, field sizes and missing matches; descriptive trend only.

## Candidate change
- Modify **only prompt-side EYE criteria** in the LOCAL v6 code; retain model, API call count, full-field ability ranking, fixed TOP5, S–F grading, protocol string, JSON shape, frozen save route and suspended bets as baseline for review.
- Compose a research-only protocol view that replaces **only `lab_eye`** in the active LOCAL 1.5 protocol with the saved LOCAL 1.0 section; the active Supabase protocol stays unchanged. The historical `not_allowed` text expressly forbids favoring longshots/high odds. Candidate prompt also expressly forbids dismissing 1st/3rd favorites when outside TOP5 and rejects rank6/rank7 heuristics. Other 1.5 output/audit structure is retained for compatibility review.
- Replace *unanimous win in all unordered candidate pairs* as a selection requirement. Keep unordered pairs as diagnostic audit records to preserve current JSON/save expectations, but choose EYE based on concrete current-condition upside versus other excluded horses.
- Restore one EYE per race with >5 ACTIVE runners when evidence is sufficient; allow null with explicit missing-evidence explanation instead of inventing facts.
- Add guards: full unique outside-TOP5 candidate set, exactly one matching EYE flag, and unique comparison pairs. LAB RANK is neither recomputed nor subjected to an additional rank-validation gate.
- Does **not** reproduce historical judgment quality merely by matching prose. Current protocol content may still conflict; no model output quality or DB save acceptance tested.

## Mandatory checks before any real deploy
1. The historic `LOCAL_MAIN` lab_eye sections 1.0/1.4/1.5 have been read from Supabase. Present worker substitutes the original 1.0 EYE subsection locally; other sections stay 1.5. The database's `lab_save_claimed_prediction` is version-gated to 1.4/1.5 and requires the active version, so deploying a new named CLASSIC protocol needs independently reviewed DB contract changes. **BLOCK DEPLOY** until this is designed and tested.
2. Preserve originals; select a new versioned protocol / explicit rollout gate. Do not label changed behavior as unchanged LOCAL 1.5 in a real system.
3. Run `node --test research/classic-eye-restore-20261008/tests/classic-eye-worker.test.mjs` in Node 24; tests use synthetic contexts and no OpenAI calls. Then run all existing LOCAL tests, schema/runtime, verified DB validation.
4. For **forward** SHADOW comparison, archive the identical pre-race context and independent EYE choices before off time. Compare classic to 1.5 without changing FROZEN and without results contamination.
5. Validate expected error/abstention behavior, market separation, no forced rank6 selection, deploy access rights/security and no unapproved API spend.
6. Request explicit confirmation before editing any production protocol, function, queue, FROZEN row or related scheduled worker. No JRA changes.

## Status
- GitHub isolated branch ONLY; no production migration, worker deploy or API call.
- Isolated exact candidate `promptFor` and `expandPayload` functions were executed with synthetic fixtures using basic TypeScript type stripping: **10 PASS / 0 FAIL** (exact original protocol subsection, removal of 1.5 EYE all-pairs-win requirement from composed prompt, non-EYE grade settings retained, explicit popularity neutrality, selecting rank8, rank/TOP5 unchanged, output unaffected by popularity metadata, candidate coverage, EYE case agreement, pair uniqueness, null abstention). **NOT** a model inference, Node 24 full suite, backend save or DB test.
- Node 24 full worker test file is **written, not yet run**. New candidate is **NOT production-ready**.
- API credits were exhausted on 2026-10-08, so even a safe rollout would not resume paid LOCAL calls without a separate approved funding/architecture decision.
