# JRA 0.4 — equal-base-rate tie shadow experiment, 2026-10-23

## Hypothesis

Some horse rankings within `validated_core_base_rate` groups are decided by fallback tie-breaks, not by different baseline calibrated probabilities. Try using **archived as-of running performance** to reorder ONLY horses with equal six-decimal base-rate values. Do not allow jumps between different probability bands. If one member lacks comparable verified history, keep the entire band in original order, not a zero penalty.

### Experiment specification (committed before full 43-race query)

`tie-shadow-v04.mjs` consumes *unchanged* frozen all-runner ranks plus the read-only `private.jra_v04_evidence_bundle_v1`. Comparable verified past runs require:
- same turf/dirt, distance within 200m, historic date strictly before forecast target date, archive match exactly 1;
- evidence quality per past run: win 1.1; 2nd–3rd with <=0.5s to winner 1.0; 2nd–3rd otherwise 0.65; 4th–10th <=0.5s 0.65; 4th–10th <=1.0s 0.15; verified top-3 last3f +0.2; same track with established signal +0.15;
- average these per-run signals rather than reward number of races; maximum 0.16 extra for up to two distinct rivals with later top-3 known before target;
- no probability recalibration; market odds/popularity and comments completely omitted; shadow only, never write to FROZEN.

This was one **exploratory pre-specified candidate** after the prior naive promotion failure; the historical cohort had been partly inspected, so it is **not an untouched blind test**. Retrospective `jra_live_runners` snapshots may have been refreshed after target race; historical dates are filtered but byte-for-byte original source state is unverified.

## Coverage limits

110 matched FROZEN JRA races from 2026-09-27–10-18. `validated_core_base_rate` was available for **all runners in 43 races**, for **none in 66 races**, and partially in **1 race**. The other 67 races were not included in the tie-band trial. Do not invent missing base probabilities or portray 43 as whole 110.

43 fully rated races:
- 2026-10-12: 5
- 2026-10-17: 29
- 2026-10-18: 9

All 43 produced a shadow ranking (no DB write). 27 changed at least one existing rank; only 5 changed the TOP5 membership.

## Actual results (all 43; retrospective)

- Frozen LAB TOP5 podium captures: **85**.
- Shadow TOP5 podium captures: **83**.
- 0 races with net improvement in podium capture, 2 with net loss (note one exchange caught another podium horse while losing one: a gain and loss cancel within the same race).
- Net **-2** podium horses; NO-GO for automatic equal-rate reordering.

Concrete problems:
- 2026-10-17 新潟9R: rank5 エルナト actual 2nd was demoted to 6th while コスモナエマ was moved from 6th to 5th.
- 2026-10-17 新潟10R: rank5 キャリーグレイス actual 1st was demoted to 7th while レイワサンサン moved from 6th to 5th.
- 2026-10-17 新潟3R: rank7 ラベンダーヘイズ actual 1st promoted to 5th, but rank5 アンバサダネージュ actual 2nd dropped to 7th. A valid new winner in TOP5 **does not prove net improvement** if another placed horse is lost.
- 2026-10-17 東京11R 富士S: エコロアルバ moved 5th to 4th within TOP5, no gain or loss in podium capture.
- 2026-10-18 京都11R 秋華賞: top 1–2 order swapped within equal high-rate band, but both TOP5 coverage count unchanged. ギャラボーグ remained rank7; the model did not solve that miss.

## Decision / gates

**REJECT this automatic tie reordering for production**, just like the earlier 5th–10th one-flag promotion. Keep it in isolated branch for investigation. Do not tune the weights on the same 43 races and then claim validation. New independent chronological holdout is required for a revised formula.

The **data acquisition layer IS reusable** (archive history, corner/3f/rival follow-ups with verified dates). Continue supplying those facts as *optional supporting evidence* for independently assessing ALL runners under activated JRA protocol 0.4; BASE_CORE_0.1 remains unchanged. Missing evidence must not block prediction/save or count as penalty; no automatic EYE or ranking change is permitted by this shadow module.

### Reproduction

- Code: `research/jra-optional-evidence/tie-shadow-v04.mjs`.
- Safety tests: `research/jra-optional-evidence/tie-shadow-v04.test.mjs` (9 passed in an isolated JS runtime; GitHub/Node CI not verified).
- Historical comparison: join `official_predictions` FROZEN with `official_results` by exact JRA race/date/track, and supply previously deployed private evidence bundle per race; do not persist historical recalculations as new predictions.

**No existing official_predictions, protected jra_save_claimed_prediction, EYE rule, Cron, paid APIs or pre-start guards were changed in this experiment.**
