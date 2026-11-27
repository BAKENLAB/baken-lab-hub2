# REBORN 2 Work41 evidence integration

## Scope

Research-only correction responding to Main47 audit `23480f18566f095739b3c93ef6f36fb5186ae165`. Production, formal adoption, collection, model calls, DB writes and deployment remain prohibited.

## Completed locally

- Replaced identifier hashes with SHA-256 over retained raw synthetic bytes.
- Added independent arithmetic checks for finish/clock ordering, final-600, checkpoint rank, race-lap sum and individual split sum.
- Retained the inconsistent Work40 construction as a negative fixture and proved rejection.
- Added source-rooted synthetic documents for all EYE-01..15, each containing support, counter-evidence and irrelevant evidence; EYE-15 also declares overlap rather than double counting.
- Enforced strict RFC3339 chronology, cutoff, target-event exclusion, row pointers, duplicate IDs, recursive result/market alias rejection and actual hash verification.
- Physically separated the analysis envelope and result seal. Changing the sealed result changes only the result hash; the analysis hash and deterministic adapter output stay unchanged.
- Distinguished fixed target-roster/historical-peer contrast from an actual target-roster change.

## Codex boundary

The adapter in this packet is a deterministic transport receipt, not a scoring implementation. The accepted Codex patch at `310b78ee526567c3a19ab2958d67743648fa125b` remains the only candidate common-analysis change. A native scoring claim is not made here because its patch is not applied in this scratch checkout. The packet is ready to be supplied through that commit's replay boundary; formal output comparison remains pending repository-native execution and CI.

## Status

- Prior accepted Work ledger: **767**, unchanged.
- New local checks: research evidence only; not added to accepted ledger.
- Official observations: **0**.
- Formal blind races: **0**.
- Real-race collection: not executed.
- Remaining gates: repository-native Codex replay, exact CI success, official-use rights, identity/cutoff evidence, and Main approval.
