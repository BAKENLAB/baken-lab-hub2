-- JRA missing-ID archive candidates for pre-race identity review.
-- REVIEW ONLY; name equality does not establish runner identity.
-- No market, target-race outcome, ranking, FROZEN or claim modification.
CREATE OR REPLACE FUNCTION private.jra_missing_id_review_v1(
 p_race_date date,p_track text,p_race_no integer,p_asof timestamptz
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','public','private'
AS $fn$
WITH target AS (
 SELECT r.id,r.race_date,r.track,r.race_no,r.surface,r.distance
 FROM public.jra_live_races r
 WHERE (r.race_date,r.track,r.race_no)=(p_race_date,p_track,p_race_no)
 AND p_asof<p_race_date + interval '1 day'
), candidates AS (
 SELECT lr.horse_no,lr.horse_name,
   ar.race_date prior_date,ar.track prior_track,ar.race_no prior_race_no,
   ar.surface,ar.distance,ar.race_name,ar.class_name,
   run.finish,run.early_pos,run.final_turn_pos,run.final3f,
   ar.source_checked_at,
   row_number() over(partition by lr.horse_no order by ar.race_date desc,ar.track,ar.race_no) rn
 FROM target t
 JOIN public.jra_live_runners lr ON lr.live_race_id=t.id
 JOIN public.jra_lab_runs run ON run.horse_name=lr.horse_name
 JOIN public.jra_lab_races ar ON ar.id=run.race_id
 WHERE run.horse_ref IS NULL AND run.record_role='full_runner'
   AND ar.race_date<t.race_date AND ar.surface=t.surface
   AND abs(ar.distance-t.distance)<=200 AND run.finish BETWEEN 1 AND 3
   AND ar.created_at<=p_asof AND run.created_at<=p_asof
   AND ar.source_checked_at<=p_asof
)
SELECT jsonb_build_object(
 'status','REVIEW_ONLY_UNVERIFIED_HORSE_ID',
 'identity_confidence','UNVERIFIED',
 'must_confirm_official_identity',true,
 'allow_as_scoring_evidence',false,'score_effect',0,
 'target_race_result_used',false,'market_used',false,
 'asof',p_asof,
 'candidates',coalesce((
   SELECT jsonb_agg(jsonb_build_object(
    'horse_no',c.horse_no,'horse_name',c.horse_name,
    'identity_status','NAME_ONLY_UNVERIFIED',
    'prior_date',c.prior_date,'prior_track',c.prior_track,'prior_race_no',c.prior_race_no,
    'surface',c.surface,'distance',c.distance,'class_name',c.class_name,
    'race_name',c.race_name,'finish',c.finish,'early_pos',c.early_pos,
    'final_turn_pos',c.final_turn_pos,'final3f',c.final3f,
    'source_checked_at',c.source_checked_at,
    'allow_as_scoring_evidence',false
   ) ORDER BY c.horse_no,c.prior_date desc)
   FROM candidates c WHERE c.rn<=3
 ),'[]'::jsonb)
)
$fn$;
REVOKE ALL ON FUNCTION private.jra_missing_id_review_v1(date,text,integer,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.jra_missing_id_review_v1(date,text,integer,timestamptz)
 TO service_role;
