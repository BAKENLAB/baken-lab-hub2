-- LAB REBORN 0.6 | opponent performance known strictly BEFORE target.
-- Research SELECT only; never use the result of target race.
-- Substitute date, track, race number ONLY with validated literals.
-- Source JRA horse IDs are normalized ten-digit codes from both live/archived
-- URLs. Japanese name alone is NOT identity.
WITH target AS (
 SELECT r.race_date target_date,r.track target_track,r.race_no target_no,
        x.horse_no target_no_of_horse,x.horse_name target_horse,
        substring(x.horse_ref FROM '([0-9]{10})/') target_horse_code
 FROM public.jra_live_races r
 JOIN public.jra_live_runners x ON x.live_race_id=r.id
 WHERE r.race_date=DATE '<TARGET_DATE>'
  AND r.track='<TARGET_TRACK>' AND r.race_no=<TARGET_RACE_NO>
  AND x.horse_ref IS NOT NULL
), meetings AS (
 SELECT t.*,r.id meeting_id,r.race_date meeting_date,
   r.track meeting_track,r.race_no meeting_no,r.surface meeting_surface,
   r.distance meeting_distance,
   x.finish own_finish,x.horse_ref own_archived_ref,
   row_number() OVER(PARTITION BY t.target_horse_code
    ORDER BY r.race_date DESC,r.track DESC,r.race_no DESC) recent_start
 FROM target t
 JOIN public.jra_lab_runs x ON substring(x.horse_ref FROM '([0-9]{10})/')=t.target_horse_code
  AND x.record_role='full_runner' AND x.finish IS NOT NULL
 JOIN public.jra_lab_races r ON r.id=x.race_id
 WHERE t.target_horse_code IS NOT NULL
   AND r.race_date<t.target_date
   AND r.race_date>=DATE '2023-01-01'
   AND COALESCE(r.race_type,'平地')<>'障害'
), rivals AS (
 SELECT m.*,x.horse_name rival_horse,x.horse_ref rival_archive_ref,
  substring(x.horse_ref FROM '([0-9]{10})/') rival_horse_code,
  x.finish rival_finish
 FROM meetings m JOIN public.jra_lab_runs x
   ON x.race_id=m.meeting_id AND x.record_role='full_runner'
   AND x.finish IS NOT NULL AND x.horse_ref IS NOT NULL
 WHERE m.recent_start<=6
  AND substring(x.horse_ref FROM '([0-9]{10})/')<>m.target_horse_code
), subsequent AS (
 SELECT v.*,r.race_date later_date,r.track later_track,r.race_no later_no,
  r.race_name later_name,r.class_name later_class,r.surface later_surface,
  r.distance later_distance,r.going later_going,x.finish later_finish,
  row_number() OVER(PARTITION BY v.target_horse_code,v.meeting_id,v.rival_horse_code
    ORDER BY r.race_date DESC,r.track DESC,r.race_no DESC) evidence_rank
 FROM rivals v
 JOIN public.jra_lab_runs x
   ON x.horse_ref=v.rival_archive_ref AND x.record_role='full_runner'
   AND x.finish BETWEEN 1 AND 3
 JOIN public.jra_lab_races r ON r.id=x.race_id
 WHERE v.rival_horse_code IS NOT NULL
  AND r.race_date>v.meeting_date AND r.race_date<v.target_date
  AND COALESCE(r.race_type,'平地')<>'障害'
)
SELECT target_date,target_track,target_no,target_no_of_horse,target_horse,
 target_horse_code,meeting_date,meeting_track,meeting_no,meeting_surface,
 meeting_distance,own_finish,rival_horse,rival_horse_code,rival_finish,
 later_date,later_track,later_no,later_name,later_class,later_surface,
 later_distance,later_finish
FROM subsequent WHERE evidence_rank<=2
ORDER BY target_no_of_horse,meeting_date DESC,rival_horse_code,later_date DESC;