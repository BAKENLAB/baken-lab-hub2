# BAKEN LAB | JRA LAB EYE current-relevance hardening (staged, NOT active)
Date: 2026-10-17 JST
Production project: qjlvsndiqjfsfjinilig

## Confirmed production audit
- `JRA_MAIN` active protocol: `JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004`.
- `public.jra_save_claimed_prediction(uuid,text,jsonb)` validates EYE has correct shape and a matching graded runner, **but does not enforce the number, independence or current-race applicability of its positive evidence factors**.
- The JRA saved payloads checked for 2026-10-04/11/12 do not include `audit.eye_positive_factor_audit`, unlike LOCAL 1.6.
- 2026-10-11: 14/14 JRA FROZEN predictions selected an EYE. This is a reason to investigate, not proof of an incorrect selection.
- `public.jra_live_base_candidate_v1` separately computes `residual_fit_count` from same-class, near-distance and same-track fit. These categories can refer to overlapping historical evidence; do not call these independently proven race-level upside causes without verifying source records.

## Required new JRA EYE evidence contract (proposal)
For ALL active runners, preserve stable ability ranks and separately re-audit the entire field outside TOP5. EYE is optional and never default rank6.

For each proposed EYE positive factor record:
- `category`: a specific, independently identified current-race change/fit axis (class, distance, surface/going, course, relative handicap, jockey when evidence-backed, pace fit when lineup-based, current form, etc.)
- `reason`: a concrete claim about why this factor should matter in **today's** race.
- `evidence_refs`: at least one traceable race/result/entry source.
- `current_relevance`: boolean; only true can count.
- `independent_basis`: explain why this is not the same historical performance repackaged into another category. Two descriptions of a single form line do not automatically constitute two independent positive signals.
- `risk`: record contradictory form, field-change uncertainty or lack of data.

Selection should require >=2 **independent, current-relevant, corroborated** factors, subject to no-EYE abstention when no horse qualifies. Price/popularity remain completely isolated. Do not infer unknown preparation, equipment, draw, going or track bias as positives. Grade/reason matching must be preserved.

## Safe rollout sequence
1. Keep current JRA 0.3 saving RPC and active protocol unchanged. Do not abruptly add mandatory keys to the currently used producer; that risks breaking 2026-10-17 JRA hand-operated FROZEN saves.
2. Implement a separately versioned JRA 0.4 audit schema/producer contract on a staging path. Ensure **each** candidate outside TOP5 is compared and all evidence is recorded.
3. Tests: (a) two independent applicable positives -> accept; (b) one true plus one false -> reject; (c) duplicated source/cause -> reject; (d) no traceable evidence -> reject; (e) no candidate -> EYE null accepted; (f) frozen/claim/time/runner guards preserved; (g) old JRA 0.3 saved payloads read/display without changes.
4. Only after producer and save RPC are validated as a pair, activate the new JRA protocol for future races. Never backfill/recalculate existing FROZEN.
5. JRA score/ability ranking must not be changed by the EYE audit.

## LOCAL related
See `docs/fixes/local_eye_current_relevance_guard_20261017.sql`. The production LOCAL guard fix was applied by official Supabase migration `local_eye_current_relevance_count_20261017` and verified on all 33 existing 2026-10-16 FROZEN payloads. One factor mutated to `current_relevance=false` is rejected with `LOCAL_EYE_ABSTENTION`, as expected.

No paid API, Cron changes or historical prediction edits are authorized by this staging note.
