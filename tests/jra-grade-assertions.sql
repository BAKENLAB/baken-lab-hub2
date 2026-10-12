-- Execute with psql -v ON_ERROR_STOP=1 after isolated schema and candidate function.
-- A thrown error is a failed GitHub Actions job. No production connection.

DO $$
DECLARE v_job uuid; b jsonb;
BEGIN
 v_job:=public.grade_test_seed(1);
 b:=public.grade_test_payload();

 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{runners,0}',(b#>'{runners,0}')-'grade'),'JRA_SAVE_GRADE_INVALID');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{runners,0,grade}','"Z"'::jsonb),'JRA_SAVE_GRADE_INVALID');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{runners,0}',(b#>'{runners,0}')-'reason'),'JRA_SAVE_GRADE_REASON_MISSING');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{runners}',b->'runners'||(b->'runners'->0)),'JRA_SAVE_DUPLICATE_RUNNER');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{top5,0}',(b#>'{top5,0}')-'grade'),'JRA_SAVE_GRADE_INVALID');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{top5,0}',(b#>'{top5,0}')-'reason'),'JRA_SAVE_GRADE_REASON_MISSING');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{top5,0,grade}','"A"'::jsonb),'JRA_SAVE_RUNNER_DISAGREEMENT');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{top5,0,rank}','2'::jsonb),'JRA_SAVE_RUNNER_DISAGREEMENT');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{top5,0,horse_name}','"Wrong Name"'::jsonb),'JRA_SAVE_RUNNER_DISAGREEMENT');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{eye}',(b->'eye')-'grade'),'JRA_SAVE_GRADE_INVALID');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{eye}',(b->'eye')-'concrete_upside_reason'),'JRA_SAVE_GRADE_REASON_MISSING');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{eye,rank}','5'::jsonb),'JRA_SAVE_RUNNER_DISAGREEMENT');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{eye,horse_name}','"Wrong Eye Name"'::jsonb),'JRA_SAVE_RUNNER_DISAGREEMENT');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{eye}','[]'::jsonb),'JRA_SAVE_EYE_SHAPE');
 PERFORM public.grade_test_expect_reject(v_job,jsonb_set(b,'{bets}','["unsafe"]'::jsonb),'JRA_SAVE_MARKET_SEPARATION');
 RAISE NOTICE 'PASS: 15 adverse and legacy guard cases';
END
$$;

DO $$
DECLARE v_job uuid; b jsonb; saved uuid;
BEGIN
 v_job:=public.grade_test_seed(2);
 b:=jsonb_set(public.grade_test_payload(),'{eye}','null'::jsonb);
 saved:=public.jra_save_claimed_prediction(v_job,'JRA_TEST_GRADE_GUARD_1',b);
 IF saved IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.official_predictions WHERE id=saved AND status='FROZEN' AND payload=b
 ) THEN RAISE EXCEPTION 'Valid EYE=null not saved byte-for-byte'; END IF;
 IF (SELECT job_status FROM public.jra_prediction_jobs WHERE id=v_job)<>'DONE'
  OR (SELECT completed_count FROM public.jra_prediction_worker_runs WHERE id='11111111-1111-4111-8111-111111111111')<>1
 THEN RAISE EXCEPTION 'Valid EYE=null worker/job side effects incorrect'; END IF;
 RAISE NOTICE 'PASS: valid EYE=null saved identical payload, job DONE, count incremented';
END
$$;

DO $$
DECLARE v_job uuid; b jsonb; saved uuid;
BEGIN
 v_job:=public.grade_test_seed(3);
 b:=public.grade_test_payload();
 saved:=public.jra_save_claimed_prediction(v_job,'JRA_TEST_GRADE_GUARD_1',b);
 IF saved IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.official_predictions WHERE id=saved AND status='FROZEN' AND payload=b AND source='CHATGPT' AND circuit='JRA'
 ) THEN RAISE EXCEPTION 'Valid EYE selected not saved byte-for-byte'; END IF;
 IF (SELECT job_status FROM public.jra_prediction_jobs WHERE id=v_job)<>'DONE'
  OR (SELECT completed_count FROM public.jra_prediction_worker_runs WHERE id='11111111-1111-4111-8111-111111111111')<>2
 THEN RAISE EXCEPTION 'Valid selected EYE worker/job side effects incorrect'; END IF;
 RAISE NOTICE 'PASS: valid selected EYE saved identical payload, job DONE, count incremented';
END
$$;

DO $$
DECLARE d text; p record;
BEGIN
 SELECT pg_get_functiondef('public.jra_save_claimed_prediction(uuid,text,jsonb)'::regprocedure) INTO d;
 SELECT * INTO p FROM pg_proc WHERE oid='public.jra_save_claimed_prediction(uuid,text,jsonb)'::regprocedure;
 IF NOT p.prosecdef OR p.provolatile <> 'v'
  OR position('JRA_SAVE_STALE_CLAIM' IN d)=0
  OR position('JRA_SAVE_PROTOCOL_MISMATCH' IN d)=0
  OR position('JRA_SAVE_GRADE_INVALID' IN d)=0
  OR position('JRA_SAVE_RUNNER_DISAGREEMENT' IN d)=0
  OR position('JRA_SAVE_ALREADY_EXISTS' IN d)=0
 THEN
  RAISE EXCEPTION 'Missing expected function contract';
 END IF;
 RAISE NOTICE 'PASS: function created with SECURITY DEFINER, original and grade guard statements';
END
$$;
