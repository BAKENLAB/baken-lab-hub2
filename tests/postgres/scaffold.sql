-- TEST-ONLY, empty local database. No production application.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
-- Reproduce production default grants before candidate table creation.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
CREATE TABLE public.lab_worker_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),worker_id text NOT NULL,region text NOT NULL,
 started_at timestamptz DEFAULT clock_timestamp(),finished_at timestamptz,status text DEFAULT 'RUNNING',
 claimed_count integer DEFAULT 0,completed_count integer DEFAULT 0,retry_count integer DEFAULT 0,failed_count integer DEFAULT 0,last_error text);
CREATE TABLE public.lab_prediction_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),race_date date,track text,race_no integer,circuit text DEFAULT 'LOCAL' CHECK(circuit='LOCAL'),region text,
 job_status text DEFAULT 'QUEUED',attempts integer DEFAULT 0,max_attempts integer DEFAULT 5,last_error text,
 claimed_by text,claimed_at timestamptz,lease_until timestamptz,claim_token uuid,worker_run_id uuid REFERENCES public.lab_worker_runs(id),
 next_attempt_at timestamptz DEFAULT clock_timestamp(),created_at timestamptz DEFAULT clock_timestamp(),updated_at timestamptz DEFAULT clock_timestamp(),UNIQUE(race_date,track,race_no,circuit));
CREATE TABLE public.official_races(race_date date,track text,race_no integer,circuit text,race_name text,post_time timestamptz,prediction_status text,field_payload jsonb,UNIQUE(race_date,track,race_no));
CREATE TABLE public.lab_prediction_protocols(protocol_key text,version text,is_active boolean,content jsonb);
CREATE TABLE public.official_predictions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),race_date date,track text,race_no integer,race_name text,circuit text,post_time timestamptz,protocol_version text,model_label text,source text,status text,predicted_at timestamptz,frozen_at timestamptz,payload jsonb,UNIQUE(race_date,track,race_no));
CREATE TABLE public.chappy_predictions(race_date date,track text,race_no integer);
CREATE FUNCTION public.fixture_freeze() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 UPDATE public.official_races SET prediction_status='FROZEN' WHERE (race_date,track,race_no,circuit)=(NEW.race_date,NEW.track,NEW.race_no,NEW.circuit);RETURN NEW;
END $$;
CREATE TRIGGER fixture_freeze AFTER INSERT ON public.official_predictions FOR EACH ROW EXECUTE FUNCTION public.fixture_freeze();
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.lab_worker_runs,public.lab_prediction_jobs,public.official_races,public.official_predictions TO service_role;
GRANT SELECT ON public.lab_prediction_protocols,public.chappy_predictions TO service_role;
-- Test role mirrors Supabase BYPASSRLS. Supabase gateway/OAuth are not reproduced.
