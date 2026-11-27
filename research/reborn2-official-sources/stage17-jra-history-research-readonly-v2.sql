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
), field_rows AS (
 SELECT a.race_id,a.id AS row_id,a.horse_no,a.finish,a.final3f,a.updated_at,
 CASE WHEN a.time_raw~'^[0-9]+:[0-5][0-9][.][0-9]$' THEN (split_part(a.time_raw,':',1)::numeric*60+split_part(a.time_raw,':',2)::numeric)*10 END AS ticks
 FROM (SELECT DISTINCT race_id FROM hist) h JOIN public.jra_lab_runs a ON a.race_id=h.race_id WHERE a.record_role='full_runner' AND a.source_kind='jra_public_reference'
), ordered AS (
 SELECT f.*,lag(ticks) OVER(PARTITION BY race_id ORDER BY finish,horse_no) prev_ticks FROM field_rows f
), quality AS (
 SELECT race_id,count(*) n,count(DISTINCT horse_no) unique_no,count(DISTINCT finish) unique_finish,min(finish) min_finish,max(finish) max_finish,count(ticks) clock_n,count(*) FILTER(WHERE ticks<=0 OR ticks<prev_ticks) bad_clock,
 count(*) FILTER(WHERE final3f>0 AND final3f*10<ticks) f3_n,min(ticks) FILTER(WHERE finish=1) winner_ticks,max(updated_at) last_field_update
 FROM ordered GROUP BY race_id
), parsed AS (
 SELECT h.*,q.n,q.unique_no,q.unique_finish,q.min_finish,q.max_finish,q.clock_n,q.bad_clock,q.f3_n,q.winner_ticks,q.last_field_update,f.ticks,f.prev_ticks,regexp_split_to_array(trim(h.halon_times),' *- *') AS lap_parts,regexp_split_to_array(trim(h.corner_positions),' +') AS corner_parts,
 (SELECT min(z.ticks) FROM field_rows z WHERE z.race_id=h.race_id AND z.finish=h.finish+1) AS next_ticks
 FROM hist h JOIN quality q ON q.race_id=h.race_id JOIN ordered f ON f.row_id=h.row_id
), checked AS (
 SELECT p.*,
 (duplicates=1 AND n=field_size AND unique_no=field_size AND unique_finish=field_size AND min_finish=1 AND max_finish=field_size AND clock_n=field_size AND bad_clock=0 AND f3_n=field_size) AS full_numeric,
 (race_updated<=cutoff AND row_updated<=cutoff AND last_field_update<=cutoff) AS update_before_cutoff,
 (distance%200=0 AND cardinality(lap_parts)=distance/200 AND NOT EXISTS(SELECT 1 FROM unnest(lap_parts) x WHERE x!~'^[0-9]+[.][0-9]$')) AS lap_shape,
 (cardinality(corner_parts)>0 AND NOT EXISTS(SELECT 1 FROM unnest(corner_parts) x WHERE CASE WHEN x~'^[0-9]+$' THEN x::int NOT BETWEEN 1 AND field_size ELSE true END)) AS corners_valid
 FROM parsed p
), facts AS (
 SELECT c.*,
 CASE WHEN lap_shape THEN (SELECT sum(x::numeric*10) FROM unnest(lap_parts) x) END AS lap_ticks,
 CASE WHEN lap_shape AND distance>=800 THEN (SELECT sum(x::numeric*10) FROM unnest(lap_parts) WITH ORDINALITY z(x,i) WHERE i<=distance/200-3) END AS leader_checkpoint_ticks
 FROM checked c
)
SELECT no,horse_id,cutoff,jsonb_agg(jsonb_build_object('race_id',race_id,'row_id',row_id,'event',jsonb_build_array(race_date,track,race_no),'source_ref',source_ref,'observed_at',source_checked_at,'prior_no',prior_no,
 'duplicate_n',duplicates,'full_numeric',full_numeric,'update_before_cutoff',update_before_cutoff,'lap_shape',lap_shape,'lap_sum_matches_winner',CASE WHEN lap_ticks IS NOT NULL AND winner_ticks IS NOT NULL THEN lap_ticks=winner_ticks END,
 'corners_valid',corners_valid,'checkpoint_conflict',CASE WHEN leader_checkpoint_ticks IS NOT NULL AND ticks IS NOT NULL AND final3f IS NOT NULL THEN ticks-final3f*10<leader_checkpoint_ticks-1 END,
 'layout_known',course_layout IS NOT NULL AND course_layout<>'','archive_complete',archive_complete,
 'observations',jsonb_build_object('surface',surface,'distance',distance,'going',going,'class_literal',class_name,'field_size',field_size,'finish',finish,'time_ticks',ticks,'final600_ticks',final3f*10,'winner_gap_ticks',CASE WHEN full_numeric THEN ticks-winner_ticks END,'next_gap_ticks',CASE WHEN full_numeric THEN next_ticks-ticks END,'race_leader_lap_ticks',CASE WHEN lap_shape THEN (SELECT jsonb_agg((x::numeric*10)::int ORDER BY i) FROM unnest(lap_parts) WITH ORDINALITY z(x,i)) END,'corners',CASE WHEN corners_valid THEN corner_parts END,'weight',weight_carried,'leader_checkpoint_ticks',leader_checkpoint_ticks)
 ) ORDER BY race_date DESC,race_no,row_id) AS histories FROM facts GROUP BY no,horse_id,cutoff ORDER BY no;
ROLLBACK;
