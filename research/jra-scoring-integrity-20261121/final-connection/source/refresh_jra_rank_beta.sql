CREATE OR REPLACE FUNCTION private.refresh_jra_rank_beta()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  truncate table public.jra_rank_beta_entries;

  insert into public.jra_rank_beta_entries (
    target_run_id,race_id,race_date,track,race_no,horse_no,horse_name,horse_ref,jockey,
    history_n,available_components,
    recent_score,exact_score,distance_score,track_score,going_score,
    transition_score,pace_score,jockey_score,
    lab_score,overall_grade,strong_count,position_confidence,data_status,
    components,model_version,generated_at
  )
  with base0 as (
    select
      x.id as run_id,x.race_id,x.horse_no,x.horse_name,x.horse_ref,x.jockey,
      x.finish,x.final3f_quality,x.early_pos,x.final_turn_pos,x.pos_change,
      r.race_date,r.track,r.race_no,r.surface,r.distance,
      coalesce(nullif(r.going,''),'不明') as going,
      r.field_size,
      case
        when x.finish is not null and r.field_size is not null and r.field_size>1
          then greatest(0,least(100,100.0*(r.field_size-x.finish)/(r.field_size-1)))
      end as finish_score,
      case
        when x.final_turn_pos is not null and r.field_size is not null and r.field_size>1
          then greatest(0,least(100,100.0*(r.field_size-x.final_turn_pos)/(r.field_size-1)))
      end as turn_score,
      case
        when x.pos_change is not null
          then greatest(0,least(100,50.0+x.pos_change*7.0))
      end as move_score
    from public.jra_lab_runs x
    join public.jra_lab_races r on r.id=x.race_id
    where x.record_role='full_runner'
      and coalesce(r.race_type,'平地')='平地'
  ),
  base as (
    select b.*,
      case when
        (case when b.finish_score is not null then 0.48 else 0 end)+
        (case when b.final3f_quality is not null then 0.30 else 0 end)+
        (case when b.turn_score is not null then 0.12 else 0 end)+
        (case when b.move_score is not null then 0.10 else 0 end) > 0
      then (
        coalesce(b.finish_score*0.48,0)+
        coalesce(b.final3f_quality*0.30,0)+
        coalesce(b.turn_score*0.12,0)+
        coalesce(b.move_score*0.10,0)
      ) / (
        (case when b.finish_score is not null then 0.48 else 0 end)+
        (case when b.final3f_quality is not null then 0.30 else 0 end)+
        (case when b.turn_score is not null then 0.12 else 0 end)+
        (case when b.move_score is not null then 0.10 else 0 end)
      ) end as run_quality
    from base0 b
  ),
  hist_pairs as (
    select
      t.run_id as target_run_id,
      p.run_id as prior_run_id,
      p.race_date,p.track,p.race_no,p.surface,p.distance,p.going,p.field_size,
      p.run_quality,p.early_pos,
      row_number() over (
        partition by t.run_id
        order by p.race_date desc,p.track,p.race_no desc
      ) as rn
    from base t
    join base p
      on p.race_date<t.race_date
     and (
       (t.horse_ref is not null and p.horse_ref is not null and p.horse_ref=t.horse_ref)
       or p.horse_name=t.horse_name
     )
  ),
  hist as (
    select
      hp.target_run_id,
      count(*)::int as history_n,
      avg(hp.run_quality) filter (where hp.rn<=5) as recent_raw,
      stddev_pop(hp.run_quality) filter (where hp.rn<=5) as recent_sd,
      avg(hp.early_pos::numeric/nullif(hp.field_size,0))
        filter (where hp.rn<=5 and hp.early_pos is not null) as recent_early_ratio,

      count(*) filter (
        where hp.track=t.track and hp.surface=t.surface and hp.distance=t.distance
      )::int as exact_n,
      avg(hp.run_quality) filter (
        where hp.track=t.track and hp.surface=t.surface and hp.distance=t.distance
      ) as exact_raw,

      count(*) filter (
        where hp.surface=t.surface and hp.distance=t.distance
      )::int as distance_n,
      avg(hp.run_quality) filter (
        where hp.surface=t.surface and hp.distance=t.distance
      ) as distance_raw,

      count(*) filter (
        where hp.track=t.track and hp.surface=t.surface
      )::int as track_n,
      avg(hp.run_quality) filter (
        where hp.track=t.track and hp.surface=t.surface
      ) as track_raw,

      count(*) filter (
        where hp.surface=t.surface and hp.going=t.going
      )::int as going_n,
      avg(hp.run_quality) filter (
        where hp.surface=t.surface and hp.going=t.going
      ) as going_raw,

      max(hp.track) filter (where hp.rn=1) as prev_track,
      max(hp.surface) filter (where hp.rn=1) as prev_surface,
      max(hp.distance) filter (where hp.rn=1) as prev_distance,
      max(hp.going) filter (where hp.rn=1) as prev_going
    from hist_pairs hp
    join base t on t.run_id=hp.target_run_id
    group by hp.target_run_id
  ),
  transition as (
    select t.run_id as target_run_id,
      sum(s.runners)::numeric as n,
      sum(s.wins)::numeric as wins,
      sum(s.top3s)::numeric as top3s
    from base t
    join hist h on h.target_run_id=t.run_id
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
    group by t.run_id
  ),
  jockey_stats as (
    select t.run_id as target_run_id,
      sum(s.runners)::numeric as n,
      sum(s.wins)::numeric as wins,
      sum(s.top3s)::numeric as top3s
    from base t
    join public.jra_jockey_daily_stats s
      on s.race_date<t.race_date
     and s.track=t.track
     and s.jockey=regexp_replace(t.jockey,'^[△▲☆★◇]','')
    group by t.run_id
  ),
  condition_stats as (
    select t.run_id as target_run_id,
      sum(s.runners)::numeric as n,
      sum(s.top3s)::numeric as top3s,
      sum(s.front_runners)::numeric as front_n,
      sum(s.front_top3s)::numeric as front_top3s
    from base t
    join public.jra_condition_daily_stats s
      on s.race_date<t.race_date
     and s.track=t.track
     and s.surface=t.surface
     and s.distance=t.distance
     and s.going=t.going
    group by t.run_id
  ),
  comps as (
    select
      t.*,
      coalesce(h.history_n,0) as history_n,
      h.recent_sd,h.recent_early_ratio,
      coalesce(h.exact_n,0) as exact_n,
      coalesce(h.distance_n,0) as distance_n,
      coalesce(h.track_n,0) as track_n,
      coalesce(h.going_n,0) as going_n,

      case when h.recent_raw is not null
        then greatest(0,least(100,h.recent_raw)) end as recent_score,
      case when h.exact_raw is not null
        then greatest(0,least(100,50+(h.exact_raw-50)*h.exact_n::numeric/(h.exact_n+2.0))) end as exact_score,
      case when h.distance_raw is not null
        then greatest(0,least(100,50+(h.distance_raw-50)*h.distance_n::numeric/(h.distance_n+3.0))) end as distance_score,
      case when h.track_raw is not null
        then greatest(0,least(100,50+(h.track_raw-50)*h.track_n::numeric/(h.track_n+3.0))) end as track_score,
      case when h.going_raw is not null
        then greatest(0,least(100,50+(h.going_raw-50)*h.going_n::numeric/(h.going_n+4.0))) end as going_score,

      case when tr.n>0 then greatest(0,least(100,
        50+(greatest(15,least(90,25+110*(tr.top3s/tr.n)+30*(tr.wins/tr.n)))-50)*tr.n/(tr.n+20.0)
      )) end as transition_score,

      case when js.n>0 then greatest(0,least(100,
        50+(greatest(15,least(90,25+110*(js.top3s/js.n)+30*(js.wins/js.n)))-50)*js.n/(js.n+30.0)
      )) end as jockey_score,

      case when cs.n>0 and cs.front_n>0 and h.recent_early_ratio is not null then
        greatest(20,least(80,
          50+case
            when h.recent_early_ratio<=0.35
              then ((cs.front_top3s/cs.front_n)-(cs.top3s/cs.n))*120
            else -((cs.front_top3s/cs.front_n)-(cs.top3s/cs.n))*70
          end
        ))
      end as pace_score,

      coalesce(tr.n,0) as transition_n,
      coalesce(js.n,0) as jockey_n,
      coalesce(cs.n,0) as condition_n
    from base t
    left join hist h on h.target_run_id=t.run_id
    left join transition tr on tr.target_run_id=t.run_id
    left join jockey_stats js on js.target_run_id=t.run_id
    left join condition_stats cs on cs.target_run_id=t.run_id
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
        (case when c.pace_score is not null then 1 else 0 end)+
        (case when c.jockey_score is not null then 1 else 0 end)
      )::int as available_components,
      (
        coalesce(c.recent_score*0.30,0)+
        coalesce(c.exact_score*0.17,0)+
        coalesce(c.distance_score*0.12,0)+
        coalesce(c.track_score*0.08,0)+
        coalesce(c.going_score*0.07,0)+
        coalesce(c.transition_score*0.12,0)+
        coalesce(c.pace_score*0.07,0)+
        coalesce(c.jockey_score*0.07,0)
      ) as weighted_sum,
      (
        (case when c.recent_score is not null then 0.30 else 0 end)+
        (case when c.exact_score is not null then 0.17 else 0 end)+
        (case when c.distance_score is not null then 0.12 else 0 end)+
        (case when c.track_score is not null then 0.08 else 0 end)+
        (case when c.going_score is not null then 0.07 else 0 end)+
        (case when c.transition_score is not null then 0.12 else 0 end)+
        (case when c.pace_score is not null then 0.07 else 0 end)+
        (case when c.jockey_score is not null then 0.07 else 0 end)
      ) as weight_sum
    from comps c
  ),
  scored0 as (
    select w.*,
      case when w.weight_sum>0
        then greatest(0,least(100,w.weighted_sum/w.weight_sum)) end as score,
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
        (case when w.pace_score>=62 then 1 else 0 end)+
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
        when s.history_n>=5 and coalesce(s.recent_sd,99)<=12 then 'S'
        when s.history_n>=4 and coalesce(s.recent_sd,99)<=18 then 'A'
        when s.history_n>=3 and coalesce(s.recent_sd,99)<=25 then 'B'
        when s.history_n>=2 then 'C'
        else null
      end as position_confidence
    from scored0 s
  )
  select
    s.run_id,s.race_id,s.race_date,s.track,s.race_no,s.horse_no,s.horse_name,s.horse_ref,
    regexp_replace(s.jockey,'^[△▲☆★◇]',''),
    s.history_n,s.available_components,
    round(s.recent_score::numeric,2),
    round(s.exact_score::numeric,2),
    round(s.distance_score::numeric,2),
    round(s.track_score::numeric,2),
    round(s.going_score::numeric,2),
    round(s.transition_score::numeric,2),
    round(s.pace_score::numeric,2),
    round(s.jockey_score::numeric,2),
    round(s.score::numeric,2),
    s.overall_grade,s.strong_count,s.position_confidence,s.data_status,
    jsonb_build_object(
      'recent',jsonb_build_object('score',round(s.recent_score::numeric,2),'history_n',s.history_n,'recent_sd',round(s.recent_sd::numeric,2)),
      'exact',jsonb_build_object('score',round(s.exact_score::numeric,2),'n',s.exact_n),
      'distance',jsonb_build_object('score',round(s.distance_score::numeric,2),'n',s.distance_n),
      'track',jsonb_build_object('score',round(s.track_score::numeric,2),'n',s.track_n),
      'going',jsonb_build_object('score',round(s.going_score::numeric,2),'n',s.going_n),
      'transition',jsonb_build_object('score',round(s.transition_score::numeric,2),'n',s.transition_n),
      'pace',jsonb_build_object('score',round(s.pace_score::numeric,2),'condition_n',s.condition_n,'recent_early_ratio',round(s.recent_early_ratio::numeric,3)),
      'jockey',jsonb_build_object('score',round(s.jockey_score::numeric,2),'n',s.jockey_n),
      'weights',jsonb_build_object(
        'recent',0.30,'exact',0.17,'distance',0.12,'track',0.08,
        'going',0.07,'transition',0.12,'pace',0.07,'jockey',0.07
      ),
      'walk_forward',true,
      'popularity_used',false,
      'odds_used',false
    ),
    'JRA_BETA_0.1',
    now()
  from scored s;
end;
$function$
