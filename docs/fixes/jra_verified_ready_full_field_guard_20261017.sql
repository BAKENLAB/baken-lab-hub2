-- Fail-closed guard on verified JRA BASIC_READY payloads.
-- Only fires if field_payload is inserted/updated by the official verified source.
-- Prevents a structurally correct array length containing duplicate / wrong horses.
CREATE OR REPLACE FUNCTION private.jra_verified_ready_full_field_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
DECLARE
  live_id uuid;
  required_count integer;
  rows_count integer;
  unique_horses integer;
  matched_count integer;
BEGIN
  IF NEW.circuit IS DISTINCT FROM 'JRA'
     OR NEW.source IS DISTINCT FROM 'JRA_OFFICIAL_VERIFIED_GATE_V1'
     OR NEW.field_status IS DISTINCT FROM 'BASIC_READY'
  THEN RETURN NEW; END IF;
  IF NEW.field_payload #>> '{official_status_verification,verified}' IS DISTINCT FROM 'true'
     OR jsonb_typeof(NEW.field_payload->'runners') IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_PROOF_OR_ARRAY_INVALID';
  END IF;
  SELECT id,field_size INTO live_id,required_count FROM public.jra_live_races
    WHERE (race_date,track,race_no)=(NEW.race_date,NEW.track,NEW.race_no);
  IF live_id IS NULL OR required_count NOT BETWEEN 5 AND 24 THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_SOURCE_MISSING';
  END IF;
  SELECT count(*),count(DISTINCT x.value->>'horse_no')
    INTO rows_count,unique_horses
    FROM jsonb_array_elements(NEW.field_payload->'runners') AS x(value);
  IF rows_count<>required_count OR unique_horses<>required_count THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_DUPLICATE_OR_MISSING_HORSE'
      USING DETAIL=NEW.track||NEW.race_no||'R';
  END IF;
  SELECT count(*) INTO matched_count
  FROM jsonb_array_elements(NEW.field_payload->'runners') AS x(value)
  JOIN public.jra_live_runners r
    ON r.live_race_id=live_id AND r.horse_no::text=x.value->>'horse_no'
  WHERE r.horse_name=x.value->>'horse_name'
    AND r.horse_ref=x.value->>'horse_ref'
    AND r.draw::text=x.value->>'draw'
    AND x.value->>'status' IN ('ACTIVE','CANCELLED','EXCLUDED')
    AND (x.value->>'status'<>'ACTIVE'
      OR (r.jockey=x.value->>'jockey'
        AND r.weight_carried IS NOT DISTINCT FROM (x.value->>'weight_carried')::numeric));
  IF matched_count<>required_count THEN
    RAISE EXCEPTION 'JRA_VERIFIED_READY_RUNNER_DETAIL_MISMATCH'
      USING DETAIL=NEW.track||NEW.race_no||'R';
  END IF;
  RETURN NEW;
END
$body$;
REVOKE ALL ON FUNCTION private.jra_verified_ready_full_field_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_verified_ready_full_field_guard_v1() FROM anon,authenticated;
DROP TRIGGER IF EXISTS trg_jra_verified_ready_full_field_guard_v1 ON public.official_races;
CREATE TRIGGER trg_jra_verified_ready_full_field_guard_v1
 BEFORE INSERT OR UPDATE OF field_payload,source,field_status
 ON public.official_races
 FOR EACH ROW EXECUTE FUNCTION private.jra_verified_ready_full_field_guard_v1();