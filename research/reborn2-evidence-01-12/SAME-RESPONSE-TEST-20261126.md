# REBORN 2 — same-response detailed material handoff, 2026-11-26
Research only. No production modification, deploy, CLAIM, FROZEN mutation, cron, or scoring authorization.

## Implementation
local-same-response-detail-handoff.mjs accepts the existing authorized prior-race reader's response, verified corner packet and a normalized detailed table from that same response. The new DOM extraction helper uses an injected Cheerio-style DOM reader, validates result headers and cell widths, preserves blank cells, rejects unsupported row/column spans, and binds the official horse link from the name cell. The handoff checks exact past race key/URL, as-of cutoff, current active runner, stable official horse ID, prior horse number/name and official finishing position before passing detailed clock, final3f, rounded clock gaps, literal margin and corner positions. Rejected rows remain missing. It accepts race-level laps only when source, observation time, race, distance grid, interval totals, and the winning clock agree; never treats these as individual sectionals. The module is isolated and cannot approve predictions.

## Executed tests
The initial synthetic contract tests (injected parser stub) passed 16/16. The final committed test suite imports the actual detailed-result-cells.mjs parser and the handoff module. All three exact GitHub files were fetched at commit 9f8cc51690cf775e0651c99d885856bee45991e1, transferred into the local environment and verified against Git blob SHA-1:
- local-same-response-detail-handoff.mjs e1260d0a0096636cfd90a5bf203cdf4d34301448
- detailed-result-cells.mjs a62e1e5915b15aad15c3ea25d5681245f6ce802a
- test-same-response-handoff.mjs dd0cc5c0953b010cb33eafe7209abd76b3947321
Node.js v22.16.0: 21/21 PASS.
Tests: two_linked, zero_winner_gap, missing_next, no_scoring, source_date, bad_time, bad_race, duplicate, foreign_runner, missing_horse, wrong_horse, duplicate_id, conflicting_finish, wrong_snapshot, target_outcome, market_not_forwarded, lap_same_source, lap_bad_winner, lap_wrong_source, lap_individual_forbidden, lap_invalid_grid.
Reproduction: node research/reborn2-evidence-01-12/test-same-response-handoff.mjs
These are normalized-cell/packet fixture tests, not tests of actual official HTML/network, actual DOM extractor, production reader or all-track acquisition. Existing prior-corner extractor may exclude DNF/nonfinishers and may not support every result-page layout; integration must remain fail-closed until independently verified field and actual HTML tests pass. Official result-page direct open in this turn failed cache retrieval. NAR terms prohibit unauthorized copying/republication; legitimate acquisition and operational usage authorization still need confirmation. No bypass or bulk retrieval.

## Next gates
Connect the isolated helper to the existing permitted reader in a research harness with real HTML and stable identity/roster witnesses. Test actual header spans, missing fields, dead heats and DNF, condition/surface/class extraction, full prestart all-runner source coverage and incident data. Then measure integrated input availability and runtime. Do not claim live completion or move to scoring until data gates pass. Individual sectionals remain unavailable; no proxy promoted to measured data.
