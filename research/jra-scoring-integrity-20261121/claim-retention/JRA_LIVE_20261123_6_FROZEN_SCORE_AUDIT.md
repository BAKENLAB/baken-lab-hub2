# 2026-11-23 JRA first six FROZEN scoring audit (read-only)

**Audit scope:** authorized production Supabase SELECT on 2026-11-23 after six successful guarded official JRA MCP FROZEN operations. No scores, rank, FROZEN, Cron or production code changed.

| Track | R | Frozen JST | Horses | Final TOP5 | Prediction ID |
|---|---:|---|---:|---|---|
| 福島 | 1 | 09:26:17 | 16 | 12-5-10-13-3 | `20095291-3a18-4481-b1bc-4622f99263cf` |
| 東京 | 1 | 09:27:12 | 13 | 12-4-7-13-9 | `3fe74e69-4749-4096-a502-3bb9475395ba` |
| 福島 | 2 | 09:28:06 | 15 | 5-11-7-4-10 | `edc0789c-20fb-492f-8829-b6489e86280b` |
| 東京 | 2 | 09:28:17 | 17 | 1-7-12-6-16 | `5af61057-87e6-4325-afa4-4ab0dbd74192` |
| 福島 | 3 | 09:36:00 | 15 | 9-11-12-5-8 | `0c6d0274-dc37-46a9-8785-f15e60e995bd` |
| 東京 | 3 | 10:00:57 | 11 | 3-7-2-8-10 | `84d4f7a5-e4bf-4542-b15e-f03f903ac5b5` |

## Independent actual numeric FROZEN integrity

- 6 races / **87 runners**; all unique horse IDs inside each race.
- For all 87: `clamp(0, 100, base_score + SUM(evidence_effects[].points)) == audit.runner_history_checked[].score_after`: **0 mismatches**.
- `audit.evidence_rank_bridge.per_runner[]` independently bridges manual scores/rank to final FROZEN, with 0 differences against final `payload.runners`; applied delta and score-before/after arithmetic 0 mismatches.
- **7 horses** have final scores and/or rank changed from the manual-review stage, all explained by the bridge. **4 horses** received a recorded +1 point Eval/verified-close-loss delta; every nonzero delta has a `verified_proof` record (0 lacking proof). 3 additional ranking differences are ordering consequences.
- Fukushima 2R: +1 for horse 10, horse 8, horse 2; Tokyo 3R: +1 for horse 7. All cases linked to `audit.evidence_rank_bridge.per_runner[].verified_proof.close_loss` official-lap/position/detail claim. The actual original-byte issuer signature remains unverified; bridge-provided documentary proof is not identical to authenticated original-body proof.
- None of these arithmetic/rank changes alone proves the appropriateness of the **manual numerical factor weights**, so do not label as the restored formal 100-point scorer.

## Specific suspected scoring-systematic bias: counts of historical runs

Read-only aggregate of 87 stored review entries grouped by `source_refs` count:

| Prior runs per horse | Horses | Mean BASE_CORE score | Mean sum of manual effect points | Mean points per prior run |
|---:|---:|---:|---:|---:|
| 1 | 23 | 37.04 | +3.22 | +3.22 |
| 2 | 18 | 38.06 | +6.33 | +3.17 |
| 3 | 5 | 40.80 | +16.00 | +5.33 |
| 4 | 41 | 38.46 | +13.93 | +3.48 |

The provisional manual method sums the same classes of factors for **every historical run**, rather than normalizing or capping evidence contribution per horse. Thus even with similar base scores, horses with more history often receive materially larger total effects. This is a **demonstrated exposure to history-volume bias**, not definitive proof that the horse-performance correlation is wrong; the data is observational and quality/selection differ across groups.

Tokyo 3R is a specific audit candidate: horse 3 had 3 earlier runs and +25 manual effect points; horse 2 had 1 earlier run and +10; horse 7 had 3 earlier runs and +19 then a separate +1 Eval bridge adjustment. Do not retroactively alter this FROZEN: compare the fully frozen original scores and officially confirmed race outcomes first, including a results-blind normalized/capped **research shadow**, never claim one shadow is approved policy until tested.

## Original source disclosure and limitations

All **87** runner historical reference groups recorded in this cohort are `CLAIMED_CONTEXT_RUN:horse_no:prior_index` synthetic references to the immutable CLAIM context, not an issuer-verified raw previous-race original-body SHA. `official_original_body_sha256_verified=false` and `fixed_operator_scoring_policy_approved=false` remain correctly disclosed in the official audit. No ad hoc weights may be elevated to an authorized deterministic engine from the fact that arithmetic matches.

Keep the previously configured **11/23 JRA scoring-anomaly audit** separate from the existing JRA results monitor. Notify only on new certified results or new verified anomalies, distinguish model choice from structural arithmetic defects, and preserve all existing FROZEN.

**Finding:** production storage integrity (87/87) verified; source-to-factor and factor-weight validity unproved; history-volume bias is a high-priority research hypothesis. Current next ordinary eligible JRA intake is Tokyo 4R at **10:20 JST** (11:30 scheduled post), pending fresh official eligibility/CLAIM checks.


## As-of results-blind robustness shadow: sum vs mean per-history effects

READ-ONLY sensitivity test on the six already-FROZEN races, calculated using ONLY the originally saved manual review stage before the Eval bridge:
- Original: `manual_score = clamp(base_score + SUM(points for each of all reviewed prior runs))`; the draft `rank_after` records this order.
- Shadow: `research_shadow_score = clamp(base_score + round(SUM(points)/number_of_prior_runs))`; ties use `base_rank` then `horse_no`. This is an **unapproved research contrast**, NOT the correct historical operator model, NOT a formal rank, and NOT a replacement save.
- **5 of 6** races change at least one TOP5 member; **4 of 6** change the draft ◎. This is meaningful model fragility and should be included in the existing 11/23 scoring-anomaly investigation once official results are final.
- Eval bridge (+1 verified adjustment to four horses) is not applied to either manual-stage comparison. Never compare this shadow directly to final FROZEN rank without adding or explicitly excluding the same later Eval effects.

| Race | Original manual TOP5 before Eval | Research mean-effect TOP5 | Entered / exited TOP5 |
|---|---|---|---|
| 東京1 | 12-4-7-13-9 | 7-12-4-9-10 | 10 / 13 |
| 東京2 | 1-7-12-6-16 | 1-12-7-3-16 | 3 / 6 |
| 東京3 | 3-2-8-7-10 | 2-10-8-3-9 | 9 / 7 |
| 福島1 | 12-5-10-13-3 | 5-12-13-10-1 | 1 / 3 |
| 福島2 | 5-11-7-4-10 | 5-11-4-7-6 | 6 / 10 |
| 福島3 | 9-11-12-5-8 | 11-9-12-5-8 | none |

**Do not promote mean-effect shadow to official scoring.** The evidence establishes sensitivity to historical run counts, not which formula predicts correctly, and neither formula has an approved operator factor-weight policy. Preserve all six existing FROZEN exactly as recorded.
