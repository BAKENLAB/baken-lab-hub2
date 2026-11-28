-- Work17 private read-only stored-source retrieval. Run only within confirmed permitted use scope.
-- A: actual executed JRA attached histories, NOT target result, no market columns.
WITH r AS (
 SELECT l.id,l.race_date,o.post_time FROM public.jra_live_races l
 JOIN public.official_races o ON o.circuit='JRA' AND o.race_date=l.race_date AND o.track=l.track AND o.race_no=l.race_no
 WHERE l.race_date='2026-11-23' AND l.track='東京' AND l.race_no=9
), x AS (
 SELECT jsonb_build_object('rowId',l.id,'currentNo',l.horse_no,'horseRef',l.horse_ref,
 'checkedAt',l.source_checked_at,'updatedAt',l.updated_at,'index',ord-1,'run',
 (SELECT jsonb_object_agg(k,vv) FROM jsonb_each(v) e(k,vv)
 WHERE k IN ('race_date','track','distance','surface','going','race_class','race_class_detail','field_size','finish','time_raw','margin_to_winner','final3f','corner_positions','weight_carried','body_weight','jockey','horse_no','source_ref'))) row
 FROM r JOIN public.jra_live_runners l ON l.live_race_id=r.id
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(l.past_runs)='array' THEN l.past_runs ELSE '[]'::jsonb END) WITH ORDINALITY j(v,ord)
 WHERE l.source_checked_at<r.post_time AND l.updated_at<r.post_time
)
SELECT (SELECT race_date FROM r) "targetDate",(SELECT post_time FROM r) post,
 (SELECT post_time-interval '1 millisecond' FROM r) cutoff,jsonb_agg(row) rows FROM x;

-- B: exact previously saved LOCAL snapshot with independent SQL-side canonical digest comparison.
-- digestVerified is an execution receipt from THIS query, never caller self-certification.
WITH RECURSIVE s AS (
 SELECT id,race_date,track,race_no,as_of,captured_at,official_post_time,payload_digest,evidence
 FROM private.lab_preclaim_evidence_snapshots_v1 WHERE id='c66d8b6a-fd27-407b-b750-6650d5ab4269'
), nodes(id,path,v,prefix) AS (
 SELECT id,ARRAY[]::integer[],evidence,''::text FROM s
 UNION ALL SELECT n.id,n.path||ARRAY[2,c.ord::integer],c.val,(CASE WHEN c.ord>1 THEN ',' ELSE '' END)||c.prefix
 FROM nodes n CROSS JOIN LATERAL (
 SELECT value val,row_number() OVER(ORDER BY key COLLATE "C") ord,to_jsonb(key)::text||':' prefix FROM jsonb_each(CASE WHEN jsonb_typeof(n.v)='object' THEN n.v ELSE '{}'::jsonb END)
 UNION ALL SELECT value,ordinality,''::text FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.v)='array' THEN n.v ELSE '[]'::jsonb END) WITH ORDINALITY
 ) c
), tokens AS (
 SELECT id,path||0 path,prefix||CASE jsonb_typeof(v) WHEN 'object' THEN '{' WHEN 'array' THEN '[' WHEN 'number' THEN trim_scale((v::text)::numeric)::text ELSE v::text END tok FROM nodes
 UNION ALL SELECT id,path||3,CASE jsonb_typeof(v) WHEN 'object' THEN '}' WHEN 'array' THEN ']' END FROM nodes WHERE jsonb_typeof(v) IN ('object','array')
), hashes AS (
 SELECT id,encode(extensions.digest(string_agg(tok,'' ORDER BY path),'sha256'),'hex') recomputed FROM tokens GROUP BY id
)
SELECT s.*,hashes.recomputed=s.payload_digest "digestVerified" FROM s JOIN hashes USING(id);

