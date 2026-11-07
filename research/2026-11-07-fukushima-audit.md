# 2026-11-07 BAKEN LAB JRA/LOCAL failure analysis — shadow-only correction workstream

STATUS: research and diagnostics only. No production model changes, no existing FROZEN edits, no Cron changes, no paid API, no direct DB changes.

## Confirmed observations
- JRA30R + LOCAL16R, total 46 saved FROZEN with results; 7 missing FROZEN excluded.
- Winner TOP5 capture: Kyoto7/9, Tokyo8/10, Fukushima3/11, Saga6/7, Kochi7/9.
- Fukushima snapshots versus final conditions: mismatched going in 6/11 (dirt 1/3/4, turf 9/10/11), mismatched weather 11/11. Kyoto/Tokyo going 0 mismatches.
- Fukushima1R JRA live source checked 09:11 JST showed 稍重 and 小雨 ahead of 09:13 FROZEN, which still referenced older 重 and 曇. This is a confirmed as-of-source freshness gap. For the other Fukushima races, latest live table updates are AFTER FROZEN and cannot be treated as originally available.
- Official JRA saved field snapshot missing body weights in all 423 runners; JRA0.4 audit history_window=4.
- 11/7 JRA EYE selected 19 races, captured 8 podium finishers including 4 winners. Do not casually discard EYE.
- Major misses: Fukushima9 (winner LAB15, second LAB12), Fukushima10 (8,16,2; winner was EYE), Fukushima12 (15,10,5); Kyoto12 (6,12,13; winner EYE); Tokyo12 (12,11,3); Kochi11 (6,8,2); Kochi FINAL12 (5,1,6).
- Successful controls: Kochi6 (1,2,3), Kochi7 (3,1,5), Kochi9 (1,3,2), Saga11 (3,2,1), Tokyo8 (3,2,1), Tokyo11 (3,4,1).
- JRA0.4 earlier 10/24–11/6 winner TOP5 69/90; current day 18/30. The issue is concentrated in Fukushima but not exclusively there.
- Kochi11 runner #6 had pre-race NAR same-distance (1600m) career record 4-2-1-2, likely underused by a limited recent-history audit.

## Hypotheses requiring controlled replay
P0. Require source freshness cross-check before FROZEN: compare updated fields only if source_checked_at <= frozen_at.
P1. Add longer same-course/distance and class records to shadow runner audit; explicitly check recency and counterevidence.
P1. Re-examine large penalties for first dirt, first course/distance, new class, layoff and transfers, but never promote unsupported longshots.
P1. Track reliable past passing order, pace, sections, and horse equipment as timestamped pre-race features. Postrace passage is outcome, not predictor.
P1. Separately evaluate TOP5, rank6, and EYE. No automatic rank6 EYE. In trifecta recommendations, audit placement of all TOP5 including fifth rank.
P2. Treat 100-point ability scores as relative evidence, NOT a 95% win probability.

## Validation policy
Read-only paired backtest on JRA0.4 historical 10/24–11/7 and LOCAL1.6 historical 10/18–11/7. Track both newly captured winners and winners lost from controls; top3, EYE, and bet-order hits are separate measurements. Never backfit using official postrace information. Keep existing FROZEN and production algorithms unchanged until multiple-race comparison is accepted.

Companion file: research/2026-11-07-readonly-diagnostics.sql

Sources: BAKEN LAB Supabase official_races, official_predictions, official_results, jra_live_races; NAR Kochi11 pre-race table; JRA Fukushima official results.
