# GⅠ INTELLIGENCE｜JRA CLAIM pre-FROZEN read-only integration

- 2026/11/19 implementation plan: connect to **jra-claimed-mcp**'s official `jra_claimed_context` and `jra_evidence_rank_preview` responses only.
- Explicitly do **not** edit `jra_save_claimed_prediction`, the guarded RPC, `jra-verified-evidence-rank-bridge.mjs` or any existing FROZEN data.
- Official JRA evaluation and Eval prior-run score-rank logic remain authoritative. The retrospective 17 GⅠ manual scores are **not** merged, averaged, or used for bonuses.
- New `g1_intelligence` field: full-field history, pace/opponent evidence presence, races with close defeats needing *manual* reason review, rank 4–10 boundary, and missing external pre-race trainer/workout/equipment sources. Every item is either available in official pre-race context or explicitly marked unverified.
- Fail closed if not a recognized GⅠ, missing official card/history, invalid live stage/lease cutoff, runner mismatch, target-result leakage, or post-time observation. No odds, wagering or target race results.
- For grade-labeled races: accept exact G1/GI/GⅠ (not 1勝クラス). For canonical JRA GⅠ use whitelist of names. No result data is queried.
- This is **Phase 1 only** (coverage/monitor): score_delta=0, ranks/EYE unchanged; use it to identify relevant evidence for HUB's existing 100-point criteria. Future Phase 2 scoring must be separate, fully reproduced with controls against double counting and tested on held-out pre-race FROZEN pairs.
- Tests: `node --test research/g1-intelligence/g1-intelligence-audit.test.mjs`
- On 2026/11/19 initial status, 2026/11/22 JRA queue had 0 jobs/CLAIM; an end-to-end live GⅠ CLAIM test remains pending. Do not fabricate readiness or call save for that date.
