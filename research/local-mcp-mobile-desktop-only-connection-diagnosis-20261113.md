# LOCAL MCP tool discovery: connection blocker (2026-11-13 JST)

## Verified client/server facts
- Production Supabase Edge `local-claimed-mcp` v29 source registers SIX tools: `lab_queue_claim_next`, `lab_preclaim_official_corners`, `lab_claimed_context`, `lab_relative_rank_preview`, `lab_seal_relative_rank_pair`, `lab_save_claimed_prediction`.
- This current ChatGPT mobile conversation exposes only three `BAKEN_LOCAL_MCP_v9` tools: queue claim / claimed context / save.
- The newly created private plugin `plugins_6af64165c8dc819186e9164d78d565b3` is **reported already installed** by plugin management. It must **not** be described as uninstalled. Installation ≠ currently exposed/usable tool connection.
- Its package uses `.mcp.json` with `mcpServers` pointing to the **same** remote Supabase HTTPS endpoint, and its manifest declares that file as an MCP server.
- The older `plugins_6ac487e8d5008191aa7fc9d1c76c793a` package also declares a remote MCP server in `.mcp.json`; its metadata was updated to mention 6 tools but the live conversation still exposes 3.
- **2026-11-14 correction:** The currently fetched official help documents local MCP apps as Desktop-only and custom-MCP connection setup as web-only. It does not establish that every remote HTTPS `.mcp.json` package is Desktop-only. The USER-scoped App binding's actual action snapshot and authenticated `tools/list` have not been inspected. See `research/issue44-local-mcp-discovery/README.md` for observed versus unverified facts.
- Chrome's Desktop Site toggle alone is not a verified fix. Do not label this remote plugin Desktop-only solely from its filename, or repeatedly reinstall without observing the actual connection.
- OpenAI supports alternative **Site-hosted** MCP plugin architecture (https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites), but a proper Site-owned plugin, authorization, publish and actual tool exposure must be verified independently. Do not treat a plain remote URL in a new `.mcp.json` plugin as this alternative.

## Impact and safety
- `lab-local-corner-preclaim` v4 is separately deployed and ACTIVE; its deployment does not activate the missing ChatGPT MCP tool.
- The client must not fake or directly invoke preclaim via raw DB insert/service key, bypass canonical MCP, or silently use the already-connected claim/save tools to impersonate a pre-CLAIM request.
- Keep existing production LOCAL1.6, FROZEN and empty bets unchanged. Do not restart Cron.
- As of the last read, official `private.lab_preclaim_evidence_snapshots_v1` count was still 0; no real official historical corner collection has been demonstrated.

## True next connection paths
1. On a **supported ChatGPT Desktop application**, install/use the existing Desktop-only MCP plugin under the proper authenticated account; then confirm all six tools actually appear before any legitimate pre-CLAIM attempt. User does not currently have a PC.
2. Design a **Site-hosted MCP app/plugin or other officially supported app-backed** connection, with authenticated server-side code, and confirm **mobile** support in the actual product before attempting live protected races. This is a separate architecture; no implementation/connection is claimed here.
3. If workspace Business/Enterprise/Edu app tools are available, a managing admin can refresh the approved tool list; the user should not be told this is a personal Plus self-service feature.

**Confirmed blocker: the conversation lacks three tool names despite six source registrations. Exact client ingestion/snapshot cause and authenticated `tools/list` remain unverified.**
