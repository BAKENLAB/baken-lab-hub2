-- First stage, after explicit diff/rollback review. Does NOT send HTTP.
BEGIN;
DO $check$ BEGIN
 IF (select count(*) from cron.job where (jobid=9 and jobname='jra-live-discover') or (jobid=10 and jobname='jra-live-sync'))<>2 THEN RAISE EXCEPTION 'JRA_JOB_IDENTITY_CHANGED'; END IF;
 IF to_regclass('private.jra_issue4_cron_backup') IS NOT NULL THEN RAISE EXCEPTION 'JRA_BACKUP_EXISTS'; END IF;
END $check$;
CREATE TABLE private.jra_issue4_cron_backup AS SELECT jobid,jobname,schedule,active,command FROM cron.job WHERE jobid IN (9,10);
REVOKE ALL ON private.jra_issue4_cron_backup FROM PUBLIC,anon,authenticated,service_role;
SELECT cron.alter_job(9,active:=false);
SELECT cron.alter_job(10,active:=false);
COMMIT;
-- Drain in-flight requests before deploying candidate; do not touch job21.
