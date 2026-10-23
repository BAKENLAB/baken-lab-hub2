# LAB REBORN 0.3 | semantic repair and exploratory audit | 2026-10-24

**STATUS: GitHub RESEARCH branch only, no production rank activation. Candidate formula fixed before the Oct 11/12 secondary replay. This is retrospective and not a prospective blind trial.**

## What was fixed

1. GRADE: parse aliases including ローズS and 紫苑S as GII and stated GⅠ/GⅡ/GⅢ Roman properly (avoid treating GIII as GI); known named Grade races handled by a limited explicit registry.
2. RESULT MARGIN: the winner's `margin_to_winner=0.5` may actually be the winning margin, not being 0.5 sec behind. For finish=1 treat gap-behind-winner as 0, while retaining source margin as `unverified_winning_margin` for provenance.
3. DISTANCE TRANSFER: 1000/1150/1200m near conditions considered plausible, but different surface incurs reduced confidence. Missing exact-track history is not proof of inability.
4. COURSE: a single old negative local race cannot override recent strong similar-surface near-distance form. Separate best transferable aptitude from exact local result and cap the latter's positive/negative influence. Stale local losses still cause a caution tag.
5. UNKNOWN: missing content/confirmed final3f or no opponent uplift is null, rather than inventing a poor 43-point axis; normalize present evidence axes, add confidence shrinkage and transparent missing warnings.
6. RACE CONTENT: a race's 200m split string alone is not an automatic bonus. Verified 3f or verifiable position evidence is necessary for the current content-quality axis. No fabricated pace-adjusted speed coefficient is claimed.
7. EVIDENCE: target date must be later than each historical run/rival later-form date. Identity and all-runner field must match; partial rosters do not publish official TOP5.
8. EXPORT QA: fixed v03 exported function name; source module and test imports match. 17/17 isolated JavaScript unit tests passed. Native Node CI NOT verified.

## Initial 13 FULL-field races (selected from Oct 17/18)

| Race | Original official TOP5 caught | REBORN v03 caught | Difference |
| --- | ---: | ---: | ---: |
| 10/18 京都11 秋華賞 | 1 | 2 | +1 |
| 10/17 新潟9 岩船特別 | 2 | 2 | 0 |
| 10/17 新潟10 妙高特別 | 2 | 1 | -1 |
| 10/17 東京11 富士S | 2 | 2 | 0 |
| 10/18 新潟8 | 2 | 0 | -2 |
| 10/18 東京11 ブラジルC | 1 | 3 | +2 |
| 10/17 新潟1 | 2 | 2 | 0 |
| 10/17 新潟6 | 1 | 0 | -1 |
| 10/17 京都7 | 1 | 2 | +1 |
| 10/17 東京6 | 3 | 3 | 0 |
| 10/18 京都9 | 3 | 3 | 0 |
| 10/18 新潟3 | 1 | 1 | 0 |
| 10/18 新潟9 | 2 | 3 | +1 |
| **Total: 13** | **23** | **24** | **+1** |

Earlier v01 on these same 13: 18 captured. Thus v03 recovered 6 captured placed horses vs v01, 1 more than official; improvement of v03 over v01 is not automatic external validity.

## Fixed-formula secondary check: every Oct 11/12 saved FROZEN

24 saved flat races had settled results; **22 completely assessable**, two excluded from aggregate because full-field ability scoring was PARTIAL_HISTORY: Oct11 Tokyo8, Oct12 Kyoto2.

