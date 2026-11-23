CREATE OR REPLACE FUNCTION private.jra_history_context(p_horse_name text, p_horse_ref text, p_race_date date, p_live_past_runs jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  with h as (
    select
      r.race_date,
      case
        when coalesce(r.surface,'')='障害'
          or coalesce(r.race_type,'')='障害'
          or coalesce(r.race_name,'') like '障害%'
        then false else true
      end as is_flat
    from public.jra_lab_runs x
    join public.jra_lab_races r on r.id=x.race_id
    where x.horse_name=p_horse_name
      and r.race_date < p_race_date
      and x.record_role='full_runner'
      and (
        private.jra_horse_key(p_horse_ref) is null
        or private.jra_horse_key(x.horse_ref) is null
        or private.jra_horse_key(x.horse_ref)=private.jra_horse_key(p_horse_ref)
      )
  ),
  a as (
    select
      count(*)::int as db_total_runs,
      count(*) filter(where is_flat)::int as db_flat_runs,
      max(race_date) as last_activity_date,
      max(race_date) filter(where is_flat) as last_flat_date
    from h
  )
  select jsonb_build_object(
    'horse_key',private.jra_horse_key(p_horse_ref),
    'live_raw_n',jsonb_array_length(coalesce(p_live_past_runs,'[]'::jsonb)),
    'live_flat_n',jsonb_array_length(private.jra_flat_past_runs(coalesce(p_live_past_runs,'[]'::jsonb))),
    'db_total_runs',a.db_total_runs,
    'db_flat_runs',a.db_flat_runs,
    'last_activity_date',a.last_activity_date,
    'last_flat_date',a.last_flat_date,
    'days_since_activity',case when a.last_activity_date is null then null else p_race_date-a.last_activity_date end,
    'days_since_flat_ability',case when a.last_flat_date is null then null else p_race_date-a.last_flat_date end,
    'ability_history_source','JRA_DB_FLAT_DEEP',
    'activity_history_source','JRA_DB_ALL_RACES'
  )
  from a;
$function$
