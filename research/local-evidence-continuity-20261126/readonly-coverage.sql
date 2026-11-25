-- LOCAL 1.6 evidence continuity: read-only; never changes FROZEN, CLAIM or scores.
-- Change date bounds deliberately for a different audit window.
with params as (
  select date '2026-11-16' as from_date, date '2026-11-26' as to_date
), frozen as (
  select p.race_date,p.track,p.race_no,p.post_time,p.frozen_at,
         p.payload->'audit' as a
  from public.official_predictions p cross join params b
  where p.circuit='LOCAL' and p.status='FROZEN'
    and p.frozen_at<p.post_time and p.race_date between b.from_date and b.to_date
), per_race as (
  select f.race_date,f.track,f.race_no,
    coalesce(case when (f.a#>>'{official_past_content_audit,verified_corner_runs}') ~ '^[0-9]+$'
      then (f.a#>>'{official_past_content_audit,verified_corner_runs}')::int end,0) as corner_runs,
    coalesce(case when (f.a#>>'{official_past_content_audit,head_to_head_count}') ~ '^[0-9]+$'
      then (f.a#>>'{official_past_content_audit,head_to_head_count}')::int end,0) as direct_records,
    f.a#>>'{official_past_content_audit,full_race_laps}' as lap_status,
    f.a#>>'{official_past_content_audit,opponent_followup}' as followup_status,
    jsonb_typeof(f.a->'local16_scoring_trace')='object' as trace_present,
    f.a->>'scoring_trace_status' as trace_status,
    f.a->>'historical_scoring_parity' as parity_status,
    count(s.race_no) as prior_snapshots,
    count(s.race_no) filter(where s.source_status='READY') as ready_snapshots
  from frozen f
  left join private.lab_preclaim_evidence_snapshots_v1 s
    on s.circuit='LOCAL' and s.source_kind='LOCAL_OFFICIAL_CORNERS'
    and s.source_version='LOCAL_CORNER_1'
    and (s.race_date,s.track,s.race_no)=(f.race_date,f.track,f.race_no)
    and s.as_of<=f.frozen_at and s.captured_at<=f.frozen_at
    and s.captured_at<s.official_post_time
  group by f.race_date,f.track,f.race_no,f.a
), classified as (
  select *,
    case when corner_runs>0 then 'CORNERS_RECORDED'
      when prior_snapshots=0 then 'NO_PRIOR_SNAPSHOT_AND_NO_RECORDED_CORNERS'
      else 'SNAPSHOT_PRESENT_BUT_NO_RECORDED_CORNERS' end as corner_diagnosis
  from per_race
)
select race_date,count(*) as frozen_races,
  count(*) filter(where corner_runs>0) as recorded_corner_races,
  sum(corner_runs) as recorded_corner_runs,
  sum(direct_records) as direct_records,
  count(*) filter(where prior_snapshots>0) as prior_snapshot_races,
  count(*) filter(where ready_snapshots>0) as ready_snapshot_races,
  count(*) filter(where corner_diagnosis='NO_PRIOR_SNAPSHOT_AND_NO_RECORDED_CORNERS') as no_snapshot_no_corners,
  count(*) filter(where corner_diagnosis='SNAPSHOT_PRESENT_BUT_NO_RECORDED_CORNERS') as snapshot_no_corners,
  count(*) filter(where lap_status='NOT_VERIFIED') as laps_not_verified,
  count(*) filter(where followup_status='NOT_VERIFIED') as followup_not_verified,
  count(*) filter(where trace_present) as criterion_trace_races,
  count(*) filter(where trace_status='MANUAL_FACT_REFERENCED') as manual_disclosed_races,
  count(*) filter(where parity_status='UNVERIFIED') as parity_unverified_races
from classified group by race_date order by race_date;
-- A prior snapshot is not proof of roster digest match, successful lookup,
-- semantic source validity, actual use in scoring, or numerical parity.
-- Zero recorded corners is a missing audit signal, not proof no facts were read.