| Race | Original official TOP5 caught | REBORN v03 caught | Difference |
| --- | ---: | ---: | ---: |
| 10/11 京都1 | 2 | 2 | 0 |
| 10/11 京都2 | 3 | 3 | 0 |
| 10/11 京都6 | 2 | 1 | -1 |
| 10/11 京都7 | 3 | 3 | 0 |
| 10/11 京都8 | 2 | 1 | -1 |
| 10/11 京都9 | 2 | 2 | 0 |
| 10/11 京都10 | 1 | 2 | +1 |
| 10/11 東京1 | 3 | 3 | 0 |
| 10/11 東京2 | 2 | 2 | 0 |
| 10/11 東京3 | 3 | 3 | 0 |
| 10/11 東京6 | 1 | 1 | 0 |
| 10/11 東京7 | 2 | 1 | -1 |
| 10/11 東京9 | 3 | 3 | 0 |
| 10/12 京都1 | 2 | 3 | +1 |
| 10/12 京都3 | 2 | 1 | -1 |
| 10/12 京都10 | 2 | 3 | +1 |
| 10/12 京都11 スワンS | 1 | 0 | -1 |
| 10/12 東京2 | 3 | 2 | -1 |
| 10/12 東京3 | 2 | 3 | +1 |
| 10/12 東京8 | 3 | 3 | 0 |
| 10/12 東京10 | 1 | 2 | +1 |
| 10/12 東京11 | 1 | 2 | +1 |
| **Total: 22** | **46** | **46** | **0** |

These Oct 11/12 races were checked AFTER committing v03 scoring changes and without further weighting adjustment. Nonetheless the project has already inspected many historical outcomes generally; this is a historical replay and NOT a truly unseen live forward evaluation.

## Interpreting the evidence

- First reviewed group: 24 vs 23 in 13 races. Secondary group: 46 vs 46 in 22 races. Combined exploratory eligible 35 races: REBORN 70 placed horses captured vs official 69. This is not yet convincing uplift.
- Oct18 Kyoto11: 0.1 missed winner モンローウォーク rank 10, while 0.3 retrieves winner rank4 and 3rd ドリームコア rank3; 2nd ギャラボーグ rank8 remains missed.
- Oct17 Niigata10: 0.3 improves キャリーグレイス from v01 rank13 to rank10, but still misses its eventual win; original LAB rank5 saved it.
- Oct18 Niigata8: 0.3 misses winner ヒナノムサシ (rank12), worse than old rank5. No justification to ignore this loss.
- Oct17 Niigata3: v03 catches actual 1st and 2nd, but loses the 3rd relative to 0.1's provisional ranking. Independent v01 was PARTIAL_HISTORY, so do not count v01's provisional TOP5 as verified complete-field forecast.
- Scores are **research index points**, not well-calibrated podium probabilities nor production LAB 100-point grades. Weights 30/27/21/14/8 remain hypotheses, not learned.

## Remaining high-priority unresolved issues

1. **Authoritative grade ingestion**: public archive class_name='オープン' can conceal GⅠ/GⅡ/GⅢ; race name whitelist is necessarily incomplete. e.g. JRA confirms Oct12 Kyoto11 第69回MBS賞スワンステークス GⅡ (https://www.jra.go.jp/datafile/seiseki/replay/2026/094.html), while database race.class_name is only オープン. Do not pretend every GII event is correctly recognized by v03. Need race-date-specific official grade in input/history before considering production.
2. **Empirical fitted weights**: each of five axes and score distribution must be validated over as-of historical cohorts (e.g. 2024 train / 2025 validate) then fixed prospectively. No reward for matching inspected races.
3. **Time and pace validity**: verified 3f/corner data does not by itself provide a trustworthy pace-adjusted speed figure. Avoid adding speculative bonuses without objective benchmarking.
4. **Source completeness**: older evidence packet contains an eligible filtered historical subset, not all career starts. Time-varying archive availability and target pre-start snapshot provenance require additional QA.
5. **Missingness and class changes**: older unknown margins, grade uncertainty, surface transfer and within-horse changes in fitness may be systematic; candidate score is not calibrated.
6. **Operator gate**: current REBORN v03 is a GitHub JS module, not the existing Supabase SQL 2025-residual shadow scorer. Do NOT conflate the two or claim REBORN is already auto-saved. Need separate manual REBORN-specific immutable prestart snapshots before forward evaluation.

## Production protection

Never alter existing FROZEN, JRA protocol/claim/save/eye, LOCAL, Cron or paid API. REBORN remains research-only until reproducible live prestart field conversion, grade reliability, prospective whole-field evidence, and meaningful out-of-date test show added captures without material lost winners.