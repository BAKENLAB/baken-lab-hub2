# 2026-11-23 JRA first four settled races — source-to-points scoring audit

**Classification:** read-only post-race research of original pre-start FROZEN and JRA_OFFICIAL settled results. **No FROZEN, score, guard, model weights, DB, or production deployment changed.**

## Settled outcome vs immutable FROZEN

| Track | Race | Official 1–2–3 | LAB rank for 1–2–3 | Top5 podium capture |
|---|---:|---|---|---:|
| 東京 | 1 | 4-5-7 | 2-12-3 | 2/3 |
| 福島 | 1 | 5-11-1 | 2-8-6 | 1/3 |
| 東京 | 2 | 12-13-11 | 3-17-8 | 1/3 |
| 福島 | 2 | 4-5-8 | 4-1-6 | 2/3 |

**4/4 winning horses in TOP5; 0/4 winning horses at LAB ◎; 1/4 ◎ top-three; 6/12 podium horses within TOP5.** All four forecast FROZEN timestamps precede scheduled post, and all results in source table have `source=JRA_OFFICIAL`.

## Material actually used vs only seen as available

For the first Fukushima/Tokyo 1R, `payload.audit.runner_history_checked[].evidence_effects` contains **nonzero scoring rows** for class, distance, course, going, raw winner margin, past-race corner positions, last3f and rest days. All 29 runners had a prior-run review (Fukushima 16 runners/32 observations, Tokyo 13 runners/26 observations). This establishes that these eight classes were actually used as numeric manual point effects, **not** that the effects were appropriate or the original source bodies were authenticated.

`payload.audit.evidence_rank_bridge` identifies 1,942 Eval normal course relations checked, but for these two races every actual Eval `applied_delta` was **zero** and no `verified_proof` per runner generated a point. Therefore, merely recording `eval_normal_relations_checked=1942` cannot be counted as score impact for these races.

Actual separate official prior-run body signatures: `official_source_refs=0` in the retained source review, `official_original_body_sha256_verified=false`. These are internal CLAIM context references, not authenticated original web body receipts. There is **no verified point effect attributable to full official split laps, same-race head-to-head opponent comparisons or opponent follow-on performances** in the two 1R audit records.

## Precise missed-horse examples — do NOT retroactively 'fix' based on outcomes

1. **Fukushima 1R:** LAB ◎12 finished 8th; actual winner 5 LAB 2nd. BASE_CORE 12:52, 5:53. Manual increments for four vs two previous runs: +26 for 12, +18 for 5; resulting scores 78 vs 71. Results-blind mean-per-run shadow produces 5:62, 12:58.5 and reverses first/second, but this does **not** certify mean-per-run as the correct model. Head-to-head 11/8 Fukushima1150m observed 12 finished ahead of 5, so 12 as a candidate was originally defensible; the observed concern is additional multi-run score inflation.
2. **Tokyo 1R:** Official second horse 5 had LAB rank12, base32, manual32 (+0). The earlier 10/17 Niigata dirt1800m 6th, 1.0 sec down, passed through 2→2→2→1 before a 40.4 sec final3f. Those values were **present** in the audit and scoring factors (last3f -4 over its past two races), but evidence of whether this was a 'strong losing run' or a fast overall pace is **not authenticated**. The model may underweight positional content vs late split; do not retroactively invent that reason.
3. **Tokyo 2R:** Official second horse 13 LAB rank17/17, base32, manual31 (-1) after a sole debut Kyoto dirt1800m 5th, 2.3 sec behind, 38.1 final3f; today's surface was Tokyo turf1600m. The observed failure is **a surface-transfer uncertainty blind spot** (no verified turf ability, manual distance -2, no independent adaptation factor). Actual podium outcome does not authorize hindsight positive turf points; compare the whole class of similar pre-race unknown transitions over multiple days.
4. **Fukushima 2R:** Official third horse 8 had LAB rank6 (final), with pre-Eval manual rank7 after 4 prior runs. Most recent Hanshin dirt1800m 1-win mares 6th, margin 1.0 sec; also an earlier Sonoda 1870m maiden 1st, margin 0.2. This is a **rank5/rank6 boundary / transfer evidence** audit candidate, not automatically a broken formula.

## Critical safeguards / next tests

- Historical-run-count bias: compare sum-of-effects and normalized/capped effects *only in results-blind research snapshots* with the same exact as-of prior field. Historical runner counts are 1–4, with an approximately 3–4 point average effect PER additional prior run in six-race broader cohort. Require a genuine out-of-sample comparison before suggesting any fixed policy.
- Source completeness: identify real issuer-authenticated past-run body bytes and any verified prior same-race opponents before claiming live full-depth scoring or Eval efficacy. Current manually selected weights are `JRA_REBUILD_0.4_MANUAL_ASOF_EVIDENCE_REVIEW_NOT_CERTIFIED_DETERMINISTIC`, not the recovered fixed engine.
- Safety: results never enter next-race score calibration or pre-race original immutable FROZEN. Existing PR #83 is Draft, not deployed. Any research shadow comparison is not a recommendation to rewrite past predictions.
