-- Read-only, research candidate join only; archive facts still require source/as-of confirmation. No target results/market/ranks.
with s as (
 select * from private.lab_preclaim_evidence_snapshots_v1
 where circuit='LOCAL' and race_date=date '2026-11-22' and track='佐賀' and race_no=8
 and captured_at<official_post_time and as_of<official_post_time order by captured_at desc limit 1
), e as (
 select s.id,s.as_of,j from s cross join lateral jsonb_array_elements(s.evidence->'packet'->'evidence') j
 where j->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' and j->>'identityVerifiedBy'='OFFICIAL_HORSE_REF'
 and j->'pastRace'->>'raceDate'<s.race_date::text and (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), matches as (
 select e.j->>'horseNo' as current_no,e.j->'pastRace' as prior_race,e.j->>'pastHorseNo' as prior_no,
 count(h.id) as archive_matches,
 count(h.id) filter(where h.finish>0 and h.time_raw ~ '^[0-9]{1,2}[0-5][0-9][0-9]$') as valid_clock,
 count(h.id) filter(where h.finish>0 and h.final3f>0) as valid_final3f
 from e left join public.horse_runs h on h.race_date::text=e.j->'pastRace'->>'raceDate' and h.track=e.j->'pastRace'->>'track' and h.race_no::text=e.j->'pastRace'->>'raceNo' and h.horse_no::text=e.j->>'pastHorseNo' and h.horse_name=e.j->>'horseName'
 group by 1,2,3
)
select count(*) as linked_keys,count(*) filter(where archive_matches=1) as exact_archive_candidates,count(*) filter(where archive_matches=1 and valid_clock=1) as clock_candidates,count(*) filter(where archive_matches=1 and valid_final3f=1) as final3f_candidates,count(distinct current_no) filter(where archive_matches=1) as covered_horses,count(*) filter(where archive_matches>1) as ambiguous,count(*) filter(where archive_matches=0) as missing
from matches;