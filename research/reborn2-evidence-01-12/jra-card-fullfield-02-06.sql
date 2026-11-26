-- Read-only research replay: JRA card-to-official archive crosscheck.
-- Fixed historical sample; never reads market, previous scores or target result.
WITH t AS (
 SELECT id,race_date,track,race_no,post_time,source_checked_at,(race_date::text||' '||replace(replace(post_time,'時',':'),'分','')||':00+09')::timestamptz AS post_at
 FROM public.jra_live_races WHERE race_date='2026-11-23' AND track='東京' AND race_no=12
), h AS (
 SELECT t.*,h.horse_no,h.horse_ref,h.horse_name,h.source_checked_at AS runner_checked,h.past_runs
 FROM t JOIN public.jra_live_runners h ON h.live_race_id=t.id
 WHERE t.source_checked_at<t.post_at AND h.source_checked_at<t.post_at
), p AS (
 SELECT h.*,j,ord FROM h CROSS JOIN LATERAL jsonb_array_elements(h.past_runs) WITH ORDINALITY p(j,ord)
), a AS (
 SELECT p.*,r.id AS prior_id,r.field_size AS archive_n,r.source_checked_at AS archive_checked,r.course_layout,r.surface AS archive_surface,r.distance AS archive_distance,r.going AS archive_going,r.class_name AS archive_class,
 ar.horse_no AS archive_horse_no,ar.finish AS archive_finish,ar.time_raw AS archive_clock,ar.final3f AS archive_f3,ar.margin AS archive_margin,
 count(r.id) over(partition by p.horse_no,p.ord) AS matches
 FROM p LEFT JOIN public.jra_lab_races r ON r.source_ref=substring(p.j->>'source_ref' from 'CNAME=(.*)$') AND r.race_date::text=p.j->>'race_date' AND r.track=p.j->>'track' AND r.full_field AND r.source_checked_at<=p.runner_checked
 LEFT JOIN public.jra_lab_runs ar ON ar.race_id=r.id AND ar.horse_no::text=p.j->>'horse_no' AND ar.record_role='full_runner' AND ar.source_kind='jra_public_reference' AND ar.horse_name=p.horse_name AND substring(ar.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=substring(p.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')
)
SELECT horse_no,horse_ref,runner_checked,post_at,ord,j->>'race_date' AS prior_date,j->>'track' AS prior_track,j->>'source_ref' AS prior_ref,j->'horse_no' AS prior_no,j->'finish' AS finish,j->'field_size' AS field_size,j->>'time_raw' AS time_raw,j->'final3f' AS final3f,j->'margin_to_winner' AS card_gap,j->>'surface' AS surface,j->'distance' AS distance,j->>'going' AS going,j->>'race_class' AS class_name,archive_n,archive_checked,archive_horse_no,archive_finish,archive_clock,archive_f3,archive_margin,archive_surface,archive_distance,archive_going,archive_class,matches,
 CASE WHEN matches=1 AND archive_horse_no IS NOT NULL THEN (SELECT jsonb_agg(jsonb_build_object('horse_no',x.horse_no,'finish',x.finish,'time_raw',x.time_raw,'final3f',x.final3f) ORDER BY x.horse_no) FROM public.jra_lab_runs x WHERE x.race_id=a.prior_id AND x.record_role='full_runner' AND x.source_kind='jra_public_reference') END AS full_field
FROM a ORDER BY horse_no,ord;
