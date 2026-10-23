# LAB REBORN 0.1 — Independent JRA model initial audit

## Intent / isolation
- Independent ability ranking from historical facts: recent race margins, recent consistency, historical class-adjusted peak, exact course/distance evidence, verifiable finishing/corner content, pre-target rival follow-ups.
- Absolutely no JRA_BASE_CORE_0.1_AB rate, official LAB rank/grade, popularity, odds, current race results, target finish order or other prediction model fields used as input.
- Five research axes: peak 30%, form 27%, course/distance 21%, race content 14%, opponent relation 8%. WEIGHTS ARE HYPOTHESES, NOT VALIDATED FITTED COEFFICIENTS.
- Per-horse explanations include dimension breakdowns and individual prior evidence.
- Missing prior condition history is UNKNOWN, not falsely 0. All-runner output is marked PARTIAL_HISTORY if any horse lacks usable comparable history, and TOP5 is suppressed on these incomplete races. Provisional ranking may still be inspected separately.
- Backfill 2026 race results have already become known to the researchers. All comparisons are retrospective REPLAY, not immutable pre-race forecast performance.

## Implementation
- `research/jra-reborn/lab-reborn-v01.mjs` pure JS independent feature rating, no database writes.
- `research/jra-reborn/lab-reborn-v01.test.mjs` 9/9 tests passed in isolated JS runtime. These are not claimed as formal GitHub Actions/Node CI.
- Input from deployed read-only source-attributed private.jra_v07_evidence_packet_v1(date,track,race_no), plus official target date/surface/distance/class context.
- Scores 0..100 are experimental **relative ability indicators**, not win probabilities, not the published LAB RANK.
- Never changes official FROZEN, LIVE JRA 0.4 / LAB RANK or JRA EYE. Existing historical sidecar for earlier learned model is a DIFFERENT model and is not re-used for REBORN.

## 20 named race audit requests (Oct 17–18, 2026)
19 original FROZEN were found; 1 sample (Oct18 Tokyo9) lacked the sought saved FROZEN.
Among the 19, 13 had a complete independent REBORN all-runner input field, 6 were flagged PARTIAL_HISTORY and MUST NOT count in the official shadow accuracy comparison.

### 13 complete-field race comparisons
| Race | Original frozen TOP5 captured actual podium | REBORN 0.1 TOP5 captured | Delta |
| --- | ---: | ---: | ---: |
| Oct18 Kyoto11 秋華賞 | 1 | 1 | 0 |
| Oct17 Niigata9 岩船特別 | 2 | 1 | -1 |
| Oct17 Niigata10 妙高特別 | 2 | 1 | -1 |
| Oct17 Tokyo11 富士S | 2 | 1 | -1 |
| Oct18 Niigata8 1勝クラス | 2 | 1 | -1 |
| Oct18 Tokyo11 ブラジルC | 1 | 3 | +2 |
| Oct17 Niigata1 未勝利 | 2 | 1 | -1 |
| Oct17 Niigata6 1勝クラス | 1 | 0 | -1 |
| Oct17 Kyoto7 1勝クラス | 1 | 2 | +1 |
| Oct17 Tokyo6 1勝クラス | 3 | 2 | -1 |
| Oct18 Kyoto9 宝ケ池特別 | 3 | 2 | -1 |
| Oct18 Niigata3 未勝利 | 1 | 1 | 0 |
| Oct18 Niigata9 松浜特別 | 2 | 2 | 0 |
| **Total (13)** | **23** | **18** | **-5** |

### Diagnostic examples (DO NOT count incomplete races as validated)
- Oct17 Niigata3: Original LAB TOP5 caught 2nd only (1); provisional REBORN recognized 1st ラベンダーヘイズ as rank2, 2nd アンバサダネージュ as rank1, 3rd ミライハーモニー as rank5 (three captured). This race was PARTIAL_HISTORY due to an entry with no comparable history.
- Oct18 Tokyo8: PARTIAL_HISTORY; important 2nd ガラク remained outside TOP5 (REBORN rank12) despite older-course documented ability.
- Oct18 Kyoto11 秋華賞: REBORN retrieved ドリームコア (3rd) but dropped original favorite selection モンローウォーク (1st). ギャラボーグ (2nd) remained outside REBORN TOP5 (rank8). Therefore catch stays 1, no net gain.
- Oct17 Niigata10: REBORN downranked winner キャリーグレイス to 13, a major failure of provisional fit evaluation.
- Oct18 Niigata8: REBORN downranked winner ヒナノムサシ to 14.
- Oct18 Tokyo11 ブラジルC: REBORN ranks レッドプロフェシー (2nd) 1 and ハピ (3rd) 3 plus winner クールミラボー (1st) 5, three podium catches vs only one by old.

## Research diagnosis
Independence has been demonstrated, but independent heuristics alone do not guarantee higher accuracy: the full-field capture is worse in this 13-race exploratory set (18 vs 23).
Present weights are intentionally not optimized against these known results. Retrofitting the 13 races to erase mistakes would invalidate a credible comparison.
Likely weaknesses for next hypothesis tests: distance/surface matching may under-credit surface/distance adaptation; limited older-than-four course sample; coarse prior class discount; missing race-segment/going context; missing detailed pace and speed coverage; stale/backfilled historical source differences.
Other critical limitation: current v07 older evidence contains up to 12 older near-condition starts, not the entire lifetime history. Recent history up to 4 starts. This is not exhaustive career ability.

## Next falsifiable gate
Use 2024 and 2025 archives for independent per-axis reliability and weight estimation, then freeze the updated REBORN before a new prestart, forward-only cohort of actual JRA races. Save REBORN forecast in its own immutable research source, not the official FROZEN. Compare newly captured and displaced podium horses. Do not enable a production switch on these replay observations.