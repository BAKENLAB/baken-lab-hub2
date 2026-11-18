# LOCAL1.6 production save integrity hotfix — 2026-11-19

## Actual production deployment
- Supabase project: `qjlvsndiqjfsfjinilig`
- Edge function: `local-claimed-mcp`
- Deployed: version **34**, state **ACTIVE**
- Production source SHA-256: `97437fa3ffe3fd0d75727296451cdda096c1434cccbc74d59a4b50756366bc20`
- This branch includes a snapshot of all 9 deployed files under `supabase/functions/local-claimed-mcp/`. The independent helper is also at `automation/local-16-evidence-save-gate.mjs`.

## Scope
- Before guarded production save, require a completed `VERIFIED_WHOLE_FIELD_FACTS` audit for LOCAL1.6.
- Verify per-horse score/rank match, full active roster coverage, official prior-run reference indices and unique horse identities, and per-horse assessment evidence.
- Expose only allowlisted `LOCAL_16_EVIDENCE_*` error codes through `publicError`, so operators can identify and correct causes while a valid pre-race CLAIM remains.
- Does not compute a new score, choose LAB EYE, alter 1.6 grading, use market/results, rewrite an existing FROZEN, schedule any job, or resume Cron.
- This is **not** adoption of the separate full-result research scoring model or a verified performance gain.

## Historical payload compatibility tests
- 2026-11-16: 30/30 accepted.
- 2026-11-17: 35/35 accepted.
- 2026-11-18: 33/35 accepted; **大井11R, 大井12R** rejected as `LOCAL_16_EVIDENCE_FULL_FIELD_REQUIRED` due to nonstandard `VERIFIED_COMPACT_RACE_RESULTS_ONLY` status.
- Negative tests: mismatched score, mismatched horse ref, missing full-field status, missing runner audit and out-of-range history refs all rejected.
- These are historical read-only tests, **not** a live future CLAIM/FROZEN operational test.

## Operator procedure next eligible race
1. Obtain official READY and an authorized valid claim before any scoring.
2. Read `lab_claimed_context` and the official `official_past_content` / `live_ability_rank_input` for every ACTIVE runner; do not substitute synthetic or retrospectively rebuilt data.
3. Evaluate all runners independently under the **existing** LOCAL1.6 standard, then re-audit all outsiders under the original 17-check LAB EYE rule. Do not infer unavailable sectionals or opponent follow-up.
4. Submit through `lab_save_claimed_prediction` and verify FROZEN/receipt in authoritative DB. If `LOCAL_16_EVIDENCE_*` is returned, determine the exact cause, regenerate the correct payload from official context, and retry **only** when pre-race, READY, lease, claim and all safeguards are still valid. Never blindly resend a refused payload.
5. Preserve pre-race proof of any independently computed strengthened score and ranking **before** making claims about new-vs-old predictive performance. Existing `ABILITY_RELATIVE_V0_5` shadow is not the proposed strengthened LOCAL1.6 scorer.

## Remaining blockers
- Actual stronger full-result evidence with official source receipts and as-of identity is not yet linked through the production scorer.
- Independent strengthened per-horse 100-point score plus ranking is not generated or prospectively frozen by this hotfix.
- Future live-claim validation of version34 still required; historical compatibility does not establish live success.
