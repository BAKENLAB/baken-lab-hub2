# BAKEN LAB LOCAL official lap + opponent followup handoff — 2026-11-19

## Live deployed code (not a live horse-race success claim)
- Supabase project: `qjlvsndiqjfsfjinilig`
- `lab-local-corner-preclaim`: **v6, ACTIVE**, source SHA-256 `d65103c423c7fc1d7b4cd22842b9e6685ddf717177c0c7d8e42206aeafde3497`
- `lab-claimed-context`: **v30, ACTIVE**, source SHA-256 `c2297268f344322f3bc251b12d8e79690434e45732f42b817edf78fdbbf55a6c`
- Original LOCAL guarded save MCP v41 and immutable historical FROZEN not modified by this change.
- Snapshot of all deployed preclaim function source files under `supabase/functions/lab-local-corner-preclaim/`. Live claim context changes under `supabase/functions/lab-claimed-context/handler.mjs` and root `automation/`.

## Verified official past-race laps
Existing explicitly authorized, one-race pre-CLAIM NAR prior result reader already fetches a historical `RaceMarkTable` page to verify corners. It now optionally reads literal official `ハロンタイム`, race distance and winner time from that same page, validates exact URL, all 200m segments and their sum to the winner clock, and captures before target post time. Lap snapshots are sealed via existing service-role-only private append-only RPC alongside independently verified official corner witnesses. Live CLAIM lookup rechecks source, digest, signed timing, roster, and prior-run link. A race-wide 200m lap is **not** an individual horse's 200m split or proof of an incident.

## Exact horse-ID opponent later results — limited coverage
For official past result pages **already retrieved in that same authorized preclaim batch**, the parser records stable horse IDs linked directly in each official result row. Only when the same official horse ID appears in a strictly later but pre-target result page is its next finish linked to the current horse's verified common prior-race witness. Join by official horse ID, never name only, and revalidate both official race sources and timestamps at snapshot stage and live CLAIM. Maximum 80 links. This is **partial coverage**, not full opponent career-history retrieval or complete followup-strength analysis.

## ORIGINAL LOCAL1.6 only
Source-labeled past-race laps are included in criterion #2 (passing/pace) and the winning-path criterion. Verified partial opponent later finishes enter past form/class/winning-path criteria. Every row remains `evaluation_state: NOT_SCORED` pending independent LOCAL1.6 100-point assessment. Never auto-adjust scores, RANK, TOP5, LAB EYE, betting, existing FROZEN, or replace original 1.6 with an experimental rubric.

## Tests and rollout limit
- New official lap, claimed linkage, source-bound storage, and official HTML fixture CI tests passed on PR #66 head `cf7d83963561f7eee23e5674b9697f155cc8f21f` before deployment; later commits that track the exact deployed preclaim source may retrigger CI.
- Test fixtures are **synthetic**. No end-to-end run against actual upcoming READY LOCAL race, authorized preclaim, valid CLAIM, live scoring trace and official receipt has been confirmed yet.
- On the morning of 2026-11-19 JST, there were no 11/19–11/21 LOCAL official_races rows registered in production. Never invent a preclaim, CLAIM, saved score, or receipt.
- Legacy FROZEN counts after deployment unchanged: 11/16=30, 11/17=35, 11/18=35.
- The official source may omit/format laps differently; if distance/winner clock/lap grid is ambiguous, lap status MUST stay unverified and normal corner-only path may proceed.

## Next real race opening
For an officially READY, unpublished, future LOCAL race while its deadline/valid authorization permit, invoke the existing **explicit** `lab_preclaim_official_corners` using the exact JST date/track/race. Check whether the snapshot actually stores laps/peers (do not infer availability from a code deployment). Then acquire valid normal CLAIM, fetch `lab_claimed_context` and confirm `official_lap_evidence` and `official_opponent_followup` by horse ID, independently assign 100 points across every ACTIVE horse under the current 1.6 protocol, audit TOP5 outsiders/EYE, use the guarded FROZEN save and verify receipt before post time. Compare official results only afterwards. If a source is unavailable, diagnose it but never bypass gates, save after post, or rewrite frozen history.

## Remaining scope
The official opponent entire later career (not merely pages fetched for the current field), official result HTML live fixture, calibrated per-horse scoring impact, and honest pre-race-vs-result improvement evidence are **not complete**. Keep this PR Draft until a real as-of source and end-to-end operational check is recorded.
