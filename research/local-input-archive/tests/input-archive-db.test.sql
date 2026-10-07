-- NEVER run against production. Isolated PostgreSQL only, after proposal migration.
-- Requires disposable fixture public.official_predictions and lab_local_queue_save_receipts.
-- Run: psql -v isolated_local_input_archive_db=1 -v ON_ERROR_STOP=1 -f tests/input-archive-db.test.sql
\if :{?isolated_local_input_archive_db}
\else
\echo 'Refusing without explicit isolated database flag'
\quit
\endif
BEGIN;
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
 EXCEPTION WHEN OTHERS THEN rejected:=true; END; ASSERT rejected;
 rejected:=false;
 BEGIN DELETE FROM local_shadow.input_snapshots WHERE snapshot_id=sid;
 EXCEPTION WHEN OTHERS THEN rejected:=true; END; ASSERT rejected;
 rejected:=false;
 BEGIN TRUNCATE local_shadow.prediction_snapshot_links;
 EXCEPTION WHEN OTHERS THEN rejected:=true; END; ASSERT rejected;
 ASSERT NOT has_function_privilege('anon','public.local_shadow_capture_v1(jsonb)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.local_shadow_link_v1(uuid,uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.local_shadow_capture_v1(jsonb)','EXECUTE');
 ASSERT NOT has_table_privilege('service_role','local_shadow.input_snapshots','UPDATE');
 ASSERT NOT has_schema_privilege('anon','local_shadow','USAGE');
 -- Test fixtures only: synthetic FROZEN output for the successful attempt.
 INSERT INTO public.official_predictions(id,race_date,track,race_no,circuit,protocol_version,status,source,frozen_at)
 VALUES(pid,'2099-01-01','ARCHIVE_TEST',98,'LOCAL','TEST','FROZEN','CHATGPT',clock_timestamp());
 INSERT INTO public.lab_local_queue_save_receipts(job_id,prediction_id)
 VALUES((p->>'job_id')::uuid,pid);
 b:=public.local_shadow_link_v1(pid,eid); ASSERT (b->>'ok')::boolean;
 b:=public.local_shadow_link_v1(pid,eid); ASSERT (b->>'ok')::boolean;
 ASSERT EXISTS(SELECT 1 FROM local_shadow.prediction_snapshot_links
 WHERE prediction_id=pid AND snapshot_id=sid AND archive_event_id=eid);
 rejected:=false;
 BEGIN PERFORM public.local_shadow_link_v1(pid,(c->>'archive_event_id')::uuid);
 EXCEPTION WHEN OTHERS THEN rejected:=true; END; ASSERT rejected;
 RAISE NOTICE 'DB assertions passed';
END $$;
ROLLBACK;
