-- Run in a DIFFERENT connection after validation. Read-only; all must be true.
SELECT
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='local_shadow') AS shadow_schema_absent,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='local_shadow_capture_v1') AS capture_rpc_absent,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='local_shadow_link_v1') AS link_rpc_absent;
