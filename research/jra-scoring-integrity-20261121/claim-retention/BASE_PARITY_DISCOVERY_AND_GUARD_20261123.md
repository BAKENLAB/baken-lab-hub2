# P0: reproducible JRA base-score calculation — 2026-11-23 JST

**Research-only, no production writes, no new CLAIM, no FROZEN changes, no deployment.**

## Source and verified arithmetic

The saved 2026-11-21 deep-analysis audits repeatedly declare an independent base `round(30 + 38 × base_rate)`. `public.jra_live_base_candidate_v1(race_date, track, race_no)` produces `base_rate` (from the live source and historical data).

Read-only cross-check, as queried on 2026-11-23, against the exact preserved `audit.runner_history_checked[].base_score`:

| Cohort | Horse rows | Matches to `round(30+38×currently_recomputed_base_rate)` | Races containing disagreement |
|---|---:|---:|---:|
| 2026-11-21, 13 FROZEN with explicit base/effects | 194 | 194 | 0 |
| 2026-11-22, Tokyo/Kyoto 1–3R | 81 | 81 | 0 |
| 2026-11-22, Tokyo/Kyoto 7–12R | 175 | 15 | 12 of 12 |

Overall: 450 horse rows inspected; 160 afternoon mismatches. Recorded base minus current-formula base ranges from -16 to +13 in mismatched Nov22 races. First mismatch-containing FROZEN: Tokyo 7R 12:54 JST (Kyoto 7R 12:55 JST). This predates the first observed v40 JRA MCP edge request at 13:00 JST, so that later deploy alone cannot explain the first discrepancy.

**Major causal limit:** `jra_live_runners.updated_at > FROZEN` for 81/81 morning runners and 143/175 afternoon runners on Nov22, and for 284/298 of the Nov21 combined race entries. The as-of-original `base_rate` snapshot was **not recovered**; historical current-base comparison cannot distinguish changed source data from changed submitted score policy. The inspected rank/diagnosis/research snapshot tables contain no rows for these dates. Do not declare a proven scorer regression solely from these post-race comparisons.

For the 13 Nov21 and 18 Nov22 deep-recorded races, independently checking `clamp(base_score + sum(evidence_effects[].points))` and subsequent recorded Eval bridge found **zero arithmetic mismatches** in all 194 + 256 reviews. The missing property is therefore source-to-base/factor determinism and trusted as-of inputs, not additive arithmetic.

## Changes implemented in Draft PR #83 (no production connection)

1. Added read-only comparison snapshot `observations/jra-base30-38-crossdate-readonly-20261123.json` with 450 immutable *observation rows* (not immutable original source packets); exact rational replay `claim-retention/recovered-base30-38-readonly.mjs`. No scores/ranks are rewritten.
2. Added prospective `baseline/mcp/jra-claimed-base-parity.mjs.txt`: using the **same single** `jra_claimed_context` snapshot seen by the save guard, compute `round(30+38×base_rate)` independently for *each active horse*, require equality with submitted `base_score`, require a server-only pinned research policy, fail closed on one mismatch, missing base rate, ID or coverage.
3. Wired it into the research-only `blocker-resolution/candidate-index.ts.txt` **before save**, along with existing independent full-depth and score-method checks. The optional Eval bridge cannot mask a failed core base check. A matching base cannot be promoted into proof of the full 100-point model: `formal_scoring_allowed=false` and `official_original_verified=false`.
4. Regenerated reversibility inventory, candidate patch and SHA-256 manifest. Preserved deployment blocker: candidate built on v39 while inspected production JRA MCP is v42, and formal engine is not pinned/approved.
5. Added isolated tests: exact PostgreSQL-equivalent decimal rounding, synthetic valid/mismatched/unpinned claims (no fake save on refusal), 450 historical comparisons, 31 race-level negative replay: 13/13 Nov21 and 6/6 Nov22 morning fields match current benchmark; 0/12 Nov22 afternoon fields match at the whole-field level.

Isolated CI of pre-documentation code: [GitHub Actions 45078617458](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45078617458) SUCCESS, both `isolated-ledger` and `isolated-postgres`. These are synthetic transport and read-only historical comparisons; they do not certify real official JRA original bytes or the full scorer.

## Remaining blocker to live reliability

An operator-approved 100-point generation contract still needs explicit policy and per-feature effects, not merely a recovered base formula. A real claim-scoped original-body reader with exact as-of run IDs, source hashes and trustworthy parser is unconnected. Preserve fail-closed logic in staging; do not deploy the v39-based candidate onto v42. Production promotion, private storage roles, signing, credentials and rollback require explicit separate approval. Existing FROZEN immutable. Results must not be reverse-fit to choose coefficients.

**Readiness verdict: base arithmetic partly recovered and prospective candidate guard tested; full official fact→100-point production connection NO.**
