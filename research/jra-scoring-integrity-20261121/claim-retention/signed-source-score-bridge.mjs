// Isolated V11 signed-evidence -> deterministic factor-generator bridge.
// Never supplies a live provider, approved numeric weights, DB save or
// production eligibility. The ONLY source runs admitted are exact entries
// checked by the existing V11 issuer/gate/source/parser/bytes verifier.
// Fail closed when ANY target current horse/run or required factor is unbound.
import {safeVerifyEvidence} from '../../../automation/jra-score-ledger/evidence/contract.mjs';
import {resolveFactorEvidence} from '../../../automation/jra-score-ledger/evidence/factor-resolver.mjs';
import {generateResearchSourcePoints} from './source-to-points-scorer.candidate.mjs';

const fail=(reason,extra={})=>({
  ok:false,reason,...extra,
  real_original_reader_connected:false,
  official_score_approved:false,production_allowed:false,
  formal_scoring_allowed:false
});
const measurement=(facts,key)=>{
  const matches=facts.filter(x=>x.measurement===key);
  return matches.length===1?matches[0].value:undefined;
};
function acceptedCorners(facts){
 const positions=facts.filter(x=>/^corner_positions\[\d+\]$/.test(x.measurement))
 .map(x=>({index:Number(x.measurement.match(/\[(\d+)\]/)[1]),value:x.value}))
 .sort((a,b)=>a.index-b.index);
 if(positions.length<2||positions.some((x,i)=>x.index!==i||
    !Number.isSafeInteger(x.value)||x.value<1)) return null;
 return positions.map(x=>x.value);
}
function scalar(facts,name){
 const value=measurement(facts,name);
 return typeof value==='number'&&Number.isFinite(value)?value:null;
}
// No direct user-supplied "selectedRuns", "proof flags" or source-ref shortcuts.
// Every generated row must descend from the checked signed envelope and body.
export function scoreVerifiedV11ResearchPacket({packet,trust,policy}={}){
 const proof=safeVerifyEvidence(packet,trust);
 if(proof.status==='RESEARCH_EVIDENCE_UNAVAILABLE')
   return fail('SIGNED_OR_GATE_VERIFICATION_FAILED',{detail:proof.code});
 if(!['SYNTHETIC_CONTRACT_VALIDATED','RESEARCH_EVIDENCE_VALIDATED'].includes(proof.status)||
    !proof.accepted?.length||proof.rejected?.length)
   return fail('SIGNED_SOURCE_PARTIAL_OR_UNAVAILABLE',{source_status:proof.status});
 if(proof.scope!=='SYNTHETIC_TEST'&&proof.scope!=='FUTURE')
   return fail('UNSUPPORTED_ISSUER_SCOPE');
 let context;
 try{context=JSON.parse(packet.contextText);}
 catch{return fail('SIGNED_CONTEXT_INVALID');}
 const all=context.runner_history;
 const active=context.race?.field_payload?.runners?.filter(x=>x.status==='ACTIVE');
 if(!Array.isArray(all)||!all.length||!Array.isArray(active)||!active.length||
    all.length!==active.length||!Array.isArray(context.candidates)||
    context.candidates.length!==active.length)
   return fail('SIGNED_FULL_FIELD_MISSING');
 const accepted=new Map();
 const requested=[];
 const current=active.map(x=>x.horse_no);
 if(new Set(current).size!==current.length)
   return fail('DUPLICATE_ACTIVE_HORSE');
 const supportedKinds=new Set(['margin','corners','last3f','distance','rest','course']);
 const rules=policy?.rules;
 if(!Array.isArray(rules)||!rules.length||
    rules.some(x=>!supportedKinds.has(x.kind)))
   return fail('POLICY_USES_UNSIGNED_OR_UNSUPPORTED_FACTS');
 const kinds=[...new Set(rules.map(r=>r.kind))];
 const total=all.reduce((n,r)=>n+(Array.isArray(r.past_runs)?r.past_runs.length:0),0);
 if(!total||proof.accepted.length!==total)
   return fail('ALL_SELECTED_HISTORY_SLOTS_NOT_SIGNED');
 for(const signed of proof.accepted){
   const key=JSON.stringify([signed.horse_no,signed.context_prior_index]);
   if(accepted.has(key))return fail('DUPLICATE_SIGNED_HISTORY_SLOT');
   accepted.set(key,signed);
   for(const kind of kinds){
     requested.push({horse_no:signed.horse_no,kind,
       source_ref:'CLAIMED_CONTEXT_RUN:'+signed.horse_no+':'+signed.context_prior_index});
   }
 }
 const bindings=resolveFactorEvidence(packet,{trust,components:requested});
 if(!['RESEARCH_VERIFIED','SYNTHETIC_ONLY'].includes(bindings.status))
   return fail('SIGNED_FACTOR_BINDING_UNAVAILABLE',{
     detail:bindings.errors?.join('|'),status:bindings.status
   });
 if(bindings.bindings.length!==requested.length)
   return fail('SIGNED_FACTOR_COVERAGE_INCOMPLETE');
 const trustedRows=[],selectedRuns=[],used=new Set();
 for(const row of all){
   const no=row.horse_no;
   if(!current.includes(no)||!Array.isArray(row.past_runs)||!row.past_runs.length)
     return fail('ACTIVE_HISTORY_ABSENT_OR_UNMATCHED',{horse_no:no});
   const enriched=[];
   for(let index=0;index<row.past_runs.length;index++){
     const key=JSON.stringify([no,index]),verified=accepted.get(key);
     const entries=packet.envelope?.entries?.filter(x=>
       x.horse_no===no&&x.context_prior_index===index);
     if(!verified||entries?.length!==1||used.has(key))
       return fail('SELECTED_RUN_PROOF_NOT_UNIQUE',{horse_no:no,index});
     used.add(key);
     const entry=entries[0],archive=entry.archive,doc=entry.document;
     const facts=verified.facts;
     const linked=bindings.bindings.filter(x=>x.horse_no===no&&
       x.run_id===verified.run_id);
     if(linked.length!==kinds.length ||
       linked.some(x=>x.body_sha256!==doc.body_sha256||
         x.horse_id!==verified.horse_id||x.race_id!==verified.race_id))
       return fail('SOURCE_BODY_OR_FACTOR_MISMATCH',{horse_no:no,index});
     const run={
       run_id:verified.run_id,horse_id:verified.horse_id,
       source_ref:archive.source_ref,original_sha256:doc.body_sha256,
       race_date:archive.race_date,track:archive.track,surface:archive.surface,
       distance:archive.distance
     };
     if(kinds.includes('margin')){
       run.margin_to_winner=scalar(facts,'margin_to_winner');
       if(run.margin_to_winner===null)return fail('SIGNED_MARGIN_MISSING',{horse_no:no,index});
     }
     if(kinds.includes('last3f')){
       run.final3f=scalar(facts,'final3f');
       if(run.final3f===null)return fail('SIGNED_LAST3F_MISSING',{horse_no:no,index});
     }
     if(kinds.includes('corners')){
       run.corner_positions=acceptedCorners(facts);
       if(!run.corner_positions)return fail('SIGNED_FULL_CORNERS_MISSING',{horse_no:no,index});
     }
     enriched.push(run);
     selectedRuns.push({horse_no:no,run_id:verified.run_id,
       horse_id:verified.horse_id,source_ref:archive.source_ref,
       original_sha256:doc.body_sha256,original_bytes_verified:true,
       verified_before_post:true});
   }
   trustedRows.push({...row,past_runs:enriched});
 }
 if(used.size!==total)return fail('SIGNED_HISTORY_COUNT_MISMATCH');
 let generated;
 try{
   generated=generateResearchSourcePoints({
     context:{...context,runner_history:trustedRows},
     selectedRuns,policy
   });
 }catch(e){
   return fail('SOURCE_POINT_GENERATOR_REJECTED',{detail:String(e?.message??e)});
 }
 return {
   ok:true,reason:'SIGNED_V11_SOURCE_TO_SYNTHETIC_RESEARCH_POINTS_ONLY',
   issuer_scope:proof.scope,source_status:proof.status,
   verified_history_slots:proof.accepted.length,
   bound_factors:bindings.bindings.length,
   generated,formal_scoring_allowed:false,
   official_score_approved:false,production_allowed:false,
   real_original_reader_connected:false,
   // A valid synthetic fixture is NEVER authenticated JRA production data.
   actual_official_original_authenticated:false
 };
}
