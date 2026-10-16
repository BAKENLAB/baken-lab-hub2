-- 2026-10-17 JRA verified card payload repair.
-- Earlier publisher mistakenly joined each proof row using the last PLpgSQL loop v_item,
-- repeating the last horse N times in official_races.field_payload.runners.
-- This migration repairs ONLY those 33 verified, unclaimed, PENDING JRA BASIC_READY cards.
-- Never edits official_predictions, prediction jobs, market, results, or any FROZEN.
DO $repair$
DECLARE
  card record;
  source_count integer;
  source_unique integer;
  fixed_runners jsonb;
  written integer;
  repaired integer := 0;
  total_cards integer;
  incorrect integer;
BEGIN
  SELECT count(*) INTO total_cards FROM public.official_races o
    WHERE o.race_date='2026-10-17'::date AND o.circuit='JRA' AND o.field_status='BASIC_READY';
  IF total_cards<>33 THEN
    RAISE EXCEPTION 'JRA_REPAIR_ABORT_UNEXPECTED_TARGET_COUNT:%',total_cards;
  END IF;

  FOR card IN
    SELECT o.race_date,o.track,o.race_no,o.field_status,o.prediction_status,o.source,
      o.field_payload,l.id as live_race_id,l.field_size
    FROM public.official_races o
    JOIN public.jra_live_races l ON
      (l.race_date,l.track,l.race_no)=(o.race_date,o.track,o.race_no)
    WHERE o.race_date='2026-10-17'::date AND o.circuit='JRA'
      AND o.field_status='BASIC_READY'
    ORDER BY o.track,o.race_no
    FOR UPDATE OF o
  LOOP
    IF card.prediction_status IS DISTINCT FROM 'PENDING'
      OR card.source IS DISTINCT FROM 'JRA_OFFICIAL_VERIFIED_GATE_V1'
      OR card.field_payload #>> '{official_status_verification,verified}' IS DISTINCT FROM 'true'
      OR card.field_payload #>> '{official_status_verification,basis}'
        IS DISTINCT FROM 'JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1'
      OR jsonb_typeof(card.field_payload->'runners') IS DISTINCT FROM 'array'
      OR jsonb_array_length(card.field_payload->'runners')<>card.field_size
      OR (SELECT count(DISTINCT x->>'horse_no')
           FROM jsonb_array_elements(card.field_payload->'runners') AS x) <> 1
      OR (SELECT count(*) FROM jsonb_array_elements(card.field_payload->'runners') AS x
           WHERE x->>'status' IS DISTINCT FROM 'ACTIVE') <> 0
      OR EXISTS (SELECT 1 FROM public.official_predictions p
          WHERE (p.race_date,p.track,p.race_no,p.circuit)
          =(card.race_date,card.track,card.race_no,'JRA'))
      OR EXISTS (SELECT 1 FROM public.chappy_predictions p
          WHERE (p.race_date,p.track,p.race_no)=(card.race_date,card.track,card.race_no))
      OR EXISTS (SELECT 1 FROM public.jra_prediction_jobs j
          WHERE (j.race_date,j.track,j.race_no)=(card.race_date,card.track,card.race_no)
            AND j.job_status='CLAIMED' AND j.lease_until>clock_timestamp())
    THEN
      RAISE EXCEPTION 'JRA_REPAIR_ABORT_UNSAFE_CARD:%:%',card.track,card.race_no;
    END IF;
    SELECT count(*),count(DISTINCT r.horse_no)
      INTO source_count,source_unique
      FROM public.jra_live_runners r WHERE r.live_race_id=card.live_race_id;
    IF source_count<>card.field_size OR source_unique<>card.field_size THEN
      RAISE EXCEPTION 'JRA_REPAIR_ABORT_CAPTURE_MISMATCH:%:%',card.track,card.race_no;
    END IF;
    SELECT jsonb_agg(jsonb_build_object(
      'horse_no',r.horse_no,'horse_name',r.horse_name,
      'draw',r.draw,'status','ACTIVE',
      'sex_age',r.sex_age,'jockey',r.jockey,'weight_carried',r.weight_carried,
      'trainer',r.trainer,'horse_ref',r.horse_ref,'equipment',r.equipment,
      'body_weight',r.body_weight,'body_weight_diff',r.body_weight_diff
    ) ORDER BY r.horse_no)
    INTO fixed_runners
    FROM public.jra_live_runners r WHERE r.live_race_id=card.live_race_id;
    IF fixed_runners IS NULL OR jsonb_array_length(fixed_runners)<>card.field_size THEN
      RAISE EXCEPTION 'JRA_REPAIR_ABORT_CONSTRUCT_MISMATCH:%:%',card.track,card.race_no;
    END IF;
    UPDATE public.official_races o
      SET field_payload=jsonb_set(o.field_payload,'{runners}',fixed_runners,false),
          updated_at=clock_timestamp()
    WHERE (o.race_date,o.track,o.race_no,o.circuit)=
          (card.race_date,card.track,card.race_no,'JRA')
      AND o.field_status='BASIC_READY' AND o.prediction_status='PENDING'
      AND o.source='JRA_OFFICIAL_VERIFIED_GATE_V1';
    GET DIAGNOSTICS written=ROW_COUNT;
    IF written<>1 THEN
      RAISE EXCEPTION 'JRA_REPAIR_ABORT_WRITE_COUNT:%:%:%',card.track,card.race_no,written;
    END IF;
    repaired:=repaired+1;
  END LOOP;
  IF repaired<>33 THEN RAISE EXCEPTION 'JRA_REPAIR_ABORT_FINAL_WRITTEN:%',repaired; END IF;
  SELECT count(*) INTO incorrect FROM public.official_races o
    JOIN public.jra_live_races l ON
       (l.race_date,l.track,l.race_no)=(o.race_date,o.track,o.race_no)
    WHERE o.race_date='2026-10-17' AND o.circuit='JRA' AND o.field_status='BASIC_READY'
      AND (
        jsonb_array_length(o.field_payload->'runners')<>l.field_size
        OR (SELECT count(DISTINCT x->>'horse_no') FROM
              jsonb_array_elements(o.field_payload->'runners') AS x) <> l.field_size
      );
  IF incorrect<>0 THEN RAISE EXCEPTION 'JRA_REPAIR_ABORT_POST_INTEGRITY:%',incorrect; END IF;
END
$repair$;