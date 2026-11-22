// ISOLATED RESEARCH ONLY: a deterministic source->signed-point generator.
// No production policy, coefficients, source reader or permission is bundled.
// A snapshot supplied by an approved future reader must bind every horse/run
// to original source bytes. Never invoke this on production predictions.
// This does not claim the unrecorded historical subjective scorer is recovered.
import {sha as canonicalSha} from '../../../automation/jra-score-ledger/declared-ledger.mjs';
import {calculateRecoveredBase30_38} from './recovered-base30-38-readonly.mjs';
const fail=code=>{throw Error('RESEARCH_SCORER_'+code)};
const isText=x=>typeof x==='string'&&x.trim().length>0;
const isInt=x=>typeof x==='number'&&Number.isSafeInteger(x);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const digest=x=>canonicalSha(x);
const lex=(a,b)=>a<b?-1:a>b?1:0;
const SHA=/^[a-f0-9]{64}$/;
const allowed={
 margin:'numeric',last3f:'numeric',distance:'numeric',corners:'numeric',
 rest:'numeric',class:'category',going:'category',course:'category'
};
function dateDays(date){
 if(typeof date!=='string'||!/^20\d{2}-\d\d-\d\d$/.test(date))fail('BAD_DATE');
 const time=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date)fail('BAD_DATE');
 return time/86400000;
}
function measure(kind,run,target){
 switch(kind){
  case 'margin':return finite(run.margin_to_winner)?run.margin_to_winner:fail('MARGIN_MISSING');
  case 'last3f':return finite(run.final3f)?run.final3f:fail('LAST3F_MISSING');
  case 'distance':
   return finite(run.distance)&&finite(target.distance)&&isText(run.surface)&&run.surface===target.surface?
    Math.abs(run.distance-target.distance):fail('COMPARABLE_DISTANCE_MISSING');
  case 'corners':{
   const a=run.corner_positions;
   return Array.isArray(a)&&a.length>=2&&a.every(isInt)?
    a[0]-a[a.length-1]:fail('CORNERS_MISSING');
  }
  case 'rest':return dateDays(target.race_date)-dateDays(run.race_date);
  case 'class':return isText(run.race_class)?run.race_class.normalize('NFKC'):fail('CLASS_MISSING');
  case 'going':return isText(run.going)?run.going.normalize('NFKC'):fail('GOING_MISSING');
  case 'course':return isText(run.track)&&isText(target.track)?
    (run.track===target.track?'SAME':'OTHER'):fail('COURSE_MISSING');
  default:fail('UNSUPPORTED_UNTRUSTED_FACTOR_'+kind);
 }
}
const points=x=>{if(!isInt(x)||x < -15||x > 15)fail('POINTS_INVALID');return x;};
function compilePolicy(policy){
 if(!policy||policy.classification!=='UNAPPROVED_RESEARCH_ONLY'||
  !isText(policy.id)||!Array.isArray(policy.rules)||!policy.rules.length||
  policy.base_policy_id!=='JRA_RESEARCH_BASE_30PLUS38_V1')
  fail('POLICY_NOT_DECLARED');
 const seen=new Set();
 for(const rule of policy.rules){
  if(!rule||!Object.hasOwn(allowed,rule.kind)||seen.has(rule.kind)||
     rule.mode!==allowed[rule.kind])fail('RULE_KIND_OR_MODE');
  seen.add(rule.kind);
  if(rule.mode==='numeric'){
   if(!Array.isArray(rule.bands)||!rule.bands.length)fail('NUMERIC_BANDS_MISSING');
   let prev=-Infinity;
   for(const band of rule.bands){
    if(!finite(band.lte)||band.lte<=prev)fail('NUMERIC_BANDS_OVERLAP');
    points(band.points);prev=band.lte;
   }
  }else{
   if(!rule.categories||typeof rule.categories!=='object'||Array.isArray(rule.categories)||
     !Object.keys(rule.categories).length)fail('CATEGORIES_MISSING');
   for(const [key,value] of Object.entries(rule.categories)){
    if(!isText(key)||key!==key.normalize('NFKC'))fail('CATEGORY_UNNORMALIZED');
    points(value);
   }
  }
  // Requiring an explicit else is deliberate. No hidden weighting defaults.
  points(rule.otherwise_points);
 }
 return policy;
}
function factorValue(rule,value){
 if(rule.mode==='numeric'){
  for(const band of rule.bands)if(value<=band.lte)return points(band.points);
  return points(rule.otherwise_points);
 }
 return points(Object.hasOwn(rule.categories,value)?rule.categories[value]:rule.otherwise_points);
}
function targetFromContext(context){
 const r=context?.race,actual=r?.field_payload?.race ?? r?.race;
 if(!r||!actual)return fail('TARGET_RACE_CONTEXT_MISSING');
 const target={race_date:r.race_date,track:r.track,
  surface:actual.surface,distance:actual.distance,going:actual.going};
 dateDays(target.race_date);
 return target;
}
export function generateResearchSourcePoints({context,selectedRuns,policy}={}){
 const approved=compilePolicy(policy),target=targetFromContext(context);
 const orderedRules=approved.rules.slice().sort((a,b)=>lex(a.kind,b.kind));
 const orderedRows=context?.runner_history?.slice().sort((a,b)=>a.horse_no-b.horse_no);
 if(!Array.isArray(context?.runner_history)||!Array.isArray(context?.candidates)||
    !Array.isArray(selectedRuns)||!context.runner_history.length||
    context.runner_history.length!==context.candidates.length)
  fail('COMPLETE_CLAIM_CONTEXT_REQUIRED');
 const runners=[],seen=new Set(),usedProof=new Set();
 const proofs=new Map();
 for(const item of selectedRuns){
  if(!isInt(item.horse_no)||!isText(item.run_id)||!isText(item.horse_id)||
     !isText(item.source_ref)||!SHA.test(item.original_sha256)||
     item.original_bytes_verified!==true||item.verified_before_post!==true||
     item.source_ref.startsWith('CLAIMED_CONTEXT_RUN:'))fail('ORIGINAL_SOURCE_PROOF_UNAVAILABLE');
  const key=JSON.stringify([item.horse_no,item.run_id]);
  if(proofs.has(key))fail('DUPLICATE_SELECTED_RUN_PROOF');
  proofs.set(key,item);
 }
 for(const row of orderedRows){
  const no=row.horse_no,base=context.candidates.filter(x=>x.horse_no===no);
  if(!isInt(no)||no<1||no>24||seen.has(no)||base.length!==1||
     !Array.isArray(row.past_runs)||!row.past_runs.length)
    fail('INVALID_HORSE_OR_CANDIDATE');
  seen.add(no);
  const baseRate=base[0].base_rate;
  if(!finite(baseRate)||baseRate<0||baseRate>1)fail('CLAIM_BASE_RATE_MISSING');
  const baseScore=calculateRecoveredBase30_38(String(baseRate));
  const effects=[],facts=[],perRunnerRuns=new Set();
  for(const run of row.past_runs.slice().sort((a,b)=>lex(a.run_id,b.run_id))){
   if(!isText(run.run_id)||!isText(run.horse_id)||
      !isText(run.source_ref)||!SHA.test(run.original_sha256)||
      !isText(run.race_date)||dateDays(run.race_date)>=dateDays(target.race_date))
     fail('RUN_IDENTITY_OR_ASOF_INVALID');
   const proof=proofs.get(JSON.stringify([no,run.run_id]));
   if(!proof||proof.horse_id!==run.horse_id||proof.source_ref!==run.source_ref||
      proof.original_sha256!==run.original_sha256)fail('EXACT_SELECTED_RUN_MISMATCH');
   const usedKey=JSON.stringify([no,run.run_id]);if(perRunnerRuns.has(usedKey))fail('DUPLICATE_RUN');
   perRunnerRuns.add(usedKey);usedProof.add(usedKey);
   for(const rule of orderedRules){
    const measured=measure(rule.kind,run,target);
    const computed=factorValue(rule,measured);
    facts.push({horse_no:no,run_id:run.run_id,kind:rule.kind,
      input:measured,points:computed,original_sha256:run.original_sha256,
      policy_id:policy.id});
    effects.push({kind:rule.kind,source_ref:run.source_ref,points:computed,
      run_id:run.run_id,horse_id:run.horse_id,original_sha256:run.original_sha256});
   }
  }
  const delta=effects.reduce((s,f)=>s+f.points,0),final=Math.max(0,Math.min(100,baseScore+delta));
  runners.push({horse_no:no,horse_name:row.horse_name,base_score:baseScore,
   research_score:final,score_delta:delta,base_rank:base[0].base_rank,
   effects,facts,source_run_count:row.past_runs.length,formal_score:null});
 }
 if(proofs.size!==usedProof.size)fail('UNUSED_OR_DUPLICATE_SOURCE_PROOF');
 runners.sort((a,b)=>b.research_score-a.research_score||
  a.base_rank-b.base_rank||a.horse_no-b.horse_no);
 runners.forEach((r,i)=>r.research_rank=i+1);
 const normalizedPolicy={...policy,rules:orderedRules};
 const inputSignature={
  policy:normalizedPolicy,
  context:{race:target,runner_history:orderedRows.map(row=>({
   ...row,past_runs:row.past_runs.slice().sort((a,b)=>lex(a.run_id,b.run_id))
  })),candidates:context.candidates.map(x=>({
   horse_no:x.horse_no,base_rate:x.base_rate,base_rank:x.base_rank
  })).sort((a,b)=>a.horse_no-b.horse_no)},
  selectedRuns:selectedRuns.slice().sort((a,b)=>
   a.horse_no-b.horse_no||lex(a.run_id,b.run_id))
 };
 return {schema:'JRA_UNAPPROVED_FACT_TO_POINT_REPLAY_V1',
   classification:'ISOLATED_UNAPPROVED_DETERMINISTIC_RESEARCH',
   input_sha256:digest(inputSignature),policy_sha256:digest(normalizedPolicy),
   research_only:true,production_allowed:false,formal_score_verified:false,
   official_issuer_verified:false,original_scorer_recovered:false,
   runners,source_runs_used:usedProof.size,
   reason:'DETERMINISTIC_RESEARCH_CANDIDATE_NOT_FORMAL_100_POINT_ENGINE'};
}
