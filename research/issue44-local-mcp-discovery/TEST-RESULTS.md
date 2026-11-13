# Actual verification results — Issue #44
## GitHub Actions (executed)
- Workflow: https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/43478370261
- Job: discovery-unit (132068121766)
- Tested commit: 62c53e9ba9cc596054fba25f17bc8e235aad22de
- Runtime: Node v22.23.4
- Test command: node --test research/issue44-local-mcp-discovery/discovery.test.mjs
- Observed TAP: tests 18, pass 18, fail 0, cancelled 0, skipped 0.
- Test execution time reported: 82.494511 ms.
- Scope: unit/regression tests with recorded metadata plus synthetic listTools responses. No live OAuth/SDK or Android integration is represented by this PASS.
- Only a docs/log follow-up commit records this result; unchanged tests are not rerun.

## Separate observations
- Production source read: Edge v29, six registered tools.
- Current Codex registry: three v9 business tools, missing preclaim/preview/seal.
- Existing Site status tool: AUTH_REQUIRED HTTP401, MCP initialized=false, tools_listed=false. Not authenticated tools/list success.
- Android UI and approved App backend tool snapshot: UNVERIFIED.
- Actual normal-OAuth initialize/tools/list from the six-tool endpoint: UNVERIFIED.
- Actual mobile discovery/use of lab_preclaim_official_corners and lab_relative_rank_preview: UNVERIFIED.
- Managed local environment: startup failed; no local Node/browser execution.
- CLAIM/save/preclaim/preview/seal calls, production setting changes, FROZEN writes: 0.
- Issue #44 remains unresolved. A successful mocked list is not a production connection.
