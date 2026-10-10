-- Rollback final stage ONLY after baseline deployment and JWT setting verified.
BEGIN;
DO $resume$ DECLARE r record; v_command text; BEGIN
 FOR r IN SELECT * FROM private.jra_issue4_cron_backup LOOP
  SELECT command INTO v_command FROM cron.job WHERE jobid=r.jobid AND jobname=r.jobname;
  IF v_command IS DISTINCT FROM r.command THEN RAISE EXCEPTION 'JRA_COMMAND_CHANGED_STOP'; END IF;
  PERFORM cron.alter_job(r.jobid,active:=r.active);
 END LOOP;
END $resume$;
DROP TABLE private.jra_issue4_cron_backup;
COMMIT;
