-- Work18 SELECT templates. Bind parameters in the authorized private operator only.
-- A: $1 exact JRA live race UUID, $2 feature cutoff (timestamptz).
-- Returns only allowlisted prestart stored facts, no target result or market.
WITH t AS (
 SELECT l.id,l.race_date,l.track,l.race_no,l.field_size,l.source_checked_at,l.updated_at,o.post_time
 FROM public.jra_live_races l JOIN public.official_races o ON o.circuit='JRA' AND o.race_date=l.race_date AND o.track=l.track AND o.race_no=l.race_no
 WHERE l.id=$1::uuid AND $2::timestamptz<o.post_time AND l.source_checked_at<=$2::timestamptz AND l.updated_at<=$2::timestamptz
), h AS (
 SELECT l.id,l.horse_no,l.horse_ref,l.source_checked_at,l.updated_at,l.past_runs
 FROM t JOIN public.jra_live_runners l ON l.live_race_id=t.id WHERE l.source_checked_at<=$2::timestamptz AND l.updated_at<=$2::timestamptz
), x AS (
 SELECT jsonb_build_object('rowId',h.id,'currentNo',h.horse_no,'horseRef',h.horse_ref,'checkedAt',h.source_checked_at,'updatedAt',h.updated_at,'index',ord-1,
 'run',(SELECT jsonb_object_agg(k,vv) FROM jsonb_each(v) e(k,vv) WHERE k IN ('race_date','track','distance','surface','going','race_class','race_class_detail','field_size','finish','time_raw','margin_to_winner','final3f','corner_positions','weight_carried','body_weight','jockey','horse_no','source_ref'))) row
 FROM h CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(h.past_runs)='array' THEN h.past_runs ELSE '[]'::jsonb END) WITH ORDINALITY j(v,ord)
)
SELECT (SELECT race_date FROM t) "targetDate",(SELECT track FROM t) track,(SELECT race_no FROM t) "raceNo",(SELECT post_time FROM t) post,$2::timestamptz cutoff,(SELECT field_size FROM t) "fieldSize",
 (SELECT jsonb_agg(jsonb_build_object('no',horse_no,'horseId',substring(horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud(?:00|10)([0-9]{10})/[0-9A-Fa-f]{2}$'),'status','UNKNOWN','sourceRow',id,'tier','PREPOST_LIVE_ROW_STATUS_NOT_INDEPENDENTLY_BOUND') ORDER BY horse_no) FROM h) roster,
 jsonb_agg(row ORDER BY row->>'rowId',(row->>'index')::int) rows FROM x;

-- B: $1 validated exact CNAME array from A, $2 target race date, $3 cutoff.
SELECT r.id,r.race_date,r.track,r.race_no,r.source_ref,r.created_at,r.updated_at,r.source_checked_at,
 r.full_field,r.archive_complete,r.field_size,r.distance,r.surface,r.going,r.turn,r.class_name,r.halon_times,r.course_text,r.course_layout,
 (SELECT jsonb_agg(jsonb_build_object('id',a.id,'horse_no',a.horse_no,'horse_ref',a.horse_ref,'record_role',a.record_role,'created_at',a.created_at,'updated_at',a.updated_at,'finish',a.finish,'time_raw',a.time_raw,'margin',a.margin,'final3f',a.final3f,'corner_positions',a.corner_positions,'draw',a.draw,'weight_carried',a.weight_carried,'body_weight',a.body_weight,'body_weight_diff',a.body_weight_diff,'equipment',a.equipment,'sex_age',a.sex_age,'jockey_ref',a.jockey_ref,'trainer_ref',a.trainer_ref) ORDER BY a.horse_no)
 FROM public.jra_lab_runs a WHERE a.race_id=r.id AND a.record_role='full_runner' AND a.created_at<=$3::timestamptz AND a.updated_at<=$3::timestamptz) rows
FROM public.jra_lab_races r WHERE r.source_ref=ANY($1::text[]) AND r.race_date<$2::date AND r.created_at<=$3::timestamptz AND r.updated_at<=$3::timestamptz AND r.source_checked_at<=$3::timestamptz ORDER BY r.source_ref;

-- C: $1 independent selected LOCAL snapshot UUID; compare returned object inside adapter to separately pinned expected digest, date, venue, race number and cutoff.
SELECT id,source_kind,source_version,source_status,race_date,track,race_no,as_of,captured_at,official_post_time,payload_digest,active_runner_count,evidence
FROM private.lab_preclaim_evidence_snapshots_v1 WHERE id=$1::uuid AND captured_at<official_post_time;

-- D: $1 JSON array of exact prior {date,track,raceNo} from reviewed card; $2 target date; $3 cutoff.
WITH e AS (SELECT DISTINCT v->>'date' dt,v->>'track' track,(v->>'raceNo')::int no FROM jsonb_array_elements($1::jsonb) v)
SELECT z.id,z.race_date,z.track,z.race_no,z.created_at,z.source,z.result->'metadata' metadata,
 (SELECT jsonb_agg(jsonb_build_object('no',v->>'horse_no','finish',v->>'finish','clock',v->>'time','margin',v->>'margin') ORDER BY (v->>'horse_no')::int) FROM jsonb_array_elements(z.result->'finishers') v) rows,
 (SELECT jsonb_agg(jsonb_build_object('no',v->>'horse_no','status',v->>'status')) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(z.result->'non_finishers')='array' THEN z.result->'non_finishers' ELSE '[]'::jsonb END) v) nonfinishers
FROM e JOIN public.official_results z ON z.race_date=e.dt::date AND z.track=e.track AND z.race_no=e.no AND z.circuit='LOCAL'
WHERE e.dt::date<$2::date AND z.created_at<=$3::timestamptz AND z.source='NAR_OFFICIAL_RACEMARK';
-- Exact fixed real SELECT variants were executed in Work18. Parameterized templates not independently executed.
