-- STAGED / NOT APPLIED. Append-only pre-CLAIM evidence snapshots for JRA + LOCAL.
-- This does NOT touch official_predictions, FROZEN, claims, results, odds or Cron.
-- Installation, DDL review, grants and worker wiring require separate approval.
-- The optional LOCAL_OFFICIAL_CORNERS packet is only looked up after core CLAIM checks.\n-- Store only independently verified historical data and explicitly flagged
-- unverified candidates; never store source secrets or market/popularity.

CREATE TABLE IF NOT EXISTS private.lab_preclaim_evidence_snapshots_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit text NOT NULL CHECK (circuit IN ('JRA','LOCAL')),
  race_date date NOT NULL,
  track text NOT NULL CHECK (char_length(track) BETWEEN 1 AND 80),
  race_no integer NOT NULL CHECK (race_no BETWEEN 1 AND 14),
  official_post_time timestamptz NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  as_of timestamptz NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('JRA_ARCHIVE_ASOF','JRA_LIVE','LOCAL_ARCHIVE','OFFICIAL_RECENT','LOCAL_OFFICIAL_CORNERS','COMBINED')),
  source_version text NOT NULL,
  source_status text NOT NULL CHECK (source_status IN ('READY','PARTIAL','FAILED')),
  active_runner_count integer NOT NULL CHECK (active_runner_count BETWEEN 1 AND 24),
  official_roster_digest text NOT NULL CHECK (char_length(official_roster_digest)=64),
  payload_digest text NOT NULL CHECK (char_length(payload_digest)=64),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='object'),
  data_quality jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data_quality)='object'),
  CONSTRAINT preclaim_capture_window CHECK (
    captured_at < official_post_time
    AND as_of <= captured_at AND as_of < official_post_time
  ),
  CONSTRAINT preclaim_dedup UNIQUE(
    circuit,race_date,track,race_no,source_kind,official_roster_digest,payload_digest
  )
);
CREATE INDEX IF NOT EXISTS lab_preclaim_evidence_find_v1
 ON private.lab_preclaim_evidence_snapshots_v1
 (circuit,race_date,track,race_no,as_of DESC,captured_at DESC);

-- No public/anon/authenticated read or write permissions. No SECURITY DEFINER.
REVOKE ALL ON TABLE private.lab_preclaim_evidence_snapshots_v1 FROM PUBLIC,anon,authenticated;
ALTER TABLE private.lab_preclaim_evidence_snapshots_v1 ENABLE ROW LEVEL SECURITY;

-- Immutable history: never rewrite the evidence available at a prior moment.
CREATE OR REPLACE FUNCTION private.lab_preclaim_snapshot_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','private'
AS $$
BEGIN
  RAISE EXCEPTION 'PRECLAIM_EVIDENCE_IMMUTABLE';
END;
$$;
DROP TRIGGER IF EXISTS lab_preclaim_snapshot_immutable_trigger
 ON private.lab_preclaim_evidence_snapshots_v1;
CREATE TRIGGER lab_preclaim_snapshot_immutable_trigger
 BEFORE UPDATE OR DELETE ON private.lab_preclaim_evidence_snapshots_v1
 FOR EACH ROW EXECUTE FUNCTION private.lab_preclaim_snapshot_immutable_v1();

-- No public RPC or blanket grant. An already-authorized private worker
-- must insert with the exact official roster; ON CONFLICT DO NOTHING is allowed
-- to avoid duplicate retry failures without overwriting saved snapshots.
-- Pre-CLAIM checks only; normal READY/CLAIM/lease/save gates remain authoritative.
