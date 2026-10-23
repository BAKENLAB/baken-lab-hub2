# LAB REBORN 0.6 — clock source reliability guard (2026-10-24 JST)

**Scope:** research branch `research/jra-optional-evidence-20261023` only. No production DDL, write, FROZEN edit, scoring coefficient change, or Cron.

## Read-only findings from actual Supabase source

- 2023 archived turf/dirt races: **3,329**. 2024: **3,327** (total **6,656**).
- `jra_lab_races.course_layout` and `course_text` non-empty rows in 2023 and 2024: **0 each**. Direction `turn` is often present, but is not the same as inner/outer and course geometry.
- The existing v06 reference groups use **track / surface / distance / going / class segment**, but **cannot certify identical physical course layouts**. They remain descriptive diagnostics only. A metadata-matched baseline is not an exact course-variant/time-par.
- Among archived full-runner records, **50 races have more than one finish=1 row** (dead heats). There were **zero** such races with differing winner clock strings.
- The original `LEFT JOIN ... finish=1` multiplies every prior start row when that race has tied winners. Actual SQL proof at **2024-11-17 Fukushima 8R**: 16 unique starters -> 32 old join rows; distinct winner times=1. A `LEFT JOIN LATERAL (SELECT MIN(w.time_raw) ...)` returns **16** rows.
- The row multiplication can bias or prematurely truncate the prior-eight-run sample in the pre-target clock packet, even though the tied winners have identical times.
- Run-data `time_raw` and `horse_ref` must continue to be interpreted as source evidence with missingness tracked, not negative ability. 2026 source data has more missing horse refs than 2023-25.

## Research-only changes committed (without rewriting previously frozen references)

1. `REBORN_V06_PRETARGET_CLOCK_PACKET.sql`: aggregate winner clock to **one row per source race** before attaching to each horse's previous run; no price/odds/future data added.
2. `lab-reborn-v06-clock-evidence.mjs`: preserve all existing diagnostic clock values and zero score delta, but disclose five metadata-matched dimensions, `course_geometry_verified:false`, `exact_condition:false`. Before collecting independent layout evidence, **never claim the comparison is course-exact**.
3. `lab-reborn-v06-clock-evidence.test.mjs`: new assertions guarding against overconfident course-equality wording.

## Verification actually performed

- Read-only Supabase queries: source completeness, 50 multi-winner races, winner-clock agreement, and 16 -> 32 -> 16 corrected join witness.
- Fetched and ran the research branch's clock **pure JavaScript module** inside an isolated JS execution context against the real frozen 190-group JSON.
- **17/17** focused invariants passed: reference parsing, clock/200m parsing, stable horse identity, historical comparative median, as-of guards, zero score change, market/LAB-score non-influence, updated course-confidence flags, and source-SQL join guard.
- The modified `node:test` file was updated in GitHub but **full native Node test suite and CI were NOT run**. No new model ranking/backtest uplift is claimed.
- `REBORN_V06_2023_2024_CONDITION_REFERENCES.json` and learned v04/v05 coefficients are **unchanged**.

## Remaining issues / gates

1. **Next clock reference version** needs official track-layout identity (inner/outer, straight), course changes and reliability audit, not guesswork from `turn` alone. Do not relabel the old frozen reference asset.
2. Confirm differences between running clock under weather/track bias, place splits and true course configuration before **any score_delta**.
3. Add a separate full JRA official 2024/2025/2026 date-track-race grade ledger; source pages:
   - https://www.jra.go.jp/datafile/seiseki/replay/2024/jyusyo.html
   - https://www.jra.go.jp/datafile/seiseki/replay/2025/jyusyo.html
   - https://www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html
4. Old opponent sources are only a **partial** verified graded-rival lower bound: do not credit unverified open races as G1-3.
5. For incremental holdout fitting, **2023+2024 reference construction bars 2024 targets from using that same frozen reference**. A later clock-based ranker should use e.g. a separately locked **2025 fitting / 2026 temporal validation** (also disclose retrospective selection) or rebuild a truly prior-year baseline. Full prospective pre-start frozen research shadow remains unsolved.
6. No REBORN v06 score uplift or automatic research forecast saving has been demonstrated. Base v04 ranking remains unchanged; track rescued and lost podium horses before considering activation.
