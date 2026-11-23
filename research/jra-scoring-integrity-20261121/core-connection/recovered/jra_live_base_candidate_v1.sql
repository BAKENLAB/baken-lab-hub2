CREATE OR REPLACE FUNCTION public.jra_live_base_candidate_v1(p_race_date date, p_track text, p_race_no integer)
 RETURNS TABLE(live_runner_id uuid, live_race_id uuid, horse_no integer, horse_name text, jockey text, segment text, recent_n4 integer, recent_top3_count4 integer, recent_avg_margin4 numeric, margin_band text, base_rate numeric, base_rank integer, same_class_close4 integer, near_distance_close4 integer, same_track_close4 integer, residual_fit_count integer, new_eye boolean, new_eye_reasons jsonb, data_status text, model_version text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
with race as (
  select
    r.id,
    r.race_date,
    r.track,
    r.race_no,
    r.race_name,
    r.class_name,
    r.surface,
    r.distance,
    private.jra_model_segment(r.class_name,r.race_name) as segment,
    private.jra_class_level(r.class_name) as class_level
  from public.jra_live_races r
  where r.race_date=p_race_date
    and r.track=p_track
    and r.race_no=p_race_no
    and coalesce(r.race_type,'')<>'障害'
  limit 1
),
runner_hist as (
  select
    lr.id as live_runner_id,
    lr.live_race_id,
    lr.horse_no::int,
    lr.horse_name,
    lr.jockey,
    rc.segment,
    rc.class_level,
    rc.track,
    rc.surface,
    rc.distance,
    count(h.rn)::int as recent_n4,
    count(*) filter(where h.finish<=3)::int as recent_top3_count4,
    avg(h.margin_to_winner)::numeric as recent_avg_margin4,
    count(*) filter(
      where h.margin_to_winner<=1.0
        and private.jra_model_segment(h.prior_class,h.prior_class)=rc.segment
        and private.jra_class_level(h.prior_class)=rc.class_level
    )::int as same_class_close4,
    count(*) filter(
      where h.margin_to_winner<=1.0
        and h.prior_surface=rc.surface
        and abs(h.prior_distance-rc.distance)<=200
    )::int as near_distance_close4,
    count(*) filter(
      where h.margin_to_winner<=1.0
        and h.prior_track=rc.track
        and h.prior_surface=rc.surface
    )::int as same_track_close4
  from race rc
  join public.jra_live_runners lr on lr.live_race_id=rc.id
  left join lateral private.jra_merged_flat_history_v2(
    lr.horse_name,
    lr.horse_ref,
    rc.race_date,
    lr.past_runs,
    4
  ) h on true
  group by
    lr.id,lr.live_race_id,lr.horse_no,lr.horse_name,lr.jockey,
    rc.segment,rc.class_level,rc.track,rc.surface,rc.distance
),
features as (
  select
    h.*,
    case
      when h.recent_avg_margin4 is null then null
      when h.recent_avg_margin4<=0.5 then 'M0_05'
      when h.recent_avg_margin4<=1.0 then 'M06_10'
      when h.recent_avg_margin4<=2.0 then 'M11_20'
      else 'M20_PLUS'
    end as margin_band,
    (
      (h.same_class_close4>=1)::int+
      (h.near_distance_close4>=1)::int+
      (h.same_track_close4>=1)::int
    )::int as residual_fit_count
  from runner_hist h
),
scored as (
  select
    f.*,
    case
      when f.segment not in ('MAIDEN','CLASS1','CLASS2_3','OPEN_GRADED') then null
      when f.recent_n4<1 or f.recent_avg_margin4 is null then null
      when exact.runners>=100 then exact.top3_rate
      else fallback.top3_rate
    end as base_rate,
    case
      when f.segment not in ('MAIDEN','CLASS1','CLASS2_3','OPEN_GRADED') then 'UNSUPPORTED_SEGMENT'
      when f.recent_n4<1 or f.recent_avg_margin4 is null then 'NO_FLAT_HISTORY'
      else 'RANKED'
    end as data_status
  from features f
  left join private.jra_base_core_stats_v1 exact
    on exact.segment=f.segment
   and exact.recent_top3_count4=f.recent_top3_count4
   and exact.margin_band=f.margin_band
   and exact.training_from=date '2025-01-01'
   and exact.training_to=date '2025-12-31'
  left join private.jra_base_core_fallback_stats_v1 fallback
    on fallback.segment=f.segment
   and fallback.recent_top3_count4=f.recent_top3_count4
   and fallback.training_from=date '2025-01-01'
   and fallback.training_to=date '2025-12-31'
),
ranked0 as (
  select
    s.*,
    case
      when s.base_rate is null then null
      else row_number() over(
        partition by s.live_race_id
        order by s.base_rate desc nulls last,
                 s.recent_avg_margin4 asc nulls last,
                 s.horse_no asc
      )::int
    end as base_rank
  from scored s
),
eye_candidates as (
  select
    r.live_runner_id,
    row_number() over(
      partition by r.live_race_id
      order by r.residual_fit_count desc,
               r.base_rank asc,
               r.recent_avg_margin4 asc nulls last,
               r.horse_no asc
    ) as eye_order
  from ranked0 r
  where r.segment='MAIDEN'
    and r.base_rank>=6
    and r.residual_fit_count>=2
)
select
  r.live_runner_id,
  r.live_race_id,
  r.horse_no,
  r.horse_name,
  r.jockey,
  r.segment,
  r.recent_n4,
  r.recent_top3_count4,
  round(r.recent_avg_margin4,3),
  r.margin_band,
  round(r.base_rate,6),
  r.base_rank,
  r.same_class_close4,
  r.near_distance_close4,
  r.same_track_close4,
  r.residual_fit_count,
  coalesce(e.eye_order=1,false) as new_eye,
  case when e.eye_order=1 then
    to_jsonb(array_remove(array[
      case when r.same_class_close4>=1 then '同クラス1秒以内' end,
      case when r.near_distance_close4>=1 then '近距離帯1秒以内' end,
      case when r.same_track_close4>=1 then '同競馬場1秒以内' end
    ],null))
  else '[]'::jsonb end as new_eye_reasons,
  r.data_status,
  'JRA_BASE_CORE_0.1_AB'::text as model_version
from ranked0 r
left join eye_candidates e on e.live_runner_id=r.live_runner_id
order by r.base_rank nulls last,r.horse_no;
$function$
