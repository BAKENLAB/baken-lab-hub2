-- CANDIDATE ONLY. NOT APPLIED. Requires extensions.digest(bytea,text) already installed.
BEGIN;
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
ROLLBACK;
-- Retention proposal: postgres-only maintenance deletes expired captures then unreferenced blobs.
-- No cron or production maintenance installed. Capacity/RLS/ACL/concurrency need isolated PostgreSQL tests.
