# BAKEN LAB | 2026-10-24 REBORN 0.4 live-four-run proxy comparison and prospective rank freeze

**Research-only; NOT the real complete LAB REBORN v0.4 or v0.6 model.** This deliberately separate live-four-run proxy scores the previously locked input snapshots using the immutable 2024-fit coefficients, but missing prior runs 5–8, grade evidence and final-3f relative ranks make its ranking DIFFERENT from the verified archive v0.4 pipeline. v0.6 has only zero-delta diagnostic evidence. Do not use these statistics to claim official v0.4 improvement or regression.

## Provenance

- Original v0.4 scorer/2024 coefficients: `lab-reborn-v04-independent-learned.mjs` and `learned-2024-reborn-v04-coefficients.json` on research branch. Coefficient blob SHA `624aba1dd7df99118700831064def803ab83248b`.
- Live4 proxy: `lab-reborn-v04-live4-proxy.mjs`; blob SHA `1291a2259d5c934bbd004a4b73a875b51b579033`, committed at `a4a7501ba9880f5a18273384d897fa7d64dfbaea`.
- Source inputs: `private.jra_research_shadow_frozen_v1`, model namespace `LAB_REBORN_V04_ASOF_INPUT_20261024`, 20 prestart, append-only research input packets (256 runners, locked 2026-10-24 12:21:47 JST).
- Original official OLD LAB: original `public.official_predictions` rows with `status='FROZEN'` saved before post time; official outcomes `public.official_results` with circuit `JRA`.
- Candidate feature calculation accesses **only** immutable input packet + coefficients, not target results, odds, popularity, or original LAB score/rank. Result join was performed AFTER provisional proxy rankings were computed. No refitting.
- The live4 model emits research-only scores and missing-signal sensitivity bounds. These are uncalibrated scores, not win probabilities.

## Retrospective input-locked, ranking-post-start exploratory comparison

Eight races had official results and original official LAB FROZEN available by 2026-10-24 14:17 JST. Inputs were captured prestart, BUT proxy rankings were computed after starts. Therefore these eight are **NOT prospective ranked predictions**.

| Race | Actual finish 1-2-3 | Original LAB catches | live4 proxy catches |
|---|---|---:|---:|
| 京都6R | 8-11-5 | 0/3 | 1/3 (11=proxy 4th) |
| 京都7R | 10-4-11 | 2/3 | 2/3 |
| 京都8R | 8-4-5 | 3/3 | 2/3 |
| 新潟6R | 9-3-8 | 3/3 | 1/3 |
| 新潟7R | 1-2-12 | 2/3 | 2/3 |
| 新潟8R | 10-3-5 | 2/3 | 1/3 (5=proxy 4th) |
| 東京7R | 4-5-9 | 3/3 | 2/3 |
| 東京8R | 13-11-5 | 2/3 | 2/3 (11=proxy 2nd) |
| **TOTAL** | **24 podium finishers** | **17/24** | **13/24** |

**Research movements (proxy, not real v0.4):** three previously uncaught podium horses were caught (京都6R #11, 新潟8R #5, 東京8R #11) and seven previously caught podium horses were lost. Net -4. These are *diagnostic hypotheses*, not robust proof that the actual model improved or worsened.

**Caveat:** LIVE4 froze at most four prior runs per horse, whereas archived v0.4 used up to eight. A small number of original live past-runs contained no numeric finish/margin (e.g. 京都7R #10); proxy skips unusable finishes. A prior-class value sometimes contains only a named race title, so class matching is uncertain. The final3f rank signal and older same-track signal are also absent. Missing signals are not claimed false; the proxy reports `rank_min` / `rank_max` as sensitivity bounds. These bounds cover only coded missing-signal toggles and do NOT imply true v0.4 rank coverage.

## Prospective **separate** LIVE4 proxy TOP5 freeze succeeded

At **2026-10-24 14:17:02 JST** (UTC 05:17:02), a new versioned research-only score namespace `LAB_REBORN_V04_LIVE4_PROXY_RANK_20261024` was inserted into existing append-only private research store. The original `LAB_REBORN_V04_ASOF_INPUT_20261024` 20 inputs were **not overwritten**.

- 10 prestart races, **141 runners**, all exact 5-entry TOP5. 
- 東京9–12R (4); 新潟10–12R (3); 京都10–12R (3).
- All ten source-input timestamps precede official JRA post time; all ten research score saved_at precede official post time (0 late).
- Original JRA `official_races` records were used as the final authoritative prestart gate; scoring did not alter `official_predictions`, FROZEN, JRA/LOCAL MCP jobs, HUB, Cron, or payment usage.
- DB verification: 10 research score records, 141 runners, 0 status errors, 0 bad TOP5 lengths, 0 target-result leaks, 0 odds leaks, 0 wrongly labeled complete-v0.4 flags.
- When persisted, 5/10 also had original LAB FROZEN, but later original LAB progress was not blocked or modified.
- Identified using `model_commit=a4a7501ba9880f5a18273384d897fa7d64dfbaea` and `coefficients_2024_blob_sha=624aba1dd7df99118700831064def803ab83248b`.
- For these ten only, **LIVE4 PROXY** ranking can be compared prospectively after official results, provided original old LAB FROZEN for the same race exists before post. Distinguish that from *full* model v0.4/v0.6 predictions.

### Pre-save checks and negative tests

Read actual scorer module from GitHub and ran 10/10 isolated V8 assertions PASS: deterministic scores, target outcomes ignored, odds ignored, incomplete roster rejected, future history rejected, late input rejected, tampered training period rejected, unique ranked TOP5, scorer target-result/odds flags false, full roster accounted. These are NOT native Node CI. No paid APIs.

## Remaining requirements

1. Rebuild/verify the actual eight-run archive/live feature parity including final3f relative ranks, historical classes and prior identities, and reject unresolved records explicitly.
2. Run fully original REBORN v0.4/0.6 independent model, and freeze its complete prestart ranked packet separately from both input-only and live4 proxy records.
3. After each official result, compare old official LAB FROZEN against the ten prospective proxy snapshots, counting **newly rescued and lost** podium horses with uncertainty breakdown.
4. Do not promote incomplete proxy results to HUB or make automatic production changes based on them.
