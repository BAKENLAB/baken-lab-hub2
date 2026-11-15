-- DEVELOPMENT ONLY. Not a migration. Do not execute/deploy until isolated PostgreSQL tests, server-owned verified context builder, authenticated MCP routing, protocol approval and HUB compatibility are complete.
-- Existing functions, frozen predictions, triggers, Cron and protocol rows are not modified.
BEGIN;
CREATE OR REPLACE FUNCTION public.jra_jump_publish_verified_card_v1(p_proof jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_date date;
  v_track text;
  v_no integer;
  v_cname text;
  v_hash text;
  v_checked timestamptz;
  v_post timestamptz;
  v_live public.jra_live_races;
  v_existing public.official_races;
  v_runners jsonb;
  v_item jsonb;
  v_runner record;
  v_count integer := 0;
  v_active integer := 0;
  v_written integer := 0;
  v_payload jsonb;
  v_key text;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JUMP_SERVICE_ROLE_REQUIRED'; END IF;
  IF jsonb_typeof(p_proof) <> 'object' THEN RAISE EXCEPTION 'JRA_VERIFIED_PROOF_REQUIRED'; END IF;
  v_date := (p_proof->>'race_date')::date;
  v_track := p_proof->>'track';
  v_no := (p_proof->>'race_no')::integer;
  v_cname := p_proof->>'cname';
  v_hash := p_proof->>'html_sha256';
  v_checked := (p_proof->>'checked_at')::timestamptz;
  v_post := (p_proof->>'post_time')::timestamptz;
  v_runners := p_proof->'runners';
  IF v_date < (v_now AT TIME ZONE 'Asia/Tokyo')::date
     OR v_date > (v_now AT TIME ZONE 'Asia/Tokyo')::date + 4
     OR v_track NOT IN ('東京','京都','新潟','中山','阪神','中京','小倉','福島','札幌','函館')
     OR v_no NOT BETWEEN 1 AND 12
     OR v_hash !~ '^[0-9a-f]{64}$'
     OR v_checked NOT BETWEEN v_now-interval '120 seconds' AND v_now+interval '15 seconds'
     OR v_post <= v_now + interval '3 minutes'
     OR jsonb_typeof(v_runners) <> 'array'
     OR jsonb_array_length(v_runners) NOT BETWEEN 5 AND 24
     OR p_proof->>'verification_basis' IS DISTINCT FROM 'JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1'
     OR p_proof->>'all_rows_reviewed' IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'JRA_VERIFIED_PROOF_INVALID'; END IF;
  SELECT * INTO v_live FROM public.jra_live_races
   WHERE (race_date,track,race_no)=(v_date,v_track,v_no)
     AND cname=v_cname FOR UPDATE;
  IF NOT FOUND OR v_live.race_type IS DISTINCT FROM '障害' OR v_live.field_size<>jsonb_array_length(v_runners)
    OR (v_live.surface IS DISTINCT FROM '障害' OR p_proof->'race'->>'race_type' IS DISTINCT FROM '障害')
    OR v_live.distance IS NULL OR v_live.post_time IS NULL
  THEN RAISE EXCEPTION 'JRA_LIVE_CAPTURE_UNAVAILABLE_OR_MISMATCH'; END IF;
  IF (CASE WHEN v_live.post_time ~ '^[0-9]{1,2}時[0-9]{2}分$' THEN (v_date::text||'T'||lpad(split_part(v_live.post_time,'時',1),2,'0')||':'||replace(split_part(v_live.post_time,'時',2),'分','')||':00+09:00')::timestamptz ELSE NULL END) IS DISTINCT FROM v_post
     OR v_live.surface IS DISTINCT FROM p_proof->'race'->>'surface'
     OR v_live.distance IS DISTINCT FROM (p_proof->'race'->>'distance')::integer
     OR btrim(coalesce(v_live.race_name,'')) IS DISTINCT FROM btrim(coalesce(p_proof->>'race_name',''))
  THEN RAISE EXCEPTION 'JRA_OFFICIAL_RACE_MISMATCH'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.jra_prediction_jobs j
    WHERE (j.race_date,j.track,j.race_no)=(v_date,v_track,v_no)
      AND j.job_status='CLAIMED'
      AND j.lease_until>v_now
  ) THEN RAISE EXCEPTION 'JRA_ACTIVE_CLAIM_NO_FIELD_REFRESH'; END IF;
  SELECT * INTO v_existing FROM public.official_races
    WHERE (race_date,track,race_no,circuit)=(v_date,v_track,v_no,'JRA')
    FOR UPDATE;
  IF FOUND AND (v_existing.prediction_status='FROZEN' OR v_existing.post_time<=v_now+interval '3 minutes')
  THEN RAISE EXCEPTION 'JRA_ALREADY_FROZEN_OR_CLOSED'; END IF;
  IF EXISTS(SELECT 1 FROM public.official_predictions
    WHERE (race_date,track,race_no,circuit)=(v_date,v_track,v_no,'JRA'))
    OR EXISTS(SELECT 1 FROM public.chappy_predictions
      WHERE (race_date,track,race_no)=(v_date,v_track,v_no))
  THEN RAISE EXCEPTION 'JRA_PREDICTION_ALREADY_EXISTS'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_runners) entry
    GROUP BY entry->>'horse_no' HAVING count(*)<>1
  ) THEN RAISE EXCEPTION 'JRA_VERIFIED_DUPLICATE_HORSE_NO'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_runners) LOOP
    IF jsonb_typeof(v_item)<>'object' OR (v_item->>'horse_no')::integer NOT BETWEEN 1 AND 24
      OR v_item->>'status' NOT IN ('ACTIVE','CANCELLED','EXCLUDED')
      OR nullif(btrim(v_item->>'horse_name'),'') IS NULL
    THEN RAISE EXCEPTION 'JRA_VERIFIED_HORSE_INVALID'; END IF;
    SELECT horse_no,horse_name,draw,jockey,weight_carried INTO v_runner
      FROM public.jra_live_runners
      WHERE live_race_id=v_live.id AND horse_no=(v_item->>'horse_no')::integer;
    IF NOT FOUND OR btrim(v_runner.horse_name) IS DISTINCT FROM btrim(v_item->>'horse_name')
      OR v_runner.draw IS NULL OR v_runner.draw IS DISTINCT FROM (v_item->>'draw')::integer
    THEN RAISE EXCEPTION 'JRA_VERIFIED_HORSE_IDENTITY_MISMATCH'; END IF;
    IF v_item->>'status'='ACTIVE' AND (
       nullif(btrim(v_item->>'jockey'),'') IS NULL
       OR (v_item->>'weight_carried')::numeric NOT BETWEEN 45 AND 70
       OR nullif(btrim(v_runner.jockey),'') IS NULL
       OR v_runner.weight_carried IS NULL
       OR btrim(v_runner.jockey) IS DISTINCT FROM btrim(v_item->>'jockey')
       OR v_runner.weight_carried IS DISTINCT FROM (v_item->>'weight_carried')::numeric
    ) THEN RAISE EXCEPTION 'JRA_VERIFIED_ACTIVE_DETAILS_MISMATCH'; END IF;
    v_count := v_count+1;
    IF v_item->>'status'='ACTIVE' THEN v_active:=v_active+1; END IF;
  END LOOP;
  IF v_count<>v_live.field_size OR v_active<5
     OR v_count<>(SELECT count(*) FROM public.jra_live_runners WHERE live_race_id=v_live.id)
  THEN RAISE EXCEPTION 'JRA_VERIFIED_FIELD_INCOMPLETE'; END IF;
  v_key := replace(v_date::text,'-','')||'_'||v_track||'_'||v_no||'R';
  SELECT jsonb_agg(
    jsonb_build_object('horse_no',r.horse_no,'horse_name',r.horse_name,
      'draw',r.draw,'status',proof_item.value->>'status',
      'sex_age',r.sex_age,'jockey',r.jockey,'weight_carried',r.weight_carried,
      'trainer',r.trainer,'horse_ref',r.horse_ref,'equipment',r.equipment,
      'body_weight',r.body_weight,'body_weight_diff',r.body_weight_diff)
    ORDER BY r.horse_no)
  INTO v_runners
  FROM public.jra_live_runners r
  JOIN LATERAL jsonb_array_elements(p_proof->'runners') AS proof_item(value)
    ON (proof_item.value->>'horse_no')::integer=r.horse_no
  WHERE r.live_race_id=v_live.id;
  v_payload := jsonb_build_object(
    'race',jsonb_build_object(
      'race_type','障害','surface',v_live.surface,'distance',v_live.distance,
      'turn',v_live.turn,'course_layout',v_live.course_layout,
      'course_text',v_live.course_text,'class_name',v_live.class_name,
      'field_size',v_live.field_size,'going',v_live.going,'weather',v_live.weather,
      'cname',v_cname),
    'runners',v_runners,'official_schedule_checked',true,
    'source_checked_at',v_checked,
    'official_status_verification',jsonb_build_object(
      'verified',true,'basis','JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1',
      'html_sha256',v_hash,'verified_at',v_checked,
      'active_count',v_active,'runner_count',v_count));
  INSERT INTO public.official_races(
    race_date,track,race_no,circuit,race_name,post_time,source,field_payload,
    field_status,field_fetched_at,updated_at)
  VALUES(v_date,v_track,v_no,'JRA',v_live.race_name,v_post,
     'JRA_OFFICIAL_VERIFIED_GATE_V1',v_payload,'BASIC_READY',v_checked,v_now)
  ON CONFLICT (race_date,track,race_no,circuit)
  DO UPDATE SET
    race_name=excluded.race_name, post_time=excluded.post_time,
    source=excluded.source,field_payload=excluded.field_payload,
    field_status=excluded.field_status,field_fetched_at=excluded.field_fetched_at,
    updated_at=excluded.updated_at
  WHERE public.official_races.prediction_status NOT IN ('FROZEN','DONE')
    AND public.official_races.post_time>v_now+interval '3 minutes';
  GET DIAGNOSTICS v_written = ROW_COUNT;
  IF v_written<>1 THEN RAISE EXCEPTION 'JRA_VERIFIED_UPSERT_NOT_APPLIED'; END IF;
  INSERT INTO public.jra_html_evidence(
    race_key,cname,source_url,fetched_at,html_sha256,html_bytes,
    extractor_version,status_basis,official_status_verified,runner_count)
  VALUES (v_key,v_cname,
    'https://www.jra.go.jp/JRADB/accessD.html?CNAME='||v_cname,
    v_checked,v_hash,coalesce((p_proof->>'html_bytes')::integer,0),
    'jra-verified-gate-v1','VERIFIED_CURRENT_ENTRY',
    true,v_count)
  ON CONFLICT(race_key,html_sha256)
  DO UPDATE SET status_basis=excluded.status_basis,
    official_status_verified=true,runner_count=excluded.runner_count;
  RETURN jsonb_build_object('ok',true,'track',v_track,'race_no',v_no,
      'race_date',v_date,'status','BASIC_READY','runner_count',v_count,
      'active_count',v_active,'checked_at',v_checked);
