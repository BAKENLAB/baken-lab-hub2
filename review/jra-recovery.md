# JRA 0.3 recovery — local review only

No deployment, production connection, migration, task edit or frozen prediction was performed. LOCAL code, queue, workers, RPCs and HUB/API are unchanged. These modules are not currently reachable from a Scheduled Task or a public endpoint.

## Recovered specification

DB context → ChatGPT full-field ability audit → ranks → TOP5 → individual re-audit of every excluded horse → strongest specifically supported EYE outside TOP5 → seven-key payload → INSERT FROZEN → SELECT verification. There is no automatic scorer, base-candidate invocation, rank-six EYE default or ranking transformation in this implementation.

Protocol is `JRA_REBUILD_0.3_FLAT_HISTORY`; model is `GPT-5.6 Sol`; source is `CHATGPT`. The previously observed storage contract has empty bets and `MARKET_SEPARATE`. HUB already understands this protocol and keeps saved ranks; no HUB changes were made.

## Local entry points

`automation/jra-recovery.mjs` exports:

```js
getJraContext(adapter, {race_date, track, race_no, circuit: 'JRA'})
saveJraPrediction(adapter, identity, {
  protocol_version: 'JRA_REBUILD_0.3_FLAT_HISTORY',
  context_fingerprint,
  payload
})
```

`createJraRecoveryAdapter(pool, {officialHistorySourceKinds})` accepts an existing server-only PostgreSQL pool exposing `connect()`, `query(sql, parameters)` and `release()`. It does not instantiate a driver, pool, credentials or any network connection itself. No new DB objects are required. Caller authentication, secret storage, a pinned PostgreSQL driver and Task transport are **not implemented** in this local review stage. Do not pass caller-supplied bundles/contexts to `buildJraContext`; the production caller may supply only race identity, fingerprint and prediction payload to the authenticated server boundary.

## Context safety

* JRA-only identity checks occur before a database connection. The SQL also hardcodes JRA. Flat races, BASIC_READY, JRA_OFFICIAL, PENDING/RETRY and a valid future post time are required.
* Official card and live runner identities must agree on number, name and exact nonempty official horse reference. Current fields present on both sides must agree. No name-only or guessed-ID join.
* DB history uses exact horse_ref and name, full_runner, explicitly configured verified source kinds, availability timestamps, target-date cutoff and explicit flat metadata. The source-kind allowlist defaults to empty pending provenance review; no source label is guessed. LIVE history remains attached to its official runner and an explicitly different historical horse identity is rejected.
* Current card attributes never come from historical weights/body weights. Historical body weights are not returned. Null current values remain missing.
* History excludes the target date and later dates, future availability and target/post-target start times. This intentionally excludes **all same-day prior races**, even if earlier; it is conservative when reliable start/availability timestamps are absent.
* Each runner gets the latest five distinct-date flat runs. Source and official identity evidence survive. An independent last-activity query includes obstacle races solely for days-since-activity; their performance never enters flat ability history. Interval coverage is explicitly limited to available verified evidence.
* Explicit field projections remove popularity/odds, previous predictions/marks/scores and raw HTML. No market relation is queried. Recursive payload checks prohibit market data keys except the required false audit flag. Free-text reasoning is still the ChatGPT worker's responsibility.
* Context has a server-generated evidence fingerprint; source checks and current field timestamps are included. Saving regenerates the context under a JRA race lock and rejects changes. The as_of clock itself is excluded from the fingerprint so mere passage of time does not invalidate identical evidence; pre-race checks still repeat.

## Unresolved comparison policy

All-zero history is blocked by the recovered rule. Any runner with fewer than five verified available flat histories is marked `SPARSE_HISTORY_POLICY_UNCONFIRMED` and held. **Five is a conservative operational hold boundary, not an asserted official 0.3 minimum.** No scoring/default/rank is invented for sparse histories. Review is needed to distinguish naturally short careers from missing records and to approve a sparse-history policy. Missing required current fields also hold saving; null body weight/diff and empty equipment are retained without guessing.

## Payload and atomic save

Top-level keys must be exactly runners/top5/eye/bets/summary/bet_strategy/audit. Full-field identity and contiguous unique ranks are required; TOP5 must equal caller ranks 1–5 in order. EYE must be outside TOP5 with its specific reason (any eligible outside rank, not always six).

Audit must include protocol_version, market_used_for_ranking=false, obstacle_excluded=true, all_runners_checked=true, outside_top5_reaudited=true, context_fingerprint and `outside_top5_audits: [{horse_no, reason}]` for **every** outside runner. The fingerprint and individual audit entries are new transport safeguards, not claims about historical payload fields. Machine validation can check coverage, not certify the substantive quality of ChatGPT comparisons.

Save opens one repeatable-read transaction, locks only the selected JRA official_races row, rechecks context/duplicates and executes parameterized INSERT SELECT. Race identity/name/time come from official_races; fixed storage metadata cannot be supplied by the caller. SQL checks clock_timestamp immediately at INSERT and uses the existing three-column uniqueness contract. No UPSERT, UPDATE or DELETE is issued. The existing AFTER INSERT registry trigger runs inside the same transaction. SELECT checks exact payload, protocol, race, model, source and status before COMMIT. Any failure rolls back; no prediction is reported as saved. Existing predictions of any circuit/status block the race key. Serialization/unique/timeout failures propagate; no automatic retry writes or queue transitions occur.

Statement timeout is 15 seconds; save lock timeout is five seconds. Pool connect timeout and a total request deadline must be supplied by the future server wrapper. On an ambiguous COMMIT/network failure, reconcile by read-only race-key SELECT and payload comparison; never blindly regenerate or overwrite.

## Before production connection

1. Review these safety holds and the explicit source-kind allowlist against actual official provenance. Confirm exact horse_ref representations and source timestamp semantics. No historical reconstruction is safe from mutable current tables alone without archived as-of evidence.
2. Use a disposable PostgreSQL DB to test these **new** queries, real schema/triggers, concurrent insert races, rollback, expiry while blocked, and privilege boundaries. Current unit tests use injected adapters; they do not establish real database transaction correctness. Existing 94 DB tests remain separate and skipped in this environment.
3. Review/develop an authenticated JRA-only server entry and Task transport, with a dedicated server-held connection and limited privileges. Keep LOCAL routes and RPCs unchanged. Do not expose direct client writes or arbitrary SQL.
4. Offline replay using strictly pre-race archived evidence; then separately approve deployment and an unstarted JRA-only controlled test. Do not backdate FROZEN for already-started races.
5. Rollback means disconnecting the new JRA entry and reverting only these new files. Existing FROZEN rows are never deleted or rewritten.

## Local validation

JRA recovery tests: **60 PASS / 0 FAIL**. Existing tests: **190 PASS / 94 SKIP / 0 FAIL**. Combined: **250 PASS / 94 SKIP / 0 FAIL (344 tests)**. Run with Node 24 using `env -u LAB_QUEUE_TEST_DISPOSABLE node --test --test-isolation=none tests/*.test.mjs`. No database connection is made by these runs. Node syntax checks and whitespace checks also pass. PostgreSQL transactional guarantees and new adapter SQL execution remain unverified against a real disposable DB; the mock transaction tests are explicitly not substitutes.
