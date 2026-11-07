-- BAKEN LAB: historical JRA evidence as-of FROZEN/read-only.
-- RUNS AS A SELECT. Do NOT use to rewrite historical FROZEN or infer what an agent actually saw.
-- A historical archive run is eligible only if race AND runner rows were both stored by as_of.
-- Never join to the target race's finish, corner, lap, market or published outcome.
-- Editing the params CTE makes this work for other supported JRA flat races.
WITH params AS (
 SELECT '2026-11-07'::date race_date, '福島'::text track, 10::int race_no,
        '2026-11-07T04:49:12+00'::timestamptz as_of,
        20::int max_history
), target AS (
 SELECT r.id live_race_id, r.race_date, r.track, r.race_no, r.surface, r.distance,
        r.field_size
 FROM public.jra_live_races r JOIN params p
 ON (r.race_date,r.track,r.race_no)=(p.race_date,p.track,p.race_no)
 WHERE coalesce(r.race_type,'')<>'障害'
), live_runners AS (
 SELECT lr.horse_no, lr.horse_name, lr.horse_ref,
        lr.source_checked_at,
        t.race_date target_date,t.surface target_surface,t.distance target_distance,
        p.as_of,p.max_history,
        lr.source_checked_at<=p.as_of AS live_snapshot_asof_verified
 FROM target t
 JOIN public.jra_live_runners lr ON lr.live_race_id=t.live_race_id
 CROSS JOIN params p
), candidates AS (
 SELECT lr.horse_no,lr.horse_name,lr.target_surface,lr.target_distance,
        lr.live_snapshot_asof_verified,
        ar.race_date,ar.track,ar.race_no,ar.race_name,ar.surface,ar.distance,
        ar.class_name,ar.going,ar.halon_times,ar.race_final3f,
        x.finish,x.margin,x.early_pos,x.final_turn_pos,x.corner_positions,
        x.final3f,x.final3f_rank,ar.source_checked_at,x.created_at runner_created_at,
        row_number() OVER (
          PARTITION BY lr.horse_no, ar.race_date,ar.track,ar.race_no
          ORDER BY ar.source_checked_at DESC,x.created_at DESC
        ) version_rank
 FROM live_runners lr
 JOIN public.jra_lab_runs x
 ON x.horse_name=lr.horse_name AND x.record_role='full_runner'
 JOIN public.jra_lab_races ar ON ar.id=x.race_id
 WHERE ar.race_date<lr.target_date AND ar.source_checked_at<=lr.as_of
   AND ar.created_at<=lr.as_of AND x.created_at<=lr.as_of
   AND ar.surface IN ('芝','ダート')
   AND coalesce(ar.race_type,'')<>'障害'
   AND lr.horse_ref IS NOT NULL AND x.horse_ref IS NOT NULL
   AND substring(lr.horse_ref FROM '([0-9]{10})/') IS NOT NULL
   AND substring(x.horse_ref FROM '([0-9]{10})/')=
       substring(lr.horse_ref FROM '([0-9]{10})/')
), unique_history AS (
 SELECT *, row_number() OVER (
    PARTITION BY horse_no ORDER BY race_date DESC,track,race_no
 ) run_rank
 FROM candidates WHERE version_rank=1
), pack AS (
 SELECT l.horse_no,l.horse_name,l.live_snapshot_asof_verified,
    count(h.race_date)::int archive_runs_at_asof,
    count(h.early_pos)::int archive_pos_at_asof,
    count(h.final3f)::int archive_last3f_at_asof,
    count(h.halon_times)::int archive_laps_at_asof,
    count(*) FILTER(WHERE h.track=(SELECT track FROM params)
       AND h.surface=l.target_surface AND h.distance=l.target_distance
       AND h.finish BETWEEN 1 AND 3)::int same_track_distance_podium,
    coalesce(jsonb_agg(jsonb_build_object(
      'race_date',h.race_date,'track',h.track,'race_no',h.race_no,
      'surface',h.surface,'distance',h.distance,'class_name',h.class_name,
      'finish',h.finish,'margin',h.margin,'early_pos',h.early_pos,
      'final_turn_pos',h.final_turn_pos,'corner_positions',h.corner_positions,
      'last3f',h.final3f,'last3f_rank',h.final3f_rank,
      'halon_times',h.halon_times,'race_last3f',h.race_final3f,
      'archive_checked_at',h.source_checked_at,'run_created_at',h.runner_created_at
    ) ORDER BY h.race_date DESC,h.track,h.race_no)
    FILTER(WHERE h.race_date IS NOT NULL),'[]'::jsonb) runs
 FROM live_runners l
 LEFT JOIN unique_history h ON h.horse_no=l.horse_no
      AND h.run_rank<=l.max_history
 GROUP BY l.horse_no,l.horse_name,l.live_snapshot_asof_verified,
          l.target_surface,l.target_distance
)
SELECT jsonb_build_object(
 'race',jsonb_build_object('date',p.race_date,'track',p.track,'race_no',p.race_no),
 'as_of',p.as_of,'historical_event_cutoff','STRICTLY_BEFORE_TARGET_RACE',
 'archive_source_cutoff','BOTH_ARCHIVE_AND_RUN_ROWS_NO_LATER_THAN_AS_OF',
 'market_used',false,'target_race_results_used',false,'rank_effect','NONE',
 'field_size',(SELECT field_size FROM target),
 'runner_count',(SELECT count(*) FROM pack),
 'all_runners_with_archive_history',(SELECT count(*) FROM pack WHERE archive_runs_at_asof>0),
 'all_runners_with_lap_history',(SELECT count(*) FROM pack WHERE archive_laps_at_asof>0),
 'live_snapshot_verified_asof_count',(SELECT count(*) FROM pack WHERE live_snapshot_asof_verified),
 'runners',coalesce((SELECT jsonb_agg(to_jsonb(pack) ORDER BY horse_no) FROM pack),'[]'::jsonb)
) AS historical_evidence_packet
FROM params p;
