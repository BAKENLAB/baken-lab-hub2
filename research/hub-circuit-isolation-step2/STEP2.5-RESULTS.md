# STEP2.5 verification record

## Actual scope

Existing candidate reused on feature/hub-circuit-isolation-step2-20261011. No production deploy, DB write, worker/cron changes, main changes or production load tests. Runtime status: running/current/enforced unrestricted HTTP policy, but capabilities/secrets/runtime variables/outbound identities empty. No approved isolated Supabase/Deno endpoint or read-only transport credentials identified. Prior Chromium socket failure was not retried. No browser/computer connector present.

## PASS / FAIL / SKIP

- PASS43 offline regression cases: API17, loader10, HTML runtime12, service-worker/cache/order simulation4. Final failures0. Includes one-sided/both failures, empty distinction, individual DATA_ERROR, stale notice, cache URL versions, date/request race handling, baseline CSS and normal HTML parity.
- PASS4 real-sample action comparisons (NOT HTTP): list/results on current Tokyo3R + Kochi1R snapshot, and list/results on Kasamatsu1R2026-10-08. Explicit circuit results equal filtered original output. Inputs/payload hashes unchanged. Snapshot field inputs for2026-10-11 omit unused historical runs; Kasamatsu sample uses full records. This is not full-day API parity and not validation of results' sporting correctness.
- PASS read-only counts for2026-10-11: JRA official_races23, predictions14(all FROZEN), official_results23; LOCAL official_races44, predictions0, official_results44. Legacy predictions are not included in these table counts. Obstacle race not assumed part of23 registry rows.
- SKIP isolated real Deno/Supabase HTTP: no approved isolated endpoint/read-only transport. MCP SQL succeeded but is not candidate API HTTP verification.
- SKIP full-day old/candidate production API parity: sampled offline handlers only.
- SKIP real mobile layout/interaction and installed service-worker lifecycle: existing Chromium setsockopt EPERM/SIGTRAP, no usable browser connector. Simulation is not browser testing.
- SKIP isolated latency, connection/load and actual PostgREST cancellation: no environment. No production load test performed.

## Candidate fixes required by verification

Only candidate/today.html and candidate/result.html changed: old-data notice now explicitly includes 最新情報ではありません during failed refresh and while refresh is pending. Shared loader import URL pinned to immutable v=step2.5-20261011 to avoid v21 service-worker cache-first mixing of module versions. No CSS/normal data/detail templates/rank/EYE logic changes. prediction-contract.mjs unchanged. Tests moved runApi into reusable api-harness.mjs; not a replacement API implementation.

## Real samples / integrity evidence

- JRA frozen ID5cfcd7e0-732c-42e4-b11f-77613be3653d: original payload SHA25668a657418fc40a56e67d70fb6ed48ade5bf5998830a37c18d912f0e11ca7c27a.
- LOCAL frozen ID44a4bed5-ec4e-486d-b4b5-201c6dcc1dc7: original payload SHA256b165960c0d16e8069ee0fb38e451a1dccddfe65dcd10c3424c8ca73884857cd9.
- Hashes use JSON.stringify of exported parsed objects, not PostgreSQL canonical jsonb bytes. These prove the local exported objects were unchanged, not an external cryptographic audit of the entire production DB.
- Read-only sample JSON retained only in local scratch, not committed. Replay with tests/real-sample-compare.mjs and an approved export path; no credentials or automatic DB access in that script.

## Traffic / compatibility

Observed query-builder call count on real offline sample: list6→11, results5→10. Browser view1→2 HTTP requests; both requests may overlap. Timeouts: per-query10s, branch12s, browser15s. Deadline behavior simulated; actual database cancellation and deployment latency UNVERIFIED. No throughput/CPU conclusions inferred from offline timing.

Normal responses preserve existing fields. Added metadata and changed partial/all-failed status semantics need client inventory. New frontend rejects mixed-circuit old-API responses, so API must be updated first. Service worker navigation fallback may serve an old shell and modules are cache-first; query-version fixes mixing but real lifecycle remains a release gate.

Production approval: NO. Required gates and full rollback sequence in STEP2.5-ROLLOUT.md. Existing shared DB/Edge/service_role infrastructure remains shared even with independent requests.
