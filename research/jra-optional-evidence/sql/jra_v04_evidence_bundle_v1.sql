-- JRA 0.4: independent all-runners evidence bundle.
-- Read-only diagnostic; *not* connected to guarded CLAIM or FROZEN save.
-- Always optional. Prediction must proceed if this read is absent or fails.
CREATE OR REPLACE FUNCTION private.jra_v04_evidence_bundle_v1(
  p_race_date date,p_track text,p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $fn$
SELECT jsonb_build_object(
  'race_date',p_race_date,'track',p_track,'race_no',p_race_no,
  'source','JRA_HISTORICAL_READ_ONLY',
  'mode','OPTIONAL_RESEARCH',
  'score_effect',0,
  'rank_effect',false,
  'comment_missing_blocks',false,
  'post_target_data_allowed',false,
  'runners',COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'horse_no',x.horse_no,
        'horse_name',x.horse_name,
        'past_race_content',coalesce(x.history,'[]'::jsonb),
        'opponent_followups',coalesce(
          private.jra_prior_opponent_evidence_v1(
            p_race_date,p_track,p_race_no,x.horse_no
          )->'rival_followups','[]'::jsonb
        )
      ) ORDER BY x.horse_no
    )
    FROM jsonb_to_recordset(
      private.jra_optional_content_evidence_v1(
        p_race_date,p_track,p_race_no
      )
    ) AS x(horse_no integer,horse_name text,history jsonb)
  ),'[]'::jsonb)
);
$fn$;
REVOKE ALL ON FUNCTION private.jra_v04_evidence_bundle_v1(date,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_v04_evidence_bundle_v1(date,text,integer) FROM anon,authenticated;
