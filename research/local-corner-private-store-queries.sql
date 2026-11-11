-- STAGED / NOT APPLIED OR EXECUTED.
-- Bound-query contract for the trusted server-side pre-CLAIM worker only.
-- Execution requires a private PostgreSQL connection under service_role; this
-- is NOT an anon/authenticated RPC, browser API, or licence to restart Cron.
-- Input $1 for the insert is the sanitized record from
-- automation/local-corner-snapshot-handoff.mjs (JSONB). Never use string interpolation.

-- PRECLAIM INSERT (parameter $1::jsonb)
WITH p AS (
 SELECT * FROM jsonb_to_record($1::jsonb) AS x(
  circuit text,race_date date,track text,race_no integer,
  official_post_time timestamptz,as_of timestamptz,source_kind text,
  source_version text,source_status text,active_runner_count integer,
  official_roster_digest text,payload_digest text,evidence jsonb,data_quality jsonb
 )
)
INSERT INTO private.lab_preclaim_evidence_snapshots_v1
 (circuit,race_date,track,race_no,official_post_time,as_of,source_kind,
  source_version,source_status,active_runner_count,official_roster_digest,
  payload_digest,evidence,data_quality)
SELECT circuit,race_date,track,race_no,official_post_time,as_of,source_kind,
       source_version,source_status,active_runner_count,official_roster_digest,
       payload_digest,evidence,COALESCE(data_quality,'{}'::jsonb)
FROM p
WHERE circuit='LOCAL' AND source_kind='LOCAL_OFFICIAL_CORNERS'
  AND source_version='LOCAL_CORNER_1'
  AND source_status IN ('READY','PARTIAL')
  AND clock_timestamp()<official_post_time
  AND as_of<=clock_timestamp() AND as_of<official_post_time
ON CONFLICT DO NOTHING RETURNING id,captured_at;

-- CLAIM READER (bound parameters, no SQL string concatenation):
-- $1 race_date::date; $2 track::text; $3 race_no::int;
-- $4 official_roster_digest::text; $5 before::timestamptz.
-- The JS reader additionally validates payload digest, as-of, post time,
-- current official roster digest and the no-market/no-target-result flags.
SELECT circuit,race_date,track,race_no,official_post_time,
       as_of,captured_at,source_kind,source_version,source_status,
       active_runner_count,official_roster_digest,payload_digest,evidence
FROM private.lab_preclaim_evidence_snapshots_v1
WHERE circuit='LOCAL' AND source_kind='LOCAL_OFFICIAL_CORNERS'
  AND race_date=$1::date AND track=$2::text AND race_no=$3::integer
  AND official_roster_digest=$4::text
  AND as_of<=$5::timestamptz AND captured_at<=$5::timestamptz
  AND captured_at<official_post_time
ORDER BY as_of DESC,captured_at DESC
LIMIT 1;

-- A missing row, permission denial, timeout or malformed packet returns null
-- to the optional shadow layer. None grants a CLAIM or SAVE.
