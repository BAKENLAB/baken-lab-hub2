-- BAKEN LAB JRA optional source-attributed evidence. READ-ONLY.
-- Combines recent four with fallback and older matched-course historical recall.
-- This is research data, not an automatic TOP5 score or official prediction.
CREATE OR REPLACE FUNCTION private.jra_v07_evidence_packet_v1(
  p_race_date date,p_track text,p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,private
AS $fn$
SELECT jsonb_build_object(
  'race_date',p_race_date,'track',p_track,'race_no',p_race_no,
  'mode','OPTIONAL_JRA_EVIDENCE_RECENT_PLUS_OLDER',
  'rank_effect',false,'score_effect',0,
  'asof_policy','historical_races_strictly_before_target',
  'recent_evidence',private.jra_v06_evidence_bundle_v1(p_race_date,p_track,p_race_no),
  'older_same_course_evidence',private.jra_older_course_evidence_v1(p_race_date,p_track,p_race_no)
);
$fn$;
REVOKE ALL ON FUNCTION private.jra_v07_evidence_packet_v1(date,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_v07_evidence_packet_v1(date,text,integer) FROM anon,authenticated;
