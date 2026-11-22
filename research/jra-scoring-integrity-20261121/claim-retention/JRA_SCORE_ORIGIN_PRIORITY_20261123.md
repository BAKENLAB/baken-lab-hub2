# P0: JRA fact→100-point generator — current root-cause inventory (2026-11-23)

Scope: production Supabase qjlvsndiqjfsfjinilig read-only SELECT and inspection of deployed `jra-claimed-mcp` v42 (no changes to production, FROZEN, CLAIM or main). PR #83 research only.

## What actually exists

The deployed JRA MCP v42 contains `inspectJraFullDepthSave`, which validates independently **submitted** `base_score + evidence_effects[].points` against an independently **submitted** whole-field ranking, and then applies a separate small Eval bridge if authorized. Its index and helper modules do **not** contain a recovered, fixed function mapping official race history into each base and factor point. `score_method` is not referenced in the inspected runtime modules.

Therefore full-depth save guard success cannot be equated to the **generation** of correct/identical points from identical official facts. The formal fixed scoring generator and submission's numeric decisions remain unverified.

## Production FROZEN sample (only factual aggregate; not hindsight fitting)

- 2026-11-21: 20 JRA FROZEN; 13 with per-horse source/effect arrays (194 horses, 4,420 recorded factor rows). Of those, 4,334 use `CLAIMED_CONTEXT_RUN:` fallback-style references and 86 use an explicit `JRA_CLAIMED_CONTEXT...` reference format. Recorded factor kinds include `pace` (421 rows).
- 2026-11-22: 18 FROZEN; 256 full-field horse reviews; 5,397 recorded individual factor rows. **All 5,397** refer to `CLAIMED_CONTEXT_RUN:` tokens, not an archived official original-body ID/hash. `pace` has **0** scored entries, although it existed on Nov21; official archive-lap-detail audit was also missing (0/18). It is not valid to infer all 2026-11-22 pace information was available or ignored — that requires the original input snapshots.
- `score_method`: 20/20 on Nov21, 0/18 on Nov22. `full_depth_comparison`: 20/20 vs 0/18. On Nov22 the alternative `full_depth_source_review.ok` was claimed 18/18, but is not source authenticity.
- Spot-check aggregate ranges demonstrate variability, not confirmed incorrect weighting: `class` Nov21 -4..5 / Nov22 -5..12; `margin` Nov21 -6..4 / Nov22 -5..10; `distance` Nov21 -4..3 / Nov22 -6..6. Different racing contexts can legitimately create different signed impacts. Never reverse-fit outcomes into scoring coefficients.
- 2026-11-23: public `jra_live_races` lists Tokyo and Fukushima, 24 race cards and 359 runners; all 24 source queues `done`. At initial read-only inspection, `jra_prediction_jobs` and JRA FROZEN were both 0. This is **not** by itself a defect before normal claim windows.

## Actual new guard (research only)

`fixed-score-contract.candidate.mjs` requires a separately generated, server-owned score packet with:
1. operator-pinned policy ID/digest and exact CLAIM context digest;
2. independently computed base-score proof per horse and full-field coverage;
3. each factor linked to exactly one verified selected official run/horse and original-body SHA-256;
4. independently calculated signed rule points matching submitted audit components, base sum and pre-bridge score;
5. no `CLAIMED_CONTEXT_RUN:` surrogate pretending to be immutable original evidence.

Any missing component refuses. The module **cannot** make a genuine authenticated scorer appear where none exists, and it never returns `formal_scoring_allowed:true`. Synthetic CI proves the contract is fail-closed; it is not a real provider-to-score certification. The independent `auditSubmission` now records the gate's failure alongside other research findings.

## Exact work that remains before real deployment

- Recover original fixed numeric generation rule and original as-of selected source snapshot, if it was ever recorded. Current evidence indicates manual numeric submission; historical frozen scores alone cannot prove how the points were originally decided.
- Alternatively specify a **new**, explicitly approved and version-pinned scorer; benchmark against out-of-sample, result-hidden, pre-race evidence. No new scoring policy has been approved or installed in this batch.
- Supply verified full original-body/selected-source IDs through the authorized production CLAIM / server reader with fixed parser and approved storage, retaining evidence checksums. This is currently unimplemented.
- Rebase candidate (v39) to the deployed v42 after review and test authentic MCP transport, bounded store, as-of cutoffs, EYE 17-item semantic checks and rollback. Explicit approval required before any change to production.

**Release verdict: NO.** No work here implies 2026-11-23 HUB's predictions have regained validated accuracy. Existing FROZEN and live safeguards remain untouched.
