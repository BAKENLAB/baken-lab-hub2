# JRA optional evidence - isolated research prototype (2026-10-23)

Branch: `research/jra-optional-evidence-20261023`. **Not deployed, not merged into main.**

## Purpose

Treat jockey/trainer/training comments and incident observations as **optional enrichment** rather than prerequisites. If sources do not exist, fail, timeout, or are not allowed for reuse, the original JRA ability prediction proceeds **unchanged**. In particular, absence of comments is **not a deduction**, and no horse moves in rank. Existing LAB EYE selection rules are unchanged.

## Code

- `optional-evidence.mjs` - injectable, bounded-time optional evidence adapter; no network or paid API calls.
- `optional-evidence.test.mjs` - Node native tests covering missing/error/timeout/date cutoff/attribution and unchanged prediction.
- Run `node --test research/jra-optional-evidence/optional-evidence.test.mjs`.

## Usage in a future isolated evaluator

```js
import { enrichPredictionNonBlocking } from "./optional-evidence.mjs";
const basePrediction = await existingJraEvaluate(context); // Required baseline remains independent.
const out = await enrichPredictionNonBlocking(basePrediction, {
  asOf: context.preraceCutoff, // ISO timestamp at/before race start
  loadComments: optionalAuthorizedReadOnlyAdapter, // Optional, may be absent
  timeoutMs: 800,
});
// Always use out.prediction as-is; do not reorder TOP5 or EYE.
const optionalSupportingNotes = out.optional_evidence;
```

## Input contract for optional adapter

Return an array with `horse_no`, `kind` (pre_race_comment, post_race_comment, training_comment, stewards_report, manual_observation), **own analytical paraphrase** `summary` <= 280 characters, `published_at` ISO date, `source_url` HTTPS, `verified:true`, `reuse_allowed:true`. Do not ingest verbatim copyrighted articles. Evidence published after the prediction's `asOf` cutoff is excluded. Integrator MUST verify the source, publication time, correct horse and race, and permission; the helper only applies basic guards. External adapters should honor the provided `AbortSignal`.

## Not implemented yet

- Automatic acquisition of jockey/trainer comments from verified, licensed/free sources.
- Database table or write procedure for notes / comments.
- Determining whether a comment's interpretation should influence numerical ability.
- Wiring to the deployed JRA claimed-MCP/Edge Function or HUB UI.

These deliberately remain separate from production until source-access rights, as-of leakage, coverage bias, scoring impact, and no-regression are verified using frozen historic race samples. **No Supabase DB write, Cron, workers, saved FROZEN, bet strategy, or paid API.**
