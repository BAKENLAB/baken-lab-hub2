# LOCAL backend-native worker review (2026-10-06)

## Why this exists

The production queue wrappers and LOCAL 1.5 validator are working when called interactively.
The remaining failure is the unattended ChatGPT Scheduled Task boundary: task runs can finish
without invoking the connected MCP/Supabase tools, and MCP write calls can be blocked by the
platform safety layer even when the plugin is configured for full access.

Do not weaken the prediction validator or bypass FROZEN safety to work around that platform
boundary. Move only scheduling/orchestration out of ChatGPT Scheduled Tasks.

## Candidate architecture

Supabase Cron -> local-prediction-worker Edge Function -> safe claim wrapper ->
existing lab-claimed-context -> OpenAI Responses API -> existing LOCAL 1.5 JS validator ->
safe save wrapper -> DONE/FROZEN verification.

The Edge Function processes one job per HTTP invocation to remain below Supabase's request idle
timeout. Multiple regions are staggered by cron. Existing queue leases/advisory locks continue to
serialize ownership.

No direct INSERT/UPDATE/UPSERT/DELETE of official_predictions is introduced.
No popularity/odds/official_market is sent as an ability input.
JRA code, queues, predictions and schedules are out of scope.

## Secrets

No credentials are committed.

Vault names:
- local_prediction_worker_key: shared secret used only by pg_cron -> Edge Function invocation.
- openai_local_prediction_key: OpenAI API key used server-side by the worker.

The review SQL adds public.lab_backend_secret_v1(text), SECURITY INVOKER and executable only by
service_role. service_role already has SELECT on vault.decrypted_secrets in production as observed
2026-10-06. The function is not required by anon/authenticated clients.

The OpenAI API key is a new billing surface and must not be created or funded without the user's
explicit approval. ChatGPT Plus billing does not substitute for API billing.

## Model request

Candidate default: gpt-5.6-sol, Responses API, reasoning effort high, store=false.
Allowed canary alternatives are gpt-5.6-terra and gpt-5.6-luna for later cost/quality testing.
Structured Outputs constrains only the top-level seven-key envelope; the existing LOCAL 1.5
validator remains authoritative for detailed EYE candidate/pair evidence.

One model repair retry is allowed only when the local validator rejects the first payload.
If the second payload fails, the job is returned to RETRY and no prediction is frozen.

## Rollout gates

1. Keep this source on the review branch. Do not merge main yet.
2. Create/fund an OpenAI API key only after explicit user approval; store it in Vault.
3. Create a random cron shared secret in Vault.
4. Apply only the reviewed service-role Vault-reader SQL.
5. Deploy local-prediction-worker as a new function. Do not alter local-claimed-mcp,
   lab-claimed-context or local-data-refresh during this canary.
6. Invoke one KANTO canary before race start and verify:
   - claim owner/lease correct
   - COMPACT_V1 field integrity
   - LOCAL 1.5 payload passes validator
   - wrapper returns ok=true
   - job DONE
   - official prediction FROZEN
   - no duplicate/overwrite
7. Run Supabase security and performance advisors.
8. Only after canary success, create staggered pg_cron jobs.
9. Disable the four ChatGPT LOCAL Scheduled Tasks after backend cron is proven, not before.
10. Keep JRA Rescue unchanged.

## Initial cadence after canary

Start conservative, one job per invocation:
- WEST: :05, :25, :45
- KANTO: :10, :30, :50
- CHUBU: :15, :35, :55
- HOKKAIDO_TOHOKU: :18, :38, :58
- RESCUE: every 10 minutes, offset from region jobs

Cadence should be adjusted from actual queue depth and model latency; never increase concurrency
just to hide failed claims.

## Cost gate

API use is pay-as-you-go and separate from ChatGPT subscription. Before enabling cron for all
regions, measure token usage and cost on a small canary set and compare prediction quality against
the interactive GPT-5.6 Sol baseline. Do not silently downgrade the production model merely to
reduce cost.
