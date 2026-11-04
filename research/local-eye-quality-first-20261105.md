# LAB EYE: quality-first restoration (research-only) — 2026-11-05

## Emergency production repair, already performed

- Project: LAB LINK / `qjlvsndiqjfsfjinilig`
- Migration applied: `repair_local_v16_eye_guard_trigger_scope_20261105`
- Restored a **new**, enabled `BEFORE INSERT` trigger on `public.official_predictions` only when `circuit='LOCAL'` and `protocol_version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'`.
- The trigger calls existing `public.local_eye_comparison_insert_guard()`, which in its 1.6 branch calls `public.local_eye_factor_count_guard_v1(payload)`.
- Unchanged: 1.5 trigger, existing FROZEN predictions, protocol 1.6 activation, rankings, EYE payloads, bets, queues, cron.
- Verified: both 1.5 and 1.6 triggers enabled; all 44 original 2026-11-04 LOCAL1.6 FROZEN payloads pass a read-only call to the current guard; deliberate EYE mismatch yields `LOCAL_EYE_SELECTION_MISMATCH`.
- Historical guard replay revealed some exceptions on 2026-10-13 and 2026-10-23. Do not rewrite those original predictions.
- **Important source drift:** the live helper currently computes `n := current_n` (number of positive factors marked `current_relevance=true`), whereas original 2026-10-13 migration source computed `n := jsonb_array_length(...)`. Reconcile before changing guard implementation; never overwrite the current live helper with stale source.

## Root cause: selection policy, separate from trigger

The 1.5 rule compared the ability-relative **upside for this race** with independent evidence, all candidates, current-condition bridge, and contrary evidence. On 2026-10-13, 1.6 switched to positive-factor **count first**, using qualitative comparison only for count ties. That behavior remains active **after the trigger repair**. Do not claim the qualitative improvement has been deployed.

### Proposed LOCAL EYE QUALITY 1.1 SHADOW contract

1. Keep production TOP5 and original all-runner ability ranks frozen and unmodified. No popularity or odds.
2. For every non-TOP5 ACTIVE horse: preserve all 17 audit checks, verified facts and source refs, explain `upside_trigger`, `hidden_evidence`, `finish_path`, `risk`.
3. At least 2 independent affirmative factors for eligibility, with a current-condition connection; multiple labels from the same single fact do not count as independent. Flags marked `current_relevance=false` do not establish eligibility. A source page may corroborate multiple independent factual events, but the factual events must be distinguished.
4. Among eligible candidates compare the **probability and strength of exceeding baseline ability rank in this particular race**, not factor count. Compare with each other and with the regular 6th horse. Document reasons and adverse evidence. A 7th-or-lower candidate may win; 6th is never automatic. Missing/ambiguous comparative evidence -> `EYE=null`.
5. Freeze shadow candidate before post time and before outcome is known. No changes to official prediction, result, bets or HUB public display.
6. Evaluate prospective same-race paired comparisons: EYE top-3, wins, 6th top-3, eye-only vs sixth-only, missed successful incumbent EYE and venue/period strata, plus selection/abstention rate. Validate non-regression before promoting production.

## Current baseline / caveats

- LOCAL1.5 (historical, different race sets): 46 EYE, 9 top-3; in 20 races selecting rank >=7, EYE 7 top-3 versus regular sixth 3.
- LOCAL1.6 through 2026-11-04: 316 EYE, 76 top-3; in 90 selecting rank >=7, EYE 13 top-3 versus regular sixth 24.
- This is a **cross-period observational comparison**, not proof that reverting to 1.5 improves modern races. Do not change production selection from these metrics alone.
- Some earlier apparent mismatches counting all positive factors were not real mismatches: the *current live helper* counts only currently relevant factors. Avoid describing all 7 suspected null-EYE cases as confirmed violations.
- Current 1.6 factor count was 2 in 252 EYE selections (62 top-3), 3 in 58 (13 top-3), and 4 in 6 (1 top-3). Count alone did not monotonically predict success in this sample.

## Release gates

- Production 1.6 guard: repaired, live and verified through catalog/read-only checks. Monitor next official save receipts and rejection codes through normal workflows; do not bypass a legitimate rejection.
- QUALITY 1.1 selection: **RESEARCH ONLY, NOT DEPLOYED**. Implement independent pre-race shadow generator and sample audits, then prospective evaluation before activating a distinct protocol version.
- No direct DB rewrite of old FROZEN, no late backfilling, no cron restart, no paid model/API calls.
