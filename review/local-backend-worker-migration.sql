-- Review candidate only. Do not apply to production before backend canary approval.
-- Purpose: allow service-role Edge Functions to read named Vault secrets without
-- exposing Vault to anon/authenticated callers. SECURITY INVOKER preserves caller privileges.

create or replace function public.lab_backend_secret_v1(p_name text)
returns text
language sql
security invoker
set search_path = pg_catalog
as $$
  select s.decrypted_secret
  from vault.decrypted_secrets s
  where s.name = p_name
  limit 1
$$;

revoke all on function public.lab_backend_secret_v1(text) from public;
revoke all on function public.lab_backend_secret_v1(text) from anon;
revoke all on function public.lab_backend_secret_v1(text) from authenticated;
grant execute on function public.lab_backend_secret_v1(text) to service_role;

-- Production rollout prerequisites, intentionally NOT embedded here:
--   vault secret: local_prediction_worker_key
--   vault secret: openai_local_prediction_key
--   deploy local-prediction-worker with verify_jwt=false (custom shared-secret auth)
--   one-race canary before any cron.schedule call
--
-- Suggested cron bodies after canary:
-- LOCAL_QUEUE_WEST              :05, max_jobs 3
-- LOCAL_QUEUE_KANTO             :15, max_jobs 2
-- LOCAL_QUEUE_CHUBU             :25, max_jobs 2
-- LOCAL_QUEUE_HOKKAIDO_TOHOKU   :28, max_jobs 2
-- LOCAL_QUEUE_RESCUE            :35, max_jobs 3
--
-- Each cron request MUST send x-lab-worker-key from Vault at runtime.
