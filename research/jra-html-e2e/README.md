# Raw HTML completion work resumed from5872012

## Verified this stage

Actual candidate adapter generated p_meta and bytea payload from synthetic HTML; adapter-db-roundtrip.sql created candidate objects insideBEGIN/ROLLBACK, executed real public.jra_store_html_evidence_v1, and SELECT returned the actual saved gzip/metadata. Retrieved bytes are in db-returned-record.json. replayHtml decoded them and checked gzip/wire/decoded hashes and exact original43 bytes: PASS. SQL safety: only newly created candidate private tables written; no existing production table writes. Initial generated guard had JS replacement dollar escaping syntax error, corrected before successful execution. ROLLBACK and separate connection confirmed schema/public RPC absent. This is synthetic raw HTML E2E, NOT actual official HTML and NOT a real supabase-js HTTP/PostgREST transport test: adapter payload generation and SQL execution were connected via MCP.

Previous-stage real sequential SQL and reduced-capacity/retention PASS remain previous results; not rerun to inflate counts.

## Concurrency NOT verified

Bounded two-MCP-call advisory-lock experiment: holder requested5s lock, other call reported lock_contended=false. Overlap/competition was not demonstrated; do not claim lock/concurrent insert PASS. It may be serialized/queued at tool execution boundary; no confirmed diagnosis of scheduling. Not repeatedly retried.

concurrency-isolated.py is prepared for real multi-session psql tests only on explicitly approved localhost database named jra_shadow_test*. Rejects unsafe configuration before any writes; this guard was exercised and returned BLOCKED as expected. Syntax compilation passed. Full test NOT run: psql/PostgreSQL absent and previously blocked Docker access not retried. Script requires pre-existing Supabase-like anon/authenticated/service_role roles and extensions.digest; bootstrap is not performed. Dedicated isolated DB usesCOMMIT/TRUNCATE/DROP for test-only lifecycle, unlike production rollback SQL. Never run it via production MCP.

Prepared cases: observed holder lock before second connection, same-hash concurrent replay yields one blob/observation, idempotent replay at event cap, different hashes race for reduced payload budget and only one fits. Full configured512MiB/100k-event load and true multi-session concurrency remain unverified. No test schema was committed on production to obtain cross-session visibility.

## Official HTML and deployment blocked

Available v26 captures only URL/time/decoded-hash/count. No retained raw JRA card body/read-only body endpoint or approved browser fetch tool exists here. Previously failed proxy path and long Docker/environment permission wait were not repeated. No environment configuration, paid resources, credential acquisition or proxy bypass used.

Real JRA取消/除外 DOM structure and confirmed ACTIVE semantics remain unverified; no rules invented. Need an authorized raw-response export with URL/time/hash or a usable isolated capture environment. Screenshots cannot substitute raw HTML.

Candidate raw bytes/gzip/private SQL are NOT production applied. Conditions for staged deployment (real concurrency and actual official HTML capture/replay/DOM inspection) incomplete; no deploy, production HTML storage, status changes or prediction publication. LOCAL/FROZEN/job21/main unchanged. Protected data hashes and latest evidence counts in read-only-audit.json.

## Artifact handling

adapter-request.json and db-returned-record.json contain SYNTHETIC_ONLY fixture data, not keys or official race assertions. Raw HTML never rendered in browser, published to HUB or marked status_verified=true. Repository branch staysfeature/lab-shadow-readonly-20261009.
