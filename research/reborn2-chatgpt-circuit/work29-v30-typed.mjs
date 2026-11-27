// Work29 actual pinned producer contract -> isolated typed research findings, not identity fusion.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {candidateObservation,fixture29} from './work29-pinned/stage29-observation-contract-v0.1.mjs';
import {analyzeV30} from './work29-v30-terminal.mjs';
export {fixture29};
const pinned=readFileSync(new URL('./work29-pinned/stage29-observation-contract-v0.1.mjs',import.meta.url));
const hash=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
if(hash('sha256',pinned)!=='6f802e227cafda160275e0aa17d67360e00b3ae80e252bc80d2afcac620a8e97'||hash('sha1',Buffer.concat([Buffer.from('blob '+pinned.length+'\0'),pinned]))!=='60bd7e95f13a77a606f494e5f8b04b77fdd5a957')throw Error('WORK29_PIN_MISMATCH');
export function analyzeWork29(candidates,withdraw=null){
 const findings=[],held=[],shared=new Map();
 for(const {e,registry} of candidates){
  const x=candidateObservation(e,registry);
  if(x.state!=='TEST_OBSERVATION_ELIGIBLE'||x.formal||x.score_authorized||x.benchmark_admission){held.push({state:x.state,reason:x.reason});continue;}
  const o=e.observation,s=e.record,q=x.observations[0],base={root:q.root,dependencies:q.dependencies,subject:o.subjectId,event:s.eventId,unit:q.unit,scope:q.scope,version:q.version,sourceDigest:q.sourceDigest,pointer:q.pointer,formal:false,current_relevance:'UNPROVEN',independent_vote:false};
  // Shared leader measurement is event-level, not an independent vote for every row.
  if(o.field==='race_leader_laps'){
   const root=[s.issuer,s.eventId,s.sourceId,s.version,s.originalDigest,o.field].join('|');
   if([root,q.root,...q.dependencies].includes(withdraw)){held.push({state:'HELD',reason:'WITHDRAWN_DEPENDENCY'});continue;}
   const value={boundaries_m:o.boundariesM,segments_ms:q.value,distance_m:o.distanceM};
   const old=shared.get(root);
   if(old){if(JSON.stringify(old.observation)!==JSON.stringify(value))old.conflict=true;old.row_roots.push(q.root);continue;}
   shared.set(root,{...base,root,row_roots:[q.root],subject:null,item:'RANK58',state:'RACE_LEADER_PACE_ONLY',observation:value,conflict:false});
   continue;
  }
  if([q.root,...q.dependencies].includes(withdraw)){held.push({state:'HELD',reason:'WITHDRAWN_DEPENDENCY'});continue;}
  if(o.field==='individual_intermediate_clock'||o.field==='individual_final600'){
   const m=o.toM-o.fromM,avg=m*1000/q.value;
   findings.push({...base,item:o.field==='individual_final600'?'RANK06':'RANK08',state:'INDIVIDUAL_INTERVAL_AVERAGE_ONLY',observation:{from_m:o.fromM,to_m:o.toM,distance_m:o.distanceM,elapsed_ms:q.value,average_mps:avg,measurement_uncertainty_ms:null},missing:['MEASUREMENT_BOUND_NOT_SUPPLIED','MATCHED_LOAD_AND_CURRENT_RESPONSE_UNPROVEN']});
  }else if(o.field==='finish_clock')findings.push({...base,item:'RANK05',state:'HISTORICAL_CLOCK_ONLY',observation:{elapsed_ms:q.value},missing:['EXACT_COMMON_START_AND_CHECKPOINT_BINDING_NOT_SUPPLIED']});
  else if(o.field==='finish')findings.push({...base,item:'RANK02',state:'HISTORICAL_FINISH_ONLY',observation:q.value});
  else if(o.field==='passing_order')findings.push({...base,item:'RANK18',state:'GROUPED_ORDER_NOT_EXACT_INDIVIDUAL_CLOCK',observation:q.value});
  else findings.push({...base,item:o.field==='peer_followup'?'RANK37':'RANK36',state:'PEER_LINK_REVIEW_ONLY',observation:q.value});
 }
 for(const p of shared.values())if(p.conflict)held.push({state:'HELD',reason:'SHARED_RACE_MEASUREMENT_CONFLICT',root:p.root});else findings.push(p);
 return {scope:'WORK29_SYNTHETIC_TYPED_FINDINGS_ONLY',findings,held,formal:0,grade:null,prediction:false};
}
// Attach typed findings as a separate analysis namespace. Never conflate TEST native IDs with S26 IDs.
export function analyzeV30WithWork29(L,name,candidates,withdraw=null,options={}){
 const out=analyzeV30(L,name,withdraw,options),work29=analyzeWork29(candidates,options.work29Withdraw??null);
 return {...out,work29,formal:false,grade:null};
}
