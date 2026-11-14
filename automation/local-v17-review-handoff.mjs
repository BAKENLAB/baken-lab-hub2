/**
 * LOCAL 1.7 pre-FROZEN candidate handoff, research only.
 * Scores and ranks are independently derived from verified historical evidence.
 * Baseline ranks are considered only AFTER the scorer has finished.
 * No HTTP/DB, no saves or changes to existing FROZEN.
 */
import {buildLocalV17IndependentShadow} from './local-v17-full-field-independent-shadow.mjs';
import {selectVerifiedLocalResearchComparison} from './optional-atomic-shadow-save.mjs';

const norm=x=>typeof x==='string'?x.normalize('NFKC').replace(/\s+/g,'').trim():'';
const number=x=>Number.isInteger(x)&&x>=1&&x<=24;
const safeRow=(r,kind)=>r&&typeof r==='object'&&!Array.isArray(r)&&
  Object.keys(r).every(k=>kind==='roster'?['horse_no','horse_name','status'].includes(k):
   ['horse_no','horse_name','rank'].includes(k))&&
  number(r.horse_no)&&norm(r.horse_name)&&
  (kind==='roster'?r.status==='ACTIVE':Number.isInteger(r.rank));
const refuse=(reason,details={})=>({
 status:'ABSTAINED',reason,release_status:'RESEARCH_NOT_DEPLOYED',
 requires_manual_review:true,save_authorized:false,production_rank_effect:false,
 production_score_effect:false,frozen_modified:false,market_used:false,
 target_result_used:false,...details
});
/** Accept the entire officially verified active field and the complete baseline. */
export function buildLocalV17ReviewHandoff({race,comparison,activeRunners,baseline}={}){
 if(!Array.isArray(activeRunners)||!Array.isArray(baseline)||
    activeRunners.length<6||activeRunners.length>20||
    activeRunners.length!==baseline.length||
    !activeRunners.every(r=>safeRow(r,'roster'))||
    !baseline.every(r=>safeRow(r,'baseline')))
  return refuse('OFFICIAL_FULL_FIELD_OR_BASELINE_MISSING');
 const roster=new Map(activeRunners.map(r=>[r.horse_no,norm(r.horse_name)]));
 const oldOrder=baseline.slice().sort((a,b)=>a.rank-b.rank);
 if(roster.size!==activeRunners.length||
    new Set(baseline.map(r=>r.horse_no)).size!==baseline.length||
    new Set(baseline.map(r=>r.rank)).size!==baseline.length||
    oldOrder.some((r,i)=>r.rank!==i+1||roster.get(r.horse_no)!==norm(r.horse_name)))
  return refuse('OFFICIAL_IDENTITY_OR_BASELINE_RANK_MISMATCH');
 // No baseline is given to the independent 100-point scoring engine.
 const scored=buildLocalV17IndependentShadow({race,comparison});
 if(scored.status!=='READY_FOR_PROSPECTIVE_PAIRED_TEST')
  return refuse('INDEPENDENT_FULL_FIELD_SCORING_NOT_VERIFIED',
   {scorer_reason:scored.reason??scored.status});
 if(scored.top5_boundary_score_tie===true)
  return refuse('TOP5_BOUNDARY_ABILITY_TIE');
 const ranked=scored.runners,audits=scored.ability_evidence_audit;
 if(!Array.isArray(ranked)||!Array.isArray(audits)||
    ranked.length!==roster.size||audits.length!==roster.size||
    scored.all_runners_checked!==roster.size||
    new Set(ranked.map(r=>r.horse_no)).size!==roster.size||
    new Set(audits.map(r=>r.horse_no)).size!==roster.size||
    !ranked.every((r,i)=>r.rank===i+1&&number(r.horse_no)&&
      roster.get(r.horse_no)===norm(r.horse_name)&&
      Number.isInteger(r.score)&&r.score>=0&&r.score<=100&&
      audits.some(a=>a.horse_no===r.horse_no&&norm(a.horse_name)===norm(r.horse_name)))||
    !Array.isArray(scored.top5)||scored.top5.length!==5||
    scored.top5.some((x,i)=>x!==ranked[i].horse_no)||
    scored.market_used!==false||scored.target_result_used!==false||
    scored.production_rank_effect!==false||scored.frozen_modified!==false)
  return refuse('SCORED_FIELD_OR_SOURCE_INTEGRITY_FAILURE');
 const before=oldOrder.map(x=>x.horse_no),after=ranked.map(x=>x.horse_no);
 const oldPositions=new Map(before.map((no,i)=>[no,i+1]));
 const oldTop=new Set(before.slice(0,5)),newTop=new Set(after.slice(0,5));
 const auditByNo=new Map(audits.map(a=>[a.horse_no,a]));
 const scoreRows=ranked.map(r=>{
  const a=auditByNo.get(r.horse_no);
  const runProof=Array.isArray(a.runs)?a.runs:[];
  const verifiedCorners=runProof.filter(x=>
   x.corner_verification_status==='EXACT_VERIFIED_PRECLAIM_OFFICIAL_PAST_RESULT');
  const best=runProof.filter(x=>x.score_signal>0)
   .sort((x,y)=>y.score_signal-x.score_signal||x.age_days-y.age_days)
   .slice(0,2);
  return {
   horse_no:r.horse_no,horse_name:r.horse_name,
   independent_rank:r.rank,independent_score_100:r.score,
   baseline_rank:oldPositions.get(r.horse_no),
   score_basis:'INDEPENDENT_FULL_FIELD_OFFICIAL_HISTORY',
   evidence_runs_checked:a.evidence_runs_checked,
   positive_performance_runs:runProof.filter(x=>x.contextual_bonus_applied===true).length,
   comparable_class_positive_runs:runProof.filter(x=>
    x.contextual_bonus_applied===true&&x.context_band==='SAME_OFFICIAL_CLASS').length,
   // Same course/distance proof is explicitly visible rather than hidden
   // in a generic 100-point total. It is NOT automatic ability promotion:
   // special selections, class differences, opponent quality and pace remain
   // questions for manual full-field review.
   exact_course_distance_podium_runs:runProof.filter(x=>
    x.finish<=3&&x.age_days<=365&&x.track===race.track&&
    x.distance===race.distance&&x.surface===race.surface).length,
   recent_exact_course_distance_podium_runs:runProof.filter(x=>
    x.finish<=3&&x.age_days<=180&&x.track===race.track&&
    x.distance===race.distance&&x.surface===race.surface).length,
   recent_exact_course_distance_win_runs:runProof.filter(x=>
    x.finish===1&&x.age_days<=180&&x.track===race.track&&
    x.distance===race.distance&&x.surface===race.surface).length,
   exact_course_distance_podium_evidence_refs:runProof.filter(x=>
    x.finish<=3&&x.age_days<=365&&x.track===race.track&&
    x.distance===race.distance&&x.surface===race.surface)
    .map(x=>x.evidence_ref),
   official_corner_proofs:verifiedCorners.map(x=>({
    evidence_ref:x.evidence_ref,official_source_ref:x.certified_official_corner_source,
    source_checked_at:x.certified_official_corner_checked_at,
    score_bonus:x.corner_position_bonus
   })),
   strongest_evidence:best.map(x=>({
    evidence_ref:x.evidence_ref,history_date:x.history_date,finish:x.finish,
    track:x.track,distance:x.distance,context_band:x.context_band,
    score_signal:x.score_signal,corner_bonus:x.corner_position_bonus
   })),
   evidence_warning:a.gaps!=='NONE'?a.gaps:
    a.other_condition_runs>0?'OTHER_CONDITION_EQUIVALENCE_NOT_PROVEN':
    'HISTORIC_CAUSAL_EXPLANATION_NOT_PROVEN',
   research_only:true
  };
 });
 // Review ALL baseline outsiders, including rank 7+, not just the new
 // research rank 6. No auto swaps, no finish-based retroactive promotion.
 const rank5=scoreRows.find(x=>x.baseline_rank===5);
 const watch=scoreRows.filter(x=>x.baseline_rank>5&&
  x.recent_exact_course_distance_podium_runs>
   (rank5?.recent_exact_course_distance_podium_runs??0))
  .map(x=>({
   horse_no:x.horse_no,baseline_rank:x.baseline_rank,
   rank5_horse_no:rank5.horse_no,
   rank5_verified_recent_exact_distance_podium:
    rank5.recent_exact_course_distance_podium_runs,
   outsider_verified_recent_exact_distance_podium:
    x.recent_exact_course_distance_podium_runs,
   outsider_verified_recent_exact_distance_wins:
    x.recent_exact_course_distance_win_runs,
   official_history_refs:x.exact_course_distance_podium_evidence_refs,
   review:'CHECK_OUTSIDER_EXACT_DISTANCE_HISTORY_VS_BASELINE_RANK5',
   automatic_promotion:false,
   class_equivalence_and_race_strength_still_need_review:true
  })).sort((a,b)=>a.baseline_rank-b.baseline_rank);
 return {
  status:'RESEARCH_DRAFT_REVIEWABLE',
  release_status:'RESEARCH_NOT_DEPLOYED',
  race_identity:scored.race_identity,model:scored.model,
  all_runners_checked:ranked.length,
  original_top5:before.slice(0,5),
  independently_scored_top5:after.slice(0,5),
  independently_scored_full_order:after,
  newly_in_top5:after.slice(0,5).filter(x=>!oldTop.has(x)),
  dropped_from_top5:before.slice(0,5).filter(x=>!newTop.has(x)),
  scored_full_field:scoreRows,
  baseline_top5_boundary_watch:watch,
  boundary_watch_alters_official_score:false,
  rank_change_explanations_required:true,
  official_corner_witness_count:scored.official_corner_witness_count,
  official_corner_witness_status:scored.official_corner_witness_status,
  requires_manual_review:true,
  save_authorized:false,production_rank_effect:false,
  production_score_effect:false,production_eye_effect:false,
  frozen_modified:false,market_used:false,target_result_used:false
 };
}

