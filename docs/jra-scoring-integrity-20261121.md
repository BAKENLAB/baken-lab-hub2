# JRA scoring integrity gate — 2026-11-21

## Verified production finding
On 2026-11-21, seven early JRA FROZEN predictions used race-specific `INDEPENDENT_*` formulas and thirteen later predictions claimed full-depth scoring. The official save function checks `audit.validated_core='BASE_CORE_0.1'` but does not independently validate `audit.score_method` or recompute itemized score contributions. The existing advisory diagnostic `public.lab_jra_scoring_integrity_preflight_v1` flagged all seven early predictions and passed the thirteen later records; passing does NOT establish provenance or correct component-level scoring.

## Required implementation, not yet complete
1. Locate the actual JRA prediction generator and ensure it has one versioned, immutable scoring implementation. Do not allow per-race free-form coefficients.
2. Emit a machine-readable scoring ledger per active runner: verified as-of source IDs, base score, each named component with signed numeric delta, cap/round policy, final score, scoring-engine ID and source snapshot/version.
3. Build an independent validator that recomputes each score, enforces official runner coverage, ranks and TOP5, checks verified evidence provenance, rejects market/target result leakage, and verifies a registered scoring engine ID.
4. Roll out to shadow/diagnostic mode, test historical valid and invalid payload fixtures, then wire the mandatory gate into the existing `public.jra_save_claimed_prediction` transaction. Preserve its original CLAIM, worker, pre-start, READY, duplicate FROZEN and protocol checks.
5. Test the real official pre-start CLAIM/save path on a future eligible race; compare receipt, official_predictions FROZEN and evidence ledger. Do not fabricate a successful live test after race start.

## Invariants
No existing FROZEN edits, post-start saves, direct DB prediction writes, expired CLAIM reuse, gate bypass, Cron restart, market odds/popularity in ranking, or result leakage. Do not activate a partial validator that could reject every otherwise valid race. If proof is unavailable, record NOT_VERIFIED, not PASS.

## Current state
Read-only drift view and advisory preflight exist in production; both were restricted from anon/authenticated access. Mandatory engine and per-factor scoring validator are NOT yet implemented or deployed.
