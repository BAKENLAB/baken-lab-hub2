// Research-only comparison, never a production save authorization.
// An actual score comes only from a separate deterministic facts->points
// generation under a specifically supplied policy and selected source bytes.
import {generateResearchSourcePoints} from './source-to-points-scorer.candidate.mjs';
const neg=(reason,detail={})=>({ok:false,reason,...detail,
  formal_scoring_allowed:false,original_scorer_recovered:false,
  official_original_verified:false,production_allowed:false});
const unique=xs=>new Set(xs).size===xs.length;
function vector(xs){
 return xs.map(x=>[x.kind,x.source_ref,x.points,x.run_id,x.horse_id,x.original_sha256])
  .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function compareGeneratedResearchScores({generated,payload}={}){
 const model=generated;
 if(model?.classification!=='ISOLATED_UNAPPROVED_DETERMINISTIC_RESEARCH'||
   model.production_allowed!==false||
   !Array.isArray(model.runners)||!model.runners.length)
   return neg('DETERMINISTIC_GENERATOR_PACKET_INVALID');
 const submitted=payload?.runners,reviews=payload?.audit?.runner_history_checked;
 if(!Array.isArray(submitted)||!Array.isArray(reviews)||
    submitted.length!==model.runners.length||reviews.length!==model.runners.length)
  return neg('REPLAY_FULL_FIELD_MISSING');
 const predicted=model.runners;
 if(!unique(submitted.map(x=>x.horse_no))||!unique(reviews.map(x=>x.horse_no))||
    !unique(predicted.map(x=>x.horse_no)))
  return neg('REPLAY_DUPLICATE_HORSE');
 for(const rr of predicted){
  const r=submitted.filter(x=>x.horse_no===rr.horse_no);
  const d=reviews.filter(x=>x.horse_no===rr.horse_no);
  if(r.length!==1||d.length!==1)return neg('REPLAY_HORSE_NOT_UNIQUE',{horse_no:rr.horse_no});
  const review=d[0],actual=r[0];
  if(review.base_score!==rr.base_score)
    return neg('REPLAY_BASE_MISMATCH',{horse_no:rr.horse_no});
  if(!Array.isArray(review.evidence_effects)||review.evidence_effects.length!==rr.effects.length||
    JSON.stringify(vector(review.evidence_effects))!==JSON.stringify(vector(rr.effects)))
    return neg('REPLAY_FACTOR_POINTS_OR_PROVENANCE_MISMATCH',{horse_no:rr.horse_no});
  if(review.score_after!==rr.research_score||actual.score!==rr.research_score)
    return neg('REPLAY_FINAL_SCORE_MISMATCH',{horse_no:rr.horse_no});
  if(review.rank_after!==rr.research_rank||actual.rank!==rr.research_rank)
    return neg('REPLAY_RANK_MISMATCH',{horse_no:rr.horse_no});
 }
 return {
  ok:true,reason:'RESEARCH_ONLY_EXACT_FACT_TO_POINT_PARITY',
  checked_horses:predicted.length,
  policy_sha256:model.policy_sha256,input_sha256:model.input_sha256,
  formal_scoring_allowed:false,production_allowed:false,
  original_scorer_recovered:false,official_original_verified:false,
  canonical_issuer_verified:false,
  score_contract_approved:false
 };
}

export function compareResearchGeneratedToDeclared({context,selectedRuns,policy,payload}={}){
 let generated;
 try{generated=generateResearchSourcePoints({context,selectedRuns,policy});}
 catch(e){return neg('SOURCE_SCORER_UNAVAILABLE',{detail:String(e?.message??e)});}
 return compareGeneratedResearchScores({generated,payload});
}
