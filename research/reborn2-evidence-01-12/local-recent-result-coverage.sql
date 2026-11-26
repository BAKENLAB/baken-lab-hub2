-- Research candidate coverage only; exact matching and settled-at checks do not prove all values are correct. No target result.
with s as (
 select * from private.lab_preclaim_evidence_snapshots_v1 where circuit='LOCAL' and race_date=date '2026-11-22' and track='佐賀' and race_no=8 and captured_at<official_post_time and as_of<official_post_time order by captured_at desc limit 1
), e as (
 select s.as_of,j from s cross join lateral jsonb_array_elements(s.evidence->'packet'->'evidence') j
 where j->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' and j->>'identityVerifiedBy'='OFFICIAL_HORSE_REF' and j->'pastRace'->>'raceDate'<s.race_date::text and (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), joined as (
 select e.j->>'horseNo' as current_no,e.j->'pastRace' as prior_race,e.j->>'pastHorseNo' as prior_no,
 count(f) as matched,count(f) filter(where f->>'time' ~ '^[0-9]+:[0-5][0-9][.][0-9]$') as clocks,
 count(f) filter(where o.settled_at<=e.as_of and f->>'time' ~ '^[0-9]+:[0-5][0-9][.][0-9]$') as before_clock,
 count(f) filter(where f->>'final3f' is not null) as final3f
 from e left join public.official_results o on o.circuit='LOCAL' and o.race_date::text=e.j->'pastRace'->>'raceDate' and o.track=e.j->'pastRace'->>'track' and o.race_no::text=e.j->'pastRace'->>'raceNo'
 left join lateral jsonb_array_elements(o.result->'finishers') f on f->>'horse_no'=e.j->>'pastHorseNo' and f->>'horse_name'=e.j->>'horseName'
 group by 1,2,3
) select count(*) as prior_keys,count(*) filter(where matched=1) as exact_result_match,count(*) filter(where matched=1 and clocks=1) as clocks,count(*) filter(where matched=1 and before_clock=1) as before_clock,count(*) filter(where matched=1 and final3f=1) as final3f,count(distinct current_no) filter(where matched=1 and before_clock=1) as horses_with_clock from joined;