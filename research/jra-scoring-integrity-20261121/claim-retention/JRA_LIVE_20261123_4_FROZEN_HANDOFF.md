# JRA 2026-11-23 first 4 real FROZEN — immutable-status handoff

Source: **READ ONLY** public.official_predictions immediately after four authorized `jra_save_claimed_prediction` MCP operations. This file is a research audit note, not a prediction save/deployment.

| Track | Race | Frozen at JST | Active horses | TOP5 ordered | Official prediction UUID |
|---|---:|---|---:|---|---|
| 福島 | 1 | 09:26:17 | 16 | 12,5,10,13,3 | `20095291-3a18-4481-b1bc-4622f99263cf` |
| 東京 | 1 | 09:27:12 | 13 | 12,4,7,13,9 | `3fe74e69-4749-4096-a502-3bb9475395ba` |
| 福島 | 2 | 09:28:06 | 15 | 5,11,7,4,10 | `edc0789c-20fb-492f-8829-b6489e86280b` |
| 東京 | 2 | 09:28:17 | 17 | 1,7,12,6,16 | `5af61057-87e6-4325-afa4-4ab0dbd74192` |

## What has and has NOT been verified

- All four writes returned `db_frozen_evidence_verification=VERIFIED_FROZEN_SCORES_TOP5_AUDIT_EMPTY_BETS` from the official JRA MCP read-back, and reappeared as `status=FROZEN` in production SELECT. Job/lease, READY and before-post safeguards were applied by the standard RPC. No existing FROZEN was modified.
- Scores are `JRA_REBUILD_0.4_MANUAL_ASOF_EVIDENCE_REVIEW_NOT_CERTIFIED_DETERMINISTIC`, based on currently returned JRA CLAIM feature observations, manual effect weights with factual per-run source pointers, full-field reassessment and Eval evidence preview. Do **not** interpret these as a recovered or validated fixed numeric source→score policy. Original official byte-issuer signatures were not independently verified; archive source refs use claim-context surrogate identities.
- Each prediction explicitly stores `manual_score_weighting_caveat`, `fixed_operator_scoring_policy_approved=false`, `official_original_body_sha256_verified=false`. Bets are `[]`; strict `bet_strategy=SUSPENDED_FOR_ABILITY_STABILITY`.
- The first Fukushima R1 save attempt was refused by standard RPC due solely to the **bet_strategy fixed string mismatch**, not the evidence preview: unrecognized Japanese strategy text vs mandatory `SUSPENDED_FOR_ABILITY_STABILITY`. The actual underlying `public.jra_save_claimed_prediction` definition was inspected READ-ONLY. After exact cause identification and same existing valid CLAIM/time guard recheck, the corrected input saved successfully. Do not replay an unchanged refused payload.
- The very first JRA queue claim of the day was blocked by `next_attempt_at` created a few milliseconds after a stale `v_now`. This cause was verified and a separate isolated PostgreSQL patch tested in PR #83; **NO production claim function DB write** occurred. Valid jobs were subsequently claimed via the legitimate guarded MCP when time conditions changed.
- The new unapproved deterministic source-to-score research engine / original raw-byte archive issuer provider remains **undeployed**. PR #83 is Draft; **no production MCP edge deployment/merge** was performed.

## Next eligible race window (observed in official_races)

- Fukushima 3R: **2026-11-23 09:35 JST** first ordinary claim eligibility (70 minutes before scheduled post).
- Tokyo 3R: **09:50 JST**.
- These are scheduled eligibility thresholds, **not a promise of successful CLAIM or FROZEN**. Always re-check actual clock, READY, unsaved, official post, valid fresh CLAIM and guard. Do not use expired leases, bypass restrictions, change old FROZEN or restart Cron.
- Support LOCAL separately; do not let JRA work displace LOCAL.

Status: **4/23 JRA flat races official FROZEN confirmed; 19 remain unsaved at this point.** No ongoing background work promised.
