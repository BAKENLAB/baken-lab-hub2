-- JRA production supplemental evidence integration. Approved 2026-11-08.
-- PRESERVES existing CLAIM, worker, safety and lease gates.
-- Does NOT change ranking, grade, bet strategy, schedule, FROZEN or Cron.
-- Supplemental source failures are quarantined per stage.
-- Existing required runner_history is unchanged.
CREATE OR REPLACE FUNCTION public.jra_claimed_context(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  j public.jra_prediction_jobs;
  w public.jra_prediction_worker_runs;
  r public.official_races;
  v_protocol text;
  v_candidates jsonb;
  v_history jsonb;
  v_content jsonb := '[]'::jsonb;
  v_older jsonb := '[]'::jsonb;
  v_content_status text := 'OPTIONAL_UNAVAILABLE';
  v_older_status text := 'OPTIONAL_UNAVAILABLE';
begin
  select * into j from public.jra_prediction_jobs where id=p_job_id;
  if not found or j.job_status<>'CLAIMED' or j.lease_until<=clock_timestamp() then
    raise exception 'JRA_CLAIM_UNAVAILABLE';
  end if;
  select * into w from public.jra_prediction_worker_runs where id=j.worker_run_id;
  if not found or w.status<>'RUNNING' or w.worker_id<>'JRA_QUEUE_RESCUE' or j.claimed_by<>w.worker_id then
    raise exception 'JRA_CLAIM_UNAVAILABLE';
  end if;
  select * into r from public.official_races
  where (race_date,track,race_no,circuit)=(j.race_date,j.track,j.race_no,'JRA');
  if not found or r.post_time<=clock_timestamp()+interval '3 minutes'
     or r.prediction_status not in ('PENDING','RETRY') then
    raise exception 'JRA_RACE_UNAVAILABLE';
  end if;
  if coalesce(r.field_payload->'race'->>'race_type','')='障害' then
    raise exception 'JRA_OBSTACLE_UNSUPPORTED';
  end if;
  begin
    select version into strict v_protocol
    from public.lab_prediction_protocols
    where protocol_key='JRA_MAIN' and is_active=true;
  exception when no_data_found or too_many_rows then
    raise exception 'JRA_PROTOCOL_NOT_UNIQUE';
  end;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.base_rank nulls last,c.horse_no),'[]'::jsonb)
  into v_candidates
  from public.jra_live_base_candidate_v1(j.race_date,j.track,j.race_no) c;
  select coalesce(jsonb_agg(jsonb_build_object(
    'horse_no',lr.horse_no,'horse_name',lr.horse_name,'draw',lr.draw,'sex_age',lr.sex_age,
    'weight_carried',lr.weight_carried,'jockey',lr.jockey,'trainer',lr.trainer,
    'body_weight',lr.body_weight,'body_weight_diff',lr.body_weight_diff,'equipment',lr.equipment,
    'past_runs',coalesce((
      select jsonb_agg(jsonb_build_object(
        'race_date',h.prior_date,
        'track',h.prior_track,
        'surface',h.prior_surface,
        'distance',h.prior_distance,
        'finish',h.finish,
        'field_size',h.field_size,
        'margin_to_winner',h.margin_to_winner,
        'weight_carried',h.weight_carried,
        'jockey',h.jockey,
        'early_pos',h.early_pos,
        'pos_change',h.pos_change,
        'race_class',h.prior_class,
        'source_kind',h.source_kind
      ) order by h.rn)
      from private.jra_merged_flat_history_v2(
        lr.horse_name,lr.horse_ref,rr.race_date,lr.past_runs,4
      ) h
    ),'[]'::jsonb)
  ) order by lr.horse_no),'[]'::jsonb)
  into v_history
  from public.jra_live_runners lr
  join public.jra_live_races rr on rr.id=lr.live_race_id
  where rr.race_date=j.race_date and rr.track=j.track and rr.race_no=j.race_no;
  -- Supplemental evidence only: failures must NOT prevent core claimed context.
  -- Core readiness/CLAIM/lease/obstacle checks above are unchanged.
  begin
    select private.jra_optional_content_evidence_v3(j.race_date,j.track,j.race_no)
      into v_content;
    if jsonb_typeof(v_content)='array'
      and jsonb_array_length(v_content)=jsonb_array_length(v_history)
      and pg_column_size(v_content)<=196608 then
      v_content_status := 'READY';
    else
      v_content := '[]'::jsonb;
      v_content_status := 'PARTIAL_OR_INVALID';
    end if;
  exception when others then
    v_content := '[]'::jsonb;
    v_content_status := 'OPTIONAL_SOURCE_FAILED';
  end;
  begin
    select private.jra_older_course_evidence_v1(j.race_date,j.track,j.race_no)
      into v_older;
    if jsonb_typeof(v_older)='array'
      and jsonb_array_length(v_older)=jsonb_array_length(v_history)
      and pg_column_size(v_older)<=196608 then
      v_older_status := 'READY';
    else
      v_older := '[]'::jsonb;
      v_older_status := 'PARTIAL_OR_INVALID';
    end if;
  exception when others then
    v_older := '[]'::jsonb;
    v_older_status := 'OPTIONAL_SOURCE_FAILED';
  end;
  return jsonb_build_object(
    'job_id',j.id,
    'race',jsonb_build_object(
      'race_date',r.race_date,'track',r.track,'race_no',r.race_no,
      'race_name',r.race_name,'post_time',r.post_time,'field_payload',r.field_payload
    ),
    'protocol_version',v_protocol,
    'candidates',v_candidates,
    'runner_history',v_history,
    'runner_content_evidence',v_content,
    'runner_content_status',v_content_status,
    'older_course_evidence',v_older,
    'older_course_status',v_older_status,
    'history_policy',jsonb_build_object(
      'flat_only',true,'merged_live_db',true,'history_limit',4,
      'market_fields_removed',true,
      'removed_fields',jsonb_build_array('popularity','raw','source_ref')
    ),
    'stage','AWAITING_JRA_FULL_DEPTH_COMPARISON'
  );
end
$function$
