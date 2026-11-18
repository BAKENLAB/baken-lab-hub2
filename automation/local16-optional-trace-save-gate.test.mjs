import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyOptionalLocal16TraceForSave as verify} from './local16-optional-trace-save-gate.mjs';
import {auditLocal16CriterionTrace as audit} from './local16-criterion-trace-preflight.mjs';
const protocol='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013';
const horses=Array.from({length:5},(_,k)=>({horse_no:k+1,horse_name:'Synthetic'+(k+1),
 criteria:Array.from({length:13},(_,i)=>({data_state:i===11?'MISSING_INPUT':'VERIFIED_INPUT_AVAILABLE',evidence_refs:i===11?[]:['ref'+k+'_'+i]})),
 transfer_review:Array.from({length:7},(_,i)=>({data_state:'VERIFIED_INPUT_AVAILABLE',evidence_refs:['tr'+k+'_'+i]}))}));
const context={field_integrity_checked:true,context_format:'COMPACT_V1',protocol_version:protocol,
 local16_scoring_criteria:{status:'READY_FOR_INDEPENDENT_100_POINT_SCORING',score_computed:false,rank_effect:false,rows:horses}};
const records=horses.map((h,i)=>({horse_no:h.horse_no,horse_name:h.horse_name,
 rank:i+1,score:90-i,score_reason:'Synthetic reason grounded in official inputs',
 criteria:h.criteria.map((c,j)=>({index:j,judgment:j===11?'MISSING':'NEUTRAL',reason:'Synthetic explanation of current facts',evidence_refs:c.evidence_refs})),
 transfer_review:h.transfer_review.map((c,j)=>({index:j,judgment:'NEUTRAL',reason:'Synthetic transfer comparison',evidence_refs:c.evidence_refs}))}));
const original={runners:records.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name,rank:x.rank,score:x.score})),
 audit:{local16_scoring_trace:{schema:'LOCAL16_SCORING_TRACE_V1',protocol_version:protocol,rows:records}}};
const cp=()=>structuredClone(original);
const run=(payload=cp(),officialContext=context)=>verify({protocolVersion:protocol,payload,officialContext,auditTrace:audit});
test('real trace audit accepted, never certifies scoring',()=>{
 const r=run();assert.equal(r.status,'PRESENT_SOURCE_VALIDATED');assert.equal(r.documented_horses,5);
 assert.equal(r.documented_judgments,100);assert.equal(r.score_certified,false);assert.equal(r.point_effect_proven,false);
});
test('legacy save payload without trace remains available even when context unavailable',()=>{
 assert.equal(run({runners:original.runners,audit:{}},null).status,'NOT_PROVIDED');
});
test('missing valid claim context rejects only optional trace',()=>{
 assert.throws(()=>run(cp(),null),/LOCAL_16_TRACE_CONTEXT_UNAVAILABLE/);
});
test('wrong protocol rejects optional trace',()=>{
 assert.throws(()=>verify({protocolVersion:'UNAPPROVED',payload:cp(),officialContext:context,auditTrace:audit}),/LOCAL_16_TRACE_PROTOCOL_MISMATCH/);
});
test('different score from trace is rejected',()=>{
 const p=cp();p.runners[0].score=50;assert.throws(()=>run(p),/LOCAL_16_TRACE_INVALID/);
});
test('invented favorable source is rejected',()=>{
 const p=cp();p.audit.local16_scoring_trace.rows[0].criteria[0].evidence_refs=['invalid'];
 assert.throws(()=>run(p),/LOCAL_16_TRACE_INVALID/);
});
test('missing criterion silently omitted is rejected',()=>{
 const p=cp();p.audit.local16_scoring_trace.rows[0].criteria.pop();
 assert.throws(()=>run(p),/LOCAL_16_TRACE_INVALID/);
});
test('overlong trace rejected before parsing or saving',()=>{
 const p=cp();p.audit.local16_scoring_trace.comment='x'.repeat(200000);
 assert.throws(()=>run(p),/LOCAL_16_TRACE_INVALID/);
});