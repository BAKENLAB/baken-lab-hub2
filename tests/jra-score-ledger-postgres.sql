-- EPHEMERAL POSTGRES ONLY. Never execute against Supabase/production.
-- Fictional save table/RPC replace actual CLAIM, READY, lease and FROZEN SQL.
-- Tests only existing arithmetic/shape candidate, NOT approved scoring/provenance.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA private;
CREATE ROLE anon;
CREATE ROLE authenticated;
\ir ../sql/jra_score_ledger_validator_candidate_v1.sql
CREATE SCHEMA ledger_fixture;
CREATE TABLE ledger_fixture.saved(payload jsonb NOT NULL);
CREATE FUNCTION ledger_fixture.save(p jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT (private.lab_jra_score_ledger_validate_v1(p,'TEST_FIXED_V1')->>'ok')::boolean THEN
  RAISE EXCEPTION 'FIXTURE_REFUSED' USING ERRCODE='check_violation';
 END IF;
 INSERT INTO ledger_fixture.saved VALUES(p);
END $$;
DO $$
DECLARE p jsonb; bad jsonb; c record; n int:=0;
BEGIN
 SELECT jsonb_build_object(
  'audit',jsonb_build_object('score_engine_id','TEST_FIXED_V1'),
  'runners',(SELECT jsonb_agg(jsonb_build_object('horse_no',i,'rank',i,'score',91-i,
    'score_ledger',jsonb_build_object('engine_id','TEST_FIXED_V1','base',90-i,
      'components',jsonb_build_array(jsonb_build_object('name','fixture','delta',1,
        'source_ref','SYNTHETIC_ONLY','asof_date','2026-11-20')))) ORDER BY i)
    FROM generate_series(1,6) i),
  'top5',(SELECT jsonb_agg(jsonb_build_object('horse_no',i,'rank',i,'score',91-i) ORDER BY i)
    FROM generate_series(1,5) i)) INTO p;
 PERFORM ledger_fixture.save(p);
 IF (SELECT count(*) FROM ledger_fixture.saved)<>1 OR
    (SELECT payload FROM ledger_fixture.saved LIMIT 1) IS DISTINCT FROM p THEN
  RAISE EXCEPTION 'VALID_SAVE_OR_PAYLOAD_PRESERVATION_FAILED'; END IF;
 RAISE NOTICE 'PASS valid fixture save and exact payload preservation';
 FOR c IN SELECT * FROM (VALUES
   ('engine',jsonb_set(p,'{audit,score_engine_id}','"OTHER"')),
   ('sum',jsonb_set(p,'{runners,0,score}','99')),
   ('missing_ledger',p #- '{runners,0,score_ledger}'),
   ('top5',jsonb_set(p,'{top5,0,horse_no}','99')),
   ('missing_source',p #- '{runners,0,score_ledger,components,0,source_ref}'),
   ('rank',jsonb_set(p,'{runners,0,rank}','9'))
 ) AS v(label,value) LOOP
  bad:=c.value;
  BEGIN
   PERFORM ledger_fixture.save(bad);
   RAISE EXCEPTION 'INVALID_FIXTURE_ACCEPTED: %',c.label;
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM ledger_fixture.saved)<>1 THEN RAISE EXCEPTION 'REFUSAL_WROTE_DATA'; END IF;
  n:=n+1; RAISE NOTICE 'PASS refusal % no partial write',c.label;
 END LOOP;
 IF n<>6 THEN RAISE EXCEPTION 'CASE_COUNT'; END IF;
 IF has_function_privilege('anon','private.lab_jra_score_ledger_validate_v1(jsonb,text)','EXECUTE') OR
    has_function_privilege('authenticated','private.lab_jra_score_ledger_validate_v1(jsonb,text)','EXECUTE') THEN
  RAISE EXCEPTION 'RPC_ACL'; END IF;
 RAISE NOTICE 'PASS anon/authenticated execute denied';
END $$;
ROLLBACK;
DO $$ BEGIN
 IF to_regnamespace('ledger_fixture') IS NOT NULL OR to_regnamespace('private') IS NOT NULL THEN
  RAISE EXCEPTION 'ROLLBACK_INCOMPLETE'; END IF;
 RAISE NOTICE 'PASS rollback removed all test objects';
END $$;
