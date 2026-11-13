# LOCAL official pre-CLAIM edge v4: VERIFIED DEPLOYMENT RECEIPT
2026-11-13 JST

## Exact live deployment
- Supabase project: `qjlvsndiqjfsfjinilig`
- Edge Function: `lab-local-corner-preclaim`
- Live status: `ACTIVE`
- Version: **4**, replacing dormant v3
- Authentication: `verify_jwt=true` (unchanged); handler still requires a server-held service-role bearer key and explicit authorized exact-race intent
- Remote bundle: 12 files, all relative imports resolved before deployment
- Remote code SHA-256: `b5795fb1da948dcdeada5d2441ad9d2bd081f22c83617c3fcbfc2de22f9dd0e4`
- Remote code explicitly retains: 75-second whole-call budget, 5-minute pre-post reserve, official READY and same-JST-day checks, debut exclusion, no CLAIM or normal prediction SAVE

## Regression evidence prior to deployment
- Local official pre-CLAIM workflow 12/12 tests passed (pure code with injected mocks).
- Official prior-corner prefetch 15/15 tests passed (pure code with injected source).
- v4 deployment static contract 6/6 passed.
- No local paid API or production prediction write was performed.
- Existing `local-claimed-mcp` remains v29 and has not been modified.

## Postdeployment read-only checks
- `get_edge_function` returned v4 ACTIVE with `verify_jwt=true`, 12 source files and all four expected gate strings.
- Supabase official corner snapshot table: **0** at 14:02 JST (no authenticated pre-CLAIM invocation yet).
- Normal production LOCAL FROZEN count observed as 14/46 at 14:02 JST; this deployment did not edit frozen records.
- The current ChatGPT tool session **still does not expose** `lab_preclaim_official_corners`, although the existing live `local-claimed-mcp` v29 declares it.
- Private personal plugin `plugins_6af64165c8dc819186e9164d78d565b3` exists, but it is not confirmed installed/usable on this mobile session. No installation was asserted or forced.
- Direct Supabase database write/invocation was NOT substituted for the canonical MCP preclaim interface.
- These are deployment and test results, NOT proof that any real official past-race corner was captured, NOR proof of improved ranking accuracy.

## Next authorized operation
Once an eligible LOCAL preclaim tool is exposed in the connected ChatGPT client: recheck exact JST/date/venue/race number, official READY, unknown/unfrozen status, debut exclusion, source safety budget, then invoke **one** canonical `lab_preclaim_official_corners` race. Record the returned status and verify newly appended snapshot via read-only SQL. Do not use direct SQL INSERT, unsupported service keys, expired CLAIM, post-time saves, Cron restarts, or any production model promotion.
