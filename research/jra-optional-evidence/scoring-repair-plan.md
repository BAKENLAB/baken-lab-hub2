# How to improve JRA score without losing existing catches

Status: **research design, not a new validated scorer**.

## Findings anchored in production source
- \`public.jra_live_base_candidate_v1\` defines base rate by model segment + last 4 flat runs' TOP3 count + mean winner gap. It uses 2025 training stats \`private.jra_base_core_stats_v1\`, fallbacks, and sorts by base rate then average margin. This **base candidate** has no per-run full-field pace, last-3F or rival-strength feature. The final manual comparison may use supplementary facts, so do NOT claim the entire saved JRA prediction ignores those aspects.
- \`public.jra_claimed_context\` sends 4 merged runs per runner with early_pos and pos_change; no prior \`final3f\` or full \`corner_positions\` in its merged history payload. Evidence should be separately obtained and verified, never invented.
- A naive 5th–10th <=0.5s signal swap previously yielded 4 unique gains and 10 losses, among 36 candidate swaps. **NO-GO**.

## Candidate modules (independent and ablated)
1. **CONTENT**: comparable surface/distance, margin as fraction of same-race winning time, final3f rank *within the past field*, positions, tempo. Keep "unverified trip loss" null. One exceptional good finish versus median poor form tracked separately.
2. **OPPONENT**: past race's entire field, winning and placed rivals' pre-forecast later performance, only confirmed earlier-than-target race results. Identity by normalized JRA horse code + corroborating name + exact prior race; missing/unmatched yields no evidence.
3. **TRANSFER**: separate same-condition demonstrated ability from first-time turf/dirt or 1000m straight transition; abstain on new-surface confidence if none. Different pace and distance profiles may need different rules.
4. **RELIABILITY**: history length, data/identity/archival coverage, reproducibility and source recency. Missing free-form comments are neither minus nor a block.

No EYE or odds/popularity changes. First build a **feature table / audit** with observation, date available, source evidence, confidence, and score effect set to zero. Never let the target race's result reach feature generation.

## How we actually test a scoring candidate
1. Freeze immutable baseline TOP5/ranks from \`official_predictions\`; preserve resulting FROZEN snapshots.
2. Split chronological cohorts: 2025 training; 2026 early validation; later 2026 unseen test. If testing 9/27–10/18 after looking at outcomes, they are **development**, not untouched test.
3. Compare independently trained models/modules at the **all-runners level** on exact same eligible races. For each race record official TOP3 coverage, added podium capture, displaced previous podium, rank ordering quality and incomplete/undetermined cases. Report by maiden, 1-win, 2-win, 3-win, OP/graded, turf/dirt, first-surface cases, straight 1000m.
4. Quantify not only net capture but separate gains/losses and variance across dates, no claimed win-rate improvement without out-of-sample check. Score/probability calibration only after actual probability validation.
5. Study negatively affected cases and give reasons grounded in data; modify *training* cohort only, then re-run blind holdout without further parameter tuning.
6. Require missing optional comments, unavailable same-horse archive and incomplete historical data to retain the baseline scorer; no bonus for mere presence of more articles.

Gate to deploy: maintain saving reliability, no post-start FROZEN, no Cron/paid API restart, EYE unchanged; separate review and explicit authorization for changing production scoring.

## First case pairs to protect
- 秋華賞 ギャラボーグ (#7, finished 2nd) versus 富士S エコロアルバ (#5, finished 3rd): avoid title-based bonus and single close-loss swapping.
- 京都7R マウンテンバローズ (#6, win) / 東京8R ベアアッコチャン (#6, win): missing good same/near-distance competitive finishes.
- 新潟6R シェーラ (#12, win): turf-to-dirt transfer is uncertain, do not claim recoverable absent prior dirt proof.
- 東京6R ナハトナナレオン (#5, win): protect old good performances despite a most-recent poor run.
