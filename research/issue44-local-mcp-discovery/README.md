# Issue #44 — LOCAL MCP discovery audit (research only)
Checked 2026-11-14 JST / 2026-11-13 UTC. **UNRESOLVED. No production connection or authentication changes.**

## Reproduced observations
| Layer | Observation | What this proves |
|---|---|---|
| Supabase local-claimed-mcp v29 source | Six unconditional registerTool declarations | Source registration only; not a live tools/list result |
| Current Codex tool registry | Three v9 tools: claim, context, save | The six-versus-three surface mismatch also exists in this host |
| User's Android | Three reported in Issue #44 | Reported device symptom; no device UI reproduced here |
| Existing private v9 package 0.1.2 | App binding plus remote .mcp.json | Two discovery paths exist; precedence/cache causality unproven |
| Direct-only private package 0.1.0 | Same HTTPS endpoint, no App binding | Does not by itself prove a supported/live host connection |
| Existing Site read-only status probe | HTTP401, AUTH_REQUIRED, initialized=false, tools_listed=false | Network reached authentication; not a successful MCP connection |

Missing from this conversation: lab_preclaim_official_corners, lab_relative_rank_preview, lab_seal_relative_rank_pair.
The first two are the priority checks. **None of the six business tools was invoked**, including preclaim/preview. No dummy race or CLAIM was used for discovery.

## Cause classification
Confirmed: deployed source registration and the host-provided v9 surface differ. Manifest descriptions/version changes do not prove the host imported new actions. The Site has no successful delegated-authenticated tools/list.
Hypotheses: a previously approved App action snapshot, inactive/unsupported direct binding in this host, per-tool action controls, or failed discovery ingestion. The App backend's actual action snapshot and authorized raw tools/list are unavailable, so these remain hypotheses. A mixed package is not proof that App binding overrides MCP.
Not proven: Android-specific defect, an endpoint networking failure, OAuth misconfiguration in the legitimate v9 connection, invalid server schemas, or a server code bug. A 401 from an unauthenticated Site does not diagnose the authenticated App connection.

## Current official support and correction to older notes
Read on 2026-11-13 UTC:
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
  - Mobile custom-MCP connection setup is documented as web-only.
  - Approved workspace tool definitions are snapshots, not automatically updated; authorized admins can review/refresh/publish changes. This explanation applies to that documented workflow, not automatically to this USER-scoped plugin.
  - New actions may be disabled pending review. Account/plan permissions apply.
- https://help.openai.com/en/articles/20001256-plugins-in-chatgpt
  - Plugins can be available on different hosts. Local MCP apps require Desktop; a plugin labelled Desktop only cannot run on web.
  - The currently fetched page does **not** establish that every .mcp.json pointing at remote HTTPS is Desktop-only. Earlier research notes overstated that claim.
Do not interpret mobile connection-creation restrictions as proof that every already connected app tool is unusable on Android. Three v9 tools already appear in the reported Android surface.
Do not claim that reinstalling, changing description/version, Chrome Desktop Site, or deleting .app.json fixes discovery.

## Minimal code addition
discovery.mjs is a research diagnostic, not a server/UI/authorization patch:
1. Compare source registrations, a separately authenticated tools/list observation, and current conversation names.
2. Return UNVERIFIED for missing authorization evidence; never report source-only registration or HTTP401 as six connected tools.
3. Warn about mixed bindings without assigning an unproven cause.
4. listToolsReadOnly accepts an **already initialized and normally authorized SDK client**. It only calls client.listTools with bounded pagination, timeout, AbortSignal, duplicate-name/cursor and size checks. No token arguments, OAuth implementation, transport setup, logging of raw responses, tools/call, CLAIM, save, fallback credentials, or retries.
It is not wired into the installed App, Site, or production Edge. It cannot refresh a ChatGPT action snapshot.

## Tests and execution boundaries
Run: node --test research/issue44-local-mcp-discovery/discovery.test.mjs
Tests use recorded source/surface metadata and synthetic client responses; they never call a race tool or production endpoint.
Tests cover the observed 6-source/3-host mismatch, source-vs-authenticated-list separation, missing priority tools, hypothetical complete/incomplete live lists, duplicate names, mixed/direct binding warnings, read-only pagination, auth failure, repeated cursor, limits, timeout and immutability.
CI result is recorded separately in TEST-RESULTS.md after the actual run. Mocked six-tool lists are labelled hypothetical and are not live server proof.
Managed local execution environment failed before this task; no local Node, SDK integration or Android UI success is claimed.

## Safe next verification (not performed)
1. In a supported Web/Desktop host under the intended account/plan, an authorized owner inspects the existing App's approved action list and obtains initialize/tools/list using normal OAuth. Do not extract or transfer credentials.
2. Compare all pages and the same App identity with this host's visible names. If the account provides Refresh/Scan Tools, review the new actions without replacing/deleting the existing v9 App. These settings are outside this PR and require separate authorization.
3. For a personal account without those controls, use supported custom-MCP connection setup only if offered by that account. Full write capability or six-tool availability is not guaranteed by this audit.
4. Recheck actual Android discovery in a fresh/appropriately selected conversation only after supported publication. Seeing six descriptions in a manifest is not acceptance.
5. A read-only method must succeed under normal OAuth before business-tool execution. Never invoke CLAIM/save to test visibility. No preclaim/preview invocation without its real-race prerequisites.
Site v7 stays private and on hold. No new Site or auth bridge is proposed as an established fix.

## Safety, impact, rollback
Changes are confined to research code/tests/docs and a no-secret GitHub Actions unit job on a dedicated research branch. No main merge, Edge deployment, private-plugin release update, connection replacement/deletion, permission changes, DB write, Cron, paid API, rejected-payload replay, or FROZEN modification.
Removing/reverting this research commit removes the diagnostic. There is no production rollback because nothing was deployed.
The research PR is based on feature/pace-evidence-prereace-gate to avoid including the unrelated existing PR #41 changes in the diff.

## Acceptance
Issue #44 condition A (six tools connected and read-only method succeeds): **NOT MET**.
Condition B (reproducible mismatch, documented support boundary, explicit unresolved status): supported by this audit, with source/host/mock/live distinction above.
