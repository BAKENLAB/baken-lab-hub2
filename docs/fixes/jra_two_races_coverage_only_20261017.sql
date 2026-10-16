-- JRA two non-prediction race coverages: 2026-10-17 Tokyo 5R newcomer with real scratch,
-- Kyoto 4R obstacle. Preserve schedule/entries WITHOUT saying official active proof or READY.
-- Live capture is independently checked against actual fetched official HTML ASCII structure.
-- Important: prediction_status=SKIPPED prevents jra_enqueue_prediction_jobs(date) from
-- enqueueing these even if a later actor calls that enqueuer. field_status=PENDING.
DO $coverage$
DECLARE
  cfg record;
  lr public.jra_live_races;
  html text;
  http_status integer;
  match_urls integer;
  match_draws integer;
  seen_draws integer;
  seen_refs integer;
  expected_draws integer;
  cap_markers integer;
  scratched_link text;
  entry_rows jsonb;
  race_metadata jsonb;
  row_count integer;
  rows_written integer;
  inserted integer := 0;
BEGIN
  IF (SELECT count(*) FROM public.official_races
        WHERE race_date='2026-10-17' AND circuit='JRA') <> 34 THEN
     RAISE EXCEPTION 'JRA_COVERAGE_STOP_EXPECTED_34_ALREADY_PRESENT';
  END IF;

  FOR cfg IN
    SELECT * FROM (VALUES
      ('京都'::text, 4::integer, 21223::bigint, 8::integer, 8::integer, 'JRA_OBSTACLE_OUTSIDE_FLAT_MODEL'::text),
      ('東京'::text, 5::integer, 21193::bigint, 9::integer, 8::integer, 'JRA_DEBUT_SCRATCH_STATUS_NOT_VERIFIED_FOR_PREDICTION'::text)
    ) x(track,race_no,http_id,expected_field,expected_numbered,reason)
  LOOP
    SELECT * INTO STRICT lr FROM public.jra_live_races
      WHERE race_date='2026-10-17' AND track=cfg.track AND race_no=cfg.race_no;
    IF lr.field_size IS DISTINCT FROM cfg.expected_field OR
       (cfg.race_no=4 AND lr.race_type IS DISTINCT FROM '障害') OR
       (cfg.race_no=5 AND (lr.race_name NOT ILIKE '%メイクデビュー%'
           OR lr.race_type IS DISTINCT FROM '平地')) THEN
      RAISE EXCEPTION 'JRA_COVERAGE_UNEXPECTED_RACE_%_%',cfg.track,cfg.race_no;
    END IF;
    IF EXISTS (SELECT 1 FROM public.official_races o
      WHERE (o.race_date,o.track,o.race_no,o.circuit) =
        (lr.race_date,lr.track,lr.race_no,'JRA'))
      OR EXISTS (SELECT 1 FROM public.jra_prediction_jobs j
      WHERE (j.race_date,j.track,j.race_no)=(lr.race_date,lr.track,lr.race_no))
      OR EXISTS (SELECT 1 FROM public.official_predictions p
      WHERE (p.race_date,p.track,p.race_no,p.circuit)
        =(lr.race_date,lr.track,lr.race_no,'JRA'))
    THEN RAISE EXCEPTION 'JRA_COVERAGE_STOP_EXISTING_STATE_%_%',cfg.track,cfg.race_no; END IF;

    SELECT status_code,content INTO http_status,html FROM net._http_response WHERE id=cfg.http_id;
    IF http_status IS DISTINCT FROM 200 OR html IS NULL
       OR position('<meta charset="Shift_JIS">' in html)=0 THEN
      RAISE EXCEPTION 'JRA_COVERAGE_SOURCE_HTTP_NOT_VERIFIED_%_%',cfg.track,cfg.race_no;
    END IF;
    SELECT count(*) INTO row_count FROM public.jra_live_runners r WHERE r.live_race_id=lr.id;
    IF row_count<>cfg.expected_field OR
      (SELECT count(DISTINCT r.horse_no) FROM public.jra_live_runners r WHERE r.live_race_id=lr.id)<>cfg.expected_field OR
      (SELECT count(DISTINCT r.horse_ref) FROM public.jra_live_runners r WHERE r.live_race_id=lr.id)<>cfg.expected_field
    THEN RAISE EXCEPTION 'JRA_COVERAGE_SOURCE_UNIQUE_FIELD_MISMATCH_%_%',cfg.track,cfg.race_no; END IF;
    -- Every horse identity link must exactly match official source in race-order.
    WITH refs AS (
      SELECT ordinality AS sequence,m[1] AS horse_ref
      FROM regexp_matches(html,'<td class="horse">[\s\S]*?<a href="([^"]*accessU\.html\?CNAME=[^"]+)"','g')
        WITH ORDINALITY t(m,ordinality)
    ),
    db AS (
      SELECT row_number() over(order by horse_no) AS sequence,horse_ref
      FROM public.jra_live_runners WHERE live_race_id=lr.id
    )
    SELECT (SELECT count(*) FROM refs),
      count(*) FILTER(WHERE db.horse_ref=refs.horse_ref)
    INTO seen_refs,match_urls FROM db LEFT JOIN refs USING(sequence);
    IF seen_refs<>cfg.expected_field OR match_urls<>cfg.expected_field THEN
      RAISE EXCEPTION 'JRA_COVERAGE_OFFICIAL_HORSE_URLS_MISMATCH_%_%:%:%',cfg.track,cfg.race_no,seen_refs,match_urls;
    END IF;
    -- Draw and horse number are explicit for all Kyoto 4R runners and eight
    -- Tokyo 5R runners. The ninth Tokyo item has current "cap"/scratch instead of number.
    WITH numbers AS (
      SELECT m[1]::integer AS draw,m[2]::integer AS horse_no
      FROM regexp_matches(html,'<td class="waku"><img src="/JRADB/img/waku/([1-8])\.png"[^>]*></td>\s*<td class="num">([0-9]{1,2})','g') AS m
    )
    SELECT (SELECT count(*) FROM numbers),
      count(*) FILTER (WHERE r.horse_no IS NOT NULL AND r.draw=numbers.draw)
    INTO seen_draws,match_draws
    FROM numbers LEFT JOIN public.jra_live_runners r
       ON r.live_race_id=lr.id AND r.horse_no=numbers.horse_no;
    IF seen_draws<>cfg.expected_numbered OR match_draws<>cfg.expected_numbered THEN
      RAISE EXCEPTION 'JRA_COVERAGE_OFFICIAL_DRAW_MISMATCH_%_%:%:%',cfg.track,cfg.race_no,seen_draws,match_draws;
    END IF;
    IF cfg.track='東京' THEN
      SELECT count(*) INTO cap_markers FROM
        regexp_matches(html,'<td class="num"><span class="cap">','g');
      SELECT r.horse_ref INTO scratched_link FROM public.jra_live_runners r
        WHERE r.live_race_id=lr.id AND r.horse_no=5;
      IF cap_markers<>1 OR scratched_link IS DISTINCT FROM
          '/JRADB/accessU.html?CNAME=pw01dud002024106490/DC' OR
          position('<td class="num"><span class="cap">' in html)=0 THEN
        RAISE EXCEPTION 'JRA_COVERAGE_SCRATCH_EVIDENCE_MISMATCH';
      END IF;
    END IF;
    -- Runners listed for schedule coverage only. "UNVERIFIED" must never be
    -- upgraded to ACTIVE from stale capture. Official scratch is separately flagged.
    SELECT jsonb_agg(jsonb_build_object(
      'horse_no',r.horse_no,'horse_name',r.horse_name,'horse_ref',r.horse_ref,
      'draw',r.draw,'sex_age',r.sex_age,'jockey',r.jockey,
      'weight_carried',r.weight_carried,'trainer',r.trainer,
      'status',CASE WHEN cfg.track='東京' AND r.horse_no=5
          THEN 'CANCELLED' ELSE 'UNVERIFIED' END,
      'source','JRA_LIVE_CAPTURE_COVERAGE_ONLY'
    ) ORDER BY r.horse_no) INTO entry_rows
    FROM public.jra_live_runners r WHERE r.live_race_id=lr.id;
    race_metadata:=jsonb_build_object(
      'race_type',lr.race_type,'surface',lr.surface,'distance',lr.distance,
      'turn',lr.turn,'course_layout',lr.course_layout,'course_text',lr.course_text,
      'class_name',lr.class_name,'field_size',lr.field_size,'cname',lr.cname
    );
    INSERT INTO public.official_races(
      race_date,track,race_no,circuit,race_name,post_time,
      source,field_payload,field_status,field_fetched_at,
      prediction_status,prediction_last_error,updated_at
    )
    VALUES(
      lr.race_date,lr.track,lr.race_no,'JRA',lr.race_name,
      ((lr.race_date::timestamp
         +make_interval(hours=>split_part(lr.post_time,'時',1)::integer,
           mins=>split_part(split_part(lr.post_time,'時',2),'分',1)::integer))
        AT TIME ZONE 'Asia/Tokyo'),
      'JRA_OFFICIAL_COVERAGE_ONLY_V1',
      jsonb_build_object(
        'race',race_metadata,'runners',entry_rows,
        'coverage_only',true,'prediction_eligible',false,
        'no_prediction_reason',cfg.reason,
        'official_schedule_checked',true,
        'official_status_verification',jsonb_build_object(
          'verified',false,'basis','READ_ONLY_STRUCTURE_MATCH_NOT_STATUS_PROOF',
          'http_response_id',cfg.http_id,
          'numbered_horses_matched',match_draws,
          'horse_urls_matched',match_urls,
          'current_cancelled_horse_no',CASE WHEN cfg.track='東京' THEN 5 ELSE NULL END
        )),
      'PENDING',clock_timestamp(),'SKIPPED',cfg.reason,clock_timestamp()
    );
    GET DIAGNOSTICS rows_written=ROW_COUNT;
    IF rows_written<>1 THEN RAISE EXCEPTION 'JRA_COVERAGE_INSERT_NOT_ONE_%_%',cfg.track,cfg.race_no; END IF;
    inserted:=inserted+rows_written;
  END LOOP;
  IF inserted<>2 OR
    (SELECT count(*) FROM public.official_races
        WHERE race_date='2026-10-17' AND circuit='JRA')<>36
  THEN RAISE EXCEPTION 'JRA_COVERAGE_FINAL_SLATE_NOT_36'; END IF;
END
$coverage$;