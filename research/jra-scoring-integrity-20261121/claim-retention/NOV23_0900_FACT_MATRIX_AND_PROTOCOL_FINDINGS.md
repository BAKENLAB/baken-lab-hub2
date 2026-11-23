# BAKEN LAB JRA0.4 P0 handoff — 2026-11-23, before first start

**Status: isolated research only; no CLAIM, FROZEN, production DB/MCP, Cron, scoring policy or operator permissions changed.**

## Production root cause evidence (READ-ONLY confirmed)

- Active `public.lab_prediction_protocols` JRA_MAIN is exactly `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023`.
- It explicitly defines `BASE_CORE_0.1_UNCHANGED`, source evidence as **OPTIONAL** with `CONTINUE_BASE_CORE_NO_PENALTY`, and an **optional manual whole-field ranking** based on race evidence. There is NO formally specified per-factor numeric point schedule in the active protocol record.
- 2026-11-15 JRA 27 FROZEN, 11/21 JRA 20, and 11/22 JRA 18 **all have the exact same protocol_version**. However `audit.score_method` was present for 27/27, 20/20, 0/18 respectively; legacy `full_depth_comparison` present for 27/27, 20/20, 0/18.
- Thus version change of the operator protocol does **not** explain missing Nov22 method provenance. Qualitative manual rank decisions may be race-dependent; **invariance of the actual hundred-point scorer is unproven**.
- The exact active protocol source was captured read-only at 08:57:56 JST in `observations/jra-active-protocol-asof-20261123-readonly.json`. Do not invent weights from target outcomes or treat the qualitative manual rule as a deterministic scorer.

## New actual pre-start 100%-field evidence material (READ-ONLY)

- `observations/jra-20261123-basecore-prerace-readonly.json`: 08:10 JST, 23 JRA flat races/345 runners, 20 BASE_CORE-ranked races/302 runners and 3 unsupported /43 runners.
- `observations/jra-20261123-fukushima-all-histories-prerace-readonly.json`: 08:33 JST, 11 races/173 horses/556 prior runs.
- `observations/jra-20261123-tokyo-all-histories-prerace-readonly.json`: 08:34 JST, 12 races/172 horses/439 prior runs.
- `observations/jra-20261123-target-conditions-prerace-readonly.json`: 08:55 JST, 23 pre-start targets including surface, distance, going, class and post time. This last input was captured later than the horse-history data but still before target races began.

`claim-retention/prerace-fact-matrix.mjs` now deterministically joins these three observations across the entire field: **23 races, 345 horses, 995 prior-run observations**, all as-of-before-post. Each runner gets a canonical research observation hash, rest days, track/surface/distance match, available margin, last3f and verified-available corner positions and explicit missingness. It never treats an unsigned synthetic observation hash as an official run ID or an issuer signature. It returns `formal_100pt_score:null`, `submitted_evidence_points:null`, no EYE, and `formal_scoring_allowed:false` for every runner. The 995 run observations still have no verifiable original-run ID/raw-body SHA/source-ref triples.

`tests/jra-prerace-fact-matrix.test.mjs` confirms complete field/horse/race coverage, pre-start cutoffs, zero invented numeric effects, opponent/pace nulls, no market data, input permutation invariance of the semantic fact digest, independently mutable raw snapshot receipts, and refusal of missing/duplicated/future run data.

## Explicit protocol/scorer release guard

`claim-retention/protocol-scoring-readiness.mjs` and `tests/jra-protocol-scoring-readiness.test.mjs` pin the **actual active JRA0.4 protocol**, and classify all 65 Nov15/21/22 historic JRA FROZEN records as `FULL_SCORE_UNPROVEN`, including 18 Nov22 missing score-method markers. An audit claiming `full_depth_source_review.ok` cannot self-authorize the numeric scorer.

Even hypothetical server-owned original-issuer, exact-CLAIM and approved-policy flags only return `ELIGIBLE_FOR_SEPARATE_FULL_SCORE_REPLAY`, never `production_release_allowed:true`: source bytes, pre-start cutoff and exact 100-point generation must be independently replayed and verified.

## Test evidence

- Both isolated CI jobs (Node and PostgreSQL) **SUCCESS**: [GitHub Actions run #45086141418](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45086141418).
- All pre-race captured data and active protocol snapshots are stored on Draft PR #83, not deployed or merged.
- No target result was used in any scoring coefficient; no source of numeric weights was approved or reconstructed.

## Remaining P0 before actual production usage

1. Recover or approve a single numeric source-fact→per-factor→100-point generator that is genuinely compatible with source facts and validated results-blind over historic out-of-sample as-of datasets. The current protocol explicitly allows manual rank overlay without numeric rule; pretending it was recovered would recreate the same failure.
2. Wire an *authorized* JRA original past-run body/issuer reader, not only current race card HTML or a read-only source metadata hash, with selected run+horse/source SHA, exact active CLAIM and immutable time cutoff; verify against full field.
3. Reconcile the approved policy's handling of optional evidence (legacy JRA0.4 fallback) with a strict certified full-depth gate, and version-label baseline-only vs manual experimental vs certified deterministic; do not silently block valid normal baseline saves or claim evidence was complete.
4. Explicit operator approval and safe v42 production deployment/rollback separate from this Draft PR. **No live rollout done.**
5. Today's live CLAIM/FROZEN work is a separate guarded operational task. As of the last read-only queue status, the ordinary JRA save flow had not started; do not call the above research proof a saved prediction.

**Verdict: factual source inputs now deterministic and traceable as captured, but live signed original binding plus formal 100-point model is NOT COMPLETE.**
