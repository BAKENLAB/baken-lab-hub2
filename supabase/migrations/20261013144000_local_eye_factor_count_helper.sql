-- LOCAL EYE 1.6 extra insertion guard. Existing 1.5 paths remain unchanged.
CREATE OR REPLACE FUNCTION public.local_eye_factor_count_guard_v1(p jsonb)
RETURNS void LANGUAGE plpgsql SET search_path TO 'pg_catalog' AS $eye16$
DECLARE
 a jsonb:=p->'audit'; fa jsonb; tie jsonb; c jsonb; f jsonb; cand jsonb; ck jsonb; rr jsonb;
 cat text; txt text; seen_categories text[]; seen_reasons text[]; checked_n integer;
 n integer; current_n integer; no integer; max_n integer:=0;
 leader_nos integer[]:=ARRAY[]::integer[]; pool integer[]; audit_nos integer[];
 selected integer:=NULL; selected_rank integer; selected_name text; chosen_cases integer:=0;
BEGIN
 fa:=a->'eye_positive_factor_audit';tie:=a->'eye_tie_break';
 IF jsonb_typeof(fa) IS DISTINCT FROM 'array' OR NOT (a ? 'eye_tie_break')
  OR a->>'eye_selection_method' IS DISTINCT FROM 'LOCAL_EYE_FACTOR_COUNT_V1'
  OR a->'eye_pairwise_comparison' IS DISTINCT FROM '[]'::jsonb
 THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_AUDIT'; END IF;
 IF fa::text ~* 'odds|popularity|market|人気|オッズ|単勝|市場|高配当'
    OR tie::text ~* 'odds|popularity|market|人気|オッズ|単勝|市場|高配当'
 THEN RAISE EXCEPTION 'LOCAL_EYE_MARKET_EVIDENCE'; END IF;
 IF jsonb_array_length(fa)<>(SELECT count(*) FROM jsonb_array_elements(a->'eye_candidate_audit'))
 THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_POOL';END IF;
 SELECT coalesce(array_agg((x.value->>'horse_no')::integer ORDER BY (x.value->>'horse_no')::integer),ARRAY[]::integer[])
 INTO audit_nos FROM jsonb_array_elements(fa) x;
 SELECT coalesce(array_agg((x.value->>'horse_no')::integer ORDER BY (x.value->>'horse_no')::integer),ARRAY[]::integer[])
 INTO pool FROM jsonb_array_elements(a->'eye_candidate_audit') x;
 IF audit_nos IS DISTINCT FROM pool OR
    (SELECT count(DISTINCT (x.value->>'horse_no')::integer) FROM jsonb_array_elements(fa) x)<>cardinality(pool)
 THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_POOL'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(fa) LOOP
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR
    (SELECT count(*) FROM jsonb_object_keys(c))<>2 OR
    NOT (c ?& ARRAY['horse_no','positive_factors']) OR
    jsonb_typeof(c->'positive_factors') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_SCHEMA';END IF;
  no:=(c->>'horse_no')::integer;
  SELECT value INTO cand FROM jsonb_array_elements(a->'eye_candidate_audit') WHERE value->'horse_no'=c->'horse_no';
  IF cand IS NULL OR jsonb_array_length(c->'positive_factors')>17
  THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_SCHEMA';END IF;
  seen_categories:=ARRAY[]::text[];seen_reasons:=ARRAY[]::text[];
  current_n:=0;
  FOR f IN SELECT value FROM jsonb_array_elements(c->'positive_factors') LOOP
   IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR
      (SELECT count(*) FROM jsonb_object_keys(f))<>4 OR
      NOT (f ?& ARRAY['category','reason','evidence_refs','current_relevance'])
      OR jsonb_typeof(f->'category') IS DISTINCT FROM 'string'
      OR jsonb_typeof(f->'reason') IS DISTINCT FROM 'string'
      OR btrim(f->>'reason')='' OR length(f->>'reason')>4000
      OR jsonb_typeof(f->'evidence_refs') IS DISTINCT FROM 'array'
      OR jsonb_array_length(f->'evidence_refs')=0
      OR jsonb_typeof(f->'current_relevance') IS DISTINCT FROM 'boolean'
   THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_SCHEMA';END IF;
   cat:=f->>'category';txt:=btrim(f->>'reason');
   IF cat=ANY(seen_categories) OR txt=ANY(seen_reasons) THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_DUPLICATE'; END IF;
   seen_categories:=array_append(seen_categories,cat);seen_reasons:=array_append(seen_reasons,txt);
   ck:=cand->'review_checks'->cat;
   IF ck IS NULL OR ck->>'status'<>'CHECKED'
     OR NOT (cand->'evidence_refs' @> f->'evidence_refs')
     OR NOT (ck->'evidence_refs' @> f->'evidence_refs')
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->'evidence_refs') x
        WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string' OR btrim(x.value#>>'{}')='')
   THEN RAISE EXCEPTION 'LOCAL_EYE_FACTOR_UNVERIFIED'; END IF;
   IF f->>'current_relevance'='true' THEN current_n:=current_n+1;END IF;
  END LOOP;
  n:=jsonb_array_length(c->'positive_factors');
  IF n>=2 THEN
   IF n>max_n THEN
    max_n:=n;leader_nos:=ARRAY[no];
   ELSIF n=max_n THEN
    leader_nos:=array_append(leader_nos,no);
   END IF;
  END IF;
 END LOOP;
 IF a->'partial_coverage'='true'::jsonb THEN
  IF tie IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'LOCAL_EYE_PARTIAL_COVERAGE';END IF;
  selected:=NULL;
 ELSIF max_n<2 THEN
  IF tie IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'LOCAL_EYE_TIE_BREAK_UNEXPECTED';END IF;
 ELSIF cardinality(leader_nos)=1 THEN
  selected:=leader_nos[1];
  IF tie IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'LOCAL_EYE_TIE_BREAK_UNEXPECTED';END IF;
 ELSE
  IF tie IS DISTINCT FROM 'null'::jsonb THEN
   IF jsonb_typeof(tie) IS DISTINCT FROM 'object' OR
      (SELECT count(*) FROM jsonb_object_keys(tie))<>5 OR
      NOT(tie ?& ARRAY['selected_horse_no','strength_reason','recency_reason','risk_reason','evidence_refs'])
   THEN RAISE EXCEPTION 'LOCAL_EYE_TIE_BREAK_SCHEMA';END IF;
   selected:=(tie->>'selected_horse_no')::integer;
   IF NOT(selected=ANY(leader_nos)) OR jsonb_typeof(tie->'evidence_refs') IS DISTINCT FROM 'array'
      OR jsonb_array_length(tie->'evidence_refs')=0
   THEN RAISE EXCEPTION 'LOCAL_EYE_TIE_BREAK_SCHEMA';END IF;
   SELECT value INTO cand FROM jsonb_array_elements(a->'eye_candidate_audit')
     WHERE (value->>'horse_no')::integer=selected;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tie->'evidence_refs') x
      WHERE cand->'evidence_refs' @> jsonb_build_array(x.value))
   THEN RAISE EXCEPTION 'LOCAL_EYE_TIE_BREAK_EVIDENCE';END IF;
   FOREACH cat IN ARRAY ARRAY['strength_reason','recency_reason','risk_reason'] LOOP
    IF jsonb_typeof(tie->cat) IS DISTINCT FROM 'string' OR btrim(tie->>cat)=''
      OR length(tie->>cat)>4000
    THEN RAISE EXCEPTION 'LOCAL_EYE_TIE_BREAK_EVIDENCE';END IF;
   END LOOP;
  END IF;
 END IF;
 SELECT count(*) INTO chosen_cases FROM jsonb_array_elements(a->'eye_candidate_audit')
 WHERE value->'eye_case'='true'::jsonb;
 IF selected IS NULL THEN
  IF chosen_cases<>0 OR p->'eye' IS DISTINCT FROM 'null'::jsonb
   OR a->'eye_selected_rank' IS DISTINCT FROM 'null'::jsonb
   OR jsonb_typeof(a->'eye_abstention_reason') IS DISTINCT FROM 'string'
   OR btrim(a->>'eye_abstention_reason')=''
  THEN RAISE EXCEPTION 'LOCAL_EYE_ABSTENTION';END IF;
 ELSE
  SELECT value INTO c FROM jsonb_array_elements(a->'eye_candidate_audit')
   WHERE (value->>'horse_no')::integer=selected;
  SELECT value INTO rr FROM jsonb_array_elements(p->'runners')
   WHERE (value->>'horse_no')::integer=selected;
  IF chosen_cases<>1 OR c->'eye_case' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(p->'eye') IS DISTINCT FROM 'object'
   OR p->'eye'->'horse_no' IS DISTINCT FROM c->'horse_no'
   OR p->'eye'->'horse_name' IS DISTINCT FROM rr->'horse_name'
   OR a->'eye_selected_rank' IS DISTINCT FROM rr->'rank'
   OR (p->'eye' ? 'rank' AND p->'eye'->'rank' IS DISTINCT FROM rr->'rank')
   OR jsonb_typeof(p->'eye'->'reason') IS DISTINCT FROM 'string'
   OR btrim(p->'eye'->>'reason')=''
  THEN RAISE EXCEPTION 'LOCAL_EYE_SELECTION_MISMATCH';END IF;
 END IF;
END;
$eye16$;
