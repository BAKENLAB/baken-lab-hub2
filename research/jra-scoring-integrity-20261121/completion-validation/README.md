# PR83 final connection validation — incomplete official engine

## Implemented and actually tested

Baseline PR head fc8a8c4b8ff8c27962d0efc002efd45b6a01c5b9: all 86 files read as UTF-8, hashed in baseline86-sha256.json. Existing source/history/ledger records preserved. Only the candidate save-boundary, its tests, and CI workflow change; no deployed MCP source or production SQL changes.

Candidate save boundary now binds original payload AND context before asynchronous callbacks. Recompute/resolver mutation is refused even when callbacks return an apparently matching original ledger. Two reproduction tests fail with the previous boundary and pass with the fix. No points, grades or ranks are generated/changed.

60 Node tests PASS (31 ledger, 11 full-depth, 6 handoff, 6 deployed-contract, 6 bridge). GitHub Actions run https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/44955803716 SUCCESS for implementation 1dfc2b7d8b0c8e944edf4701b69933d52d6c91aa.

Real PostgreSQL 17.12 service: existing candidate SQL loaded without modification. Nine assertion groups PASS: exact fixture payload save, six invalid cases refused without partial writes, anon/authenticated EXECUTE denied, complete transaction rollback. Errors fail CI via ON_ERROR_STOP and raised assertions; output-only checks are not counted as PASS.

**Actual:** PostgreSQL parser/runtime, candidate arithmetic function, ACL, transactions. **Substitute:** fictional table and save wrapper; no production schema data, READY, worker, lease, official_predictions, MCP or receipt. This is not production-save E2E. Fixture password is public ephemeral CI configuration, not a production credential. No secrets or Supabase connection are used by CI.

## Historical observations, not raw-input scoring reproduction

Fresh read-only verification: deployed MCP remains v39 with bundle SHA-256 2601ff8de87dd7a061716c7274546efc0d984ce93d2d37abf2d10768dca2e7ad. Three DB definitions match archived source after restoring the pg_get_functiondef trailing newline; current definition MD5 values are recorded in production-readonly-observations.json. No source drift was found.

| Date | FROZEN races | Runners | Detailed review arrays | Base/effect arithmetic checkable |
|---|---:|---:|---:|---:|
| 11/14 | 30 | 435 | 30 races | 0 horses |
| 11/15 | 27 | 386 | 7 races / 96 rows | 0 horses |
| 11/16 | 0 | 0 | 0 | 0 |
| 11/21 | 20 | 298 | 13 races / 194 rows | 194; all match |

Missing numeric fields/older formats are UNVERIFIED, not failures or zero-point effects. All queried FROZEN lack score_engine_id. The 13 afternoon ledgers reproduce declared scores and ranks twice, including reordered component processing. Kyoto12 #1 retains base39 + effects38 = review77, existing bridge+1 = final78, rank2. This is a trace of saved numeric declarations, **not proof of fact-to-points coefficients**. No target results were read for the new arithmetic queries/tests. No new predictions or captures are produced. TOP5 capture-rate regression cannot be meaningfully evaluated for a new engine because no approved new/original complete engine can be executed.

## Not connected / not verified

- Full approved base and per-factor point generator is still not recovered. The model rate and bounded Eval/pace bridge are real code but neither is the complete 100-point engine. Textual score_method is not an approved executable formula.
- Historical source_ref strings do not establish run/race/horse identity, original HTML body and trusted pre-start retrieval time. No official-provenance promotion was made.
- Independent semantic verification of whether a factor deserves its claimed points, formal tie/boundary policy outside existing bridge, and complete evidence independence across factors remain unverified.
- The SQL candidate is explicitly arithmetic/shape only. It has no externally authenticated ACTIVE set, complete grade/EYE17 proof, or source authenticity checks; therefore SQL success does not authorize production deployment. It is not attached to any real save function.
- engine-lock.json remains UNCONNECTED / production_allowed=false. Callback-based mock registry tests are not an actual engine connection.
- Production-equivalent shadow evaluation and new real-race CLAIM → FROZEN → receipt tests: 0. No deployment approval or complete approved engine/resolver exists.

## Minimum remaining decisions and controlled application

1. Recover or explicitly approve an executable, versioned fact-to-base/factor rubric, including rounding/ties and missing-data rules. New coefficients require user approval with comparison evidence; do not infer them from known outcomes or historical scores.
2. Supply authorized immutable input/evidence bindings (horse/run/race IDs, original content hashes and fetched/as-of clocks). Validate completeness and independent EYE factors without changing existing selection logic.
3. Implement that actual generator/resolver, then independent semantic recomputation and real save-function dependencies in isolation. Validate shadow output before any mandatory production gate; an unconnected gate would refuse every normal save.
4. Present exact deployed version/hash, diff, affected call path and explicit approval request. Only after approval connect a disabled-by-default canary to the existing protected MCP save. No direct prediction writes or additional CLAIM outside that approval.
5. Before deadline on one eligible future race, verify real receipt/FROZEN/DONE and unchanged payload after the ordinary approved flow. Historical records stay immutable.

Rollback: current changes are candidate/CI only, so no production rollback is needed. Revert the candidate commit in this feature branch to restore prior code. Future deployment must first back up the exact MCP bundle and save definitions, use the old compatible save path until canary acceptance, and disable the new connection/restore the backed-up bundle on failure; never edit saved FROZEN or bypass a failed gate.

Production writes, claims, saves, Cron changes, main changes, deployments, paid API calls: **0**. Formal engine complete / production-ready: **NO**.
