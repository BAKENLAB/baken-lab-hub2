-- Read-only target condition witness, fixed historical JRA sample, no market or result.
SELECT r.race_date AS target_date,r.track,r.race_no,r.surface,r.distance,r.going,r.class_name,r.course_layout,r.turn,r.race_type,r.field_size,r.source_checked_at AS cutoff,
 (r.race_date::text||' '||replace(replace(r.post_time,'時',':'),'分','')||':00+09')::timestamptz AS post_at,
 (SELECT jsonb_agg(jsonb_build_object('horse_no',h.horse_no,'horse_ref',h.horse_ref,'source_checked_at',h.source_checked_at,'weight_carried',h.weight_carried,'sex_age',h.sex_age) ORDER BY h.horse_no) FROM public.jra_live_runners h WHERE h.live_race_id=r.id) AS roster
 FROM public.jra_live_races r WHERE r.race_date='2026-11-23' AND r.track='東京' AND r.race_no=12;