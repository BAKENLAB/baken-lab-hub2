-- Completely disposable PostgreSQL 17 fixture. NEVER run on production.
-- psql -X -v ON_ERROR_STOP=1 -f this_file.sql
BEGIN;
CREATE SCHEMA private;
CREATE TABLE public.official_races(
 race_date date NOT NULL,track text NOT NULL,race_no integer NOT NULL,circuit text NOT NULL,
 post_time timestamptz NOT NULL,field_status text NOT NULL,prediction_status text NOT NULL,
 field_payload jsonb NOT NULL,PRIMARY KEY(race_date,track,race_no,circuit)
);
CREATE TABLE public.jra_prediction_worker_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),worker_id text NOT NULL,
 status text NOT NULL,claimed_count int NOT NULL DEFAULT 0
);
CREATE TABLE public.jra_prediction_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),race_date date NOT NULL,
 track text NOT NULL,race_no int NOT NULL,job_status text NOT NULL DEFAULT 'QUEUED',
 attempts int NOT NULL DEFAULT 0,max_attempts int NOT NULL DEFAULT 5,
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 claimed_by text,claimed_at timestamptz,lease_until timestamptz,
 claim_token uuid,worker_run_id uuid,
 UNIQUE(race_date,track,race_no)
);
CREATE TABLE public.jra_live_races(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),race_date date NOT NULL,
 track text NOT NULL,race_no int NOT NULL
);
CREATE TABLE public.jra_live_runners(live_race_id uuid NOT NULL,horse_no int NOT NULL);
CREATE TABLE public.official_predictions(race_date date NOT NULL,track text NOT NULL,race_no int NOT NULL);
CREATE TABLE public.chappy_predictions(race_date date NOT NULL,track text NOT NULL,race_no int NOT NULL);
CREATE OR REPLACE FUNCTION private.jra_win5_fifth_early_allowed_v1(
 p_date date,p_track text,p_no int,p_post timestamptz,p_now timestamptz
) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$SELECT false$$;
\i research/jra-scoring-integrity-20261121/claim-next-clock/claim-next-clock-refreshed.candidate.sql
-- One current genuinely eligible race, several intentionally ineligible.
INSERT INTO public.official_races
(race_date,track,race_no,circuit,post_time,field_status,prediction_status,field_payload)
VALUES
((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,'福島',1,'JRA',clock_timestamp()+interval '32 minutes','BASIC_READY','PENDING','{"race":{"race_type":"平地"}}'),
((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,'福島',2,'JRA',clock_timestamp()+interval '2 minutes','BASIC_READY','PENDING','{"race":{"race_type":"平地"}}'),
((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,'福島',3,'JRA',clock_timestamp()+interval '45 minutes','BASIC_READY','PENDING','{"race":{"race_type":"障害"}}'),
((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,'福島',4,'JRA',clock_timestamp()+interval '37 minutes','BASIC_READY','PENDING','{"race":{"race_type":"平地"}}'),
((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,'東京',5,'JRA',clock_timestamp()+interval '34 minutes','BASIC_READY','PENDING','{"race":{"race_type":"平地"}}'),
((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,'東京',6,'JRA',clock_timestamp()+interval '75 minutes','BASIC_READY','PENDING','{"race":{"race_type":"平地"}}');
-- The eligible race plus a prediction-excluded, and a horse-list absent race.
INSERT INTO public.jra_live_races(race_date,track,race_no)
SELECT race_date,track,race_no FROM public.official_races WHERE track='福島' AND race_no=1;
INSERT INTO public.jra_live_races(race_date,track,race_no)
SELECT race_date,track,race_no FROM public.official_races WHERE track='福島' AND race_no=4;
INSERT INTO public.jra_live_runners(live_race_id,horse_no)
SELECT id,1 FROM public.jra_live_races;
INSERT INTO public.chappy_predictions(race_date,track,race_no)
SELECT race_date,track,race_no FROM public.official_races WHERE track='福島' AND race_no=4;
-- First valid CALL must claim immediately. The unpatched function inserts a
-- QUEUED job but its stale v_now rejects it on the SAME first call.
DO $check$
DECLARE result jsonb;
BEGIN
 result := public.jra_manual_claim_next_v1();
 IF result->>'claimed'<>'true' OR result->>'resumed'<>'false'
   OR result->>'track'<>'福島' OR result->>'race_no'<>'1' THEN
   RAISE EXCEPTION 'first-call claim unexpectedly refused: %',result;
 END IF;
 IF (SELECT count(*) FROM public.jra_prediction_jobs)!=1 THEN
   RAISE EXCEPTION 'ineligible race was queued';
 END IF;
 IF (SELECT count(*) FROM public.jra_prediction_jobs
      WHERE job_status='CLAIMED' AND claimed_by='JRA_QUEUE_RESCUE'
        AND lease_until>clock_timestamp())!=1 THEN
   RAISE EXCEPTION 'verified lease was not issued';
 END IF;
END $check$;
-- A second attempt resumes the same valid lease and never creates duplicates.
DO $check$
DECLARE result jsonb;
BEGIN
 result := public.jra_manual_claim_next_v1();
 IF result->>'claimed'<>'true' OR result->>'resumed'<>'true'
   OR result->>'track'<>'福島' OR result->>'race_no'<>'1' THEN
   RAISE EXCEPTION 'existing protected lease did not resume: %',result;
 END IF;
 IF (SELECT count(*) FROM public.jra_prediction_jobs)!=1 THEN
   RAISE EXCEPTION 'duplicate/invalid job created during lease resume';
 END IF;
END $check$;
ROLLBACK;
