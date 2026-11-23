\set ON_ERROR_STOP on
-- EPHEMERAL GITHUB ACTIONS DATABASE ONLY. Never run on production.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'ledger_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
 IF to_regclass('public.official_predictions') IS NOT NULL THEN RAISE EXCEPTION 'NONEMPTY_DATABASE_REFUSED'; END IF;
END $$;
CREATE TABLE public.jra_prediction_jobs(id uuid PRIMARY KEY,job_status text,lease_until timestamptz,worker_run_id uuid,claimed_by text,race_date date,track text,race_no int,claim_token uuid,claimed_at timestamptz,last_error text,updated_at timestamptz);
CREATE TABLE public.jra_prediction_worker_runs(id uuid PRIMARY KEY,status text,worker_id text,completed_count int DEFAULT 0);
CREATE TABLE public.official_races(race_date date,track text,race_no int,circuit text,post_time timestamptz,prediction_status text,field_payload jsonb,race_name text);
CREATE TABLE public.lab_prediction_protocols(protocol_key text,is_active boolean,version text);
CREATE TABLE public.official_predictions(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,race_date date,track text,race_no int,race_name text,circuit text,post_time timestamptz,protocol_version text,model_label text,source text,status text,predicted_at timestamptz,frozen_at timestamptz,payload jsonb);
CREATE TABLE public.chappy_predictions(race_date date,track text,race_no int);
-- Exact archived production function definitions; all dependencies above are synthetic fixtures.
\ir ../research/jra-scoring-integrity-20261121/baseline/db/jra_save_claimed_prediction.sql.txt
;
\ir ../research/jra-scoring-integrity-20261121/baseline/db/jra_save_claimed_prediction_with_shadow_v1.sql.txt
;
CREATE FUNCTION pg_temp.assert_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION_FAILED: %',label; END IF; RAISE NOTICE 'PASS %',label; END $$;
CREATE FUNCTION pg_temp.payload() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('runners',r,'top5',r,'eye',NULL,'bets','[]'::jsonb,'summary','SYNTHETIC_ONLY','bet_strategy','SUSPENDED_FOR_ABILITY_STABILITY','audit',jsonb_build_object('market_used_for_ranking',false,'all_runners_checked',true,'protocol_version','SYNTHETIC_PROTOCOL','validated_core','BASE_CORE_0.1'))
 FROM (SELECT jsonb_agg(jsonb_build_object('horse_no',i,'horse_name','fixture_'||i,'rank',i,'grade','B','reason','synthetic explicit reason')) r FROM generate_series(1,5) i) x;
$$;
CREATE FUNCTION pg_temp.seed(n int) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE jid uuid:=gen_random_uuid();wid uuid:=gen_random_uuid();BEGIN
 INSERT INTO public.jra_prediction_worker_runs VALUES(wid,'RUNNING','JRA_QUEUE_RESCUE',0);
 INSERT INTO public.jra_prediction_jobs VALUES(jid,'CLAIMED',clock_timestamp()+interval '15 minutes',wid,'JRA_QUEUE_RESCUE',current_date,'ISOLATED',n,gen_random_uuid(),clock_timestamp(),NULL,clock_timestamp());
 INSERT INTO public.official_races VALUES(current_date,'ISOLATED',n,'JRA',clock_timestamp()+interval '30 minutes','PENDING','{"race":{"race_type":"平地"}}','synthetic'); RETURN jid;END $$;
