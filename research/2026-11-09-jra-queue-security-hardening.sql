-- JRA queue security hardening: remove exposed direct table and RPC writes.
-- All authorized JRA queue actions run via server-only service_role / postgres.
-- No change to rows, race statuses, predictions, lease rules, or FROZEN.
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE
  public.jra_prediction_jobs,
  public.jra_prediction_worker_runs TO service_role;
REVOKE ALL ON TABLE
  public.jra_prediction_jobs,
  public.jra_prediction_worker_runs FROM PUBLIC,anon,authenticated;
ALTER TABLE public.jra_prediction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jra_prediction_worker_runs ENABLE ROW LEVEL SECURITY;
-- Existing SECURITY DEFINER JRA save/finalize functions must never be
-- callable anonymously, even if underlying tables have RLS.
GRANT EXECUTE ON FUNCTION
 public.jra_save_claimed_prediction(uuid,text,jsonb),
 public.jra_finish_prediction_job(uuid,text,text,integer),
 public.jra_finish_worker_run(uuid,text,text),
 public.jra_start_worker_run(text),
 public.jra_claim_prediction_jobs(uuid,integer,integer),
 public.jra_enqueue_prediction_jobs(date)
TO service_role;
REVOKE EXECUTE ON FUNCTION
 public.jra_save_claimed_prediction(uuid,text,jsonb),
 public.jra_finish_prediction_job(uuid,text,text,integer),
 public.jra_finish_worker_run(uuid,text,text),
 public.jra_start_worker_run(text),
 public.jra_claim_prediction_jobs(uuid,integer,integer),
 public.jra_enqueue_prediction_jobs(date)
FROM PUBLIC,anon,authenticated;
