-- CANDIDATE ONLY. NOT APPLIED. Requires extensions.digest(bytea,text) already installed.
BEGIN;
DO $$ BEGIN IF to_regnamespace('jra_evidence_private') IS NOT NULL OR to_regprocedure('public.jra_store_html_evidence_v1(jsonb,bytea)') IS NOT NULL THEN RAISE EXCEPTION 'TARGET_ALREADY_EXISTS'; END IF; END $$;
CREATE SCHEMA jra_evidence_private;
REVOKE ALL ON SCHEMA jra_evidence_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA jra_evidence_private TO service_role;
CREATE TABLE jra_evidence_private.html_blobs (
 wire_sha256 text PRIMARY KEY CHECK(wire_sha256 ~ '^[a-f0-9]{64}$'),
 decoded_utf8_sha256 text NOT NULL CHECK(decoded_utf8_sha256 ~ '^[a-f0-9]{64}$'),
 gzip_sha256 text NOT NULL CHECK(gzip_sha256 ~ '^[a-f0-9]{64}$'),
 body_gzip bytea NOT NULL,
 raw_bytes integer NOT NULL CHECK(raw_bytes BETWEEN 1 AND 2097152),
 compressed_bytes integer NOT NULL CHECK(compressed_bytes BETWEEN 1 AND 2097152 AND compressed_bytes=octet_length(body_gzip)),
 encoding text NOT NULL CHECK(encoding='shift_jis'),
 CHECK(gzip_sha256=encode(extensions.digest(body_gzip,'sha256'),'hex'))
);
CREATE TABLE jra_evidence_private.html_captures (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 wire_sha256 text NOT NULL REFERENCES jra_evidence_private.html_blobs,
 race_date date NOT NULL,track_code text NOT NULL CHECK(track_code ~ '^[0-9]{2}$'),
 race_no smallint NOT NULL CHECK(race_no BETWEEN 1 AND 12),cname text NOT NULL,
 source_url text NOT NULL CHECK(source_url LIKE 'https://www.jra.go.jp/JRADB/accessD.html?CNAME=%'),
 fetched_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 status_verified boolean NOT NULL DEFAULT false CHECK(NOT status_verified),
 CHECK(fetched_at<=received_at AND expires_at=fetched_at+interval '30 days'),
 UNIQUE(cname,wire_sha256,fetched_at)
);
ALTER TABLE jra_evidence_private.html_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jra_evidence_private.html_blobs FORCE ROW LEVEL SECURITY;
ALTER TABLE jra_evidence_private.html_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE jra_evidence_private.html_captures FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA jra_evidence_private FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA jra_evidence_private TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA jra_evidence_private TO service_role;
-- service_role bypasses RLS; least-privilege table ACLs still prohibit update/delete/truncate.
CREATE FUNCTION jra_evidence_private.immutable_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='postgres' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'HTML_EVIDENCE_IMMUTABLE';
END $$;
REVOKE EXECUTE ON FUNCTION jra_evidence_private.immutable_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable_blob BEFORE UPDATE OR DELETE ON jra_evidence_private.html_blobs FOR EACH ROW EXECUTE FUNCTION jra_evidence_private.immutable_guard();
CREATE TRIGGER immutable_capture BEFORE UPDATE OR DELETE ON jra_evidence_private.html_captures FOR EACH ROW EXECUTE FUNCTION jra_evidence_private.immutable_guard();
CREATE FUNCTION jra_evidence_private.capacity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'EVIDENCE_ISOLATION_UNSUPPORTED'; END IF;
 PERFORM pg_advisory_xact_lock(47004,1);
 IF TG_TABLE_NAME='html_blobs' THEN
  IF coalesce((SELECT sum(compressed_bytes) FROM jra_evidence_private.html_blobs),0)+octet_length(NEW.body_gzip)>536870912 THEN RAISE EXCEPTION 'EVIDENCE_CAPACITY_LIMIT'; END IF;
 ELSE
  IF (SELECT count(*) FROM jra_evidence_private.html_captures)>=100000 THEN RAISE EXCEPTION 'EVIDENCE_CAPTURE_LIMIT'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION jra_evidence_private.capacity_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER capacity_blob BEFORE INSERT ON jra_evidence_private.html_blobs FOR EACH ROW EXECUTE FUNCTION jra_evidence_private.capacity_guard();
