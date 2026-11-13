# LAB VALUE — 未知能力 × 高オッズ (RESEARCH ONLY)

Prepared 2026-10-31 for **2026-11-01 JRA Tokyo / Kyoto**. This is a separate research module, not a production betting feature.

## Purpose

Do NOT raise a horse's ability rank just because its class, distance or course is unknown. Instead, review TOP5 outsiders that have documented strengths from prior races (not merely absence of negative evidence); only afterwards inspect odds, asking if enough return is offered to investigate uncertain upside. Unknown ≠ strong; 20x ≠ positive EV.

## Tomorrow's manual runbook (Japan time)

1. Confirm official race/entry, that the race has **not started**, is not a debut/obstacle race, and that a complete **FROZEN** exists in production. If any requirement fails, stop for that race. Never create or change FROZEN from this research process.
2. Use the unchanged frozen ranking: score and rank are treated as read-only. Join full runners by horse number with the live racing histories captured at a verifiable timestamp before evaluation and post time. Check that all active runner numbers match and that the source was not refreshed afterwards. Do NOT include any result or post-race history.
3. Run the **blind premarket evaluation**: out-of-TOP5 only, positive evidence in the same turf/dirt and around the current distance (±300m). Examples: near-distance win, repeated TOP3, narrow defeats (<=0.4s), decisive win, previously shown early position. At least two evidence labels across at least two race dates; unknown exact distance / nearby-track / class; exclude repeated large recent defeats. These heuristics are exploratory, not a probability model.
4. Once blind candidates are fixed, read a separately timestamped **pre-race win-odds snapshot**, without using odds to change ability score/rank. Buckets: >=20x = HIGH_ODDS_REVIEW; 10–19.9x = MID_ODDS_REVIEW; <10x = LOW_ODDS_OR_SHORT_PRICE. Missing/late odds = wait. These are attention flags, **not betting advice or a purchase signal**.
5. Present candidate, original rank/score, race evidence (specific dated runs), uncertainty, contradictions, actual price timestamp and reasons to pass. **No candidate** is a valid answer. Log the candidate set and timestamp before the post time if feasible.
6. Compare only later with official results after racing; evaluate ALL flagged horses, including misses. Never rewrite the prior list. Review stability against current 0.4's TOP5.
7. To estimate **win** value need calibrated win probability and corresponding win odds; for **place** value need place probability plus actual place payout/odds. Today only win odds are available. No positive expected value can be inferred from the single-win odds alone.

## Running the pure module

Call evaluateLabValue from audit.mjs:

- race: race_date YYYY-MM-DD, track, race_no, post_time **timezone-qualified ISO** (not local text "15時40分"), surface, distance, class_name, race_type, field_size
- frozen: status FROZEN and frozen_at timezone-qualified ISO
- runners: complete original ranked list, with horse_no, horse_name, rank, score, past_runs and **history_captured_at** (timezone-qualified ISO) for each row
- market: optional, captured_at timezone-qualified ISO and runners array of horse_no, win_odds
- as_of: actual current time, timezone-qualified ISO

Market odds and popularity never enter blind evidence. Original rank, score, frozen prediction and bets remain unchanged. No DB writes, external APIs, cron, or long-running process are present.

To test after checkout: node --test research/jra-value-unknown-upside/audit.test.mjs

## DB field mapping (read-only inspection only)

- official_predictions: circuit JRA, date, track, race no, status FROZEN, frozen_at, payload.runners
- jra_live_races: race metadata; post_time stored as Japanese text, must convert to a proper +09:00 ISO timestamp and cross-check with the official start time
- jra_live_runners: live_race_id / horse_no, past_runs, source_checked_at; market win_odds, source_checked_at
- Caveat: source_checked_at is the **latest refresh** of the live runner row. A later refresh invalidates claims about what was previously available at FROZEN. Only inspect when actually before post; never retrospectively invent a snapshot.

## Verified readiness at evening of October 31

- Nov 1 JRA: Tokyo 12 races and Kyoto 12 races.
- 318 runners on cards, 262 with some past-run history, 17 with single-win odds at check time.
- Official JRA FROZEN: **0 at check time**, so no actual Nov 1 LAB VALUE candidate has yet been produced. Do not claim otherwise.
- The script is not deployed, merged or integrated with HUB or workers. It requires a **manual request** during live pre-race conditions after FROZEN.
- Existing JRA 0.4, LOCAL 1.6, bets suspension, FROZEN, Supabase and Cron stay untouched.

## Research guardrails

- The 20x research threshold is NOT optimized and can change only through documented out-of-sample validation.
- Don't cherry-pick 2026-10-31 winners. The Oct24/25/31 study was exploratory and not a prospective profitability test.
- Only production adoption after enough race coverage, successful no-hindsight comparisons and controlled explicit version decision.
