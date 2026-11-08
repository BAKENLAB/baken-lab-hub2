# BAKEN LAB | 2026-11-08 Frozen postrace research

**Scope:** production database read-only queries; GitHub research files and fixture tests only. No production rank/score changes, no FROZEN rewrites, no job CLAIM, no betting changes, and no automatic promotion from EYE.

## Day result: 2026-11-08

Compare only official_predictions joined to official_results by race_date, track and race_no, with status FROZEN, frozen_at before post_time and three finishers available.

| Cohort | Races | ◎ wins | ◎ top3 | Winner in TOP5 | Podium TOP5 capture | All podium in TOP5 | EYE top3/selected |
|---|---:|---:|---:|---:|---:|---:|---:|
| JRA | 27 | 4 | 9 | 15 | 49/81 | 5 | 6/21 |
| LOCAL | 32 | 13 | 25 | 25 | 72/96 | 15 | 4/8 |
| TOTAL | 59 | 17 | 34 | 40 | 121/177 | 20 | 10/29 |

TOP5 plus EYE covers 45/59 winners and all three 26/59 times, **coverage only, not a betting hit rate**.

## S/A grade audit for ◎, 2026-10-25 through 2026-11-08

| Circuit | Grade | Races | Wins | Top 3 | Win rate | Top3 rate |
|---|---|---:|---:|---:|---:|---:|
| JRA | S | 90 | 22 | 41 | 24.4% | 45.6% |
| JRA | A | 30 | 7 | 17 | 23.3% | 56.7% |
| LOCAL | S | 111 | 34 | 70 | 30.6% | 63.1% |
| LOCAL | A | 416 | 118 | 250 | 28.4% | 60.1% |

JRA on 11/8 had ◎S in 25/27 races, 4 wins, 9 top3. Across the 15-day cohort S did **not** demonstrate higher top3 rate than A. This is descriptive, not causal or proof of statistical significance; race composition, version and cohort drift may differ. Alert on S saturation and missing S/A differentiation **without** changing labels automatically.

## EYE winner examples on 11/8

- Kyoto7: ④リアンドゥクール, rank 6; two independent 1800m class wins/placings and Kyoto 1800m history. Higher-class first try unresolved.
- Tokyo9: ⑦エスクアドラ, rank 6; course-change and novice/class uncertainty remained, but earlier maiden win included midrace advance.
- Tokyo10: ⑧ワイドクリーガー, rank 7; separate 2-win class successes, despite a major counterexample of a recent 3-win 14th.
- Fukushima3: ⑬エリーニック, rank 8; previous Fukushima dirt 1700 win and additional same-course history, recent defeated run remained counterevidence.
- Kochi2: ③スズカローズキング, rank 6; Kochi 1300 2nd and 1400 1st, with subsequent C3 defeat explicitly considered.

Fukushima8 additionally had EYE ⑨ファンシーフリル (rank 7) finishing **second**, while rank 5 ⑥オプティモ won and rank 1 ⑮アメリカンビヨンド finished third. EYE can find upside without automatically being a TOP5 horse. Avoid winner-only tuning; in 10/25–11/7 JRA EYE reached top3 in 10/35 and LOCAL EYE in 46/186.

## Kochi Final, 11/8 12R

Official result: ④エスケーブラッド (HUB 8th), ⑦ユイノナナフシギ (12th), ⑫ビビットピンク (◎1st). No EYE. The frozen record penalized recent heavy defeats in standard C3 races for ④ and ⑦, while ⑫ had direct reporters' selection podium evidence.

**Hypothesis:** For reporter-selected finals, weigh validated class context and opposition quality before applying an absolute defeat-margin penalty; use verified past positions/pace only if actually available before FROZEN. The current record does not verify enough pace/corner evidence to claim ④ and ⑦ were predictable winners. Do not retrospectively rewrite the stored prediction or auto-promote them.

## Current implementation

- frozen-postrace-calibration.mjs: pure, offline post-result auditor. Validates exact horse identity/rank, three finishers, chronology, grade, EYE, duplicates. Emits per-circuit and combined hit metrics, S/A calibration diagnostics, and original ranks of missed runners. Ignores market fields even if input includes them.
- frozen-postrace-calibration.test.mjs: 5 regression fixtures for Fukushima8, Kochi Final, S/A differentiation, invalid/late predictions, and absent EYE. Locally executed successfully with Node test runner (5/5).
- This is a **research-only utility**, not a deployed scorer, a verified production-run module or a new model. Official aggregates above were computed separately with read-only SQL.

## Shadow validation before any live use

1. Compare S vs A within like-for-like JRA race types/distances and freeze-version strata; keep sample sizes and uncertainty visible.
2. Evaluate candidate evidence and all displaced TOP5 horses, including negative counterevidence, under source as-of time gates. Keep wins and protected successful races.
3. For Kochi reporters' final, distinguish class / reporter status, opponent quality, and verified pace data. Mark missing facts as missing rather than inferring positive evidence.
4. Require non-regression across multiple holdout dates before proposing an explicit versioned model change.

Existing ongoing PR #41 remains untouched.
