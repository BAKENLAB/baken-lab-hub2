-- Run before redeploying baseline; no prediction/LOCAL/job21 writes.
BEGIN;
DO $rollback$
DECLARE r record; v_command text;
BEGIN
 FOR r IN SELECT * FROM private.jra_issue4_cron_backup LOOP
  SELECT command INTO v_command FROM cron.job WHERE jobid=r.jobid AND jobname=r.jobname;
  IF v_command IS NULL OR v_command NOT LIKE '%private.jra_cron_request_v1%' THEN RAISE EXCEPTION 'JRA_JOB_CHANGED_STOP_ROLLBACK'; END IF;
  PERFORM cron.alter_job(r.jobid, schedule:=r.schedule,command:=r.command,active:=false);
 END LOOP;
END $rollback$;
DROP FUNCTION private.jra_cron_request_v1(text);
COMMIT;
-- Redeploy baseline/index.ts with verify_jwt=true AFTER restoring cron.
-- Then execute resume-original.sql. Backup retains original pre-pause active flags.
-- Evidence/live collection rows already fetched are retained, never removed.
