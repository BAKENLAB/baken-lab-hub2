-- BAKEN LAB JRA 0.4 / read-only opponent evidence probe.
-- For a selected runner, identify the historical top-3 rivals in prior races,
-- then retrieve those rivals' subsequent 1st–3rd finishes strictly before
-- today's target race. This is an evidence-only diagnostic, NOT a scoring boost.
CREATE OR REPLACE FUNCTION private.jra_prior_opponent_evidence_v1(
  p_race_date date, p_track text, p_race_no integer, p_horse_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $fn$
WITH target AS (
  SELECT lr.horse_name,lr.horse_ref,lr.past_runs,rr.race_date
  FROM public.jra_live_races rr
  JOIN public.jra_live_runners lr ON lr.live_race_id=rr.id
  WHERE rr.race_date=p_race_date AND rr.track=p_track
    AND rr.race_no=p_race_no AND lr.horse_no=p_horse_no
    AND coalesce(rr.race_type,'') <> '障害'
),
past AS (
  SELECT h.rn,h.prior_date,h.prior_track,h.prior_surface,
    h.prior_distance,t.horse_name,t.horse_ref,t.race_date target_date
  FROM target t CROSS JOIN LATERAL private.jra_merged_flat_history_v2(
    t.horse_name,t.horse_ref,t.race_date,t.past_runs,4
  ) h
  WHERE h.prior_date<t.race_date
),
archive_candidates AS (
  SELECT p.*,r.id prior_race_id,r.race_name prior_race_name,
    x.finish prior_finish
  FROM past p
  JOIN public.jra_lab_races r ON r.race_date=p.prior_date
    AND r.track=p.prior_track AND r.surface=p.prior_surface
    AND r.distance=p.prior_distance
  JOIN public.jra_lab_runs x ON x.race_id=r.id AND x.record_role='full_runner'
    AND x.horse_name=p.horse_name AND x.horse_ref IS NOT NULL
    AND p.horse_ref IS NOT NULL
    AND substring(x.horse_ref FROM '([0-9]{10})/')
      = substring(p.horse_ref FROM '([0-9]{10})/')
),
unique_archive AS (
  SELECT a.* FROM archive_candidates a
  JOIN (
    SELECT rn, count(*) candidate_count
    FROM archive_candidates GROUP BY rn
    HAVING count(*)=1
  ) u ON u.rn=a.rn
),
rivals AS (
  SELECT a.rn,a.prior_date,a.prior_race_name,a.prior_finish,a.target_date,
    x.horse_name rival_name,x.finish rival_prior_finish,
    substring(x.horse_ref FROM '([0-9]{10})/') rival_code
  FROM unique_archive a
  JOIN public.jra_lab_runs x ON x.race_id=a.prior_race_id
    AND x.record_role='full_runner' AND x.finish BETWEEN 1 AND 3
  WHERE x.horse_name<>a.horse_name AND x.horse_ref IS NOT NULL
),
later AS (
  SELECT rv.rn,rv.prior_date,rv.prior_race_name,
    rv.prior_finish,rv.rival_name,rv.rival_prior_finish,
    future_r.race_date later_date,future_r.race_name later_race,
    future_r.class_name later_class,future_x.finish later_finish,
    row_number() OVER (
      PARTITION BY rv.rn,rv.rival_name
      ORDER BY future_r.race_date, future_r.track, future_r.race_no
    ) AS rival_followup_ordinal
  FROM rivals rv
  JOIN public.jra_lab_runs future_x ON future_x.horse_name=rv.rival_name
    AND future_x.record_role='full_runner' AND future_x.finish BETWEEN 1 AND 3
    AND substring(future_x.horse_ref FROM '([0-9]{10})/')=rv.rival_code
  JOIN public.jra_lab_races future_r ON future_r.id=future_x.race_id
    AND future_r.race_date>rv.prior_date AND future_r.race_date<rv.target_date
  WHERE rv.rival_code IS NOT NULL
)
SELECT COALESCE(
  (SELECT jsonb_build_object(
    'horse_no',p_horse_no,
    'horse_name',t.horse_name,
    'as_of_date',t.race_date,
    'research_only',true,
    'score_effect',0,
    'rival_followups',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'historical_race_date',l.prior_date,
        'historical_race_name',l.prior_race_name,
        'historical_target_finish',l.prior_finish,
        'rival_name',l.rival_name,
        'rival_historical_finish',l.rival_prior_finish,
        'later_date',l.later_date,
        'later_race',l.later_race,
        'later_class',l.later_class,
        'later_finish',l.later_finish
      ) ORDER BY l.prior_date DESC,l.rival_name,l.later_date)
      FROM later l WHERE l.rival_followup_ordinal<=3
    ),'[]'::jsonb)
  ) FROM target t), '{}'::jsonb);
$fn$;
REVOKE ALL ON FUNCTION private.jra_prior_opponent_evidence_v1(date,text,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_prior_opponent_evidence_v1(date,text,integer,integer) FROM anon,authenticated;
