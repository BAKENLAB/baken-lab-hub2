# LAB REBORN | prospective as-of inputs locked on 2026-10-24

Scope: **research only**. Never classify these records as finalized v0.4/v0.6 scored predictions, and never update official LAB FROZEN.

## What actually happened

At 2026-10-24 **12:21:47 JST**, 20 still-unstarted JRA races had their pre-race **input evidence** inserted into existing append-only private research store `private.jra_research_shadow_frozen_v1`. This was an as-of source lock, **not a full LAB REBORN prediction/ranking**.

- Model namespace `LAB_REBORN_V04_ASOF_INPUT_20261024` (distinct from older `JRA_ASOF_2025_RESIDUAL_V01`).
- `model_commit` column stores pinned SHA **cc6c8c9988e25da1e72470a94dc141be635829a5** (v0.4 scorer *file blob SHA*, not a Git commit ID).
- Stored JRA races: 新潟6–12R (7), 京都6–12R (7), 東京7–12R (6).
- 256 declared and actual runners. 20/20 fields match, 0 duplicates/malformed runners, 0 post-target history dates, 0 saved_at >= official post_time.
- Historical inputs sanitized to pre-race prior dates, turf/dirt, distance, prior finishing, beaten gaps, 3f times, corner positions, going, race class, field size. Horse identity, current jockey and weights included. Odds/popularity omitted from model input; no target outcome labels inserted.
- Existing table already had a **BEFORE UPDATE/DELETE immutable trigger** and a unique primary index on (race_date, track, race_no, model_version); `INSERT ON CONFLICT DO NOTHING` was used.
- The SQL checked authoritative `public.official_races.post_time > clock_timestamp()` before writing and required `BASIC_READY`, matching full-field live roster, unique horse numbers, valid past dates, minimum six runners, no debut/jump events.
- **No table, trigger, function, Cron, official prediction, HUB scoring, LOCAL, or other production state was modified.** Only 20 new rows in private research input namespace were inserted.

## Why ranked REBORN is NOT frozen

The 2024-fitted v0.4 archive model uses *eight* historic starts, relative final-3F ranks, prior grade/class and six validated boolean indicators. The available live `past_runs` snapshots expose only *up to four* starts and omit direct final3f rank. In a join audit, the 2023–2026 archive did not contain all four recent starts for every runner in any of the 20 prospective races. Assigning absent features to zero would be an **unverified proxy model** and must not be labeled v0.4 or v0.6. In v0.6, clock/opponent diagnostics have zero score/rank deltas and are not evidence of an improved ranker.

## Correct use

- These 20 locks are valid **pre-race input timestamps and immutable evidence packets**, NOT prospective scored REBORN wins.
- A future scorer may use the locked pre-race evidence to analyze diagnostics, but if ranking is computed after start, do not count it as a prospectively ranked prediction.
- For an actual prospective rank freeze, first independently validate live-vs-archive feature parity (including prior last eight, last-3f ranks and grade identities), run the pinned v0.4 code before off-time, and add an immutable **separate versioned scored snapshot**; never update this input lock.
- Evaluate new catches **and** lost original-LAB top5 podium horses against original pre-race official FROZEN, not reconstructed proxies.

Audit performed via direct, read-checked Supabase queries on 2026-10-24.