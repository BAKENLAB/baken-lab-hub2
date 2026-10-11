# STEP2.5 — approval-required rollout and complete rollback

No procedure below was executed. Existing candidate9f40a35 is reused. Production changes remain prohibited until user review and explicit approval.

## Gates before requesting approval

- [ ] Approved isolated Edge environment is available. Use an isolated dataset/project or a genuinely read-only production-data capability; do not give arbitrary candidate code an unrestricted production service_role key. Existing candidate creates a service_role client, so a read-only staging route must be reviewed, not assumed.
- [ ] Real HTTP comparison: old and candidate list/results, ALL/JRA/LOCAL, race counts, dates, circuit identity, every prediction rank/grade/comment/TOP5/EYE/audit, results and frozen timestamps match on an approved snapshot. Sample offline checks are insufficient for full-day parity.
- [ ] Mobile Chromium and Android Chrome,390x844 plus narrower viewport: tabs, race/detail/back navigation, date changes, refresh, failure matrix, no overflow, no loss of healthy data.
- [ ] Stale failure AND loading displays explicitly state 最新情報ではありません; new date never shows previous-date data.
- [ ] Module served with correct JavaScript MIME/CORS, before pages use it. Exact version URL is immutable: /circuit-loader.mjs?v=step2.5-20261011. Never replace bytes under an already cached version URL.
- [ ] Old/new service workers, cold/warm cache, offline shell and restoration tested in a real browser. Existing v21 uses network-first navigation, cache-first same-origin modules, skips Supabase requests. Offline module may be unavailable on a first visit.
- [ ] Measured request/connection budget and query abort behavior in isolation. List reads6→11; results5→10, client HTTP1→2. No production load test.
- [ ] API clients tolerate additive circuit_status/partial, partial HTTP200 and all-failed503. Strict exact-key and status500 assumptions inventoried.
- [ ] Capture current Edge source/config and complete Vercel production artifact/build/commit/alias baseline. Baselinev32 files alone do not prove exact current production frontend version. Preserve verify_jwt and all unrelated configuration.
- [ ] Freeze protected-data reference hashes and verify API source contains no write, cron or worker operations. Explicit user production approval recorded.

## API first, screens second

1. Keep old frontend published. After approval, apply ONLY reviewed API changes; no DB/cron/worker modification. Deploying creates a new Edge version, not a database migration.
2. Perform a small approved read-only smoke check of old-client default ALL and explicit circuit requests. Verify metadata and existing fields. Stop/rollback on healthy-data mismatch, errors, wrong circuit, timeout regression or unexpected query load. No failure injection against production.
3. Publish reviewed static module at its immutable version URL BEFORE activating new pages. Verify exact bytes/MIME and cache behavior. Keep previous page artifact available.
4. After API gates pass, deploy the reviewed TODAY/RESULT pages and module together to the approved target. Do not publish the research directory as a complete site. Preserve normal DOM/CSS/order and existing root assets.
5. Check real mobile/cold+warm cache, one read per relevant view, prediction/result parity and circuit notices. No load generator. Monitor errors and retain rollback artifact IDs.

## Complete rollback sequence

1. Stop rollout. Record failure without secrets. Do not touch predictions, results, frozen timestamps, jobs or cron.
2. Restore exact prior frontend production deployment/alias FIRST, including both pages and required assets. This prevents new split client talking to v32, which ignores circuit and returns mixed rows. Verify previously cached new pages have obtained the restored shell; no claim of instant offline-browser rollback.
3. For already-open new tabs, require online reload/close-reopen. Offline cached/new pages may remain until reconnection. Loader rejects mixed old-API replies; it must not silently mislabel them. A full operational rollback requires checking these clients, not just reverting source.
4. Restore exact prior Edge source and original deployment settings (including verify_jwt) from the backup. This creates a new deployment version with old behavior; it does not reset version number to32. Do not restore obsolete credentials or change unrelated secrets.
5. Retain the versioned module file/URL temporarily for already-open tabs, without mutating its bytes. Once old frontend is confirmed active, new pages are no longer referenced. Consider cache version changes only as a separately reviewed follow-up; none are part of this candidate.
6. Verify default list/results, old-client normal behavior, current aliases/artifact hash, no protected-data changes, no worker/cron changes. Preserve incident and rollback records.

Rollback limitation: a server deploy cannot immediately replace an offline client's installed shell or in-memory JS. This must be disclosed and tested before declaring a complete rollback.
