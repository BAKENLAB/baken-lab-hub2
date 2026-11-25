# REBORN 2 — evidence routes 01–12 (2026-11-26 JST)

Status: isolated research only. No deployment, production writes, CLAIM, FROZEN changes, odds, old ranks, or scheduled jobs. The SQL prototype is a historical race-key reader, NOT an acquisition service or a ready scoring engine. Only three runners per example were independently compared against the public official results. Date filter alone does not prove historical publication-time availability. All candidate rows must pass source/identity and as-of checks before becoming scoring evidence.

## Existing source inventory (deployed code read-only inspected)
- JRA official card: jra-claimed-mcp v42; horse links /JRADB/accessU.html and past result refs /JRADB/accessS.html. jra_live_runners.past_runs contains horse-specific past results, race-class, distance, condition, finish, elapsed time, estimated final3f, corners, margin_to_winner and source_ref (sample Tokyo 1R 2026-11-23 #1 prior 2026-10-18). jra_lab_races + jra_lab_runs are historical archive candidates; source_kind/source_ref and full_field/record_role must be verified, not assumed. jra-asof-detail-handoff.mjs exists. Do not reuse old grade/score/market inputs.
- LOCAL: lab-local-corner-preclaim v7 and lab-claimed-context v30 contain automation/nar-history-rescue.mjs, local-worker-data.mjs, nar-prior-corners.mjs, nar-official-lap-evidence.mjs. Preclaim also contains nar-prior-corners-official-source.mjs. NAR official DebaTable -> stable HorseMarkInfo identity (k_lineageLoginCode) -> exact historical RaceMarkTable -> race date/track/number, official horse number and horse identity cross-check. Existing horse_runs has no stable horse ID; name-only history is never scoring evidence. Existing code limits recent runs to 5 in part of the route; expanded history is not implemented. Official result laps are race-level, never individual.
- Archive ranges/counts: JRA 415234 runner rows (2018-01-06 to 2026-09-13); 30037 race rows, 28927 with nonempty halon_times. LOCAL 258930 runner rows (2025-01-01 to 2026-08-31), including 26892 帯広ば rows excluded from flat-race work. Counts not deduped or accuracy-certified. Recent coverage must be separately checked.
- Official result settlement 2026-11-16–25: JRA 706 finisher JSON entries, 586 with time, 30 bodyweight-like margins; LOCAL 2294 entries, 1665 with time; both zero final3f keys. jra-result-refresh v7 filters out empty cells, then guesses next cell after clock as margin: plausible column-shift cause. It also deduplicates by finish, so dead heats require investigation. Do not use settlement JSON alone as detailed history. Fix parser in separate isolated fixture tests using header/semantic-cell mapping, preserve empty cells and unique horse identity; never mutate FROZEN.

## Evidence contract and item routing
All items must carry status MEASURED / DERIVED / PROXY / MISSING / NOT_APPLICABLE, source race and official reference, current runner ID and prior runner identity, retrieval timestamp, publication/as-of eligibility, raw fields, normalized fields, parser version, limitations. No numeric zero substitution. For replay require a dated immutable snapshot or other evidence that data was public before target time; no target outcome or later opponent outcomes. No current/previous odds or ranks in ability input. Missing source/identity blocks the affected evidence, not an invented score. Full-field evidence for time gaps must include all finishers and statuses; tied times are rounded clock gaps, not proof of dead heat. Keep literal margin unit/basis separate.
| Item | Data path | Status |
|---|---|---|
| 01 base ability | 02–12 plus later course/opponent analysis, evidence references | derived; integration not built |
| 02 recent results | JRA live history / NAR official horse history, verified exact identities | source route exists; expanded depth and refresh not verified |
| 03 winner gap | exact full past result clocks, winner clock, verified identities; rounded gap | archive prototype tested |
| 04 trailing gap | same result, next classified finisher; ties/invalid clocks -> unknown | archive prototype tested |
| 05 elapsed | official result time_raw, course/going/class/date; JRA colon and LOCAL compact formats | archive prototype tested; benchmark not built |
| 06 final3f | official per-horse final3f and result field | sampled official/DB match; fresh all-field route not verified |
| 07 acceleration | individual splits if publicly and permissibly available; otherwise past race laps + corners + final3f | proxy only; individual splits route unverified |
| 08 persistence | past race laps, corners, final3f, clock gap | proxy only; local fresh full coverage unverified |
| 09 gate stability | JRA official 競走中の出来事等; NAR official incident records where available | JRA source example confirmed, no ingestion; LOCAL source coverage unverified; absence of report not normal start |
| 10 second acceleration | early positions, initial corner distance and rival context; individual splits if available | proxy only; do not infer start speed from first corner |
| 11 fatigue by distance | course/distance/going + prior race pace + position + late time/gap | derived; benchmark/pace integration not built |
| 12 winning ability | wins and losses, opponent class and exact past comparisons, race scenarios | derived; no grading threshold yet |
 
## Historical smoke test
read-only-evidence-adapter.sql executed as SELECT only against production archives, 29 rows (JRA 15, LOCAL 14). Six exact checks:
- JRA Nakayama 2025-03-29 R11 #8 156.1s gap 0.0, #6 156.1 gap 0.0, #7 156.2 gap 0.1. #8/#6 official margin is クビ despite equal rounded clocks; retain literal.
- LOCAL Funabashi 2025-12-08 R11 #14 101.5s gap 0.0, #1 101.7 gap 0.2, #8 104.4 gap 2.9; #12 and #13 DNF no time/gap. LOCAL archive status remains candidate, no stable ID assumed.
- 6/6 exact checks and 2/2 DNF checks passed. No test claims for all other rows, fresh network, or grading.
Official references:
https://www.jra.go.jp/datafile/seiseki/replay/2025/034.html
https://sp.keiba.go.jp/KeibaWeb_IPAT/TodayRaceInfo/RaceMarkTable_ipat?k_babaCode=19&k_raceDate=2025%2F12%2F08&k_raceNo=11
https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw01sde0104202603030420260829%2F6B (JRA incident example)
 
## Release gates (not yet passed)
1. Confirm source usage terms and permitted automated access; no paid API, no bypass. Fresh exact source fetch on separate test harness, JRA/LOCAL, including cross-circuit transfer.
2. Implement complete history reader beyond five runs with pagination/identity/dedup/as-of checks and incremental archive refresh in isolated storage. Do not use target result or target market. 
3. Implement semantic parsing, DNF/dead heat/blank margin/column drift and compact time tests. Local race-level lap packets must pass section/distance and winner-clock reconciliation. Store only approved evidence with lineage and status.
4. Build per-item evidence packet, test all active runners on at least one future card in dry-run only; benchmark by track/distance/going/class and sample size. Measure actual coverage/latency; no fake fills; unknowns for unavailable individual splits/gate details.
5. Verify deterministic read path and required evidence handoff; require a separate user-approved scoring contract before engine integration. Existing guarded production save contract still old and not compatible with SABC/multiple EYE; no production use. Test old data untouched, no cron.
