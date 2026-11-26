-- Read-only: audit LOCAL historical pre-start snapshot availability.
-- Roster counts are snapshot metadata, not today's card; never read target results/odds/ranks.
with s as (
 select * from private.lab_preclaim_evidence_snapshots_v1
 where circuit='LOCAL' and race_date=date '2026-11-22' and track='佐賀' and race_no=8
 and captured_at<official_post_time and as_of<official_post_time
 order by captured_at desc limit 1
), e as (
 select s.id,s.active_runner_count,s.official_post_time,s.as_of,j
 from s cross join lateral jsonb_array_elements(s.evidence->'packet'->'evidence') j
 where j->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT'
 and j->>'identityVerifiedBy'='OFFICIAL_HORSE_REF'
 and j->'pastRace'->>'raceDate'<s.race_date::text
 and (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), l as (
 select s.id,j from s cross join lateral jsonb_array_elements(s.evidence->'packet'->'officialRaceLaps') j
 where j->>'status'='VERIFIED_RACE_LEVEL_LAPS' and j->>'finish_time_reconciled'='true'
 and j->>'individual_horse_sectionals'='false'
 and j->'pastRace'->>'raceDate'<s.race_date::text
 and (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), a as (
 select e.j->>'horseNo' as horse_no,e.j->>'horseName' as horse_name,
 count(*) as linked_prior_runs,
 count(*) filter(where jsonb_typeof(e.j->'corners')='array' and jsonb_array_length(e.j->'corners')>0) as with_corners,
 count(*) filter(where exists(select 1 from l where l.id=e.id and l.j->'pastRace'=e.j->'pastRace')) as linked_race_laps
 from e group by 1,2
)
select s.race_date,s.track,s.race_no,s.source_status,s.active_runner_count,s.as_of,s.official_post_time,
 (select count(*) from e) as verified_identity_prior_rows,
 (select count(*) from l) as verified_race_lap_rows,
 (select count(*) from a) as linked_runner_count,
 (select count(*) from a where linked_race_laps>0) as lap_linked_runner_count,
 (select coalesce(jsonb_agg(to_jsonb(a) order by horse_no::int),'[]'::jsonb) from a) as per_runner
from s;