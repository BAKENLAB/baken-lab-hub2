# LOCAL 1.6 EYE factor-quality research, 2026-11-08

Data: 2026-10-18 through 2026-11-07 immutable FROZEN predictions and confirmed official TOP3 from Supabase; 724 complete races. 252 races selected EYE (246 prior, 6 on 11/7).

## Audit integrity
All 252 selected EYE records included **at least two current_relevance=true independent positive factor categories**. Hence no observed violation of the formal count/current-relevance/category gate in the selected sample.

## Observed ability of the selected EYE
- 65/252 selected EYE placed in the official TOP3 (25.8%).
- 11/7: 1/6 placed (16.7%).
- Historical earlier: 64/246 placed (26.0%).
- Factor counts for selected EYE: 2 distinct current categories in 197 records -> 52 TOP3 (26.4%); 3 in 53 records -> 13 TOP3 (24.5%); 4 in 2 records -> 0 TOP3. **More categories have not demonstrated higher podium probability.**
- By category (selected EYE with current factor category; counts overlap between categories): margins 45/166=27.1%, same_condition_history 35/163=21.5%, class_change 32/128=25.0%, going_change 10/39=25.6%, distance_change 10/21=47.6%, weight_change 3/11=27.3%. These are observational, biased subgroup rates and cannot be taken as independent causal weights. Never tune based on one small category subset; especially 21 starts is small.
- Relative to literal adding one extra candidate, prior 708 complete LOCAL races: all TOP5 podium captured 243 races; TOP5+rank6 347; TOP5+selected EYE 274. Rank6 is not a permissible automatic EYE rule. Adding one runner raises ticket combinations and does not establish profitability.

## Race-level audit examples
- 高知11R: rank6 ②エクセスリターン (1st) was not EYE because 1 positive current factor; rank8 ⑥ショウサンキズナ (2nd) had 1 current factor. Rank7 ⑩ブラッティーキッド was selected EYE on 2 current categories but missed. This suggests the factor gate was applied, but relative factor **strength**, higher-class historical fit, and explicit negative evidence were not sufficiently predictive. Avoid rewriting this as a missing factor-count check.
- 高知12R: rank6 ⑦カイトヴァイター (3rd), EYE none: same-distance May 3rd was explicitly current_relevance=false; 3kg lower carried weight counted as one current true factor. Need consider race-level recurrence and layoff/time horizon, not count a stale same-distance run as true merely because it placed this time.

## Quality controls
1. Re-extract before-race *objective* evidence from archived source snapshot: same-distance/class race count, margins, pace positions, explicit source refs and dates.
2. Separately score independent factor magnitude and counter-evidence, with freshness and class-transfer flags. No popular/odds-based rescues.
3. Prospective shadow and held-out race comparison; track selected EYE TOP3 and nonselected TOP5-outside TOP3 under the same rule.
4. Preserve current LOCAL1.6 model, FROZEN, EYE counts and all existing safety gates until improvement is independently verified.

This is a RESEARCH NOTE, not approval to make production changes.