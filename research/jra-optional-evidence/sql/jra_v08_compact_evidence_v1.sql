-- JRA compact pre-race evidence ledger. Research diagnostic ONLY.
-- Never changes rankings, EYE, official predictions, saved FROZEN or Cron.
-- Uses the existing source-attributed, as-of-filtered all-runner packet.
CREATE OR REPLACE FUNCTION private.jra_v08_compact_evidence_v1(
 p_date date,p_track text,p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,private
AS $body$
WITH live AS (
 SELECT r.id,r.surface,r.distance,r.class_name,r.field_size
 FROM public.jra_live_races r
 WHERE r.race_date=p_date AND r.track=p_track AND r.race_no=p_race_no
 AND COALESCE(r.race_type,'')<>'障害' LIMIT 1
), pkt AS (
 SELECT private.jra_v07_evidence_packet_v1(p_date,p_track,p_race_no) p
 WHERE EXISTS(SELECT 1 FROM live)
), horses AS (
 SELECT r.value AS runner,l.surface,l.distance,l.class_name,
   (SELECT o.value FROM jsonb_array_elements(p.p->'older_same_course_evidence') o
    WHERE o.value->>'horse_no'=r.value->>'horse_no'
    AND o.value->>'horse_name'=r.value->>'horse_name'
    LIMIT 1) AS older
 FROM pkt p JOIN live l ON true
 CROSS JOIN LATERAL jsonb_array_elements(p.p->'recent_evidence'->'runners') r
), enriched AS (
 SELECT jsonb_build_object(
  'horse_no',(h.runner->>'horse_no')::integer,
  'horse_name',h.runner->>'horse_name',
  'basic_history_count',
    jsonb_array_length(h.runner->'past_race_content'),
  'recent_same_surface_count',
    (SELECT COUNT(*) FROM jsonb_array_elements(h.runner->'past_race_content') x
     WHERE x->>'prior_surface'=h.surface),
  'recent_near_condition_close_count',
    (SELECT COUNT(*) FROM jsonb_array_elements(h.runner->'past_race_content') x
     WHERE x->>'prior_surface'=h.surface
     AND (x->>'prior_distance')::integer BETWEEN h.distance-GREATEST(200,LEAST(400,(h.distance*0.18)::integer))
        AND h.distance+GREATEST(200,LEAST(400,(h.distance*0.18)::integer))
     AND (x->>'finish')::integer BETWEEN 4 AND 6
     AND (x->>'margin_to_winner')::numeric BETWEEN 0 AND 0.5),
  'recent_near_condition_top3_count',
    (SELECT COUNT(*) FROM jsonb_array_elements(h.runner->'past_race_content') x
     WHERE x->>'prior_surface'=h.surface
     AND ABS((x->>'prior_distance')::integer-h.distance)<=GREATEST(200,LEAST(400,(h.distance*0.18)::integer))
     AND (x->>'finish')::integer BETWEEN 1 AND 3),
  'recent_verified_fast3f_count',
    (SELECT COUNT(*) FROM jsonb_array_elements(h.runner->'past_race_content') x
     WHERE (x->>'archive_match_count')::integer=1
       AND (x->>'final3f_rank')::integer BETWEEN 1 AND 3),
  'recent_final3f_fallback_count',
    (SELECT COUNT(*) FROM jsonb_array_elements(h.runner->'past_race_content') x
     WHERE x->>'final3f_source'='LIVE_PAST_RUN_FALLBACK'),
  'recent_recorded_pace_count',
    (SELECT COUNT(*) FROM jsonb_array_elements(h.runner->'past_race_content') x
     WHERE x->>'race_halons' IS NOT NULL),
  'older_data_available',h.older IS NOT NULL,
  'older_near_condition_runs',
    CASE WHEN h.older IS NULL THEN NULL
     ELSE jsonb_array_length(h.older->'older_same_surface_near_distance') END,
  'older_same_track_podium',
    CASE WHEN h.older IS NULL THEN NULL ELSE (
      SELECT COUNT(*) FROM jsonb_array_elements(h.older->'older_same_surface_near_distance') x
      WHERE x->>'track'=p_track AND (x->>'finish')::integer BETWEEN 1 AND 3
      AND ABS((x->>'distance')::integer-h.distance)<=400) END,
  'older_podium_from_lower_class',
    CASE WHEN h.older IS NULL THEN NULL ELSE (
      SELECT COUNT(*) FROM jsonb_array_elements(h.older->'older_same_surface_near_distance') x
      WHERE (x->>'finish')::integer BETWEEN 1 AND 3
       AND x->>'class_name'='未勝利' AND h.class_name<>'未勝利') END,
  'opponent_followup_count',
    jsonb_array_length(h.runner->'opponent_followups'),
  'numerical_rank_effect',0,
  'missing_sources_are_not_negative',true
 ) AS rec
 FROM horses h
)
SELECT jsonb_build_object(
 'status',CASE WHEN NOT EXISTS(SELECT 1 FROM pkt) THEN 'NO_RACE'
  WHEN EXISTS(SELECT 1 FROM live WHERE field_size IS NOT NULL
   AND field_size<>(SELECT COUNT(*) FROM enriched)) THEN 'PARTIAL_FIELD'
  WHEN (SELECT COUNT(*) FROM enriched) <>
    (SELECT COUNT(DISTINCT rec->>'horse_no') FROM enriched) THEN 'DUPLICATE_HORSE'
  ELSE 'READY' END,
 'expected_field_size',(SELECT field_size FROM live),
 'evidence_runner_count',(SELECT COUNT(*) FROM enriched),
 'research_only',true,'as_of',p_date,'track',p_track,'race_no',p_race_no,
 'production_rank_changed',false,
 'runners',COALESCE((SELECT jsonb_agg(rec ORDER BY (rec->>'horse_no')::integer) FROM enriched),'[]'::jsonb)
);
$body$;
REVOKE ALL ON FUNCTION private.jra_v08_compact_evidence_v1(date,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_v08_compact_evidence_v1(date,text,integer) FROM anon,authenticated;
