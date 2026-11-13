# BAKEN LAB Sites MCP: confirmed in-chat probe success
**Checked:** 2026-11-13 JST

## What was actually verified
- Site: https://baken-lab-mcp-connection-probe.ketamotohitoshow.chatgpt.site
- Published as owner-only with Sites-hosted MCP.
- This existing ChatGPT conversation's available tool list included `mcp__BAKEN_LAB_MCP_______baken_connection_probe`. This is an actual dynamic tool discovery result, not a claimed successful install from a screenshot.
- The assistant invoked `baken_connection_probe({})` **in this same conversation**.
- Tool returned the exact structured content:

```json
{"ok":true,"bridge":"CHATGPT_SITES_HOSTED","production_changed":false}
```

- This confirms the Sites-hosted MCP probe endpoint is callable from the current ChatGPT conversation without forcing a new chat. The user is accessing ChatGPT through an Android client, but this result specifically certifies **tool reachability in this conversation**, not any separate Android UI controls.
- No external calls, secret reads, Supabase DB work, race queries, CLAIM, SAVE, Cron or FROZEN mutation were performed by the probe.
- This does **NOT** verify BAKEN LOCAL's missing production tools; only a single, safe diagnostic tool exists and is exposed.

## Safest next phase
1. Edit the **same existing Site**, not a new Desktop-only `.mcp.json` plugin, through ChatGPT Sites / Work. Preserve its Site, App and canonical plugin.
2. Add a second read-only `baken_local_connectivity_status` tool that returns only safe operational metadata and **does not** accept writable race payloads or user-supplied service-role credentials. Authentication and server-side secret configuration must be reviewed before any real service request.
3. Republish/update the same Site and check that this chat exposes **both** diagnostic tools. Call the new status tool only after verifying it is safe and accurately authorized.
4. Only after that succeeds, design a server-to-server delegated tool to the existing guarded pre-CLAIM RPC. Preserve official READY, JST date, no debut, source as-of, pre-post budget, and append-only receipt verification. Do not expose CLAIM/SAVE first or bypass the canonical production MCP.
5. All existing FROZEN, LOCAL1.6 predictions, existing workers, empty bets, and production service secrets remain unchanged.

## Status
**Stage 1 succeeded: tool discovery and fixed response validated.**
Stage 2 unimplemented; no production history-corner snapshot capture claimed.
