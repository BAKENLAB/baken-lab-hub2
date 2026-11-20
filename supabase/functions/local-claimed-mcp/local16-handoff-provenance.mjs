/**
 * Source-to-FROZEN handoff diagnostic for the original LOCAL1.6.
 * PURE, read-only, advisory ONLY: never recalculates scores, changes rank,
 * selects EYE, authorizes a save, or promotes research evidence.
 *
 * An official pre-CLAIM source captured before a race does not imply that
 * a human/model applied it to 100-point scoring. Distinguish proof of
 * availability from proof of numerical effect; the latter is unavailable.
 */
const validCount=x=>Number.isInteger(x)&&x>=0&&x<=100000?x:null;
export function auditLocal16HandoffProvenance({context,draft}={}){
 const base={policy:"LOCAL16_SOURCE_HANDOFF_AUDIT_V1",review_required:false,
  source_corner_count:0,saved_corner_count:null,
  followup_source_count:0,criterion_status:"UNAVAILABLE",
  criterion_trace_status:"NOT_PROVIDED",numeric_score_certified:false,
  evidence_used_for_rank_certified:false,automatic_rank_effect:false,
  rank_changed:false,eye_changed:false,frozen_modified:false,
  save_authorized:false,market_used:false,target_result_used:false};
 if(context?.field_integrity_checked!==true||!Array.isArray(context?.runners))
  return {...base,status:"CONTEXT_UNVERIFIED",review_required:true};
 const source=Array.isArray(context?.official_corner_shadow?.verified_corner_sources)?
  context.official_corner_shadow.verified_corner_sources:[];
 const documented=validCount(draft?.audit?.official_past_content_audit?.verified_corner_runs);
 const follow=validCount(context?.official_opponent_followup?.followup_count)??0;
 const trace=draft?.audit?.local16_scoring_trace;
 const extra={source_corner_count:source.length,saved_corner_count:documented,
  followup_source_count:follow,
  criterion_status:context?.local16_scoring_criteria?.status??"UNAVAILABLE",
  criterion_trace_status:trace===undefined?"NOT_PROVIDED":"PRESENT_UNCERTIFIED"};
 if(source.length>0&&(documented===null||documented===0))
  return {...base,...extra,status:"SOURCE_PRESENT_AUDIT_NOT_RECORDED",
   review_required:true};
 if(source.length>0)
  return {...base,...extra,status:"SOURCE_RECORDED_EFFECT_UNCERTIFIED"};
 if(documented!==null&&documented>0)
  return {...base,...extra,status:"AUDIT_SOURCE_NOT_RECONFIRMED",review_required:true};
 return {...base,...extra,status:"NO_PRECLAIM_CORNER_EVIDENCE_IN_CONTEXT"};
}
