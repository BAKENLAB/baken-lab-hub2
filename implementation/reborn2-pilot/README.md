# REBORN 2 実用化編 Codex01 — isolated development
Fixed engine f565e88af3404c84328a6cd035d2f21df3ea49dc. No research file changed.
Start specification 37a2462c2350d627da7a32ec9d01eea4ae41bc44.
Only this directory + its branch-only CI are added.

## Legacy trace (read-only source inspection)
- JRA MCP jra_official_publish_card (dry-run default, actual publish writes BASIC_READY);
  jra_claimed_context requires an existing claim; jra_save_claimed_prediction
  requires legacy runners/top5/eye/bets/audit and guarded RPC.
- LOCAL supabase/functions/local-claimed-mcp/index.ts:
  lab_preclaim_official_corners invokes append-only official historical acquisition;
  lab_claimed_context requires live claim; official_races/official_predictions
  and lab_prediction_jobs checked by guard. No tool called to acquire/claim/save.
- api/hub-data.js authenticated read-only proxy to hub2-api, displayPrediction
  compacts legacy selected EYE audit. today.html fetches action=list, reads
  FROZEN and payload.runners/top5, applies jraGradeOverlayForRace and rank sort.
- automation/hub-prediction-contract.mjs validates legacy rank/TOP5 protocol.
  None of these production files are edited. No DB or legacy RPC access.

## Actual implementation (Node 22, no dependencies)
```sh
node implementation/reborn2-pilot/test.mjs
node implementation/reborn2-pilot/cli.mjs FK34_FULL /tmp/reborn2-dev
node implementation/reborn2-pilot/cli.mjs WORK44_PARTIAL /tmp/reborn2-dev
```
Open the output HTML locally; static responsive preview, no network, auth or deploy.
Fixtures only. Unknown fixture also executable. Full/partial calls the frozen
analyzeVerified / analyzePartialVerified entry, not a new scorer.
inspectRealSupply validates only metadata/chronology/target result exclusion,
and returns HELD_REAL_ADMISSION for both circuits even with claimed permissions.
Actual source acquisition, native parsing/identity/status conformance, trusted
external custody/rights and approved real adapter not implemented/authorized.
No caller flag can enable real execution. Actual official source contract pending Work.
Full fixture uses synthetic ticks; partial uses signed synthetic clock;
neither is an actual prospective capture or backdated prediction.

## Separate snapshot contract
REBORN2_PILOT_SNAPSHOT_1: mode, scope, fixed engine commit, source digest,
race ID/circuit, cutoff/analysis time/start lower/scheduled post and time domain,
all horse IDs/numbers/statuses, unconverted SABC/UNASSESSED, five axes,
win/place/counter paths, EYE15 review, concrete evidence-linked item findings,
comments, holds, coverage, source/decision scope. SHA256 of serialized body;
atomic no-replace local file, duplicate rejected. Hash integrity is not external
signature or WORM; no production storage. No update/delete, odds or TOP5.
For official pilot, a trusted time/custody ledger, rights and immutable source
retention are still required. This implementation does not authorize official
storage, publication or promotion. Fixture preview is not production HUB.

## Display
All horses in horse-number order, not grade/rank order. SABC or 未評価,
five-axis detail, supported/held paths, LAB EYE all classifications, concrete
comments, reasons and 115 item details. No inferred ACTIVE, grade conversion,
fixed S quota or old score. Unknown remains distinct from C.
Original research mode and formal null retained. Separate pilot stage review.

Storage normalizes JSON wire values before hashing. Full-mode repeated route
judgments are stored once under paths; the five-axis and item projections
reference those route IDs. Full concrete evidence remains in path axes, and
partial source findings are retained. Snapshot roundtrip checks compare
serialized hash, avoiding giant deep-equality diagnostics.
