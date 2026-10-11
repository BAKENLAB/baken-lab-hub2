# Query reduction and API-first compatibility proposals — NOT implemented

## Observed request shape

Previous default list:6 DB/client queries. Split: JRA5 + LOCAL6 =11. Results previous5, split5+5=10. Browser screen fetch1→2. Splitting predicates decreases each result set but increases request/connection overhead; counts alone do not establish CPU/time/bytes cost. Existing date+circuit indexes confirmed on official_predictions, official_results, official_bet_plans. official_races/official_market have leading race_date keys. No index creation or production EXPLAIN ANALYZE/load test.

## Priority1: merge duplicate race reads only

readListCircuit reads official_races twice: field_payload for enrichment and registry/status metadata. Fetch both projections once, with same date/circuit filters and existing registry sort, then reuse returned rows for both maps. Target JRA4 + LOCAL5 =9 queries total (11→9). Keep all existing metadata, field alias enrichment, fallback rows, DATA_ERROR policy and order. No cross-circuit shared promise or cache; one branch failure remains contained. Validation required: entire normal payload equality, empty/fallback/test/legacy rows, row-limit/pagination, null fields, race update during request and failures. Single snapshot may remove the old two-read timing inconsistency; document that change rather than claiming identical reads under concurrent updates.

## Priority2: fewer trips without pretending SQL work disappeared

RESULT's5 tables are different dependencies; removing one directly may alter payouts, prediction association, market or error semantics. A separately reviewed read-only SECURITY INVOKER dev RPC per circuit can return the same five datasets in one round trip, preserving existing mapping in the handler. This changes client round trips5→1 per circuit but NOT automatically database scans5→1. No migration proposed for immediate production use. Fully qualify tables, fixed search_path, restricted EXECUTE, same circuit/date joins, no dynamic caller SQL, verify unique join cardinality and exact result equality. A join view is another option but may duplicate rows and needs fixture/data validation first.

Avoid skipping dependencies on empty results if the contract requires their availability to be checked. Avoid cross-circuit Promise-sharing, dropping EYE/audit/field attributes, caching live status as fresh, or simplifying rank/comments to save bandwidth.

## Priority3: request-local efficiency

Coalesce only duplicate in-flight requests with identical action/date/circuit within the same browser generation; preserve date invalidation and independent abort/error states. Keep same-circuit stale labeling. A fixed TTL server cache or shared default-ALL query could hide fresh cancellation/status changes or restore coupled failure: not recommended without a separate freshness contract. Parallel independent reads improve critical path but do not reduce queries and can increase peak connection use.

## API consumer inventory / impact

Read known repository files at f54f8119: root today.html/result.html still use default action=list/results, check HTTP+ok then arrays. Proposed candidate pages use circuit requests. next.html uses lab_next, which candidate does not change; index.html calls hub2-api, and other actions retain baseline code. bet.html has no observed API request in inspected content. Full external-client/user-script inventory is UNKNOWN; repository inspection cannot prove absence.

On API-first deployment, old TODAY/RESULT continue receiving default ALL normal legacy fields. New circuit_status/partial metadata is additive. Partial200 means an old client ignoring partial may show incomplete coverage as complete; all-failed503 replaces generic500. Exact-key clients, status500 checks and consumers expecting all-or-nothing data need explicit review. Do not claim universal compatibility.

Do not deploy new pages before API supports circuit. Current old v32 ignores circuit, so candidate validation rejects mixed rows instead of mislabeling them. Preview imports/service-worker must use candidate versioned module before page activation. Full-day parity, real isolated failures, timeout/abort behavior, load/latency, real mobile and rollback remain production gates in STEP2.5-ROLLOUT.md.