-- C: actual executed future LOCAL roster check. After post this deliberately returns zero.
SELECT 'LOCAL' circuit,race_date "raceDate",track,race_no "raceNo",post_time post,field_fetched_at "fetchedAt",now() cutoff,
 field_payload->>'official_field_source' source,field_payload->'data_quality'->'field_complete' complete,
 (SELECT jsonb_agg(jsonb_build_object('no',(v->>'horse_no')::int,'name',v->>'horse_name','status',v->>'status','ref',v->>'horse_ref'))
 FROM jsonb_array_elements(field_payload->'runners') v) rows
FROM public.official_races WHERE circuit='LOCAL' AND race_date='2026-11-28' AND track='高知' AND race_no=12 AND post_time>now();

-- D: actual executed unique historical archive match aggregate, exact source code and horse ID, no name-only join.
WITH t AS (
 SELECT l.id,l.race_date,o.post_time FROM public.jra_live_races l JOIN public.official_races o ON o.circuit='JRA' AND o.race_date=l.race_date AND o.track=l.track AND o.race_no=l.race_no
 WHERE l.race_date='2026-11-23' AND l.track='東京' AND l.race_no=9
), own AS (
 SELECT l.id current_id,l.horse_ref,v,ord,t.post_time FROM t JOIN public.jra_live_runners l ON l.live_race_id=t.id
 CROSS JOIN LATERAL jsonb_array_elements(l.past_runs) WITH ORDINALITY j(v,ord)
 WHERE l.source_checked_at<t.post_time AND l.updated_at<t.post_time AND v->>'race_date'<t.race_date::text
), e AS (
 SELECT o.*,r.id rid FROM own o JOIN public.jra_lab_races r
 ON r.source_ref=substring(o.v->>'source_ref' from '^/JRADB/accessS[.]html[?]CNAME=(pw01sde(?:01|10)[0-9]{20}/[0-9A-Fa-f]{2})$')
 AND r.race_date::text=o.v->>'race_date' AND r.track=o.v->>'track'
 AND r.source_checked_at<o.post_time AND r.updated_at<o.post_time AND r.created_at<o.post_time
), a AS (
 SELECT e.current_id,e.ord,e.rid,h.id,h.jockey_ref,h.trainer_ref,h.equipment,h.draw,h.body_weight,h.body_weight_diff,
 count(*) OVER(PARTITION BY e.current_id,e.ord) n FROM e JOIN public.jra_lab_runs h ON h.race_id=e.rid
 AND substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud(?:00|10)([0-9]{10})/[0-9A-Fa-f]{2}$')=substring(e.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud(?:00|10)([0-9]{10})/[0-9A-Fa-f]{2}$')
 AND h.horse_no::text=e.v->>'horse_no' AND h.record_role='full_runner' AND h.created_at<e.post_time AND h.updated_at<e.post_time
)
SELECT (SELECT count(*) FROM e) event_ref_joins,count(*) FILTER(WHERE n=1) exact_unique_rows,
 count(DISTINCT rid) FILTER(WHERE n=1) events,count(*) FILTER(WHERE n=1 AND nullif(jockey_ref,'') IS NOT NULL) jockey_refs,
 count(*) FILTER(WHERE n=1 AND nullif(trainer_ref,'') IS NOT NULL) trainer_refs,count(*) FILTER(WHERE n=1 AND nullif(equipment,'') IS NOT NULL) equipment_rows,
 count(*) FILTER(WHERE n=1 AND draw IS NOT NULL) draw_rows,count(*) FILTER(WHERE n=1 AND body_weight IS NOT NULL AND body_weight_diff IS NOT NULL) body_weight_delta_rows FROM a;

-- E: only count of earlier result records, not target outcome or bias analysis.
SELECT (SELECT count(*) FROM public.official_results WHERE circuit='LOCAL' AND race_date='2026-11-28' AND track='佐賀' AND race_no<5 AND created_at<'2026-11-28T14:55:00+09:00') local_earlier_results_by_cutoff,
 (SELECT count(*) FROM public.official_results WHERE circuit='JRA' AND race_date='2026-11-23' AND track='東京' AND race_no<9 AND created_at<'2026-11-23T14:20:00+09:00') jra_earlier_results_by_cutoff;
