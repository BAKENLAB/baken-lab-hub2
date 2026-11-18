# JRA REBORN R3 — Unknown condition vs. verified capability (research only)

## Status
- Research branch only, **not deployed or merged**.
- No changes to production JRA 0.4, FROZEN, Supabase, claims, LOCAL 1.6/1.7, EYE, bets, API spend, Cron, or any operational entrypoint.
- This module does **not** select/reorder horses. Its output has `proposed_rank:null` and `proposed_score:null` for every runner.
- `audit.mjs` is a pure, read-only audit module; it imports nothing from the HUB or DB and never performs network access.

## Why
The 2026-10-31 Kyoto 11R cases (Butterfly #5, Nix Luna #4) highlight that *not yet verified in a graded race/exact course* is not equivalent to *proven incapability*. The same concern covers flat-vs-obstacle evidence and graded class uncertainty; examples remain hypotheses rather than postrace automatic promotion orders.

## Input contract
Call `auditUnknownCapability(race, runners)`, with:

```js
import { auditUnknownCapability } from './audit.mjs';
const report = auditUnknownCapability(
  { race_date:'2026-11-01', track:'京都', surface:'芝', distance:1400, class_name:'オープン' },
  [
    // FULL field, not only TOP5. All entries include an explicit saved rank/score.
    // { horse_no:1, horse_name:'...', rank:1, score:96,
    //   past_runs:[{race_date:'2026-10-10', finish:1, margin_to_winner:0.3,
    //     surface:'芝', distance:1200, track:'京都', race_class:'未勝利'}] }
  ]
);
```

Caller must supply verified, date-stamped **pre-race** history. A record with missing date or with `race_date >= race.race_date` is excluded and flagged. Missing history is never interpreted as a failure. Obstacle-race results do not count toward flat capability proof. The module uses neither popularity nor odds.

## Audit fields
- `capability_evidence`: distinct positive markers like two recent top-three finishes; decisive win; distance bridge (good results both shorter and longer); repeated target-distance form; explicit graded top-three; same-track near-distance top-three.
- `unknown_conditions`: untested class, exact course, exact distance, surface. These flags do **not** automatically deduct ability points.
- `explicit_contradictions`: repeated documented large defeats in comparable conditions, which are different from mere unknowns.
- `history_warnings`: invalid/missing-date, non-prerace, or duplicate source record exclusions.
- `review_queue`: saved rank **outside TOP5** + at least two positive types + at least two distinct prior good race dates. This is a **comparison queue only**. No automatic promotion, score change, EYE, or new prediction.
- `comparison_anchor`: saved fifth-placed horse for human/independent model comparison; any changed TOP5 must be derived through a separate, controlled, versioned, prospective evaluation.

## Research gates before operational integration
1. Confirm source snapshots are physically frozen *before* the target race. The 2026-10-24/25/31 dataset cannot guarantee this: the present `jra_live_runners.source_checked_at` is after official FROZEN for most records. Do not claim a genuine blind prospective validation from those reconstructed rows.
2. Apply R3 audit to new, unseen race cards in a read-only shadow path. Freeze the **research** output before racing, separate from official FROZEN. No production writing while testing this isolated module.
3. Only after source integrity, compare top-five winner capture, three-place capture count, ◎ win/top3, runner-by-runner additions and displaced successful horses; preserve the successful 0.4 baseline and guard against rank changes made solely from uncertainty flags.
4. Validate different domains: maiden-to-graded 2yo, promotion 1→2/2→3/3→OP, long-distance transition, turf/dirt first attempt, previous obstacle run with documented older flat ability.
5. If there is measurable improvement without damaging successful controls, submit a **separate** release decision. This branch is not a release candidate, and a PR merge is not authorization to change production scoring or saved forecasts.

## Tests
From repository root:

```bash
node --test research/jra-r3-unknown-evidence/audit.test.mjs
```

Tests use synthetic pre-race fixtures, covering Butterfly-style 1200→1400←1500 bridge, Nix Luna-style repeat distance, single-race uncertainty, graded proof, actual contradictory races, obstacle separation, future-data exclusion, duplicate gates, no source mutation, and no automatic rank/score changes. Synthetic tests are **not** a validated improvement in racing accuracy. CI/execution results must be reported separately and not inferred from the presence of tests.

## Integration boundaries
Only the isolated `research/jra-r3-unknown-evidence/` directory is changed. The HUB's existing `automation/hub-prediction-contract.mjs` remains a transport validator; do not insert ranking logic there. No API endpoint, worker, DB migration, UI, workflow, or deployment is changed in this PR.
