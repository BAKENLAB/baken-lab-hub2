# BAKEN LAB | JRA saved-data utilization audit | 2026-10-23

## Why this audit exists

The new v0.4/v0.5 score experiments were flat or worse than frozen LAB despite the much richer saved race history. Review **what is already stored, what the active baseline truly uses, and what a supplemental source has accidentally discarded**.

All figures below from SELECT queries against production Supabase project qjlvsndiqjfsfjinilig. Archived race results are only used as historical events; no current target result may be included in forecast features.

## Data inventory

| Collection | Observed volume/coverage |
|---|---|
| jra_lab_races | 30,037 races, 2018-01-06 through 2026-09-13 |
| jra_lab_runs, record_role=full_runner | 415,165 horse starts |
| Runner last3f / last3f rank | 411,688 of 415,165 |
| Runner corner positions | 409,679 of 415,165 |
| Runner trainer/jockey | 415,165 |
| Runner body-weight change | 373,572 |
| jra_lab_races halon_times | 28,927 of 30,037 |
| course_layout | 1,815 of 30,037; **no 2025-2026 labeled class rows had it** |
| archive_complete=true | 24 races only; must NOT conflate full_field=true (~30k) with complete historic archive |
| jra_live_runners | 4,019 stored runner rows; 3,322 with at least one live past run |
| jra_live_runners.past_runs flattened | 11,198 runs; 10,515 have final3f, all 11,198 have corner_positions key |

**Availability != predictive benefit**: of historical full_runner results, 40,582 finished 4th-10th while still holding a top-3 final3f rank. This is useful for studying performance patterns, but not evidence that blindly promoting them improves accuracy.

## What BASE_CORE_0.1 actually uses

Source: production public.jra_live_base_candidate_v1 (read as deployed pg_get_functiondef):
- The calibrated base_rate is looked up using *coarse segment* (MAIDEN, CLASS1, CLASS2_3, OPEN_GRADED), last four races' podium count, and **last four mean winner gap bracket** (plus fallback based on podium count if small sample), learned on 2025 stats.
- base_rank orders by base_rate descending, mean margin ascending, then horse number.
- same_class_close4, near_distance_close4, same_track_close4 and residual_fit_count are computed but DO NOT enter base_rate or main base_rank. In this function, these residual conditions are primarily used for an EYE candidate process for maidens. **This is only the automatic base scorer**, not proof that a human/agent final saved evaluation never considered the conditions.
- The claim context already supplies jockey, trainer, weight, equipment, etc. but its merged history packet does NOT include detailed last3f rank, archived corner positions or halon splits. History was intentionally capped at four races.

## Archived but not exploited by current base ranking

1. Last3f rank and absolute 3f, full corner positions and position gain after the last turn.
2. Race halon fractions and pace context; the current base rank does not have a pace interaction.
3. Same-course/distance/surface form older than four runs (especially relevant after recent surface switch).
4. Opponent field quality, strictly dated future results of historical opponents known before the target race.
5. Prior class, relative distance mismatch, going, jockey history, carried weight differences and equipment changes are stored and/or in claim context but not jointly calibrated into current BASE_CORE. These fields must only be used when known before start.
6. Old separate JRA_BETA_0.1 experiment: 17,621 score rows 2026-01-04 to 2026-09-13, pace_score present in 7,522, jockey_score in 14,857, transition_score in 4,100. This does NOT imply its accuracy is better or it can be copied into production.

## Specific reproducible discarded-data cases

**エルナト (2026-10-17 新潟9R)**: 2026-09-20 中山芝2000m current-class 2nd / 0.1s behind winner; known in live past_runs but no archived detailed record because the detailed race archive ends 2026-09-13. Old shadow dropped that excellent base fact. v0.5 retained it. Source-attributed v3 additionally recovered final3f 37.5s and corners [2,2,2,1] without inventing its within-field last3f rank.

