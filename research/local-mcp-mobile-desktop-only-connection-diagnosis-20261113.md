# LOCAL MCP tool discovery: connection blocker (2026-11-13 JST)

## Verified client/server facts
- Production Supabase Edge `local-claimed-mcp` v29 source registers SIX tools: `lab_queue_claim_next`, `lab_preclaim_official_corners`, `lab_claimed_context`, `lab_relative_rank_preview`, `lab_seal_relative_rank_pair`, `lab_save_claimed_prediction`.
- This current ChatGPT mobile conversation exposes only three `BAKEN_LOCAL_MCP_v9` tools: queue claim / claimed context / save.
- The newly created private plugin `plugins_6af64165c8dc819186e9164d78d565b3` is **reported already installed** by plugin management. It must **not** be described as uninstalled. Installation ≠ currently exposed/usable tool connection.
- Its package uses `.mcp.json` with `mcpServers` pointing to the **same** remote Supabase HTTPS endpoint, and its manifest declares that file as an MCP server.
- The older `plugins_6ac487e8d5008191aa7fc9d1c76c793a` package also declares a remote MCP server in `.mcp.json`; its metadata was updated to mention 6 tools but the live conversation still exposes 3.
- **Authoritative product limitation:** OpenAI Help, “Plugins in ChatGPT” (https://help.openai.com/en/articles/20001256-plugins-in-chatgpt), states Desktop-only imported plugins can be marked that way because they declare MCP servers in `mcp.json` or `.mcp.json` **even when the server has a remote HTTPS URL**, and such plugins cannot run in ChatGPT web. OpenAI Help, “Connecting custom MCP servers in ChatGPT” (https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt), states mobile custom MCP connections are not supported.
- Therefore Chrome's Desktop Site toggle **cannot by itself** make this specific Desktop-only plugin available. The earlier suggestion to repeatedly retry the app-opening prompt was incorrect.
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

**Current blocker is client surface/tool availability, not source/server v4 deployment.**
