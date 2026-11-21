// Pure offline factor binding over the reused V11 signed evidence contract.
// Does not read a DB, grant authority, CLAIM, fetch HTML or generate points.
import {safeVerifyEvidence} from './contract.mjs';
import {canonical,sha} from './primitives.mjs';
const requirements=Object.freeze({
 margin:['finish','margin_to_winner'],corners:['corner_positions[0]'],last3f:['final3f'],
 distance:['surface','distance'],course:['surface','track'],rest:['race_date'],
 class:['class_name'],going:['going'],pace:['halon_times'],
 eval:['UNCONNECTED_EVAL_ARCHIVE'],opponent:['UNCONNECTED_OPPONENT_COHORT'],race_shape:['UNCONNECTED_FULL_FIELD_MODEL']
});
const slot=ref=>{
 if(typeof ref!=='string')return null;
 let m=ref.match(/^JRA_CLAIMED_CONTEXT\.runner_history\[horse_no=(\d+)\]\.past_runs\[(\d+)\]$/);
 if(!m)m=ref.match(/^CLAIMED_CONTEXT_RUN:(\d+):(\d+)$/);
 return m?{horse_no:Number(m[1]),context_prior_index:Number(m[2])}:null;
};
export function resolveFactorEvidence(packet,{trust,components=[]}={}){
 const proof=safeVerifyEvidence(packet,trust??{});
 const base={schema:'JRA_FACTOR_EVIDENCE_V1',context_sha256:proof.context_sha256??null,
  contract_status:proof.status,scope:proof.scope??null,accepted_histories:proof.accepted?.length??0,
  real_verified_histories:proof.real_verified_histories??0,bindings:[],errors:[],production_allowed:false};
 if(!proof.accepted?.length)return {...base,status:'UNRESOLVED',errors:[proof.code??proof.status]};
 try{
  if(!Array.isArray(components)||!components.length)throw Error('NO_FACTOR_REQUIREMENTS');
  const bound=new Set();
  for(const c of components){
   const key=canonical([c.horse_no,c.kind,c.source_ref]);
   if(bound.has(key))throw Error('DUPLICATE_FACTOR_ROOT');bound.add(key);
   const where=slot(c.source_ref),required=requirements[c.kind];
   if(!where||where.horse_no!==c.horse_no||!required)throw Error('FACTOR_REFERENCE_UNBOUND');
   const accepted=proof.accepted.filter(x=>x.horse_no===where.horse_no&&x.context_prior_index===where.context_prior_index);
   if(accepted.length!==1)throw Error('EXACT_SELECTED_HISTORY_UNAVAILABLE');
   const a=accepted[0],entry=packet.envelope.entries.find(x=>x.horse_no===where.horse_no&&x.context_prior_index===where.context_prior_index);
   const d=entry.document,parser=trust.extractors[d.extractor_id];
   // Contract already authenticated bytes, pinned extractor and identities. Extract again
   // solely to bind contextual race fields not emitted by the numeric V11 fact projection.
   const raw=parser.extract(Buffer.from(packet.bodies[d.body_sha256]));
   const facts=[...a.facts];
   for(const name of ['race_date','track','surface','distance']){
    if(raw.race?.[name]===entry.archive[name]&&raw.race[name]!==null&&raw.race[name]!==undefined)
     facts.push({measurement:name,value:raw.race[name],run_id:a.run_id,race_id:a.race_id,horse_id:a.horse_id,body_sha256:d.body_sha256,observed_at:d.fetched_at});
   }
   // class, going, laps remain unavailable unless independently emitted by a future
   // approved extractor/contract. Never take them from an archive row alone.
   const selected=required.map(name=>facts.find(f=>f.measurement===name));
   if(selected.some(f=>!f))throw Error('FACTOR_MEASUREMENT_UNCONNECTED:'+c.kind);
   base.bindings.push({horse_no:c.horse_no,kind:c.kind,source_ref:c.source_ref,
    run_id:a.run_id,race_id:a.race_id,horse_id:a.horse_id,body_sha256:d.body_sha256,
    fetched_at:d.fetched_at,extractor_id:d.extractor_id,measurements:selected});
  }
  // Synthetic signatures validate the contract only. They are never production proof.
  return {...base,status:proof.scope==='FUTURE'?'RESEARCH_VERIFIED':'SYNTHETIC_ONLY',
   evidence_sha256:sha(canonical(base.bindings)),provenance_verified:proof.scope==='FUTURE'};
 }catch(e){return {...base,status:'UNRESOLVED',bindings:[],errors:[e.message],provenance_verified:false};}
}
