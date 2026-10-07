-- PROPOSAL ONLY: never applied to production.
BEGIN;
CREATE SCHEMA local_shadow;
REVOKE ALL ON SCHEMA local_shadow FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA local_shadow TO service_role;
CREATE TABLE local_shadow.input_snapshots (
 snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 archive_format_version text NOT NULL CHECK (archive_format_version='LOCAL_INPUT_ARCHIVE_V1'),
 context_version text,
 race_date date NOT NULL, track text NOT NULL, race_no integer NOT NULL,
 circuit text NOT NULL CHECK(circuit='LOCAL'),
 protocol_version text NOT NULL, captured_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(), post_time timestamptz NOT NULL,
 context_json jsonb NOT NULL, canonical_context_json text NOT NULL,
 prompt_context_json text NOT NULL, protocol_content_json text NOT NULL,
 context_hash text NOT NULL, prompt_context_hash text NOT NULL, protocol_hash text NOT NULL,
 archive_status text NOT NULL DEFAULT 'CAPTURED' CHECK(archive_status='CAPTURED'),
 CHECK(captured_at < post_time AND received_at < post_time),
 CHECK(context_json=canonical_context_json::jsonb AND context_json=prompt_context_json::jsonb),
 CHECK(context_hash=encode(sha256(convert_to(canonical_context_json,'UTF8')),'hex')),
 CHECK(prompt_context_hash=encode(sha256(convert_to(prompt_context_json,'UTF8')),'hex')),
 CHECK(protocol_hash=encode(sha256(convert_to(protocol_content_json,'UTF8')),'hex')),
 UNIQUE(race_date,track,race_no,archive_format_version,context_hash,protocol_version,protocol_hash)
);
CREATE UNIQUE INDEX snapshot_true_revision ON local_shadow.input_snapshots
 (race_date,track,race_no,context_version) WHERE context_version IS NOT NULL;
CREATE TABLE local_shadow.input_archive_events (
 archive_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trace_id uuid UNIQUE NOT NULL,
 snapshot_id uuid REFERENCES local_shadow.input_snapshots(snapshot_id),
 job_id uuid NOT NULL, worker_run_id uuid NOT NULL,
 captured_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 prompt_context_json text NOT NULL, prompt_context_hash text NOT NULL,
 archive_status text NOT NULL CHECK(archive_status IN ('CAPTURED','REUSED','CONFLICT')),
 CHECK(prompt_context_hash=encode(sha256(convert_to(prompt_context_json,'UTF8')),'hex')),
 CHECK((archive_status='CONFLICT')=(snapshot_id IS NULL))
);
CREATE INDEX archive_event_snapshot ON local_shadow.input_archive_events(snapshot_id);
CREATE TABLE local_shadow.prediction_snapshot_links (
 prediction_id uuid PRIMARY KEY, snapshot_id uuid NOT NULL REFERENCES local_shadow.input_snapshots(snapshot_id),
 archive_event_id uuid UNIQUE NOT NULL REFERENCES local_shadow.input_archive_events(archive_event_id),
 linked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX prediction_link_snapshot ON local_shadow.prediction_snapshot_links(snapshot_id);
CREATE FUNCTION local_shadow.reject_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE'; END $$;
CREATE FUNCTION public.local_shadow_capture_v1(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog SET lock_timeout='100ms' SET statement_timeout='400ms' AS $$
DECLARE s local_shadow.input_snapshots; e local_shadow.input_archive_events;
 sid uuid; status text:='CAPTURED'; x local_shadow.input_snapshots;
BEGIN
 IF p_input->>'circuit' IS DISTINCT FROM 'LOCAL' THEN RAISE EXCEPTION 'LOCAL_ONLY'; END IF;
 IF p_input->>'archive_format_version' IS DISTINCT FROM 'LOCAL_INPUT_ARCHIVE_V1' THEN RAISE EXCEPTION 'FORMAT'; END IF;
 -- Idempotent transport resend: never update an existing attempt.
 SELECT * INTO e FROM local_shadow.input_archive_events WHERE trace_id=(p_input->>'trace_id')::uuid;
 IF FOUND THEN
   IF e.job_id IS DISTINCT FROM (p_input->>'job_id')::uuid OR
      e.worker_run_id IS DISTINCT FROM (p_input->>'worker_run_id')::uuid OR
      e.prompt_context_hash IS DISTINCT FROM p_input->>'prompt_context_hash'
      THEN RAISE EXCEPTION 'TRACE_CONFLICT'; END IF;
   RETURN jsonb_build_object('ok',e.snapshot_id IS NOT NULL,'snapshot_id',e.snapshot_id,'archive_event_id',e.archive_event_id,'archive_status',e.archive_status);
 END IF;
 IF p_input->>'context_version' IS NOT NULL THEN
   -- Lock only the SHADOW revision namespace; never production rows.
   PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|','local_shadow',
     p_input->>'race_date',p_input->>'track',p_input->>'race_no',p_input->>'context_version'),0));
   SELECT * INTO s FROM local_shadow.input_snapshots WHERE
    (race_date,track,race_no,context_version)=
    ((p_input->>'race_date')::date,p_input->>'track',(p_input->>'race_no')::integer,p_input->>'context_version');
   IF FOUND AND (s.context_hash IS DISTINCT FROM p_input->>'context_hash' OR
      s.protocol_hash IS DISTINCT FROM p_input->>'protocol_hash' OR
      s.protocol_version IS DISTINCT FROM p_input->>'protocol_version') THEN status:='CONFLICT'; END IF;
 END IF;
 IF status <> 'CONFLICT' THEN
  INSERT INTO local_shadow.input_snapshots(
   archive_format_version,context_version,race_date,track,race_no,circuit,protocol_version,
   captured_at,post_time,context_json,canonical_context_json,prompt_context_json,protocol_content_json,
   context_hash,prompt_context_hash,protocol_hash)
  VALUES(p_input->>'archive_format_version',p_input->>'context_version',(p_input->>'race_date')::date,
   p_input->>'track',(p_input->>'race_no')::integer,'LOCAL',p_input->>'protocol_version',
   (p_input->>'captured_at')::timestamptz,(p_input->>'post_time')::timestamptz,
   p_input->'context_json',p_input->>'canonical_context_json',p_input->>'prompt_context_json',
   p_input->>'protocol_content_json',p_input->>'context_hash',p_input->>'prompt_context_hash',p_input->>'protocol_hash')
  ON CONFLICT DO NOTHING RETURNING snapshot_id INTO sid;
  IF sid IS NULL THEN
   SELECT * INTO s FROM local_shadow.input_snapshots WHERE
    (race_date,track,race_no,archive_format_version,context_hash,protocol_version,protocol_hash)=
    ((p_input->>'race_date')::date,p_input->>'track',(p_input->>'race_no')::integer,
     p_input->>'archive_format_version',p_input->>'context_hash',p_input->>'protocol_version',p_input->>'protocol_hash');
   IF NOT FOUND OR s.context_json IS DISTINCT FROM p_input->'context_json' THEN RAISE EXCEPTION 'CONFLICT'; END IF;
   sid:=s.snapshot_id; status:='REUSED';
  END IF;
 END IF;
 INSERT INTO local_shadow.input_archive_events(trace_id,snapshot_id,job_id,worker_run_id,captured_at,
  prompt_context_json,prompt_context_hash,archive_status)
 VALUES((p_input->>'trace_id')::uuid,sid,(p_input->>'job_id')::uuid,(p_input->>'worker_run_id')::uuid,
  (p_input->>'captured_at')::timestamptz,p_input->>'prompt_context_json',p_input->>'prompt_context_hash',status)
 RETURNING * INTO e;
 RETURN jsonb_build_object('ok',sid IS NOT NULL,'snapshot_id',sid,'archive_event_id',e.archive_event_id,'archive_status',status);
