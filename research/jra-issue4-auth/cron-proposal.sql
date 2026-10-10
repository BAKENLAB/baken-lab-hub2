-- PROPOSAL ONLY. Secrets must already exist in Vault; never paste values here.
BEGIN;
DO $preflight$
BEGIN
 IF (select count(*) from cron.job where (jobid=9 and jobname='jra-live-discover') or (jobid=10 and jobname='jra-live-sync'))<>2 THEN RAISE EXCEPTION 'JRA_JOB_IDENTITY_CHANGED'; END IF;
 IF (select count(*) from vault.secrets where name in ('jra_cron_gateway_jwt','jra_cron_token'))<>2 THEN RAISE EXCEPTION 'JRA_VAULT_NOT_CONFIGURED'; END IF;
 IF to_regclass('private.jra_issue4_cron_backup') IS NULL THEN RAISE EXCEPTION 'JRA_BACKUP_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM cron.job WHERE jobid IN (9,10) AND active) THEN RAISE EXCEPTION 'JRA_PAUSE_REQUIRED'; END IF;
 IF to_regprocedure('private.jra_cron_request_v1(text)') IS NOT NULL THEN RAISE EXCEPTION 'JRA_REPAIR_ALREADY_EXISTS'; END IF;
END $preflight$;
CREATE FUNCTION private.jra_cron_request_v1(p_action text) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v_jwt text;v_token text;v_claims jsonb;v_part text;
BEGIN
 IF p_action NOT IN ('discover','sync_batch') OR p_action IS NULL THEN RAISE EXCEPTION 'JRA_ACTION_NOT_ALLOWED'; END IF;
 SELECT decrypted_secret INTO STRICT v_jwt FROM vault.decrypted_secrets WHERE name='jra_cron_gateway_jwt';
 SELECT decrypted_secret INTO STRICT v_token FROM vault.decrypted_secrets WHERE name='jra_cron_token';
 IF v_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'JRA_TOKEN_FORMAT_INVALID'; END IF;
 -- Accept only low-privilege legacy anon JWT. Signature is verified at Edge gateway.
 IF v_jwt !~ '^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'JRA_GATEWAY_JWT_INVALID'; END IF;
 v_part:=translate(split_part(v_jwt,'.',2),'-_','+/');
 BEGIN
  v_claims:=convert_from(decode(v_part||repeat('=',(4-length(v_part)%4)%4),'base64'),'UTF8')::jsonb;
 EXCEPTION WHEN others THEN RAISE EXCEPTION 'JRA_GATEWAY_JWT_INVALID'; END;
 IF v_claims->>'role' IS DISTINCT FROM 'anon' OR v_claims->>'ref' IS DISTINCT FROM 'qjlvsndiqjfsfjinilig' OR coalesce((v_claims->>'exp')::numeric,0)<=extract(epoch from clock_timestamp()) THEN RAISE EXCEPTION 'JRA_GATEWAY_JWT_SCOPE_INVALID'; END IF;
 RETURN net.http_post(
 url:='https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/jra-live',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_jwt,'X-JRA-Cron-Token',v_token),
 body:=case when p_action='discover' then jsonb_build_object('action',p_action) else jsonb_build_object('action',p_action,'batch_size',1) end,
 timeout_milliseconds:=30000);
END $fn$;
REVOKE ALL ON FUNCTION private.jra_cron_request_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.jra_cron_request_v1(text) TO postgres;
-- Preserve schedule/active/name. Only the commands for 9 and 10 change.
SELECT cron.alter_job(9,command := $cmd$SELECT private.jra_cron_request_v1('discover');$cmd$);
SELECT cron.alter_job(10,command := $cmd$SELECT private.jra_cron_request_v1('sync_batch') WHERE EXISTS (SELECT 1 FROM public.jra_live_queue WHERE status IN ('pending','error') AND attempts<3);$cmd$);
DO $resume$ DECLARE r record; BEGIN FOR r IN SELECT jobid,active FROM private.jra_issue4_cron_backup LOOP PERFORM cron.alter_job(r.jobid,active:=r.active); END LOOP; END $resume$;
COMMIT;
