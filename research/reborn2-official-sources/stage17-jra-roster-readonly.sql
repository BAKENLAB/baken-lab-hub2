BEGIN READ ONLY;
WITH t AS (
 SELECT id,race_key,cname,race_date,track,race_no,surface,distance,going,class_name,course_text,course_layout,turn,field_size,source_checked_at,updated_at,
 (race_date::text||' '||replace(replace(post_time,'時',':'),'分','')||':00+09')::timestamptz post_at
 FROM public.jra_live_races WHERE race_date='2026-11-23' AND track='東京' AND race_no=12
)
SELECT t.id AS target_row_id,t.race_key,t.cname,t.race_date,t.track,t.race_no,t.surface,t.distance,t.going,t.class_name,t.course_text,t.course_layout,t.turn,t.field_size,t.source_checked_at,t.updated_at,t.post_at,
 (SELECT jsonb_agg(jsonb_build_object('card_row_id',h.id,'current_no',h.horse_no,'horse_id_candidate',substring(h.horse_ref from 'CNAME=pw01dud[01]0([0-9]{10})/'),'source_ref',h.horse_ref,'source_checked_at',h.source_checked_at,'updated_at',h.updated_at,'observations',jsonb_build_object('draw',h.draw,'weight_kg',h.weight_carried,'sex_age',h.sex_age,'body_weight_kg',h.body_weight,'body_weight_change',h.body_weight_diff,'equipment',h.equipment)) ORDER BY h.horse_no)
 FROM public.jra_live_runners h WHERE h.live_race_id=t.id AND h.source_checked_at<t.post_at AND h.updated_at<t.post_at) AS roster
FROM t WHERE t.source_checked_at<t.post_at AND t.updated_at<t.post_at;
ROLLBACK;
