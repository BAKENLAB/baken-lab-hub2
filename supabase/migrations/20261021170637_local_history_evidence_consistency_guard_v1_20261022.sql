-- Supabase migration 20261021170637: LOCAL 1.6 evidence consistency safeguard.
-- Source reconstructed from verified DB definitions following successful migration.
-- Applies only on new INSERTs; historical FROZEN predictions are immutable.

CREATE OR REPLACE FUNCTION public.lab_local_history_evidence_consistent_v1(p_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_runner jsonb;
  v_audit jsonb;
  v_checked integer;
  v_words text;
BEGIN
  IF jsonb_typeof(p_payload->'runners') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_payload->'audit'->'runner_evidence_audit') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'LOCAL_HISTORY_EVIDENCE_SHAPE'; END IF;

  FOR v_runner IN SELECT value FROM jsonb_array_elements(p_payload->'runners') LOOP
    IF v_runner->>'status' IN ('CANCELLED','EXCLUDED') THEN CONTINUE; END IF;
    SELECT x.value INTO v_audit
    FROM jsonb_array_elements(p_payload->'audit'->'runner_evidence_audit') AS x(value)
    WHERE x.value->'horse_no'=v_runner->'horse_no' LIMIT 1;
    IF v_audit IS NULL
      OR jsonb_typeof(v_runner->'recent_runs_checked') IS DISTINCT FROM 'number'
      OR v_runner->'recent_runs_checked' IS DISTINCT FROM v_audit->'recent_runs_checked'
    THEN RAISE EXCEPTION 'LOCAL_HISTORY_COUNT_CONFLICT'; END IF;

    v_checked := (v_runner->>'recent_runs_checked')::integer;
    IF v_checked < 0 OR v_checked > 5 THEN
      RAISE EXCEPTION 'LOCAL_HISTORY_COUNT_CONFLICT';
    END IF;
    v_words := coalesce(v_runner->>'reason','') || ' ' ||
               coalesce(v_runner->>'evidence_summary','') || ' ' ||
               coalesce(v_audit->>'evidence_summary','');

    -- A full-field evaluator must never say "zero previous runs" after
    -- the input context attests to one or more reviewed runs.
    IF v_checked > 0
       AND v_words ~ '(近走|過去走)履歴(が)?[[:space:]]*0件'
    THEN RAISE EXCEPTION 'LOCAL_HISTORY_REASON_CONFLICT'; END IF;

    -- Genuine zero verified history: no invented ranking.
    IF v_checked = 0 AND
       (v_runner->>'evaluation_status' IS DISTINCT FROM 'UNRATED_NO_VERIFIED_HISTORY'
        OR NOT (coalesce(v_runner->'missing_items','[]'::jsonb)
                  @> '["verified_history"]'::jsonb)
        OR NOT (coalesce(v_audit->'missing_items','[]'::jsonb)
                  @> '["verified_history"]'::jsonb))
    THEN RAISE EXCEPTION 'LOCAL_HISTORY_ZERO_MUST_BE_UNRATED'; END IF;
  END LOOP;
  RETURN true;
END
$function$
;

CREATE OR REPLACE FUNCTION public.lab_local_history_evidence_insert_guard_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  PERFORM public.lab_local_history_evidence_consistent_v1(NEW.payload);
  RETURN NEW;
END
$function$
;

CREATE TRIGGER trg_local_v16_history_evidence_consistency BEFORE INSERT ON public.official_predictions FOR EACH ROW WHEN (((new.circuit = 'LOCAL'::text) AND (new.protocol_version = 'CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'::text))) EXECUTE FUNCTION lab_local_history_evidence_insert_guard_v1();

-- Read-only regression at deployment:
-- 311 previously valid LOCAL 1.6 records passed; the 2026-10-21
-- Sonoda 6R record was specifically detected as an evidence contradiction.
