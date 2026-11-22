\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'ledger_test' OR to_regclass('public.official_predictions') IS NOT NULL
 THEN RAISE EXCEPTION 'isolated database required'; END IF;
END $$;
CREATE SCHEMA private;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role','jra_card_writer','jra_card_reader'] LOOP
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
  END IF;
 END LOOP;
END $$;
\ir live-archive.candidate.sql
SET LOCAL ROLE jra_card_writer;
INSERT INTO private.jra_live_card_archive_v1
 (receipt_key,race_id,fetched_at,raw_bytes,raw_sha256,card_metadata)
 VALUES (repeat('a',64),'00000000-0000-0000-0000-000000000001',
         statement_timestamp(),decode('0102','hex'),encode(sha256(decode('0102','hex')),'hex'),'{}')
 ON CONFLICT DO NOTHING;
RESET ROLE;
SET LOCAL ROLE jra_card_reader;
DO $$ BEGIN
 IF (SELECT encode(raw_bytes,'hex') FROM private.jra_live_card_archive_v1) IS DISTINCT FROM '0102'
 THEN RAISE EXCEPTION 'byte round trip failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_table_privilege('jra_card_writer','private.jra_live_card_archive_v1','SELECT')
 OR has_table_privilege('jra_card_reader','private.jra_live_card_archive_v1','UPDATE, DELETE, TRUNCATE')
 OR has_table_privilege('service_role','private.jra_live_card_archive_v1','SELECT')
 OR has_table_privilege('anon','private.jra_live_card_archive_v1','SELECT')
 OR has_table_privilege('authenticated','private.jra_live_card_archive_v1','SELECT')
 THEN RAISE EXCEPTION 'archive grant exceeded'; END IF;
END $$;
ROLLBACK;
