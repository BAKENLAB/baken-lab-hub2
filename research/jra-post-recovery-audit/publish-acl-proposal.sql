-- PROPOSAL ONLY: not executed. Baseline ACL backup and caller audit required first.
-- Deploy only with explicit production approval and isolated DB verification.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.publish_jra_live_race(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_jra_live_race(uuid) TO service_role;
ROLLBACK;
-- This does not fix hardcoded ACTIVE. Keep v26 capture-only until DOM and save guards verified.
