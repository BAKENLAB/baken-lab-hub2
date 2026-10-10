-- SHADOW PROTOTYPE ONLY: DO NOT APPLY TO PRODUCTION.
-- NOT SAFE TO DEPLOY until current-race ACTIVE/CANCELLED/EXCLUDED status provenance
-- and atomic complete-field gates are integrated. This is a race-scoped refactor,
-- not an approved official prediction publishing function.
-- Source: existing production function captured 2026-10-10 UTC.
CREATE OR REPLACE FUNCTION private.refresh_jra_live_rank_beta_scoped_shadow(p_race_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  delete from public.jra_live_rank_entries where live_race_id=p_race_id;

  insert into public.jra_live_rank_entries (
    live_runner_id,live_race_id,race_date,track,race_no,horse_no,horse_name,jockey,
    history_n,available_components,recent_score,exact_score,distance_score,track_score,going_score,
    transition_score,jockey_score,lab_score,overall_grade,strong_count,position_confidence,data_status,
    components,model_version,generated_at
  )
  with target as (
    select
      lr.id as live_runner_id,
      lr.live_race_id,
      lr.horse_no,
      lr.horse_name,
      lr.horse_ref,
      regexp_replace(coalesce(lr.jockey,''),'^[△▲☆★◇]','') as jockey,
      lr.past_runs,
      r.race_date,r.track,r.race_no,r.surface,r.distance,
      coalesce(nullif(r.going,''),'不明') as going,
      r.race_type
    from public.jra_live_runners lr
    join public.jra_live_races r on r.id=lr.live_race_id
    where r.id=p_race_id and r.race_type='平地' and r.surface in ('芝','ダート')
  ),
  card_runs0 as (
    select
      t.live_runner_id,
      row_number() over(partition by t.live_runner_id order by p.ord)::int as rn,
      nullif(p.run->>'race_date','')::date as prior_date,
      nullif(p.run->>'track','') as prior_track,
      nullif(p.run->>'surface','') as prior_surface,
      nullif(p.run->>'distance','')::int as prior_distance,
      coalesce(nullif(p.run->>'going',''),'不明') as prior_going,
      nullif(p.run->>'finish','')::int as finish,
      nullif(p.run->>'field_size','')::int as field_size,
      nullif(p.run->>'margin_to_winner','')::numeric as margin_to_winner
    from target t
    cross join lateral jsonb_array_elements(t.past_runs) with ordinality as p(run,ord)
    where (p.run->>'finish') ~ '^[0-9]+
  card_runs as (
    select c.*,
      case
        when c.finish is not null and c.field_size is not null and c.field_size>1 then
          (
            (100.0*(c.field_size-c.finish)/(c.field_size-1))*0.75 +
            coalesce(
              greatest(0,least(100,100.0*(1-least(c.margin_to_winner/6.0,1))))*0.25,
              (100.0*(c.field_size-c.finish)/(c.field_size-1))*0.25
            )
          )
        else null
      end as run_quality
    from card_runs0 c
  ),
  hist as (
    select
      t.live_runner_id,
      count(c.run_quality)::int as history_n,
      avg(c.run_quality) filter (where c.rn<=4) as recent_raw,
      stddev_pop(c.run_quality) filter (where c.rn<=4) as recent_sd,

      count(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface and c.prior_distance=t.distance
      )::int as exact_n,
      avg(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface and c.prior_distance=t.distance
      ) as exact_raw,

      count(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_distance=t.distance
      )::int as distance_n,
      avg(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_distance=t.distance
      ) as distance_raw,

      count(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface
      )::int as track_n,
      avg(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface
      ) as track_raw,

      count(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_going=t.going
      )::int as going_n,
      avg(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_going=t.going
      ) as going_raw,

      max(c.prior_track) filter (where c.rn=1) as prev_track,
      max(c.prior_surface) filter (where c.rn=1) as prev_surface,
      max(c.prior_distance) filter (where c.rn=1) as prev_distance,
      max(c.prior_going) filter (where c.rn=1) as prev_going
    from target t
    left join card_runs c on c.live_runner_id=t.live_runner_id
    group by t.live_runner_id
  ),
  trans as (
    select
      t.live_runner_id,
      sum(s.runners)::numeric as n,
      sum(s.wins)::numeric as wins,
      sum(s.top3s)::numeric as top3s
    from target t
    join hist h on h.live_runner_id=t.live_runner_id
    join public.jra_transition_daily_stats s
      on s.race_date<t.race_date
     and s.prev_track=coalesce(h.prev_track,'不明')
     and s.prev_surface=coalesce(h.prev_surface,'不明')
     and s.prev_distance=coalesce(h.prev_distance,0)
     and s.prev_going=coalesce(h.prev_going,'不明')
     and s.track=t.track
     and s.surface=t.surface
     and s.distance=t.distance
     and s.going=t.going
    group by t.live_runner_id
  ),
  jockey_stats as (
    select
      t.live_runner_id,
      sum(s.runners)::numeric as n,
      sum(s.wins)::numeric as wins,
      sum(s.top3s)::numeric as top3s
    from target t
    join public.jra_jockey_daily_stats s
      on s.race_date<t.race_date
     and s.track=t.track
     and s.jockey=t.jockey
    group by t.live_runner_id
  ),
  comps as (
    select
      t.*,
      coalesce(h.history_n,0) as history_n,
      h.recent_sd,
      coalesce(h.exact_n,0) as exact_n,
      coalesce(h.distance_n,0) as distance_n,
      coalesce(h.track_n,0) as track_n,
      coalesce(h.going_n,0) as going_n,

      case when h.recent_raw is not null
        then greatest(0,least(100,h.recent_raw)) end as recent_score,
      case when h.exact_raw is not null
        then greatest(0,least(100,50+(h.exact_raw-50)*h.exact_n::numeric/(h.exact_n+2.0))) end as exact_score,
      case when h.distance_raw is not null
        then greatest(0,least(100,50+(h.distance_raw-50)*h.distance_n::numeric/(h.distance_n+2.0))) end as distance_score,
      case when h.track_raw is not null
        then greatest(0,least(100,50+(h.track_raw-50)*h.track_n::numeric/(h.track_n+2.0))) end as track_score,
      case when h.going_raw is not null and t.going<>'不明'
        then greatest(0,least(100,50+(h.going_raw-50)*h.going_n::numeric/(h.going_n+3.0))) end as going_score,

      case when tr.n>0 then greatest(0,least(100,
        50+(greatest(15,least(90,25+110*(tr.top3s/tr.n)+30*(tr.wins/tr.n)))-50)*tr.n/(tr.n+20.0)
      )) end as transition_score,

      case when js.n>0 then greatest(0,least(100,
        50+(greatest(15,least(90,25+110*(js.top3s/js.n)+30*(js.wins/js.n)))-50)*js.n/(js.n+30.0)
      )) end as jockey_score,

      coalesce(tr.n,0) as transition_n,
      coalesce(js.n,0) as jockey_n
    from target t
    left join hist h on h.live_runner_id=t.live_runner_id
    left join trans tr on tr.live_runner_id=t.live_runner_id
    left join jockey_stats js on js.live_runner_id=t.live_runner_id
  ),
  weighted as (
    select c.*,
      (
        (case when c.recent_score is not null then 1 else 0 end)+
        (case when c.exact_score is not null then 1 else 0 end)+
        (case when c.distance_score is not null then 1 else 0 end)+
        (case when c.track_score is not null then 1 else 0 end)+
        (case when c.going_score is not null then 1 else 0 end)+
        (case when c.transition_score is not null then 1 else 0 end)+
        (case when c.jockey_score is not null then 1 else 0 end)
      )::int as available_components,
      (
        coalesce(c.recent_score*0.30,0)+
        coalesce(c.exact_score*0.17,0)+
        coalesce(c.distance_score*0.12,0)+
        coalesce(c.track_score*0.08,0)+
        coalesce(c.going_score*0.07,0)+
        coalesce(c.transition_score*0.12,0)+
        coalesce(c.jockey_score*0.07,0)
      ) as weighted_sum,
      (
        (case when c.recent_score is not null then 0.30 else 0 end)+
        (case when c.exact_score is not null then 0.17 else 0 end)+
        (case when c.distance_score is not null then 0.12 else 0 end)+
        (case when c.track_score is not null then 0.08 else 0 end)+
        (case when c.going_score is not null then 0.07 else 0 end)+
        (case when c.transition_score is not null then 0.12 else 0 end)+
        (case when c.jockey_score is not null then 0.07 else 0 end)
      ) as weight_sum
    from comps c
  ),
  scored0 as (
    select w.*,
      case when w.weight_sum>0 then greatest(0,least(100,w.weighted_sum/w.weight_sum)) end as score,
      case
        when w.history_n>=3 and w.available_components>=4 then 'RANKED'
        when w.history_n>=1 and w.available_components>=2 then 'REFERENCE'
        else 'DATA_INSUFFICIENT'
      end as data_status,
      (
        (case when w.recent_score>=62 then 1 else 0 end)+
        (case when w.exact_score>=62 then 1 else 0 end)+
        (case when w.distance_score>=62 then 1 else 0 end)+
        (case when w.track_score>=62 then 1 else 0 end)+
        (case when w.going_score>=62 then 1 else 0 end)+
        (case when w.transition_score>=62 then 1 else 0 end)+
        (case when w.jockey_score>=62 then 1 else 0 end)
      )::int as strong_count
    from weighted w
  ),
  scored as (
    select s.*,
      case
        when s.data_status<>'RANKED' or s.score is null then null
        when s.score>=72 and s.strong_count>=2 then 'S'
        when s.score>=66 then 'A'
        when s.score>=60 then 'B'
        when s.score>=54 then 'C'
        when s.score>=48 then 'D'
        when s.score>=42 then 'E'
        else 'F'
      end as overall_grade,
      case
        when s.history_n>=4 and coalesce(s.recent_sd,99)<=12 then 'S'
        when s.history_n>=4 and coalesce(s.recent_sd,99)<=18 then 'A'
        when s.history_n>=3 and coalesce(s.recent_sd,99)<=25 then 'B'
        when s.history_n>=2 then 'C'
        else null
      end as position_confidence
    from scored0 s
  )
  select
    s.live_runner_id,s.live_race_id,s.race_date,s.track,s.race_no,s.horse_no,s.horse_name,s.jockey,
    s.history_n,s.available_components,
    round(s.recent_score::numeric,2),round(s.exact_score::numeric,2),
    round(s.distance_score::numeric,2),round(s.track_score::numeric,2),round(s.going_score::numeric,2),
    round(s.transition_score::numeric,2),round(s.jockey_score::numeric,2),
    round(s.score::numeric,2),s.overall_grade,s.strong_count,s.position_confidence,s.data_status,
    jsonb_build_object(
      'recent',jsonb_build_object('score',round(s.recent_score::numeric,2),'n',s.history_n,'sd',round(s.recent_sd::numeric,2)),
      'exact',jsonb_build_object('score',round(s.exact_score::numeric,2),'n',s.exact_n),
      'distance',jsonb_build_object('score',round(s.distance_score::numeric,2),'n',s.distance_n),
      'track',jsonb_build_object('score',round(s.track_score::numeric,2),'n',s.track_n),
      'going',jsonb_build_object('score',round(s.going_score::numeric,2),'n',s.going_n),
      'transition',jsonb_build_object('score',round(s.transition_score::numeric,2),'n',s.transition_n),
      'jockey',jsonb_build_object('score',round(s.jockey_score::numeric,2),'n',s.jockey_n),
      'weights',jsonb_build_object('recent',0.30,'exact',0.17,'distance',0.12,'track',0.08,'going',0.07,'transition',0.12,'jockey',0.07),
      'source','JRA公式出馬表の前4走＋BAKEN LAB蓄積統計',
      'walk_forward',true,'popularity_used',false,'odds_used',false
    ),
    'JRA_LIVE_BETA_0.1',now()
  from scored s;

  with ordered as (
    select
      e.*,
      row_number() over (
        partition by e.live_race_id
        order by
          case e.data_status when 'RANKED' then 0 when 'REFERENCE' then 1 else 2 end,
          e.lab_score desc nulls last,e.horse_no
      ) as internal_pos
    from public.jra_live_rank_entries e
    where e.lab_score is not null and e.live_race_id=p_race_id
  ),
  triggers as (
    select o.*,
      (
        (case when o.recent_score>=65 and o.history_n>=2 then 1 else 0 end)+
        (case when o.exact_score>=60 and coalesce((o.components->'exact'->>'n')::int,0)>=2 then 1 else 0 end)+
        (case when o.distance_score>=62 and coalesce((o.components->'distance'->>'n')::int,0)>=2 then 1 else 0 end)+
        (case when o.going_score>=62 and coalesce((o.components->'going'->>'n')::int,0)>=2 then 1 else 0 end)+
        (case when o.transition_score>=62 and coalesce((o.components->'transition'->>'n')::numeric,0)>=10 then 1 else 0 end)+
        (case when o.jockey_score>=65 and coalesce((o.components->'jockey'->>'n')::numeric,0)>=20 then 1 else 0 end)
      )::int as trigger_count,
      greatest(coalesce(o.recent_score,0),coalesce(o.exact_score,0),coalesce(o.distance_score,0),
               coalesce(o.going_score,0),coalesce(o.transition_score,0),coalesce(o.jockey_score,0)) as strongest,
      array_to_string(array_remove(array[
        case when o.recent_score>=65 and o.history_n>=2 then '近走内容' end,
        case when o.exact_score>=60 and coalesce((o.components->'exact'->>'n')::int,0)>=2 then '同競馬場×同距離' end,
        case when o.distance_score>=62 and coalesce((o.components->'distance'->>'n')::int,0)>=2 then '同距離適性' end,
        case when o.going_score>=62 and coalesce((o.components->'going'->>'n')::int,0)>=2 then '馬場適性' end,
        case when o.transition_score>=62 and coalesce((o.components->'transition'->>'n')::numeric,0)>=10 then '条件替わり' end,
        case when o.jockey_score>=65 and coalesce((o.components->'jockey'->>'n')::numeric,0)>=20 then '騎手相性' end
      ],null),' / ') as reason
    from ordered o
    where o.internal_pos>5
  ),
  eligible as (
    select t.*,
      row_number() over(partition by t.live_race_id order by t.trigger_count desc,t.strongest desc,t.lab_score desc,t.horse_no) as pick
    from triggers t
    where t.trigger_count>=2
  )
  update public.jra_live_rank_entries e
  set lab_eye=true,lab_eye_trigger_count=x.trigger_count,lab_eye_reason=x.reason
  from eligible x
  where e.live_runner_id=x.live_runner_id and x.pick=1;
end;
$function$
 or coalesce(p.run->>'raw','') ~ '中止'
  ),
  card_runs as (
    select c.*,
      case
        when c.finish is not null and c.field_size is not null and c.field_size>1 then
          (
            (100.0*(c.field_size-c.finish)/(c.field_size-1))*0.75 +
            coalesce(
              greatest(0,least(100,100.0*(1-least(c.margin_to_winner/6.0,1))))*0.25,
              (100.0*(c.field_size-c.finish)/(c.field_size-1))*0.25
            )
          )
        else null
      end as run_quality
    from card_runs0 c
  ),
  hist as (
    select
      t.live_runner_id,
      count(c.run_quality)::int as history_n,
      avg(c.run_quality) filter (where c.rn<=4) as recent_raw,
      stddev_pop(c.run_quality) filter (where c.rn<=4) as recent_sd,

      count(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface and c.prior_distance=t.distance
      )::int as exact_n,
      avg(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface and c.prior_distance=t.distance
      ) as exact_raw,

      count(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_distance=t.distance
      )::int as distance_n,
      avg(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_distance=t.distance
      ) as distance_raw,

      count(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface
      )::int as track_n,
      avg(c.run_quality) filter (
        where c.prior_track=t.track and c.prior_surface=t.surface
      ) as track_raw,

      count(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_going=t.going
      )::int as going_n,
      avg(c.run_quality) filter (
        where c.prior_surface=t.surface and c.prior_going=t.going
      ) as going_raw,

      max(c.prior_track) filter (where c.rn=1) as prev_track,
      max(c.prior_surface) filter (where c.rn=1) as prev_surface,
      max(c.prior_distance) filter (where c.rn=1) as prev_distance,
      max(c.prior_going) filter (where c.rn=1) as prev_going
    from target t
    left join card_runs c on c.live_runner_id=t.live_runner_id
    group by t.live_runner_id
  ),
  trans as (
    select
      t.live_runner_id,
      sum(s.runners)::numeric as n,
      sum(s.wins)::numeric as wins,
      sum(s.top3s)::numeric as top3s
    from target t
    join hist h on h.live_runner_id=t.live_runner_id
    join public.jra_transition_daily_stats s
      on s.race_date<t.race_date
     and s.prev_track=coalesce(h.prev_track,'不明')
     and s.prev_surface=coalesce(h.prev_surface,'不明')
     and s.prev_distance=coalesce(h.prev_distance,0)
     and s.prev_going=coalesce(h.prev_going,'不明')
     and s.track=t.track
     and s.surface=t.surface
     and s.distance=t.distance
     and s.going=t.going
    group by t.live_runner_id
  ),
  jockey_stats as (
    select
      t.live_runner_id,
      sum(s.runners)::numeric as n,
      sum(s.wins)::numeric as wins,
      sum(s.top3s)::numeric as top3s
    from target t
    join public.jra_jockey_daily_stats s
      on s.race_date<t.race_date
     and s.track=t.track
     and s.jockey=t.jockey
    group by t.live_runner_id
  ),
  comps as (
    select
      t.*,
      coalesce(h.history_n,0) as history_n,
      h.recent_sd,
      coalesce(h.exact_n,0) as exact_n,
      coalesce(h.distance_n,0) as distance_n,
      coalesce(h.track_n,0) as track_n,
      coalesce(h.going_n,0) as going_n,

      case when h.recent_raw is not null
        then greatest(0,least(100,h.recent_raw)) end as recent_score,
      case when h.exact_raw is not null
        then greatest(0,least(100,50+(h.exact_raw-50)*h.exact_n::numeric/(h.exact_n+2.0))) end as exact_score,
      case when h.distance_raw is not null
        then greatest(0,least(100,50+(h.distance_raw-50)*h.distance_n::numeric/(h.distance_n+2.0))) end as distance_score,
      case when h.track_raw is not null
        then greatest(0,least(100,50+(h.track_raw-50)*h.track_n::numeric/(h.track_n+2.0))) end as track_score,
      case when h.going_raw is not null and t.going<>'不明'
        then greatest(0,least(100,50+(h.going_raw-50)*h.going_n::numeric/(h.going_n+3.0))) end as going_score,

      case when tr.n>0 then greatest(0,least(100,
        50+(greatest(15,least(90,25+110*(tr.top3s/tr.n)+30*(tr.wins/tr.n)))-50)*tr.n/(tr.n+20.0)
      )) end as transition_score,

      case when js.n>0 then greatest(0,least(100,
        50+(greatest(15,least(90,25+110*(js.top3s/js.n)+30*(js.wins/js.n)))-50)*js.n/(js.n+30.0)
      )) end as jockey_score,

      coalesce(tr.n,0) as transition_n,
      coalesce(js.n,0) as jockey_n
    from target t
    left join hist h on h.live_runner_id=t.live_runner_id
    left join trans tr on tr.live_runner_id=t.live_runner_id
    left join jockey_stats js on js.live_runner_id=t.live_runner_id
  ),
  weighted as (
    select c.*,
      (
        (case when c.recent_score is not null then 1 else 0 end)+
        (case when c.exact_score is not null then 1 else 0 end)+
        (case when c.distance_score is not null then 1 else 0 end)+
        (case when c.track_score is not null then 1 else 0 end)+
        (case when c.going_score is not null then 1 else 0 end)+
        (case when c.transition_score is not null then 1 else 0 end)+
        (case when c.jockey_score is not null then 1 else 0 end)
      )::int as available_components,
      (
        coalesce(c.recent_score*0.30,0)+
        coalesce(c.exact_score*0.17,0)+
        coalesce(c.distance_score*0.12,0)+
        coalesce(c.track_score*0.08,0)+
        coalesce(c.going_score*0.07,0)+
        coalesce(c.transition_score*0.12,0)+
        coalesce(c.jockey_score*0.07,0)
      ) as weighted_sum,
      (
        (case when c.recent_score is not null then 0.30 else 0 end)+
        (case when c.exact_score is not null then 0.17 else 0 end)+
        (case when c.distance_score is not null then 0.12 else 0 end)+
        (case when c.track_score is not null then 0.08 else 0 end)+
        (case when c.going_score is not null then 0.07 else 0 end)+
        (case when c.transition_score is not null then 0.12 else 0 end)+
        (case when c.jockey_score is not null then 0.07 else 0 end)
      ) as weight_sum
    from comps c
  ),
  scored0 as (
    select w.*,
      case when w.weight_sum>0 then greatest(0,least(100,w.weighted_sum/w.weight_sum)) end as score,
      case
        when w.history_n>=3 and w.available_components>=4 then 'RANKED'
        when w.history_n>=1 and w.available_components>=2 then 'REFERENCE'
        else 'DATA_INSUFFICIENT'
      end as data_status,
      (
        (case when w.recent_score>=62 then 1 else 0 end)+
        (case when w.exact_score>=62 then 1 else 0 end)+
        (case when w.distance_score>=62 then 1 else 0 end)+
        (case when w.track_score>=62 then 1 else 0 end)+
        (case when w.going_score>=62 then 1 else 0 end)+
        (case when w.transition_score>=62 then 1 else 0 end)+
        (case when w.jockey_score>=62 then 1 else 0 end)
      )::int as strong_count
    from weighted w
  ),
  scored as (
    select s.*,
      case
        when s.data_status<>'RANKED' or s.score is null then null
        when s.score>=72 and s.strong_count>=2 then 'S'
        when s.score>=66 then 'A'
        when s.score>=60 then 'B'
        when s.score>=54 then 'C'
        when s.score>=48 then 'D'
        when s.score>=42 then 'E'
        else 'F'
      end as overall_grade,
      case
        when s.history_n>=4 and coalesce(s.recent_sd,99)<=12 then 'S'
        when s.history_n>=4 and coalesce(s.recent_sd,99)<=18 then 'A'
        when s.history_n>=3 and coalesce(s.recent_sd,99)<=25 then 'B'
        when s.history_n>=2 then 'C'
        else null
      end as position_confidence
    from scored0 s
  )
  select
    s.live_runner_id,s.live_race_id,s.race_date,s.track,s.race_no,s.horse_no,s.horse_name,s.jockey,
    s.history_n,s.available_components,
    round(s.recent_score::numeric,2),round(s.exact_score::numeric,2),
    round(s.distance_score::numeric,2),round(s.track_score::numeric,2),round(s.going_score::numeric,2),
    round(s.transition_score::numeric,2),round(s.jockey_score::numeric,2),
    round(s.score::numeric,2),s.overall_grade,s.strong_count,s.position_confidence,s.data_status,
    jsonb_build_object(
      'recent',jsonb_build_object('score',round(s.recent_score::numeric,2),'n',s.history_n,'sd',round(s.recent_sd::numeric,2)),
      'exact',jsonb_build_object('score',round(s.exact_score::numeric,2),'n',s.exact_n),
      'distance',jsonb_build_object('score',round(s.distance_score::numeric,2),'n',s.distance_n),
      'track',jsonb_build_object('score',round(s.track_score::numeric,2),'n',s.track_n),
      'going',jsonb_build_object('score',round(s.going_score::numeric,2),'n',s.going_n),
      'transition',jsonb_build_object('score',round(s.transition_score::numeric,2),'n',s.transition_n),
      'jockey',jsonb_build_object('score',round(s.jockey_score::numeric,2),'n',s.jockey_n),
      'weights',jsonb_build_object('recent',0.30,'exact',0.17,'distance',0.12,'track',0.08,'going',0.07,'transition',0.12,'jockey',0.07),
      'source','JRA公式出馬表の前4走＋BAKEN LAB蓄積統計',
      'walk_forward',true,'popularity_used',false,'odds_used',false
    ),
    'JRA_LIVE_BETA_0.1',now()
  from scored s;

  with ordered as (
    select
      e.*,
      row_number() over (
        partition by e.live_race_id
        order by
          case e.data_status when 'RANKED' then 0 when 'REFERENCE' then 1 else 2 end,
          e.lab_score desc nulls last,e.horse_no
      ) as internal_pos
    from public.jra_live_rank_entries e
    where e.lab_score is not null and e.live_race_id=p_race_id
  ),
  triggers as (
    select o.*,
      (
        (case when o.recent_score>=65 and o.history_n>=2 then 1 else 0 end)+
        (case when o.exact_score>=60 and coalesce((o.components->'exact'->>'n')::int,0)>=2 then 1 else 0 end)+
        (case when o.distance_score>=62 and coalesce((o.components->'distance'->>'n')::int,0)>=2 then 1 else 0 end)+
        (case when o.going_score>=62 and coalesce((o.components->'going'->>'n')::int,0)>=2 then 1 else 0 end)+
        (case when o.transition_score>=62 and coalesce((o.components->'transition'->>'n')::numeric,0)>=10 then 1 else 0 end)+
        (case when o.jockey_score>=65 and coalesce((o.components->'jockey'->>'n')::numeric,0)>=20 then 1 else 0 end)
      )::int as trigger_count,
      greatest(coalesce(o.recent_score,0),coalesce(o.exact_score,0),coalesce(o.distance_score,0),
               coalesce(o.going_score,0),coalesce(o.transition_score,0),coalesce(o.jockey_score,0)) as strongest,
      array_to_string(array_remove(array[
        case when o.recent_score>=65 and o.history_n>=2 then '近走内容' end,
        case when o.exact_score>=60 and coalesce((o.components->'exact'->>'n')::int,0)>=2 then '同競馬場×同距離' end,
        case when o.distance_score>=62 and coalesce((o.components->'distance'->>'n')::int,0)>=2 then '同距離適性' end,
        case when o.going_score>=62 and coalesce((o.components->'going'->>'n')::int,0)>=2 then '馬場適性' end,
        case when o.transition_score>=62 and coalesce((o.components->'transition'->>'n')::numeric,0)>=10 then '条件替わり' end,
        case when o.jockey_score>=65 and coalesce((o.components->'jockey'->>'n')::numeric,0)>=20 then '騎手相性' end
      ],null),' / ') as reason
    from ordered o
    where o.internal_pos>5
  ),
  eligible as (
    select t.*,
      row_number() over(partition by t.live_race_id order by t.trigger_count desc,t.strongest desc,t.lab_score desc,t.horse_no) as pick
    from triggers t
    where t.trigger_count>=2
  )
  update public.jra_live_rank_entries e
  set lab_eye=true,lab_eye_trigger_count=x.trigger_count,lab_eye_reason=x.reason
  from eligible x
  where e.live_runner_id=x.live_runner_id and x.pick=1;
end;
$function$
