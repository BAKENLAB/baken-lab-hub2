# LAB REBORN 0.6 — independent condition clocks, stable horse identity and prior rivals
Date: 2026-10-24 JST

## Status
**Research branch implementation complete for evidence extraction and diagnostics.**
**Not** a proven upgrade in podium capture and **not** an operational JRA prediction/FROZEN saver.
Production JRA 0.4, LAB HUB and existing FROZEN remain untouched.

## Code and frozen reference assets
- `REBORN_V06_2023_2024_CONDITION_REFERENCES.json`: **190** exact condition groups from **3,763** winner clock observations in calendar years 2023–2024. Min 10 races per group; **157** groups have a verified first-600 m reference (minimum eight pace examples). Group = track × surface × distance × going × private.jra_model_segment. Other groups are unknown, not poor performance.
- `lab-reborn-v06-clock-evidence.mjs`: validates JRA `m:ss.s` timing, winner gap, source winner clock, exact-condition robust z via winner-time IQR, splits whose total matches winner time, shorter distances whose segments aren't uniform, run date strictly before target and target date 2025 onwards. No speed figure interpreted as real winning probability or a grade-adjusted pace figure; score_delta=0.
- `REBORN_V06_PRETARGET_CLOCK_PACKET.sql`: read-only whole-field extraction from live JRA runner IDs, previous eight verified archive runs, archived winner time and laps, strict earlier-than-target history.
- `REBORN_V06_PRETARGET_RIVAL_IDENTITY.sql`: read-only historically shared races and later rival podium performances with **meeting_date < later_date < target_date**. Stable 10-digit JRA ID, later evidence restricted to already available at prediction cutoff. Race identity and source preserved.
- `lab-reborn-v06-rival-evidence.mjs`: verifies stable IDs, dates, meeting-vs-followup result, unique opponent, known graded stakes vs unknown Open; no assumed superiority merely for losing badly to strong rival, and no forced score changes.
- `lab-reborn-v06-integrated-shadow.mjs`: attaches diagnostic clock and opponent evidence to the **independent 2024-fitted REBORN v0.4 ranks**. It does not use official LAB ranks and does not turn unverified signals into points, cannot publish incomplete/mixed rosters or use future rival facts, writes nothing.

## Critical source-level correction
JRA live and archived horse URLs are NOT byte-identical for the same runner. Example:
- live ギャラボーグ: `/JRADB/accessU.html?CNAME=pw01dud002023105825/F4`
- archive ギャラボーグ: `/JRADB/accessU.html?CNAME=pw01dud102023105825/DB`
Both canonicalize to **2023105825**. Comparing full URL would erroneously discard genuine history. v06 now requires 10-digit JRA code, rejects names-only matches or duplicate IDs.

## Real archive checks
- 2025-01-12 中京ダ1200 良 1勝クラス winner マイネルフォーコン: clock 72.2s, exact reference median 72.0s (23 historic races); comparative clock difference −0.2 seconds. The validated first600 is 36.2s vs 2023–24 median 34.6s, i.e. **1.6 seconds slower first 600** than median; no blanket pace bonus.
- 2026-10-18 京都11 秋華賞 (retrospective source study, **not** a real immutable prerace trial): current live-card JRA field 17 horses, **93** historical starts found, only **53** match the frozen exact-condition timing references. ギャラボーグ 4/5 runs with valid exact condition; モンローウォーク **0/3**, because valid reference group was unavailable. This is MISSING EVIDENCE, absolutely not an ability-negative finding. ドリームコア 4/6.
- Pre-target opponent follow-up SQL produced **565 rows** for entire same 17-runner race. Specific audit:
  - ギャラボーグ: 42 raw followup records; 36 accepted after as-of, grade and meeting-finish checks. **3 distinct officially verified graded-stakes later-podium rivals** (examples: スターアニス 桜花賞, ドリームコア 優駿牝馬).
  - モンローウォーク: 12 raw records, 12 usable, **0 verified graded** rivals in this selected/partial grade registry.
  - ドリームコア: 33 raw, 31 usable, **2 verified graded** rivals.
  - Only **31 selected 2026 graded races** were in the existing official lookup; verified graded rival counts are a lower bound for the known partial lookup, **not** a complete measure of opponent ability. The opponent query also contains lesser-class wins but these are not equivalent to stakes wins.
- Important: prior rivals' **later** results are included only if before **2026-10-18**; the autumn-stakes actual finish order is never a feature. However the design was studied with hindsight, so this is NOT an unseen prospective validation.

## Tests, QA
- Clock/URL/tempo integrity: **16/16** pure JS invariant tests passed in isolated JS execution.
- Opponent as-of/source/grade/uniqueness: **11/11** invariant tests passed.
- Integrated v04+v06 research diagnostics: **9/9** invariant tests passed.
- **36/36** tests pass in isolated JavaScript harness; no native Node CI was executed. Source runner extraction trial and opponent-data retrieval were also run against the real Supabase archive.
- No ranking improvement is claimed. `actual_rank_modified=false`, `rank_changes_from_v04=0`, `score_delta=0`, `production_write=false`.

## Remaining accuracy gates
1. Complete JRA historical official grade source (2024/2025/2026, date/track/race match), because OP can conceal true GI/GII/GIII.
2. Evaluate whether clock differences have **incremental** next-race predictive value after existing independent v04 features, using strictly train-before-test and adequate evidence completeness, segmented by class/going.
3. Evaluate genuinely known-before-target rival performance with model training locked before validation, preserving losses as well as gains.
4. Ensure feature parity against actually received live JRA pre-race entries, with a REBORN-specific immutable pre-start research storage separate from current residual shadow table. No retroactive freeze.
5. Never use missing track/distance profile as a negative grade; never let a data scarcity indicator turn into a model rank drop.

No Cron restart, no paid APIs, no production schema migration, no official FROZEN modification.
