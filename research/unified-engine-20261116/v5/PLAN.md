# V5 mechanics freeze — before cohort replay

Specification: ../v5-deterministic-allocation-spec.md @803e83571547a7989d3200517a23b667d7a91f1e. Research only; existing 46R are development data already observed, not a holdout.

Preserve V4 100-point axis caps, raw units, unknown budgets, historical admissions and comparator data. No fit to results, no coefficients added. Only allocation/provenance/independence/identifiability change. Uniform within-component attribution is an explicit accounting assumption, not proof of each primitive's causal contribution.

## Deterministic simultaneous allocation

Integer micro-points (1 point = 1,000,000). All candidate components are gathered before allocation. Canonicalize and deduplicate facts and exact repeated component descriptions; conflicting duplicate identities fail. A component's requested cap×unit is divided equally over its distinct atomic measurements using largest remainder and canonical ID ties. Null components retain unknown upper budgets. Zero-value components reserve nothing.

Each atomic measurement has one common budget: maximum requested slice for that fact among competing components, not their sum. Contenders split that budget proportionally in one simultaneous pass. Each actual source race then has the existing 25-point budget, applied proportionally to surviving slices in one simultaneous pass. No sequential consumption and no after-cap redistribution. Credit equals the sum of these same source debits exactly in integer units. Mixed used/fresh observations keep their separately attributable portions. This is conservative fixed proportional allocation, not an optimum-prediction solver or an independence waiver.

Canonical keys exclude target outcomes/market fields. Provenance race, observed horse, primitive field, source and observation time are explicit; ambiguous/missing/future facts cannot earn points. One underlying observation with conflicting value/provenance fails rather than becoming two budgets. Context/gating facts are recorded but do not create extra additive slices. Derived corner/lap/body composites must decompose into actual observations; incomplete provenance makes that component unknown.

## EYE and rankings

Different mechanisms must have nonoverlapping atomic observation dependencies and pre-target sources. Same race additionally needs a hash-bound conditional-independence review: predeclared conditioning fields, disjoint feature supports, a reproducible held-out conditional-dependence test with positive sample size and fixed threshold, no target outcome/market data. A text claim of independence or different field names alone is insufficient. No such review is presumed available. Different races are not proof of causal independence; overlapping measurements still fail. Review all623; at most one EYE and full outside-pool comparisons. No TOP5 definitively identifiable from uncertainty intervals => definitive TOP5/EYE unresolved. A separate diagnostic lower-bound ordering may be exported, clearly not an ability rank or prediction. All comparator captures are measured separately on that diagnostic projection; unresolved publication selections are not counted as zero-quality predictions.

## Excluded46

Audit original live/archive references and exact eligibility reasons per horse. Distinguish identity mismatch, missing verified race, timestamp, parse, disagreement, unknown flat status, other. No new official retrieval or DB mutation. Existing evidence may justify recovery only if identity, source, pre-target times and flat status are established; otherwise leave unresolved. Do not infer career0.

## Sequence

A. Standalone allocator + permutation/conservation tests; commit.
B. Evidence adapter, EYE validator,46-source audit + integration tests; freeze hashes and commit before outcome comparison.
C. Replay batches1..10, max5R each; create decision hash lock before reading labels; checkpoint every batch. Compare old87/strengthened92/V4 78 by horse, with missing-result status retained.
D. Aggregate, source/scope verification, Draft PR update. New chronological holdout required before any promotion. No production/main/DB/FROZEN/Cron/deploy/paid API changes.

### Provenance implementation details fixed before replay

Current entry weight/body facts are the only same-date facts permitted, with CURRENT_ENTRY kind and pre-post source time; prior race facts must be strictly earlier dates. Composite corner observations decompose into exact corner indexes; body proxy uses actual saved body observations. Numeric units remain stored V4 units. Context/gating conditions are not extra additive slices. Eval preserves the pre-existing reconstructed cache limitation (original rowwise unverified), not a claim of official original verification.

Same-race validator supplies a frozen stratified Fisher-z conditional linear-equivalence diagnostic and hash-bound documented design, not causal independence proof. Multivariate supports are unimplemented/rejected; absence of nonlinear-dependence proof is a remaining limitation and actual cohort has no supplied certificates. No cohort same-root pair will be auto-approved based on this synthetic unit-test pathway. New chronological independence evidence and review are required before practical use.
