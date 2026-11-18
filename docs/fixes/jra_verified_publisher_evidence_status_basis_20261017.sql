-- Match existing CHECK jra_html_evidence_no_false_proof:
-- status_basis VERIFIED_CURRENT_ENTRY for actual successful all-runner current proof.
-- No constraint or validation weakening. Existing time, claim, FROZEN checks preserved.
CREATE OR REPLACE FUNCTION public.jra_publish_verified_card_v1(p_proof jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  IF NOT FOUND OR v_live.race_type='障害' OR v_live.field_size<>jsonb_array_length(v_runners)
    OR v_live.surface NOT IN ('芝','ダート')
    OR v_live.distance IS NULL OR v_live.post_time IS NULL
  THEN RAISE EXCEPTION 'JRA_LIVE_CAPTURE_UNAVAILABLE_OR_MISMATCH'; END IF;
  IF v_live.surface IS DISTINCT FROM p_proof->'race'->>'surface'
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
  IF v_count<>v_live.field_size OR v_active<3
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
    ON (v_item->>'horse_no')::integer=r.horse_no
  WHERE r.live_race_id=v_live.id;
  v_payload := jsonb_build_object(
    'race',jsonb_build_object(
      'race_type','平地','surface',v_live.surface,'distance',v_live.distance,
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
$function$
