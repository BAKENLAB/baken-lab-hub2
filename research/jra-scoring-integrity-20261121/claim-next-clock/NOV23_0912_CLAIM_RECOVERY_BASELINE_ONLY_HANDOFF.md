# JRA 2026-11-23 09:12–09:19 JST — claim intake regression and guarded research fallback

**Production integrity: existing FROZEN untouched; no direct DB writes; no Cron restart; no deployment/merge of PR #83; no non-evidence-based scores invented.**

## Real first-call bug reproduced and safe workaround completed

- 09:12:44 JST: official JRA queue status `ready_to_claim_now=3`, `jobs=0`, `claimed=0`, `frozen=0`.
- Authorized first `jra_queue_claim_next` returned `claimed=false` / `NO_READY_UNSAVED_JRA_RACE_IN_3_TO_70_MIN_WINDOW`, while it **inserted 3 QUEUED jobs** (Fukushima R1, Tokyo R1, Fukushima R2) through guarded `jra_manual_claim_next_v1`.
- READ ONLY inspection of its definition and real `jra_prediction_jobs` defaults confirmed `next_attempt_at DEFAULT clock_timestamp()`. The stored function captures `v_now` **BEFORE** the `INSERT`, then selects with `j.next_attempt_at <= v_now`. Newly inserted rows have later defaults and cannot meet that condition until a **new call**.
- After verifying queued row identities, post times, statuses, attempt counts, and that `next_attempt_at` had passed, a second **authorized MCP claim** succeeded, first Fukushima R1:
  `job_id=9de7245c-cab8-466b-9df2-468eb085f5a5`, lease to 2026-11-23 09:28:24 JST. This was not a replay of a safety-refused payload: conditions had changed and the concrete timestamp cause had been verified.
- The JRA claimed context provides actual 16 ACTIVE horses, 32 previous runs, verified official race field, 1942 Eval relations and a full-field ranking. No market or target results used.
- Authorized `jra_relative_rank_preview` retained full BASE_CORE order and 5/12/13/10/3 TOP5. Authorized `jra_seal_relative_rank_pair` successfully sealed one separate immutable **pre-race SHADOW comparison**, receipt SHA-256
  `594645cc3288e106bf7bf3c0f008f36e86a7c65d195801ffb2927da36045a2e1`. **No official FROZEN was saved.**
- The existing v42 `inspectJraFullDepthSave` requires `evidence_effects` and at least one nonzero effect for every horse with any prior run, plus detailed source refs, exact score arithmetic, per-horse reviews and Eval inputs. The current active JRA0.4 protocol, however, explicitly allows a `CONTINUE_BASE_CORE_NO_PENALTY` fallback when optional evidence is missing. This is a real contract mismatch between optional source policy and hard fail-closed gate, NOT an authorization to bypass the gate.
- Score effects have **no operator-approved fixed per-factor numeric formula**, and the current source context may use `CLAIMED_CONTEXT_RUN` surrogate source identities without authentic past-run body SHA. No fabricated numerical factor points were submitted to the official save RPC. **Today's FROZEN remains unconfirmed/0 as of the latest check.**

## Exact contained first-call timestamp patch, no live deploy

- `production-function-readonly.sql`: copied actual production `public.jra_manual_claim_next_v1()` before edit.
- `claim-next-clock-refreshed.candidate.sql`: the **only** functional change is `v_now := clock_timestamp();` immediately after inserting QUEUED jobs and before the selection. It does not change lease, status, readiness, time window, data/runner, obstacles, WIN5, prediction uniqueness, or original FROZEN safety checks.
- `claim-next-clock-isolated.test.sql`: creates an isolated PostgreSQL 17 DB, installs the *real candidate function* with the minimal table schema and guards; requires first-call claim success (not only second-call), active lease, guarded repeat resume, and refusal for obstacle, out-of-window, previously predicted and no-runner races. `ROLLBACK` ensures fixture data is discarded.
- Isolated Node and PostgreSQL CI success: [run #45087730529](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45087730529).

## Separate BASE_CORE-only honest preview, no FROZEN bypass

- `claim-retention/baseline-only-separate-path.candidate.mjs` demonstrates a **separate proposed** baseline-only mode consistent with the *qualitative* active protocol: same authorized field/candidate identity, official pre-post cutoff, all ACTIVE ranked, exact one-to-one baseline ranks. Emits observed `round(30+38*base_rate)` as a historical **display baseline only**, not a certified full 100-point score. Its payload explicitly sets final full score/rank and EYE review as unverified and always `production_release_allowed=false`, `official_save_allowed=false`. No changes to existing strict v42 full-depth guard.
- `tests/jra-baseline-only-separate-path.test.mjs` uses actual captured 2026-11-23 23-race source data to differentiate 20 supported races/302 horses and 3 unsupported races/43 horses, guarantees retrieval-order invariance, refuses altered/missing candidate IDs, duplicate ranks, bad base rates, out-of-time inputs and changed protocol. Isolated Node/PG CI success: [run #45087900569](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45087900569).
- **Do not release this alternate mode as a silent downgrade**. It requires explicit operator policy/security review and isolated model-status UI disclosure. The user's expectation is actual content-informed full 100-point predictions; baseline-only is not a substitute.

## Next operational and engineering steps

1. Preserve current valid CLAIM and pre-race comparison without re-claiming blindly or overwriting FROZEN. If valid claim expires, only re-claim after official guard verifies eligibility and cutoff; never use expired credentials.
2. Resolve the production timestamp bug through an authorized reviewed deployment, not a direct DB rewrite. Research candidate remains non-deployed.
3. Define/approve formal per-factor scoring rule and connect verified original past-run identities with trusted issuer and exact claim binding before ever asserting the full-depth result is reproducible.
4. If a separately approved baseline-only FROZEN mode is desired, design **a new guarded official route** with a clear degraded-mode label, not a bypass or relaxation of the v42 full-depth guard.
5. Outcome reporting must distinguish `JRA_QUEUE_CLAIMED`, `SHADOW_RANK_PAIR_SEALED` and `OFFICIAL_FROZEN_SAVED`. Only the first two occurred in this batch.

**Production 100-point live scorer: NOT RESTORED. Research claim timestamp regression: ROOT CAUSE IDENTIFIED, isolated patch CI passed.**
