# LAB REBORN 0.5 — pre-target race content evidence audit

**Executed 2026-10-24 JST. RESEARCH ONLY. Do NOT switch HUB or official JRA scores.**

## Question

Can genuinely observed pace pressure, late position gains, and strong but hidden finishing speed improve independent LAB REBORN ability rankings beyond its 2024-learned v0.4 feature set, while protecting previously captured podium horses?

## Data pipeline / as-of

- `REBORN_V05_STRICT_ASOF_CONTENT.sql`: for each target runner construct history of prior 8 archive races by horse reference. Previous-race date must be **strictly before** target date. Target race finishes are labels used for training/validation only.
- Raw 200 m race halves: if previous race was 1,200–1,400 m and 6+ valid 200 m splits were recorded, compare initial 600 m and terminal 600 m. **This is only a front-loaded pace proxy, not certified pace-adjusted speed**; first 200 m includes standing start. Strict time split >1.5 s.
- `LATE_GAIN`: historically gained ≥3 places from final turn to finish (finish 2–7), prior near-distance race, ≤1.0 s behind winner, verified best-five final 3F.
- `FRONT_HOT`: historical early-3 position and finish ≤5 within 0.7s in pace-proxy hot race.
- `HIDDEN_CLOSER`: historical finish 4–8 with best-three final 3F, final-turn position ≥8, within 0.7s; target surface/distance near-match.
- All features derived from prior race records only, not target odds, result, official LAB score or grade.
- Isolated cache in RLS-enabled **private** schema: `private.jra_reborn_v05_content_cache_20261024`, zero anonymous/authenticated access. **111,508** historical candidate entries: 2024 **41,490**, 2025 **42,165**, 2026 Jan–Sep 13 **27,853**.
- Table is research-only and NOT a production forecast or new FROZEN.

## Training and freeze

- Fit exact residual corrections on 2024 only, using v0.4 2024-fitted score as expected baseline, target top-three label for **2024 training only**.
- For each of 8 class/surface groups x 3 feature flags, coefficient = `clamp(0.40 × Σ(y-p)/Σp(1-p) × n/(n+500), ±0.35)`. 24 coefficients; learned actual range **−0.054988 to +0.022053** log-odds.
- Commit immutable `REBORN_V05_CONTENT_2024_FROZEN.json` **before** issuing 2025/2026 evaluation queries.
- Predicted model score = logistic(logit(v0.4 locked independent rate) + sum(3 applicable 2024 learned content coefficients)). Absolutely no full-field hindsight weights.

## Comparison: complete-field eligible races only

| Period | Eligible races | Runner records | Old BASE_CORE 0.1 proxy | REBORN 0.4 | REBORN 0.5 | v0.5 vs v0.4 |
|---|---:|---:|---:|---:|---:|---:|
| 2025 | 2,266 | 31,002 | 4,283 | 4,235 | **4,234** | **−1** |
| 2026 Jan–Sep 13 | 1,375 | 18,761 | 2,560 | 2,577 | **2,568** | **−9** |

3rd-or-better target outcomes whose horse scored within top-five. Both alternate REBORN variants and old BASE_CORE **proxy** ranked on the same complete-field eligible races. The proxy is not identical to official saved FROZEN and was trained in 2025, so its own 2025 numbers are in-sample.

| 2026 comparison | Newly caught | Previously caught lost | Net | Exact paired-discordance binomial p-value |
|---|---:|---:|---:|---:|
| v0.5 vs v0.4 | 36 | 45 | −9 | 0.374 |
| v0.4 vs old BASE_CORE proxy | 196 | 179 | +17 | 0.409 |

The +/- rates are **NOT** compelling evidence of an overall change in real accuracy. Neither proves prospective ability; previously inspected high-profile historical cases predate feature design.

## V05 subgroup analysis: important but NOT prospectively verified

- **MAIDEN only**: 2025 v0.4=1,311, v0.5=1,318 (**+7**); 2026 v0.4=670, v0.5=676 (**+6**).
- Other groups degrade: 2025 CLASS1 −3, CLASS2_3 −5, OPEN_GRADED 0; 2026 CLASS1 −4, CLASS2_3 −8, OPEN_GRADED −3.
- This subgroup was selected **after viewing** validation outcomes. Do not back-claim maiden-only production improvement from these results. Leave it as a *prospective hypothesis* to validate on future unseen JRA prestart cohorts.
- Dataset shows apparently positive unadjusted next-podium relationship of some content flags; in multivariable incremental fitting to existing evidence, coefficients mostly tiny or negative. These features are correlated with the same previous good efforts v0.4 already captures.

## Reproducible implementation

- `REBORN_V05_STRICT_ASOF_CONTENT.sql`: source with strict historical as-of window.
- `REBORN_V05_CONTENT_2024_FROZEN.json`: frozen 24 source-based coefficients.
- `REBORN_V05_FIXED_2024_CONTENT_HOLDOUT.sql`: literal frozen coefficients applied to untouched 2025/2026.
- `lab-reborn-v05-content.mjs` and `lab-reborn-v05-content.test.mjs`: independent scoring with input identity, as-of identity, and full roster checks.
- 10/10 isolated JavaScript invariant tests pass; formal native Node CI not run.
- PostgreSQL vs JavaScript, **2025-09-13 Hanshin 7R** complete 18-runner slate: **18/18 exact ranks and 100-point rounded scores agree**, zero mismatches.
- `jra-official-2026-grade-registry.mjs` includes **31 selected 2026 graded events** but is **NOT an exhaustive yearly grade register**. Official source yearly lists also exist for 2024 and 2025:
  - https://www.jra.go.jp/datafile/seiseki/replay/2024/jyusyo.html
  - https://www.jra.go.jp/datafile/seiseki/replay/2025/jyusyo.html
  - https://www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html
  Their full grade data have **not** yet been ingested. The v0.3G version used a limited grade lookup, and the independent v0.5 statistical model has not integrated a full verified cross-year grade hierarchy.

## Decision and next hypotheses

**REJECT unrestricted REBORN 0.5 for production and as a universal upgrade. Preserve 0.4 as research benchmark.**

Investigate (1) class-specific, prospectively locked content effects especially maidens; (2) genuine course/going-par-normalized section speed (avoid inventing race-pace bonus from a 600m proxy); (3) temporal rival strength known strictly before the target; (4) complete JRA historical graded-race registry by date, track and race identity; (5) independent prospective shadow snapshots before first post, followed by rescued-vs-lost outcome audit.

Production JRA remains `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023`; 110 previous FROZEN untouched. No changes to official LAB rank, EYE, LOCAL, schedule, Cron or paid API. Earlier unrelated residual research shadow table stayed at 0. No automatic REBORN prestart save yet.
