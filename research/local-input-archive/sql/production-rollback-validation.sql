BEGIN;
-- NOT EXECUTED. All created objects and SHADOW rows are transaction-scoped.
-- Use a dedicated connection. Submit the complete file as one SQL batch.
-- Client must send the terminal rollback even after an error, or close the
-- dedicated connection immediately (server rolls back on disconnect).
-- Cancellation/network failure may prevent the terminal statement being reached.
-- Never reuse an open failed transaction; verify absence using another connection.
DO $$ BEGIN
 IF current_setting('plpgsql.check_asserts') <> 'on' THEN
  RAISE EXCEPTION 'ASSERTIONS_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='local_shadow')
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('local_shadow_capture_v1','local_shadow_link_v1'))
 THEN RAISE EXCEPTION 'VALIDATION_OBJECTS_ALREADY_EXIST'; END IF;
END $$;
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
DO $$
DECLARE p jsonb; a jsonb; b jsonb; c jsonb; sid uuid; eid uuid; pid uuid:=gen_random_uuid();
 ctx text:='{"runners":[]}'; changed text:='{"runners":[1]}'; rejected boolean;
BEGIN
 p:=jsonb_build_object('archive_format_version','LOCAL_INPUT_ARCHIVE_V1',
 'race_date','2099-01-01','track','ARCHIVE_TEST','race_no',99,'circuit','LOCAL',
 'job_id',gen_random_uuid(),'worker_run_id',gen_random_uuid(),'trace_id',gen_random_uuid(),
 'captured_at',clock_timestamp(),'post_time','2099-01-01T12:00:00Z',
 'protocol_version','TEST','context_json',ctx::jsonb,'canonical_context_json',ctx,
 'prompt_context_json',ctx,'protocol_content_json','{}',
 'context_hash',encode(sha256(convert_to(ctx,'UTF8')),'hex'),
 'prompt_context_hash',encode(sha256(convert_to(ctx,'UTF8')),'hex'),
 'protocol_hash',encode(sha256(convert_to('{}','UTF8')),'hex'));
 a:=public.local_shadow_capture_v1(p); ASSERT (a->>'ok')::boolean;
 b:=public.local_shadow_capture_v1(p); ASSERT a=b; -- transport idempotency
 b:=public.local_shadow_capture_v1(p||jsonb_build_object('trace_id',gen_random_uuid()));
 ASSERT a->>'snapshot_id'=b->>'snapshot_id';
 ASSERT a->>'archive_event_id'<>b->>'archive_event_id'; -- same snapshot, distinct attempt
 c:=public.local_shadow_capture_v1(p||jsonb_build_object('trace_id',gen_random_uuid(),
 'context_json',changed::jsonb,'canonical_context_json',changed,'prompt_context_json',changed,
 'context_hash',encode(sha256(convert_to(changed,'UTF8')),'hex'),
 'prompt_context_hash',encode(sha256(convert_to(changed,'UTF8')),'hex')));
 ASSERT a->>'snapshot_id'<>c->>'snapshot_id'; -- changed retry
 -- Use a separate race to test real revision conflict.
 p:=p||jsonb_build_object('race_no',98,'context_version','REAL_UPSTREAM_REVISION','trace_id',gen_random_uuid());
 a:=public.local_shadow_capture_v1(p);
 c:=public.local_shadow_capture_v1(p||jsonb_build_object('trace_id',gen_random_uuid(),
 'context_json',changed::jsonb,'canonical_context_json',changed,'prompt_context_json',changed,
 'context_hash',encode(sha256(convert_to(changed,'UTF8')),'hex'),
 'prompt_context_hash',encode(sha256(convert_to(changed,'UTF8')),'hex')));
 ASSERT NOT (c->>'ok')::boolean; ASSERT c->>'archive_status'='CONFLICT';
 sid:=(a->>'snapshot_id')::uuid; eid:=(a->>'archive_event_id')::uuid;
 rejected:=false;
 BEGIN UPDATE local_shadow.input_snapshots SET track='REWRITE' WHERE snapshot_id=sid;
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM <> 'IMMUTABLE' THEN RAISE; END IF; rejected:=true; END; ASSERT rejected;
 rejected:=false;
 BEGIN DELETE FROM local_shadow.input_snapshots WHERE snapshot_id=sid;
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM <> 'IMMUTABLE' THEN RAISE; END IF; rejected:=true; END; ASSERT rejected;
 rejected:=false;
 BEGIN TRUNCATE local_shadow.prediction_snapshot_links;
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM <> 'IMMUTABLE' THEN RAISE; END IF; rejected:=true; END; ASSERT rejected;
 ASSERT NOT has_function_privilege('anon','public.local_shadow_capture_v1(jsonb)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.local_shadow_link_v1(uuid,uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.local_shadow_capture_v1(jsonb)','EXECUTE');
 ASSERT NOT has_table_privilege('service_role','local_shadow.input_snapshots','UPDATE');
 ASSERT NOT has_schema_privilege('anon','local_shadow','USAGE');

 RAISE NOTICE 'SNAPSHOT_AND_ACL_VALIDATION_PASSED';
