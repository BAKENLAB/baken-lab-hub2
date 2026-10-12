-- PROPOSAL ONLY. Do not execute without separate DB registration approval.
-- Only listing metadata for these two past races; no prediction/publish RPC.
BEGIN;
DO $listing$
DECLARE r record; post_ts timestamptz; inserted_count integer := 0; n integer;
BEGIN
  IF (SELECT count(*) FROM public.jra_live_races
      WHERE race_date=DATE '2026-10-12' AND track='東京'
        AND ((race_no=1 AND id='fdd1aba5-af38-4b6a-92c4-6439ec7ce90d'::uuid)
          OR (race_no=4 AND id='7e53c8a6-02da-4c16-8e6c-85c7d6fba9c2'::uuid))) <> 2
  THEN RAISE EXCEPTION 'TOKYO_LISTING_SOURCE_MISMATCH'; END IF;
  FOR r IN SELECT * FROM public.jra_live_races
    WHERE race_date=DATE '2026-10-12' AND track='東京'
      AND id IN ('fdd1aba5-af38-4b6a-92c4-6439ec7ce90d'::uuid,
                 '7e53c8a6-02da-4c16-8e6c-85c7d6fba9c2'::uuid)
    ORDER BY race_no
  LOOP
    IF (r.race_no=1 AND (r.post_time IS DISTINCT FROM '9時50分' OR r.race_type IS DISTINCT FROM '平地'))
       OR (r.race_no=4 AND (r.post_time IS DISTINCT FROM '11時20分' OR r.race_type IS DISTINCT FROM '障害'))
    THEN RAISE EXCEPTION 'TOKYO_LISTING_SCHEDULE_MISMATCH'; END IF;
    post_ts := make_timestamptz(2026,10,12,
      CASE WHEN r.race_no=1 THEN 9 ELSE 11 END,
      CASE WHEN r.race_no=1 THEN 50 ELSE 20 END,0,'Asia/Tokyo');
    IF post_ts >= clock_timestamp() THEN
      RAISE EXCEPTION 'TOKYO_LISTING_MUST_BE_POST_START';
    END IF;
    INSERT INTO public.official_races
      (race_date,track,race_no,circuit,race_name,post_time,source,
       field_payload,field_status,field_fetched_at,prediction_status)
    VALUES (r.race_date,r.track,r.race_no,'JRA',r.race_name,post_ts,'JRA_OFFICIAL',
      jsonb_build_object('listing_only',true,'entry_status_verified',false,
        'source_checked_at',r.source_checked_at,
        'race',jsonb_build_object('cname',r.cname,'race_type',r.race_type,
          'class_name',r.class_name,'surface',r.surface,'distance',r.distance,
          'field_size',r.field_size)),
      'DISPLAY_ONLY',r.source_checked_at,
      CASE WHEN r.race_no=4 THEN 'UNSUPPORTED' ELSE 'NO_PREDICTION' END)
    ON CONFLICT (race_date,track,race_no,circuit) DO NOTHING;
    GET DIAGNOSTICS n=ROW_COUNT; inserted_count:=inserted_count+n;
  END LOOP;
  RAISE NOTICE 'TOKYO_LISTING_INSERTED=%',inserted_count;
END $listing$;
COMMIT;

-- Separate read-only verification after an approved execution:
SELECT race_date,track,race_no,circuit,post_time,field_status,prediction_status
FROM public.official_races WHERE race_date=DATE '2026-10-12'
  AND track='東京' AND circuit='JRA' AND race_no IN (1,4);
-- DB rows remain absent until separately approved. No rollback DELETE is automatic:
-- restoring UI is independent; any row deletion requires separate review/approval.
