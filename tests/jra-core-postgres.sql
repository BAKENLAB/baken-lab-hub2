-- ONLY ephemeral PostgreSQL service. No production tables, CLAIM, FROZEN or credentials.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA private;
\ir ../research/jra-scoring-integrity-20261121/core-connection/recovered/jra_segmented_diagnosis_score.sql
CREATE TEMP TABLE vectors(raw text);
\copy vectors FROM '/tmp/jra-core-vectors.json' WITH (FORMAT text)
DO $$
DECLARE v jsonb; actual numeric; expected numeric; n int:=0;
BEGIN
 FOR v IN SELECT jsonb_array_elements(raw::jsonb) FROM vectors LOOP
  actual:=private.jra_segmented_diagnosis_score(v->>'segment',
   (v->'axes'->>'today_ability')::numeric,(v->'axes'->>'win_power')::numeric,
   (v->'axes'->>'top3_stability')::numeric,(v->'axes'->>'pace_fit')::numeric,
   (v->'axes'->>'change_score')::numeric,(v->>'class_delta')::smallint,(v->>'days_since_last')::int);
  IF v->'expected'='null'::jsonb THEN
   IF actual IS NOT NULL THEN RAISE EXCEPTION 'NULL_BEHAVIOR_MISMATCH'; END IF;
  ELSE
   expected:=(v->'expected'->>'numerator')::numeric/(v->'expected'->>'denominator')::numeric;
   IF actual IS NULL OR abs(actual-expected)>0.000000000000001 THEN
    RAISE EXCEPTION 'RECOVERED_SQL_PORT_MISMATCH % % %',v,actual,expected;
   END IF;
  END IF;
  n:=n+1;
 END LOOP;
 IF n<>80 THEN RAISE EXCEPTION 'VECTOR_COUNT %',n; END IF;
 RAISE NOTICE 'PASS 80 exact-rational port versus recovered PostgreSQL function vectors';
END $$;
ROLLBACK;
DO $$ BEGIN IF to_regnamespace('private') IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_FAILED'; END IF; RAISE NOTICE 'PASS recovered function rollback'; END $$;
