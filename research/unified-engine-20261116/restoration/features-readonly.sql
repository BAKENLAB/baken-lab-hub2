with a as(
 select o.race_date,o.track,o.race_no,o.post_time,p.frozen_at,
 o.field_payload->'race' c,p.payload p,s.result res,
 (x->>'horse_no')::int no
 from official_races o
 join official_predictions p using(race_date,track,race_no)
 join official_results s using(race_date,track,race_no)
 cross join lateral jsonb_array_elements(o.field_payload->'runners') x
 where o.race_date between '2026-10-17' and '2026-11-15'
 and o.circuit='JRA' and p.status='FROZEN'
 and p.frozen_at<o.post_time and x->>'status'='ACTIVE'
 and o.field_payload->'race'->>'surface'='芝'
), b as materialized(
 select a.*,r.horse_name,r.past_runs::jsonb past,r.source_checked_at,
 (select f from jsonb_array_elements(p->'runners') f where (f->>'horse_no')::int=no limit 1) ev,
 (p->'eye'->>'horse_no')::int eye,
 (select (f->>'finish')::int from jsonb_array_elements(res->'finishers') f where (f->>'horse_no')::int=no limit 1) finish
 from a left join jra_live_races l
 on l.race_key=replace(a.race_date::text,'-','')||'_'||a.track||'_'||a.race_no||'R'
 left join jra_live_runners r
 on r.live_race_id=l.id and r.horse_no=a.no and r.source_checked_at<a.post_time
), c as materialized(
 select b.*,(ev->>'rank')::int rank,(ev->>'score')::numeric score,
 concat_ws(' ',ev->>'reason',ev->>'comment',ev->>'evidence_summary') combined,q.*
 from b cross join lateral(
 select avg((h->>'early_pos')::numeric/nullif((h->>'field_size')::numeric,0))
 filter(where h->>'early_pos'~'^[1-9][0-9]*$' and h->>'field_size'~'^[1-9][0-9]*$') early,
 count(*) filter(where h->>'early_pos'~'^[1-9][0-9]*$' and h->>'field_size'~'^[1-9][0-9]*$') known,
 count(*) filter(where ok) keep,max((h->>'race_date')::date) filter(where ok) lastkeep
 from (
 select h,(h->>'early_pos'~'^[123]$'
 and h->>'surface'=b.c->>'surface'
 and abs((h->>'distance')::int-(b.c->>'distance')::int)<=200
 and ((h->>'finish')::int=1 or (h->>'margin_to_winner')::numeric<=0.6)) ok
 from jsonb_array_elements(b.past) h
 where h->>'race_date'<b.race_date::text
 ) z
 ) q
), d0 as(
 select *,dense_rank() over(w order by case when known>=2 then early end nulls last) pr,
 count(*) filter(where known<2 or rank is null or score is null) over(w) missing
 from c window w as(partition by race_date,track,race_no)
), d as materialized(
 select *,pr<=3 and keep>=1 and race_date-lastkeep<=180 eligible,
 score+case when pr<=3 and keep>=1 and race_date-lastkeep<=180
 and combined<>'' and combined !~ '先行|逃げ|番手|ハナ|持続'
 then 5 else 0 end bs
 from d0 where missing=0
), e as(
 select *,row_number() over(partition by race_date,track,race_no order by bs desc,rank,no) nr from d
), f as(
 select *,max(case when no=eye and nr>5 then no end) over(w) retained,
 row_number() over(partition by race_date,track,race_no
 order by case when nr>5 and eligible then 0 else 1 end,keep desc,early,rank,no) ep
 from e window w as(partition by race_date,track,race_no)
), g as(
 select *,nr<=5 or (nr>5 and (coalesce(no=retained,false)
 or (retained is null and eye is null and ep=1 and eligible))) selected from f
)
select race_date,track,race_no,no as horse_no,horse_name,
 ev->>'horse_name' as frozen_horse_name,rank as rank_before,score as score_before,eye as eye_before,
 c as conditions,post_time,frozen_at,source_checked_at,early as legacy_mean_ratio,known as legacy_known,
 keep as legacy_keep,lastkeep,pr as legacy_dense_rank,eligible as legacy_eligible,
 nr as sql_rank_after,bs as sql_score_after,selected as sql_selected,combined,
 (select lr.horse_ref from jra_live_runners lr join jra_live_races rr on rr.id=lr.live_race_id
  where rr.race_key=replace(g.race_date::text,'-','')||'_'||g.track||'_'||g.race_no||'R' and lr.horse_no=g.no limit 1) horse_ref,
 (select lr.updated_at from jra_live_runners lr join jra_live_races rr on rr.id=lr.live_race_id
  where rr.race_key=replace(g.race_date::text,'-','')||'_'||g.track||'_'||g.race_no||'R' and lr.horse_no=g.no limit 1) history_updated_at,
 coalesce((select jsonb_agg(jsonb_build_object(
  'race_date',h->'race_date','track',h->'track','surface',h->'surface','distance',h->'distance',
  'finish',h->'finish','field_size',h->'field_size','margin_to_winner',h->'margin_to_winner',
  'early_pos',h->'early_pos','final_turn_pos',h->'final_turn_pos','race_class',h->'race_class',
  'source_ref',h->'source_ref','corner_positions',h->'corner_positions','final3f',h->'final3f',
  'pos_change',h->'pos_change')) from jsonb_array_elements(past) h),'[]'::jsonb) past_runs
from g order by race_date,track,race_no,no;
