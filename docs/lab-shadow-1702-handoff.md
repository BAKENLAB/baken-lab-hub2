# LAB SHADOW — 17:02 unattended handoff

## Goal for today
Obtain **one real pre-start race audit** with evidence, without modifying production. If impossible, return a precise blocker and do not report success.

## Preconditions
- User unavailable 16:30–18:20 and 20:50–23:00 JST.
- Work/Codex quota reportedly resets at 17:02 JST. An automation is scheduled, but it **may not have access to the Work/Codex run or its previous artifacts**.
- Branch: `feature/lab-shadow-readonly-20261009`.
- Existing branch assets: `shadow.html`, `shadow-audit-validator.mjs`, `docs/lab-shadow-audit-contract.md`.
- Work-reported totals: Kasamatsu 5 (2 READY), Sonoda 3 (2 READY), Oi 2 (1 READY). **Not independently verified.**

## Execution priority
1. Inspect actual available tools and repository status. Do not assume Codex/Work is callable.
2. Locate the *original* ten-race audit logs and the runner implementation. If absent, record **BLOCKED: ORIGINAL_AUDIT_NOT_ACCESSIBLE**. Do not synthesize race evidence.
3. If original audit is accessible, extract per race: track, race number, scheduled start, fetch time, all runners, official horse identifiers, number of verified prior starts, DB vs official source, missing fields, reason codes, and raw source references. Confirm collected_at precedes start.
4. Diagnose the five DATA_INCOMPLETE races without changing them to READY. Fix only isolated, read-only code on the feature branch if justified.
5. Run tests for invalid/duplicate race keys, READY with insufficient coverage, post-start timestamps, invalid JSON, and missing reasons. Report test command, logs, pass/fail counts. No untested claims.
6. If pre-start live audit can safely be run with available authorized tools and known source access, run **one** race in isolated read-only mode and preserve source timestamps/logs. Otherwise report **BLOCKED: NO_LIVE_RUNNER** or **NO_PRESTART_RACE**, as applicable.
7. At 18:20 provide a short Japanese report: what ran, what is verified, failures, what needs user's decision.

## Never do
- No writes to Supabase production, predictions, results, queues or edge functions.
- No changes to GitHub main, no merge, no Vercel production deployment.
- No automatic publication of unverified predictions or unapproved score changes.
- No claim of automated evaluation when only data collection was tested.

## Go/no-go
A race is eligible for READY only if all official starters and required five prior runs are independently verified before scheduled start, with complete traceable evidence. Any unresolved mismatch means DATA_INCOMPLETE.
