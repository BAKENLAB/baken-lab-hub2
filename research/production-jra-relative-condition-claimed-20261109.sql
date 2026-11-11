-- BAKEN LAB JRA: deployed supplemental comparison at 2026-11-09 JST.
-- Source synchronized from the live production function definitions.
-- NO model score/rank changes. Both functions are independent of target result and market.
-- Claimed context preserves the existing lease/worker/obstacle/post-time gates.
-- Do not run this file as an automatic migration without reviewing the live schema.

CREATE OR REPLACE FUNCTION private.jra_relative_condition_comparison_v1(p_history jsonb, p_target_date date, p_surface text, p_distance integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
  v_per jsonb := '[]'::jsonb;
  v_pairs jsonb := '[]'::jsonb;
  n integer := 0;
BEGIN
 IF jsonb_typeof(p_history)<>'array'
    OR p_target_date IS NULL
    OR p_surface NOT IN ('芝','ダート')
    OR p_distance NOT BETWEEN 1000 AND 3600
    OR jsonb_array_length(p_history) NOT BETWEEN 2 AND 24
 THEN
  RETURN jsonb_build_object('status','CONDITIONS_OR_ROSTER_UNAVAILABLE','rank_effect',false,'market_used',false);
 END IF;
 n:=jsonb_array_length(p_history);
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_history) r
   WHERE (r->>'horse_no') !~ '^[0-9]{1,2}$'
      OR (r->>'horse_no')::integer NOT BETWEEN 1 AND 24
      OR COALESCE(r->>'horse_name','')=''
      OR jsonb_typeof(r->'past_runs')<>'array'
      OR jsonb_array_length(r->'past_runs')>12
 ) OR (SELECT count(DISTINCT r->>'horse_no') FROM jsonb_array_elements(p_history) r)<>n
 THEN
  RETURN jsonb_build_object('status','UNVERIFIED_ROSTER','rank_effect',false,'market_used',false);
 END IF;
 -- Strict target-date boundary. Any future/equal-date historical row rejects
 -- the optional comparison, rather than interpreting it as prior evidence.
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_history) r,
      jsonb_array_elements(r->'past_runs') h
   WHERE (h->>'race_date') !~ '^\d{4}-\d{2}-\d{2}$'
      OR (h->>'race_date')>=p_target_date::text
 ) THEN
  RETURN jsonb_build_object('status','HISTORICAL_ASOF_REJECTED','rank_effect',false,'market_used',false);
 END IF;
 WITH field AS(
   SELECT (r->>'horse_no')::int hn,r->>'horse_name' name,
     r->'past_runs' history
   FROM jsonb_array_elements(p_history) r
 ), expanded AS(
   SELECT f.hn, h,
     (h->>'surface'=p_surface AND (h->>'distance') ~ '^[0-9]{3,4}$'
       AND abs((h->>'distance')::integer-p_distance)<=200) similar,
     CASE WHEN (h->>'finish') ~ '^[0-9]{1,2}$'
       THEN (h->>'finish')::integer END fin,
     CASE WHEN (h->>'margin_to_winner') ~ '^[0-9]{1,2}([.][0-9]{1,3})?$'
       THEN (h->>'margin_to_winner')::numeric END margin,
     CASE WHEN (h->>'early_pos') ~ '^[0-9]{1,2}$'
       THEN (h->>'early_pos')::integer END early
   FROM field f LEFT JOIN LATERAL jsonb_array_elements(f.history) h ON true
 ), measures AS (
   SELECT f.hn,f.name,
     count(*) FILTER(WHERE e.similar)::int comparable_runs,
     count(*) FILTER(WHERE e.similar AND e.fin=1 OR
       (e.similar AND e.fin BETWEEN 2 AND 3 AND e.margin BETWEEN 0 AND 0.5))::int close_runs,
     count(*) FILTER(WHERE e.similar AND e.fin BETWEEN 1 AND 3)::int podium_runs,
     count(*) FILTER(WHERE e.similar AND e.early BETWEEN 1 AND 3)::int front3_runs,
     count(*) FILTER(WHERE e.similar AND e.fin>=8 AND e.margin>=1.5)::int decisive_defeats,
     COALESCE(jsonb_agg(jsonb_build_object(
       'date',e.h->>'race_date','surface',e.h->>'surface',
       'distance',e.h->>'distance','class',e.h->>'race_class',
       'finish',e.fin,'margin',e.margin,'early_pos',e.early,
       'source_kind',e.h->>'source_kind'
     ) ORDER BY e.h->>'race_date' DESC) FILTER(WHERE e.similar),'[]'::jsonb) supporting_runs
   FROM field f LEFT JOIN expanded e ON e.hn=f.hn
   GROUP BY f.hn,f.name
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'horse_no',hn,'horse_name',name,'comparable_runs',comparable_runs,
   'close_runs',close_runs,'podium_runs',podium_runs,
   'front3_runs',front3_runs,'decisive_defeats',decisive_defeats,
   'supporting_runs',supporting_runs,
   'comparison_status',CASE WHEN comparable_runs>=2 THEN 'REPEATED_COMPARABLE_RUNS'
     WHEN comparable_runs=1 THEN 'SINGLE_COMPARABLE_RUN'
     ELSE 'NO_COMPARABLE_RUN' END
 ) ORDER BY hn),'[]'::jsonb) INTO v_per FROM measures;
 WITH entries AS(
   SELECT (e->>'horse_no')::int hn,
     (e->>'close_runs')::int close_n,
     (e->>'comparable_runs')::int comparable_n,
     (e->>'decisive_defeats')::int poor_n
   FROM jsonb_array_elements(v_per) e
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'a_horse_no',a.hn,'b_horse_no',b.hn,
   'a_close_runs',a.close_n,'b_close_runs',b.close_n,
   'a_comparable_runs',a.comparable_n,'b_comparable_runs',b.comparable_n,
   'a_decisive_defeats',a.poor_n,'b_decisive_defeats',b.poor_n,
   'close_evidence_leader',CASE WHEN a.close_n>b.close_n THEN a.hn
     WHEN b.close_n>a.close_n THEN b.hn ELSE NULL END,
   'disclaimer','COUNTS_ONLY_NOT_PROOF_OF_OVERALL_SUPERIORITY'
 ) ORDER BY a.hn,b.hn),'[]'::jsonb) INTO v_pairs
 FROM entries a JOIN entries b ON a.hn<b.hn
 WHERE a.comparable_n>0 AND b.comparable_n>0
   AND (a.comparable_n>=2 OR b.comparable_n>=2)
   AND a.close_n<>b.close_n;
 RETURN jsonb_build_object(
   'status','READY','source_scope','JRA_CLAIMED_RUNNER_HISTORY',
   'target_date',p_target_date,'target_surface',p_surface,
   'target_distance',p_distance,'runner_count',n,
   'runner_evidence',v_per,'comparisons',v_pairs,
   'comparison_count',jsonb_array_length(v_pairs),
   'target_result_used',false,'market_used',false,'rank_effect',false,
   'scoring_permission',false,
   'interpretation','HISTORICAL_FACTUAL_COMPARISON_ONLY_NOT_A_REPLACEMENT_RANK');
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('status','OPTIONAL_COMPARISON_FAILED','rank_effect',false,'market_used',false);
END;
$function$


