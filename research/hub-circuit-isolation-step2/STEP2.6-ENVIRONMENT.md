# STEP2.6 isolated-environment preparation

Baseline f54f8119eef09e23f23b97575339a4902de17aa0. Candidate code unchanged. No production writes, deploys, cron/worker actions, main edits, load tests or paid-resource creation.

## Observed environments

1. Supabase list_projects returns only production LAB LINK qjlvsndiqjfsfjinilig. list_branches returns only default main with the SAME project_ref. FUNCTIONS_DEPLOYED/preview_project_status does NOT mean it is an isolated preview. No separate development project/branch exists in visible inventory.
2. Vercel deployment inventory for baken-lab project prj_BeKBogQ87vNP8ar3MH0XgMmPXFEp, team team_zISfDxpUrI7DkEiNPv2PAIui, feature branch returns403 forbidden for keetasamas2-9943. Preview existence and accessibility remain UNKNOWN, not absent. Vercel CLI unavailable; no credential retrieval, cross-team fallback or unchanged retry performed.
3. Managed executor running/current; HTTP policy enforced; no capabilities, injected secrets/runtime variables or outbound identities. Node offline execution is available; deno/Supabase CLI/vercel absent. Docker CLI exists but previously denied socket is not evidence of usable Docker; no Docker setup/retry. Chromium executable exists but previously setsockopt EPERM/SIGTRAP prevents browser execution. No browser connector is exposed. TCP grants empty/VPNfalse; failed proxy not retried or bypassed.

## Safe topology and exact preparation steps

Preferred: an existing approved nonproduction Supabase project + protected Vercel Preview, funded only with explicit owner approval if a new resource costs money. Obtain the distinct development project_ref and permitted project/team access first. A new Supabase branch operation requires cost confirmation and does not copy production data; it was NOT invoked.

1. Owner grants the Vercel connector access to the existing baken-lab team and supplies/identifies a separate development project. No tokens in chat/repository. Check deployment target=preview, exact branch/commit and nonproduction aliases; never promote it.
2. Export the minimum approved date/circuit records from production via SELECT only: official_races, official_predictions, official_results, official_market, official_bet_plans, chappy_predictions as needed. Preserve IDs, timestamps, ranks/comments/audits/payloads byte-for-byte at JSON semantics; keep snapshots access-controlled with manifest/hash and delete them after verification. No evaluation/recalculation. Import only into the isolated DB, not production. This is a frozen verification dataset, not live-state synchronization.
3. Install only the schema needed for display in the dev project; do not enable worker/cron/webhooks or inherit production secrets. Validate the dev service identity cannot reach production. Candidate calls analytic actions elsewhere too; stage access should be limited to reviewed health/list/results routes during these tests.
4. Deploy the EXISTING candidate hub2-api to that distinct dev project, after checking target ID; credentials/server SUPABASE_URL point to dev. service_role, if needed, belongs only to dev and stays in server secrets, never page code, public env variables, URLs, trace artifacts or logs. Prefer a SELECT-only dev credential/client configuration where supported; candidate currently expects service_role config, so any auth adaptation must be separately reviewed.
5. Build a PREVIEW-ONLY copy of candidate pages with API constant replaced by the verified isolated endpoint. Current candidate pages still hardcode production URL; an automatic preview of the repository root serves old main pages and is NOT a candidate test. Map candidate files explicitly to preview root. Reject production API host before running failure/load tests. Never point failure injector at production.
6. Confirm module MIME and immutable URL, service-worker origin/cache isolation, default/individual circuit HTTP results and snapshot parity. Use controlled isolated fault injection for each circuit. Separate server and browser failure tests. Bound concurrency, duration and query counts before synthetic load tests; no production database behind the load target.
7. Execute tests/browser.mjs in an approved socket-capable CI runner or existing browser environment with Chromium/Playwright, using offline interceptions first. Real mobile browser tests then target only the isolated preview. User's Android Chrome may verify tabs, details/back, dates, stale notices; screenshots/manual success do not replace API parity or automated fault tests. Do not create a CI workflow with production secrets or enable schedules without review.

Alternative safe topology: approved local Deno/Node HTTP runtime + read-only exported snapshots, no production credentials. Real HTTP to local handler verifies transport but snapshot-backed client is NOT live Supabase/PostgREST E2E. Both distinctions must be reported.

Direct live production access is NOT prepared: anon reads are blocked by current RLS, while production service_role is broader than read-only. A restricted production SELECT role/read-only gateway/replica would need separate provisioning and approval; no role, RLS, RPC or secret changes performed. Existing public HUB GET API is display-only but cannot substitute raw database access to the candidate and was not used for load tests.

## Test status this stage

- Confirmed inventories/permissions and static code/index review above.
- Real isolated HTTP: SKIP, no verified target/credentials.
- Real mobile/layout/service-worker lifecycle: SKIP, no socket-capable browser execution environment.
- New load/latency tests: SKIP, no isolated target; production intentionally not used.
- STEP2.5 offline43 PASS and real-sample offline4 PASS are historical results, not reclassified as new HTTP/mobile success. No unrelated test reruns.

Production readiness NO. Next concrete requirement: authorized Vercel team preview access plus a distinct approved dev backend OR a socket-capable isolated local/CI runtime with approved snapshots. Environment setup itself must be verified before any real-data/load test.
