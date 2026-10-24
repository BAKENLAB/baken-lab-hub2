# LAB REBORN v0.7 — historical class/grade evidence recovery (research branch)

Audit date: 2026-10-24 JST. Research changes only. No old JRA/LOCAL FROZEN, live prediction, worker, Cron, pricing, or production score changed. No SQL INSERT/UPDATE or database DDL was executed in this audit.

## Motivation from immutable 2026-10-24 prestart results

- Original LAB top5 catches in 10 prospective-shadow races: **16/30 podium**. Independently prestart locked 2024-fitted **live-four-run proxy** caught **17/30**; old LAB TOP5 + EYE also caught 17/30. This proxy is explicitly NOT the complete REBORN v0.4 or v0.6 model.
- On the broader 20-race input-frozen study, before any class correction: original LAB TOP5 **37/60**; proxy TOP5 **34/60**. Only 10 of 20 proxy ranks had actually been locked prestart. The other 10 are retrospective score calculations and MUST NOT count as prospective.
- Potential errors: 東京10R #4 リバートゥルー has a pretarget named race 立夏S (actual 3勝クラス, 2026-05-10 東京12R); 東京12R #9 トラヴェリンバンド has 青梅特別 (actual 2勝クラス, 2026-05-17 東京10R). The archived 2026-09-19 野路菊S record required for 東京11R #5 シティオブドリーム is NOT covered by the available `jra_lab_races` archive (it contains nothing later than 2026-09-13). Do not invent the missing historical grade.

## Implemented, separate research code

1. `lab-reborn-v07-verified-prior-class.mjs`
   - Resolves a shortened/named historical JRA race to a canonical **broad class level** only if `source=JRA_LAB_ARCHIVE` plus **prior date**, **track**, **surface**, **distance**, **10-digit horse ID**, **numeric finish**, a unique archive race number, and canonical archived class match.
   - No inference from the words `S`, `特別`, `賞`; no official GI/GII/GIII asserted from an archived generic `オープン`.
   - Missing, ambiguous, conflicting, cancellation/non-finish or post-target rows remain unknown/rejected. No market, odds, old LAB score or TARGET race result.
2. `lab-reborn-v07-class-resolved-overlay.mjs`
   - Loads original frozen 2024 coefficients unchanged. It supplies *only* a verified prior class label to the existing LIVE4 proxy scorer, returns before-vs-after signals/ranks; never writes official or shadow prediction DB rows.
   - Explicitly marks this as `POST_HOC_CLASS_PROVENANCE_DIAGNOSTIC_ONLY`. It does not add missing run-5-to-8 evidence, final-3F rank, or 2024-2026 complete graded registry. NEVER call it the complete v0.4/v0.6 candidate.
3. `lab-reborn-v07-verified-prior-class.test.mjs`
   - 16/16 direct isolated V8 assertions PASS against exact repository test source, including cross-horse/date/distance/finish mismatches, duplicates, conflicting class, no grade guessing, post-target/late-input rejection, pure overlay, zero target-result or odds sensitivity. **Native Node CI not run**.

## Pre-target historical identity audit (20 study races)

- 20 races, **256 runners**, **967** stored prior history records (including some transfers/non-finishes).
- **418** prior runs contained labels with no explicit class tier and therefore cannot safely be inferred from text alone.
- **415** of these had numeric finish and distance and were eligible for strict archive join.
- Exactly **318** such labelled events matched unambiguously in the archive; **97** eligible had no unique archived match; **3** were ineligible under finish/distance/source guards.
- There are thus **100** remaining unresolved of the original 418 unknown class-label records. Never impute them.
- Strict audit across 20 frozen input packets: **0 rejected packets**, **318** `VERIFIED_RESOLVED` named races.
- **24 runners changed within-field ordinal rank** when only verified labels were supplied with NO weight retraining; **3 races changed TOP5 order**, but **zero changed TOP5 MEMBERSHIP**.
- Therefore podium capture remains **34/60** for both original live4 proxy and post-hoc class-resolved overlay; original old LAB reference stays **37/60**.
- Within the 10 truly prospective-ranked LIVE4 proxy races, its ORIGINAL recorded TOP5 capture is **17/30** and remains unchanged on this retrospective class overlay. This is **not** a second prospective model success.
- The zero-capture change is an important falsification of the claim that prior-class parsing alone solves the observed misses; it fixes evidence attribution, not the underlying predictor.

## Prioritized next work / blockers

1. **Whole-field pretarget history completeness**: rebuild prior 5–8 and validate most recent four against JRA archives, including results after 2026-09-13 that are absent in `jra_lab_races`. Never silently treat missing data as losses or bad performance.
2. **Verified graded/opponent-strength evidence**: identify the specific past race by date/track/horse and use JRA official race-grade registers. Distinguish generic Open, Listed, GIII, GII, GI; unknown stays unknown. Tokyo 11R #5 is a critical test for preserving old LAB's documented graded/open strength while not overfitting to this target result.
3. **Actual position, splits, pace and track/going as-of evidence**: evaluate if measurable prestart historical pace features add signal, separating unexpected event dynamics from known missed abilities.
4. **New-period holdout** on unchanged coefficients, over all starter horses and fixed race cohorts, reporting BOTH gained and lost top3 finishers, uncertainty and full TOP5 shifts. Only deploy a new production method after clean independent evidence.
5. Implement separate pre-off immutable scored full-v0.4+v0.6 research snapshots; do not overwrite old official FROZEN, original LIVE4 proxy rankings, or input records.

This branch is safe to keep researching; **production rollout decision: NO**.
