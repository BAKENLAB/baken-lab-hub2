CREATE OR REPLACE FUNCTION private.refresh_jra_live_diagnosis_rebuild03()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
begin

  delete from public.jra_live_diagnosis_entries
  where race_date < ((now() at time zone 'Asia/Tokyo')::date);

  delete from public.jra_live_diagnosis_entries d
  using public.jra_live_races r
  where d.live_race_id=r.id
    and r.race_date=((now() at time zone 'Asia/Tokyo')::date)
    and (
    lpad(
      split_part(replace(replace(coalesce(r.post_time,'23時59分'),'時',':'),'分',''),':',1),
      2,'0'
    )
    || ':' ||
    lpad(
      split_part(replace(replace(coalesce(r.post_time,'23時59分'),'時',':'),'分',''),':',2),
      2,'0'
    )
  )::time > (now() at time zone 'Asia/Tokyo')::time;


  insert into public.jra_live_diagnosis_entries (
    live_runner_id,live_race_id,race_date,track,race_no,horse_no,horse_name,jockey,
    history_n,base_lab_score,base_data_status,
    today_ability_score,win_power_score,top3_stability_score,pace_fit_score,change_score,
    diagnosis_score,diagnosis_grade,data_status,
    running_style,pace_pressure,front_count,days_since_last,class_delta,distance_delta,
    weight_delta,jockey_changed,surface_changed,hidden_merit,
    internal_order,audit_trigger_count,lab_eye,lab_eye_reason,win_path,
    boost_flags,risk_flags,diagnostics,model_version,generated_at
  )
  with target as (
    select
      lr.id as live_runner_id, lr.live_race_id, lr.horse_no, lr.horse_name,
      lr.jockey, lr.weight_carried, lr.body_weight_diff, lr.equipment, lr.past_runs,
      r.race_date, r.track, r.race_no, r.race_name, r.class_name, r.surface, r.distance, r.turn,
      coalesce(nullif(r.going,''),'不明') as going, r.field_size,
      e.lab_score as base_lab_score, e.data_status as base_data_status,
      e.recent_score, e.exact_score, e.distance_score, e.track_score,
      e.going_score, e.transition_score, e.jockey_score
    from public.jra_live_runners lr
    join public.jra_live_races r on r.id=lr.live_race_id
    left join public.jra_live_rank_entries e on e.live_runner_id=lr.id
    where coalesce(r.race_type,'平地')='平地'
      and (
        r.race_date > ((now() at time zone 'Asia/Tokyo')::date)
        or (
          r.race_date=((now() at time zone 'Asia/Tokyo')::date)
          and (
    lpad(
      split_part(replace(replace(coalesce(r.post_time,'23時59分'),'時',':'),'分',''),':',1),
      2,'0'
    )
    || ':' ||
    lpad(
      split_part(replace(replace(coalesce(r.post_time,'23時59分'),'時',':'),'分',''),':',2),
      2,'0'
    )
  )::time > (now() at time zone 'Asia/Tokyo')::time
        )
      )
  ),
  past0 as (
    select
      t.live_runner_id,
      private.jra_class_level(t.class_name) as current_class_level,
      p.ord::int as rn,
      nullif(p.run->>'race_date','')::date as prior_date,
      nullif(p.run->>'surface','') as prior_surface,
      nullif(p.run->>'distance','')::int as prior_distance,
      nullif(p.run->>'finish','')::int as finish,
      nullif(p.run->>'field_size','')::int as field_size,
      nullif(p.run->>'margin_to_winner','')::numeric as margin_to_winner,
      nullif(p.run->>'weight_carried','')::numeric as weight_carried,
      nullif(p.run->>'jockey','') as jockey,
      nullif(p.run->>'early_pos','')::numeric as early_pos,
      nullif(p.run->>'pos_change','')::numeric as pos_change,
      coalesce(hr.class_name,nullif(p.run->>'race_class_detail',''),nullif(p.run->>'race_class','')) as prior_class
    from target t
    cross join lateral jsonb_array_elements(private.jra_flat_past_runs(t.past_runs)) with ordinality as p(run,ord)
    left join public.jra_lab_races hr
      on hr.source_ref=regexp_replace(coalesce(p.run->>'source_ref',''),'^.*CNAME=','')
  ),
  past as (
    select
      p.*,
      private.jra_class_level(p.prior_class) as prior_class_level,
      case
        when p.finish is not null and p.field_size is not null and p.field_size>1 then
          greatest(0,least(100,
            (100.0*(p.field_size-p.finish)/(p.field_size-1))*0.75
            + greatest(0,least(100,100.0*(1-least(coalesce(p.margin_to_winner,5)/5.0,1))))*0.25
          ))
      end as run_quality,
      case
        when p.early_pos is not null and p.field_size is not null and p.field_size>0
          then p.early_pos/p.field_size
      end as early_ratio
    from past0 p
  ),
  hist as (
    select
      t.live_runner_id,
      count(p.rn)::int as history_n,
      avg(p.run_quality) filter(where p.rn<=4) as recent_quality,
      stddev_pop(p.run_quality) filter(where p.rn<=4) as recent_sd,
      avg(p.early_ratio) filter(where p.rn<=4 and p.early_ratio is not null) as avg_early_ratio,
      avg(case when p.finish between 1 and 3 then 1.0 else 0.0 end)
        filter(where p.rn<=4 and p.finish is not null) as top3_rate,
      avg(case when p.finish=1 then 1.0 else 0.0 end)
        filter(where p.rn<=4 and p.finish is not null) as win_rate,
      avg(greatest(0,least(100,100-20*coalesce(p.margin_to_winner,5))))
        filter(where p.rn<=4) as closeness_score,
      max(p.prior_date) filter(where p.rn=1) as last_date,
      max(p.prior_surface) filter(where p.rn=1) as last_surface,
      max(p.prior_distance) filter(where p.rn=1) as last_distance,
      max(p.prior_class_level) filter(where p.rn=1) as last_class_level,
      max(p.prior_class) filter(where p.rn=1) as last_class,
      max(p.finish) filter(where p.rn=1) as last_finish,
      max(p.weight_carried) filter(where p.rn=1) as last_weight_carried,
      max(p.jockey) filter(where p.rn=1) as last_jockey,
      max(p.margin_to_winner) filter(where p.rn=1) as last_margin_to_winner,
      avg(p.run_quality) filter(where p.rn between 2 and 4) as prior_quality_without_last,
      count(*) filter(
        where p.rn between 2 and 4
          and p.margin_to_winner is not null
          and p.margin_to_winner<=1.0
      )::int as prior_close_runs,
      count(*) filter(
        where p.rn<=4
          and p.margin_to_winner is not null
          and p.margin_to_winner<=1.0
          and p.prior_class_level=p.current_class_level
      )::int as same_class_close_runs,
      avg(p.run_quality) filter(
        where p.rn<=4
          and p.margin_to_winner is not null
          and p.margin_to_winner<=1.0
          and p.prior_class_level=p.current_class_level
      ) as same_class_close_quality,
      bool_or(
        (p.finish>=5 and p.margin_to_winner is not null and p.margin_to_winner<=0.8)
        or coalesce(p.pos_change,0)>=2
      ) filter(where p.rn<=4) as hidden_merit
    from target t
    left join past p on p.live_runner_id=t.live_runner_id
    group by t.live_runner_id
  ),
  styled as (
    select
      t.*,
      coalesce(h.history_n,0) as history_n,
      h.recent_quality,h.recent_sd,h.avg_early_ratio,h.top3_rate,h.win_rate,h.closeness_score,
      h.last_date,h.last_surface,h.last_distance,h.last_class_level,h.last_class,h.last_finish,
      h.last_weight_carried,h.last_jockey,
      h.last_margin_to_winner,h.prior_quality_without_last,h.prior_close_runs,
      h.same_class_close_runs,h.same_class_close_quality,
      coalesce(h.hidden_merit,false) as hidden_merit,
      case
        when h.avg_early_ratio is null then 'UNKNOWN'
        when h.avg_early_ratio<=0.35 then 'FRONT'
        when h.avg_early_ratio<=0.65 then 'MID'
        else 'CLOSER'
      end as running_style
    from target t
    left join hist h on h.live_runner_id=t.live_runner_id
  ),
  field_profile as (
    select
      s.live_race_id,
      count(*) filter(where s.running_style='FRONT')::int as front_count,
      count(*) filter(where s.running_style<>'UNKNOWN')::int as style_known
    from styled s
    group by s.live_race_id
  ),
  condition_bias as (
    select
      t.live_runner_id,
      sum(s.runners)::numeric as n,
      sum(s.top3s)::numeric as top3s,
      sum(s.front_runners)::numeric as front_n,
      sum(s.front_top3s)::numeric as front_top3s
    from target t
    join public.jra_condition_daily_stats s
      on s.race_date<t.race_date
     and s.track=t.track
     and s.surface=t.surface
     and s.distance=t.distance
     and (t.going='不明' or s.going=t.going)
    group by t.live_runner_id
  ),
  prep as (
    select
      s.*,
      fp.front_count,
      case
        when fp.style_known=0 then 'UNKNOWN'
        when fp.front_count>=greatest(3,ceil(s.field_size*0.30)::int) then 'HIGH'
        when fp.front_count<=1 then 'LOW'
        else 'MEDIUM'
      end as pace_pressure,
      private.jra_class_level(s.class_name) as current_class_level,
      case when s.last_date is not null then (s.race_date-s.last_date)::int end as days_since_last,
      case when s.last_distance is not null then s.distance-s.last_distance end as distance_delta,
      case when s.weight_carried is not null and s.last_weight_carried is not null
        then s.weight_carried-s.last_weight_carried end as weight_delta,
      case when nullif(s.jockey,'') is not null and nullif(s.last_jockey,'') is not null
        then regexp_replace(s.jockey,'^[△▲☆★◇]','')<>regexp_replace(s.last_jockey,'^[△▲☆★◇]','')
      end as jockey_changed,
      case when s.last_surface is not null then s.surface<>s.last_surface end as surface_changed,
      case when cb.front_n>=10 and cb.n>0
        then (cb.front_top3s/cb.front_n)-(cb.top3s/cb.n) end as front_adv
    from styled s
    join field_profile fp on fp.live_race_id=s.live_race_id
    left join condition_bias cb on cb.live_runner_id=s.live_runner_id
  ),
  parts as (
    select
      p.*,
      case when p.current_class_level is not null and p.last_class_level is not null
        then (p.current_class_level-p.last_class_level)::smallint end as class_delta,

      case
        when p.running_style='UNKNOWN' or p.pace_pressure='UNKNOWN' then null
        else greatest(20,least(80,
          case
            when p.pace_pressure='HIGH' and p.running_style='FRONT' then 42
            when p.pace_pressure='HIGH' and p.running_style='MID' then 55
            when p.pace_pressure='HIGH' and p.running_style='CLOSER' then 65
            when p.pace_pressure='LOW' and p.running_style='FRONT' then 66
            when p.pace_pressure='LOW' and p.running_style='MID' then 54
            when p.pace_pressure='LOW' and p.running_style='CLOSER' then 44
            when p.pace_pressure='MEDIUM' and p.running_style='FRONT' then 52
            when p.pace_pressure='MEDIUM' and p.running_style='MID' then 56
            else 52
          end
          + case
              when p.front_adv is null then 0
              when p.running_style='FRONT' then p.front_adv*90
              when p.running_style='CLOSER' then -p.front_adv*45
              else p.front_adv*20
            end
        ))
      end as pace_fit_score,

      greatest(20,least(80,
        50
        + case
            when p.current_class_level is not null and p.last_class_level is not null
                 and p.current_class_level<p.last_class_level
              then least(16,(p.last_class_level-p.current_class_level)*8)
            when p.current_class_level is not null and p.last_class_level is not null
                 and p.current_class_level>p.last_class_level
              then -least(14,(p.current_class_level-p.last_class_level)*7)
            else 0 end
        + case when p.weight_delta>=2 then -3 when p.weight_delta<=-2 then -1 else 0 end
        + case when p.jockey_changed and p.jockey_score>=60 then 2
               when p.jockey_changed and p.jockey_score<=40 then -2 else 0 end
        + case when coalesce(p.body_weight_diff,0)<=-20 then -6
               when coalesce(p.body_weight_diff,0)<=-10 then -3
               when coalesce(p.body_weight_diff,0)>=20 then -2 else 0 end
        + case when p.days_since_last>140 then -5
               when p.days_since_last>90 then -3
               when p.days_since_last is not null and p.days_since_last<=10 then -2 else 0 end
        + case when abs(coalesce(p.distance_delta,0))>=400 and coalesce(p.distance_score,50)<45 then -5
               when abs(coalesce(p.distance_delta,0))>=400 and coalesce(p.distance_score,50)<62 then -2 else 0 end
        + case when p.surface_changed and p.transition_score is null then -4
               when p.surface_changed and coalesce(p.transition_score,50)<45 then -4
               when p.surface_changed and coalesce(p.transition_score,50)<62 then -2 else 0 end
      )) as change_score,

      case when (
        (case when p.exact_score is not null then 0.22 else 0 end)+
        (case when p.distance_score is not null then 0.18 else 0 end)+
        (case when p.track_score is not null then 0.10 else 0 end)+
        (case when p.going_score is not null then 0.15 else 0 end)+
        (case when p.transition_score is not null then 0.20 else 0 end)+
        (case when p.jockey_score is not null then 0.15 else 0 end)
      )>0 then
        (
          coalesce(p.exact_score*0.22,0)+coalesce(p.distance_score*0.18,0)+
          coalesce(p.track_score*0.10,0)+coalesce(p.going_score*0.15,0)+
          coalesce(p.transition_score*0.20,0)+coalesce(p.jockey_score*0.15,0)
        ) /
        (
          (case when p.exact_score is not null then 0.22 else 0 end)+
          (case when p.distance_score is not null then 0.18 else 0 end)+
          (case when p.track_score is not null then 0.10 else 0 end)+
          (case when p.going_score is not null then 0.15 else 0 end)+
          (case when p.transition_score is not null then 0.20 else 0 end)+
          (case when p.jockey_score is not null then 0.15 else 0 end)
        )
      end as condition_fit_score
    from prep p
  ),
  five as (
    select
      p.*,
      case when p.base_lab_score is not null and p.condition_fit_score is not null
        then greatest(0,least(100,
          (50+(p.base_lab_score-50)*least(1.0,0.45+0.20*p.history_n))*0.55+
          p.condition_fit_score*0.45
        ))
        when p.base_lab_score is not null
          then greatest(0,least(100,50+(p.base_lab_score-50)*least(1.0,0.45+0.20*p.history_n)))
        else p.condition_fit_score end as today_ability_score,
      case when p.history_n>0 then greatest(0,least(100,
        (50+(coalesce(p.recent_score,p.recent_quality,50)-50)*least(1.0,0.45+0.20*p.history_n))*0.55+
        (((coalesce(p.win_rate,0)*p.history_n)+(0.0723*3))/(p.history_n+3))*100*0.20+
        coalesce(p.closeness_score,50)*0.25
      )) end as win_power_score,
      case when p.history_n>0 then greatest(0,least(100,
        (((coalesce(p.top3_rate,0)*p.history_n)+(0.2171*3))/(p.history_n+3))*100*0.70+
        (50+(coalesce(p.recent_quality,50)-50)*least(1.0,0.45+0.20*p.history_n))*0.30
      )) end as top3_stability_score
    from parts p
  ),
  finals as (
    select
      f.*,
      private.jra_segmented_diagnosis_score(
        private.jra_model_segment(f.class_name,f.race_name),
        f.today_ability_score,
        f.win_power_score,
        f.top3_stability_score,
        f.pace_fit_score,
        f.change_score,
        f.class_delta,
        f.days_since_last
      ) as diagnosis_score,
      case
        when f.history_n>=3 and f.base_data_status='RANKED' then 'RANKED'
        when f.history_n>=1 then 'REFERENCE'
        else 'DATA_INSUFFICIENT'
      end as data_status
    from five f
  ),
  fit0 as (
    select
      f.*,
      case when (
        (case when f.exact_score is not null then 0.24 else 0 end)+
        (case when f.distance_score is not null then 0.18 else 0 end)+
        (case when f.track_score is not null then 0.12 else 0 end)+
        (case when f.going_score is not null then 0.10 else 0 end)+
        (case when f.transition_score is not null then 0.18 else 0 end)+
        (case when f.pace_fit_score is not null then 0.10 else 0 end)+
        (case when f.change_score is not null then 0.08 else 0 end)
      )>0 then
        (
          coalesce(f.exact_score*0.24,0)+
          coalesce(f.distance_score*0.18,0)+
          coalesce(f.track_score*0.12,0)+
          coalesce(f.going_score*0.10,0)+
          coalesce(f.transition_score*0.18,0)+
          coalesce(f.pace_fit_score*0.10,0)+
          coalesce(f.change_score*0.08,0)
        ) /
        (
          (case when f.exact_score is not null then 0.24 else 0 end)+
          (case when f.distance_score is not null then 0.18 else 0 end)+
          (case when f.track_score is not null then 0.12 else 0 end)+
          (case when f.going_score is not null then 0.10 else 0 end)+
          (case when f.transition_score is not null then 0.18 else 0 end)+
          (case when f.pace_fit_score is not null then 0.10 else 0 end)+
          (case when f.change_score is not null then 0.08 else 0 end)
        )
      end as eye_fit_raw
    from finals f
  ),
  fitcal as (
    select
      f.*,
      avg(f.eye_fit_raw) over(partition by f.live_race_id) as eye_fit_field_avg
    from fit0 f
  ),
  fitidx as (
    select
      f.*,
      case when f.eye_fit_raw is not null and f.eye_fit_field_avg is not null
        then greatest(0.85,least(1.15,1+(f.eye_fit_raw-f.eye_fit_field_avg)/100.0))
      end as eye_fit_index
    from fitcal f
  ),
  fitgraded as (
    select
      f.*,
      case
        when f.eye_fit_index is null then null
        when f.eye_fit_index>=1.08 then 'S'
        when f.eye_fit_index>=1.05 then 'A'
        when f.eye_fit_index>=1.02 then 'B'
        when f.eye_fit_index>=0.99 then 'C'
        when f.eye_fit_index>=0.96 then 'D'
        when f.eye_fit_index>=0.93 then 'E'
        else 'F'
      end as eye_fit_grade
    from fitidx f
  ),
  ordered as (
    select
      f.*,
      row_number() over(
        partition by f.live_race_id
        order by case when f.data_status='DATA_INSUFFICIENT' then 1 else 0 end,
                 f.diagnosis_score desc nulls last,
                 case f.data_status when 'RANKED' then 0 when 'REFERENCE' then 1 else 2 end,
                 f.horse_no
      )::int as internal_order
    from fitgraded f
  )
  select
    o.live_runner_id,o.live_race_id,o.race_date,o.track,o.race_no,o.horse_no,o.horse_name,
    regexp_replace(coalesce(o.jockey,''),'^[△▲☆★◇]',''),
    o.history_n,round(o.base_lab_score::numeric,2),o.base_data_status,
    round(o.today_ability_score::numeric,2),round(o.win_power_score::numeric,2),
    round(o.top3_stability_score::numeric,2),round(o.pace_fit_score::numeric,2),
    round(o.change_score::numeric,2),round(o.diagnosis_score::numeric,2),
    case
      when o.data_status<>'RANKED' or o.diagnosis_score is null then null
      when o.diagnosis_score>=72 then 'S'
      when o.diagnosis_score>=66 then 'A'
      when o.diagnosis_score>=60 then 'B'
      when o.diagnosis_score>=54 then 'C'
      when o.diagnosis_score>=48 then 'D'
      when o.diagnosis_score>=42 then 'E'
      else 'F'
    end,
    o.data_status,o.running_style,o.pace_pressure,o.front_count,o.days_since_last,o.class_delta,
    o.distance_delta,round(o.weight_delta::numeric,1),o.jockey_changed,o.surface_changed,o.hidden_merit,
    o.internal_order,0,false,null,
    case
      when o.running_style='FRONT' and o.pace_pressure='LOW' then '先行押し切り'
      when o.running_style='CLOSER' and o.pace_pressure='HIGH' then '前崩れ差し'
      when o.running_style='MID' then '好位〜中団から抜け出し'
      when coalesce(o.exact_score,0)>=62 then '同条件適性を生かす'
      when o.hidden_merit then '着順以上の内容から一変'
      when o.class_delta<0 then 'クラス緩和で反撃'
      else '総合力で好走圏'
    end,
    to_jsonb(array_remove(array[
      case when o.class_delta<0 then 'クラス緩和' end,
      case when o.history_n=1 and coalesce(o.last_finish,99)<=6 then '2戦目・初戦内容あり' end,
      case when coalesce(o.exact_score,0)>=62 then '同競馬場×同距離' end,
      case when coalesce(o.distance_score,0)>=65 then '距離適性' end,
      case when coalesce(o.going_score,0)>=62 then '馬場適性' end,
      case when coalesce(o.pace_fit_score,0)>=62 then '展開適合' end,
      case when o.hidden_merit then '着順に隠れた内容' end,
      case when o.jockey_changed and coalesce(o.jockey_score,0)>=60 then '騎手替わりプラス' end
    ],null)),
    to_jsonb(array_remove(array[
      case when o.class_delta>0 and o.days_since_last>120 then '昇級＋長期休養の複合リスク' end,
      case when o.class_delta>0 then '昇級' end,
      case when o.days_since_last>140 then '長期休養明け' end,
      case when coalesce(o.body_weight_diff,0)<=-20 then '馬体重大幅減' end,
      case when coalesce(o.body_weight_diff,0) between -19 and -10 then '馬体重10kg以上減' end,
      case when abs(coalesce(o.distance_delta,0))>=400 then '距離大幅変更・不確実性' end,
      case when o.running_style='FRONT' and o.pace_pressure='HIGH' then '同型多数' end,
      case when o.surface_changed then '芝ダート替わり・不確実性' end,
      case when o.history_n<=2 then '少戦歴・振れ幅大' end,
      case when o.history_n=1 and coalesce(o.last_finish,99)>=7 then '2戦目・初戦7着以下' end,
      case when o.base_data_status='DATA_INSUFFICIENT' then '比較材料不足' end
    ],null)),
    jsonb_build_object(
      'model_segment',private.jra_model_segment(o.class_name,o.race_name),
      'course_context',private.jra_course_context(o.track,o.surface,o.distance,o.turn),
      'condition_fit',round(o.condition_fit_score::numeric,2),
      'recent_quality',round(o.recent_quality::numeric,2),
      'recent_sd',round(o.recent_sd::numeric,2),
      'top3_rate',round(o.top3_rate::numeric,3),
      'win_rate',round(o.win_rate::numeric,3),
      'avg_early_ratio',round(o.avg_early_ratio::numeric,3),
      'front_adv',round(o.front_adv::numeric,3),
      'last_class',o.last_class,
      'current_class',o.class_name,
      'last_finish',o.last_finish,
      'last_surface',o.last_surface,
      'last_distance',o.last_distance,
      'last_jockey',o.last_jockey,
      'last_margin_to_winner',round(o.last_margin_to_winner::numeric,2),
      'prior_quality_without_last',round(o.prior_quality_without_last::numeric,2),
      'prior_close_runs',coalesce(o.prior_close_runs,0),
      'same_class_close_runs',coalesce(o.same_class_close_runs,0),
      'same_class_close_quality',round(o.same_class_close_quality::numeric,2),
      'repeatable_close_signal',(
        coalesce(o.same_class_close_runs,0)>=2
        and coalesce(o.same_class_close_quality,0)>=60
      ),
      'compound_promotion_layoff_penalty',case
        when o.class_delta>0 and o.days_since_last>120 then 7
        else 0 end,
      'main_pick_blocked',(o.class_delta>0 and o.days_since_last>120),
      'main_pick_block_reason',case
        when o.class_delta>0 and o.days_since_last>120 then '昇級＋長期休養明け'
        else null end,
      'outlier_rebound_signal',(
        o.history_n>=4
        and coalesce(o.last_margin_to_winner,0)>=3
        and coalesce(o.prior_close_runs,0)>=2
        and coalesce(o.prior_quality_without_last,0)>=65
        and coalesce(o.class_delta,99)=0
        and not coalesce(o.surface_changed,false)
        and abs(coalesce(o.distance_delta,9999))<=200
      ),
      'equipment',o.equipment,
      'race_mode',case
        when coalesce(o.class_name,'')='新馬' then '新馬モード'
        when coalesce(o.race_name,'') like '2歳未勝利%' then '2歳未勝利モード'
        when coalesce(o.class_name,'')='未勝利' then '未勝利モード'
        when coalesce(o.class_name,'')='1勝クラス' then '1勝クラスモード'
        when coalesce(o.class_name,'')='2勝クラス' then '2勝クラスモード'
        when coalesce(o.class_name,'')='3勝クラス' then '3勝クラスモード'
        when coalesce(o.class_name,'')='オープン' then 'OPEN・重賞モード'
        else '標準モード' end,
      'eye_fit_raw',round(o.eye_fit_raw::numeric,2),
      'eye_fit_field_avg',round(o.eye_fit_field_avg::numeric,2),
      'eye_fit_index',round(o.eye_fit_index::numeric,3),
      'eye_fit_grade',o.eye_fit_grade,
      'eye_fit_rule','同一レース出走馬の適性平均=1.00。人気・オッズ不使用',
      'eye_fit_affects_diag',false,
      'eye_replay_signal',(
        coalesce(o.recent_quality,0)>=68
        and coalesce(o.avg_early_ratio,1)<=0.40
      ),
      'eye_core_support',(
        (case when o.today_ability_score>=60 then 1 else 0 end)+
        (case when o.win_power_score>=60 then 1 else 0 end)+
        (case when o.top3_stability_score>=45 then 1 else 0 end)+
        (case when coalesce(o.eye_fit_grade,'') in ('S','A') then 1 else 0 end)+
        (case when coalesce(o.recent_quality,0)>=68 and coalesce(o.avg_early_ratio,1)<=0.40 then 1 else 0 end)
      ),
      'confidence',case
        when o.history_n>=3 and o.base_data_status='RANKED' and not coalesce(o.surface_changed,false) and abs(coalesce(o.distance_delta,0))<400 then 'HIGH'
        when o.history_n>=2 and not coalesce(o.surface_changed,false) then 'MEDIUM'
        else 'LOW' end,
      'calibrated_win_rate',round((((coalesce(o.win_rate,0)*o.history_n)+(0.0723*3))/(o.history_n+3))::numeric,3),
      'calibrated_top3_rate',round((((coalesce(o.top3_rate,0)*o.history_n)+(0.2171*3))/(o.history_n+3))::numeric,3),
      'calibration_base_runs',44760,
      'popularity_used',false,
      'odds_used',false,
      'walk_forward',true
    ),
    'JRA_REBUILD_0.3_FLAT_HISTORY',now()
  from ordered o;

  with audit as (
    select
      d.*,
      (
        (case when d.today_ability_score>=64 then 1 else 0 end)+
        (case when d.pace_fit_score>=62 then 1 else 0 end)+
        (case when d.change_score>=60 then 1 else 0 end)+
        (case when d.hidden_merit then 1 else 0 end)+
        (case when (d.diagnostics->>'condition_fit')::numeric>=62 then 1 else 0 end)+
        (case when coalesce(d.diagnostics->>'eye_fit_grade','') in ('S','A') then 1 else 0 end)+
        (case when coalesce((d.diagnostics->>'recent_quality')::numeric,0)>=68
                    and coalesce((d.diagnostics->>'avg_early_ratio')::numeric,1)<=0.40
               then 1 else 0 end)+
        (case when coalesce((d.diagnostics->>'outlier_rebound_signal')::boolean,false)
               then 1 else 0 end)+
        (case when coalesce((d.diagnostics->>'repeatable_close_signal')::boolean,false)
               then 1 else 0 end)+
        (case when d.class_delta<0 then 1 else 0 end)+
        (case when d.history_n=1
                    and coalesce(d.diagnostics->>'last_class','') like '%新馬%'
                    and coalesce(d.diagnostics->>'current_class','') like '%未勝利%'
                    and coalesce((d.diagnostics->>'last_finish')::int,99)<=6
               then 1 else 0 end)
      )::int as triggers,
      (
        coalesce((d.diagnostics->>'eye_core_support')::int,0)
        + case when coalesce((d.diagnostics->>'outlier_rebound_signal')::boolean,false) then 2 else 0 end
        + case when coalesce((d.diagnostics->>'repeatable_close_signal')::boolean,false) then 2 else 0 end
      ) as core_support,
      greatest(
        coalesce(d.today_ability_score,0),coalesce(d.pace_fit_score,0),
        coalesce(d.change_score,0),coalesce((d.diagnostics->>'condition_fit')::numeric,0)
      ) as strongest
    from public.jra_live_diagnosis_entries d
    join public.jra_live_races ar on ar.id=d.live_race_id
    where d.internal_order>5
      and d.data_status<>'DATA_INSUFFICIENT'
      and not (coalesce(d.class_delta,0)>0 and coalesce(d.days_since_last,0)>120)
      and (
        ar.race_date > ((now() at time zone 'Asia/Tokyo')::date)
        or (
          ar.race_date=((now() at time zone 'Asia/Tokyo')::date)
          and (
    lpad(
      split_part(replace(replace(coalesce(ar.post_time,'23時59分'),'時',':'),'分',''),':',1),
      2,'0'
    )
    || ':' ||
    lpad(
      split_part(replace(replace(coalesce(ar.post_time,'23時59分'),'時',':'),'分',''),':',2),
      2,'0'
    )
  )::time > (now() at time zone 'Asia/Tokyo')::time
        )
      )
  ),
  eligible as (
    select a.*,
      row_number() over(
        partition by a.live_race_id
        order by a.core_support desc,
                 a.triggers desc,
                 case when coalesce(a.diagnostics->>'eye_fit_grade','')='S' then 0
                      when coalesce(a.diagnostics->>'eye_fit_grade','')='A' then 1 else 2 end,
                 case when a.hidden_merit then 0 else 1 end,
                 a.strongest desc,
                 a.diagnosis_score desc nulls last,
                 a.horse_no
      ) as pick
    from audit a
    where a.triggers>=2
      and (
        a.core_support>=2
        or (
          coalesce((a.diagnostics->>'recent_quality')::numeric,0)>=68
          and coalesce((a.diagnostics->>'avg_early_ratio')::numeric,1)<=0.40
        )
        or (
          a.history_n=1
          and coalesce(a.diagnostics->>'last_class','') like '%新馬%'
          and coalesce(a.diagnostics->>'current_class','') like '%未勝利%'
          and coalesce((a.diagnostics->>'last_finish')::int,99)<=6
        )
        or coalesce((a.diagnostics->>'outlier_rebound_signal')::boolean,false)
        or coalesce((a.diagnostics->>'repeatable_close_signal')::boolean,false)
      )
  )
  update public.jra_live_diagnosis_entries d
  set audit_trigger_count=e.triggers,
      lab_eye=(e.pick=1),
      lab_eye_reason=case when e.pick=1 then array_to_string(array_remove(array[
        case when e.today_ability_score>=64 then '総合順位外でも今日の走力が高い' end,
        case when e.pace_fit_score>=62 then '展開がハマる具体的な筋' end,
        case when e.change_score>=60 then '今回だけの条件変化' end,
        case when e.hidden_merit then '近走着順に隠れた内容' end,
        case when (e.diagnostics->>'condition_fit')::numeric>=62 then '今回条件への適性' end,
        case when coalesce(e.diagnostics->>'eye_fit_grade','') in ('S','A')
          then 'レース内適性上位（'||(e.diagnostics->>'eye_fit_grade')||'｜×'||(e.diagnostics->>'eye_fit_index')||'）' end,
        case when coalesce((e.diagnostics->>'recent_quality')::numeric,0)>=68
                  and coalesce((e.diagnostics->>'avg_early_ratio')::numeric,1)<=0.40
             then '近走内容×前受け再現性' end,
        case when coalesce((e.diagnostics->>'outlier_rebound_signal')::boolean,false)
             then '前走大敗を単発外れ値として再監査' end,
        case when coalesce((e.diagnostics->>'repeatable_close_signal')::boolean,false)
             then '同クラスで1秒以内を複数回・着順以上の再現性' end,
        case when e.class_delta<0 then 'クラス緩和' end,
        case when e.history_n=1
                   and coalesce(e.diagnostics->>'last_class','') like '%新馬%'
                   and coalesce(e.diagnostics->>'current_class','') like '%未勝利%'
                   and coalesce((e.diagnostics->>'last_finish')::int,99)<=6
             then '2戦目・初戦内容が次走につながる帯' end,
        case when coalesce((e.diagnostics->>'last_finish')::int,0)>=8
                   and coalesce(e.diagnostics->>'equipment','') like '%ブリンカー%'
             then '大敗後のブリンカー着用で再浮上余地' end
      ],null),' / ') else null end
  from eligible e
  where d.live_runner_id=e.live_runner_id;
end;
$function$
