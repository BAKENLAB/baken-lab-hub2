# JRA official fact→signed points deterministic research generator — 2026-11-23

## Actual source of the problem

Read-only inspection of the deployed JRA MCP v42 `jra-full-depth-save-gate.mjs` found that it checks:
- all claimed runner histories are present, past date precedes race, source references match claimed context;
- a listed factor has the basic required data (e.g., a nonnull `margin_to_winner`);
- submitted `base_score + sum(evidence_effects.points)` equals the submitted independent score (and Eval bridge separately).

**It does not contain a fixed rule mapping a specific observed margin/class/last3f/corner position/etc. to the signed numeric factor points.** Thus a 10-point margin contribution can pass if the caller supplies it, without deterministic regeneration from the observed margin.

Previous production read-only inspection: 2026-11-22 has 18 JRA FROZEN, 256 runner reviews and 5,397 effect records, all pointing to `CLAIMED_CONTEXT_RUN:` surrogate IDs rather than retained original-body identity. The old source-to-points generator has not been recovered. A source ID string alone cannot prove that the referenced race was authentic or that its score effect is justified.

## What is now implemented in Draft PR #83 (research only)

- `claim-retention/source-to-points-scorer.candidate.mjs` **generates** factor points from source fact values and an **explicitly supplied, unapproved policy** (no default weights). Handles direct margin, last3f, distance change, corner position delta, rest days, race class, going and same course. It refuses missing raw values, missing expected policy/thresholds, absent or inconsistent run/horse IDs, duplicate selections, post-target-date runs and unverified original-byte flags. Base is a separate exact rational replay of the *observed* research 30+38 formula.
- The only successful test policy has `classification=UNAPPROVED_RESEARCH_ONLY`, invented **synthetic thresholds for testing**, never adopted as the actual JRA model. No full-score weight coefficients are asserted or inferred from final results.
- `claim-retention/source-to-points-compare.candidate.mjs` checks the **separately generated**, full-field score and all per-run factors, source/ref hashes, final score and rank against a submitted prediction. It rejects caller-altered points or source identities and score/rank drift. It explicitly sets `production_allowed=false`.
- `claim-retention/submission-audit.mjs` now invokes this research comparator when its server-supplied fact snapshot/selected-run proof/policy exist. When they do not exist (the normal historical state), the research finding is `FACT_TO_POINTS_SOURCE_SCORER_UNAVAILABLE`; it does **not** fabricate inputs or overwrite FROZEN.
- Key and array orders are canonicalized so the same semantic source fact content and policy yield the same deterministic score, rank and audit hash even if retrieval order changes.
- Unsupported scoring categories `pace`, `opponent`, `race_shape`, `eval` are clearly reported as *unconnected*; `full_factor_coverage=false`. No verified late-opponent or halon-lap contribution has been silently imputed.
- `tests/jra-source-to-points-scorer.test.mjs` covers deterministic generation, comparison, fact perturbations, tampering, missing policy, incorrect original-run identity, surrogate references, future-date input, duplicate runs, absent required facts and permutations. Isolated CI runs this test with research fixtures; it does not reach an external provider.

## What this does NOT solve

1. The former actual official **per-factor numeric policy** has not been recovered or pinned. A brand-new approved policy with score contract, initial data provenance and blinded pre-race evaluation would be required if the old one is unavailable. **The synthetic example is not a new production policy.**
2. Authentic original JRA body bytes plus claim-scoped reader, trusted issuer, pinned extractor and selected original run IDs have not been connected to this generator. Flags from a research fixture do not constitute official authenticity.
3. The current official MCP is v42, whereas the standalone save candidate in PR #83 is based on v39. It cannot simply be deployed or merged to fix today’s races. The live endpoint has not been changed.
4. Pace/laps, direct opposition, opponents' later results, race shape, full EYE 17 review and bridge provenance are not fully replayed. Do not call this a complete 100-point engine.
5. No new CLAIM, prediction, FROZEN overwrite, production database modification, edge deploy, Cron, betting suggestions, or target-result fitting occurred.

## Connection decision

Research functionality advances from arithmetic checking to a **real (isolated) source-value→signed-point replayer** and full-field comparator. Its present readiness is `FORMAL_SCORE_ENGINE_UNCONNECTED`. Keep PR Draft, `automation/jra-score-ledger/engine-lock.json` unconnected, no live activation. Production promotion requires recovery/approval of the proper scoring policy, exact original-source proof and a separate explicit deployment approval.
