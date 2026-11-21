CREATE OR REPLACE FUNCTION private.jra_merged_flat_history(p_horse_name text, p_horse_ref text, p_race_date date, p_live_past_runs jsonb, p_limit integer DEFAULT 20)
 RETURNS TABLE(rn integer, prior_date date, prior_surface text, prior_distance integer, finish integer, field_size integer, margin_to_winner numeric, weight_carried numeric, jockey text, early_pos numeric, pos_change numeric, prior_class text, source_kind text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  with db_rows as (
    select
      r.race_date as prior_date,
      r.surface as prior_surface,
      r.distance as prior_distance,
      x.finish::int as finish,
      r.field_size::int as field_size,
      round(
        private.jra_time_seconds(x.time_raw) - (
          select min(private.jra_time_seconds(y.time_raw))
          from public.jra_lab_runs y
          where y.race_id=x.race_id and y.record_role='full_runner'
        ),1
      ) as margin_to_winner,
      x.weight_carried,
      x.jockey,
      x.early_pos::numeric,
      x.pos_change::numeric,
      r.class_name as prior_class,
      'DB'::text as source_kind,
      2 as source_priority
    from public.jra_lab_runs x
    join public.jra_lab_races r on r.id=x.race_id
    where x.horse_name=p_horse_name
      and r.race_date<p_race_date
      and x.record_role='full_runner'
      and coalesce(r.surface,'')<>'障害'
      and coalesce(r.race_type,'')<>'障害'
      and coalesce(r.race_name,'') not like '障害%'
      and (
        private.jra_horse_key(p_horse_ref) is null
        or private.jra_horse_key(x.horse_ref) is null
        or private.jra_horse_key(x.horse_ref)=private.jra_horse_key(p_horse_ref)
      )
  ),
  live_rows as (
    select
      nullif(p.run->>'race_date','')::date as prior_date,
      nullif(p.run->>'surface','') as prior_surface,
      nullif(p.run->>'distance','')::int as prior_distance,
      nullif(p.run->>'finish','')::int as finish,
      nullif(p.run->>'field_size','')::int as field_size,
      nullif(p.run->>'margin_to_winner','')::numeric as margin_to_winner,
      nullif(p.run->>'weight_carried','')::numeric as weight_carried,
      nullif(p.run->>'jockey','') as jockey,
      nullif(p.run->>'early_pos','')::numeric as early_pos,
      nullif(p.run->>'pos_change','')::numeric as pos_change,
      coalesce(hr.class_name,nullif(p.run->>'race_class_detail',''),nullif(p.run->>'race_class','')) as prior_class,
      'LIVE'::text as source_kind,
      1 as source_priority
    from jsonb_array_elements(private.jra_flat_past_runs(coalesce(p_live_past_runs,'[]'::jsonb))) p(run)
    left join public.jra_lab_races hr
      on hr.source_ref=regexp_replace(coalesce(p.run->>'source_ref',''),'^.*CNAME=','')
    where nullif(p.run->>'race_date','')::date < p_race_date
  ),
  merged as (
    select distinct on (prior_date)
      prior_date,prior_surface,prior_distance,finish,field_size,margin_to_winner,
      weight_carried,jockey,early_pos,pos_change,prior_class,source_kind
    from (
      select * from live_rows
      union all
      select * from db_rows
    ) u
    where prior_date is not null
    order by prior_date,source_priority
  ),
  ordered as (
    select
      row_number() over(order by prior_date desc)::int as rn,
      m.*
    from merged m
  )
  select
    o.rn,o.prior_date,o.prior_surface,o.prior_distance,o.finish,o.field_size,
    o.margin_to_winner,o.weight_carried,o.jockey,o.early_pos,o.pos_change,o.prior_class,o.source_kind
  from ordered o
  order by o.rn
  limit greatest(1,least(coalesce(p_limit,20),50));
$function$
