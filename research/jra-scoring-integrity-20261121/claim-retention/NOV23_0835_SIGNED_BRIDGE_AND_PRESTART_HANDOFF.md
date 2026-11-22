# JRA source-to-points integrity handoff — 2026-11-23 08:35 JST

## Objective
Restore trustworthy, repeatable per-horse fact→signed-point→100-point→rank generation. A reviewer claim that a field was checked, or a mathematically consistent submitted factor, must not qualify as source-authenticated scoring. **This is isolated research work, NOT a deployment.**

## Verified work (Draft PR #83)

### 1. Existing V11 signature system wired to deterministic factor scorer
`claim-retention/signed-source-score-bridge.mjs` now:
- Reuses `automation/jra-score-ledger/evidence/contract.mjs` V11 proof; requires signature, issuer binding, gate/lease cutoff, exact context text/hash, selected run identity, original source byte SHA-256, pinned extractor and non-target historical dates.
- Reuses `factor-resolver.mjs` to bind each requested numeric feature to the **same** accepted signed historical slot, rejecting any partial coverage, duplicate slot or missing factor.
- Converts only verified fields into `source-to-points-scorer.candidate.mjs`, and compares its independently generated points/rank to every submitted review with `compareGeneratedResearchScores` when a payload is supplied.
- Uses no caller-submitted `selectedRuns`/boolean source-verification flags. In `submission-audit.mjs`, the old fallback based on hand-asserted `scorerSelectedRuns` has been replaced by mandatory server-only `signedSourcePacket` + `signedSourceTrust`; missing source responds `SIGNED_V11_PROVIDER_UNAVAILABLE`.
- Supports only `margin`, `corners`, `last3f`, `distance`, `rest` and `course` where each required observation is signed. `class`, `going`, `pace`, `opponent`, `race_shape`, `eval` are *not* elevated without a signed extractor and approved factor rule. Empty or partial factual evidence is not auto-filled.
- All success outputs explicitly declare `production_allowed=false`, `official_score_approved=false`, `actual_official_original_authenticated=false`, `formal_scoring_allowed=false`. **A synthetic Ed25519 signer is not an actual JRA issuer**.

`tests/jra-signed-source-score-bridge.test.mjs` covers source→points with Ed25519 synthetic fixture, signed data manipulation, original bytes tampering, unsupported factors, missing corners, spoofed caller proof flags, per-factor point/rank/score/provenance mismatches, and independent audit refusing source-unbound self-assertions. CI Node and isolated PG success: [GitHub Actions 45083813327](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45083813327).

### 2. Today’s complete *pre-start* feature inventory fixed immutably
Read-only `public.jra_live_base_candidate_v1` reference captured 08:10 JST for 23 flat races, 345 entrants: 20 ranked races/302 horses and 3 unsupported segment races/43 horses. JRA obstacle Fukushima 4R is deliberately excluded.

Read-only `private.jra_optional_content_evidence_v3` before first start:
| Track | Capture JST | Flat races | Horses | Historical runs | Last3f present | Live corners present | Archive details available |
| -- | -- | --: | --: | --: | --: | --: | --: |
| Fukushima | 08:33:39 | 11 | 173 | 556 | 548 | 546 | 336 |
| Tokyo | 08:34:02 | 12 | 172 | 439 | 435 | 433 | 227 |
| **Total** | before first post | **23** | **345** | **995** | **983** | **979** | **563** |

Immutable observations:
- `observations/jra-20261123-basecore-prerace-readonly.json`
- `observations/jra-20261123-fukushima-all-histories-prerace-readonly.json`
- `observations/jra-20261123-tokyo-all-histories-prerace-readonly.json`
- Earlier per-race `observations/jra-20261123-r1-history-prestart-readonly.json`

The 995 selected history features contain **0 of 995** complete `run_id + original_sha256 + source_ref` source-binding triples. The counts above describe **input availability, not authenticated original bytes or signed source authorization**. Do not upgrade detail_available into issuer proof. Subsequent changes to live runners or archive records must not silently mutate this 08:34 observation.

`tests/jra-full-prestart-evidence-snapshot.test.mjs` pins exact Git content blobs and verifies date cutoff, identity, roster and count. The whole CI succeeded in Node/PG: [GitHub Actions 45084001451](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45084001451).

### 3. Live workflow status (read-only)
At 08:35:21 JST, `jra_queue_status` indicated `official_field_ready=23`, `ready_to_claim_now=1`, `jobs=0`, `claimed=0`, `frozen=0`. Fukushima 1R scheduled 09:45 JST; Tokyo 1R 10:00 JST. Normal guarded claimant window is 70 to 3 minutes before post. **A READY race is not a successful CLAIM or saved prediction.** This research batch did not invoke the write-capable claimant or alter existing FROZEN.

## Required remaining conditions before promotion

1. **Actual official original-body reader**: immutable original bytes signed by a properly authorized issuer with pinned HTML extractor, claimed context+lease+horse/run identity, and JRA retention controls. None is connected. Test-only Ed25519 signatures are deliberately not production.
2. **Operator-approved real fact→point weighting** for the complete JRA100 model including lap, pace, opponent follow-on, class, going, and result-independent constraints. Historical manual 11/15/16 judgments cannot be recreated from final scores alone. No guessed, fitted, or synthetic points adopted.
3. **True full-field contract**: 100-point scoring, TOP5/EYE 17-item audit, Eval and score changes bound to the same official pre-start snapshot, with outcome-blinded time-split comparisons.
4. **Promotion**: separate explicit user approval, security and role review, test of current v42 runtime, rollback plan. PR #83 remains Draft/unmerged. No changes to production Supabase/MCP/FROZEN, paid API, Cron or JRA active claims.

**Release: BLOCKED. Research signed-fact-to-point proof and prestart audit available; actual live model not restored.**
