-- RESEARCH STAGE ONLY — NOT EXECUTED / NOT DEPLOYED.
-- Optional append-only LOCAL1.7 full-field capture alongside the existing
-- independently sealed LOCAL1.6 draft. Not a prediction, bet, or rank update.
-- Apply only after explicit review of live claims, official SAVE transaction,
-- service-role grants, race-clock budget, and offline/production QA.
CREATE TABLE IF NOT EXISTS private.lab_v17_independent_preflight_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 circuit text NOT NULL DEFAULT 'LOCAL' CHECK (circuit='LOCAL'),
 race_date date NOT NULL, track text NOT NULL, race_no integer NOT NULL,
 job_id uuid NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 post_time timestamptz NOT NULL,
 original_capture_sha256 text NOT NULL,
 model text NOT NULL CHECK(model='LOCAL_1_7_INDEPENDENT_SHADOW_V0_3'),
 status text NOT NULL CHECK(status IN ('FULL_FIELD_PAIRED_RESEARCH_ONLY','ABSTAINED')),
 abstention_reason text,
 baseline_top5 jsonb NOT NULL,
 shadow_top5 jsonb,
 complete_shadow_order jsonb,
 score_table jsonb,
 capture_sha256 text NOT NULL,
 market_used boolean NOT NULL DEFAULT false CHECK(market_used=false),
 target_result_used boolean NOT NULL DEFAULT false CHECK(target_result_used=false),
 production_rank_effect boolean NOT NULL DEFAULT false CHECK(production_rank_effect=false),
 CHECK (captured_at < post_time),
 CHECK (
  (status='ABSTAINED' AND score_table IS NULL AND shadow_top5 IS NULL
    AND complete_shadow_order IS NULL AND abstention_reason IS NOT NULL)
  OR
  (status='FULL_FIELD_PAIRED_RESEARCH_ONLY' AND score_table IS NOT NULL
    AND shadow_top5 IS NOT NULL AND complete_shadow_order IS NOT NULL
    AND abstention_reason IS NULL)
 ),
 UNIQUE(circuit,race_date,track,race_no)
);
REVOKE ALL ON TABLE private.lab_v17_independent_preflight_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON TABLE private.lab_v17_independent_preflight_v1 TO service_role;

