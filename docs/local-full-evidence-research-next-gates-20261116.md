# LOCAL full-field evidence — remaining integration gates (2026-11-16)

Research only. PR #53 must remain draft/unmerged. No production changes, FROZEN edits, CLAIM, prediction save, direct DB writes, scheduled jobs, paid API or score/market inputs.

## New upstream adapter
- `automation/local-official-profile-plan-research.mjs`: uses the existing authorized `createNarOfficialReader` interface (`readRace(race,{limit:5},signal)` and `readHistory(current,{race,before:race.race_date,limit:5},signal)`).
- Validates current official roster against the trusted READY card including inactive horses; reads active horses only. Missing links, conflicting IDs, unsupported links, JRA histories, timeouts and empty histories are explicitly separated.
- Profile observation and a planned result URL are NOT observations of the result page. Result resolution independently requires official horse ID, past number, name and source.
- Synthetic adapter checks: 11/11 passed in JS harness; no live reader or native Node verification in this step.
- Saved DB evidence availability check: 2026-11-14 through 2026-11-16 had two LOCAL preclaim snapshots of one unique race; repeated snapshots are not incremental runs.

## Remaining real verification
1. Use an explicitly authorized research environment with the existing official reader; do not reuse expired CLAIMs or request a race after its cutoff. Do not add public endpoints or work around 429/authorization failures.
2. Use isolated read-only runner, one race at a time, no store/saver. Run the saved native regression tests and verify DOM parsing against permitted raw official HTML. Confirm link provenance independently; reject unsupported layouts. A valid profile run is not a successfully retrieved full result.
3. Report counts for active roster / unique official IDs / profile runs / LOCAL vs central / planned and retrieved pages / independently matched results / exact vs grouped corners / time and gap / final3f / verified opponent followup. Report actual failures and stop on access restriction.
4. The followup component and race-timing component are still not connected to production or the end-to-end runner. No 50R comparison or model adoption yet.
5. Only after coverage and as-of correctness are demonstrated, compare unchanged LOCAL1.6 with a research-only independent full-field reassessment. Keep current production predictions intact.

Public repo: code and synthetic fixtures only, no private snapshots, secrets, or raw profile payloads.