END $$;


-- Negative CHECK tests and row-level immutable guards: SHADOW rows only.
DO $$
DECLARE s local_shadow.input_snapshots; e local_shadow.input_archive_events;
 p jsonb; bad jsonb; field_name text; result jsonb; row_count bigint; marker uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT s FROM local_shadow.input_snapshots WHERE race_no=99 AND context_json='{"runners":[]}'::jsonb;
 SELECT * INTO e FROM local_shadow.input_archive_events WHERE snapshot_id=s.snapshot_id LIMIT 1;
 p:=to_jsonb(s)||jsonb_build_object('trace_id',gen_random_uuid(),'job_id',e.job_id,'worker_run_id',e.worker_run_id);
 FOREACH field_name IN ARRAY ARRAY['context_hash','prompt_context_hash','protocol_hash'] LOOP
  bad:=p||jsonb_build_object('trace_id',gen_random_uuid(),'race_no',97,field_name,repeat('0',64));
  BEGIN PERFORM public.local_shadow_capture_v1(bad);
   RAISE EXCEPTION 'HASH_CHECK_NOT_ENFORCED'; EXCEPTION WHEN check_violation THEN NULL; END;
 END LOOP;
 bad:=p||jsonb_build_object('trace_id',gen_random_uuid(),'race_no',96,'captured_at',s.post_time);
 BEGIN PERFORM public.local_shadow_capture_v1(bad);
  RAISE EXCEPTION 'CAPTURE_TIME_CHECK_NOT_ENFORCED'; EXCEPTION WHEN check_violation THEN NULL; END;
 bad:=p||jsonb_build_object('trace_id',gen_random_uuid(),'race_no',95,
 'post_time',clock_timestamp()-interval '1 hour','captured_at',clock_timestamp()-interval '2 hours');
 BEGIN PERFORM public.local_shadow_capture_v1(bad);
  RAISE EXCEPTION 'RECEIVE_TIME_CHECK_NOT_ENFORCED'; EXCEPTION WHEN check_violation THEN NULL; END;
 -- Direct SHADOW-only structural fixture; this does NOT validate FROZEN link RPC.
 INSERT INTO local_shadow.prediction_snapshot_links(prediction_id,snapshot_id,archive_event_id)
 VALUES(marker,s.snapshot_id,e.archive_event_id);
 BEGIN UPDATE local_shadow.prediction_snapshot_links SET linked_at=clock_timestamp() WHERE prediction_id=marker;
  RAISE EXCEPTION 'LINK_UPDATE_ALLOWED'; EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'IMMUTABLE' THEN RAISE; END IF; END;
 BEGIN DELETE FROM local_shadow.prediction_snapshot_links WHERE prediction_id=marker;
  RAISE EXCEPTION 'LINK_DELETE_ALLOWED'; EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'IMMUTABLE' THEN RAISE; END IF; END;
 BEGIN TRUNCATE local_shadow.prediction_snapshot_links;
  RAISE EXCEPTION 'LINK_TRUNCATE_ALLOWED'; EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'IMMUTABLE' THEN RAISE; END IF; END;
 -- Invalid event must be rejected, without reading/writing any production fixture.
 BEGIN PERFORM public.local_shadow_link_v1(marker,gen_random_uuid());
  RAISE EXCEPTION 'INVALID_EVENT_ALLOWED'; EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'EVENT_INVALID' THEN RAISE; END IF; END;
