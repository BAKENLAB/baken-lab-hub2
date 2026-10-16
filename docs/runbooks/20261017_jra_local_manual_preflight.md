# BAKEN LAB | 2026-10-17 JRA / LOCAL manual operations preflight
Status: preflight notes and **read-only** queries. Not a prediction, not permission to bypass production guardrails.
Checked at: approximately 2026-10-17 01:36–01:40 JST.
Production Supabase: `qjlvsndiqjfsfjinilig`.

## Scope and commitments
- No changing prior FROZEN, disabling the official save guard, enabling AI Cron, paid API, direct INSERT/UPDATE into predictions, or invented ACTIVE status.
- Allowed normal source discovery/refresh Cron continues unchanged. LOCAL prediction AI worker Cron stays disabled. Both LOCAL and JRA prediction saves must use official claim → claimed_context → guarded save, followed by DB verification of DONE + FROZEN.
- EYE common standard: all active runners analyzed, TOP5 locked, outside TOP5 independently re-audited, no odds/popularity, >=2 **distinct and current-relevant** positive facts or no EYE. JRA has **not** yet implemented the LOCAL evidence-count saving check; human/manual review must follow the standard while JRA 0.4 is tested.

## Grounded overnight state
| Stage | JRA | LOCAL |
|---|---|---|
| Source capture | Tokyo 12, Kyoto 12, Niigata 12 = 36; runners 153, 136, 183 = **472**, runner-count mismatches 0 | 0 today in `official_races` |
| Official-state verification | All 36 captured JRA HTML evidence rows say `UNVERIFIED_HTML_CAPTURE` / `official_status_verified=false` | NAR official discovery begins after 07:00 JST by active local-data-refresh |
| Official-race data | 0 rows | 0 rows |
| Claimable prediction jobs | 0 | 0 |
| Exclusions | Kyoto 4R obstacle; five JRA debut races require separate unsupported-history determination | Obihiro is Banei and NOT covered by current flat LOCAL model |
| Cron | JRA capture Cron still active; it is **not** a verified publisher | local-data-refresh active / local-prediction-enqueue active; local-ai region Cron disabled |

### Blocking issue 1: JRA verified publisher
`public.jra_publish_verified_card_v1(p_proof jsonb)` expects a verified JRA official card **checked within 120 seconds**, including exact field identities/numbers, draw, riders, weights, statuses ACTIVE/CANCELLED/EXCLUDED, proof SHA-256, checked_at, race identity and post_time. The current `jra-live` v26 source explicitly captures HTML provenance without verifying official ACTIVE state, and does not publish `official_races`. A captured JRA race without an independently re-verified numbered official card is **not ready to save**. Do not reuse old HTML hash and pretend it was checked now. Do not call legacy `publish_jra_live_race` to bypass the verified gate.

A separately tested official-status verification reader/publisher is required to make the JRA field READY. It must match every horse against current JRA official card and live identity data, reject unknown statuses, compute the SHA of newly fetched official HTML, then use the existing guarded verified publisher. Do not deploy based on imagined evidence.

### LOCAL timing
The deployed `local-data-refresh` v14 checks JST hour and skips before 07:00 / after 22:00 unless `force`; normal Cron is every 10 minutes. Its **schedule discovery** runs on normal invocations. Official per-race detail is pulled at most 4 hours before post; queue urgency improves within 2 hours. No reason to force update overnight. On 10/17 the official flat local meetings are Kochi 11R starting 15:35, Saga 11R starting 15:20 (official national NAR listing); Obihiro Banei is unsupported.

### Proposed manual flow
1. At/after normal morning import, inspect readiness rather than assume READY from source capture.
2. Confirm each race: future post_time, proper circuit, official current field READY/BASIC_READY, no prior FROZEN, no unsupported obstacle/new-horse status, complete all active horse data. When not ready, record reason and move to the next official race; no fabricated proof.
3. JRA claim eligibility is within **70 minutes of post** and >3 minutes to post, per `jra_manual_readiness_v1`. Earliest published JRA start Niigata 1R 09:45 JST; readiness earliest approximately 08:35 if official proof arrives.
4. LOCAL regular schedule source and verified field are necessary; absence of jobs before the normal morning refresh is not a worker failure.
5. After each save, read-only verify `official_predictions.status='FROZEN'` and matching job status DONE; log skip/error at race level.
6. Do not count source-captured JRA race as official field published, or mention completion unless confirmed by DB.

### Read-only SQL preflight
```sql
select public.jra_manual_readiness_v1('2026-10-17'::date) as jra_readiness;

select circuit, track, field_status, prediction_status, count(*) as races
from public.official_races where race_date='2026-10-17'
group by circuit, track, field_status, prediction_status
order by circuit, track, field_status;

select track, job_status, count(*) as jobs
from public.lab_prediction_jobs where race_date='2026-10-17'
group by track, job_status order by track, job_status;

select track, job_status, count(*) as jobs
from public.jra_prediction_jobs where race_date='2026-10-17'
group by track, job_status order by track, job_status;

select circuit, track, status, count(*) as saved
from public.official_predictions where race_date='2026-10-17'
group by circuit, track, status order by circuit, track;

select status_basis, official_status_verified, count(*) as html_evidence
from public.jra_html_evidence where race_key like '20261017_%'
group by status_basis, official_status_verified;

select jobname, active from cron.job
where jobname like 'local-ai-%' order by jobname;
```

### Known safety/performance constraints
- JRA source pages can have statuses changed at late notice; previously captured `jra_live_runners` with nonnull draw/jockey/weight does **not** prove current ACTIVE.
- In LOCAL, missing current bodyweight/draw/pace should remain MISSING and should not be counted as positive EYE factors.
- SAVE with confidence, not after deadline; exhausted/no data jobs are documented instead of repaired by rewriting history.
- On 10/16, 33 LOCAL DONE+FROZEN, 3 Kawasaki DEAD deadline misses. Avoid a repeat.
- The `local_eye_factor_count_guard_v1` correction is already applied as migration `local_eye_current_relevance_count_20261017`; no further LOCAL migration necessary to run today's manual saves.
