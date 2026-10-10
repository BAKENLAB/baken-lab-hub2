-- SHADOW READ-ONLY: set :live_race_id via bound query parameter.
-- No TRUNCATE, INSERT, UPDATE, DELETE, or calls to mutating functions.
-- This produces per-runner previous actual start and last-four actual-start count.
with target as (
  select lr.id as live_runner_id,lr.horse_no,lr.horse_name,lr.past_runs
  from public.jra_live_runners lr
  where lr.live_race_id = :live_race_id
), raw_history as (
  select t.live_runner_id,p.ord::int as source_ord,p.run,
    coalesce(p.run->>'raw','') as raw,
    nullif(p.run->>'finish','')::int as finish
  from target t
  cross join lateral jsonb_array_elements(coalesce(t.past_runs,'[]'::jsonb))
    with ordinality as p(run,ord)
), starts as (
  select h.*,
    row_number() over(partition by h.live_runner_id order by h.source_ord)::int as actual_start_no
  from raw_history h
  where h.raw !~ '(除外|取消|JRAへ転入)'
    and (h.finish is not null or h.raw ~ '中止')
), summary as (
  select live_runner_id,
    count(*)::int as actual_starts,
    count(*) filter(where actual_start_no<=4)::int as recent_four_starts,
    max(run->>'track') filter(where actual_start_no=1) as previous_track,
    max(nullif(run->>'distance','')::int) filter(where actual_start_no=1) as previous_distance
  from starts group by live_runner_id
)
select t.live_runner_id,t.horse_no,t.horse_name,
  coalesce(s.actual_starts,0) as actual_starts,
  coalesce(s.recent_four_starts,0) as recent_four_starts,
  s.previous_track,s.previous_distance
from target t left join summary s using(live_runner_id)
order by t.horse_no;
