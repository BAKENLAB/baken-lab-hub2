-- JRA research-only pre-race FROZEN sidecar.
-- Completely independent of public.official_predictions and JRA save guards.
-- No automation/Cron changes. Only an EXPLICIT future manual function call saves.
CREATE TABLE IF NOT EXISTS private.jra_research_shadow_frozen_v1 (
 race_date date NOT NULL,
 track text NOT NULL,
 race_no integer NOT NULL CHECK (race_no BETWEEN 1 AND 12),
 model_version text NOT NULL
   DEFAULT 'JRA_ASOF_2025_RESIDUAL_V01',
 model_commit text NOT NULL
   DEFAULT '038e1d1d3f9406ae9fdd873ee8b3ee3762f1ccb7',
 source_post_time timestamptz NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 payload jsonb NOT NULL,
 CONSTRAINT jra_research_shadow_frozen_pk PRIMARY KEY
  (race_date,track,race_no,model_version),
 CONSTRAINT jra_research_shadow_no_empty CHECK
  (jsonb_typeof(payload)='object')
);
ALTER TABLE private.jra_research_shadow_frozen_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.jra_research_shadow_frozen_v1 FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.jra_research_shadow_immutable_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,private AS $$
BEGIN
 RAISE EXCEPTION 'JRA_SHADOW_FROZEN_IMMUTABLE';
END;
$$;
DROP TRIGGER IF EXISTS jra_research_shadow_no_update ON private.jra_research_shadow_frozen_v1;
CREATE TRIGGER jra_research_shadow_no_update
BEFORE UPDATE OR DELETE ON private.jra_research_shadow_frozen_v1
FOR EACH ROW EXECUTE FUNCTION private.jra_research_shadow_immutable_guard();
REVOKE ALL ON FUNCTION private.jra_research_shadow_immutable_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.jra_research_shadow_freeze_v1(
 p_date date,p_track text,p_race_no integer
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,public,private
AS $$
DECLARE
 target_post timestamptz;
 score jsonb;
 frozen_at timestamptz;
 already timestamptz;
BEGIN
 IF p_date IS NULL OR p_track IS NULL OR p_race_no IS NULL
   OR p_race_no NOT BETWEEN 1 AND 12
   THEN RETURN jsonb_build_object('status','INVALID_REQUEST'); END IF;
 SELECT r.post_time INTO target_post
 FROM public.official_races r
 WHERE r.circuit='JRA' AND r.race_date=p_date
   AND r.track=p_track AND r.race_no=p_race_no
   AND r.field_status='BASIC_READY'
 LIMIT 1;
 IF target_post IS NULL THEN
  RETURN jsonb_build_object('status','NO_OFFICIAL_READY_RACE'); END IF;
 IF clock_timestamp()>=target_post THEN
  RETURN jsonb_build_object('status','TOO_LATE_NO_RESEARCH_WRITE'); END IF;
 SELECT t.saved_at INTO already
 FROM private.jra_research_shadow_frozen_v1 t
 WHERE t.race_date=p_date AND t.track=p_track
   AND t.race_no=p_race_no
   AND t.model_version='JRA_ASOF_2025_RESIDUAL_V01';
 IF already IS NOT NULL THEN
  RETURN jsonb_build_object('status','ALREADY_FROZEN_RESEARCH',
    'saved_at',already); END IF;
 score := private.jra_live_locked_2025_score_packet_v1(
   p_date,p_track,p_race_no);
 IF score->>'status'<>'RESEARCH_SCORE_READY' THEN
  RETURN jsonb_build_object('status','SKIPPED_INCOMPLETE_RESEARCH_DATA',
   'underlying_status',score->>'status'); END IF;
 IF jsonb_array_length(score->'runners')<6 THEN
  RETURN jsonb_build_object('status','SKIPPED_INSUFFICIENT_RUNNERS'); END IF;
 -- Authoritative time check immediately before insert as well.
 IF clock_timestamp()>=target_post THEN
  RETURN jsonb_build_object('status','TOO_LATE_NO_RESEARCH_WRITE'); END IF;
 INSERT INTO private.jra_research_shadow_frozen_v1
  (race_date,track,race_no,source_post_time,payload)
 VALUES (p_date,p_track,p_race_no,target_post,score)
 ON CONFLICT DO NOTHING
 RETURNING saved_at INTO frozen_at;
 IF frozen_at IS NULL THEN
  RETURN jsonb_build_object('status','ALREADY_FROZEN_RESEARCH'); END IF;
 RETURN jsonb_build_object('status','RESEARCH_FROZEN_ONLY',
  'model','JRA_ASOF_2025_RESIDUAL_V01',
  'saved_at',frozen_at,'race_date',p_date,'track',p_track,
  'race_no',p_race_no,'runner_count',jsonb_array_length(score->'runners'),
  'official_prediction_written',false);
END;
$$;
REVOKE ALL ON FUNCTION private.jra_research_shadow_freeze_v1(date,text,integer)
 FROM PUBLIC,anon,authenticated;
