CREATE OR REPLACE FUNCTION private.jra_course_context(p_track text, p_surface text, p_distance integer, p_turn text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
  select jsonb_build_object(
    'course_key', private.jra_course_key(p_track,p_surface,p_distance,coalesce(nullif(p_turn,''),tp.default_turn)),
    'track',p_track,
    'surface',p_surface,
    'distance',p_distance,
    'turn',coalesce(nullif(p_turn,''),tp.default_turn),
    'climate_group',tp.climate_group,
    'turf_base_type',case when p_surface='芝' then tp.turf_base_type else null end,
    'turf_label',case when p_surface='芝' then tp.turf_label else null end,
    'surface_family',case
      when p_surface='芝' and tp.turf_base_type='COOL_SEASON_MIX' then 'TURF_COOL_SEASON'
      when p_surface='芝' then 'TURF_NOSHIBA_BASE'
      when p_surface='ダート' then 'DIRT'
      when p_surface='障害' then 'JUMP'
      else coalesce(p_surface,'UNKNOWN')
    end,
    'is_hokkaido_turf',(p_surface='芝' and tp.climate_group='HOKKAIDO'),
    'seasonal_overseed_possible',case when p_surface='芝' then tp.seasonal_overseed_possible else false end
  )
  from private.jra_track_profiles tp
  where tp.track=p_track
  union all
  select jsonb_build_object(
    'course_key',private.jra_course_key(p_track,p_surface,p_distance,p_turn),
    'track',p_track,'surface',p_surface,'distance',p_distance,'turn',p_turn,
    'climate_group',null,'turf_base_type',null,'turf_label',null,
    'surface_family',case when p_surface='ダート' then 'DIRT' when p_surface='障害' then 'JUMP' else coalesce(p_surface,'UNKNOWN') end,
    'is_hokkaido_turf',false,'seasonal_overseed_possible',false
  )
  where not exists (select 1 from private.jra_track_profiles tp2 where tp2.track=p_track)
  limit 1;
$function$