CREATE TRIGGER capacity_capture BEFORE INSERT ON jra_evidence_private.html_captures FOR EACH ROW EXECUTE FUNCTION jra_evidence_private.capacity_guard();
CREATE FUNCTION public.jra_store_html_evidence_v1(p_meta jsonb,p_gzip bytea) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_id bigint; v_hash text; v_cname text; v_existing jra_evidence_private.html_blobs%rowtype;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'EVIDENCE_ISOLATION_UNSUPPORTED'; END IF;
 IF p_meta->>'format_version' IS DISTINCT FROM 'JRA_PRIVATE_HTML_V1' OR p_meta->>'compression' IS DISTINCT FROM 'gzip' OR p_meta->>'encoding' IS DISTINCT FROM 'shift_jis' OR (p_meta->>'status_verified')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'EVIDENCE_FORMAT_INVALID'; END IF;
 v_hash:=p_meta->>'wire_sha256';v_cname:=p_meta#>>'{race,cname}';
 IF v_cname IS NULL OR v_cname !~ '^pw01dde01[0-9]{20}/[A-Za-z0-9]{2}$' OR substring(v_cname from 10 for 2) IS DISTINCT FROM p_meta#>>'{race,track_code}' OR substring(v_cname from 20 for 2)::integer IS DISTINCT FROM (p_meta#>>'{race,race_no}')::integer OR to_char((p_meta#>>'{race,race_date}')::date,'YYYYMMDD') IS DISTINCT FROM substring(v_cname from 22 for 8) THEN RAISE EXCEPTION 'EVIDENCE_RACE_MISMATCH'; END IF;
 IF p_meta->>'source_url' IS DISTINCT FROM 'https://www.jra.go.jp/JRADB/accessD.html?CNAME='||replace(v_cname,'/','%2F') THEN RAISE EXCEPTION 'EVIDENCE_SOURCE_INVALID'; END IF;
 -- Serialized budget accounting. New payload is rejected rather than weakening evidence.
 PERFORM pg_advisory_xact_lock(47004,1);
 SELECT * INTO v_existing FROM jra_evidence_private.html_blobs WHERE wire_sha256=v_hash;
 IF FOUND THEN
  IF v_existing.gzip_sha256 IS DISTINCT FROM p_meta->>'gzip_sha256' OR v_existing.decoded_utf8_sha256 IS DISTINCT FROM p_meta->>'decoded_utf8_sha256' THEN RAISE EXCEPTION 'EVIDENCE_HASH_CONFLICT'; END IF;
 ELSE
  IF coalesce((SELECT sum(compressed_bytes) FROM jra_evidence_private.html_blobs),0)+octet_length(p_gzip)>536870912 THEN RAISE EXCEPTION 'EVIDENCE_CAPACITY_LIMIT'; END IF;
  INSERT INTO jra_evidence_private.html_blobs VALUES(v_hash,p_meta->>'decoded_utf8_sha256',p_meta->>'gzip_sha256',p_gzip,(p_meta->>'raw_bytes')::integer,(p_meta->>'compressed_bytes')::integer,p_meta->>'encoding');
 END IF;
 INSERT INTO jra_evidence_private.html_captures(wire_sha256,race_date,track_code,race_no,cname,source_url,fetched_at,expires_at)
 VALUES(v_hash,(p_meta#>>'{race,race_date}')::date,p_meta#>>'{race,track_code}',(p_meta#>>'{race,race_no}')::smallint,v_cname,p_meta->>'source_url',(p_meta->>'fetched_at')::timestamptz,(p_meta->>'expires_at')::timestamptz)
 ON CONFLICT(cname,wire_sha256,fetched_at) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM jra_evidence_private.html_captures WHERE cname=v_cname AND wire_sha256=v_hash AND fetched_at=(p_meta->>'fetched_at')::timestamptz; END IF;
 RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.jra_store_html_evidence_v1(jsonb,bytea) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jra_store_html_evidence_v1(jsonb,bytea) TO service_role;

SET LOCAL ROLE service_role;
DO $test$ DECLARE v_meta jsonb:= $meta${"format_version":"JRA_PRIVATE_HTML_V1","race":{"cname":"pw01dde0105202604040120261011/7C","track_code":"05","race_no":1,"race_date":"2026-10-11"},"source_url":"https://www.jra.go.jp/JRADB/accessD.html?CNAME=pw01dde0105202604040120261011%2F7C","fetched_at":"2026-09-01T00:00:00Z","expires_at":"2026-10-01T00:00:00.000Z","wire_sha256":"6c3c7f70ab4832f04ac2828dac79dcf328166184d4d651f8714f4a676f0d098f","decoded_utf8_sha256":"6c3c7f70ab4832f04ac2828dac79dcf328166184d4d651f8714f4a676f0d098f","gzip_sha256":"8b1c94909217ead620d9d1f88825ed7ff19bf41e555d9b5f2921e3c05dc20a2f","raw_bytes":43,"compressed_bytes":57,"encoding":"shift_jis","compression":"gzip","status_verified":false}$meta$::jsonb; v_gzip bytea:=decode('1f8b0800000000000003b3c928c9cdb1b349ca4fa9b40b8ef40bf1700df1745670715208710d0eb1d1078bdbe8831501005df38de42b000000','hex'); a bigint; b bigint;
BEGIN
 a:=public.jra_store_html_evidence_v1(v_meta,v_gzip);
 b:=public.jra_store_html_evidence_v1(v_meta,v_gzip);
 IF a IS DISTINCT FROM b OR (SELECT count(*) FROM jra_evidence_private.html_blobs)<>1 OR (SELECT count(*) FROM jra_evidence_private.html_captures)<>1 THEN RAISE EXCEPTION 'IDEMPOTENCY_FAILED'; END IF;
 IF (SELECT encode(body_gzip,'hex') FROM jra_evidence_private.html_blobs)<>encode(v_gzip,'hex') THEN RAISE EXCEPTION 'GZIP_BYTES_CHANGED'; END IF;
 BEGIN PERFORM public.jra_store_html_evidence_v1(v_meta||jsonb_build_object('wire_sha256',repeat('b',64),'gzip_sha256',repeat('0',64)),v_gzip); RAISE EXCEPTION 'BAD_HASH_ALLOWED'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO jra_evidence_private.html_blobs VALUES(repeat('c',64),repeat('c',64),encode(extensions.digest(v_gzip,'sha256'),'hex'),v_gzip,2097153,length(v_gzip),'shift_jis'); RAISE EXCEPTION 'SIZE_ALLOWED'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE jra_evidence_private.html_blobs SET encoding='shift_jis'; RAISE EXCEPTION 'UPDATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM jra_evidence_private.html_captures; RAISE EXCEPTION 'DELETE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN TRUNCATE jra_evidence_private.html_blobs; RAISE EXCEPTION 'TRUNCATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Another timestamp reuses blob but stores a separate immutable observation.
 v_meta:=v_meta||jsonb_build_object('fetched_at','2026-09-01T00:00:01Z','expires_at','2026-10-01T00:00:01Z');
 PERFORM public.jra_store_html_evidence_v1(v_meta,v_gzip);
 IF (SELECT count(*) FROM jra_evidence_private.html_captures)<>2 OR (SELECT count(*) FROM jra_evidence_private.html_blobs)<>1 THEN RAISE EXCEPTION 'OBSERVATION_FAILED'; END IF;
END $test$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM public.jra_store_html_evidence_v1('{}',NULL); RAISE EXCEPTION 'ANON_RPC_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; BEGIN PERFORM 1 FROM jra_evidence_private.html_blobs; RAISE EXCEPTION 'ANON_TABLE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM public.jra_store_html_evidence_v1('{}',NULL); RAISE EXCEPTION 'AUTH_RPC_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; BEGIN PERFORM 1 FROM jra_evidence_private.html_captures; RAISE EXCEPTION 'AUTH_TABLE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('jra_evidence_private.html_blobs'::regclass,'jra_evidence_private.html_captures'::regclass) AND relrowsecurity AND relforcerowsecurity)<>2 THEN RAISE EXCEPTION 'RLS_FAILED'; END IF;
 BEGIN UPDATE jra_evidence_private.html_blobs SET raw_bytes=raw_bytes; RAISE EXCEPTION 'OWNER_UPDATE_ALLOWED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'HTML_EVIDENCE_IMMUTABLE' THEN RAISE; END IF; END;
 -- Simulated current date is after expiry. postgres-only deletion affects ONLY newly created candidate tables.
 DELETE FROM jra_evidence_private.html_captures WHERE expires_at<='2026-10-02T00:00:00Z';
 DELETE FROM jra_evidence_private.html_blobs b WHERE NOT EXISTS(SELECT 1 FROM jra_evidence_private.html_captures c WHERE c.wire_sha256=b.wire_sha256);
 IF EXISTS(SELECT 1 FROM jra_evidence_private.html_captures) OR EXISTS(SELECT 1 FROM jra_evidence_private.html_blobs) THEN RAISE EXCEPTION 'RETENTION_FAILED'; END IF;
END $$;
ROLLBACK;
SELECT 'CORE_VALIDATION_PASS' as result,to_regnamespace('jra_evidence_private') IS NULL as schema_absent,to_regprocedure('public.jra_store_html_evidence_v1(jsonb,bytea)') IS NULL as rpc_absent;
