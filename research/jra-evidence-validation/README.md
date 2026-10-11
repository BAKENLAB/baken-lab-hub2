# Follow-up validation from ce33a61

Candidate HTML storage and entry-state logic remain NOT production applied. Existing publish ACL was not changed again.

Local PostgreSQL unavailable; docker info one bounded check returned socket permission denial. No escalation/retry/environment installation. The production PostgreSQL MCP rollback-validation call returned Invalid or expired requestState, with no test results. This is NOT a PostgreSQL PASS or proof that SQL compiled. Separate read-only connection UTC 2026-10-10 23:58:09 confirmed jra_evidence_private absent and public.jra_store_html_evidence_v1 absent. No persistent candidate objects exist.

rollback-validation.sql is a candidate validation script, BEGIN/ROLLBACK only, no COMMIT; creates only new candidate schema/tables/functions; synthetic INSERT/UPDATE/DELETE/TRUNCATE targets only jra_evidence_private; existing production tables never written. Tests prepared: service capture, idempotency, exact gzip bytes, gzip SHA CHECK, 2 MiB raw length rejection, separate repeat observations, service update/delete/truncate denial, anon/authenticated RPC/schema-table denial, RLS+FORCE RLS flags, owner update trigger denial, expired-capture and orphan-blob deletion by postgres. NOT EXECUTION-VERIFIED. 512 MiB aggregate quota and100k observations concurrency boundary still require isolated tests (do not allocate512MiB on production just to test). No security advisor on new schema possible since it was rolled back/absent.

fixture.json is clearly synthetic, never official HTML. Offline replay checked exact synthetic HTML/gzip/hashes and status_verified=false. Static script assertions checked BEGIN/ROLLBACK, absence of COMMIT and existing-production WRITE targets: PASS. This is not SQL execution. Prior13 unit PASS are previous-stage results, not rerun/inflated here.

Real official DOM: no saved JRA HTML body located; approved proxy already failed; no available read-only official-fetch tool. Production jra-live stores only metadata/hash, no read-only raw-body endpoint. It was not redeployed/invoked, and no proxy bypass attempted. Cannot establish official cancellation/exclusion/confirmed-entry selectors or labels. Needs raw official response bytes with URL/time/hash via an already authorized browser/collector export; screenshot is insufficient.

Queue point-in-time changes: UTC23:46:11 23done/1pending and25 evidence/23race_keys; pending Tokyo3R attempts0 errornull updated23:45. UTC23:58:36 22done/2pending (Kyoto1R/Tokyo12R attempts0 errornull updated23:55),34 evidence/23race_keys, all status_verified=false. Kyoto4R still lacks evidence. Previously24done was a point-in-time observation, not durable completion; periodic resets/requeues need read-only cause check, no job21 changes allowed.

cron9 last observed normal23:30 run47071 succeeded, HTTP200 request17793; next ordinary00:00 UTC (09:00JST) due after these reads. Post-ACL next execution is pending observation; no manual trigger or schedule modification permitted/used.

No code deployment, new production schema/migration, LOCAL/FROZEN/prediction/job21/main changes, model calls or new paid resources. Failure of validation infrastructure remains a blocker; do not promote storage until actual SQL and concurrency/retention tests pass.

Read-only job21 inspection confirmed its queue UPDATE includes done, sets status=pending and attempts=0; this explains periodic return to pending while prior evidence remains. Job21 itself was not changed. Thus require both acquisition history and current requeue status in reports; do not interpret every pending as never fetched.

Final cron boundary observed UTC2026-10-11 00:00 (JST09:00): cron9 run47117 succeeded, discover HTTP200 request17819, queued24. This is the ordinary scheduled post-ACL run, not manual invocation. Snapshot00:00:12:19done/5pending,36 evidence rows covering23race_keys, verified0. Schema/RPC absent again. Source records for24 races and saved runners exist, but fresh evidence confirmation still missing forKyoto4R. All-races-new-evidence completion is NOT claimed. Full latest read-only race snapshot is separate JSON.
