# BAKEN LAB — JRA 2025-learned/2026-validated research pilot

Research date: 2026-10-24 JST. STATUS: positive retrospective time split, RESEARCH ONLY — no production scorer activation.

## Strict time split and feature design
- Event archive from 2023 onward. Prior-horse history has SQL window ROWS BETWEEN 8 PRECEDING AND 1 PRECEDING; historical feature date strictly before target race date.
- Training: 2025-01-01 to 2025-12-31. Validation: 2026-01-01 to 2026-09-13, never used to fit weights.
- 2025: 3,455 stored races / 47,884 runner records. Of these, 3,031 segment-supported races / 42,165 feature rows; 41,166 rows had reconstructed valid BASE CORE 0.1 rates.
- FIVE factors learned conditional on model segment and coarse base rate bin: (1) close 4th–6th finish within 0.5 sec at same surface/near distance, (2) near-distance podium, (3) same-class close run, (4) race #5–8 historical same-track near-distance podium, (5) fast last3f while close despite 4th–10th finish.
- Historical group observed top3 residual relative to the reconstructed base rate, smoothed by n/(n+150), capped per group ±0.055. Sum of applicable 2025 coefficients damped 0.60 and total correction capped ±0.10. Formula fixed BEFORE validation.
- 62 coefficient groups saved as trained-2025-coefficients-v01.json BEFORE reading 2026 validation results. No odds, popularity, unknown news comments, or current-race result features.
- Experimental score_100 = 100 times the adjusted rate; this is NOT a calibrated win probability or production LAB ability grade.

## 2026 eligible full-field historical race comparison
Each included race required >=6 unique coded runners, with all target field runners having valid reconstructed baseline rates. This selects a SUBSET of the full archive, not every JRA race.

| Population | Races | Baseline captures (TOP5 actual top3) | New captures | Gained | Lost | Net |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ALL | 1,375 | 2,560 | 2,593 | 114 | 81 | +33 |
| Jan–Apr | 679 | 1,269 | 1,292 | 60 | 37 | +23 |
| May–Sep13 | 696 | 1,291 | 1,301 | 54 | 44 | +10 |
| CLASS1 | 518 | 952 | 968 | 60 | 44 | +16 |
| CLASS2_3 | 384 | 709 | 715 | 24 | 18 | +6 |
| MAIDEN | 331 | 669 | 674 | 14 | 9 | +5 |
| OPEN_GRADED | 142 | 230 | 236 | 16 | 10 | +6 |
| Turf | 688 | 1,298 | 1,308 | 53 | 43 | +10 |
| Dirt | 687 | 1,262 | 1,285 | 61 | 38 | +23 |

Matched race capture outcome:
- 1,199 unchanged
- 95 races net +1
- 62 races net -1
- 19 races +1 gained and -1 lost simultaneously, net zero.
- 401 runners newly promoted across the TOP5 boundary in the experimental ranking; 114 were actual placed horses but 81 previously captured placed horses were displaced.
- Relative total captured gain = (2593-2560)/2560 = 1.29%. Not +1.29 percentage points in win probability or an assured improvement in future wagering returns.

## Qualification

This is more credible than post-hoc fitting on the same 43/109 races, since year 2025 learned weights were frozen before observing THIS 2026 holdout evaluation. However:
- Prior feature ideas were informed by earlier inspection of some 2026 racing outcomes, so the holdout is NOT a completely untouched scientific discovery cohort.
- The reconstructed historical BASE CORE comparator is not an official FROZEN; no claim of +33 against October's saved BAKEN LAB.
- The BASE CORE lookup itself was trained on 2025 results (making 2025 in-sample to both training systems), but 2026 is chronological future of 2025.
- 2026 archive subset selection excludes insufficiently matched horse IDs/complete fields: 27,853 2026 feature rows extractable, 26,897 with baseline rates, 18,761 runners in evaluated complete-field races.
- Some 2026 data may have been backfilled; predictor only uses historical pre-target event dates, not exact byte-for-byte source snapshots from past prediction times.
- Historical source observations within horses, races and race dates are correlated, so a simple +33 does not prove significant accuracy uplift. A prospective shadow run and calibration are still needed.
- Exact "old race #5–8" flag is not yet reproducible for all upcoming live races through current CLAIM; do not silently apply a non-equivalent approximation.
- The predictor has NOT been connected to official JRA MAIN, FROZEN, EYE or save RPC. Live 0.4 / BASE CORE 0.1 remains active.

## Implementation paths
- sql/jra_research_asof_features_v1.sql — installed as private read-only historical as-of extractor.
- trained-2025-coefficients-v01.json — 62 coefficients committed/locked before holdout.
- sql/jra_2026_locked_coefficients_validation_v1.sql — immutable 2026 holdout query using literal coefficients.
- sql/jra_2026_locked_coefficients_slices_v1.sql — exact-same-coefficient subgroup/paired validation.
- trained-2025-ranker-v01.mjs — standalone pure 100-point research shadow scorer, no DB writes.
- trained-2025-ranker-v01.test.mjs — 7/7 tests PASS in isolated JavaScript runtime, native Node/GitHub CI not verified.

## NEXT GATE
Build exact live-compatible pre-race features and a forward-only shadow snapshot. Save both old/new ranks as separate research records BEFORE post time. Upon official settlement, compare gained and lost podium horses by race segment and surface. Neither replace historic FROZEN nor activate automatic ranking without this test. Missing optional content never blocks the existing JRA prediction process.
