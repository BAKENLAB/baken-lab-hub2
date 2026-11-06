# JRA0.4 preflight and official cancellation handling

The advisory routine `public.lab_jra_save_preflight_v1(text,jsonb)` has been deployed in production as a **read-only diagnostic**. It does not modify official predictions, existing JRA save functions or Cron. Its only purpose is to identify mistakes in a **new candidate** before invoking a legitimate JRA guarded save.

The check validates JRA protocol version, audited runner count, all-runner flag, original field verification, TOP5 consistency, grades and substantive reasons, market separation and empty bets. Officially CANCELLED runner may have null rank only with explicit `audit.cancelled_runner_nos` provenance, as 2026-11-01 東京6R demonstrates.

Regression: **18/18** prior saved JRA races correctly pass (including one official cancellation). Intentional wrong count, unverified field, market used, nonempty bets, absent TOP5, and unrecorded cancellation each fail with distinct diagnostic errors.

Follow-up JRA automation instructions have been updated to call the new read-only preflight **before** the official JRA MCP save. An `ok=true` advisory response is **not** a substitute for current official evidence, live CLAIM, missing-source resolution, safety review, or DB FROZEN/receipt verification.

This is quality tooling; JRA 3-venue throughput and full-day success are not yet proven. #39.
