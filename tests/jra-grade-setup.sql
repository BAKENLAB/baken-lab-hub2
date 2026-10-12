-- ISOLATED FIXTURES ONLY. No production Supabase connectivity.
CREATE TABLE public.jra_prediction_worker_runs (
 id uuid PRIMARY KEY,
 worker_id text NOT NULL,
 status text NOT NULL,
 completed_count integer NOT NULL DEFAULT 0
);
CREATE TABLE public.jra_prediction_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 worker_run_id uuid,
 job_status text NOT NULL,
 lease_until timestamptz,
 claimed_by text,
 claim_token uuid,
 claimed_at timestamptz,
 race_date date NOT NULL,
 track text NOT NULL,
 race_no integer NOT NULL,
 last_error text,
 updated_at timestamptz
);
CREATE TABLE public.official_races (
 race_date date NOT NULL,
 track text NOT NULL,
 race_no integer NOT NULL,
 circuit text NOT NULL,
 post_time timestamptz NOT NULL,
 prediction_status text NOT NULL,
 field_payload jsonb NOT NULL,
 race_name text,
 PRIMARY KEY(race_date, track, race_no, circuit)
);
CREATE TABLE public.lab_prediction_protocols (
 protocol_key text NOT NULL,
 version text NOT NULL,
 is_active boolean NOT NULL
);
CREATE TABLE public.official_predictions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 race_date date NOT NULL,
 track text NOT NULL,
 race_no integer NOT NULL,
 race_name text,
 circuit text NOT NULL,
 post_time timestamptz,
 protocol_version text NOT NULL,
 model_label text,
 source text,
 status text,
 predicted_at timestamptz,
 frozen_at timestamptz,
 payload jsonb NOT NULL,
 UNIQUE(race_date,track,race_no,circuit)
);
CREATE TABLE public.chappy_predictions (
 race_date date,
 track text,
 race_no integer
);
INSERT INTO public.jra_prediction_worker_runs(id,worker_id,status)
VALUES ('11111111-1111-4111-8111-111111111111','JRA_QUEUE_RESCUE','RUNNING');
INSERT INTO public.lab_prediction_protocols(protocol_key,version,is_active)
VALUES ('JRA_MAIN','JRA_TEST_GRADE_GUARD_1',true);
CREATE OR REPLACE FUNCTION public.grade_test_seed(p_race_no integer)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
 INSERT INTO public.official_races(race_date,track,race_no,circuit,post_time,prediction_status,field_payload,race_name)
 VALUES (date '2026-10-17','東京',p_race_no,'JRA',clock_timestamp()+interval '2 hours','PENDING','{"race":{"race_type":"平地"}}'::jsonb,'fixture only');
 INSERT INTO public.jra_prediction_jobs(worker_run_id,job_status,lease_until,claimed_by,claim_token,claimed_at,race_date,track,race_no)
 VALUES ('11111111-1111-4111-8111-111111111111','CLAIMED',clock_timestamp()+interval '15 minutes','JRA_QUEUE_RESCUE',gen_random_uuid(),clock_timestamp(),date '2026-10-17','東京',p_race_no)
 RETURNING id INTO v_id;
 RETURN v_id;
END
$$;
CREATE OR REPLACE FUNCTION public.grade_test_payload()
RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
 'runners', (SELECT jsonb_agg(jsonb_build_object('horse_no',n,'horse_name','Fixture Horse '||n,'rank',n,'grade','B','reason','Confirmed test fixture evidence for horse '||n) ORDER BY n) FROM generate_series(1,6) n),
 'top5', (SELECT jsonb_agg(jsonb_build_object('horse_no',n,'horse_name','Fixture Horse '||n,'rank',n,'grade','B','reason','Confirmed test fixture evidence for horse '||n) ORDER BY n) FROM generate_series(1,5) n),
 'eye',jsonb_build_object('horse_no',6,'horse_name','Fixture Horse 6','rank',6,'grade','B','concrete_upside_reason','Fixture race-specific evidence for horse 6'),
 'bets','[]'::jsonb,
 'summary','isolated test fixture',
 'bet_strategy','SUSPENDED_FOR_ABILITY_STABILITY',
 'audit',jsonb_build_object('all_runners_checked',true,'market_used_for_ranking',false,'protocol_version','JRA_TEST_GRADE_GUARD_1','validated_core','BASE_CORE_0.1')
)
$$;
CREATE OR REPLACE FUNCTION public.grade_test_expect_reject(p_job uuid,p_payload jsonb,p_expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_actual text;
BEGIN
 BEGIN
  PERFORM public.jra_save_claimed_prediction(p_job,'JRA_TEST_GRADE_GUARD_1',p_payload);
  RAISE EXCEPTION 'TEST_UNEXPECTED_ACCEPTANCE';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_actual = MESSAGE_TEXT;
  IF v_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'Expected %, received %',p_expected,v_actual;
  END IF;
 END;
 IF EXISTS (SELECT 1 FROM public.official_predictions WHERE race_date=date '2026-10-17' AND track='東京' AND race_no=(SELECT race_no FROM public.jra_prediction_jobs WHERE id=p_job)) THEN
  RAISE EXCEPTION 'Unexpected persistent FROZEN after rejection %',p_expected;
 END IF;
 IF (SELECT job_status FROM public.jra_prediction_jobs WHERE id=p_job) <> 'CLAIMED' THEN
  RAISE EXCEPTION 'Job changed despite rejection %',p_expected;
 END IF;
 RAISE NOTICE 'PASS: rejection %',p_expected;
END
$$;
