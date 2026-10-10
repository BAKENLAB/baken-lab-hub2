# Issue 4 JWT-time recovery

Previous discover failure: 2026-10-10 23:05:15.643 UTC GET /rest/v1/jra_live_seeds returned 401; handler returned HTTP 500 "JWT issued at future". This is the initial seed read, before JRA fetch/discovery/queue upsert. Concurrent sync DB requests succeeded.

Vault gateway JWT: anon; iat 2026-09-18 01:34:45 UTC, nbf absent, exp 2036-09-17 13:34:45 UTC. It was not future-dated. Production runtime's service credential is opaque rather than JWT. Internal Authorization and apikey both match that credential (boolean checks only), not the incoming cron JWT. Platform-generated JWT iat/nbf cannot be inspected from the function; exact platform clock root cause remains unconfirmed. Runtime and HTTP Date matched the same UTC second on observed successful calls.

Change: only GET / internal DB HTTP 401 with exact message "JWT issued at future" is retried once after 1100 ms. Writes, other auth failures, persistent failures are not bypassed. Gateway verify_jwt remains true; server JWT signature/time checks remain unchanged. Diagnostic output allowlists only times, statuses, and header-match booleans; never credentials, arbitrary JWT payload, or URLs. Diagnostic parsing does not authorize requests.

Tests: db-time.test.mjs 6 PASS/0 FAIL; auth.test.mjs 13 PASS/0 FAIL. Run each with `node FILE` to see individual tests (this environment's `node --test` summary counted files rather than child tests).

Production v26 manual requests at 2026-10-10 23:12:54.962380 UTC:
- 17766 discover HTTP 200, Tokyo/Kyoto, queued 24, next-day seed 2026-10-12.
- 17767 sync_batch HTTP 200, Tokyo 2R, 12 runners, evidence_saved=true.
- 17768 no authorization HTTP 401 (gateway).
- 17769 incorrect dedicated token HTTP 401 (function).

Additional evidence: Tokyo 2R, fetched 2026-10-10 23:12:57.104 UTC, SHA-256 f5ace83d5b94db08cf2218981c65f8a270ff591a87d1155c3c8a80db0b7b78a1. Evidence table stores metadata and hash of decoded HTML UTF-8, not original wire bytes or HTML body. Status remains UNVERIFIED_HTML_CAPTURE: do not treat capture as official status verification.

Cron 9/10 backup retained privately. Only 9/10 commands changed to authenticated helper; job 21 excluded. For actual scheduler verification job 9 is briefly set to every minute, then its original schedule must be restored from backup. Job 10 retains original schedule. Rollback: pause 9/10; drain; run rollback.sql; deploy the backed-up v25 index.ts with verify_jwt=true; verify source; run resume-original.sql. Collected evidence is retained, not erased.

No LOCAL, prediction, HUB or main changes. Candidate remains capture-only; unsafe unconditional ACTIVE publication is disabled. This recovery is not JRA prediction readiness.

Actual scheduler verification (UTC 2026-10-10 23:14:00):
- cron 9 runid 47044 succeeded; request 17770 HTTP 200, queued 24.
- cron 10 runid 47045 succeeded; request 17771 HTTP 200, Tokyo 3R, 14 runners, evidence_saved=true.
- Additional Tokyo 3R evidence fetched 23:14:01.433 UTC, SHA-256 12a9ad924c858c3d223063248a6a2afe3a2b36adc500624c8f0aef072a33f8ee. Evidence count 1 before, 3 after verification.
- cron 9 original */30 * * * * restored; cron 10 * * * * * retained; both active=true. Job 21 */5 * * * * and command MD5 bcdeb15f34f4449ea0fa98514d01a959 unchanged.
- New helper SECURITY INVOKER, search_path=pg_catalog; anon/authenticated/service_role EXECUTE=false, postgres execution only. Security advisor showed no finding mentioning either the new helper or backup; existing project findings were not changed.
- Observed retry log count 0 in the validation window: production recovery succeeds, but bounded retry's effect on the original intermittent platform JWT error is verified only by offline injection, not by a new live recurrence. Long-term stability and platform-internal iat/nbf remain unverified. No JWT validation disabled.

Deployment backup: baseline v25 matches previously archived baseline; private.jra_issue4_cron_backup remains for rollback. Current serving version 26, verify_jwt=true. Successful verification means rollback was not needed this time.
