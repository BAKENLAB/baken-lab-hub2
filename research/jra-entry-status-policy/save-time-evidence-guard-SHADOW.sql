-- SHADOW ONLY. NOT A DEPLOYABLE MIGRATION.
-- Proposed addition inside public.jra_save_claimed_prediction before inserting FROZEN prediction.
-- Reject missing or incomplete current-race status evidence.
-- WARNING: even structurally complete evidence is untrusted until official JRA DOM extraction is audited.
IF jsonb_typeof(r.field_payload->'runners') IS DISTINCT FROM 'array'
   OR jsonb_array_length(COALESCE(r.field_payload->'runners','[]'::jsonb)) = 0 THEN
 RAISE EXCEPTION 'JRA_FIELD_EVIDENCE_MISSING';
END IF;
IF EXISTS (
 SELECT 1 FROM jsonb_array_elements(r.field_payload->'runners') runner(x)
 WHERE runner.x->'status_evidence'->>'scope' IS DISTINCT FROM 'CURRENT_RACE'
    OR runner.x->'status_evidence'->>'verified' IS DISTINCT FROM 'true'
    OR COALESCE(runner.x->'status_evidence'->>'locator','') = ''
    OR COALESCE(runner.x->'status_evidence'->>'basis','') = ''
) THEN RAISE EXCEPTION 'JRA_FIELD_EVIDENCE_INCOMPLETE'; END IF;
-- Missing before deploy: trusted extractor, freshness, full field identity match,
-- exclusion handling, and concurrency-safe freeze snapshot.
