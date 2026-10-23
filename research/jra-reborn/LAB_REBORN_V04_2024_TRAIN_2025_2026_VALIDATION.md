# BAKEN LAB | LAB REBORN 0.4 + Official grade evidence | 2026-10-24

## Outcome and code status

Implemented a separate JRA REBORN 0.4 independent categorical evidence learner, trained ONLY on 2024 archive after pre-target feature extraction. The resulting 8 segment/surface cohort priors and 152 coefficients were saved to GitHub *before* evaluating 2025 and 2026. The evaluation SQL embeds precisely the frozen literals. Inputs to candidate exclude all official LAB base rates/ranks, popularity and odds; source target finishes only serve training labels and later evaluation.

Artifacts:
- `learned-2024-reborn-v04-coefficients.json`: immutable frozen 2024 fit, 8 cohorts and 152 signal coefficients.
- `REBORN_V04_LOCKED_HOLDOUT_TEMPLATE.sql`: exact 2025/2026 holdout replay; JSON coefficients become literal SQL prior to query, no refit.
- `lab-reborn-v04-independent-learned.mjs`: independent scoring module, whole-field guard, six boolean availability guards.
- `lab-reborn-v04-independent-learned.test.mjs`: 10/10 tests passed in isolated JS evaluation (not native Node CI).
- `jra-official-2026-grade-registry.mjs`: 31 selected JRA official 2026 races with date/track/name matching; partial registry, never assert exhaustive.
- `lab-reborn-v03g-official-grade.mjs`: REBORN semantic v03 with official grade overlay and uncertainty guard for historical OP records whose G grade is stripped.
- `lab-reborn-v03g-official-grade.test.mjs`: 7/7 isolated JS tests passed.

## Source
JRA official 2026 Graded races: https://www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html
JRA official 2026-10-12 MBS賞スワンステークス grade GII: https://www.jra.go.jp/datafile/seiseki/replay/2026/094.html
Original archive jra_lab_races often has `class_name='オープン'` even for graded races. Event title aliases alone are unreliable; source must identify exact date, track and event title. Registry currently supports selected 31 cases only; years 2024/2025 grade lineage remains incomplete. Nothing is entered into official production predictions.

## 2024 model fitting
2024 as-of archive includes 41,490 runner records in supported segment/surface groups (2023+ history only). Cohort baseline learned by segment x surface. Signals learned within cohort: previous 4 podium count bucket, previous history count, beaten-gap bucket, close fourth–sixth, same-class close, near-distance podium, older same-track podium, verified final3f close, and repeated near-distance podium. 152 coefficients obtained via shrunk, capped log-odds ratios (n/(n+350), per-group cap +/-0.85, fixed feature family damping). This is a transparent research hypothesis, not a trained full five-axis pace/opponent model. The 2024 training/2025 validation/2026 evaluation dates were fixed before testing.

## Holdout results | complete eligible races only
| Data period | All eligible races | Runner starts | BASE_CORE 0.1 proxy top5 podium catches | Independent REBORN v04 top5 podium catches | Net | Newly rescued | Lost existing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025 (model never trained on 2025, comparator BASE trained IN 2025) | 2,266 | 31,002 | 4,283 | 4,235 | -48 | 286 | 334 |
| 2026 Jan–Sep 13 | 1,375 | 18,761 | 2,560 | 2,577 | +17 | 196 | 179 |

Both replay populations require complete target fields >=6, unique horse numbers and valid reconstructed BASE CORE proxy for the evaluation comparator; excluded races are not treated as failure. In 2025 the BASE_CORE reference was trained on that same year, giving it an in-sample advantage. In 2026 the old proxy was 2025-trained and REBORN was 2024-trained. Not a fully unseen blind test: feature design was informed by exploration of some 2026 events before this fitting experiment, though the specific coefficients were fixed before running 2025/2026.

### 2026 changes by segment and surface
- MAIDEN 670 vs old 669 (+1); CLASS1 963 vs 952 (+11); CLASS2_3 721 vs 709 (+12); OPEN_GRADED 223 vs 230 (-7).
- Dirt 1,277 vs old 1,262 (+15); Turf 1,300 vs old 1,298 (+2).
- 149 races improved, 132 worsened in 2026. Good catches are accompanied by real displacement risk.

### Calibration diagnostics, 2026
Score probabilities are not asserted calibrated. As coarse evidence from same holdout:
- Index scores 35–44%: 2,557 starters, mean research forecast rate 39.92%, observed top3 36.18%.
- Index scores 55%+: 358 starters, mean 58.74%, observed top3 56.42%.
- Sample bands indicate discrimination and some optimism, not reliable per-horse probabilities; calibration must be reviewed under forward data.

## Implementation and test verification
- Saved a whole-field JS scoring model separated from official LAB and compared against independent PostgreSQL implementation for 2025-09-13 Hanshin 7R: 18/18 scores and full-field ranks identical (rounded score tolerance 0.01).
- JS scorer 10/10 invariant tests pass: no odds/result/old LAB leakage, duplicate/missing roster rejection, missing signal rejects, tampered train-years reject, deterministic rankings.
- Official registry 12/12 direct lookup tests passed. Grade-integrated semantic scorer 7/7 invariant tests passed, including official 2026 grade evidence and previously stripped OP unknown-grade handling. Native Node CI not verified.
- Existing REBORN v03 (5 manually weighted axes) remains separate from data-fit v04: do not claim v04 is a fitted clone of v03 or that pace/opponent evidence has been learned. Grade overlay is implemented for v03G as a research branch, not silently folded into v04 training.

## Most urgent next research gates
1. Official prior race class/grade time-series registry across 2024/2025/2026, validated by immutable date/track/race identity, not keyword guess. Missing grades should be uncertainty, not zero.
2. Structured pre-target source extraction for genuine lap profile, race context, grade quality and rivals without results leakage; evaluate predictive value separately and jointly in years not used to fit.
3. Reliable live feature parity with this archived v04 model, plus private append-only prestart REBORN snapshots distinct from older 2025-residual shadow sidecar and production FROZEN.
4. Forward out-of-time tests comparing actual original LAB FROZEN and REBORN, giving count of newly captured AND displaced podium runners, with class/surface split. Do NOT enable score switching until meaningful evidence supports it.

## Safety
All REBORN v03G/v04 files committed on research branch only. No changes to LAB MAIN, current `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023`, current FROZEN, EYE, LOCAL, Cron, base rate or saved jobs. No automatic prestart research save was connected or run. No paid APIs.