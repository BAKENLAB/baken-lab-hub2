CREATE OR REPLACE FUNCTION private.jra_segmented_diagnosis_score(segment text, today_ability numeric, win_power numeric, top3_stability numeric, pace_fit numeric, change_score numeric, class_delta smallint, days_since_last integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  with w as (
    select *
    from (
      values
        ('NEW'::text,         0.65::numeric,0.00::numeric,0.00::numeric,0.10::numeric,0.25::numeric),
        ('MAIDEN'::text,      0.38::numeric,0.17::numeric,0.15::numeric,0.12::numeric,0.18::numeric),
        ('CLASS1'::text,      0.32::numeric,0.18::numeric,0.25::numeric,0.15::numeric,0.10::numeric),
        ('CLASS2_3'::text,    0.36::numeric,0.22::numeric,0.20::numeric,0.12::numeric,0.10::numeric),
        ('OPEN_GRADED'::text, 0.40::numeric,0.25::numeric,0.15::numeric,0.10::numeric,0.10::numeric),
        ('STANDARD'::text,    0.45::numeric,0.20::numeric,0.15::numeric,0.10::numeric,0.10::numeric)
    ) as x(segment,w_ability,w_win,w_top3,w_pace,w_change)
    where x.segment=coalesce(jra_segmented_diagnosis_score.segment,'STANDARD')
    union all
    select 'STANDARD',0.45,0.20,0.15,0.10,0.10
    where not exists (
      select 1
      from (
        values ('NEW'),('MAIDEN'),('CLASS1'),('CLASS2_3'),('OPEN_GRADED'),('STANDARD')
      ) v(s)
      where v.s=coalesce(jra_segmented_diagnosis_score.segment,'STANDARD')
    )
    limit 1
  ),
  calc as (
    select
      coalesce(today_ability*w_ability,0)
      + coalesce(win_power*w_win,0)
      + coalesce(top3_stability*w_top3,0)
      + coalesce(pace_fit*w_pace,0)
      + coalesce(change_score*w_change,0) as num,
      (case when today_ability is not null then w_ability else 0 end)
      + (case when win_power is not null then w_win else 0 end)
      + (case when top3_stability is not null then w_top3 else 0 end)
      + (case when pace_fit is not null then w_pace else 0 end)
      + (case when change_score is not null then w_change else 0 end) as den
    from w
  )
  select case
    when den>0 then
      num/den
      - case when coalesce(class_delta,0)>0 and coalesce(days_since_last,0)>120 then 7 else 0 end
    else null
  end
  from calc;
$function$