/**
 * Research-only adaptation of the exact COMPACT_V1 shape emitted by the
 * production guarded lab_claimed_context server (NOT a live claim check).
 * The caller must still hold and recheck a lawful CLAIM before any save.
 * No fetch, token, RPC, or write operation happens here.
 */
export function buildLocalV17ReviewFromClaimedContext({
 claimedContext,baseline,observedAt
}={}){
 const context=claimedContext;
 if(!context||context.context_format!=='COMPACT_V1'||
    context.field_integrity_checked!==true||
    context.stage!=='AWAITING_FULL_DEPTH_COMPARISON'||
    context.protocol?.enforced_server_side!==true||
    context.protocol?.protocol_key!=='LOCAL_MAIN'||
    context.race?.circuit!=='LOCAL'||
    !Array.isArray(context.runners)||
    context.runners.length<6||context.runners.length>20||
    context.relative_condition_status!=='READY'||
    !context.relative_condition_evidence||
    context.relative_condition_evidence.runner_count!==context.runners.length)
  return refuse('VERIFIED_CLAIMED_CONTEXT_NOT_AVAILABLE');
 const comparison=selectVerifiedLocalResearchComparison(context);
 if(!comparison||comparison.status!=='READY'||
    comparison.runner_count!==context.runners.length)
  return refuse('FULL_FIELD_RESEARCH_HISTORY_NOT_AVAILABLE');
 const identity=new Set();
 const activeRunners=context.runners.map(r=>{
  if(!number(r?.horse_no)||!norm(r.horse_name)||identity.has(r.horse_no))
   return null;
  identity.add(r.horse_no);
  return {horse_no:r.horse_no,horse_name:r.horse_name,status:'ACTIVE'};
 });
 if(activeRunners.some(x=>x===null))
  return refuse('OFFICIAL_CLAIMED_FIELD_IDENTITY_MISMATCH');
 const race={circuit:'LOCAL',race_date:context.race.race_date,
  track:context.race.track,race_no:context.race.race_no,
  race_name:context.race.race_name,
  class_name:context.race.conditions?.class_name,
  surface:context.race.conditions?.surface,
  distance:context.race.conditions?.distance,
  observation_at:observedAt,post_time:context.race.post_time};
 const report=buildLocalV17ReviewHandoff({
  race,comparison,activeRunners,baseline
 });
 const actualCorner=comparison===context.official_corner_shadow?.research_relative_condition_evidence;
 return {...report,
  evidence_lane:actualCorner?'VERIFIED_PRECLAIM_CORNER_RESEARCH':
   'NORMAL_CLAIM_OFFICIAL_HISTORY_ONLY',
  live_claim_rechecked_by_this_pure_function:false,
  ready_for_production_adoption:false,
  signed_official_score:false};
}
