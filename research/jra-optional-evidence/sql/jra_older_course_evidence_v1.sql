-- BAKEN LAB JRA: historical course-fit recall outside the four-run window.
-- Source: existing archived results only, dated strictly BEFORE target.
-- No current race result, market, odds, saved prediction or rank writes.
CREATE OR REPLACE FUNCTION private.jra_older_course_evidence_v1(
 p_race_date date, p_track text, p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,private
AS $fn$
WITH race AS (
 SELECT id,race_date,track,race_no,surface,distance,class_name
 FROM public.jra_live_races
 WHERE race_date=p_race_date AND track=p_track AND race_no=p_race_no
 AND coalesce(race_type,'')<>'障害'
 LIMIT 1
), horses AS (
 SELECT race.race_date,race.track,race.race_no,race.surface,race.distance,
   lr.horse_no,lr.horse_name,lr.horse_ref,lr.past_runs,
   substring(lr.horse_ref FROM '([0-9]{10})/') AS horse_code
 FROM race JOIN public.jra_live_runners lr ON lr.live_race_id=race.id
), history_cutoff AS (
 SELECT h.*,
 (SELECT min(run.prior_date) FROM private.jra_merged_flat_history_v2(
    h.horse_name,h.horse_ref,h.race_date,h.past_runs,4
 )) AS oldest_of_current_four
 FROM horses h
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'horse_no',h.horse_no,'horse_name',h.horse_name,
 'as_of_date',h.race_date,
 'oldest_of_current_four',h.oldest_of_current_four,
 'older_same_surface_near_distance',
 COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
   'date',p.race_date,'track',p.track,'race_no',p.race_no,
   'race_name',p.race_name,'class_name',p.class_name,
   'surface',p.surface,'distance',p.distance,'finish',p.finish,
   'final3f_rank',p.final3f_rank,'corners',p.corner_positions,
   'weight_carried',p.weight_carried,'source','JRA_ARCHIVED_RESULT',
   'older_than_recent_four',true,'score_effect',0
  ) ORDER BY p.race_date DESC,p.track,p.race_no)
  FROM (
   SELECT DISTINCT ON (ar.race_date,ar.track,ar.race_no)
    ar.race_date,ar.track,ar.race_no,ar.race_name,ar.class_name,
    ar.surface,ar.distance,x.finish,x.final3f_rank,x.corner_positions,x.weight_carried
   FROM public.jra_lab_runs x
   JOIN public.jra_lab_races ar ON ar.id=x.race_id
   WHERE h.oldest_of_current_four IS NOT NULL
    AND h.horse_code IS NOT NULL
    AND ar.race_date<h.oldest_of_current_four
    AND ar.race_date<h.race_date
    AND ar.surface=h.surface
    AND abs(ar.distance-h.distance)<=400
    AND x.record_role='full_runner'
    AND x.horse_name=h.horse_name
    AND substring(x.horse_ref FROM '([0-9]{10})/')=h.horse_code
   ORDER BY ar.race_date DESC,ar.track,ar.race_no,ar.source_checked_at DESC NULLS LAST
   LIMIT 12
  ) p
 ),'[]'::jsonb),
 'scores_are_not_changed',true
) ORDER BY h.horse_no),'[]'::jsonb)
FROM history_cutoff h;
$fn$;
REVOKE ALL ON FUNCTION private.jra_older_course_evidence_v1(date,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_older_course_evidence_v1(date,text,integer) FROM anon,authenticated;
