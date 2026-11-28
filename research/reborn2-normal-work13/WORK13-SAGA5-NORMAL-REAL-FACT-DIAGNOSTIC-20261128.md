# REBORN 2 NORMAL Work13 — Saga 5R real-fact diagnostic

## Result

The 2026-11-28 Saga 5R pre-start fact supply succeeded before the scheduled
17:00 JST post. Native NORMAL admission did not run and was not bypassed.

* official schedule refresh: 13:00:09 JST
* independent official-corner snapshot: 14:54:30 JST
* rendered official race-card DOM observation: about 14:55 JST
* roster: 7/7 ACTIVE, official NAR profile IDs fixed for every runner
* official race-card history display: 35/35 slots
* completed histories in those slots: 34/35; one Road Midnight slot is an
  official cancellation, not a completed run
* separately profile-ID-bound corner evidence: 13 runs
* verified opponent follow-ups in the private snapshot: 22
* verified race-level lap sets in the private snapshot: 1
* market, odds and popularity were excluded from the packet
* target result was unavailable and excluded
* CLAIM/save/FROZEN changes: none

The official race-card DOM showed Saga dirt 1400m right-handed, clear weather,
slightly heavy going, general A1/allowance conditions. The live ACTIVE set and
the stored official roster agree. The rendered DOM is not represented as raw
HTML. No raw response bytes were preserved or republished.

## Raw-original route versus fact diagnostic

The latest native NORMAL entry at commit `53af067a92f0e366bcd7d3b568a9561bf373f7bb`
requires locally present original bytes, pinned extraction, signed independent
rights/identity/custody/version/roster reviews and a configured approval
authority. That authority remains `NOT_CONFIGURED`. Therefore this Work13 path
does not call `issueNativeGraph`, does not fabricate signatures and does not
claim native admission.

The fact diagnostic is separately labelled. It contains independently observed
ordinary racing facts and source references, with the two existing private
snapshot digests retained. It is suitable for Codex12 mapping/review, not for a
formal grade, public forecast or production persistence.

## Important discrepancy

`horse_runs` alone is stale for this target. A narrow read for Pageant returned
older Funabashi/Oi rows as the latest five and omitted the three recent Saga
runs displayed by the official card (2026-11-15, 2026-10-18, 2026-09-27).
Accordingly, name-matched DB rows were not promoted to official identity-bound
NORMAL inputs.

## Fail-closed decision

`FACT_DIAGNOSTIC_READY; NORMAL_NATIVE_ANALYSIS_NOT_EXECUTED`.

Remaining admission blockers are enumerated in the JSON packet. The immediate
Codex12 task is to map the 13 identity-bound corner observations and 22 private
opponent follow-ups into the native evidence graph, obtain independent review
artifacts for the remaining projected facts, and preserve original bytes only
where the right to do so is confirmed. The cancelled historical slot must not
be counted as a fifth completed run.

No production, DB, prediction, FROZEN, CLAIM, Cron, deploy, merge, paid API or
formal adoption action was performed.
