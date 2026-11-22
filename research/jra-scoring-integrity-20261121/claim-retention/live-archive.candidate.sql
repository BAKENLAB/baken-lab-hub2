-- Apply in a transaction after provisioning dedicated server-only roles.
CREATE TABLE private.jra_live_card_archive_v1 (
  receipt_key text PRIMARY KEY CHECK (receipt_key ~ '^[0-9a-f]{64}$'),
  race_id uuid NOT NULL,
  fetched_at timestamptz NOT NULL,
  raw_bytes bytea NOT NULL CHECK (octet_length(raw_bytes) BETWEEN 1 AND 524288),
  raw_sha256 text NOT NULL CHECK (raw_sha256 = encode(sha256(raw_bytes),'hex')),
  card_metadata jsonb NOT NULL CHECK (jsonb_typeof(card_metadata) = 'object'
    AND pg_column_size(card_metadata) <= 131072),
  stored_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK (fetched_at <= stored_at)
);
CREATE INDEX ON private.jra_live_card_archive_v1 (race_id, fetched_at);
ALTER TABLE private.jra_live_card_archive_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.jra_live_card_archive_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO jra_card_writer, jra_card_reader;
GRANT INSERT (receipt_key,race_id,fetched_at,raw_bytes,raw_sha256,card_metadata)
  ON private.jra_live_card_archive_v1 TO jra_card_writer;
GRANT SELECT ON private.jra_live_card_archive_v1 TO jra_card_reader;
CREATE POLICY insert_capture ON private.jra_live_card_archive_v1
  FOR INSERT TO jra_card_writer WITH CHECK (true);
CREATE POLICY read_capture ON private.jra_live_card_archive_v1
  FOR SELECT TO jra_card_reader USING (true);
