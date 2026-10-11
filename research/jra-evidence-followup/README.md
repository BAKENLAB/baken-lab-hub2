# JRA evidence follow-up from eba7397

## Kyoto 4R cause and recovery (real production observation)

CNAME pw01dde0108202604040420261011/79, date2026-10-11, Kyoto4R, race_type/surface障害, distance2910. Legacy queue done atUTC2026-10-10 17:03 before evidence-capable capture. official_races has0 rows for this obstacle race: existing publish RPC excludes obstacles. Job21 requeues done only when a matching future official_races row exists; this race never qualified. v26 parseCard supports obstacle/surface/distance and its sync does not exclude obstacles; no parser fix needed to capture evidence.

One narrowly guarded queue UPDATE changed only this Kyoto4R row to pending/attempts0, only if currentlydone and evidence absent. This was within requested safe capture/save; no cron commands/schedules or job21 changed. Existing cron10 fetched it atUTC2026-10-11 00:06:02.083 (JST09:06),9 runners, statusdone/attempts1/errornull. Evidence source URL https://www.jra.go.jp/JRADB/accessD.html?CNAME=pw01dde0108202604040420261011%2F79 ; decoded-HTML UTF8 SHA2569cd50b686ae3b2cba4808abf956d19e4238235220e9ef7bcc5fcd5423bb7b64a. Source is read from actual queue, not synthesized. It is metadata/hash capture, NOT raw HTML body storage, verified entry-state, or prediction publication. No Edge deploy or obstacle prediction enabled.

## PostgreSQL transaction verification

Reattempt of original rollback-validation.sql succeeded CORE_VALIDATION_PASS. Verified real new candidate objects insideBEGIN/ROLLBACK only: schema/table/RPC creation, service-role RPC insertion, idempotency, exact gzip stored bytes, gzipSHA CHECK rejection, bad raw length rejection, separate observations sharing blob, service update/delete/truncate denial, anon/authenticated RPC/table denial, RLS/FORCE flags, owner UPDATE immutable trigger, expired observations then orphan blob deletion. No existing production table fixtures or modifications. Schema/RPC absent afterROLLBACK and from separate reads.

Quota review found capture-capacity trigger rejected even idempotent replay when count reaches maximum. Research storage-proposal.sql now bypasses only the quota check for an already-existing exact observation (cname+wirehash+fetched_at); constraints and unique key remain. Existing stored data is not overwritten. rollback-validation.sql updated to use corrected candidate.

old-quota-bug-reproduction.sql request returned Invalid or expired requestState; no actual old-failure reproduction claimed. Corrected quota-retention-validation.sql executed successfully QUOTA_AND_RETENTION_PASS: reduced byte limit to one fixture's compressed size and event limit2, avoiding512MiB resource allocation. Verified both RPC/direct-table capacity rejection, new-event count rejection, replay accepted at full count, unexpired observation/shared blob preserved on expiry cleanup, orphan removal after all observations expire. Limit substitutions are ONLY in rollback test, production proposal remains512MiB compressed and100k observations. Concurrent sessions at full production limits remain untested; this is not a512MiB stress test. Candidate schemas/public RPC remained absent. No safety checks bypassed after MCP errors.

DB verifies compressed SHA, not raw-decompression hash; trusted replay helper verifies gzip/raw/decoded hashes. Previous offline13 unit PASS not rerun just to inflate counts. Production HTML storage and status logic remain NOT applied. Retention tests simulate cutoff dates; no automated deletion/cron installed. Expiry does not delete data automatically until approved maintenance is integrated.

## Reacquisition/prediction safety

Final UTC2026-10-11 00:16:51 (JST09:16):24done,48 evidence rows/24 race_keys, official_status_verified0, duplicate(race_key,html_sha256)0. Unique constraint makes same content idempotent; changed HTML yields another row. Metadata table does not retain every repeat fetch timestamp when content unchanged; separate immutable capture observations are in candidate design only. Job21 requeues based on existing conditions; no job changes. v26 capture-only source verified(no publish RPC call). Existing predictions aggregate hash e9323c31f96075b247f073690f5f9509 before/after this work matches; job21 full hash910dea3ae42120106d909bfd5b573d06 matches. No LOCAL/FROZEN/existing prediction/main modification.

## Raw HTML / real DOM still unverified

Existing approved production fetch obtained actual official HTML and parsed Kyoto4R successfully, but discards body after metadata capture. No existing read-only body-return endpoint or approved browser fetch tool is available to this environment; previously failed proxy not retried/bypassed. No raw official body saved in current research/evidence store. Cannot establish actual cancellation/exclusion/confirmed-entry cells or ACTIVE semantics from metadata. Do not use screenshots or status guesses.

Raw preservation candidate already retains response bytes before decode, gzip plus three hashes, source identity/time and false verification. To complete DOM validation, need an authorized export of raw response bytes plus URL/time/hash from existing official browser/collector, or a separately approved private read-only capture integration. Current production does not support that export. Installing candidate storage/entry logic now remains prohibited: live DOM, concurrency, raw retention integration and maintenance approvals incomplete.

All SQL validation files BEGIN/ROLLBACK, no COMMIT; writes only newly created candidate private tables. Original publish RPC permissions unchanged. No new paid models/API keys/resources or proxy bypass.
