/**
 * Offline counterfactual ONLY: "What if the pre-race EYE replaced 5th?"
 *
 * This deliberately tests a naive policy and DOES NOT recommend it. It never
 * uses outcomes to select a horse. It never mutates FROZEN or writes to DB.
 * pre-race projection and post-result evaluation are separate entry points.
 */
const isNo = x => Number.isInteger(x) && x >= 1 && x <= 24;
const dt = x => typeof x === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x)) ? Date.parse(x) : NaN;
const day = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x + 'T00:00:00Z'));
const result = (state,other={}) => ({state,mode:'EYE_REPLACES_RANK5_COUNTERFACTUAL_ONLY',
    changed_frozen:false,production_rank_effect:false,market_used:false,...other});
const fail = state => result(state,{proposal:null});
function runnerKey(r){return isNo(r?.horse_no)&&typeof r.horse_name==='string'&&r.horse_name.trim() ?
  r.horse_no + '|' + r.horse_name : null;}

/**
 * Must accept a PRE-RACE prediction only, never a result.
 * Evidence quality is NOT inferred from text; do not use this shadow to
 * justify live promotion of an EYE.
 */
export function buildPreraceEyeBoundaryCounterfactual(prediction){
 const p=prediction;
 if(!p || p.result!==undefined || p.finishers!==undefined ||
   p.payload?.result!==undefined || p.payload?.finishers!==undefined)
   return fail('INPUT_MUST_BE_PRERACE_ONLY');
 if(!day(p.race_date)||!['JRA','LOCAL'].includes(p.circuit)||!p.track||
    !isNo(p.race_no)||p.status!=='FROZEN'||!Number.isFinite(dt(p.frozen_at))||
    !Number.isFinite(dt(p.post_time))||dt(p.frozen_at)>=dt(p.post_time))
   return fail('NOT_VERIFIED_PRERACE');
 const top=p.payload?.top5, full=p.payload?.runners, eye=p.payload?.eye;
 if(!Array.isArray(top)||top.length!==5||!Array.isArray(full)||
    full.length<5||full.length>24) return fail('FIELD_MISSING');
 const keys=new Set(full.map(r=>runnerKey(r))), ranks=new Set(full.map(r=>r.rank));
 if(keys.size!==full.length||keys.has(null)||ranks.size!==full.length||
    !Array.from({length:full.length},(_,i)=>i+1).every(i=>ranks.has(i)))
   return fail('FIELD_IDENTITY_OR_RANK_INVALID');
 const refByNo=new Map(full.map(r=>[r.horse_no,r]));
 if(refByNo.size!==full.length) return fail('DUPLICATE_HORSE_NUMBER');
 const topNos=[];
 for(let i=0;i<5;i++){
   const h=top[i], ref=refByNo.get(h?.horse_no);
   if(!ref||runnerKey(h)!==runnerKey(ref)||h.rank!==i+1||ref.rank!==i+1)
     return fail('TOP5_NOT_EXACT_FROZEN');
   topNos.push(h.horse_no);
 }
 if(eye===null||eye===undefined)return result('NO_EYE_NOT_AUTO_RANK6',{proposal:null});
 const ref=refByNo.get(eye.horse_no);
 if(!ref||runnerKey(eye)!==runnerKey(ref)||eye.rank!==ref.rank||
    eye.rank<=5||topNos.includes(eye.horse_no))
   return fail('EYE_NOT_IN_FROZEN_FIELD');
 const proposal={
   circuit:p.circuit,race_date:p.race_date,track:p.track,race_no:p.race_no,
   frozen_at:p.frozen_at,post_time:p.post_time,
   baseline_top5:topNos,shadow_top5:[...topNos.slice(0,4),eye.horse_no],
   promoted_eye:eye.horse_no,displaced_rank5:topNos[4],
   full_field:full.map(h=>h.horse_no),
   policy:'MECHANICAL_REPLACE_FIFTH__NOT_AN_EVIDENCE_RULE',
   target_result_used:false,market_used:false
 };
 return result('SHADOW_ONLY',{proposal});
}
/** Results are read ONLY AFTER the counterfactual already exists. */
export function evaluateEyeBoundaryAfterResult(proposal,officialResult){
 if(!proposal||proposal.policy!=='MECHANICAL_REPLACE_FIFTH__NOT_AN_EVIDENCE_RULE'||
   proposal.target_result_used!==false||proposal.market_used!==false)
   return {state:'INVALID_PRERACE_PROPOSAL'};
 const fs=officialResult?.finishers;
 if(!Array.isArray(fs)||fs.length<3||!Array.isArray(proposal.full_field)||
   !Array.isArray(proposal.baseline_top5)||!Array.isArray(proposal.shadow_top5))
   return {state:'RESULT_NOT_COMPLETE'};
 const hits=fs.slice(0,3);
 if(hits.some((h,i)=>h?.finish!==i+1||!isNo(h.horse_no)||
   !proposal.full_field.includes(h.horse_no))||new Set(hits.map(h=>h.horse_no)).size!==3)
   return {state:'RESULT_NOT_VERIFIED'};
 const nums=hits.map(h=>h.horse_no), before=new Set(proposal.baseline_top5),
   after=new Set(proposal.shadow_top5);
 const gained=nums.filter(n=>!before.has(n)&&after.has(n));
 const lost=nums.filter(n=>before.has(n)&&!after.has(n));
 return {
   state:'POST_RESULT_RESEARCH_ONLY',
   podium_before:nums.filter(n=>before.has(n)).length,
   podium_after:nums.filter(n=>after.has(n)).length,
   podium_gain:gained.length,podium_loss:lost.length,
   newly_caught:gained,lost_from_top5:lost,
   winner_before:before.has(nums[0]),winner_after:after.has(nums[0]),
   winner_gained:!before.has(nums[0])&&after.has(nums[0]),
   winner_lost:before.has(nums[0])&&!after.has(nums[0]),
   production_rank_effect:false,changed_frozen:false,market_used:false
 };
}
/** Aggregate historical paired data, without any post-result selection logic. */
export function auditMechanicalEyeSwapPairs(pairs){
 if(!Array.isArray(pairs))throw new TypeError('PAIRS_REQUIRED');
 const cohorts={},invalid=[],examples=[],seen=new Set();
 const zero=()=>({races:0,candidates:0,eye_without_promotion:0,podium_gain:0,
   podium_loss:0,winner_gain:0,winner_loss:0});
 for(const pair of pairs){
   const p=pair?.prediction,period=p?.race_date==='2026-11-08'?'RECENT_1108':'EARLIER',
     key=[p?.race_date,p?.track,p?.race_no].join('|'),group=p?.circuit+'|'+period;
   if(seen.has(key)){invalid.push({key,reason:'DUPLICATE_RACE'});continue;}
   seen.add(key);
   const prep=buildPreraceEyeBoundaryCounterfactual(p);
   if(!cohorts[group])cohorts[group]=zero();
   const v=cohorts[group];
   if(prep.state==='NO_EYE_NOT_AUTO_RANK6'){v.races++;v.eye_without_promotion++;continue;}
   if(prep.state!=='SHADOW_ONLY'){invalid.push({key,reason:prep.state});continue;}
   const outcome=evaluateEyeBoundaryAfterResult(prep.proposal,pair?.result);
   if(outcome.state!=='POST_RESULT_RESEARCH_ONLY'){invalid.push({key,reason:outcome.state});continue;}
   v.races++;v.candidates++;
   v.podium_gain+=outcome.podium_gain;v.podium_loss+=outcome.podium_loss;
   v.winner_gain+=Number(outcome.winner_gained);
   v.winner_loss+=Number(outcome.winner_lost);
   if(outcome.podium_gain || outcome.podium_loss)
     examples.push({key,original_eye_rank:p.payload.eye.rank,
       displaced_rank5:prep.proposal.displaced_rank5,
       promoted_eye:prep.proposal.promoted_eye,
       newly_caught:outcome.newly_caught,lost_from_top5:outcome.lost_from_top5,
       winner_lost:outcome.winner_lost,winner_gained:outcome.winner_gained});
 }
 return {mode:'POST_RESULT_RESEARCH_ONLY',hypothesis:'MECHANICAL_EYE_SWAP_IS_NOT_AUTOMATICALLY_SAFE',
   cohorts,invalid,examples,
   production_rank_effect:false,changed_frozen:false,market_used:false};
}
