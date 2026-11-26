# REBORN 2 — integration checkpoint after Work and Codex, 2026-11-26 JST
Research only, production remains unchanged. No raw NAR CSV copied here, no automatic requests, no permission assumption, no scoring.

## Codex
PR #92 commit 32847be9e42d0f00065f230afa32a118e33ff625 was independently confirmed in GitHub; four new files including archive-materials.mjs and tests. Reported actual archival material supply: JRA Tokyo 2026-11-23 R12 18 runners, 147 candidate prior rows, 10 runners with more than five; LOCAL Saga 2026-11-22 R8 12 runners, 29 witness rows, 7 with clock candidates, one race-level lap. Identity/as-of and new official acquisition remain incomplete. Candidate material delivery is not production validation.

## Work
User forwarded Work's report; independently located and inspected report and spreadsheet excerpts in user Library:
- BAKEN_LAB_REBORN2_公式データ供給元検証報告書_20261126.pdf
- BAKEN_LAB_REBORN2_公式データ供給元検証_20261126.xlsx
Work reports legitimate manual browser download of November NAR monthly race ZIP, UTF-8 BOM, three fixed-width files (66/36/54 columns), official result comparison Urawa 2026-11-25 R11: 10/10 race fields and 9/9 runner records matching. SHA-256 and per-file hashes recorded in report. Raw ZIP not independently acquired or rehashed here. Daily ZIP not yet tested; no automatic or secondary-use permission established.
Count discrepancy to resolve: listed data rows 1206 + 12880 + 1101 = 15187 (15190 if one header per file); report says 24088 including headers. Do not treat 24088 as verified unique row count or assume discrepancy is harmless; request exact per-file counts and methodology, plus independently check whether future cards are included. Report says cards extend to Nov 29 and payback through Nov 25. File fetch date alone does not establish availability as of historical target.

## Integration decision
NAR CSV: technically promising, conditional research candidate, not approved for ongoing production use. Continue isolated code/fixture development and already permitted evidence. Before adopting it: clarify use permission with NAR for acquisition frequency, caching/storage, internal analytical use and public display of derived grades; confirm exact stable HorseMarkInfo ID using official result row links and profile facts (birth date, sire/dam, historical affiliation; transfer is not by itself a conflict). Do not join by name only. Keep raw CSV and derived data separate; no redistribution without permission. Exclude odds/popularity/payback from ability pipeline. Exact past date/track/race/horse number, full-field reconciliation, as-of timestamp, DNF and ties, nonuniform first lap interval; explicit missing reasons. Preserve official literal margin separately from rounded time gaps. Profile identity not enough to assert a specific race result without source match.

## Parallel next tasks
Work: reconcile counts, demonstrate sample identity match for all nine Urawa runners, verify daily ZIP via permitted normal operation, identify NAR contact channel and prepare permission inquiry (do not send without user's approval); research incident source coverage for JRA/NAR. No raw redistribution.
Codex: offline integration of existing NAR CSV parser and archive material supply with authorized fixtures, BOM/header handling, stable-ID witness linkage, strict as-of and future-card exclusion, explicit candidate vs confirmed state, no market fields, full-field clock gaps and laps; add regression tests. No live acquisition automation while permission unresolved; no production deployment or writes.
Chappy: review common evidence design and start 13–16 design in parallel once user approves, without representing 01–12 as fully connected. Final scoring/release gates remain separate; individual horse sectional clock unavailable as a general source, use labeled proxies only. Incident absence unknown, not normal start.
