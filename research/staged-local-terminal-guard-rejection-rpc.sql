-- RESEARCH / STAGING ONLY — NOT DEPLOYED. Do not run as ad-hoc DB update.
-- Requires deliberate production MCP upgrade to call v2 instead of v1.
-- Only genuine errors thrown by the existing official save RPC are terminalized.
-- Any unknown failure or stale lease is rethrown without touching queue state.
-- Existing FROZEN, results and bet data are NEVER altered.
begin;
create or replace function public.lab_queue_save_prediction_v2(
 p_job_id uuid,p_user_id uuid,p_protocol_version text,
 p_payload jsonb,p_original_payload jsonb
) returns jsonb
language plpgsql security invoker
set search_path to 'pg_catalog'
set lock_timeout to '5s'
set statement_timeout to '15s'
as $fn$
declare
 v_out jsonb;
 v_error text;
 v_run_id uuid;
 v_run public.lab_worker_runs;
 v_job public.lab_prediction_jobs;
 v_race public.official_races;
begin
 -- Subtransaction: a guard-trigger exception rolls back every save side effect.
 begin
  v_out:=public.lab_queue_save_prediction_v1(
   p_job_id,p_user_id,p_protocol_version,p_payload,p_original_payload
  );
  return v_out;
 exception when raise_exception then
  get stacked diagnostics v_error = message_text;
  if v_error not in ('LOCAL_EYE_MARKET_EVIDENCE','LOCAL_EYE_CHECK_EVIDENCE') then
   raise; -- Unknown error MUST NOT trigger a terminal transition.
  end if;
 end;

 -- Match the deployed lock order: run -> job -> race.
 select worker_run_id into v_run_id from public.lab_prediction_jobs where id=p_job_id;
 if v_run_id is null then raise exception 'QUEUE_REJECTION_NOT_LIVE'; end if;
 select * into v_run from public.lab_worker_runs
  where id=v_run_id for update;
 select * into v_job from public.lab_prediction_jobs
  where id=p_job_id for update;
 select * into v_race from public.official_races
  where (race_date,track,race_no,circuit)=
  (v_job.race_date,v_job.track,v_job.race_no,v_job.circuit) for update;

 if p_user_id is null or v_run.id is null or v_job.id is null or v_race.race_date is null
    or v_job.circuit <> 'LOCAL'
    or v_job.worker_run_id is distinct from v_run.id
    or v_job.claimed_by is distinct from v_run.worker_id
    or v_job.job_status <> 'CLAIMED'
    or v_job.claim_token is null
    or v_run.status <> 'RUNNING'
    or v_job.lease_until is null
    or v_job.lease_until <= clock_timestamp()
    or v_race.post_time <= clock_timestamp() + interval '3 minutes'
    or v_race.prediction_status not in ('PENDING','RETRY')
    or exists (select 1 from public.official_predictions p
       where (p.race_date,p.track,p.race_no)=
             (v_job.race_date,v_job.track,v_job.race_no))
    or exists (select 1 from public.chappy_predictions p
       where (p.race_date,p.track,p.race_no)=
             (v_job.race_date,v_job.track,v_job.race_no))
 then raise exception 'QUEUE_REJECTION_NOT_LIVE'; end if;

 -- No direct prediction write, no modification of existing FROZEN.
 update public.lab_prediction_jobs
 set job_status='DEAD',last_error=v_error,
     claimed_by=null,claimed_at=null,lease_until=null,
     claim_token=null,worker_run_id=null
 where id=p_job_id and job_status='CLAIMED'
   and worker_run_id=v_run.id and claim_token=v_job.claim_token
   and lease_until>clock_timestamp();
 if not found then raise exception 'QUEUE_REJECTION_STATE_CHANGED'; end if;

 update public.lab_worker_runs
 set failed_count=failed_count+1,last_error=v_error
 where id=v_run.id and status='RUNNING';
 if not found then raise exception 'QUEUE_REJECTION_RUN_CHANGED'; end if;

 if not exists(select 1 from public.lab_prediction_jobs j
   where j.worker_run_id=v_run.id and j.job_status='CLAIMED') then
   perform public.lab_finish_worker_run(v_run.id,'FAILED',v_error);
 end if;
 return jsonb_build_object('ok',false,'terminal',true,
   'reason',v_error,'job_id',p_job_id,'saved',false);
end;
$fn$;
revoke all on function public.lab_queue_save_prediction_v2(uuid,uuid,text,jsonb,jsonb)
 from public,anon,authenticated;
grant execute on function public.lab_queue_save_prediction_v2(uuid,uuid,text,jsonb,jsonb)
 to service_role;
commit;
