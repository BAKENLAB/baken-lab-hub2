# LOCAL 1.5 save worksheet — SHADOW only

This package creates an unfinished worksheet and checks a completed payload offline.
It does not evaluate horses, assign grades, call models, claim jobs, save predictions,
start tasks, or connect to production. Do not use it to backfill the Kochi 10R archive.

## Source of truth

Read-only retrieval on 2026-10-10 from Supabase project qjlvsndiqjfsfjinilig:

- `baseline/mcp-v9/index.ts`: deployed local-claimed-mcp version 9, tools and normalization.
- `baseline/mcp-v9/local-eye.mjs`: exact production EYE and seven-key validators.
- `baseline/mcp-v9/queue-operation.mjs`: guarded queue/save dispatch.
- `baseline/active-local-protocol.json`: active LOCAL_MAIN rule content/version.
- `baseline/lab_queue_save_prediction_v1.sql`: production save wrapper definition.
- `baseline/lab_save_claimed_prediction.sql`: production DB save definition.

These are reference copies, never deployment inputs. Refresh into a new versioned
research directory before using a changed production protocol. Do not execute the SQL.
All source hashes are recorded in `source-evidence.json`.

## Required seven-key payload

| Key | Worksheet / completed meaning |
|---|---|
| runners | All current ACTIVE horses; horse_no, horse_name, rank, grade, reason, context-derived running_style_reference |
| top5 | Exactly the rank 1–5 horses (or all horses when fewer than five); matching names, ranks, grades, reasons |
| eye | null with abstention evidence, or the unique eligible outside-TOP5 candidate with horse_no, horse_name, reason |
| bets | Always [] |
| summary | Evaluator-written summary, not a canned prediction |
| bet_strategy | SUSPENDED_FOR_ABILITY_STABILITY |
| audit | Whole-field evidence, completion flags, full outside-TOP5 checks and all unordered pairs |

Rank and grade start null. No fixed allocation of S/A/B/C is provided.
`all_runners_checked`, `field_integrity_checked`, and outside-audit flags start false.
Their names and values follow the actual production contract; do not mark them true
until the corresponding work and source verification have actually succeeded.

## Procedure for a future authorized live race

1. Obtain a current verified COMPACT_V1 context through the authorized existing MCP path.
   Claim is a production write and needs separate authorization. Archive the returned
   context and retrieval timestamp. Never pass popularity/odds/market data to ranking.
2. `node cli.mjs worksheet context.json` prints the unfinished seven-key worksheet.
   Output goes to stdout; choose a new filename and do not overwrite existing evidence.
3. During evaluation record every horse's facts, missing items and evidence summary.
   `runner_evidence_audit` contains horse_no, recent_runs_checked, evidence_summary,
   missing_items, plus worksheet-specific `evidence_facts` (two distinct factual
   statements). The extra facts field makes the protocol's minimum two facts inspectable;
   it is not a newly invented production scoring rule. Recent runs checked does not mean
   that every attribute exists. Unsupported claims remain missing.
4. Freeze whole-field ranks, independently assigned S–F grades and reasons; set TOP5
   from ranks. `node cli.mjs outside-slots ranked-draft.json` prints outside audit slots.
   Copy these slots into audit once. Each of N candidates has 17 checks; there are
   N*(N-1)/2 pairs. Slots are UNREVIEWED, not MISSING or CHECKED by default.
5. Review each slot at evaluation time. CHECKED requires a concrete finding and actual
   evidence refs. MISSING requires an unavailable-data explanation and empty refs.
   Never relabel an unperformed review as missing. For each candidate record unique
   upside_trigger, hidden_evidence, finish_path, risk, eye_case and evidence_refs.
6. Compare all pairs independently, with criterion CURRENT_UPSIDE_OVER_BASELINE,
   a concrete reason and both candidates' evidence. Use preferred_horse_no=null for
   unresolved/tied comparisons. Do not pick EYE first and manufacture supporting pairs.
   Selection requires two independent upside signals, at least one current, and unique
   superiority over every other candidate. The evaluator must judge this; a shape check
   cannot establish the quality or truth of those signals.
7. For abstention use eye=null, eye_selected_rank=null and a concrete
   eye_abstention_reason; keep all candidate and pair records. Copy running styles exactly
   from context, including ['?']; never infer them. Marks are not required.
8. `node cli.mjs check completed-payload.json context.json` runs the deployed MCP validator
   after the same evidence-ref normalization, followed by documented additional worksheet
   consistency checks. It does not modify either input or output a new ranking.
9. Present the unchanged completed prediction, evidence, missing data and claim deadline
   to the user. Save only after separate approval and fresh authorization/deadline checks.
   Production requires a live matching claim, current active protocol, no prior prediction,
   and more than three minutes until post time. Claim lease is normally 15 minutes.
   A format PASS does not permit saving an expired or unverified race.
10. After authorized save, reread and compare ranks, grades, TOP5, reasons and EYE, then
    check HUB. Keep any later results/analysis in separate files.

The helper additionally checks contiguous ranks, TOP5 content consistency, all ACTIVE
identities, grades/reasons, two fact entries per horse, unchanged context styles, summary,
and no comment overriding reason. These are explicit offline consistency checks, not
claims that every one is enforced by the deployed DB function.
Production MCP normalizes pair evidence_refs only. The normalized payload is returned
by the helper but ranks/grades/reasons/TOP5/EYE remain unchanged. HUB may supplement
current attributes and market data for display; it is not a byte-for-byte archive viewer.

## Tests and limits

Run from the repository root:

```sh
node --test --test-isolation=none research/lab-shadow/local-save-template-v1/template.test.mjs
```

18 PASS / 0 FAIL. All fixtures are fictional TEST_ONLY records and test-only:// refs;
no completed fixture is used as race data. Tests cover null and selected EYE, 68 check
slots/six pairs for a nine-horse fixture, incomplete work rejection, evidence requirements,
pair coverage/duplicates, market contamination in EYE evidence, flags, ranking preservation,
TOP5 reasons, copied styles, seven keys and empty bets.
The default isolated test launch failed in this execution environment; the explicit
non-isolated test run completed. No production or DB save test was performed.

Not established offline: evidence truth, horse identity, latest cancellation state,
history completeness, semantic absence of market influence, actual evaluation depth,
claim/user authorization, active version at save time, deadline, SQL acceptance, or live
HUB rendering. The worksheet cannot prove a claimed CHECKED action really happened.
The production EYE code validates schema and comparison consistency but does not itself
prove two independent factual signals; manual review remains mandatory.

No source baseline code is invoked to write to a DB. No external API, paid model, cron,
production config, HUB/main file, or Kochi 10R fixed prediction was changed.
