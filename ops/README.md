# BAKEN LAB | 2026-11-07 readiness and LOCAL EYE preflight

**Purpose:** Detect preventable missing FROZEN outputs before post time without bypassing source, claim, audit or save gates.

Production diagnostics already deployed on 2026-11-07 JST (read-only):

- `public.lab_local_eye_preflight_v1(text,jsonb)` checks LOCAL1.6 version, 4 critical audit flags, TOP5 and outside pools, empty bets and old pair schema. It is an **advisory, not the entire 17-item EYE audit** and does not replace `lab_queue_save_prediction_v1`.
- `public.lab_race_readiness_audit_v1(date)` summarizes READY, prediction status, JRA/LOCAL queue state, post time, field runner count and historical horse-name match warnings. Horse-name mismatch is not evidence that a horse has no legitimate past runs. Official identity and cancellation must still be checked.

## Production-safe morning workflow
1. Obtain current JST. Inspect latest official JRA and NAR race schedules and registration count. A 0-row result means unregistered so far, **not** no meetings.
2. `SELECT * FROM public.lab_race_readiness_audit_v1('2026-11-07') ORDER BY post_jst,track,race_no;`
3. Verify current official card, cancellation/changes, horse identity and recent history against primary sources; do not fabricate missing rows or silently assign ranks.
4. Use only legitimate existing LOCAL v9 and JRA guarded claims. Before LOCAL save, construct full evidence-backed payload, call `SELECT public.lab_local_eye_preflight_v1('CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013', '<payload-as-jsonb>'::jsonb);` using the **actual candidate** (not an old rejected payload). If `ok=false`, diagnose the returned specific errors; do not save. If `ok=true`, still require the full 17-item audit and existing official save gate.
5. After each legitimate save independently confirm `DONE/FROZEN`, receipt, exact runners, TOP5/EYE, `bets=[]`, `bet_strategy=SUSPENDED_FOR_ABILITY_STABILITY`. Never rewrite FROZEN.
6. Record all unavailable reasons and next legitimate claim windows. Do not post-start save, replay rejected inputs, direct UPDATE, re-enable dormant Cron, introduce paid APIs or promote research models.

## Regression expectations
`ops/tests/20261107_readiness_preflight_checks.sql` contains SELECT-only checks. At the time of implementation all **28/28** LOCAL 11/6 saved records passed the advisory checker and all **5/5** deliberately bad versions of 船橋12R were detected. The readiness query identified all 8 missing records on 11/6.

## Known blockers, not fixed by these diagnostics
- Incomplete official horse-history retrieval and identity linkage, and official scratch propagation.
- Expired/blocked claim management. A stalled one-race worker can starve subsequent races.
- JRA and LOCAL hourly automation capacity for close post-time races. All-target success is unproven.
- HUB display of specific missing reasons.

**No claim of 100% readiness yet.** Full production sign-off requires source ingestion, successful guarded claim, audit, save and independent receipt checks for all eligible races before their starts. Tracking issue: #39.