END $$;

-- Catalog checks include effective inherited rights and explicit PUBLIC ACL entries.
DO $$
DECLARE f regprocedure; t regclass; role_name text; privilege_name text;
BEGIN
 FOREACH f IN ARRAY ARRAY['public.local_shadow_capture_v1(jsonb)'::regprocedure,
 'public.local_shadow_link_v1(uuid,uuid)'::regprocedure] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p,
   LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
   WHERE p.oid=f AND a.grantee=0 AND a.privilege_type='EXECUTE')
  THEN RAISE EXCEPTION 'PUBLIC_RPC_EXECUTE'; END IF;
  ASSERT NOT pg_catalog.has_function_privilege('anon',f,'EXECUTE');
  ASSERT NOT pg_catalog.has_function_privilege('authenticated',f,'EXECUTE');
  ASSERT pg_catalog.has_function_privilege('service_role',f,'EXECUTE');
  ASSERT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=f AND NOT prosecdef
    AND 'search_path=pg_catalog'=ANY(proconfig));
 END LOOP;
 FOREACH t IN ARRAY ARRAY['local_shadow.input_snapshots'::regclass,
 'local_shadow.input_archive_events'::regclass,'local_shadow.prediction_snapshot_links'::regclass] LOOP
  ASSERT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=t AND relrowsecurity);
  ASSERT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=t AND polname='service_only');
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   ASSERT NOT pg_catalog.has_schema_privilege(role_name,'local_shadow','USAGE');
   FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    ASSERT NOT pg_catalog.has_table_privilege(role_name,t,privilege_name);
   END LOOP;
  END LOOP;
  ASSERT pg_catalog.has_table_privilege('service_role',t,'SELECT');
  ASSERT pg_catalog.has_table_privilege('service_role',t,'INSERT');
  FOREACH privilege_name IN ARRAY ARRAY['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
   ASSERT NOT pg_catalog.has_table_privilege('service_role',t,privilege_name);
  END LOOP;
 END LOOP;
END $$;
-- Permission switches are transaction-local; no role definitions/configuration change.
SET LOCAL ROLE service_role;
DO $$
DECLARE rejected boolean; n bigint;
BEGIN
 SELECT count(*) INTO n FROM local_shadow.input_snapshots;
 PERFORM public.local_shadow_capture_v1(
  (SELECT to_jsonb(s)||jsonb_build_object('trace_id',gen_random_uuid(),'job_id',e.job_id,'worker_run_id',e.worker_run_id)
   FROM local_shadow.input_snapshots s JOIN local_shadow.input_archive_events e ON e.snapshot_id=s.snapshot_id
   WHERE s.race_no=99 LIMIT 1));
 BEGIN UPDATE local_shadow.input_snapshots SET track='DENIED';
  RAISE EXCEPTION 'UPDATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM local_shadow.input_archive_events;
  RAISE EXCEPTION 'DELETE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN TRUNCATE local_shadow.prediction_snapshot_links;
  RAISE EXCEPTION 'TRUNCATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.local_shadow_capture_v1('{}'::jsonb);
  RAISE EXCEPTION 'ANON_RPC_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM local_shadow.input_snapshots;
  RAISE EXCEPTION 'ANON_TABLE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.local_shadow_link_v1(gen_random_uuid(),gen_random_uuid());
  RAISE EXCEPTION 'AUTH_RPC_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM local_shadow.input_archive_events;
  RAISE EXCEPTION 'AUTH_TABLE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- No historical INPUT exists. A receipt/prediction pair cannot reconstruct it.
-- An event received now cannot precede an already-FROZEN prediction's frozen_at.
-- Do not backdate received_at or loosen link RPC checks to manufacture success.
DO $$
DECLARE found_pair boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.official_predictions p
 JOIN public.lab_local_queue_save_receipts r ON r.prediction_id=p.id
 WHERE p.circuit='LOCAL' AND p.status='FROZEN' AND p.source='CHATGPT') INTO found_pair;
 RAISE NOTICE 'FROZEN_LINK_REAL_DB_UNVERIFIED (existing_pair_available=%)',found_pair;
END $$;
ROLLBACK;
