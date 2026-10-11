# HUB circuit isolation STEP2 — candidate only

Branch: feature/hub-circuit-isolation-step2-20261011. GitHub main baseline a4bd57427c0456c2a68508ae330c4277f8648486; deployed hub2-api baseline v32 retrieved read-only. No DB writes, cron changes, worker invocations, Edge or Vercel production deployments.

## Files / proposed placement

baseline/ is the unmodified retrieved API index, contract and main pages. candidate/ contains proposed root today.html, result.html, circuit-loader.mjs, unchanged prediction-contract.mjs and supabase/functions/hub2-api/{index.ts,circuit-responses.mjs}. Nothing is installed at repository root or deployed; copy/mapping must be reviewed before integration. Existing renderDetail/renderResultDetail, CSS, rank/grade/EYE logic and server mapping/normalization functions are unchanged.

API readListCircuit/readResultsCircuit scope every official-table read by date+circuit. Legacy chappy_predictions is queried only in LOCAL because existing safeLegacy categorizes these rows as LOCAL. This does not introduce new legacy JRA classification. Each query has a10s abort signal; circuit response deadline12s. collectCircuitResponses handles independent branches; default ALL retains list/results existing fields and successful-data order with additive circuit_status and partial. Single-circuit HTTP response is independent of the other branch. One failure gives aggregate HTTP200/partial=true; both failure HTTP503/ok=false. Empty successful arrays have READY status. Individual prediction DATA_ERROR uses unchanged safeOfficial handling. Other actions remain baseline.

Browser createCircuitLoader issues independent circuit requests,15s timeout each, publishes each successful response immediately, keeps same-date last good data on failure with an explicit stale notice. New-date requests discard old-date cache; generation checks discard late requests. Per-screen state keeps TODAY and RESULT independent. Malformed/wrong-date/wrong-circuit/partial replies are rejected. Errors are generic (no server exception details). Empty vs failed vs loading is displayed distinctly using existing error/empty classes; normal CSS and rendering templates are unchanged. Initial venue selection follows existing sorted order even if replies arrive in different order; user-selected venue is preserved during the current load.

## Tests

Node24: `node --test research/hub-circuit-isolation-step2/tests/api.test.mjs research/hub-circuit-isolation-step2/tests/loader.test.mjs research/hub-circuit-isolation-step2/tests/html-runtime.test.mjs`

- API17 cases PASS: both-normal baseline parity for list/results; each-side failure; both failure; empty; per-race DATA_ERROR; explicit scope; invalid scope; unchanged contract. Includes synthetic EYE and frozen comments. Real baseline/candidate handler code executed via Node stripTypeScriptTypes + vm, DB/client transport mocked. NOT real Deno/PostgREST verification.
- Loader10 cases PASS: independently completed successful branch before timeout; stale refresh retention; date change; wrong-circuit rejection; late response suppression, for both actions.
- HTML runtime10 cases PASS: executes actual page scripts with a minimal fake DOM; baseline/candidate normal rendered list/tab/filter HTML and CSS equality; failure matrix; empty distinction. Not a layout engine or real browser.
- Browser/mobile SKIP: tests/browser.mjs prepared using offline request interception at390x844. Local server listen was denied; changed harness to virtual routed requests. Default Playwright browser missing; installed /usr/bin/chromium launch denied with setsockopt EPERM/SIGTRAP. No permission bypass/download attempted. No actual mobile visual/layout/interaction PASS claimed.

Initial test failures were corrected: VM lacked structuredClone (harness); incremental initial venue selection differed from original (candidate fixed). Final offline suites pass. Baseline contract is byte-identical to candidate. No old unrelated test suites rerun.

## Compatibility limits and remaining work

Normal list/results existing keys are deeply equal to baseline on fixtures; metadata is additive. Clients that check ok/status and read existing arrays continue working. Strict exact-key clients and clients assuming aggregate failures always return500 need review; aggregate failures now503 and partial success200 are intentional. Additive metadata identifies missing coverage; old clients ignoring it cannot distinguish partial completeness.

API must support circuit filtering BEFORE these pages are released. Old API ignores circuit and returns mixed rows; loader deliberately rejects such responses rather than misrepresenting isolation. Ship new circuit-loader.mjs alongside both pages. Browser ES modules must be served as JavaScript; pages remain same DOM/CSS under normal success. Mobile browser, protection/caching/service-worker, real Supabase query abort support, staging transport and real-data parity remain UNVERIFIED. Total query count grows: default aggregate official reads run per circuit; page requests overlap and increase connection demand. Shared DB/service_role/Edge infrastructure remains a common failure domain. This STEP2 separates request/display failures, not infrastructure.

Production readiness: NO. First run isolated/staging Edge transport and actual browser/mobile tests; confirm existing API consumers and observed latency/load; review API-first deployment order and rollback to exact v32 plus original pages. Rollback must replace both pages and module consistently, without modifying frozen DB records. User's explicit approval remains required before any production changes.