END $$;
CREATE FUNCTION public.local_shadow_link_v1(p_prediction_id uuid,p_archive_event_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
 SET lock_timeout='100ms' SET statement_timeout='400ms' AS $$
DECLARE e local_shadow.input_archive_events; s local_shadow.input_snapshots;
 l local_shadow.prediction_snapshot_links;
BEGIN
 SELECT * INTO e FROM local_shadow.input_archive_events WHERE archive_event_id=p_archive_event_id;
 IF NOT FOUND OR e.snapshot_id IS NULL THEN RAISE EXCEPTION 'EVENT_INVALID'; END IF;
 SELECT * INTO s FROM local_shadow.input_snapshots WHERE snapshot_id=e.snapshot_id;
 -- Read-only checks, no FK/locks/triggers on production tables.
 IF NOT EXISTS(SELECT 1 FROM public.lab_local_queue_save_receipts r
   JOIN public.official_predictions p ON p.id=r.prediction_id
   WHERE r.job_id=e.job_id AND p.id=p_prediction_id AND p.circuit='LOCAL'
    AND p.status='FROZEN' AND p.source='CHATGPT' AND p.protocol_version=s.protocol_version
    AND (p.race_date,p.track,p.race_no)=(s.race_date,s.track,s.race_no)
    AND e.received_at <= p.frozen_at AND e.captured_at <= p.frozen_at
    AND p.frozen_at < s.post_time) THEN RAISE EXCEPTION 'LINK_INVALID'; END IF;
 INSERT INTO local_shadow.prediction_snapshot_links(prediction_id,snapshot_id,archive_event_id)
 VALUES(p_prediction_id,e.snapshot_id,e.archive_event_id) ON CONFLICT DO NOTHING;
 SELECT * INTO l FROM local_shadow.prediction_snapshot_links WHERE prediction_id=p_prediction_id;
 IF NOT FOUND OR l.archive_event_id IS DISTINCT FROM p_archive_event_id THEN RAISE EXCEPTION 'LINK_CONFLICT'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE EXECUTE ON FUNCTION public.local_shadow_capture_v1(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.local_shadow_link_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.local_shadow_capture_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.local_shadow_link_v1(uuid,uuid) TO service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA local_shadow FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA local_shadow TO service_role;
REVOKE EXECUTE ON FUNCTION local_shadow.reject_mutation() FROM PUBLIC,anon,authenticated;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['input_snapshots','input_archive_events','prediction_snapshot_links'] LOOP
  EXECUTE format('ALTER TABLE local_shadow.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY service_only ON local_shadow.%I TO service_role USING (true) WITH CHECK (true)',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON local_shadow.%I FOR EACH ROW EXECUTE FUNCTION local_shadow.reject_mutation()',t);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON local_shadow.%I FOR EACH STATEMENT EXECUTE FUNCTION local_shadow.reject_mutation()',t);
 END LOOP;
END $$;
COMMIT;
-- Mandatory after isolated Supabase application: security advisor.
-- Confirm local_shadow is NOT in Data API exposed schemas. Never alter global exposure here.
