-- CANDIDATE ONLY. NOT APPLIED. Requires extensions.digest(bytea,text) already installed.
BEGIN;
DO $$ BEGIN IF to_regnamespace('jra_evidence_private') IS NOT NULL OR to_regprocedure('public.jra_store_html_evidence_v1(jsonb,bytea)') IS NOT NULL THEN RAISE EXCEPTION 'TARGET_EXISTS'; END IF; END $$;
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
  IF coalesce((SELECT sum(compressed_bytes) FROM jra_evidence_private.html_blobs),0)+octet_length(NEW.body_gzip)>57 THEN RAISE EXCEPTION 'EVIDENCE_CAPACITY_LIMIT'; END IF;
 ELSE
  IF (SELECT count(*) FROM jra_evidence_private.html_captures)>=2 THEN RAISE EXCEPTION 'EVIDENCE_CAPTURE_LIMIT'; END IF;
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
  IF coalesce((SELECT sum(compressed_bytes) FROM jra_evidence_private.html_blobs),0)+octet_length(p_gzip)>57 THEN RAISE EXCEPTION 'EVIDENCE_CAPACITY_LIMIT'; END IF;
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
DO $test$ DECLARE m jsonb:=$m${"format_version":"JRA_PRIVATE_HTML_V1","race":{"cname":"pw01dde0105202604040120261011/7C","track_code":"05","race_no":1,"race_date":"2026-10-11"},"source_url":"https://www.jra.go.jp/JRADB/accessD.html?CNAME=pw01dde0105202604040120261011%2F7C","fetched_at":"2026-09-01T00:00:00Z","expires_at":"2026-10-01T00:00:00.000Z","wire_sha256":"6c3c7f70ab4832f04ac2828dac79dcf328166184d4d651f8714f4a676f0d098f","decoded_utf8_sha256":"6c3c7f70ab4832f04ac2828dac79dcf328166184d4d651f8714f4a676f0d098f","gzip_sha256":"8b1c94909217ead620d9d1f88825ed7ff19bf41e555d9b5f2921e3c05dc20a2f","raw_bytes":43,"compressed_bytes":57,"encoding":"shift_jis","compression":"gzip","status_verified":false}$m$::jsonb;n jsonb:=$n${"format_version":"JRA_PRIVATE_HTML_V1","race":{"cname":"pw01dde0105202604040120261011/7C","track_code":"05","race_no":1,"race_date":"2026-10-11"},"source_url":"https://www.jra.go.jp/JRADB/accessD.html?CNAME=pw01dde0105202604040120261011%2F7C","fetched_at":"2026-09-01T00:00:00Z","expires_at":"2026-10-01T00:00:00.000Z","wire_sha256":"afce968528ab08cf2c9e4610be662ceeb2201af61e6343a8249903043781efab","decoded_utf8_sha256":"afce968528ab08cf2c9e4610be662ceeb2201af61e6343a8249903043781efab","gzip_sha256":"23c568918104f3a148f66846378bde3934ca9a5bbdbc4245ed9ebe6a86852aba","raw_bytes":43,"compressed_bytes":60,"encoding":"shift_jis","compression":"gzip","status_verified":false}$n$::jsonb;g bytea:=decode('1f8b0800000000000003b3c928c9cdb1b349ca4fa9b40b8ef40bf1700df1745670715208710d0eb1d1078bdbe8831501005df38de42b000000','hex');h bytea:=decode('1f8b0800000000000003b3c928c9cdb10b7675f6f77351088ef40bf1700df17456080cf50f715470f38c08090d72b5d1072b0200ae11cd3e2b000000','hex');id bigint;
BEGIN
 PERFORM public.jra_store_html_evidence_v1(m,g);
 BEGIN PERFORM public.jra_store_html_evidence_v1(n,h); RAISE EXCEPTION 'RPC_QUOTA_ALLOWED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_CAPACITY_LIMIT' THEN RAISE; END IF; END;
 BEGIN INSERT INTO jra_evidence_private.html_blobs VALUES(n->>'wire_sha256',n->>'decoded_utf8_sha256',n->>'gzip_sha256',h,(n->>'raw_bytes')::integer,(n->>'compressed_bytes')::integer,'shift_jis'); RAISE EXCEPTION 'DIRECT_QUOTA_ALLOWED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_CAPACITY_LIMIT' THEN RAISE; END IF; END;
 m:=m||jsonb_build_object('fetched_at','2026-10-10T00:00:00Z','expires_at','2026-11-09T00:00:00Z');
 id:=public.jra_store_html_evidence_v1(m,g);
 BEGIN PERFORM public.jra_store_html_evidence_v1(m,g); RAISE EXCEPTION 'EXPECTED_OLD_BUG_MISSING'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_CAPTURE_LIMIT' THEN RAISE; END IF; END;
 BEGIN PERFORM public.jra_store_html_evidence_v1(m||jsonb_build_object('fetched_at','2026-10-10T00:00:01Z','expires_at','2026-11-09T00:00:01Z'),g); RAISE EXCEPTION 'EVENT_QUOTA_ALLOWED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_CAPTURE_LIMIT' THEN RAISE; END IF; END;
END $test$;
RESET ROLE;
DO $$ BEGIN
 DELETE FROM jra_evidence_private.html_captures WHERE expires_at<='2026-10-11T00:00:00Z';
 DELETE FROM jra_evidence_private.html_blobs b WHERE NOT EXISTS(SELECT 1 FROM jra_evidence_private.html_captures c WHERE c.wire_sha256=b.wire_sha256);
 IF (SELECT count(*) FROM jra_evidence_private.html_captures)<>1 OR (SELECT count(*) FROM jra_evidence_private.html_blobs)<>1 THEN RAISE EXCEPTION 'UNEXPIRED_EVIDENCE_REMOVED'; END IF;
 DELETE FROM jra_evidence_private.html_captures WHERE expires_at<='2026-12-01T00:00:00Z';
 DELETE FROM jra_evidence_private.html_blobs b WHERE NOT EXISTS(SELECT 1 FROM jra_evidence_private.html_captures c WHERE c.wire_sha256=b.wire_sha256);
 IF EXISTS(SELECT 1 FROM jra_evidence_private.html_blobs) THEN RAISE EXCEPTION 'ORPHAN_NOT_REMOVED'; END IF;
END $$;
ROLLBACK;
SELECT 'OLD_FULL_CAPACITY_REPLAY_BUG_REPRODUCED' as result,to_regnamespace('jra_evidence_private') is null as schema_absent,to_regprocedure('public.jra_store_html_evidence_v1(jsonb,bytea)') is null as rpc_absent;
