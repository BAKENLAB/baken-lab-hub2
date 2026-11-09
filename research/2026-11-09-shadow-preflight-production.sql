-- BAKEN LAB: prospective, sealed, one-per-race shadow pair; NEVER official FROZEN.
-- RPC service-role only, full-field official identity and live CLAIM checks, no market.
CREATE TABLE IF NOT EXISTS private.lab_rank_shadow_preflight_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit text NOT NULL CHECK (circuit IN ('JRA','LOCAL')),
  race_date date NOT NULL,
  track text NOT NULL,
  race_no integer NOT NULL CHECK (race_no BETWEEN 1 AND 12),
  job_id uuid NOT NULL,
  post_time timestamptz NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  protocol_version text NOT NULL,
  proposal_model text NOT NULL,
  proposal_status text NOT NULL CHECK (proposal_status IN ('REORDERED','UNCHANGED')),
  field_athletes jsonb NOT NULL,
  draft_order jsonb NOT NULL,
  proposed_order jsonb NOT NULL,
  capture_sha256 text NOT NULL CHECK (capture_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT shadow_preflight_one_per_race UNIQUE (circuit,race_date,track,race_no)
);
ALTER TABLE private.lab_rank_shadow_preflight_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.lab_rank_shadow_preflight_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.lab_rank_shadow_preflight_v1 TO service_role;

