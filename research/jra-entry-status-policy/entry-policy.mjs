import {createHash} from 'node:crypto';
const copy=x=>structuredClone(x);
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export function inspectField(field){
 if(field?.race?.circuit!=='JRA')return {state:'HOLD',reason:'JRA_ONLY'};
 if(!field.complete||!Array.isArray(field.runners)||!field.runners.length)return {state:'HOLD',reason:'INCOMPLETE_FIELD'};
 const timestamp=Date.parse(field.acquired_at);
 if(!Number.isFinite(timestamp)||!/(Z|[+-]\d\d:\d\d)$/.test(field.acquired_at)||!field.source_url||!/^https:\/\/www\.jra\.go\.jp\//.test(field.source_url)||! /^[a-f0-9]{64}$/.test(field.html_sha256||''))return {state:'HOLD',reason:'MISSING_SOURCE_EVIDENCE'};
 const seen=new Set();
 for(const r of field.runners){
  if(!Number.isInteger(r.horse_no)||r.horse_no<1||!r.horse_name||seen.has(r.horse_no))return {state:'HOLD',reason:'INVALID_RUNNER_IDENTITY'};
  seen.add(r.horse_no);
  // DOM extraction and official ACTIVE semantics are not implemented here.
  if(!['ACTIVE','CANCELLED','EXCLUDED'].includes(r.entry_status)||r.status_evidence?.scope!=='CURRENT_RACE'||r.status_evidence?.verified!==true||!r.status_evidence?.locator||!r.status_evidence?.basis)return {state:'HOLD',reason:'STATUS_UNKNOWN'};
 }
 const active=field.runners.filter(r=>r.entry_status==='ACTIVE');
 if(!active.length)return {state:'HOLD',reason:'NO_ACTIVE_RUNNERS'};
 const signature=hash({race:field.race,runners:field.runners.map(({status_evidence,...r})=>r)});
 return {state:'READY_FOR_EVALUATION',signature,active:copy(active),snapshot:copy(field)};
}
export function planRace(field,{frozen=null,evaluation=null}={}){
 // Once frozen, unavailable latest evidence must never invalidate saved predictions.
 if(frozen)return {state:'FROZEN_UNCHANGED',fixed_record:copy(frozen),latest_observation:copy(field??null)};
 const inspected=inspectField(field);
 if(inspected.state==='HOLD')return inspected;
 if(!evaluation||evaluation.field_signature!==inspected.signature)return {...inspected,state:'REEVALUATE_ALL_ACTIVE'};
 return {...inspected,state:'READY_TO_FREEZE'};
}
export function createShadowFixedRecord(field,evaluation,{recorded_at}){
 const plan=planRace(field,{evaluation});
 if(plan.state!=='READY_TO_FREEZE')throw Error(plan.state+':'+(plan.reason||'FIELD_CHANGED'));
 if(!Number.isFinite(Date.parse(recorded_at))||!/(Z|[+-]\d\d:\d\d)$/.test(recorded_at)||Date.parse(recorded_at)<Date.parse(field.acquired_at))throw Error('INVALID_RECORD_TIME');
 const payload=copy(evaluation.payload);
 if(!payload?.audit||!Array.isArray(payload.runners))throw Error('PAYLOAD_REQUIRED');
 const expected=plan.active.map(r=>[r.horse_no,r.horse_name]).sort((a,b)=>a[0]-b[0]);
 const actual=payload.runners.map(r=>[r.horse_no,r.horse_name]).sort((a,b)=>a[0]-b[0]);
 if(canonical(expected)!==canonical(actual))throw Error('ACTIVE_COVERAGE_MISMATCH');
 // Separate audit envelope preserves the completed payload byte-for-byte structurally.
 return {kind:'SHADOW_ONLY_FIXED_RECORD',recorded_at,race:copy(field.race),field_signature:plan.signature,input_state_snapshot:copy(field),payload,payload_hash:hash(payload)};
}
export function planBatch(items){return items.map(x=>{try{return planRace(x.field,x.options)}catch{return {state:'HOLD',reason:'INVALID_RACE_INPUT'}}});}
