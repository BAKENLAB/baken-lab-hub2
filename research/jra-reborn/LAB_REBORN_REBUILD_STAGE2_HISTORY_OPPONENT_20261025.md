# BAKEN LAB | REBORN rebuild stage 2 — as-of history and opponent source join
Date: 2026-10-25 JST. Research branch `research/jra-optional-evidence-20261023`.

## Scope and decision

**Real work completed:** fixed input-to-history evidence linkage, performed a whole-field as-of audit on 20 immutable October 24 race packets, added a source-verified opponent pathway, and unified the two through one fail-closed evidence entrypoint.

**NOT completed:** a prospectively deployable or demonstrably stronger REBORN ranking model. Prior production comparisons using LIVE4 proxy are NOT tests of a complete REBORN v03/04/05/06 integration. Never relabel them.

No JRA/LOCAL production scores, HUB, official predictions, old FROZEN, automatic jobs, paid API settings, Supabase tables or row contents changed. DB operations for this stage were **SELECT only**. All new code/docs were committed to GitHub research branch only.

## Source snapshot audit

Source: version `LAB_REBORN_V04_ASOF_INPUT_20261024` of existing private immutable study source. The only target race date is 2026-10-24; all input packets originally saved before post time.

- 20 race packets / **256** uniquely identified JRA horses.
- **967** frozen historical records; **957** numeric-finisher runs, **10** non-finisher or transfer-type events (do not impute finish).
- Actual stored `jra_lab_races` historical archive ends **2026-09-13**. It does not contain all live history between 2026-09-14 and target.
- Indexed lookup by horse_name must be authenticated by stable TEN-DIGIT horse ID extracted from `horse_ref`; name alone is never proof. Historical result race identity, date, track, surface, distance and finishing place must match before any recent-F3 rank attribution.
- **1,522 archived provenance records** retrieved under the reproducible strict SQL extraction. Most recent historical records of the same horse up to the frozen study cutoff, PLUS at most FOUR distinct older flat career results dated strictly before the earliest date in the frozen input history.
- **800** verified older race rows can be appended as research historical context for these 256 horses.
- **722 / 957** frozen finished-run records matched an archive record under the stricter composite lookup. **235 / 957** remain unverified by that source; missing is UNKNOWN, not an ability-negative datapoint.
- **61 / 256** entrants actually meet the strict definition of eight matched completed starts: all four original finished recent runs archive-matched, plus four genuine older archived starts. This is not the fraction that has eight career starts; short career / missing archive remain distinct.
- In this restricted evidence set, archival `full_field=true` for 1,522 rows, while **none** has `archive_complete=true`. Therefore no claim that the entire archive/field source is generally complete or that all 3F ranks are automatically independently verified.
- Tightened validation requires `full_field=true`, an ordinal final3f_rank in bounds, and the frozen **horse's actual final3f TIME** to agree with its archived final3f time to within 0.15 seconds before promoting recent F3 rank as verified. Old archived data is a distinct source and may still be incomplete.

## Actual original v03 five-axis evaluator with rescued historical content

Verified longer-run bridge `lab-reborn-v09-eight-run-verified-bridge.mjs` was applied against all 20 input packets with SQL extracted archive rows, and **20/20 succeeded** without target results, odds, popularity or official LAB ranks.

Evidence populated across 256 entrants (non-null, not necessarily high-quality/complete):
- Peak ability: **256**
- Recent form: **254**
- Course fit: **243**
- Race content: **230**
- Verified opponent-quality axis: **0**

These numbers are a SOURCE-COVERAGE diagnostic only. The competitor axis is still empty in this base five-axis input and has NOT been truthfully integrated with validated new weights.

## Opponent provenance trial

- New separate `lab-reborn-v10-opponent-provenance-bridge.mjs` wraps prior **v06** official grade-identity research. It requires stable ten-digit IDs, exact target race and `meeting_date < rival_later_date < target_date`. Non-matching or future-affected source is rejected.
- Actual target 2026-10-24 東京10R, ④リバートゥルー: 15 JRA-archive follow-up rows for its prior co-runners, **8** pass the comparable finish/as-of audit. **0** contain verified graded-stakes later-podium rival evidence under currently PARTIAL official grade registry; one runner had ambiguous Open-grade later event. This is useful opponent context but NOT a score bonus.
- More opponent-source records may exist for other horses; the one-horse trial is not whole-field grade coverage.

## One entrypoint, not falsely labeled as final model

New `lab-reborn-v11-evidence-pipeline.mjs` now calls **both v09 historical source verification and v10 opponent source audit**, insists on matching target and runner identity, and outputs a single per-horse evidence readiness report. No full REBORN TOP5 or predicted grade is generated and no rank is stored.

Its explicit state: `PARTIAL_UNIFIED_EVIDENCE_READY_NOT_SCORED_MODEL`. The returned `full_reborn_ready=false`, `can_compare_as_full_reborn=false`, `score_or_rank_persisted=false`.

## Actual test execution

Isolated V8 on fetched exact GitHub code (NOT native Node CI):
- v09 history bridge **11/11** tests pass, re-run after final-3F source parity hardening.
- v10 opponent gateway **7/7** pass.
- v11 combined evidence pipeline **6/6** pass.
- Total this stage **24/24** isolated source tests pass.

Negative tests: after-target entries, after-post snapshots, wrong horse ID and race, missing history evidence, duplicated archive entries, unconfirmed F3 rank, target outcome/odds pollution, mixed rival packet, unverified official grade treated as UNKNOWN, and no fake full-model FROZEN.

## Reproducible files

- `REBORN_V09_FROZEN_ASOF_ARCHIVE_20261024.sql`: single SOURCE-ONLY JRA archive join scoped to 20 immutable as-of packets.
- `lab-reborn-v09-eight-run-verified-bridge.mjs` + `.test.mjs`
- `lab-reborn-v10-opponent-provenance-bridge.mjs` + `.test.mjs`
- `lab-reborn-v11-evidence-pipeline.mjs` + `.test.mjs`

## Next non-negotiable milestones

1. Independently recover the **missing live/archive recency** with authentic official pretarget JRA source data after 2026-09-13; verify date, horse code, distance, finished-run, and final3f ordinal provenance. Never use 2026-10-24 target outcomes as features.
2. Recover remaining four extra runs where verifiable; distinguish career length from uncollected archives.
3. Complete reliable official historical grade mapping beyond selected 2024/2025 GI and partial 2026 grades; OP is not automatically graded.
4. Generate safe full-field rival and pace context as-of before target, **then** evaluate whether adding them to the original five-axis score gives a real *incremental* improvement in independent out-of-period holdout. Never force a zero-delta feature to positive merely for code completeness.
5. Unify and freeze an actually scored versioned REBORN model **before a future race** only after source and validation gates pass. Compare with untouched original JRA FROZEN on truly prospective races; count rescued and displaced winners/podium horses. Do not optimize today's study against today's result.
6. Keep production OFF; stage gate remains **NOT PRODUCTION-READY**.

The source integrations exist and the data deficits are quantified. Full score integration and performance superiority are **still unproven**.