-- Caller: only the already authorized pre-FROZEN canonical capture RPC,
-- inside the SAME transaction and BEFORE the original guarded save.
-- This function never checks an untrusted client-supplied clock and never
-- accepts post-FROZEN capture; its source is the EXISTING sealed preflight.
CREATE OR REPLACE FUNCTION private.lab_capture_v17_independent_preflight_v1(
 p_job_id uuid,p_sidecar jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','public','private','extensions'
AS $v17$
DECLARE
 v_prior private.lab_rank_shadow_preflight_v1%ROWTYPE;
 v_now timestamptz:=clock_timestamp();
 v_n integer;
 v_top jsonb;
 v_order jsonb;
 v_baseline jsonb;
 v_digest text;
 v_id uuid;
 v_saved text;
 v_status text;
 v_reason text;
 v_scores jsonb;
BEGIN
 IF p_job_id IS NULL OR jsonb_typeof(p_sidecar)<>'object'
   OR octet_length(p_sidecar::text)>60000
 THEN RAISE EXCEPTION 'V17_SHADOW_BAD_INPUT'; END IF;
 SELECT s.* INTO v_prior
 FROM private.lab_rank_shadow_preflight_v1 s
 WHERE s.circuit='LOCAL' AND s.job_id=p_job_id
 ORDER BY s.captured_at DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND OR v_prior.race_date<>(v_now AT TIME ZONE 'Asia/Tokyo')::date
   OR v_prior.post_time<=v_now+interval '3 minutes'
   OR v_prior.captured_at>=v_prior.post_time
   -- Recheck live lease and official readiness at the exact capture attempt.
   OR NOT EXISTS(
     SELECT 1 FROM public.lab_prediction_jobs j
     JOIN public.lab_worker_runs w ON w.id=j.worker_run_id
     WHERE j.id=p_job_id AND j.circuit='LOCAL'
       AND j.race_date=v_prior.race_date AND j.track=v_prior.track
       AND j.race_no=v_prior.race_no
       AND j.job_status='CLAIMED' AND j.claim_token IS NOT NULL
       AND j.lease_until>v_now AND j.attempts<=j.max_attempts
       AND j.claimed_by=w.worker_id AND w.status='RUNNING'
   )
   OR NOT EXISTS(
     SELECT 1 FROM public.official_races r
     WHERE (r.circuit,r.race_date,r.track,r.race_no)=
       (v_prior.circuit,v_prior.race_date,v_prior.track,v_prior.race_no)
       AND r.post_time=v_prior.post_time
       AND r.post_time>v_now+interval '3 minutes'
       AND r.field_status IN ('READY','BASIC_READY')
       AND r.prediction_status IN ('PENDING','RETRY')
   )
   OR EXISTS(SELECT 1 FROM public.official_predictions p
     WHERE p.circuit='LOCAL' AND p.race_date=v_prior.race_date
       AND p.track=v_prior.track AND p.race_no=v_prior.race_no)
 THEN RAISE EXCEPTION 'V17_SHADOW_NOT_A_LIVE_PREFREEZE_SEAL'; END IF;
 v_n:=jsonb_array_length(v_prior.draft_order);
 v_baseline:=(SELECT jsonb_agg(b.value ORDER BY b.ord)
   FROM jsonb_array_elements(v_prior.draft_order)
   WITH ORDINALITY b(value,ord) WHERE b.ord<=5);
 v_status:=p_sidecar->>'status';
 IF v_status NOT IN ('FULL_FIELD_PAIRED_RESEARCH_ONLY','ABSTAINED')
   OR p_sidecar->'market_used' IS DISTINCT FROM 'false'::jsonb
   OR p_sidecar->'target_result_used' IS DISTINCT FROM 'false'::jsonb
   OR p_sidecar->'production_rank_effect' IS DISTINCT FROM 'false'::jsonb
   OR p_sidecar->'production_score_effect' IS DISTINCT FROM 'false'::jsonb
   OR p_sidecar->'frozen_modified' IS DISTINCT FROM 'false'::jsonb
   OR p_sidecar->'eligible_for_official_accuracy_claim' IS DISTINCT FROM 'false'::jsonb
 THEN RAISE EXCEPTION 'V17_SHADOW_NOT_RESEARCH_ONLY'; END IF;
 IF v_status='ABSTAINED' THEN
   v_reason:=p_sidecar->>'reason';
   IF v_reason IS NULL OR v_reason !~ '^[A-Z0-9_]{1,120}$' OR
     p_sidecar ? 'shadow_top5' OR p_sidecar ? 'score_table'
   THEN RAISE EXCEPTION 'V17_ABSTENTION_BAD_PROOF'; END IF;
 ELSE
   IF p_sidecar->>'model'<>'LOCAL_1_7_INDEPENDENT_SHADOW_V0_3'
     OR p_sidecar->>'version'<>'1.7-research-v0.3'
     OR p_sidecar->>'rank_source'<>'INDEPENDENT_SCORE_NO_BASELINE_RANK_INPUT'
     OR p_sidecar->>'verified_history_inputs'<>'ALREADY_VERIFIED_LOCAL_CLAIMED_HISTORY_ONLY'
     OR p_sidecar->'old_top5' IS DISTINCT FROM v_baseline
     OR (p_sidecar->>'all_runners_checked')::int IS DISTINCT FROM v_n
     OR jsonb_typeof(p_sidecar->'score_table')<>'array'
     OR jsonb_array_length(p_sidecar->'score_table')<>v_n
     OR jsonb_typeof(p_sidecar->'shadow_top5')<>'array'
     OR jsonb_array_length(p_sidecar->'shadow_top5')<>5
   THEN RAISE EXCEPTION 'V17_SHADOW_FIELD_UNVERIFIED'; END IF;
   v_scores:=p_sidecar->'score_table';
   IF EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_scores) x
     WHERE jsonb_typeof(x)<>'object'
       OR coalesce(x->>'horse_no','') !~ '^[0-9]{1,2}$'
       OR coalesce(x->>'rank','') !~ '^[0-9]{1,2}$'
       OR coalesce(x->>'research_score_100','') !~ '^[0-9]{1,3}$'
       OR (x->>'horse_no')::int NOT BETWEEN 1 AND 24
       OR (x->>'rank')::int NOT BETWEEN 1 AND v_n
       OR (x->>'research_score_100')::int NOT BETWEEN 0 AND 100
       OR x->>'confidence' NOT IN
         ('HISTORY_AVAILABLE','LIMITED_HISTORY','ABILITY_TEST_ONLY_UNCALIBRATED')
       OR (x ?| array['odds','win_odds','popularity','market','result','payouts'])
       OR NOT EXISTS(
         SELECT 1 FROM jsonb_array_elements(v_prior.field_athletes) f
         WHERE f->>'horse_no'=x->>'horse_no')
   )
     OR (SELECT count(distinct x->>'horse_no') FROM jsonb_array_elements(v_scores) x)<>v_n
     OR (SELECT count(distinct x->>'rank') FROM jsonb_array_elements(v_scores) x)<>v_n
   THEN RAISE EXCEPTION 'V17_SHADOW_SCORES_INVALID'; END IF;
   -- No artificial rank order: all scores must be non-increasing, and
   -- tied ranks 5/6 may not be certified by horse number or evidence count.
   IF EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_scores) x
     JOIN jsonb_array_elements(v_scores) y ON
       (x->>'rank')::int=(y->>'rank')::int-1
     WHERE (x->>'research_score_100')::int <
       (y->>'research_score_100')::int
   ) OR (
     (SELECT (x->>'research_score_100')::int FROM jsonb_array_elements(v_scores) x
       WHERE (x->>'rank')::int=5)
     =
     (SELECT (x->>'research_score_100')::int FROM jsonb_array_elements(v_scores) x
       WHERE (x->>'rank')::int=6)
   ) THEN RAISE EXCEPTION 'V17_SHADOW_SCORE_ORDER_OR_BOUNDARY_TIE'; END IF;
   SELECT jsonb_agg((x->>'horse_no')::int ORDER BY (x->>'rank')::int)
     INTO v_order FROM jsonb_array_elements(v_scores) x;
   SELECT jsonb_agg(x.value ORDER BY x.ord)
     INTO v_top FROM jsonb_array_elements(v_order)
     WITH ORDINALITY x(value,ord) WHERE x.ord<=5;
   IF p_sidecar->'shadow_top5' IS DISTINCT FROM v_top
      OR (p_sidecar->>'changed_full_field_order')::boolean
         IS DISTINCT FROM (v_order<>v_prior.draft_order)
      OR (p_sidecar->>'changed_top5_membership')::boolean
         IS DISTINCT FROM EXISTS(
            SELECT 1 FROM jsonb_array_elements(v_top) x
            WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_baseline) y WHERE x.value=y.value)
         )
   THEN RAISE EXCEPTION 'V17_SHADOW_ORDER_NOT_SCORE_DERIVED'; END IF;
 END IF;
 v_digest:=encode(extensions.digest(convert_to(
   jsonb_build_object('parent_seal',v_prior.capture_sha256,
     'status',v_status,'reason',v_reason,'order',v_order,
     'scores',v_scores,'old_top5',v_baseline,'new_top5',v_top)::text,
     'UTF8'),'sha256'),'hex');
 INSERT INTO private.lab_v17_independent_preflight_v1(
  circuit,race_date,track,race_no,job_id,post_time,
  original_capture_sha256,model,status,abstention_reason,baseline_top5,
  shadow_top5,complete_shadow_order,score_table,capture_sha256
 ) VALUES('LOCAL',v_prior.race_date,v_prior.track,v_prior.race_no,p_job_id,
   v_prior.post_time,v_prior.capture_sha256,
   'LOCAL_1_7_INDEPENDENT_SHADOW_V0_3',v_status,v_reason,
   v_baseline,v_top,v_order,v_scores,v_digest)
 ON CONFLICT(circuit,race_date,track,race_no) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   SELECT capture_sha256 INTO v_saved
   FROM private.lab_v17_independent_preflight_v1
   WHERE circuit='LOCAL' AND race_date=v_prior.race_date
     AND track=v_prior.track AND race_no=v_prior.race_no;
   IF v_saved IS DISTINCT FROM v_digest THEN
     RAISE EXCEPTION 'V17_SHADOW_ALREADY_SEALED_DIFFERENT';
   END IF;
 END IF;
 RETURN jsonb_build_object('status',
   CASE WHEN v_id IS NULL THEN 'ALREADY_SEALED_SAME' ELSE 'SEALED_PRE_RACE' END,
   'capture_sha256',v_digest,'research_only',true,
   'official_rank_changed',false,'frozen_modified',false);
END $v17$;
REVOKE ALL ON FUNCTION private.lab_capture_v17_independent_preflight_v1(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lab_capture_v17_independent_preflight_v1(uuid,jsonb)
  TO service_role;
