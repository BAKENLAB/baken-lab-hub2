\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'ledger_test' OR to_regclass('public.official_predictions') IS NOT NULL
 THEN RAISE EXCEPTION 'isolated database required'; END IF;
END $$;
CREATE SCHEMA private;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE FUNCTION private.jra_time_seconds(text) RETURNS numeric LANGUAGE sql AS 'select $1::numeric';
CREATE FUNCTION private.jra_horse_key(text) RETURNS text LANGUAGE sql AS 'select $1';
CREATE FUNCTION private.jra_flat_past_runs(jsonb) RETURNS jsonb LANGUAGE sql AS 'select $1';
CREATE TABLE public.jra_lab_races(id uuid,race_date date,track text,surface text,distance int,field_size int,class_name text,race_type text,race_name text,source_ref text);
CREATE TABLE public.jra_lab_runs(id uuid,race_id uuid,horse_name text,horse_ref text,record_role text,finish int,time_raw text,weight_carried numeric,jockey text,early_pos numeric,pos_change numeric,source_ref text);
\ir selected-history.candidate.sql
INSERT INTO public.jra_lab_races VALUES ('00000000-0000-0000-0000-000000000001','2026-10-01','fixture','芝',1200,8,'test','平地','fixture','fixture-ref');
INSERT INTO public.jra_lab_runs VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','fixture','2019100606','full_runner',1,'70',54,'fixture',1,0,'fixture-ref');
DO $$ DECLARE r record; BEGIN
 SELECT * INTO STRICT r FROM private.jra_research_selected_history_v1('fixture','2019100606','2026-11-01','[]');
 IF r.selected_run_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000002'::uuid THEN RAISE EXCEPTION 'ID lost'; END IF;
 SELECT * INTO STRICT r FROM private.jra_research_selected_history_v1('fixture','2019100606','2026-11-01','[{"race_date":"2026-10-01"}]');
 IF r.source_kind <> 'LIVE' OR r.selected_run_id IS NOT NULL THEN RAISE EXCEPTION 'archive substituted'; END IF;
END $$;
INSERT INTO public.jra_lab_runs
 SELECT '00000000-0000-0000-0000-000000000003',race_id,horse_name,horse_ref,record_role,
 finish,time_raw,weight_carried,jockey,early_pos,pos_change,source_ref FROM public.jra_lab_runs;
DO $$ DECLARE r record; BEGIN
 SELECT * INTO STRICT r FROM private.jra_research_selected_history_v1('fixture','2019100606','2026-11-01','[]');
 IF r.selected_run_id IS NOT NULL THEN RAISE EXCEPTION 'duplicate provenance promoted'; END IF;
END $$;
CREATE TABLE public.jra_prediction_jobs(id uuid);
CREATE TABLE public.jra_prediction_worker_runs(id uuid);
CREATE TABLE public.official_races(id uuid);
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
\ir claimed-context.candidate.sql
DO $$ BEGIN
 IF has_function_privilege('anon','public.jra_research_claimed_context_v1(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.jra_research_claimed_context_v1(uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.jra_research_claimed_context_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'invalid RPC grants'; END IF;
END $$;
ROLLBACK;
