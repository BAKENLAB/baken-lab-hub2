# LOCAL1.6 EYE evidence preflight (integration proposal)

**Status: draft, not wired to production.** This module checks assembled data only. It does not call MCP, save predictions, access paid APIs, change the database, enable cron, or relax server-side guards.

## Reason

On 2026-11-04 Kanazawa 3R (1400m), a factor was linked to a historical 1500m run under same_condition_history. The production guard correctly returned LOCAL_EYE_FACTOR_UNVERIFIED. See #33.

## Usage

Use a validated COMPACT_V1 claimed-context and proposed LOCAL1.6 payload before the first save attempt. Run offline tests with:

    node --test automation/local-eye-preflight.test.mjs

Call the exported validateLocalEyePreflight(context,payload). If result.ok is false, display result.errors and do not send the payload for saving. A preflight pass is not a save permit: live CLAIM, post-time gate, READY, field integrity, DB guard and receipt check still apply.

## Safety and rollout

- Positive factors must refer to exact COMPACT_V1.runners[horse_no=N].recent_runs[I] evidence, matched to horse and checked category.
- Generic horse-page URLs do not identify a particular historical race and cannot independently prove track/distance. Refuse such references rather than guessing.
- CHECKED is not automatically a positive factor. Count separate current racing evidence; two factors from one race are not independent.
- Missing history fails closed; no invented form.
- Preserve immutable FROZEN, current LOCAL1.6, betting suspension, no odds/popularity, official EYE rules, CLAIM expiration and post time.
- Draft is NOT integrated with the live LOCAL MCP save tool or automation/local-ai-worker-factor.ts. The automated worker uses URL-style evidence, which requires a verified adapter plus tests first.
- Do not merge/deploy to main or enable cron without independent review. See #34 for fluctuating history retrieval.

## Tests

Nine unit tests: valid independent evidence, 1400/1500 mismatch, reference-category mismatch, ambiguous URL, noncurrent factor, duplicate race, TOP5 mismatch, missing history, nonempty bets. Runs offline with Node.js 20+.