REVOKE ALL ON FUNCTION private.jra_relative_condition_comparison_v1(jsonb,date,text,integer) FROM PUBLIC, anon, authenticated;

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
  v_pace jsonb := '{}'::jsonb;
  v_pace_status text := 'OPTIONAL_UNAVAILABLE';
  v_review jsonb := '{}'::jsonb;
  v_review_status text := 'OPTIONAL_UNAVAILABLE';
  v_relative jsonb := '{}'::jsonb;
  v_relative_status text := 'OPTIONAL_UNAVAILABLE';
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
      and (select count(distinct e->>'horse_no') from jsonb_array_elements(v_content) e)
        =jsonb_array_length(v_history)
      and not exists (
        select 1 from jsonb_array_elements(v_content) evidence
        where not exists (
          select 1 from jsonb_array_elements(v_history) base
          where base->>'horse_no'=evidence->>'horse_no'
            and base->>'horse_name'=evidence->>'horse_name'
        )
      )
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
      and (select count(distinct e->>'horse_no') from jsonb_array_elements(v_older) e)
        =jsonb_array_length(v_history)
      and not exists (
        select 1 from jsonb_array_elements(v_older) evidence
        where not exists (
          select 1 from jsonb_array_elements(v_history) base
          where base->>'horse_no'=evidence->>'horse_no'
            and base->>'horse_name'=evidence->>'horse_name'
        )
      )
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
  begin
    select private.jra_relative_pace_summary_v1(
      v_history, rr.surface, rr.distance
    ) into v_pace
    from public.jra_live_races rr
    where (rr.race_date,rr.track,rr.race_no)=(j.race_date,j.track,j.race_no)
    limit 1;
    if jsonb_typeof(v_pace)='object'
      and v_pace->>'status'='READY'
      and (v_pace->>'runner_count')::integer=jsonb_array_length(v_history)
      then v_pace_status := 'READY';
    else
      v_pace := '{}'::jsonb;
      v_pace_status := 'PARTIAL_OR_INVALID';
    end if;
  exception when others then
    v_pace := '{}'::jsonb;
    v_pace_status := 'OPTIONAL_SOURCE_FAILED';
  end;
  -- Name-only historical podium is a REVIEW lead; never an unverified score feature.
  -- Isolated optional step, with identity and payload guards.
  begin
    select private.jra_missing_id_review_v1(
      j.race_date,j.track,j.race_no,clock_timestamp()
    ) into v_review;
    if jsonb_typeof(v_review)='object'
      and v_review->>'status'='REVIEW_ONLY_UNVERIFIED_HORSE_ID'
      and v_review->>'allow_as_scoring_evidence'='false'
      and jsonb_typeof(v_review->'candidates')='array'
      and pg_column_size(v_review)<=16384
      and not exists (
        select 1 from jsonb_array_elements(v_review->'candidates') e
        where not exists (
          select 1 from jsonb_array_elements(v_history) core
          where e->>'horse_no'=core->>'horse_no'
            and e->>'horse_name'=core->>'horse_name'
        )
      )
      then v_review_status := 'REVIEW_ONLY';
    else
      v_review := '{}'::jsonb;
      v_review_status := 'PARTIAL_OR_INVALID';
    end if;
  exception when others then
    v_review := '{}'::jsonb;
    v_review_status := 'OPTIONAL_SOURCE_FAILED';
  end;

  -- Fail-open evidence for human full-field comparison; NEVER changes scoring.
  -- Source is ONLY the already CLAIM-validated, as-of runner_history.
  begin
    select private.jra_relative_condition_comparison_v1(
      v_history,j.race_date,rr.surface,rr.distance
    ) into v_relative
    from public.jra_live_races rr
    where (rr.race_date,rr.track,rr.race_no)=(j.race_date,j.track,j.race_no)
      and coalesce(rr.race_type,'')<>'障害'
    limit 1;
    if jsonb_typeof(v_relative)='object'
      and v_relative->>'status'='READY'
      and (v_relative->>'runner_count')::integer=jsonb_array_length(v_history)
      and (v_relative->>'rank_effect')::boolean=false
      and (v_relative->>'market_used')::boolean=false
      and pg_column_size(v_relative)<=196608
      then v_relative_status:='READY';
    else
      v_relative:='{}'::jsonb;
      v_relative_status:='PARTIAL_OR_INVALID';
    end if;
  exception when others then
    v_relative:='{}'::jsonb;
    v_relative_status:='OPTIONAL_SOURCE_FAILED';
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
    'field_pace_evidence',v_pace,
    'field_pace_status',v_pace_status,
    'relative_condition_evidence',v_relative,
    'relative_condition_status',v_relative_status,
    'older_name_only_review',v_review,
    'older_name_only_review_status',v_review_status,
    'history_policy',jsonb_build_object(
      'flat_only',true,'merged_live_db',true,'history_limit',4,
      'market_fields_removed',true,
      'removed_fields',jsonb_build_array('popularity','raw','source_ref')
    ),
    'stage','AWAITING_JRA_FULL_DEPTH_COMPARISON'
  );
end
$function$

