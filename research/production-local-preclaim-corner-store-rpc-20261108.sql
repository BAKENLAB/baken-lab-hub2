-- BAKEN LAB / LOCAL official prior corner snapshots (dormant infrastructure).
-- No changes to rankings, official_predictions, CLAIM, FROZEN, workers, Cron or bets.
-- Append-only private schema, only the service_role can use restricted public RPC.
CREATE TABLE private.lab_preclaim_evidence_snapshots_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 circuit text NOT NULL CHECK (circuit IN ('JRA','LOCAL')),
 race_date date NOT NULL,
 track text NOT NULL CHECK (char_length(track) BETWEEN 1 AND 80),
 race_no integer NOT NULL CHECK (race_no BETWEEN 1 AND 14),
 official_post_time timestamptz NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 as_of timestamptz NOT NULL,
 source_kind text NOT NULL CHECK (source_kind IN
  ('JRA_ARCHIVE_ASOF','JRA_LIVE','LOCAL_ARCHIVE','OFFICIAL_RECENT','LOCAL_OFFICIAL_CORNERS','COMBINED')),
 source_version text NOT NULL,
 source_status text NOT NULL CHECK (source_status IN ('READY','PARTIAL','FAILED')),
 active_runner_count integer NOT NULL CHECK (active_runner_count BETWEEN 1 AND 24),
 official_roster_digest text NOT NULL CHECK (official_roster_digest ~ '^[0-9a-f]{64}$'),
 payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
 evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='object'),
 data_quality jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data_quality)='object'),
 CONSTRAINT preclaim_capture_window CHECK (
   captured_at < official_post_time AND as_of <= captured_at AND as_of < official_post_time
 ),
 CONSTRAINT preclaim_dedup UNIQUE
  (circuit,race_date,track,race_no,source_kind,official_roster_digest,payload_digest)
);
CREATE INDEX lab_preclaim_evidence_find_v1 ON private.lab_preclaim_evidence_snapshots_v1
 (circuit,race_date,track,race_no,as_of DESC,captured_at DESC);
ALTER TABLE private.lab_preclaim_evidence_snapshots_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.lab_preclaim_evidence_snapshots_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.lab_preclaim_evidence_snapshots_v1 TO service_role;
CREATE FUNCTION private.lab_preclaim_snapshot_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
BEGIN
 RAISE EXCEPTION 'PRECLAIM_EVIDENCE_IMMUTABLE';
END;
$$;
CREATE TRIGGER lab_preclaim_snapshot_immutable_trigger
 BEFORE UPDATE OR DELETE ON private.lab_preclaim_evidence_snapshots_v1
 FOR EACH ROW EXECUTE FUNCTION private.lab_preclaim_snapshot_immutable_v1();
REVOKE ALL ON FUNCTION private.lab_preclaim_snapshot_immutable_v1()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lab_preclaim_snapshot_immutable_v1() TO service_role;

-- This function remains invoker-privileged. Its public schema location is only
-- for PostgREST RPC routing; EXECUTE is denied to all client roles.
CREATE FUNCTION public.lab_preclaim_local_corner_insert_v1(p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
DECLARE inserted_id uuid;
BEGIN
 IF current_user <> 'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_record IS NULL OR jsonb_typeof(p_record)<>'object' OR
    p_record->>'circuit' IS DISTINCT FROM 'LOCAL' OR
    p_record->>'source_kind' IS DISTINCT FROM 'LOCAL_OFFICIAL_CORNERS' OR
    p_record->>'source_version' IS DISTINCT FROM 'LOCAL_CORNER_1' OR
    (p_record->>'source_status' IS NULL OR p_record->>'source_status' NOT IN ('READY','PARTIAL')) OR
    p_record#>>'{evidence,schemaVersion}' IS DISTINCT FROM 'LOCAL_OFFICIAL_CORNERS_1' OR
    p_record#>>'{evidence,packet,status}' IS DISTINCT FROM 'PREFETCH_ONLY' OR
    p_record#>>'{evidence,packet,marketUsed}' IS DISTINCT FROM 'false' OR
    p_record#>>'{evidence,packet,targetResultUsed}' IS DISTINCT FROM 'false' OR
    p_record#>>'{evidence,packet,claimStarted}' IS DISTINCT FROM 'false' OR
    p_record#>>'{evidence,packet,saveAuthorized}' IS DISTINCT FROM 'false' OR
    p_record#>>'{evidence,packet,rankChanged}' IS DISTINCT FROM 'false' THEN
   RAISE EXCEPTION 'UNVERIFIED_PRECLAIM_PACKET' USING ERRCODE='22023';
 END IF;
 INSERT INTO private.lab_preclaim_evidence_snapshots_v1
 (circuit,race_date,track,race_no,official_post_time,as_of,source_kind,
  source_version,source_status,active_runner_count,official_roster_digest,
  payload_digest,evidence,data_quality)
 SELECT x.circuit,x.race_date,x.track,x.race_no,x.official_post_time,
        x.as_of,x.source_kind,x.source_version,x.source_status,
        x.active_runner_count,x.official_roster_digest,x.payload_digest,
        x.evidence,coalesce(x.data_quality,'{}'::jsonb)
 FROM jsonb_to_record(p_record) AS x(
   circuit text,race_date date,track text,race_no integer,
   official_post_time timestamptz,as_of timestamptz,source_kind text,
   source_version text,source_status text,active_runner_count integer,
   official_roster_digest text,payload_digest text,evidence jsonb,data_quality jsonb
 )
 WHERE x.as_of<=clock_timestamp() AND clock_timestamp()<x.official_post_time
   AND x.as_of<x.official_post_time
 ON CONFLICT DO NOTHING RETURNING id INTO inserted_id;
 RETURN jsonb_build_object('inserted',inserted_id IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.lab_preclaim_local_corner_insert_v1(jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_preclaim_local_corner_insert_v1(jsonb) TO service_role;

CREATE FUNCTION public.lab_preclaim_local_corner_read_v1(
 p_race_date date,p_track text,p_race_no integer,
 p_roster_digest text,p_before timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
DECLARE row_result jsonb;
BEGIN
 IF current_user <> 'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_before IS NULL OR p_before>clock_timestamp() THEN RETURN NULL; END IF;
 SELECT to_jsonb(s) INTO row_result
 FROM private.lab_preclaim_evidence_snapshots_v1 s
 WHERE s.circuit='LOCAL'
   AND s.source_kind='LOCAL_OFFICIAL_CORNERS'
   AND s.source_version='LOCAL_CORNER_1'
   AND s.race_date=p_race_date AND s.track=p_track
   AND s.race_no=p_race_no AND s.official_roster_digest=p_roster_digest
   AND s.as_of<=p_before AND s.captured_at<=p_before
   AND s.captured_at<s.official_post_time
   AND p_before<s.official_post_time
 ORDER BY s.as_of DESC,s.captured_at DESC LIMIT 1;
 RETURN row_result;
END;
$$;
REVOKE ALL ON FUNCTION public.lab_preclaim_local_corner_read_v1(date,text,integer,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_preclaim_local_corner_read_v1(date,text,integer,text,timestamptz)
 TO service_role;
