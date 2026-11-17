# V5 research: deterministic allocation and evidence eligibility (proposal only)
Reference: v4-diagnosis/reports/README.md at e56df473130ec3ed8ddb3c4c4384aa4696baa6a6. This is a research specification, not a model change, approved rubric, or claim of improved capture.
## Observed faults
- Reverse axis iteration changes 433 runners' ranks, 78->79 captured (12 gains, 11 losses); iteration-order-dependent scoring is unacceptable.
- 1,016 duplicate-component suppressions, including 135 mixed used/unused atoms. 652 shared-cap suppressions, 243 cases with a single depleted root suppressing multi-root claims.
- Credited 15,050.085 vs root-accounted 28,818.285: attribution is not conserved. 443 zero-point atom reservations.
- 46 excluded runners include 7 captured by comparator; history absent is not established.
- V4 EYE demands different run roots even for distinct independently verified mechanisms; V2 had a more nuanced pathway. Do not simply waive independence.
## Engineering contract
1. Make immutable evidence facts: race identity + runner identity + observation field + time + source; separate provenance root, measurement, mechanism and candidate score axis. Missing/ambiguous facts cannot contribute. Never use outcomes after target cutoff, popularity or odds.
2. Compute all candidate axis claims BEFORE allocating; use stable canonical IDs. Aggregate repeated descriptions of the same fact/mechanism exactly once; do not equate different observations from same race by default. Track partial overlaps explicitly.
3. Allocate a shared budget via deterministic order-independent constrained allocation (e.g., fixed point or canonical maximum-weight flow with explicit predeclared priorities, not iteration order). Define exact conservation: sum credited to claims equals sum debited to evidence budgets; no full-root attribution duplication. Zero-value claims do not reserve budgets. Stable tie-break independent of input permutation.
4. Separate score evidence sufficiency from ability: missing -> interval/uncertainty, never zero ability or fabricated neutral. Keep all 623 runners in audit. If definitive TOP5 not identifiable from intervals, report unresolved, not a forced rank.
5. EYE: review every outside-TOP5 runner, at most one. Require >=2 current-relevant positive mechanisms, each supported by verifiable distinct atomic observations; if both share one race, require documented conditional-independence test and cross-feature overlap check, else reject as unverified. Same race is neither automatically independent nor automatically disqualifying. No rank6 default. Do not infer EYE from target result.
6. Preserve V4 and 92 comparators as immutable. Implement tests before comparing known outcomes: random permutation invariance (axes, facts, runners), budget conservation, mixed used/unused roots, zero-claim reservation, multi-root proportional accounting, EYE same-root independent/dependent examples, no future information, missing-history eligibility, no odds.
7. Analyze 46 excluded runners using original field/live/archive references, with separate failure codes: identity mismatch, missing verified race, timestamp issue, schema parse, source disagreement, flat status unknown, other. Never mark no racing history without proof. Only verified as-of facts may change eligibility.
8. After freezing mechanics, run 5R batches against 46R/623 and report coverage, unresolved ranking, TOP5/EYE, 87/92 comparator gains/losses with identities. Existing cohort is development/diagnostic, not a future holdout. Require new chronological holdout after rule freeze before promotion.
## Milestones
A: standalone allocator and permutation/conservation unit tests.
B: EYE independent-mechanism validator with examples and audit traces.
C: 46-runner source/eligibility audit, no invented fills.
D: frozen development replay and detailed comparison; do not tune to 92.
## Safety
Research branch only, PR #51 Draft. No production/main/DB writes/FROZEN/Cron/deploy, no direct DB edits or bypass. Any data queries SELECT only. Never alter previously frozen predictions.