END
$function$;

CREATE OR REPLACE FUNCTION public.jra_jump_manual_claim_next_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_date date := (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date;
  v_job public.jra_prediction_jobs;
  v_run_id uuid;
  v_queued integer := 0;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JUMP_SERVICE_ROLE_REQUIRED'; END IF;
  -- Serialize only the interactive "next" action; never touch Cron.
  PERFORM pg_catalog.pg_advisory_xact_lock(20261017, 12701);
  v_now := clock_timestamp();

  -- The current active claim is resumed rather than claiming a second race.
  SELECT j.* INTO v_job
    FROM public.jra_prediction_jobs j
    JOIN public.jra_prediction_worker_runs w ON w.id=j.worker_run_id
    JOIN public.official_races r
      ON (r.race_date,r.track,r.race_no,r.circuit)=(j.race_date,j.track,j.race_no,'JRA')
   WHERE j.race_date=v_date
     AND j.job_status='CLAIMED'
     AND j.claimed_by='JRA_JUMP_QUEUE'
     AND j.lease_until>v_now
     AND w.status='RUNNING' AND w.worker_id='JRA_JUMP_QUEUE'
     AND r.field_payload->'race'->>'race_type'='障害'
     AND r.field_payload->'race'->>'surface'='障害'
     AND r.field_status IN ('BASIC_READY','READY')
     AND r.field_payload #>> '{official_status_verification,verified}'='true'
     AND r.post_time>v_now+interval '3 minutes'
     AND r.prediction_status IN ('PENDING','RETRY')
     AND r.field_payload #>> '{official_status_verification,verified}'='true'
     AND NOT EXISTS (
       SELECT 1 FROM public.official_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
   ORDER BY r.post_time,j.track,j.race_no LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('claimed',true,'resumed',true,
      'job_id',v_job.id,'track',v_job.track,'race_no',v_job.race_no,
      'lease_until',v_job.lease_until,'queued',0);
  END IF;

  -- Create only READY, future, verified obstacle-race jobs in the existing JRA job table.
  INSERT INTO public.jra_prediction_jobs(race_date,track,race_no)
  SELECT r.race_date,r.track,r.race_no
    FROM public.official_races r
   WHERE r.race_date=v_date AND r.circuit='JRA'
     AND r.field_status IN ('BASIC_READY','READY')
     AND r.prediction_status IN ('PENDING','RETRY')
     AND r.field_payload #>> '{official_status_verification,verified}'='true'
     AND r.post_time BETWEEN v_now+interval '3 minutes' AND v_now+interval '70 minutes'
     AND r.field_payload->'race'->>'race_type' = '障害' AND r.field_payload->'race'->>'surface' = '障害'
     AND EXISTS (
       SELECT 1 FROM public.jra_live_races lr
       JOIN public.jra_live_runners hr ON hr.live_race_id=lr.id
       WHERE (lr.race_date,lr.track,lr.race_no)=(r.race_date,r.track,r.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.official_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(r.race_date,r.track,r.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.chappy_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(r.race_date,r.track,r.race_no))
   ON CONFLICT (race_date,track,race_no) DO NOTHING;
  GET DIAGNOSTICS v_queued=ROW_COUNT;

  SELECT j.* INTO v_job
    FROM public.jra_prediction_jobs j
    JOIN public.official_races r
      ON (r.race_date,r.track,r.race_no,r.circuit)=(j.race_date,j.track,j.race_no,'JRA')
   WHERE j.race_date=v_date
     AND r.field_status IN ('BASIC_READY','READY')
     AND r.prediction_status IN ('PENDING','RETRY')
     AND r.field_payload #>> '{official_status_verification,verified}'='true'
     AND r.post_time BETWEEN v_now+interval '3 minutes' AND v_now+interval '70 minutes'
     AND r.field_payload->'race'->>'race_type' = '障害' AND r.field_payload->'race'->>'surface' = '障害'
     AND j.next_attempt_at<=v_now AND j.attempts<j.max_attempts
     AND (j.job_status IN ('QUEUED','RETRY')
       OR (j.job_status='CLAIMED' AND j.lease_until<=v_now))
     AND EXISTS (
       SELECT 1 FROM public.jra_live_races lr
       JOIN public.jra_live_runners hr ON hr.live_race_id=lr.id
       WHERE (lr.race_date,lr.track,lr.race_no)=(j.race_date,j.track,j.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.official_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.chappy_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
   ORDER BY r.post_time,j.track,j.race_no
   LIMIT 1 FOR UPDATE OF j SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed',false,
      'reason','NO_READY_UNSAVED_JUMP_RACE_IN_3_TO_70_MIN_WINDOW',
      'race_date',v_date,'queued',v_queued);
  END IF;

  INSERT INTO public.jra_prediction_worker_runs(worker_id,status)
  VALUES ('JRA_JUMP_QUEUE','RUNNING')
  RETURNING id INTO v_run_id;

  UPDATE public.jra_prediction_jobs
     SET job_status='CLAIMED',attempts=attempts+1,
         claimed_by='JRA_JUMP_QUEUE',claimed_at=v_now,
         lease_until=v_now+interval '15 minutes',
         claim_token=gen_random_uuid(),worker_run_id=v_run_id,updated_at=v_now
   WHERE id=v_job.id
   RETURNING * INTO v_job;

  UPDATE public.jra_prediction_worker_runs
     SET claimed_count=claimed_count+1
   WHERE id=v_run_id;

  RETURN jsonb_build_object('claimed',true,'resumed',false,
    'job_id',v_job.id,'track',v_job.track,'race_no',v_job.race_no,
    'lease_until',v_job.lease_until,'queued',v_queued);
END
$function$;

CREATE OR REPLACE FUNCTION public.jra_jump_save_claimed_prediction_v1(p_job_id uuid, p_protocol_version text, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare j public.jra_prediction_jobs; w public.jra_prediction_worker_runs; r public.official_races; v_protocol text; v_id uuid; v_now timestamptz:=clock_timestamp(); v_count integer; v_item jsonb; v_match jsonb;
begin
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'JUMP_SERVICE_ROLE_REQUIRED'; END IF;
  select * into j from public.jra_prediction_jobs where id=p_job_id for update;
  if not found or j.job_status<>'CLAIMED' or j.lease_until<=v_now then raise exception 'JRA_SAVE_STALE_CLAIM'; end if;
  select * into w from public.jra_prediction_worker_runs where id=j.worker_run_id for update;
  if not found or w.status<>'RUNNING' or w.worker_id<>'JRA_JUMP_QUEUE' or j.claimed_by<>w.worker_id then raise exception 'JRA_SAVE_RUN_INVALID'; end if;
  select * into r from public.official_races where (race_date,track,race_no,circuit)=(j.race_date,j.track,j.race_no,'JRA') for update;
  if not found or r.post_time<=v_now+interval '3 minutes' or r.prediction_status not in ('PENDING','RETRY') then raise exception 'JRA_SAVE_RACE_INVALID'; end if;
  if r.field_payload->'race'->>'race_type' is distinct from '障害' or r.field_payload->'race'->>'surface' is distinct from '障害' or r.field_status not in ('READY','BASIC_READY') or r.field_payload #>> '{official_status_verification,verified}' is distinct from 'true' then raise exception 'JUMP_RACE_PROOF_INVALID'; end if;
  lock table public.lab_prediction_protocols in share mode;
  begin select version into strict v_protocol from public.lab_prediction_protocols where protocol_key='JRA_JUMP' and is_active=true;
  exception when no_data_found or too_many_rows then raise exception 'JRA_PROTOCOL_NOT_UNIQUE'; end;
  if v_protocol is distinct from 'JRA_JUMP_0.1_K2_20261115' or p_protocol_version is distinct from v_protocol then raise exception 'JRA_SAVE_PROTOCOL_MISMATCH'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
    or not (p_payload ?& array['runners','top5','eye','bets','summary','bet_strategy','audit'])
    or (select count(*) from jsonb_object_keys(p_payload))<>7 then raise exception 'JRA_SAVE_PAYLOAD_KEYS'; end if;
  if jsonb_typeof(p_payload->'runners') is distinct from 'array' or jsonb_array_length(p_payload->'runners')=0
    or jsonb_typeof(p_payload->'top5') is distinct from 'array' or jsonb_array_length(p_payload->'top5')=0
    or jsonb_typeof(p_payload->'audit') is distinct from 'object' then raise exception 'JRA_SAVE_PAYLOAD_SHAPE'; end if;
  if p_payload->'bets' is distinct from '[]'::jsonb or p_payload->>'bet_strategy'<>'SUSPENDED_FOR_ABILITY_STABILITY' then raise exception 'JRA_SAVE_MARKET_SEPARATION'; end if;
  if p_payload->'audit'->'market_used_for_ranking' is distinct from 'false'::jsonb
    or p_payload->'audit'->'all_runners_checked' is distinct from 'true'::jsonb
    or p_payload->'audit'->>'protocol_version' is distinct from v_protocol
    or p_payload->'audit'->>'validated_core' is distinct from 'JUMP_K2_RESEARCH_0.1' then raise exception 'JRA_SAVE_AUDIT_REQUIRED'; end if;

  -- JUMP-only server adapter must recompute the payload from verified context.
  if p_payload->'audit'->>'job_id' is distinct from j.id::text
    or p_payload->'audit'->>'race_key' is distinct from (replace(r.race_date::text,'-','')||'_'||r.track||'_'||r.race_no||'R')
    or p_payload->'audit'->'official_full_field_verified' is distinct from 'true'::jsonb
    or p_payload->'audit'->'market_used_for_eye' is distinct from 'false'::jsonb
    or p_payload->'audit'->'target_result_used' is distinct from 'false'::jsonb
    or p_payload->'audit'->'rank6_auto_selected' is distinct from 'false'::jsonb
    or p_payload->'audit'->'outside_top5_reaudited' is distinct from 'true'::jsonb
    or p_payload->'audit'->'official_evidence'->>'html_sha256' is distinct from r.field_payload #>> '{official_status_verification,html_sha256}'
  then raise exception 'JUMP_AUDIT_BINDING'; end if;
  if jsonb_array_length(p_payload->'top5')<>5
    or jsonb_array_length(p_payload->'runners')<>(select count(*) from jsonb_array_elements(r.field_payload->'runners') x where x->>'status'='ACTIVE')
    or jsonb_typeof(p_payload->'audit'->'score_evidence') is distinct from 'array'
  then raise exception 'JUMP_ACTIVE_FIELD_COUNT'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'runners') x
    where jsonb_typeof(x->'rank') is distinct from 'number'
       or (x->>'rank')::numeric<>(x->>'rank')::integer
       or (x->>'rank')::integer not between 1 and jsonb_array_length(p_payload->'runners')
       or jsonb_typeof(x->'score') is distinct from 'number'
       or (x->>'score')::numeric not between 0 and 100
       or x->>'status' is distinct from 'ACTIVE'
       or not exists(select 1 from jsonb_array_elements(r.field_payload->'runners') y
         where y->>'status'='ACTIVE' and y->>'horse_no'=x->>'horse_no' and y->>'horse_name'=x->>'horse_name')
       or not exists(select 1 from jsonb_array_elements(p_payload->'audit'->'score_evidence') e
         where e->>'horse_no'=x->>'horse_no' and e->>'horse_name'=x->>'horse_name' and e->'rank'=x->'rank' and e->'score'=x->'score'))
    or (select count(distinct x->>'rank') from jsonb_array_elements(p_payload->'runners') x)<>jsonb_array_length(p_payload->'runners')
  then raise exception 'JUMP_ACTIVE_FIELD_IDENTITY_OR_SCORE'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'top5') with ordinality x(v,i)
     where (x.v->>'rank')::integer is distinct from x.i::integer
       or x.v->>'mark' is distinct from (array['◎','○','▲','☆','△'])[x.i::integer]
       or not exists(select 1 from jsonb_array_elements(p_payload->'runners') y where y=x.v))
  then raise exception 'JUMP_TOP5_EXACT_MATCH'; end if;
  if jsonb_typeof(p_payload->'audit'->'eye_pool_checked') is distinct from 'array'
     or (select array_agg((x #>> '{}')::int order by (x #>> '{}')::int) from jsonb_array_elements(p_payload->'audit'->'eye_pool_checked') x)
        is distinct from (select array_agg((x->>'horse_no')::int order by (x->>'horse_no')::int) from jsonb_array_elements(p_payload->'runners') x where (x->>'rank')::int>5)
  then raise exception 'JUMP_EYE_POOL_COVERAGE'; end if;
  if p_payload->'eye' <> 'null'::jsonb and (not exists(
       select 1 from jsonb_array_elements(p_payload->'runners') a where a->'horse_no'=p_payload->'eye'->'horse_no' and (a->>'rank')::int>5)
       or not exists(select 1 from jsonb_array_elements(p_payload->'audit'->'score_evidence') a where a->'horse_no'=p_payload->'eye'->'horse_no'
        and jsonb_array_length(a->'close_refs')>=1 and (a->>'independent_n')::integer>=15 and (a->>'independent_j')::numeric>=0.4))
  then raise exception 'JUMP_EYE_INDEPENDENT_FACTORS'; end if;

  -- Candidate grade guard: no historical prediction updates.
  for v_item in select value from jsonb_array_elements(p_payload->'runners') loop
    if jsonb_typeof(v_item->'grade') is distinct from 'string' or coalesce(v_item->>'grade','') not in ('S','A','B','C','D','E','F')
      then raise exception 'JRA_SAVE_GRADE_INVALID'; end if;
    if not exists(select 1 from jsonb_each(v_item) kv where kv.key in ('reason','comment','concrete_upside_reason') and jsonb_typeof(kv.value)='string' and btrim(kv.value #>> '{}')<>'')
      then raise exception 'JRA_SAVE_GRADE_REASON_MISSING'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_payload->'runners') x group by x->'horse_no' having count(*)<>1)
    then raise exception 'JRA_SAVE_DUPLICATE_RUNNER'; end if;
  if not (p_payload->'eye' = 'null'::jsonb or jsonb_typeof(p_payload->'eye')='object')
    then raise exception 'JRA_SAVE_EYE_SHAPE'; end if;
  for v_item in select value from jsonb_array_elements(p_payload->'top5')
    union all select p_payload->'eye' where p_payload->'eye' <> 'null'::jsonb loop
    if jsonb_typeof(v_item->'grade') is distinct from 'string' or coalesce(v_item->>'grade','') not in ('S','A','B','C','D','E','F')
      then raise exception 'JRA_SAVE_GRADE_INVALID'; end if;
    if not exists(select 1 from jsonb_each(v_item) kv where kv.key in ('reason','comment','concrete_upside_reason') and jsonb_typeof(kv.value)='string' and btrim(kv.value #>> '{}')<>'')
      then raise exception 'JRA_SAVE_GRADE_REASON_MISSING'; end if;
    select value into v_match from jsonb_array_elements(p_payload->'runners') where value->'horse_no'=v_item->'horse_no';
    if not found or v_match->'grade' is distinct from v_item->'grade' or v_match->'rank' is distinct from v_item->'rank' or v_match->'horse_name' is distinct from v_item->'horse_name'
      then raise exception 'JRA_SAVE_RUNNER_DISAGREEMENT'; end if;
  end loop;
  if exists(select 1 from public.official_predictions p where (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
    or exists(select 1 from public.chappy_predictions p where (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no)) then raise exception 'JRA_SAVE_ALREADY_EXISTS'; end if;
  v_now:=clock_timestamp();
  if r.post_time<=v_now+interval '3 minutes' or j.lease_until<=v_now then raise exception 'JUMP_SAVE_CUTOFF'; end if;
  insert into public.official_predictions(race_date,track,race_no,race_name,circuit,post_time,protocol_version,model_label,source,status,predicted_at,frozen_at,payload)
  values(r.race_date,r.track,r.race_no,r.race_name,'JRA',r.post_time,v_protocol,'BAKEN LAB JUMP 0.1 K2','CHATGPT','FROZEN',v_now,v_now,p_payload)
  returning id into v_id;
  update public.jra_prediction_jobs set job_status='DONE',last_error=null,claimed_by=null,claimed_at=null,lease_until=null,claim_token=null,worker_run_id=null,updated_at=clock_timestamp()
  where id=j.id and job_status='CLAIMED' and worker_run_id=j.worker_run_id and claim_token=j.claim_token and lease_until>clock_timestamp();
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'JRA_SAVE_STALE_CLAIM'; end if;
  update public.jra_prediction_worker_runs set completed_count=completed_count+1 where id=w.id and status='RUNNING';
  return v_id;
end $function$;
REVOKE ALL ON FUNCTION public.jra_jump_publish_verified_card_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jra_jump_publish_verified_card_v1(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.jra_jump_manual_claim_next_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jra_jump_manual_claim_next_v1() TO service_role;
REVOKE ALL ON FUNCTION public.jra_jump_save_claimed_prediction_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jra_jump_save_claimed_prediction_v1(uuid,text,jsonb) TO service_role;
COMMIT;
