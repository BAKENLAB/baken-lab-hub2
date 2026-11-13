# BAKEN LAB Sites → Supabase connection isolation (2026-11-13 18:35 JST)

## Verified observations
- Site-owned plugin: `baken_connection_probe` is callable and returns `ok:true`.
- Site-owned plugin: `baken_local_connectivity_status` is callable from this ChatGPT conversation.
- Its live result checked at 2026-11-13T09:34:00Z:
  `{"ok":false,"status":"SERVER_UNREACHABLE","error_code":"NETWORK_ERROR","server_reachable":false,"authenticated":false,"available_tools":[],"claim_started":false,"prediction_saved":false,"frozen_modified":false,"production_changed":false}`
- Supabase live `/functions/v1/local-claimed-mcp` was receiving independent `POST` calls from `openai-mcp/1.0.0` with HTTP 200 near 09:34–09:35Z. These are **not identified as Site calls**. They establish that the server generally responds to previously connected official MCP clients.
- The Site's catch-all `NETWORK_ERROR` is **not sufficient to prove the Site runtime lacks outbound access**. It could also arise from an invalid URL, blocked destination, TLS/DNS error, timeout, runtime incompatibility, or application code throwing before the fetch response.
- OpenAI Sites official documentation states HTTP and HTTPS are supported; it does not guarantee every outbound destination is reachable under every runtime/security rule. Source: https://learn.chatgpt.com/docs/sites

## Next safest experiment — change ONLY the existing private Site
Add a single tool `baken_outbound_readonly_probe`, preserving the existing two tools exactly.
Runs three probes in the actual **published Site server runtime**, not mocked fetch or Work's cloud shell:
1. `GET https://example.com/` — neutral public HTTPS target.
2. `GET https://qjlvsndiqjfsfjinilig.supabase.co/` — project host without any credentials, data, service role, or private path. Any HTTP status (including 401/403/404) means the HTTP response arrived.
3. `GET https://qjlvsndiqjfsfjinilig.supabase.co/auth/v1/health` — Supabase auth gateway's publicly readable health route, no API key supplied. A 401/403 is still a response, not network failure.

For each probe, timeout after ~5 seconds, `redirect:'manual'`, do not read or return response bodies, do not log or expose headers, cookies or authorization. Include only:
`target_label, response_received, http_status|null, elapsed_ms, failure_phase (construction|fetch|timeout|unknown), error_name (sanitized), error_code (sanitized), production_changed:false`.
Constrain target URLs to these exact hardcoded literals; no URL parameter. Do not use a generic arbitrary-URL proxy. Rate limit to manual invocations.

Republish the SAME Site and call `baken_outbound_readonly_probe` from Android ChatGPT. No service role token, no Supabase app secret, no tool-list MCP POST or production RPC.

Interpretation:
- example.com fails too => Site outbound runtime/policy or generic fetch implementation issue.
- example.com works but both Supabase targets fail => domain-specific egress, DNS/TLS, URL/redirect or provider deny issue.
- Supabase returns ANY HTTP response => outbound path works; current `baken_local_connectivity_status` is misclassifying an application/protocol/authorization error as NETWORK_ERROR. Inspect the code around `fetch` and do separate clean OAuth authorization negotiation without bypassing service gates.
- Work cloud-browser/preview success does not prove the published Site-hosted MCP server runtime works.

## Safety
No changes to `local-claimed-mcp`, `lab-local-corner-preclaim`, production prediction tables, jobs, official FROZEN, Cron, bets, or paid APIs. No secret values in chat/source, no direct DB inserts, no unverified real race preview.

Stage 3 real historical-corner capture remains blocked until Site can reach AND authenticate the official MCP through its normal authorized flow. `SERVER_UNREACHABLE` is not a reason to relax authentication.
