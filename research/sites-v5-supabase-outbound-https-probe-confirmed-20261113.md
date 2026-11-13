# ChatGPT Sites v5 outbound HTTPS isolation — runtime measured, 2026-11-13 JST

## Site-hosted tool actually invoked from this conversation
- `baken_outbound_readonly_probe({})` was visible and callable in the existing Android user's ChatGPT conversation.
- Actual tool checked at `2026-11-13T11:51:57.499Z` (20:51:57 JST).
- `https://example.com/`: HTTP 200, response received, 9 ms.
- `https://qjlvsndiqjfsfjinilig.supabase.co/`: HTTP 404, response received, 10 ms.
- `https://qjlvsndiqjfsfjinilig.supabase.co/auth/v1/health`: HTTP 401, response received, 16 ms.
- In this test 404 and 401 mean **network reachability**, NOT authenticated access; no credentials, response bodies or response headers read.
- Tool also reported no CLAIM, prediction saves, FROZEN changes, DB changes or Cron changes.

## Remaining status tool failure
- `baken_local_connectivity_status({})` was invoked at `2026-11-13T11:52:39.332Z`.
- It returned `SERVER_UNREACHABLE / NETWORK_ERROR`, `server_reachable:false`, `authenticated:false`, no production change.
- The status tool's `SERVER_UNREACHABLE` is **not a reliable characterization of general Supabase host reachability**, because the Site-hosted runtime received immediate HTTP responses from two Supabase URLs.
- Proven: Site plugin installation, tool discovery, Site outbound HTTPS and Supabase domain reachability.
- NOT proven: exact `/functions/v1/local-claimed-mcp` endpoint reachability from Site, MCP JSON-RPC/session protocol compatibility, authentication/OAuth or tools/list access. Their failure phases remain undiagnosed.

## Proposed next constrained read-only diagnostic
Preserve all existing Site tools and owner-only Site publication. Add a single hardcoded-path network check for `GET https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/local-claimed-mcp`, without credentials, response body or headers, arbitrary URL input, secret, CLAIM or tools/list mutation. Report `response_received`, `http_status`, timeout/failure phase only. **Any HTTP status means this exact route is reachable**; 401 is expected when unauthenticated.
Also instrument the existing `baken_local_connectivity_status` to separate:
`URL_CONSTRUCTION`, `DNS_TLS_FETCH`, `HTTP_RESPONSE`, `MCP_INITIALIZE`, `MCP_TOOLS_LIST`, and `AUTHORIZATION`. Do not conflate HTTP 401/403 or MCP JSON protocol errors with `NETWORK_ERROR`.
No real authorization should be attempted until a supported delegated OAuth/approved credential path is reviewed. Never paste or store a Supabase `service_role` key in client, chat or Site source.

## No application of changes
No server, database, race, worker, FROZEN, Cron or production prediction changes. This file records diagnostic evidence only.