**ガラク (2026-10-18 東京8R)**: Recent four mostly turf and one dirt1200 fifth. Archived older-than-four record: 東京ダ1600 first (2025-05-24; 3f rank2), 東京ダ1600 second (2025-05-04; 3f rank2), 東京ダ1400 third (2025-02-08). These occurred before the target but were not in the four-run main scorer. Old same-condition form is a **review factor**, not an unqualified upgrade, because the 2025 wins and placings include maiden class.

## Do not promote all late-speed horses

Historical exploratory next-race cohort: previous run 4th-10th, following race within 180 days, same surface and class, distance difference <=400m, all dates within JRA archive through 2026-09-13.

2026 results:
- Turf previous 4th–6th: 3F rank <=3 => 27.2% next top3; rank >=4 => 27.1%.
- Dirt previous 4th–6th: 25.1% vs 27.7%.
- Turf previous 7th–10th: 17.9% vs 16.0%.
- Dirt previous 7th–10th: 12.6% vs 16.5%.

No reliably positive universal 3F-only lift in these uncontrolled groups. The proper next step is **interactions**: condition class, race pace, relative closing position, course, field, margins and reliable as-of cutoff, not a blind 3F bonus. This is exploratory and observational, not causal or calibrated.

## New optional read-only implementations (production DB)

- private.jra_optional_content_evidence_v3(date,track,race_no)
  - baseline merged runs retained regardless of rich archive;
  - if an archived detailed run is not available, take numeric final3f and corner sequence from a **uniquely matched live past-run** (exact past date/track/surface/distance);
  - explicitly marks final3f_source VERIFIED_ARCHIVE, LIVE_PAST_RUN_FALLBACK, or NOT_AVAILABLE;
  - no fabricated final3f rank from raw seconds.
- private.jra_v06_evidence_bundle_v1(date,track,race_no)
  - per-race whole-field bundle including v3 recent details and pre-target historical rivals.
  - 2026-10-17 新潟9R: 14 runners, 55 recent histories, 48 archive-sourced 3F values, 6 live fallback 3F values, 1 unavailable, zero target/future event dates.
- private.jra_older_course_evidence_v1(date,track,race_no)
  - **rechecks all runners** for archived older-than-four evidence with the target surface and <=400m distance difference, at most 12 events per runner, horse ID+name match;
  - 2026-10-18 東京8R: 16 runners, 13 with at least one matching old run, 10 with an older podium run; ガラク had 6 old matching races, including two 東京ダ1600 podium results. No score effect.
- private.jra_v07_evidence_packet_v1(date,track,race_no)
  - merges whole-field recent+older evidence as a separate optional diagnostic (no write).
  - verified 東京8R: 16 recent and 16 older runners, 16 live-fallback 3F values, no result dates at/after target and no supposedly "older" event inside recent four.

Database operations were only new private functions and SELECT verifications. No existing FROZEN changes, BASE_CORE changes, official JRA CLAIM/SAVE changes, Cron restarts, or paid calls.

## Important state and recommended next experiments

Production JRA_MAIN protocol remains **JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023**. The new reader does not automatically attach to the official CLAIM payload; production core rank remains BASE_CORE_0.1. Experimental v0.5 shadow did not improve podium capture in 38 inspected races: 73 vs 73, so **NO permission to claim predictive uplift**.

Prioritize:
1. A standardized all-runner evidence ledger: four recent fundamental performances + source-attributed full race content + older condition-fit proof; do not penalize absent optional data.
2. Separate **peak ability**, **current consistency**, **class transfer**, **relative distance/course**, **pace/late-3F interaction**, and **historical opponent quality** instead of collapsing everything into arbitrary bonuses.
3. Explicit quality controls for identical horse ID, source freshness and a strictly earlier-than-predicted-race date.
4. Freeze a candidate design before testing on unseen future JRA dates; track top3 newly captured **and** top3 displaced and split by class/surface. Never modify previous frozen predictions or confuse a postrace explanation with pre-race predictability.

**Verdict:** Saved information is plentiful. Two exact discarded-evidence defects are now addressed by read-only functions (recent archive gaps; relevant older-than-four course evidence). No claim of automatic accuracy improvement until independent testing.
