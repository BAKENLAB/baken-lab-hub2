-- 2026-10-17 new horse debut races: official field remains present and VERIFIED.
-- Exclude only prediction dispatch; all four races have ZERO prior starts in entire live capture.
-- No FROZEN, existing jobs, sources, timestamps, runners, or Cron altered.
DO $guard$
DECLARE affected integer;
BEGIN
 IF (
  SELECT count(*)
  FROM public.official_races o
  JOIN public.jra_live_races l ON (l.race_date,l.track,l.race_no)=(o.race_date,o.track,o.race_no)
  WHERE o.race_date='2026-10-17' AND o.circuit='JRA'
    AND (o.track,o.race_no) IN (('京都',5),('京都',6),('新潟',5),('東京',4))
    AND o.field_status='BASIC_READY'
    AND o.source='JRA_OFFICIAL_VERIFIED_GATE_V1'
    AND o.prediction_status='PENDING'
    AND l.race_name LIKE '%メイクデビュー%'
    AND NOT EXISTS(SELECT 1 FROM public.jra_live_runners r WHERE r.live_race_id=l.id AND
      jsonb_typeof(r.past_runs)='array' AND jsonb_array_length(r.past_runs)>0)
    AND NOT EXISTS(SELECT 1 FROM public.jra_prediction_jobs j WHERE (j.race_date,j.track,j.race_no)=(l.race_date,l.track,l.race_no))
    AND NOT EXISTS(SELECT 1 FROM public.official_predictions q WHERE (q.race_date,q.track,q.race_no,q.circuit)=(l.race_date,l.track,l.race_no,'JRA'))
 )<>4 THEN RAISE EXCEPTION 'JRA_NEWCOMER_SKIP_ABORT_PRECONDITION'; END IF;
 UPDATE public.official_races o
  SET prediction_status='SKIPPED',
  prediction_last_error='JRA_DEBUT_ALL_HORSES_NO_HISTORY_MODEL_NOT_APPLICABLE',
  updated_at=clock_timestamp()
  FROM public.jra_live_races l
  WHERE (l.race_date,l.track,l.race_no)=(o.race_date,o.track,o.race_no)
    AND o.race_date='2026-10-17' AND o.circuit='JRA'
    AND (o.track,o.race_no) IN (('京都',5),('京都',6),('新潟',5),('東京',4))
    AND o.field_status='BASIC_READY'
    AND o.source='JRA_OFFICIAL_VERIFIED_GATE_V1'
    AND o.prediction_status='PENDING'
    AND l.race_name LIKE '%メイクデビュー%';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>4 THEN RAISE EXCEPTION 'JRA_NEWCOMER_SKIP_ABORT_WRITE_COUNT_%',affected; END IF;
END
$guard$;