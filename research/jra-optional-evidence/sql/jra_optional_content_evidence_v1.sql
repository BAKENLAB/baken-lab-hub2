-- BAKEN LAB: optional JRA prior race-content evidence. No ranking writes.
-- Security invoker in unexposed private schema, no publicly callable endpoint.
CREATE OR REPLACE FUNCTION private.jra_optional_content_evidence_v1(
  p_race_date date, p_track text, p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $fn$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'horse_no', lr.horse_no,
      'horse_name', lr.horse_name,
      'history', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'prior_date', h.prior_date,
          'prior_track', h.prior_track,
          'prior_surface', h.prior_surface,
          'prior_distance', h.prior_distance,
          'finish', h.finish,
          'margin_to_winner', h.margin_to_winner,
          'field_size', h.field_size,
          'archive_match_count', ev.archive_matches,
          'final3f', CASE WHEN ev.archive_matches=1 THEN ev.final3f END,
          'final3f_rank', CASE WHEN ev.archive_matches=1 THEN ev.final3f_rank END,
          'corner_positions', CASE WHEN ev.archive_matches=1 THEN ev.corner_positions END,
          'race_halons', CASE WHEN ev.archive_matches=1 THEN ev.halon_times END,
          'race_name', CASE WHEN ev.archive_matches=1 THEN ev.race_name END,
          'race_going', CASE WHEN ev.archive_matches=1 THEN ev.going END,
          'archive_full_field', CASE WHEN ev.archive_matches=1 THEN ev.full_field END,
          'unverified_incident', NULL
        ) ORDER BY h.rn)
        FROM private.jra_merged_flat_history_v2(
          lr.horse_name,lr.horse_ref,rr.race_date,lr.past_runs,4
        ) h
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::integer AS archive_matches,
            MAX(x.final3f) AS final3f,
            MAX(x.final3f_rank) AS final3f_rank,
            MAX(x.corner_positions) AS corner_positions,
            MAX(a.halon_times) AS halon_times,
            MAX(a.race_name) AS race_name,
            MAX(a.going) AS going,
            bool_and(a.full_field) AS full_field
          FROM public.jra_lab_races a
          JOIN public.jra_lab_runs x
            ON x.race_id=a.id AND x.record_role='full_runner'
          WHERE a.race_date=h.prior_date AND a.track=h.prior_track
            AND a.race_date < rr.race_date
            AND a.surface=h.prior_surface
            AND a.distance=h.prior_distance
            AND x.horse_name=lr.horse_name
            AND x.horse_ref IS NOT NULL AND lr.horse_ref IS NOT NULL
            AND substring(x.horse_ref FROM '([0-9]{10})/')
                = substring(lr.horse_ref FROM '([0-9]{10})/')
        ) ev ON TRUE
      ),'[]'::jsonb)
    ) ORDER BY lr.horse_no
  ),'[]'::jsonb)
  FROM public.jra_live_races rr
  JOIN public.jra_live_runners lr ON lr.live_race_id=rr.id
  WHERE rr.race_date=p_race_date
    AND rr.track=p_track AND rr.race_no=p_race_no
    AND COALESCE(rr.race_type,'')<>'障害';
$fn$;
REVOKE ALL ON FUNCTION private.jra_optional_content_evidence_v1(date,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_optional_content_evidence_v1(date,text,integer) FROM anon, authenticated;
