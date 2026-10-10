# JRA post-recovery audit (SHADOW only)

Production basis: jra-live v26 retrieved from Supabase, not GitHub main. Audit snapshot UTC 2026-10-10 23:22:45 (JST 2026-10-11 08:22:45); acquisition continues so counts are point-in-time.

## Acquisition and scheduler

At snapshot: Tokyo 1–11 done with one evidence each; Tokyo 12 pending with attempts=0/no error; Kyoto 4 done since UTC 17:03 with no evidence; Kyoto 1–3/5–12 pending with attempts=0/no error. All 24 have previously stored runner rows; pending means current queue work outstanding, not necessarily no historical data. Follow-up 23:23:15: Tokyo 1–12 done, Kyoto 4 done, 11 Kyoto pending. Counts 13 done/11 pending; evidence covers Tokyo's 12 races. Pending races are waiting in ordered single-race-per-minute queue, not known fetch errors. Old 2026-09-21 pending rows have attempts=3 and are ineligible; they do not block these 11.

cron 10 succeeded each minute from 23:14 through 23:22; corresponding JRA sync HTTP responses 200, failed=[]. cron 9 active every 30 min; last measured actual run 23:14 (temporary verification schedule, already restored), HTTP 200 queued 24. Next ordinary 23:30 cycle was not observed in this audit window: sustained cron 9 operation remains not yet demonstrated. Do not equate SQL scheduling success with successful HTTP; both were separately inspected. Job 21 command hash unchanged.

## Provenance limits

jra_html_evidence stores URL/time/hash/count, NOT HTML body. Hash is decoded HTML encoded UTF-8, not original wire bytes. All records use UNVERIFIED_HTML_CAPTURE/official_status_verified=false. Production capture success and queue done do not establish runner status, identity, current evidence, or prediction readiness. Kyoto 4 is a legacy done row without new evidence. No new external collection or production execution initiated by this audit; SQL read-only only.

No saved JRA card HTML available locally for these fetched records; the existing authorized proxy is known failed and was not retried or bypassed. Actual JRA cancellation/exclusion/confirmed-entry DOM locations and labels remain UNVERIFIED. Do not infer ACTIVE from card listing, blank cell, jockey/weight, odds or historical form. An independently captured, timestamped official HTML matching race+hash is needed to implement actual selectors and label rules. Synthetic unit fixtures are not official evidence.

## Confirmed hazards and minimal fixes

- Production public.publish_jra_live_race(uuid) SECURITY DEFINER/search_path public hardcodes status ACTIVE for every stored runner, then writes BASIC_READY/official_schedule_checked=true. No current-status validation. anon/authenticated/service_role EXECUTE all true. v26 does not call it, but other callers remain unverified; public RPC execution is a significant residual risk. publish-acl-proposal.sql is rollback-only and NOT executed. Backup existing ACL first; restrict PUBLIC/anon/authenticated; audit callers. Privilege repair alone cannot certify status.
- jra_live_runners has no current entry-status/evidence columns. parseCard never extracts current status. Capture-only boundary must remain until verified evidence integration is separately tested and approved.
- Evidence insert failure is logged yet queue becomes done. Check evidence separately; do not trust done alone.
- Runner upsert does not delete old runner rows: removed listings can leave stale horses. Needs complete verified field snapshot and no inferred ACTIVE.
- Queue processing/done updates lack error checks; sync returns HTTP 200 even if failed array nonempty. Monitor failed array as well as status code. No atomic claim; overlapping calls can duplicate work. Not altered here.
- Minimum follow-up: retain real HTML and source timestamp/hash without secrets, verify current-state DOM for each horse; build separate status observations; bind to race+horse+snapshot+time; preserve frozen payload; hold only unknown race; reevaluate remaining active field after pre-freeze changes; isolated PostgreSQL integration test under save lock. Do not delay freezing solely until immediately before post.

## Candidate and tests

publication-guard.mjs is a pure SHADOW guard, no DB/network. Missing/unverified/current-scope mismatch → HOLD. Verified synthetic CANCELLED/EXCLUDED are separated from active before freeze; frozen supplied payload preserved byte-for-byte structurally; independent batch processing; no input modification. It outputs CANDIDATE_ONLY, never production READY. It trusts caller-supplied verification/rule ID; does NOT authenticate them or replace real DOM verification. Real selector extraction, reviewed production rule registry, freshness limits, schema migration, actual save/publish integration remain unimplemented.

Run `node research/jra-post-recovery-audit/publication-guard.test.mjs`: 12 PASS, 0 FAIL. No previous PASS tests rerun to inflate results. Existing entry-policy.mjs remains untouched; evaluation signature/full-field reevaluation stays its separate concern.

No production DB writes, deploy, cron changes, LOCAL changes, saved prediction changes, main changes, model calls or additional paid APIs performed in this audit. Candidate must not be deployed until missing real-DOM and DB integration tests complete.
