import {enrichLockedRebornHistory} from "./lab-reborn-v09-eight-run-verified-bridge.mjs";
import {auditFrozenFieldOpponents} from "./lab-reborn-v10-opponent-provenance-bridge.mjs";

/**
 * ONE entrypoint for the currently disconnected JRA REBORN evidence sources:
 * locked prereace runners + 8-start archival identity + pretarget rivals.
 *
 * Does NOT claim original REBORN 0.3/0.4/0.5/0.6 weights have been learned as
 * one scored model. Opponents stay DIAGNOSTIC; no rank/points from them until
 * independent holdout demonstrates incremental predictive value.
 */
export function rebuildRebornEvidencePipeline(lockedPacket,
  {priorArchiveRows=[],priorOpponentRows=[]}={}){
 const fail=(reason)=>({status:"EVIDENCE_PIPELINE_REJECTED",reason,
  full_reborn_ready:false,can_compare_as_full_reborn:false,
  score_or_rank_persisted:false,production_write:false});
 const history=enrichLockedRebornHistory(lockedPacket,priorArchiveRows);
 if(history.status!=="RESEARCH_ENRICHED_SOURCE_DIAGNOSTIC")
  return fail("HISTORY_"+history.reason);
 const opponents=auditFrozenFieldOpponents(lockedPacket,priorOpponentRows);
 if(opponents.status!=="ASOF_OPPONENT_EVIDENCE_AUDIT_NOT_SCORE")
  return fail("OPPONENT_"+opponents.reason);
 if(history.runner_count!==opponents.runner_count||
  history.race_date!==opponents.race_date||
  history.track!==opponents.track||
  +history.race_no!==+opponents.race_no)
    return fail("SOURCE_IDENTITY_MISMATCH");
 const hByNo=new Map(history.runner_status.map(x=>[x.horse_no,x]));
 const joined=opponents.runners.map(r=>{
  const h=hByNo.get(r.horse_no);
  if(!h||h.horse_name!==r.horse_name)
   return null;
  return {
   horse_no:r.horse_no,horse_name:r.horse_name,
   recent_verified:h.verified_recent,
   recent_unconfirmed:h.unverified_recent,
   older_verified:h.older_appended,
   verified_eight:h.strict_eight_verified,
   comparable_opponent_followups:r.accepted_comparable_followups,
   graded_rival_proof:r.proven_graded_followup_rivals,
   unresolved_open_grade_rivals:r.ungraded_open_unknown_rivals
  };
 });
 if(joined.some(x=>x===null))return fail("RUNNER_IDENTITY_MISMATCH");
 return {
  status:"PARTIAL_UNIFIED_EVIDENCE_READY_NOT_SCORED_MODEL",
  target:{race_date:history.race_date,track:history.track,race_no:history.race_no},
  locked_prestart_source:history.frozen_source_saved_at,
  runner_count:joined.length,
  verified_eight_runners:history.strictly_eight_verified_horses,
  older_races_added:history.older_attached_total,
  source_coverage:{
   historical_axes_present:history.axes_present,
   rival_context_runners:opponents.runners_with_any_valid_context,
   verified_graded_rival_runners:opponents.runners_with_graded_proof,
   no_verified_opponent_not_equal_low_ability:true
  },
  readiness_blockers:[
   ...new Set([...history.missing_integration,
    "NO_VALIDATED_OPPONENT_WEIGHT_OR_UNIFIED_OUT_OF_TIME_RANK",
    "NOT_ALL_RUNNERS_HAVE_VERIFIED_LAST_EIGHT"])
  ],
  runners:joined,
  score_or_rank_persisted:false,
  full_reborn_ready:false,can_compare_as_full_reborn:false,
  old_lab_used:false,odds_used:false,target_results_used:false,
  production_write:false
 };
}
