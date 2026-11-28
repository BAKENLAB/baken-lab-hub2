-- Work14: READ ONLY. Execute only within separately authorized private factual analysis scope.
-- Query A: exact stored snapshot input to Codex13's existing analyzeWork13Snapshot.
-- Do not export to public CI/GitHub. Save returned JSON only in authorized local environment.
SELECT jsonb_build_object('id',id,'race_date',race_date,'track',track,'race_no',race_no,
 'official_post_time',official_post_time,'captured_at',captured_at,'as_of',as_of,
 'active_runner_count',active_runner_count,'official_roster_digest',official_roster_digest,
 'payload_digest',payload_digest,'evidence',evidence) AS snapshot
FROM private.lab_preclaim_evidence_snapshots_v1
WHERE id='c66d8b6a-fd27-407b-b750-6650d5ab4269'::uuid
 AND payload_digest='67d5ae4a8c358e4c53c19ac24711b8b5b1fbee3e2609ce946583875aaa6c03f2'
 AND race_date='2026-11-28' AND track='佐賀' AND race_no=5
 AND source_kind='LOCAL_OFFICIAL_CORNERS' AND source_version='LOCAL_CORNER_1'
 AND source_status='PARTIAL'
 AND as_of<=captured_at AND captured_at<='2026-11-28T14:55:00+09:00'
 AND captured_at<official_post_time
 AND evidence->'packet'->>'marketUsed'='false'
 AND evidence->'packet'->>'targetResultUsed'='false';

-- Query B: event-level context from exact prior races ONLY (never target result).
-- Legacy values lack per-row as-of proof, do not promote to verified context.
WITH e(dt,track,no) AS (VALUES
 ('2026-05-27'::date,'園田',11),('2026-06-05','船橋',12),('2026-06-27','佐賀',4),
 ('2026-07-02','船橋',11),('2026-07-11','佐賀',3),('2026-08-16','佐賀',7),
 ('2026-09-05','佐賀',3),('2026-09-12','佐賀',3),('2026-09-26','佐賀',3),
 ('2026-09-27','佐賀',3),('2026-09-27','佐賀',8),('2026-10-17','佐賀',4),
 ('2026-10-18','佐賀',5),('2026-10-18','佐賀',9),('2026-10-31','佐賀',5),
 ('2026-11-01','佐賀',7),('2026-11-15','佐賀',5),('2026-11-15','佐賀',6))
SELECT e.dt,e.track,e.no,
 (SELECT jsonb_agg(DISTINCT jsonb_build_object('raceName',h.race_name,'fieldSize',h.field_size,'surface',h.surface,'direction',h.turn,'going',h.going,'distanceM',h.distance))
  FROM public.horse_runs h WHERE h.race_date=e.dt AND h.track=e.track AND h.race_no=e.no) legacy_candidate,
 (SELECT jsonb_agg(jsonb_build_object('source',o.source,'name',o.race_name,'createdAt',o.created_at,
  'surface',o.result->'metadata'->>'surface','distanceM',o.result->'metadata'->'distance','going',o.result->'metadata'->>'going',
  'reportedFinishRows',CASE WHEN jsonb_typeof(o.result->'finishers')='array' THEN jsonb_array_length(o.result->'finishers') END,
  'nonFinisherRows',CASE WHEN jsonb_typeof(o.result->'non_finishers')='array' THEN jsonb_array_length(o.result->'non_finishers') END))
  FROM public.official_results o WHERE o.circuit='LOCAL' AND o.race_date=e.dt AND o.track=e.track AND o.race_no=e.no
    AND o.created_at<'2026-11-28T14:55:00+09:00' AND o.race_date<'2026-11-28') stored_results,
 (SELECT jsonb_agg(jsonb_build_object('name',o.race_name,'fetchedAt',o.field_fetched_at,'updatedAt',o.updated_at,
  'source',o.field_payload->>'official_field_source','fieldCompleteReported',o.field_payload->'data_quality'->'field_complete',
  'recordedRows',CASE WHEN jsonb_typeof(o.field_payload->'runners')='array' THEN jsonb_array_length(o.field_payload->'runners') END,
  'activeRows',(SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.field_payload->'runners')='array' THEN o.field_payload->'runners' ELSE '[]'::jsonb END) v WHERE v->>'status'='ACTIVE')))
  FROM public.official_races o WHERE o.circuit='LOCAL' AND o.race_date=e.dt AND o.track=e.track AND o.race_no=e.no
    AND o.field_fetched_at<'2026-11-28T14:55:00+09:00' AND o.updated_at<'2026-11-28T14:55:00+09:00') stored_cards
FROM e WHERE e.dt<'2026-11-28' ORDER BY e.dt,e.track,e.no;
-- No explicit official class/declaredCount/direction from the nine result metadata records.
-- Do not turn titles or finish-row counts into official values.
