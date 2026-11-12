-- READ ONLY / NON-CERTIFIED RETROSPECTIVE AUDIT, never a pre-CLAIM source.
-- Fixed whole-day cohort: 2026-11-11 LOCAL (all tracks and race numbers).
-- horse_runs is historical archive through 2026-08-31 at inspection time.
-- WARNING: horse_name alone does not establish immutable horse identity.
-- WARNING: course metadata below comes from the *post-race* official result.
-- Output cannot be used for production ranking, official pre-race metrics, or
-- the protected FROZEN save path. This is for exploratory algorithm diagnosis.
-- NEVER replace archived history with any current-race outcome.
SELECT p.race_date,p.track,p.race_no,p.race_name,p.post_time,p.frozen_at,
       r.result->'metadata' AS retrospective_course_metadata,
       r.result->'finishers' AS retrospective_finishers,
       (SELECT jsonb_agg(
         jsonb_build_object(
           'horse_no',(x->>'horse_no')::integer,
           'horse_name',x->>'horse_name',
           'rank',(x->>'rank')::integer,
           'history',COALESCE((
             SELECT jsonb_agg(
               jsonb_build_object(
                 'date',h.race_date,'track',h.track,
                 'class',h.race_name,'finish',h.finish,
                 'surface',h.surface,'distance',h.distance,
                 'early_pos',h.early_pos,'final_turn_pos',h.final_turn_pos,
                 -- Raw NAR margins are usually not winner-relative.
                 'margin',NULL
               ) ORDER BY h.race_date DESC)
             FROM (
               SELECT race_date,track,race_name,finish,surface,distance,
                      early_pos,final_turn_pos
               FROM public.horse_runs
               WHERE horse_name=x->>'horse_name'
                 AND race_date<p.race_date
                 AND race_type='平地'
               ORDER BY race_date DESC LIMIT 12
             ) h
           ),'[]'::jsonb)
         ) ORDER BY (x->>'rank')::integer)
        FROM jsonb_array_elements(p.payload->'runners') x
        WHERE x->>'status'='ACTIVE') AS runners
FROM public.official_predictions p
JOIN public.official_results r USING (race_date,track,race_no,circuit)
WHERE p.status='FROZEN' AND p.circuit='LOCAL'
  AND p.race_date='2026-11-11'
  AND p.frozen_at<p.post_time
ORDER BY p.track,p.race_no;
