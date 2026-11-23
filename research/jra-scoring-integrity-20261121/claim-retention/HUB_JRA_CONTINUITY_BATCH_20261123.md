# HUB JRA scoring-continuity recovery batch — 2026-11-23 JST

## Objective and boundary
Investigate why the actual 2026-11-22 pre-race FROZEN records lost the stable deep-analysis and score-method audit fields, and add an isolated regression blocker rather than claiming production scoring is healthy. Draft PR #83 only. No main merge, production Supabase DDL/DML, Edge Function/MCP deployment, CLAIM, FROZEN edit, Cron, credential change or betting action.

## Observed historical production discrepancy (read-only evidence)
The audit below reflects `public.official_predictions` FROZEN JRA records and `public.lab_jra_score_method_drift_audit_v1`. It counts declared fields, **not** proof that the announced official-body evidence was authenticated or that the fact-to-score judgments were reproducible.

| Day | JRA FROZEN | score_method declared | full_depth_comparison key | archive lap-detail key | full_depth_source_review key | EYE selected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-11-15 | 27 | 27 | 27 | 27 | 0 | 18 |
| 2026-11-21 | 20 | 20 | 20 | 13 | 13 | 0 |
| 2026-11-22 | 18 | **0** | **0** | **0** | 18 | 0 |

On 2026-11-22, `runner_history_checked` arrays occur in 18/18 records, containing 256 submitted reviews. `evidence_rank_bridge` exists in 18/18 (23 recorded nonzero bridge score adjustments). The alternate `full_depth_source_review.ok=true` field is present in 18/18. These are **declared reviewer checks**, not an authenticated official-body-to-score E2E proof. The score method and prior deep/pace disclosure still disappeared. Do not describe the day as uniformly unanalysed; describe the missing provenance and declared methodology accurately.

The 2026-11-21 method-drift view classifies the first 7 FROZEN as `EARLY_ADHOC_FORMULA`; later records claim deep evidence, with multiple differing textual descriptions. This is not yet a single formally approved 100-point generator. The active JRA protocol still permits manual whole-field reassessment. There is no verified immutable source-to-score generation chain.

The read-only Supabase Edge request log for 2026-11-22 shows `jra-claimed-mcp` runtime versions v39 → v40 → v41 → v42 between 06:07 and 16:31 JST. The first missing-method FROZEN was already at 09:33 JST, so **later MCP version changes cannot by themselves explain the first absence**. Correlation does not establish which worker constructed a missing method. Draft research PR #83 is not proof of a production rollout.

## Research changes in this batch

- Added `baseline/mcp/jra-score-method-continuity.mjs.txt`, a pure fail-closed checker. It refuses absent score-method declaration, missing trusted server-side pin, mismatched method, or absence of the explicitly declared full-depth comparison.
- Added a **research-only** pre-save call to `blocker-resolution/candidate-index.ts.txt` after the existing full-depth evidence check, before any save. It binds the approved method to a server-only `JRA_RESEARCH_SCORE_METHOD_CONTRACT` (not caller payload). No configured pin means refusal. A matching declaration is recorded as `DECLARED_METHOD_MATCHES_PIN_ONLY`; **this never says that official evidence or the generation of 100-point scores was reproduced**.
- Added negative candidate-handler tests for missing, drifted, unpinned method and absent full-depth declaration; all must refuse before the test transport's save call.
- Added regression against the 6 **real archived Nov22 morning FROZEN** records in `final-provider/morning-20261122-part-{1,2}.json`, showing that `full_depth_source_review.ok=true` does not override missing `score_method`.
- Preserved the earlier provenance bijection fix for duplicate or missing run IDs in `claim-retention/acquisition.mjs`.
- Updated reversible patch replacement inventory, generator script, full `candidate.patch`, candidate SHA256 manifest, and added CI checks for exact hashes/non-deployment flags.

All data-bearing tests use saved immutable observations or isolated/synthetic transport. The historical six-race negative regression does not write production records.

## Remaining blockers and release gate

1. An **approved, constant source-to-score scoring contract**, pinned to a trusted server value and reproduced from official as-of facts. No candidate label or string hash makes fabricated evidence genuine. The actual formal generator remains unrecovered.
2. Verified official historical original bytes, selected-run IDs and time/version identity, authorized CLAIM-bound private reader and operator-controlled signing/retention. Signed real provider receipts: **0**.
3. Full-field EYE 17-item semantic coverage and a stable TOP5 boundary review; missing EYE selection is not automatically an error but missing review evidence requires investigation.
4. A controlled staging end-to-end replay including authenticated reader, real scorer, actual MCP transport, hard refuses/rollback, unmodified FROZEN and outcome-blinded comparisons against pre-race baseline; separate user approval before production.

**Readiness:** research regression improved, production connection remains **NO**. This candidate currently requires an intentionally absent server-side approved method pin; it is designed **not to deploy** until the fixed scorer and provenance contract are independently approved.

## Follow-up priorities (no user interaction required until a separately approved live change)
Retain Draft and review CI; inspect production job-generation logs/read-only input provenance for 2026-11-15/21/22; recover the actual source-to-100-point decision contract if one exists, otherwise propose a new immutable, audited version and compare under blinded pre-race replay. Do not replace historical FROZEN or auto-apply a new formula to improve hindsight outcomes.
