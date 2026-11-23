# 2026-11-23 research-only validation: archived history identity and current source inventory

## Scope and non-deployment contract

Repository: `BAKENLAB/baken-lab-hub2`, Draft PR #83, branch `fix/jra-scoring-integrity-gate-20261121`.
This document records isolated research changes and **read-only** metadata/count inspections of production Supabase `qjlvsndiqjfsfjinilig`. No production DDL/DML, new CLAIM, prediction save, FROZEN edit, MCP deployment, Cron activation, credential use, or scoring-weight change was performed. Do not merge PR #83 on the basis of this report.

## New finding and research candidate correction

In `claim-retention/acquisition.mjs`, matching only the lengths of `parsedRefs` and `readPersistedRuns` was not sufficient. When persisted rows were `[Alpha, Beta]` and parsed references `[Alpha, Alpha]`, both references matched the same Alpha row, while Beta was ignored. This falsely suggested full archived field coverage. The isolated candidate now requires:
- exactly one persisted match per parsed horse, as before;
- a present persisted `run_id` and `horse_id`;
- a one-to-one, unique persisted `run_id` across the parsed field;
- coverage of every persisted row before retaining the historical document.

A negative regression test in `claim-retention/connection.test.mjs` demonstrates that repeated Alpha, reused run UUID and missing run UUID are refused **before retention**, and that legitimate Alpha/Beta passes. This is a **research-only provenance attribution hardening**, not authentic official evidence attestation and not a live deployed change.

Isolated CI for the code and tests at commit `99a534303022e49d8f508b1064c8689adf4c8596`: [GitHub Actions run 45074191473](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45074191473), completed SUCCESS for `isolated-ledger` and `isolated-postgres`. Tests are fixture-driven; no live provider-to-signed-receipt E2E is established.

## Production read-only inventory (2026-11-23 JST)

The following findings came only from `SELECT` against system catalog/information schema and scoped counts. Do not infer the absence of an external or differently named archive.

| Observed source | Result | What it does NOT establish |
| --- | ---: | --- |
| `public.jra_html_evidence`, fetched since 2026-11-21 | 510 records | The table stores `html_sha256` and `html_bytes` (integer length), **not original HTML bytes** or an issuer signature |
| `public.jra_live_diagnosis_snapshots`, race date >= 2026-11-14 | 0 rows | No recoverable full source-to-points inputs in that inspected table/date range |
| `private.jra_base_history_features_v1` | 204069 rows | Features alone cannot reconstruct the submitted 100-point formula |
| `private.jra_base_history_features_v1`, `affects_score IS TRUE` | 0 rows | Flag not evidence of official score use; does not prove other pipelines did not consume features |
| `private.jra_model_transition_snapshots`, race date >= 2026-11-14 | 0 rows | No recent transition input snapshots in that inspected table |

The `private` schema objects matching JRA archive/evidence/history/snapshot names inspected here did not expose raw original-body or signed-receipt columns. This is a limited inventory, not a claim that no storage system exists elsewhere.

## Remaining live blockers — unchanged

1. **Original-byte / trust chain:** source capture must be authorized and bounded, original bytes retained under an approved private store, pinned parser verified under identical acquisition conditions, exact selected history snapshot/horse/run/version resolved by the existing authenticated CLAIM, and receipt signed by a managed BAKEN broker key. That BAKEN receipt is not a JRA-issued signature. Authentic signed history provider packets verified: **0**.
2. **Fact-to-100 scoring:** current formal base-score and per-factor judgment generation formula and its original submitted inputs remain unrecovered. The existing deterministic bridge checks arithmetic and limited effects but does not regenerate submitted scores from raw official facts. Existing alternative aggregation research is **not approved**, and no rank or TOP5 claim should be made from it.
3. **Operational approvals:** private roles, retention/deletion/access logging, broker, key storage and exposed JOB_KEY rotation require separate owner approval. No live activation, security policy relaxation, or fallback past official CLAIM gates is permitted.

Production connection decision: **NO**. Draft PR retained. Subsequent work should first use this isolated CI as the regression baseline, then obtain approved secure future capture/provider and explicit fact-to-score contract before controlled staging E2E and any separate deployment approval.
