# BAKEN LAB 2026/11/08 — Shadow evaluation round 2 (JRA + LOCAL)

Status: **research only. Production FROZEN, scheduler, API and ranking model unchanged.**

## Main JRA0.4 test
Source: FROZEN runner score, rank, pre-result explanation text + official results for outcomes. Date range 2026/10/24–2026/11/07: 120R (90 before 11/7 and 30 on 11/7). Nonranked/CANCELLED runners excluded; some earlier FROZEN records lack status (50R), so do not require status='ACTIVE' to count old races. Earlier 340 runner descriptions are null, hence regex based eligibility in those cases is unobservable and no candidate adjustment is made.

Seven shadow policies (including BASE) evaluated on all original ranks using immutable inputs. Regex text matching is a crude eligibility proxy, not proof of appropriate lower penalty or verified current ability.

| Period | Policy | Wins TOP5 | Podium horses TOP5 | gained wins | lost wins | gained podium | lost podium |
|---|---|---:|---:|---:|---:|---:|---:|
| 11/7 30R | BASE | 18 | 50 | 0 | 0 | 0 | 0 |
| 11/7 30R | RELIEF4 | 19 | 50 | 2 | 1 | 3 | 3 |
| 11/7 30R | RELIEF6 | 18 | 49 | 2 | 2 | 5 | 6 |
| 11/7 30R | RELIEF10 | 20 | 52 | 4 | 2 | 8 | 6 |
| 11/7 30R | EYE10 | 22 | 54 | 4 | 0 | 8 | 4 |
| earlier 90R | BASE | 69 | 184 | 0 | 0 | 0 | 0 |
| earlier 90R | RELIEF4 | 71 | 185 | 2 | 0 | 3 | 2 |
| earlier 90R | RELIEF6 | 71 | 183 | 2 | 0 | 5 | 6 |
| earlier 90R | RELIEF10 | 70 | 180 | 3 | 2 | 7 | 11 |
| earlier 90R | EYE10 | 68 | 179 | 1 | 2 | 3 | 8 |

Main pitfall: choosing a favorable parameter on the same data is in-sample tuning, not an independent performance demonstration. DO NOT ADOPT RELIEF4 or EYE10 from these data alone.

Concrete RELIEF4 trades on 11/7:
- GAIN: 京都12R プレスバーン sixth->fifth (WIN), 東京10R ボウウィンドウ sixth->fifth (WIN), 京都2R アルジャンレオ sixth->fifth (podium).
- LOSS: 福島2R ジーフォーリア fifth->sixth (WIN), 京都3R ルクスアルカード fifth->sixth (podium), 福島12R エイシンマールス fifth->sixth (podium).
- Prior 11/1 gain: 京都12R ポペット WIN, 東京10R クインズデネブ WIN. Prior podium losses also occur.

## LOCAL1.6 audit
Complete-race result set 724R = 708 prior + 16 on 11/7; **all selected EYE 252** satisfy 2+ distinct categories with current_relevance=true according to preserved factor audit (prior 246, current 6). Thus previous poor result is NOT obviously missing the formal count/category gate.

| Period | TOP5 podium horses | rank6 added | EYE added | full podium TOP5 | full podium TOP6 | full podium TOP5+EYE |
|---|---:|---:|---:|---:|---:|---:|
| 11/7 16R | 33 | 7 | 1 | 4 | 9 | 4 |
| prior 708R | 1508 | 189 | 64 | 243 | 347 | 274 |

Rank6 automatically adding wins recall but expands every race from five to six candidates, not equivalent to better selectivity or return. Do not auto-assign EYE=rank6. EYE selected based on distinct current categories can still fail due to **factor strength, class/distance transfer, counterevidence, pace info, and data incompleteness**.

Caution: in 193 of 708 prior LOCAL races the sixth-ranked runner is present but its score is missing; rank-only comparisons are valid, score-gap backtests MUST exclude/report these missing records. In past JRA0.4 50 of 90 records lack runner status, 340 runner reasons missing. Separate missingness from evidence of poor ability.

## Next safe development
1. Fix freshness check upstream of FROZEN using source timestamps <= FROZEN, no later data leaking.
2. Develop structured evidence features from verified pre-race history not solely explanation regex (class, same course, distance, recency, layoff, distance change, passing order, matched quality and conflict).
3. Pre-register correction coefficients on older dates; evaluate **new dates not used for tuning**. Report displaced successful controls and all key ability metrics.
4. Improve EYE factor weighting/independence, not count and not popularity, while retaining TOP5 and EYE as distinct outputs.
5. Only promote vetted changes to production after independent validation; existing FROZEN and original prediction audit are immutable.

Companion SELECT-only file: research/2026-11-08-shadow-rerank-evaluation.sql. No bets placed, no production saves, no altered predictions.