BEGIN READ ONLY;
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
SELECT horse_no,substring(horse_ref from 'CNAME=pw01dud[01]0([0-9]{10})/') AS horse_id,jsonb_agg(jsonb_build_object('card_ordinal',ord,'prior_date',j->>'race_date','prior_track',j->>'track','prior_source_ref',j->>'source_ref','prior_no',j->>'horse_no','archive_race_id',prior_id,'archive_matches',matches,'archive_identity_match',archive_horse_no IS NOT NULL,'finish_clock_match',coalesce(archive_finish::text=j->>'finish' AND archive_clock=j->>'time_raw',false),'class_label_match',coalesce(archive_class=j->>'race_class',false),'archive_capture',archive_checked,
'observations',jsonb_build_object('finish',j->'finish','time_raw',j->'time_raw','final3f',j->'final3f','winner_gap_literal',j->'margin_to_winner','distance',j->'distance','surface',j->'surface','going',j->'going','class_literal',j->'race_class','corners',j->'corner_positions','weight',j->'weight_carried','field_size',j->'field_size')) ORDER BY ord) histories FROM a WHERE j->>'race_date'<race_date::text GROUP BY horse_no,horse_ref ORDER BY horse_no;
ROLLBACK;
