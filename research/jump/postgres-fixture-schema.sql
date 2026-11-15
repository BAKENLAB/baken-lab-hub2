
-- Disposable PostgreSQL 16 fixture only. Never run on production.
CREATE ROLE service_role NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA private;
CREATE TABLE public.jra_live_races(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),race_date date,track text,race_no integer,race_name text,race_type text,surface text,distance integer,class_name text,field_size integer,cname text,post_time text,turn text,course_layout text,course_text text,going text,weather text,UNIQUE(race_date,track,race_no));
CREATE TABLE public.jra_live_runners(live_race_id uuid,horse_no integer,horse_name text,draw integer,jockey text,weight_carried numeric,sex_age text,trainer text,horse_ref text,equipment text,body_weight integer,body_weight_diff integer,PRIMARY KEY(live_race_id,horse_no));
CREATE TABLE public.official_races(race_date date,track text,race_no int,circuit text,race_name text,post_time timestamptz,source text,field_payload jsonb,field_status text DEFAULT 'PENDING',field_fetched_at timestamptz,updated_at timestamptz DEFAULT now(),prediction_status text DEFAULT 'PENDING',prediction_last_error text,PRIMARY KEY(race_date,track,race_no,circuit));
CREATE TABLE public.official_predictions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),race_date date,track text,race_no int,race_name text,circuit text,post_time timestamptz,protocol_version text,model_label text,source text,status text,predicted_at timestamptz,frozen_at timestamptz,payload jsonb,UNIQUE(race_date,track,race_no));
CREATE TABLE public.chappy_predictions(race_date date,track text,race_no int);
CREATE TABLE public.jra_prediction_worker_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),worker_id text,status text,claimed_count int DEFAULT 0,completed_count int DEFAULT 0);
CREATE TABLE public.jra_prediction_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),race_date date,track text,race_no int,job_status text DEFAULT 'QUEUED',attempts int DEFAULT 0,max_attempts int DEFAULT 5,next_attempt_at timestamptz DEFAULT now(),lease_until timestamptz,claimed_by text,claimed_at timestamptz,claim_token uuid,worker_run_id uuid REFERENCES public.jra_prediction_worker_runs(id),updated_at timestamptz DEFAULT now(),last_error text,UNIQUE(race_date,track,race_no),CHECK((job_status='CLAIMED' AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND lease_until>claimed_at AND claim_token IS NOT NULL AND worker_run_id IS NOT NULL) OR (job_status<>'CLAIMED' AND claimed_by IS NULL AND claimed_at IS NULL AND lease_until IS NULL AND claim_token IS NULL AND worker_run_id IS NULL)));
CREATE TABLE public.jra_html_evidence(race_key text,cname text,source_url text,fetched_at timestamptz,html_sha256 text,html_bytes int,extractor_version text,status_basis text,official_status_verified boolean,runner_count int,UNIQUE(race_key,html_sha256));
CREATE TABLE public.lab_prediction_protocols(protocol_key text,version text,is_active bool,PRIMARY KEY(protocol_key,version));
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
CREATE OR REPLACE FUNCTION public.prevent_official_prediction_rewrite()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.payload is distinct from new.payload
     or old.race_date is distinct from new.race_date
     or old.track is distinct from new.track
     or old.race_no is distinct from new.race_no
     or old.predicted_at is distinct from new.predicted_at
     or old.frozen_at is distinct from new.frozen_at then
    raise exception 'official prediction is frozen and cannot be rewritten';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_official_race_from_prediction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.official_races (
    race_date, track, race_no, circuit, race_name, post_time, source,
    prediction_status, updated_at
  )
  values (
    new.race_date, new.track, new.race_no, new.circuit, new.race_name, new.post_time,
    'PREDICTION', 'FROZEN', now()
  )
  on conflict (race_date, track, race_no, circuit) do update
  set race_name = coalesce(excluded.race_name, public.official_races.race_name),
      post_time = coalesce(excluded.post_time, public.official_races.post_time),
      prediction_status = 'FROZEN',
      prediction_last_error = null,
      updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.jra_verified_ready_full_field_guard_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  live_id uuid;
  required_count integer;
  rows_count integer;
  unique_horses integer;
  matched_count integer;
BEGIN
  IF NEW.circuit IS DISTINCT FROM 'JRA'
     OR NEW.source IS DISTINCT FROM 'JRA_OFFICIAL_VERIFIED_GATE_V1'
     OR NEW.field_status IS DISTINCT FROM 'BASIC_READY'
  THEN RETURN NEW; END IF;
  IF NEW.field_payload #>> '{official_status_verification,verified}' IS DISTINCT FROM 'true'
     OR jsonb_typeof(NEW.field_payload->'runners') IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_PROOF_OR_ARRAY_INVALID';
  END IF;
  SELECT id,field_size INTO live_id,required_count FROM public.jra_live_races
    WHERE (race_date,track,race_no)=(NEW.race_date,NEW.track,NEW.race_no);
  IF live_id IS NULL OR required_count NOT BETWEEN 5 AND 24 THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_SOURCE_MISSING';
  END IF;
  SELECT count(*),count(DISTINCT x.value->>'horse_no')
    INTO rows_count,unique_horses
    FROM jsonb_array_elements(NEW.field_payload->'runners') AS x(value);
  IF rows_count<>required_count OR unique_horses<>required_count THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_DUPLICATE_OR_MISSING_HORSE'
      USING DETAIL=NEW.track||NEW.race_no||'R';
  END IF;
  SELECT count(*) INTO matched_count
  FROM jsonb_array_elements(NEW.field_payload->'runners') AS x(value)
  JOIN public.jra_live_runners r
    ON r.live_race_id=live_id AND r.horse_no::text=x.value->>'horse_no'
  WHERE r.horse_name=x.value->>'horse_name'
    AND r.horse_ref=x.value->>'horse_ref'
    AND r.draw::text=x.value->>'draw'
    AND x.value->>'status' IN ('ACTIVE','CANCELLED','EXCLUDED')
    AND (x.value->>'status'<>'ACTIVE'
      OR (r.jockey=x.value->>'jockey'
        AND r.weight_carried IS NOT DISTINCT FROM (x.value->>'weight_carried')::numeric));
  IF matched_count<>required_count THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_RUNNER_DETAIL_MISMATCH'
      USING DETAIL=NEW.track||NEW.race_no||'R';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER trg_jra_verified_ready_full_field_guard_v1 BEFORE INSERT OR UPDATE ON public.official_races FOR EACH ROW EXECUTE FUNCTION private.jra_verified_ready_full_field_guard_v1();
CREATE TRIGGER trg_official_prediction_registry AFTER INSERT ON public.official_predictions FOR EACH ROW EXECUTE FUNCTION public.touch_official_race_from_prediction();
CREATE TRIGGER trg_prevent_official_prediction_rewrite BEFORE UPDATE ON public.official_predictions FOR EACH ROW EXECUTE FUNCTION public.prevent_official_prediction_rewrite();
