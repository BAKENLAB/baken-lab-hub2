-- REVIEW ONLY. NOT APPLIED. Requires isolated PostgreSQL execution tests before approval.
-- Future INSERTs only. Never UPDATE/DELETE any prediction, rank, TOP5 or registry row.
-- INSERT guard covers 1.5 RPC and direct writers. 1.4 retains its current guards.
BEGIN;
CREATE FUNCTION public.local_eye_comparison_insert_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $body$
DECLARE
 p jsonb; a jsonb; c jsonb; q jsonb; k text; r jsonb; item jsonb;
 outside integer[]; pool integer[]; candidate_nos integer[]; top_nos integer[];
 pair integer[]; seen text[] := ARRAY[]::text[]; pair_key text;
 preferred integer; winner integer; winner_n integer := 0; wins integer;
 checks text[] := ARRAY['distance_change','track_change','going_change','class_change',
  'promotion_demotion','weight_change','jockey_change','draw','running_style','pace_peers',
  'margins','passing_order','final_section','trouble','layoff_preparation',
  'current_suitability','same_condition_history'];
BEGIN
 IF NEW.circuit IS DISTINCT FROM 'LOCAL' THEN RETURN NEW; END IF;
 IF NEW.protocol_version IS DISTINCT FROM 'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004' THEN
  RETURN NEW;
 END IF;
 p := NEW.payload; a := p->'audit';
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'LOCAL_EYE_PAYLOAD_KEYS'; END IF;
 IF NOT (p ?& ARRAY['runners','top5','eye','bets','summary','bet_strategy','audit'])
  OR (SELECT count(*) FROM jsonb_object_keys(p))<>7 THEN RAISE EXCEPTION 'LOCAL_EYE_PAYLOAD_KEYS'; END IF;
 IF p->'bets' IS DISTINCT FROM '[]'::jsonb
  OR p->'bet_strategy' IS DISTINCT FROM '"SUSPENDED_FOR_ABILITY_STABILITY"'::jsonb THEN
  RAISE EXCEPTION 'LOCAL_EYE_BET_CONTRACT'; END IF;
 IF jsonb_typeof(p->'runners') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p->'top5') IS DISTINCT FROM 'array'
  OR jsonb_typeof(a) IS DISTINCT FROM 'object'
  OR jsonb_typeof(a->'eye_candidate_audit') IS DISTINCT FROM 'array'
  OR jsonb_typeof(a->'eye_pool_checked') IS DISTINCT FROM 'array'
  OR jsonb_typeof(a->'eye_pairwise_comparison') IS DISTINCT FROM 'array'
  OR a->>'protocol_version' IS DISTINCT FROM NEW.protocol_version
  OR a->'rank6_auto_selected' IS DISTINCT FROM 'false'::jsonb
  OR a->'market_used_for_eye' IS DISTINCT FROM 'false'::jsonb
  OR a->>'eye_reaudit_guard' IS DISTINCT FROM 'EYE_REAUDIT_GUARD_20260929'
  OR a->>'eye_selection_method' IS DISTINCT FROM 'LOCAL_EYE_COMPARISON_V1' THEN
  RAISE EXCEPTION 'LOCAL_EYE_AUDIT';
 END IF;
 IF jsonb_array_length(p->'runners') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'LOCAL_EYE_RUNNERS'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'runners') LOOP
  IF r->>'status' IN ('CANCELLED','EXCLUDED') THEN CONTINUE; END IF;
  IF jsonb_typeof(r->'horse_no') IS DISTINCT FROM 'number' OR r->>'horse_no' !~ '^[1-9][0-9]*$'
   OR jsonb_typeof(r->'rank') IS DISTINCT FROM 'number' OR r->>'rank' !~ '^[1-9][0-9]*$'
   OR jsonb_typeof(r->'horse_name') IS DISTINCT FROM 'string' OR btrim(r->>'horse_name')='' THEN
   RAISE EXCEPTION 'LOCAL_EYE_RUNNERS';
  END IF;
 END LOOP;
 IF (SELECT count(*)<>count(DISTINCT value->>'horse_no') FROM jsonb_array_elements(p->'runners'))
  OR (SELECT count(*)<>count(DISTINCT value->>'rank') FROM jsonb_array_elements(p->'runners')
   WHERE coalesce(value->>'status','') NOT IN ('CANCELLED','EXCLUDED')) THEN RAISE EXCEPTION 'LOCAL_EYE_RUNNERS'; END IF;
 SELECT coalesce(array_agg((value->>'horse_no')::integer ORDER BY (value->>'horse_no')::integer),ARRAY[]::integer[])
 INTO top_nos FROM jsonb_array_elements(p->'runners') WHERE (value->>'rank')::integer<=5
  AND coalesce(value->>'status','') NOT IN ('CANCELLED','EXCLUDED');
 IF top_nos IS DISTINCT FROM (SELECT coalesce(array_agg((value->>'horse_no')::integer ORDER BY (value->>'horse_no')::integer),ARRAY[]::integer[]) FROM jsonb_array_elements(p->'top5')) THEN
  RAISE EXCEPTION 'LOCAL_EYE_TOP5_IDENTITY'; END IF;
 SELECT coalesce(array_agg((value->>'horse_no')::integer ORDER BY (value->>'horse_no')::integer),ARRAY[]::integer[])
 INTO outside FROM jsonb_array_elements(p->'runners') WHERE NOT ((value->>'horse_no')::integer=ANY(top_nos))
  AND coalesce(value->>'status','') NOT IN ('CANCELLED','EXCLUDED');
 SELECT coalesce(array_agg(value::text::integer ORDER BY value::text::integer),ARRAY[]::integer[]) INTO pool
 FROM jsonb_array_elements(a->'eye_pool_checked');
 SELECT coalesce(array_agg((value->>'horse_no')::integer ORDER BY (value->>'horse_no')::integer),ARRAY[]::integer[])
 INTO candidate_nos FROM jsonb_array_elements(a->'eye_candidate_audit');
 IF outside IS DISTINCT FROM pool OR outside IS DISTINCT FROM candidate_nos THEN
  RAISE EXCEPTION 'LOCAL_EYE_CANDIDATE_SET'; END IF;
 -- Deep market-key / text rejection applies only to EYE inputs, not existing unrelated audit flags.
 item := jsonb_build_array(a->'eye_candidate_audit',a->'eye_pairwise_comparison',p->'eye');
 IF jsonb_path_exists(item,'$.**.keyvalue() ? (@.key like_regex "odds|popularity|market|人気|オッズ|単勝|市場" flag "i")')
  OR item::text ~* 'odds|popularity|人気|オッズ|高配当|市場情報' THEN RAISE EXCEPTION 'LOCAL_EYE_MARKET_EVIDENCE'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(a->'eye_candidate_audit') LOOP
  SELECT value INTO r FROM jsonb_array_elements(p->'runners') WHERE value->'horse_no'=c->'horse_no';
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(c))<>9
   OR NOT (c ?& ARRAY['horse_no','rank','upside_trigger','hidden_evidence','finish_path','risk','eye_case','evidence_refs','review_checks'])
   OR r IS NULL OR jsonb_typeof(c->'horse_no') IS DISTINCT FROM 'number'
   OR c->'rank' IS DISTINCT FROM r->'rank' OR jsonb_typeof(c->'eye_case') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(c->'evidence_refs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'LOCAL_EYE_CANDIDATE_SCHEMA'; END IF;
  IF (c->'eye_case'='true'::jsonb AND jsonb_array_length(c->'evidence_refs')=0) OR EXISTS(SELECT 1 FROM jsonb_array_elements(c->'evidence_refs') WHERE jsonb_typeof(value)<>'string' OR btrim(value#>>'{}')='') THEN
   RAISE EXCEPTION 'LOCAL_EYE_CANDIDATE_EVIDENCE'; END IF;
  FOREACH k IN ARRAY ARRAY['upside_trigger','hidden_evidence','finish_path','risk'] LOOP
   IF jsonb_typeof(c->k) IS DISTINCT FROM 'string' OR btrim(c->>k)='' OR length(c->>k)>4000
    OR c->>k ~* '(6|６)位だから|TOP5(の)?次点|能力順位(だけ|のみ)|rank\s*={1,3}\s*6|(配列|候補)(の)?先頭' THEN
    RAISE EXCEPTION 'LOCAL_EYE_SPECIFIC_EVIDENCE'; END IF;
  END LOOP;
  IF jsonb_typeof(c->'review_checks') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'LOCAL_EYE_CHECKS'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(c->'review_checks'))<>17 OR NOT (c->'review_checks' ?& checks) THEN
   RAISE EXCEPTION 'LOCAL_EYE_CHECKS'; END IF;
  FOREACH k IN ARRAY checks LOOP
   q := c->'review_checks'->k;
   IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(q))<>3
    OR NOT(q ?& ARRAY['status','finding','evidence_refs']) OR jsonb_typeof(q->'finding') IS DISTINCT FROM 'string'
    OR btrim(q->>'finding')='' OR jsonb_typeof(q->'evidence_refs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'LOCAL_EYE_CHECK_SCHEMA'; END IF;
   IF q->>'status'='CHECKED' THEN
    IF jsonb_array_length(q->'evidence_refs')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(q->'evidence_refs') WHERE jsonb_typeof(value)<>'string' OR btrim(value#>>'{}')='') THEN RAISE EXCEPTION 'LOCAL_EYE_CHECK_EVIDENCE'; END IF;
   ELSIF q->>'status'='MISSING' THEN
    IF jsonb_array_length(q->'evidence_refs')<>0 THEN RAISE EXCEPTION 'LOCAL_EYE_MISSING_INVENTED'; END IF;
   ELSE RAISE EXCEPTION 'LOCAL_EYE_CHECK_STATUS'; END IF;
  END LOOP;
  IF c->'eye_case'='true'::jsonb AND NOT EXISTS(SELECT 1 FROM jsonb_each(c->'review_checks') WHERE value->>'status'='CHECKED') THEN RAISE EXCEPTION 'LOCAL_EYE_UNSUPPORTED_CASE'; END IF;
 END LOOP;
 IF jsonb_array_length(a->'eye_pairwise_comparison')<>cardinality(outside)*(cardinality(outside)-1)/2 THEN RAISE EXCEPTION 'LOCAL_EYE_PAIR_COVERAGE'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(a->'eye_pairwise_comparison') LOOP
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(c))<>5
   OR NOT(c ?& ARRAY['horse_nos','preferred_horse_no','criterion','reason','evidence_refs'])
   OR jsonb_typeof(c->'horse_nos') IS DISTINCT FROM 'array' OR jsonb_typeof(c->'evidence_refs') IS DISTINCT FROM 'array'
   OR c->>'criterion' IS DISTINCT FROM 'CURRENT_UPSIDE_OVER_BASELINE'
   OR jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR btrim(c->>'reason')='' OR length(c->>'reason')>4000
   OR c->>'reason' ~* '(6|６)位だから|TOP5(の)?次点|能力順位(だけ|のみ)|(配列|候補)(の)?先頭' THEN RAISE EXCEPTION 'LOCAL_EYE_PAIR_EVIDENCE'; END IF;
  SELECT array_agg(value::text::integer ORDER BY value::text::integer) INTO pair FROM jsonb_array_elements(c->'horse_nos');
  IF cardinality(pair)<>2 OR pair[1]=pair[2] OR NOT(pair<@outside) THEN RAISE EXCEPTION 'LOCAL_EYE_PAIR_IDENTITY'; END IF;
  pair_key := array_to_string(pair,':');IF pair_key=ANY(seen) THEN RAISE EXCEPTION 'LOCAL_EYE_PAIR_DUPLICATE'; END IF;
  seen := array_append(seen,pair_key);
  FOREACH preferred IN ARRAY pair LOOP
   SELECT value INTO q FROM jsonb_array_elements(a->'eye_candidate_audit') WHERE (value->>'horse_no')::integer=preferred;
   IF (c->'preferred_horse_no'<>'null'::jsonb OR jsonb_array_length(q->'evidence_refs')>0)
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'evidence_refs') ref WHERE q->'evidence_refs' @> jsonb_build_array(ref.value)) THEN RAISE EXCEPTION 'LOCAL_EYE_PAIR_UNLINKED'; END IF;
  END LOOP;
  IF c->'preferred_horse_no'<>'null'::jsonb THEN
   preferred := (c->>'preferred_horse_no')::integer;
   IF NOT(preferred=ANY(pair)) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a->'eye_candidate_audit') WHERE (value->>'horse_no')::integer=preferred AND value->'eye_case'='true'::jsonb) THEN RAISE EXCEPTION 'LOCAL_EYE_PAIR_PREFERENCE'; END IF;
  END IF;
 END LOOP;
 FOR c IN SELECT value FROM jsonb_array_elements(a->'eye_candidate_audit') WHERE value->'eye_case'='true'::jsonb LOOP
  SELECT count(*) INTO wins FROM jsonb_array_elements(a->'eye_pairwise_comparison') WHERE value->'preferred_horse_no'=c->'horse_no';
  IF wins=cardinality(outside)-1 THEN winner:=(c->>'horse_no')::integer;winner_n:=winner_n+1;END IF;
 END LOOP;
 IF winner_n<>1 THEN
  IF p->'eye' IS DISTINCT FROM 'null'::jsonb OR a->'eye_selected_rank' IS DISTINCT FROM 'null'::jsonb
   OR jsonb_typeof(a->'eye_abstention_reason') IS DISTINCT FROM 'string' OR btrim(a->>'eye_abstention_reason')=''
   OR a->>'eye_abstention_reason' ~* 'odds|popularity|人気|オッズ|(6|６)位だから|(配列|候補)(の)?先頭' THEN RAISE EXCEPTION 'LOCAL_EYE_ABSTENTION'; END IF;
 ELSE
  SELECT value INTO r FROM jsonb_array_elements(p->'runners') WHERE (value->>'horse_no')::integer=winner;
  IF jsonb_typeof(p->'eye') IS DISTINCT FROM 'object' OR p->'eye'->'horse_no' IS DISTINCT FROM r->'horse_no'
   OR p->'eye'->'horse_name' IS DISTINCT FROM r->'horse_name' OR a->'eye_selected_rank' IS DISTINCT FROM r->'rank'
   OR (p->'eye' ? 'rank' AND p->'eye'->'rank' IS DISTINCT FROM r->'rank')
   OR jsonb_typeof(p->'eye'->'reason') IS DISTINCT FROM 'string' OR btrim(p->'eye'->>'reason')=''
   OR p->'eye'->>'reason' ~* '(6|６)位だから|TOP5(の)?次点|能力順位(だけ|のみ)|(配列|候補)(の)?先頭' THEN RAISE EXCEPTION 'LOCAL_EYE_SELECTION_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END
$body$;
REVOKE ALL ON FUNCTION public.local_eye_comparison_insert_guard() FROM PUBLIC;
CREATE TRIGGER trg_local_eye_comparison_insert
 BEFORE INSERT ON public.official_predictions
 FOR EACH ROW WHEN (NEW.circuit = 'LOCAL' AND NEW.protocol_version = 'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004')
 EXECUTE FUNCTION public.local_eye_comparison_insert_guard();
COMMIT;
