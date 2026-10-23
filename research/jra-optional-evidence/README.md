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

## 2026-10-23: race content and opponents pilot

- `race-content-evidence.mjs`: pure, offline, read-only analysis of race results and opponents' subsequent results, all bounded by the original pre-race as-of date in Japan time.
- `race-content-evidence.test.mjs`: 14 tests for fact extraction, future-data exclusion, runner attribution, incomplete fields, conservative unknowns, and unchanged ability scoring. The committed tests were executed in a JS assertion-compatible harness: **14 PASS / 0 FAIL**. Native Node / GitHub CI run has **not** been verified.
- Supabase production **SELECT-only pilot**: 2025-12-14 阪神11R 阪神JF, all 18 result records, target ギャラボーグ: 2nd, corner positions 12→13, final 3F 34.3 (rank 1), 0.2s behind winner, third draw. The winning rival スターアニス later finished first in 2026-04-12 桜花賞, which was known by the 2026-10-18 秋華賞 forecast. 42 later starts for 17 rivals are present in DB for this one case. The module displays evidence but does **not** lift its score.
- Full field count matching 18 does not make an archive complete: `archive_complete=false` here. A wider archive review for 2025-01-01 to 2026-10-18 found just 24 `archive_complete=true` races among 5,857 race rows. Thus no claims of complete horse history, opponent quality, or predictive uplift.
- Next gate: isolate predictive features and perform as-of, time-split validation across lower classes and graded races; report TOP5 lost as well as newly captured. No automatic jockey/trainer comment source has been approved or built.

### Design contract

1. Ranking remains `JRA_REBUILD_0.3_FLAT_HISTORY`; TOP5/EYE selection remains unchanged.
2. Race field and linked rivals are identified by source horse ID, never horse name alone.
3. No odds/popularity fields, no post-forecast results, no unverified race incidents, no grade-title boost.
4. Missing optional comments, incomplete archives and absent opponent histories never block existing scoring.
5. No production branch merge, Edge deployment, DB change, FROZEN mutation, Cron change, or paid API.
