# JRA turf EYE additional audit — 2026-11-15

## Scope
Optional, read-only evidence assistance. No automatic EYE selection, rank/grade/TOP5 change, model calls, DB writes, protocol migration or save-guard changes. Dirt stays unchanged. Current production MCP v22 was exported before patching; PRs #46 and #48 were checked to avoid reverting their rank/evidence work.

`automation/jra-eye-additional-audit.mjs` reviews all officially ACTIVE horses against the current four-history CLAIM contract. Short turf computes dense early-position rank across the whole eligible field before excluding final TOP5. Long turf adds same-or-longer-distance good-run evidence while preserving the current EYE first. Missing pace, draw, course, incident and causal evidence is not inferred. Winning margins are only accepted when numeric; no invented conversion of Japanese margin units.

Without an explicit whole-field draft rank the packet supplies features only, with no outside-TOP5 candidate list. The existing read-only `jra_relative_rank_preview` can supply that explicit draft. BASE_CORE ranks are not assumed to be final TOP5.

Formal selection still requires individual review of ALL outside-TOP5 horses, two independent current positive factors, negative conditions, comparison with existing EYE, at most one selection or null. Neither a qualifying race nor the candidate filter authorizes selection or saving. Overlapping evidence must not be counted twice. The helper does not assert that these qualitative audits were performed.

## Tests actually run
- New extraction tests: 24 PASS / 0 FAIL.
- Optional hook/invariance tests: 5 PASS / 0 FAIL.
- Existing JRA draft-adapter tests: 5 PASS / 0 FAIL.
- Existing verified-evidence rank bridge tests: 6 PASS / 0 FAIL.
- Total: 40 PASS / 0 FAIL. No paid APIs used.

The integration test requires a local export of the matching production `index.ts` in `rollback/index.ts` and a patched `candidate-index.ts`. These deployment exports are intentionally not published, because the Edge bundle includes private course research data. `production-v22.patch` is the complete public Edge change. Removing its import and two optional hooks restored the exported production source byte-for-byte, including save/auth/tool schemas. Optional failure returns UNAVAILABLE without throwing into prediction processing. There are zero added RPC/model calls.

## Historical comparison and limits
236 FROZEN predictions in 2026-10-17..2026-11-14 matched official results. Only 20 immutable Oct24 input snapshots were found. Five were captured after the corresponding FROZEN and were excluded. Fifteen remained: nine turf and six dirt. The other 221 inputs cannot be safely recreated from latest mutable history. Even these 15 are archived available inputs, not proof of byte-identical claimed context. Archived horse IDs and exact race/number/name were checked, but FROZEN lacks full archived horse-ID binding.

Raw extraction replacement: three newly captured winners in the small short-turf subset (Kyoto10 #2, Niigata12 #8, Tokyo9 #11, Oct24). Fill-null-only: one new winner. No existing good horse was lost in this subset; however the nine turf races contained zero current-EYE top-three finishes, so this does NOT establish protection of historical turf successes. Six dirt selections and all rank/TOP5 data stayed unchanged. Per-horse loss and per-race hit preservation are separately reported in comparison-results.json.

All changed-candidate rates are explicitly UNADUDITED candidate comparisons, NOT formal EYE performance. Candidate extraction used archived pre-FROZEN histories; target results were joined only afterwards for scoring. Original research rates and the complete 38-race experiment could not be independently reproduced. The formal two-factor/candidate comparison audits cannot be retroactively invented. Independent future validation is outstanding.

## Production gate
Automatic EYE replacement/adoption: NO. Optional audit evidence only: eligible after code tests and source/version comparison. The existing formal evaluation and save gates remain authoritative. No retrospective FROZEN edits are permitted.

Before deployment reread the Edge version/hash and abort on concurrent changes. Upload all current files unchanged except index.ts plus the new helper; preserve verify_jwt and all authorization. Rollback by redeploying the locally exported original bundle. Do not roll back unrelated later deployments. Read back deployed source/version and use an already live authorized CLAIM for read-only smoke validation; never create a CLAIM or prediction just for this check.

## Reproduction
`node research/jra-eye-turf-audit-20261115/additional-audit.test.mjs`

`node research/jra-eye-turf-audit-20261115/integration.test.mjs` (requires matching local production export as above).

`compare.mjs` requires the private read-only comparison-input.json export and writes comparison-results.json. The private export is not committed. Results cannot reconstruct missing historical inputs or serve as forward validation.

## Actual deployment result
The optional evidence-only patch was deployed as `jra-claimed-mcp` v23 at 2026-11-15 09:27:30 JST after confirming the v22 bundle was unchanged. All nine read-back files matched the submitted bundle exactly. Authentication, save guards and prior files were preserved. See deployment-record.json. Automatic EYE selection remains disabled.

The available CLAIM expired at 09:27:21 JST before the smoke read; the MCP returned CONTEXT_UNAVAILABLE. A subsequent SELECT found no valid JRA_QUEUE_RESCUE CLAIM. Thus successful live CLAIM/preview execution is UNVERIFIED. No CLAIM was created and no prediction was saved for testing. This is not a completed end-to-end evaluation or demonstrated precision gain. The next normally authorized live CLAIM must verify the optional packet and qualitative audit before describing the operational flow as fully verified.
