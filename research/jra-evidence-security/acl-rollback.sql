-- Restore only the exact observed pre-change ACL. Requires explicit rollback authorization.
BEGIN;
DO $$ BEGIN IF md5(pg_get_functiondef('public.publish_jra_live_race(uuid)'::regprocedure))<>'1283f2b810147ff2e3e2d8a7d149b37d' THEN RAISE EXCEPTION 'RPC_DEFINITION_CHANGED'; END IF; END $$;
GRANT EXECUTE ON FUNCTION public.publish_jra_live_race(uuid) TO PUBLIC,anon,authenticated;
COMMIT;