INSERT INTO public.lab_prediction_protocols VALUES('JRA_MAIN',true,'SYNTHETIC_PROTOCOL');
DO $$ DECLARE jid uuid;r jsonb;p jsonb;pid uuid;expected text;rejected bool;n int:=10;BEGIN
 jid:=pg_temp.seed(1);p:=pg_temp.payload();
 r:=public.jra_save_claimed_prediction_with_shadow_v1(jid,'SYNTHETIC_PROTOCOL',p,NULL,NULL);pid:=(r->>'prediction_id')::uuid;
 PERFORM pg_temp.assert_true(r->'ok'='true'::jsonb AND r->>'shadow_status'='NOT_PROVIDED','actual wrapper receipt');
 PERFORM pg_temp.assert_true(EXISTS(SELECT 1 FROM public.official_predictions WHERE id=pid AND status='FROZEN' AND payload=p),'exact FROZEN payload');
 PERFORM pg_temp.assert_true(EXISTS(SELECT 1 FROM public.jra_prediction_jobs WHERE id=jid AND job_status='DONE' AND claim_token IS NULL AND lease_until IS NULL),'DONE and lease cleared');
 PERFORM pg_temp.assert_true((SELECT sum(completed_count)=1 FROM public.jra_prediction_worker_runs),'completed count once');
 rejected:=false;BEGIN PERFORM public.jra_save_claimed_prediction(jid,'SYNTHETIC_PROTOCOL',p);EXCEPTION WHEN OTHERS THEN rejected:=SQLERRM='JRA_SAVE_STALE_CLAIM';END;
 PERFORM pg_temp.assert_true(rejected AND (SELECT count(*)=1 FROM public.official_predictions),'repeat refuses, FROZEN unchanged');
 FOREACH expected IN ARRAY ARRAY['JRA_SAVE_GRADE_INVALID','JRA_SAVE_RUNNER_DISAGREEMENT','JRA_SAVE_GRADE_REASON_MISSING','JRA_SAVE_STALE_CLAIM','JRA_SAVE_RACE_INVALID','JRA_SAVE_PROTOCOL_MISMATCH','JRA_SAVE_RUN_INVALID','JRA_SAVE_ALREADY_EXISTS'] LOOP
  n:=n+1;jid:=pg_temp.seed(n);p:=pg_temp.payload();
  CASE expected
   WHEN 'JRA_SAVE_GRADE_INVALID' THEN p:=p#-'{runners,0,grade}';
   WHEN 'JRA_SAVE_RUNNER_DISAGREEMENT' THEN p:=jsonb_set(p,'{top5,0,grade}','"A"');
   WHEN 'JRA_SAVE_GRADE_REASON_MISSING' THEN p:=p#-'{runners,0,reason}';
   WHEN 'JRA_SAVE_STALE_CLAIM' THEN UPDATE public.jra_prediction_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=jid;
   WHEN 'JRA_SAVE_RACE_INVALID' THEN UPDATE public.official_races SET post_time=clock_timestamp()+interval '2 minutes' WHERE race_no=n;
   WHEN 'JRA_SAVE_PROTOCOL_MISMATCH' THEN NULL;
   WHEN 'JRA_SAVE_RUN_INVALID' THEN UPDATE public.jra_prediction_worker_runs SET status='FAILED' WHERE id=(SELECT worker_run_id FROM public.jra_prediction_jobs WHERE id=jid);
   WHEN 'JRA_SAVE_ALREADY_EXISTS' THEN INSERT INTO public.chappy_predictions VALUES(current_date,'ISOLATED',n);
  END CASE;
  rejected:=false;
  BEGIN PERFORM public.jra_save_claimed_prediction_with_shadow_v1(jid,CASE WHEN expected='JRA_SAVE_PROTOCOL_MISMATCH' THEN 'WRONG' ELSE 'SYNTHETIC_PROTOCOL' END,p);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>expected THEN RAISE EXCEPTION 'EXPECTED %, ACTUAL %',expected,SQLERRM;END IF;rejected:=true;END;
  PERFORM pg_temp.assert_true(rejected AND NOT EXISTS(SELECT 1 FROM public.official_predictions WHERE race_no=n),'reject '||expected||' without FROZEN');
  PERFORM pg_temp.assert_true(EXISTS(SELECT 1 FROM public.jra_prediction_jobs WHERE id=jid AND job_status='CLAIMED'),'rejection does not invent RETRY/DONE');
 END LOOP;
 jid:=pg_temp.seed(99);
 r:=public.jra_save_claimed_prediction_with_shadow_v1(jid,'SYNTHETIC_PROTOCOL',pg_temp.payload(),'{}','{}');
 PERFORM pg_temp.assert_true(r->>'shadow_status'='OPTIONAL_CAPTURE_SKIPPED' AND r->'ok'='true'::jsonb,'unconnected optional shadow fail-open; actual save succeeds');
END $$;
ROLLBACK;
DO $$ BEGIN
 IF to_regclass('public.official_predictions') IS NOT NULL OR to_regprocedure('public.jra_save_claimed_prediction(uuid,text,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_INCOMPLETE';END IF;
 RAISE NOTICE 'PASS rollback removes fixture tables and actual function definitions';
END $$;
