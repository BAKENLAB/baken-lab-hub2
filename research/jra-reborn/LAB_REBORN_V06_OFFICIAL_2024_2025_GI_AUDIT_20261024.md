# LAB REBORN 0.6 — JRA 2024/2025 flat GI evidence overlay audit

Date: 2026-10-24 JST
Scope: research branch only; prior frozen baselines, production scoring and existing FROZEN untouched.

## Research decision

Add a **partial but fully source-backed 2024/2025 flat GI ledger** to improve historical opponent grade recognition before testing predictive uplift. Do **not** assume all 2024/2025 graded stakes are now covered.

## Official provenance

- https://www.jra.go.jp/datafile/seiseki/replay/2024/jyusyo.html
- https://www.jra.go.jp/datafile/seiseki/replay/2025/jyusyo.html

Read both historical **JRA official annual graded-race listings**, selecting flat **GI only** and excluding J-GI jump races.

- 2024: 24 flat GI records.
- 2025: 24 flat GI records.
- Verified exact `race_date + track` and registered title tokens/official synonyms against actual archive:
  - **48/48 uniquely match** one `public.jra_lab_races` record.
  - Name differences: official オークス / 日本ダービー vs archived 優駿牝馬 / 東京優駿 are explicitly covered.
  - 2024 宝塚記念 京都 vs 2025 宝塚記念 阪神: date and track are mandatory (not title-only lookup).

## Repository implementation

- NEW `jra-official-2024-2025-flat-gi-registry.mjs`: 48 verified rows and conservative `official2024to2025FlatGI`. Unknown returns `null`; GI label 7 only for a verified match. No winners or target-race results enter this file.
- NEW `jra-official-2024-2025-flat-gi-registry.test.mjs`: positive/negative date/track, aliases, unknown GII/GIII, out-of-period tests.
- UPDATED `lab-reborn-v06-rival-evidence.mjs`: `official2026Grade(...) ?? official2024to2025FlatGI(...)`, retaining all original strict `meeting_date < later_date < target_date` source and identity gates.
- No prior model coefficients changed. Rival evidence is read-only and `score_delta=0`.

## Verification executed

- JRA annual official source read and compared with source archive; all **48/48** registered flat GI race records match uniquely.
- Isolated V8 execution of exact repo test source using `node:test`-compatible synchronous shims:
  - New flat GI registry **6/6** pass.
  - Existing clock evidence **16/16** pass.
  - Existing rival evidence **11/11** pass.
  - Existing integrated shadow **9/9** pass.
  - Total **42/42 passed**.
- This is **not native Node.js CI**; formal native test runner has not been executed.
- No 2025/2026 holdout uplift measured or claimed.
- No live or historic official prediction was written.

## Still incomplete

1. Official 2024/2025 **GII and GIII** must be added, plus a complete as-of audited 2026 register (current 2026 curated set is partial). Keep all unknown grades unknown.
2. The old counted 'known graded rival' feature now has broader but still incomplete registry coverage. All such comparisons should be treated as **version-specific source evidence** and not mixed with past reported counts without rerunning the same target.
3. If incremental training is attempted, lock training-period feature extraction and compare matched 2025/2026 full-field holdouts, report newly recovered and lost podium horses, then prospective prestart independent snapshots.
4. Do not reuse target outcome information or consider this official date/title registry as proof of predictive superiority.
