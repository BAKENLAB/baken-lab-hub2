# BAKEN LAB | REBORN rebuild — accurate status checkpoint
2026-10-24 JST. Scope: research branch only. **DO NOT promise that full REBORN has been rebuilt.**

## Root cause (confirmed in repository)

1. `lab-reborn-v03.mjs` has five real axis scores: peak, form, course_fit, race_content, rival_strength. Weights remain hypotheses. The engine may return `RESEARCH_READY` with one or more axes NULL; this is the core reporting ambiguity.
2. `lab-reborn-v04-independent-learned.mjs` is a separate 2024-fitted coarse statistical model; it is not a continuation of v03 five axes.
3. `lab-reborn-v05-content.mjs` adds archived pace/content flags and 2024-fit corrections **to v04 only**, and its 2025/2026 holdout did not establish general improvement.
4. `lab-reborn-v06-integrated-shadow.mjs` carries clock and opponent diagnostics, and explicitly has `rank_changes_from_v04: 0` and `v06_score_delta: 0`. It does **not** blend validated effects into actual rank.
5. A previous live4 proxy experiment froze 10 ranks before post-time, which is valuable as a **live4 proxy comparison**, but cannot measure full v03/v04/v05/v06 integration.

## Actual corrective changes committed

- `lab-reborn-v08-unified-readiness-gate.mjs`: eight fail-closed checks for prospective source lock, verified five-axis evidence per runner, older-history parity, historical grade identity, v04 archive/live parity, v05 independent uplift, nonzero validated v06 scored integration, and prospectively saved unified score. If any are absent, `comparison_as_full_reborn_allowed=false`. Do not use simple `RESEARCH_READY` as proof of completion.
- `lab-reborn-v08-unified-readiness-gate.test.mjs`: 12/12 isolated V8 tests passed (not native Node CI). Includes zero-delta v06, missing rivals, source after off, future runs, and tampered provenance.
- `lab-reborn-v08-locked-to-five-axes.mjs`: actually connects immutable prestart runner packets to the ORIGINAL v03 five-axis scorer. Incorporates only strict independently verified prior-class overlay when reference rows are supplied. NEVER imputes older 5–8, final3f ranks, rivals or normalized clocks. Deliberately does NOT publish/rank as full integrated REBORN.
- Bridge was executed on **20 immutable 2026-10-24 input snapshots** (256 runners): all 20 packets accepted; original v03 produced provisional `RESEARCH_READY` for 19 races and `PARTIAL_HISTORY` for 1 (新潟8R). **Zero of 20 have fully verified five-axis input evidence**.
- Across all 256 runners: peak axis non-null 255, form 254, course_fit 240, race_content 226, rival_strength **0** (no corroborated opponent follow-up packet in frozen input). This is a coverage diagnosis, not a prospective accuracy result.
- For 東京11R: 13 runners could be scored by v03; content evidence for 12 runners, opponent evidence for **0**. Gate correctly blocks full model comparison, despite `v03.status=RESEARCH_READY`.
- Six actual-source bridge checks passed in isolated V8: unchanged on target-result/odds/old-rank pollution, reject posttime lock, reject future past run, reject invalid horse code, never label as publication-ready, no production writes. No native CI.
- Existing old JRA/LOCAL production predictions and old FROZEN, HUB, worker, Cron, payment settings unchanged; only research branch files added. Earlier immutable research rows were not overwritten.

## Immediate work to complete rebuild

1. Build trustworthy, dated as-of **last eight** results and reject missing identities, including JRA 2026 history after September 13. Do not confuse less-than-eight career starts with missing history.
2. Attach verified prior performance content/race grade from exact race identity, preserve true graded rank vs generic OP. Complete prior-class classifier from v07 is *broad tier only*.
3. Supply and verify historical opponent-followup evidence *only strictly earlier than target*, plus trustworthy condition-adjusted pace diagnostics; missing is **unknown**, not negative. Refit/integrate score weights only with genuinely independent period holdout evidence; avoid forcing a v06 bonus merely to produce an uplift.
4. Expose ONE versioned, reproducible new full-model scoring path with whole-field readiness reports, not a patchwork of names.
5. Only when all checks pass, freeze ranked new model prospectively, and compare its podium catches, newly rescued/lost horses and gradings to the unchanged old official FROZEN. Do NOT treat this sample as unseen for post-hoc changes.

**Current decision: REBUILD IN PROGRESS; INTEGRATED REBORN NOT COMPLETE; DO NOT SWITCH PRODUCTION OR ASSERT A NEW-vs-OLD WIN.**
