/**
 * BAKEN LAB LOCAL live rank INPUT for the official PRE-RACE decision.
 * It runs before any 1.6 FROZEN save against an authenticated COMPACT_V1
 * CLAIM context, not after a race or from result/market data.
 *
 * This produces an actionable all-field 100-point challenger and its evidence;
 * the official predictor must decide class, pace, grades, EYE and final ranking.
 * It does NOT rewrite an existing FROZEN, CLAIM a job, save, bypass gates,
 * or replace the separately guarded production 1.6 save protocol.
 */
import {buildLocalV17IndependentShadow} from './local-v17-full-field-independent-shadow.mjs';
const empty=(reason)=>({
 status:'FALLBACK_TO_LOCAL_1_6',reason,
 live_rank_input_used:false, save_authorized:false,
 rank_or_score_written:false,frozen_modified:false,
 market_used:false,target_result_used:false
});
const norm=x=>typeof x==='string'?x.normalize('NFKC').replace(/\s+/g,'').trim():'';
export function buildLocalLiveAbilityInput(context,observedAt){
 if(!context||context.context_format!=='COMPACT_V1'||
    context.protocol?.protocol_key!=='LOCAL_MAIN'||
    context.protocol?.enforced_server_side!==true||
    context.field_integrity_checked!==true||
    context.stage!=='AWAITING_FULL_DEPTH_COMPARISON'||
    context.race?.circuit!=='LOCAL'||
    !Array.isArray(context.runners)||context.runners.length<6||
    context.runners.length>20||!Array.isArray(context.relative_condition_evidence?.runner_evidence)||
    context.relative_condition_status!=='READY')
  return empty('OFFICIAL_LIVE_FULL_FIELD_CONTEXT_UNVERIFIED');
 const regular=context.relative_condition_evidence;
 const enriched=context.official_corner_shadow;
 // Officially linked pre-CLAIM corners, if present, take precedence only after
 // a separate full-field scorer independently verifies EACH actual witness.
 const considerEnriched=enriched?.status==='DESCRIPTIVE_SHADOW_ONLY'&&
    enriched?.use_for_rank===false&&
    enriched?.use_for_save_gate===false&&
    enriched?.research_relative_condition_evidence?.status==='READY'&&
    enriched?.research_relative_condition_evidence?.runner_count===context.runners.length&&
    enriched?.research_relative_condition_evidence?.market_used===false&&
    enriched?.research_relative_condition_evidence?.target_result_used===false;
 const comparisons=considerEnriched?
    [enriched.research_relative_condition_evidence,regular]:[regular];
 let scored=null,usedEnriched=false;
 for(const comp of comparisons){
  const result=buildLocalV17IndependentShadow({
   race:{circuit:'LOCAL',race_date:context.race.race_date,
    track:context.race.track,race_no:context.race.race_no,
    race_name:context.race.race_name,
    class_name:context.race.conditions?.class_name,
    surface:context.race.conditions?.surface,
    distance:context.race.conditions?.distance,
    observation_at:observedAt,post_time:context.race.post_time},
   comparison:comp
  });
  if(result.status==='READY_FOR_PROSPECTIVE_PAIRED_TEST' &&
     result.top5_boundary_score_tie!==true &&
     result.market_used===false &&result.target_result_used===false &&
     result.frozen_modified===false){
   scored=result;
   usedEnriched=comp!==regular;
   break;
  }
 }
 if(!scored)return empty('ALL_RUNNER_SCORER_NOT_VERIFIED_OR_TOP5_BOUNDARY_TIED');
 const expected=new Map();
 for(const runner of context.runners){
  const no=runner?.horse_no,name=norm(runner?.horse_name);
  if(!Number.isInteger(no)||no<1||no>24||!name||expected.has(no))
    return empty('ACTIVE_HORSE_IDENTITY_NOT_UNIQUE');
  expected.set(no,name);
 }
 if(scored.runners.length!==expected.size||
   scored.all_runners_checked!==expected.size||
   scored.runners.some(x=>expected.get(x.horse_no)!==norm(x.horse_name))||
   scored.top5.length!==5||
   scored.top5.some((no,i)=>no!==scored.runners[i].horse_no))
   return empty('INDEPENDENT_FULL_FIELD_IDENTITY_MISMATCH');
 const auditByNo=new Map(scored.ability_evidence_audit.map(x=>[x.horse_no,x]));
 const all=scored.runners.map(r=>{
  const proof=auditByNo.get(r.horse_no);
  if(!proof)return null;
  const prior=Array.isArray(proof.runs)?proof.runs:[];
  const sameDistance=prior.filter(x=>x.track===context.race.track&&
    x.distance===context.race.conditions?.distance&&
    x.surface===context.race.conditions?.surface&&
    x.finish<=3&&x.age_days<=180);
  const best=prior.slice().sort((x,y)=>y.score_signal-x.score_signal||
    x.age_days-y.age_days).slice(0,3);
  return {horse_no:r.horse_no,horse_name:r.horse_name,
   independent_rank:r.rank,independent_score_100:r.score,
   verified_runs:prior.length,
   same_venue_exact_distance_recent_podium_refs:sameDistance.map(x=>x.evidence_ref),
   current_condition_podium_count:sameDistance.length,
   strongest_verified_run_proofs:best.map(x=>({
    evidence_ref:x.evidence_ref,history_date:x.history_date,
    track:x.track,distance:x.distance,finish:x.finish,
    class_equivalence_unverified:x.class_equivalence_unverified,
    contextual_score_signal:x.score_signal,
    official_corner_source:x.certified_official_corner_source,
    official_corner_score_bonus:x.corner_position_bonus
   })),
   uncertainty:proof.gaps!=='NONE'?proof.gaps:
    proof.other_condition_runs>0?'OTHER_CONDITION_EQUIVALENCE_NOT_PROVEN':
    'OPPONENT_STRENGTH_AND_PACE_REQUIRE_FULL_REVIEW'};
 });
 if(all.some(x=>x===null))return empty('SCORE_EVIDENCE_NOT_ALL_RUNNERS');
 return {
  status:'READY_FOR_OFFICIAL_RANK_DECISION',
  effective_mode:'LOCAL_1_6_WITH_LIVE_FULL_FIELD_EVIDENCE_20261114',
  live_rank_input_used:true,
  independently_scored_order:scored.runners.map(x=>x.horse_no),
  independently_scored_top5:[...scored.top5],
  full_field_100point_rank_candidate:all,
  official_corner_verified_run_count:scored.official_corner_witness_count,
  official_corner_used:usedEnriched,
  source_scope:usedEnriched?'CERTIFIED_PRECLAIM_CORNERS_AND_CLAIM_HISTORY':
   'OFFICIAL_CLAIM_HISTORY_ONLY',
  action:'USE_AS_RANKING_EVIDENCE_BEFORE_NEW_1_6_FREEZE',
  rank_decision_rule:'COMPARE_ALL_RUNNERS_NOT_JUST_RANK5_6; PROMOTE_OR_DEMOTE_ONLY_WITH_VERIFIABLE_RACE_SPECIFIC_PROOF; KEEP_CLASS_PACE_AND_EYE_INDEPENDENT',
  baseline_score_calibration:'INDEPENDENT_RESEARCH_SCORE_NOT_1_6_PROBABILITY',
  save_authorized:false,rank_or_score_written:false,
  frozen_modified:false,market_used:false,target_result_used:false
 };
}