CREATE OR REPLACE FUNCTION private.block_shadow_preflight_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'SHADOW_CAPTURE_IMMUTABLE';
END $$;
DROP TRIGGER IF EXISTS shadow_preflight_immutable_v1 ON private.lab_rank_shadow_preflight_v1;
CREATE TRIGGER shadow_preflight_immutable_v1
BEFORE UPDATE OR DELETE ON private.lab_rank_shadow_preflight_v1
FOR EACH ROW EXECUTE FUNCTION private.block_shadow_preflight_mutation_v1();
REVOKE ALL ON FUNCTION private.block_shadow_preflight_mutation_v1() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.lab_capture_rank_shadow_preflight_v1(
  p_circuit text,p_job_id uuid,p_baseline jsonb,p_preview jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,private,extensions
AS $$
DECLARE
 v_now timestamptz:=clock_timestamp();
 v_date date;
 v_track text;
 v_no integer;
 v_worker text;
 v_post timestamptz;
 v_protocol text;
 v_field jsonb;
 v_draft jsonb;
 v_proposed jsonb;
 v_digest text;
 v_status text;
 v_id uuid;
 v_saved text;
 v_n integer;
 v_frozen boolean;
BEGIN
 IF p_circuit NOT IN('JRA','LOCAL') OR p_job_id IS NULL
  OR jsonb_typeof(p_baseline)<>'array' OR jsonb_typeof(p_preview)<>'object' THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_BAD_INPUT';
 END IF;
 IF p_circuit='JRA' THEN
   SELECT j.race_date,j.track,j.race_no,j.claimed_by INTO v_date,v_track,v_no,v_worker
   FROM public.jra_prediction_jobs j
   JOIN public.jra_prediction_worker_runs w ON w.id=j.worker_run_id
   WHERE j.id=p_job_id AND j.job_status='CLAIMED' AND j.lease_until>v_now
     AND j.claimed_by='JRA_QUEUE_RESCUE' AND j.claimed_by=w.worker_id
     AND j.attempts<=j.max_attempts AND w.status='RUNNING'
   FOR SHARE OF j,w;
 ELSE
   SELECT j.race_date,j.track,j.race_no,j.claimed_by INTO v_date,v_track,v_no,v_worker
   FROM public.lab_prediction_jobs j
   JOIN public.lab_worker_runs w ON w.id=j.worker_run_id
   WHERE j.id=p_job_id AND j.circuit='LOCAL'
     AND j.job_status='CLAIMED' AND j.lease_until>v_now
     AND j.claim_token IS NOT NULL AND j.claimed_by=w.worker_id
     AND j.attempts<=j.max_attempts AND w.status='RUNNING'
   FOR SHARE OF j,w;
 END IF;
 IF NOT FOUND OR v_date IS NULL OR v_date<>(v_now AT TIME ZONE 'Asia/Tokyo')::date THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_NO_LIVE_CLAIM';
 END IF;
 SELECT r.post_time,r.field_payload->'runners'
  INTO v_post,v_field
 FROM public.official_races r
 WHERE (r.race_date,r.track,r.race_no,r.circuit)=(v_date,v_track,v_no,p_circuit)
   AND r.post_time>v_now+interval '3 minutes'
   AND r.prediction_status IN ('PENDING','RETRY')
   AND r.field_status IN ('READY','BASIC_READY')
 FOR SHARE;
 IF NOT FOUND OR jsonb_typeof(v_field)<>'array' THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_OFFICIAL_RACE_UNAVAILABLE';
 END IF;
 IF EXISTS (SELECT 1 FROM public.official_predictions p
   WHERE (p.race_date,p.track,p.race_no)=(v_date,v_track,v_no)) THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_FROZEN_ALREADY_EXISTS';
 END IF;
 SELECT version INTO v_protocol FROM public.lab_prediction_protocols
  WHERE protocol_key=(CASE WHEN p_circuit='JRA' THEN 'JRA_MAIN' ELSE 'LOCAL_MAIN' END)
    AND is_active=true;
 IF v_protocol IS NULL THEN RAISE EXCEPTION 'SHADOW_CAPTURE_PROTOCOL_UNAVAILABLE'; END IF;
 v_n:=jsonb_array_length(p_baseline);
 IF v_n NOT BETWEEN 6 AND 20 OR v_n<>(
   SELECT count(*) FROM jsonb_array_elements(v_field) a
   WHERE a->>'status'='ACTIVE') THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_FIELD_SIZE';
 END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_baseline) x
   WHERE jsonb_typeof(x)<>'object'
     OR (SELECT count(*) FROM jsonb_object_keys(x))<>3
     OR NOT (x ?& array['horse_no','horse_name','rank'])
     OR (x->>'horse_no') !~ '^[0-9]{1,2}$'
     OR (x->>'rank') !~ '^[0-9]{1,2}$'
     OR (x->>'horse_no')::int NOT BETWEEN 1 AND 24
     OR (x->>'rank')::int NOT BETWEEN 1 AND v_n
     OR coalesce(x->>'horse_name','')=''
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_field) f
       WHERE f->>'status'='ACTIVE' AND
       f->>'horse_no'=x->>'horse_no' AND f->>'horse_name'=x->>'horse_name'))
 OR (SELECT count(distinct x->>'horse_no') FROM jsonb_array_elements(p_baseline) x)<>v_n
 OR (SELECT count(distinct x->>'rank') FROM jsonb_array_elements(p_baseline) x)<>v_n THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_IDENTITY_OR_RANK';
 END IF;
 SELECT jsonb_agg((x->>'horse_no')::int ORDER BY (x->>'rank')::int)
 INTO v_draft FROM jsonb_array_elements(p_baseline) x;
 IF p_preview->>'status' NOT IN ('REORDERED','UNCHANGED')
    OR p_preview->>'baseline_kind'<>'EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT'
    OR p_preview->'production_rank_effect' IS DISTINCT FROM 'false'::jsonb
    OR p_preview->'market_used' IS DISTINCT FROM 'false'::jsonb
    OR p_preview->'target_result_used' IS DISTINCT FROM 'false'::jsonb
    OR p_preview->'official_saved' IS DISTINCT FROM 'false'::jsonb
    OR p_preview->'save_authorized' IS DISTINCT FROM 'false'::jsonb
    OR p_preview->'draft_runners_verified' IS DISTINCT FROM 'true'::jsonb
    OR coalesce(p_preview->>'model_version','') !~ '^ABILITY_RELATIVE_V0_[0-9]+ THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_UNVERIFIED_PREVIEW';
 END IF;
 IF p_preview->'baseline_top5' IS DISTINCT FROM (
     SELECT jsonb_agg(x.value ORDER BY x.ord)
     FROM jsonb_array_elements(v_draft) WITH ORDINALITY x(value,ord) WHERE ord<=5)
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_BASELINE_MISMATCH'; END IF;
 v_proposed:=p_preview->'candidate_order';
 IF jsonb_typeof(v_proposed)<>'array' OR jsonb_array_length(v_proposed)<>v_n
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_proposed) v
     WHERE v.value::text !~ '^[0-9]{1,2}
       NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_draft) b WHERE b.value=v.value))
   OR (SELECT count(distinct v.value) FROM jsonb_array_elements(v_proposed) v)<>v_n
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_PROPOSAL_FIELD_MISMATCH'; END IF;
 IF p_preview->'top5' IS DISTINCT FROM (
  SELECT jsonb_agg(v.value ORDER BY v.ord)
  FROM jsonb_array_elements(v_proposed) WITH ORDINALITY v(value,ord) WHERE ord<=5)
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_TOP5_MISMATCH'; END IF;
 v_status:=p_preview->>'status';
 IF (v_status='REORDERED' AND v_proposed=v_draft) OR
    (v_status='UNCHANGED' AND v_proposed<>v_draft) THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_STATUS_MISMATCH';
 END IF;
 -- SHA256 is calculated by the database; client-supplied digest is ignored.
 v_digest:=encode(extensions.digest(convert_to(
   jsonb_build_object('circuit',p_circuit,'race_date',v_date,'track',v_track,
    'race_no',v_no,'job_id',p_job_id,'field',
    (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
     ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
    'draft',v_draft,'proposed',v_proposed,'protocol',v_protocol,
    'model',p_preview->>'model_version')::text,'UTF8'),'sha256'),'hex');
 INSERT INTO private.lab_rank_shadow_preflight_v1(
  circuit,race_date,track,race_no,job_id,post_time,protocol_version,
  proposal_model,proposal_status,field_athletes,draft_order,proposed_order,capture_sha256
 ) VALUES (
  p_circuit,v_date,v_track,v_no,p_job_id,v_post,v_protocol,
  p_preview->>'model_version',v_status,
  (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
    ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
  v_draft,v_proposed,v_digest
 ) ON CONFLICT (circuit,race_date,track,race_no) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   SELECT s.capture_sha256 INTO v_saved FROM private.lab_rank_shadow_preflight_v1 s
    WHERE (s.circuit,s.race_date,s.track,s.race_no)=(p_circuit,v_date,v_track,v_no);
   IF v_saved IS DISTINCT FROM v_digest THEN RAISE EXCEPTION 'SHADOW_CAPTURE_ALREADY_SEALED_DIFFERENT'; END IF;
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN v_id IS NOT NULL THEN 'SEALED_PRE_RACE'
   ELSE 'ALREADY_SEALED_SAME' END,'capture_sha256',v_digest,
   'circuit',p_circuit,'race_date',v_date,'track',v_track,'race_no',v_no,
   'draft_top5',(SELECT jsonb_agg(x.value ORDER BY x.ord) FROM
      jsonb_array_elements(v_draft) WITH ORDINALITY x(value,ord) WHERE ord<=5),
   'shadow_top5',p_preview->'top5',
   'official_frozen_modified',false,'model_adopted',false);
END $$;
REVOKE ALL ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
TO service_role;
COMMENT ON TABLE private.lab_rank_shadow_preflight_v1 IS
 'Separate sealed research ranks only. Never writes official_predictions. Pre-race claim and source identity guarded. No updates/deletes.';
 OR
       NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_draft) b WHERE b.value=v.value))
   OR (SELECT count(distinct v.value) FROM jsonb_array_elements(v_proposed) v)<>v_n
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_PROPOSAL_FIELD_MISMATCH'; END IF;
 IF p_preview->'top5' IS DISTINCT FROM (
  SELECT jsonb_agg(v.value ORDER BY v.ord)
  FROM jsonb_array_elements(v_proposed) WITH ORDINALITY v(value,ord) WHERE ord<=5)
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_TOP5_MISMATCH'; END IF;
 v_status:=p_preview->>'status';
 IF (v_status='REORDERED' AND v_proposed=v_draft) OR
    (v_status='UNCHANGED' AND v_proposed<>v_draft) THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_STATUS_MISMATCH';
 END IF;
 -- SHA256 is calculated by the database; client-supplied digest is ignored.
 v_digest:=encode(extensions.digest(convert_to(
   jsonb_build_object('circuit',p_circuit,'race_date',v_date,'track',v_track,
    'race_no',v_no,'job_id',p_job_id,'field',
    (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
     ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
    'draft',v_draft,'proposed',v_proposed,'protocol',v_protocol,
    'model',p_preview->>'model_version')::text,'UTF8'),'sha256'),'hex');
 INSERT INTO private.lab_rank_shadow_preflight_v1(
  circuit,race_date,track,race_no,job_id,post_time,protocol_version,
  proposal_model,proposal_status,field_athletes,draft_order,proposed_order,capture_sha256
 ) VALUES (
  p_circuit,v_date,v_track,v_no,p_job_id,v_post,v_protocol,
  p_preview->>'model_version',v_status,
  (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
    ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
  v_draft,v_proposed,v_digest
 ) ON CONFLICT (circuit,race_date,track,race_no) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   SELECT s.capture_sha256 INTO v_saved FROM private.lab_rank_shadow_preflight_v1 s
    WHERE (s.circuit,s.race_date,s.track,s.race_no)=(p_circuit,v_date,v_track,v_no);
   IF v_saved IS DISTINCT FROM v_digest THEN RAISE EXCEPTION 'SHADOW_CAPTURE_ALREADY_SEALED_DIFFERENT'; END IF;
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN v_id IS NOT NULL THEN 'SEALED_PRE_RACE'
   ELSE 'ALREADY_SEALED_SAME' END,'capture_sha256',v_digest,
   'circuit',p_circuit,'race_date',v_date,'track',v_track,'race_no',v_no,
   'draft_top5',(SELECT jsonb_agg(x.value ORDER BY x.ord) FROM
      jsonb_array_elements(v_draft) WITH ORDINALITY x(value,ord) WHERE ord<=5),
   'shadow_top5',p_preview->'top5',
   'official_frozen_modified',false,'model_adopted',false);
END $$;
REVOKE ALL ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
TO service_role;
COMMENT ON TABLE private.lab_rank_shadow_preflight_v1 IS
 'Separate sealed research ranks only. Never writes official_predictions. Pre-race claim and source identity guarded. No updates/deletes.';
 THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_UNVERIFIED_PREVIEW';
 END IF;
 IF p_preview->'baseline_top5' IS DISTINCT FROM (
     SELECT jsonb_agg(x.value ORDER BY x.ord)
     FROM jsonb_array_elements(v_draft) WITH ORDINALITY x(value,ord) WHERE ord<=5)
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_BASELINE_MISMATCH'; END IF;
 v_proposed:=p_preview->'candidate_order';
 IF jsonb_typeof(v_proposed)<>'array' OR jsonb_array_length(v_proposed)<>v_n
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_proposed) v
     WHERE v.value::text !~ '^[0-9]{1,2}
       NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_draft) b WHERE b.value=v.value))
   OR (SELECT count(distinct v.value) FROM jsonb_array_elements(v_proposed) v)<>v_n
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_PROPOSAL_FIELD_MISMATCH'; END IF;
 IF p_preview->'top5' IS DISTINCT FROM (
  SELECT jsonb_agg(v.value ORDER BY v.ord)
  FROM jsonb_array_elements(v_proposed) WITH ORDINALITY v(value,ord) WHERE ord<=5)
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_TOP5_MISMATCH'; END IF;
 v_status:=p_preview->>'status';
 IF (v_status='REORDERED' AND v_proposed=v_draft) OR
    (v_status='UNCHANGED' AND v_proposed<>v_draft) THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_STATUS_MISMATCH';
 END IF;
 -- SHA256 is calculated by the database; client-supplied digest is ignored.
 v_digest:=encode(extensions.digest(convert_to(
   jsonb_build_object('circuit',p_circuit,'race_date',v_date,'track',v_track,
    'race_no',v_no,'job_id',p_job_id,'field',
    (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
     ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
    'draft',v_draft,'proposed',v_proposed,'protocol',v_protocol,
    'model',p_preview->>'model_version')::text,'UTF8'),'sha256'),'hex');
 INSERT INTO private.lab_rank_shadow_preflight_v1(
  circuit,race_date,track,race_no,job_id,post_time,protocol_version,
  proposal_model,proposal_status,field_athletes,draft_order,proposed_order,capture_sha256
 ) VALUES (
  p_circuit,v_date,v_track,v_no,p_job_id,v_post,v_protocol,
  p_preview->>'model_version',v_status,
  (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
    ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
  v_draft,v_proposed,v_digest
 ) ON CONFLICT (circuit,race_date,track,race_no) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   SELECT s.capture_sha256 INTO v_saved FROM private.lab_rank_shadow_preflight_v1 s
    WHERE (s.circuit,s.race_date,s.track,s.race_no)=(p_circuit,v_date,v_track,v_no);
   IF v_saved IS DISTINCT FROM v_digest THEN RAISE EXCEPTION 'SHADOW_CAPTURE_ALREADY_SEALED_DIFFERENT'; END IF;
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN v_id IS NOT NULL THEN 'SEALED_PRE_RACE'
   ELSE 'ALREADY_SEALED_SAME' END,'capture_sha256',v_digest,
   'circuit',p_circuit,'race_date',v_date,'track',v_track,'race_no',v_no,
   'draft_top5',(SELECT jsonb_agg(x.value ORDER BY x.ord) FROM
      jsonb_array_elements(v_draft) WITH ORDINALITY x(value,ord) WHERE ord<=5),
   'shadow_top5',p_preview->'top5',
   'official_frozen_modified',false,'model_adopted',false);
END $$;
REVOKE ALL ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
TO service_role;
COMMENT ON TABLE private.lab_rank_shadow_preflight_v1 IS
 'Separate sealed research ranks only. Never writes official_predictions. Pre-race claim and source identity guarded. No updates/deletes.';
 OR
       NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_draft) b WHERE b.value=v.value))
   OR (SELECT count(distinct v.value) FROM jsonb_array_elements(v_proposed) v)<>v_n
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_PROPOSAL_FIELD_MISMATCH'; END IF;
 IF p_preview->'top5' IS DISTINCT FROM (
  SELECT jsonb_agg(v.value ORDER BY v.ord)
  FROM jsonb_array_elements(v_proposed) WITH ORDINALITY v(value,ord) WHERE ord<=5)
 THEN RAISE EXCEPTION 'SHADOW_CAPTURE_TOP5_MISMATCH'; END IF;
 v_status:=p_preview->>'status';
 IF (v_status='REORDERED' AND v_proposed=v_draft) OR
    (v_status='UNCHANGED' AND v_proposed<>v_draft) THEN
   RAISE EXCEPTION 'SHADOW_CAPTURE_STATUS_MISMATCH';
 END IF;
 -- SHA256 is calculated by the database; client-supplied digest is ignored.
 v_digest:=encode(extensions.digest(convert_to(
   jsonb_build_object('circuit',p_circuit,'race_date',v_date,'track',v_track,
    'race_no',v_no,'job_id',p_job_id,'field',
    (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
     ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
    'draft',v_draft,'proposed',v_proposed,'protocol',v_protocol,
    'model',p_preview->>'model_version')::text,'UTF8'),'sha256'),'hex');
 INSERT INTO private.lab_rank_shadow_preflight_v1(
  circuit,race_date,track,race_no,job_id,post_time,protocol_version,
  proposal_model,proposal_status,field_athletes,draft_order,proposed_order,capture_sha256
 ) VALUES (
  p_circuit,v_date,v_track,v_no,p_job_id,v_post,v_protocol,
  p_preview->>'model_version',v_status,
  (SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->>'horse_name')
    ORDER BY (f->>'horse_no')::int) FROM jsonb_array_elements(v_field) f WHERE f->>'status'='ACTIVE'),
  v_draft,v_proposed,v_digest
 ) ON CONFLICT (circuit,race_date,track,race_no) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   SELECT s.capture_sha256 INTO v_saved FROM private.lab_rank_shadow_preflight_v1 s
    WHERE (s.circuit,s.race_date,s.track,s.race_no)=(p_circuit,v_date,v_track,v_no);
   IF v_saved IS DISTINCT FROM v_digest THEN RAISE EXCEPTION 'SHADOW_CAPTURE_ALREADY_SEALED_DIFFERENT'; END IF;
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN v_id IS NOT NULL THEN 'SEALED_PRE_RACE'
   ELSE 'ALREADY_SEALED_SAME' END,'capture_sha256',v_digest,
   'circuit',p_circuit,'race_date',v_date,'track',v_track,'race_no',v_no,
   'draft_top5',(SELECT jsonb_agg(x.value ORDER BY x.ord) FROM
      jsonb_array_elements(v_draft) WITH ORDINALITY x(value,ord) WHERE ord<=5),
   'shadow_top5',p_preview->'top5',
   'official_frozen_modified',false,'model_adopted',false);
END $$;
REVOKE ALL ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_capture_rank_shadow_preflight_v1(text,uuid,jsonb,jsonb)
TO service_role;
COMMENT ON TABLE private.lab_rank_shadow_preflight_v1 IS
 'Separate sealed research ranks only. Never writes official_predictions. Pre-race claim and source identity guarded. No updates/deletes.';
