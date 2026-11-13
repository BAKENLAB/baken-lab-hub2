/**
 * LOCAL 1.7 pre-FROZEN candidate handoff, research only.
 * Scores and ranks are independently derived from verified historical evidence.
 * Baseline ranks are considered only AFTER the scorer has finished.
 * No HTTP/DB, no saves or changes to existing FROZEN.
 */
import {buildLocalV17IndependentShadow} from './local-v17-full-field-independent-shadow.mjs';

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
  rank_change_explanations_required:true,
  official_corner_witness_count:scored.official_corner_witness_count,
  official_corner_witness_status:scored.official_corner_witness_status,
  requires_manual_review:true,
  save_authorized:false,production_rank_effect:false,
  production_score_effect:false,production_eye_effect:false,
  frozen_modified:false,market_used:false,target_result_used:false
 };
}
