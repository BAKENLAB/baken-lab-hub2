/**
 * BAKEN LAB LOCAL1.6 method instruction carried by EVERY verified live CLAIM context.
 * Static protocol reference only. Never scores, saves or claims jobs.
 */
export const LOCAL16_METHOD_CONTRACT=Object.freeze({
 version:"LOCAL16_20261116_PRE_RANK_METHOD_V1",
 historical_reference:"research/local16-20261116-frozen-anchors.json",
 documentation:"docs/BAKEN_LAB_LOCAL16_20261116_METHOD.md",
 evidence_source:"PRE_RACE_OFFICIAL_VERIFIED_ONLY",
 stages:Object.freeze([
   "Verify valid official READY, live authorized CLAIM, unsaved prediction and before post time",
   "Review all ACTIVE horses independently against officially verified prior-run refs and missingness",
   "BEFORE assigning scores and TOP5, compare same historical races between the current field: order, measurable timing differences, prior class/track/going/pace; include counterevidence",
   "If no verifiable direct encounter exists for a horse, record absence instead of inventing a head-to-head result",
   "Only then perform original LOCAL1.6 independent 0-100 score and contiguous rank for every horse, document evidence and challenger comparisons; do not invent a new fixed rubric",
   "Audit rank5 vs rank6, honmei challengers, then all TOP5 outsiders for original 17-item EYE and two current independent positive categories",
   "Use live read-only rank preflight to verify source-linked decision trace where available. A verified source alone does not prove it changed a score",
   "Save only via existing protected MCP/RPC before start and verify official FROZEN receipt. Never retroactively replace original rankings"
 ]),
 prospective_trace_field:"payload.audit.local16_full_field_pairwise_trace",
 preflight_field:"full_field_pairwise_proof",
 trace_validation:"Each linked rank rationale must identify two entrants, one official prior race, both source refs, and whether that evidence supports or challenges saved order",
 score_math_certified:false,
 auto_score_effect:false,
 auto_rank_effect:false,
 market_used:false,
 target_result_used:false,
 original_frozen_modified:false,
 status:"PROSPECTIVE_RESEARCH_NOT_A_PRODUCTION_SCORER"
});
