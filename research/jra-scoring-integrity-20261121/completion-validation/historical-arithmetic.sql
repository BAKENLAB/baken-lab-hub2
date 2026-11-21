with p as (
select race_date,payload from public.official_predictions
where circuit='JRA' and status='FROZEN' and race_date in ('2026-11-14','2026-11-15','2026-11-21')
), h as (
select race_date,x from p cross join lateral jsonb_array_elements(case when jsonb_typeof(payload->'audit'->'runner_history_checked')='array' then payload->'audit'->'runner_history_checked' else '[]'::jsonb end) x
), v as (
select race_date,x,case when x->>'base_score' ~ '^[0-9]+$' then (x->>'base_score')::numeric end b,
case when x->>'score_after' ~ '^[0-9]+$' then (x->>'score_after')::numeric end s,
(select sum(case when e->>'points' ~ '^-?[0-9]+$' then (e->>'points')::numeric end) from jsonb_array_elements(case when jsonb_typeof(x->'evidence_effects')='array' then x->'evidence_effects' else '[]'::jsonb end)e) delta,
(select count(*) from jsonb_array_elements(case when jsonb_typeof(x->'evidence_effects')='array' then x->'evidence_effects' else '[]'::jsonb end)e where coalesce(e->>'points','') !~ '^-?[0-9]+$') invalid from h
)
select race_date,count(*) review_rows,
count(*) filter(where b is not null and s is not null and delta is not null and invalid=0) arithmetic_checkable,
count(*) filter(where b is not null and s is not null and delta is not null and invalid=0 and greatest(0,least(100,b+delta))=s) arithmetic_matches,
count(*) filter(where b is not null and s is not null and delta is not null and invalid=0 and greatest(0,least(100,b+delta))<>s) arithmetic_mismatches
from v group by race_date order by race_date
