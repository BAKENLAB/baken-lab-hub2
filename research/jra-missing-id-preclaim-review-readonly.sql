-- JRA historic name-only identity candidate review (SELECT-only research).
-- For missing historic horse_ref rows, NEVER claim verified horse identity, NO SCORE.
-- Historical event and archive snapshot must predate the as-of timestamp.
WITH params AS (
 SELECT '2026-11-07'::date race_date,'福島'::text track,10::int race_no,
   '2026-11-07T04:49:12+00:00'::timestamptz asof
), current_race AS (
 SELECT rr.id,rr.race_date,rr.surface,rr.distance,rr.track
 FROM public.jra_live_races rr JOIN params p
 ON (rr.race_date,rr.track,rr.race_no)=(p.race_date,p.track,p.race_no)
), rows AS (
 SELECT lr.horse_no,lr.horse_name,ar.race_date,ar.track,ar.race_no,
  ar.surface,ar.distance,ar.class_name,ar.race_name,
  run.finish,run.early_pos,run.final_turn_pos,run.final3f,ar.halon_times,
  ar.source_checked_at,run.created_at,
  row_number() over(partition by lr.horse_no order by ar.race_date desc,ar.track,ar.race_no) rn
 FROM current_race rr JOIN public.jra_live_runners lr ON lr.live_race_id=rr.id
 JOIN public.jra_lab_runs run ON run.horse_name=lr.horse_name
 JOIN public.jra_lab_races ar ON ar.id=run.race_id
 CROSS JOIN params p
 WHERE run.record_role='full_runner' AND run.horse_ref IS NULL
   AND ar.race_date<rr.race_date
   AND ar.surface=rr.surface AND abs(ar.distance-rr.distance)<=200
   AND run.finish BETWEEN 1 AND 3
   AND run.created_at<=p.asof AND ar.created_at<=p.asof AND ar.source_checked_at<=p.asof
)
SELECT jsonb_build_object('status','REVIEW_ONLY_UNVERIFIED_ID',
 'score_effect',0,'target_result_used',false,'market_used',false,
 'race',jsonb_build_object('date',p.race_date,'track',p.track,'race_no',p.race_no),
 'asof',p.asof,'candidates',coalesce((select jsonb_agg(jsonb_build_object(
   'horse_no',r.horse_no,'horse_name',r.horse_name,
   'identity_status','UNVERIFIED_NAME_ONLY_ARCHIVE',
   'must_confirm_official_identity',true,'allow_as_scoring_evidence',false,
   'past_race_date',r.race_date,'past_track',r.track,'past_race_no',r.race_no,
   'surface',r.surface,'distance',r.distance,'race_name',r.race_name,
   'class_name',r.class_name,'finish',r.finish,'early_pos',r.early_pos,
   'final_turn_pos',r.final_turn_pos,'final3f',r.final3f,
   'archive_source_checked_at',r.source_checked_at,
   'archive_runner_created_at',r.created_at
 ) ORDER BY r.horse_no,r.race_date desc) from rows r where rn<=5),'[]'::jsonb)) review_packet
FROM params p;
