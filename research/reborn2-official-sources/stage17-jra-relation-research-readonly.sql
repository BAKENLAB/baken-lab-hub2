BEGIN READ ONLY;
WITH t AS (
 SELECT id,race_date,source_checked_at,updated_at,field_size,
 (race_date::text||' '||replace(replace(post_time,'時',':'),'分','')||':00+09')::timestamptz AS post_at
 FROM public.jra_live_races WHERE race_date='2026-11-23' AND track='東京' AND race_no=12
), roster AS (
 SELECT h.horse_no AS no,substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') AS horse_id,h.horse_name,h.source_checked_at AS cutoff
 FROM t JOIN public.jra_live_runners h ON h.live_race_id=t.id
 WHERE t.source_checked_at<t.post_at AND t.updated_at<t.post_at AND h.source_checked_at<t.post_at AND h.updated_at<t.post_at
), hist AS (
 SELECT h.no,h.horse_id,h.cutoff,r.id AS race_id,a.id AS row_id,r.race_date,r.track,r.race_no,r.source_ref,r.source_checked_at,r.updated_at AS race_updated,a.updated_at AS row_updated,
 r.surface,r.distance,r.going,r.class_name,r.course_layout,r.field_size,r.archive_complete,r.halon_times,r.race_final3f,a.horse_no AS prior_no,a.finish,a.time_raw,a.final3f,a.corner_positions,a.weight_carried,
 count(*) OVER(PARTITION BY h.no,r.race_date,r.track,r.race_no) AS duplicates
 FROM roster h JOIN public.jra_lab_runs a ON a.horse_name=h.horse_name AND substring(a.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=h.horse_id
 JOIN public.jra_lab_races r ON r.id=a.race_id
 WHERE r.race_date<'2026-11-23' AND r.full_field AND a.record_role='full_runner' AND a.source_kind='jra_public_reference' AND r.source_ref IS NOT NULL AND r.source_checked_at<=h.cutoff
),
valid_hist AS (
 SELECT * FROM hist WHERE duplicates=1 AND race_updated<=cutoff AND row_updated<=cutoff AND finish>0
), peers AS (
 SELECT h.*,p.id AS peer_row_id,substring(p.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') AS peer_id,p.horse_no AS peer_no,p.finish AS peer_finish,p.time_raw AS peer_clock,p.weight_carried AS peer_weight
 FROM valid_hist h JOIN public.jra_lab_runs p ON p.race_id=h.race_id AND p.horse_no<>h.prior_no AND p.record_role='full_runner' AND p.source_kind='jra_public_reference' AND p.updated_at<=h.cutoff AND p.finish>0
 WHERE substring(p.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') IS NOT NULL
), direct AS (
 SELECT a.no AS a_no,b.no AS b_no,a.race_id,a.row_id AS a_row,b.row_id AS b_row,a.race_date,a.track,a.race_no,a.finish AS a_finish,b.finish AS b_finish,a.time_raw AS a_clock,b.time_raw AS b_clock,a.weight_carried AS a_weight,b.weight_carried AS b_weight
 FROM valid_hist a JOIN valid_hist b ON a.race_id=b.race_id AND a.no<b.no AND a.horse_id<>b.horse_id
), common AS (
 SELECT a.no AS a_no,b.no AS b_no,a.race_id AS a_race,b.race_id AS b_race,a.row_id AS a_row,b.row_id AS b_row,a.peer_row_id AS a_peer_row,b.peer_row_id AS b_peer_row,a.peer_id,
 a.race_date AS a_date,b.race_date AS b_date,a.finish AS a_finish,b.finish AS b_finish,a.peer_finish AS a_peer_finish,b.peer_finish AS b_peer_finish,
 a.time_raw AS a_clock,b.time_raw AS b_clock,a.peer_clock AS a_peer_clock,b.peer_clock AS b_peer_clock,
 a.weight_carried AS a_weight,b.weight_carried AS b_weight,a.peer_weight AS a_peer_weight,b.peer_weight AS b_peer_weight,
 (a.surface=b.surface AND a.distance=b.distance AND a.going=b.going AND a.class_name=b.class_name) AS same_visible_conditions
 FROM peers a JOIN peers b ON a.peer_id=b.peer_id AND a.no<b.no AND a.race_id<>b.race_id AND a.peer_id<>a.horse_id AND a.peer_id<>b.horse_id
), common_pick AS (
 SELECT *,row_number() OVER(PARTITION BY a_no,b_no ORDER BY same_visible_conditions DESC NULLS LAST,a_date DESC,b_date DESC,a_race,b_race,peer_id,a_peer_row,b_peer_row) AS pick
 FROM common
), later_candidates AS (
 SELECT d.a_no,d.b_no,d.race_id AS reference_race,d.a_row,d.b_row,h.no AS peer_no,h.race_id AS candidate_event,h.row_id AS candidate_row,h.race_date AS candidate_date,h.finish,h.time_raw,h.weight_carried,
 row_number() OVER(PARTITION BY d.race_id,d.a_no,d.b_no,h.no ORDER BY h.race_date DESC,h.race_id,h.row_id) AS pick
 FROM direct d JOIN valid_hist h ON h.no IN (d.a_no,d.b_no) AND h.race_date>d.race_date
)
SELECT (SELECT count(*) FROM valid_hist) AS valid_hist_rows,
 (SELECT count(*) FROM direct) AS direct_count,
 (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY a_no,b_no,race_date),'[]') FROM direct d) AS direct_rows,
 (SELECT count(*) FROM common) AS common_candidate_count,
 (SELECT count(*) FROM common WHERE same_visible_conditions) AS common_same_visible_count,
 (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY a_no,b_no),'[]') FROM common_pick c WHERE pick=1) AS common_sample,
 (SELECT count(*) FROM later_candidates) AS later_candidate_count,
 (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY a_no,b_no,reference_race,peer_no),'[]') FROM later_candidates l WHERE pick=1) AS later_sample;
ROLLBACK;
