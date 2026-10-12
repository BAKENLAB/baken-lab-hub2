-- BAKEN LAB JRA ⑦ isolated PostgreSQL 17 validation candidate.
-- NOT FOR PRODUCTION DEPLOYMENT WITHOUT SEPARATE APPROVAL.
-- Based on read-only current production pg_get_functiondef with only submitted grade guard added.
CREATE OR REPLACE FUNCTION public.jra_save_claimed_prediction(p_job_id uuid, p_protocol_version text, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare j public.jra_prediction_jobs; w public.jra_prediction_worker_runs; r public.official_races; v_protocol text; v_id uuid; v_now timestamptz:=clock_timestamp(); v_count integer; v_item jsonb; v_match jsonb;
begin
  select * into j from public.jra_prediction_jobs where id=p_job_id for update;
  if not found or j.job_status<>'CLAIMED' or j.lease_until<=v_now then raise exception 'JRA_SAVE_STALE_CLAIM'; end if;
  select * into w from public.jra_prediction_worker_runs where id=j.worker_run_id for update;
  if not found or w.status<>'RUNNING' or w.worker_id<>'JRA_QUEUE_RESCUE' or j.claimed_by<>w.worker_id then raise exception 'JRA_SAVE_RUN_INVALID'; end if;
  select * into r from public.official_races where (race_date,track,race_no,circuit)=(j.race_date,j.track,j.race_no,'JRA') for update;
  if not found or r.post_time<=v_now+interval '3 minutes' or r.prediction_status not in ('PENDING','RETRY') then raise exception 'JRA_SAVE_RACE_INVALID'; end if;
  if coalesce(r.field_payload->'race'->>'race_type','')='障害' then raise exception 'JRA_OBSTACLE_UNSUPPORTED'; end if;
  lock table public.lab_prediction_protocols in share mode;
  begin select version into strict v_protocol from public.lab_prediction_protocols where protocol_key='JRA_MAIN' and is_active=true;
  exception when no_data_found or too_many_rows then raise exception 'JRA_PROTOCOL_NOT_UNIQUE'; end;
  if p_protocol_version is distinct from v_protocol then raise exception 'JRA_SAVE_PROTOCOL_MISMATCH'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
    or not (p_payload ?& array['runners','top5','eye','bets','summary','bet_strategy','audit'])
    or (select count(*) from jsonb_object_keys(p_payload))<>7 then raise exception 'JRA_SAVE_PAYLOAD_KEYS'; end if;
  if jsonb_typeof(p_payload->'runners') is distinct from 'array' or jsonb_array_length(p_payload->'runners')=0
    or jsonb_typeof(p_payload->'top5') is distinct from 'array' or jsonb_array_length(p_payload->'top5')=0
    or jsonb_typeof(p_payload->'audit') is distinct from 'object' then raise exception 'JRA_SAVE_PAYLOAD_SHAPE'; end if;
  if p_payload->'bets' is distinct from '[]'::jsonb or p_payload->>'bet_strategy'<>'SUSPENDED_FOR_ABILITY_STABILITY' then raise exception 'JRA_SAVE_MARKET_SEPARATION'; end if;
  if p_payload->'audit'->'market_used_for_ranking' is distinct from 'false'::jsonb
    or p_payload->'audit'->'all_runners_checked' is distinct from 'true'::jsonb
    or p_payload->'audit'->>'protocol_version' is distinct from v_protocol
    or p_payload->'audit'->>'validated_core' is distinct from 'BASE_CORE_0.1' then raise exception 'JRA_SAVE_AUDIT_REQUIRED'; end if;
  -- Candidate grade guard: no historical prediction updates.
  for v_item in select value from jsonb_array_elements(p_payload->'runners') loop
    if jsonb_typeof(v_item->'grade') is distinct from 'string' or coalesce(v_item->>'grade','') not in ('S','A','B','C','D','E','F')
      then raise exception 'JRA_SAVE_GRADE_INVALID'; end if;
    if not exists(select 1 from jsonb_each(v_item) kv where kv.key in ('reason','comment','concrete_upside_reason') and jsonb_typeof(kv.value)='string' and btrim(kv.value #>> '{}')<>'')
      then raise exception 'JRA_SAVE_GRADE_REASON_MISSING'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_payload->'runners') x group by x->'horse_no' having count(*)<>1)
    then raise exception 'JRA_SAVE_DUPLICATE_RUNNER'; end if;
  if not (p_payload->'eye' = 'null'::jsonb or jsonb_typeof(p_payload->'eye')='object')
    then raise exception 'JRA_SAVE_EYE_SHAPE'; end if;
  for v_item in select value from jsonb_array_elements(p_payload->'top5')
    union all select p_payload->'eye' where p_payload->'eye' <> 'null'::jsonb loop
    if jsonb_typeof(v_item->'grade') is distinct from 'string' or coalesce(v_item->>'grade','') not in ('S','A','B','C','D','E','F')
      then raise exception 'JRA_SAVE_GRADE_INVALID'; end if;
    if not exists(select 1 from jsonb_each(v_item) kv where kv.key in ('reason','comment','concrete_upside_reason') and jsonb_typeof(kv.value)='string' and btrim(kv.value #>> '{}')<>'')
      then raise exception 'JRA_SAVE_GRADE_REASON_MISSING'; end if;
    select value into v_match from jsonb_array_elements(p_payload->'runners') where value->'horse_no'=v_item->'horse_no';
    if not found or v_match->'grade' is distinct from v_item->'grade' or v_match->'rank' is distinct from v_item->'rank' or v_match->'horse_name' is distinct from v_item->'horse_name'
      then raise exception 'JRA_SAVE_RUNNER_DISAGREEMENT'; end if;
  end loop;
  if exists(select 1 from public.official_predictions p where (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
    or exists(select 1 from public.chappy_predictions p where (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no)) then raise exception 'JRA_SAVE_ALREADY_EXISTS'; end if;
  insert into public.official_predictions(race_date,track,race_no,race_name,circuit,post_time,protocol_version,model_label,source,status,predicted_at,frozen_at,payload)
  values(r.race_date,r.track,r.race_no,r.race_name,'JRA',r.post_time,v_protocol,'GPT-5.6 Sol','CHATGPT','FROZEN',v_now,v_now,p_payload)
  returning id into v_id;
  update public.jra_prediction_jobs set job_status='DONE',last_error=null,claimed_by=null,claimed_at=null,lease_until=null,claim_token=null,worker_run_id=null,updated_at=clock_timestamp()
  where id=j.id and job_status='CLAIMED' and worker_run_id=j.worker_run_id and claim_token=j.claim_token and lease_until>clock_timestamp();
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'JRA_SAVE_STALE_CLAIM'; end if;
  update public.jra_prediction_worker_runs set completed_count=completed_count+1 where id=w.id and status='RUNNING';
  return v_id;
end $function$
