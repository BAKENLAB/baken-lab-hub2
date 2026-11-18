import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLocal16CriterionTrace as audit} from './local16-criterion-trace-preflight.mjs';
const protocol='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013';
const horses=Array.from({length:5},(_,k)=>({horse_no:k+1,horse_name:'S'+(k+1),
 criteria:Array.from({length:13},(_,i)=>({data_state:i===11?'MISSING_INPUT':'VERIFIED_INPUT_AVAILABLE',evidence_refs:i===11?[]:['r'+k+'_'+i]})),
 transfer_review:Array.from({length:7},(_,i)=>({data_state:'VERIFIED_INPUT_AVAILABLE',evidence_refs:['t'+k+'_'+i]}))}));
const context={context_format:'COMPACT_V1',protocol_version:protocol,field_integrity_checked:true,local16_scoring_criteria:{
 status:'READY_FOR_INDEPENDENT_100_POINT_SCORING',score_computed:false,rank_effect:false,rows:horses}};
const traceRows=horses.map((h,i)=>({horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,score:90-i,
 score_reason:'Synthetic comparison of verified past results',
 criteria:h.criteria.map((c,j)=>({index:j,judgment:j===11?'MISSING':'NEUTRAL',reason:'Cited observed source material',evidence_refs:c.evidence_refs})),
 transfer_review:h.transfer_review.map((c,j)=>({index:j,judgment:'NEUTRAL',reason:'Transfer conditions checked',evidence_refs:c.evidence_refs}))}));
const draft={runners:traceRows.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,rank:h.rank,score:h.score})),
 audit:{local16_scoring_trace:{schema:'LOCAL16_SCORING_TRACE_V1',protocol_version:protocol,rows:traceRows}}};
const cp=()=>structuredClone(draft);
test('fully documented source refs do not certify independent point arithmetic',()=>{const a=audit({context,draft});assert.equal(a.ok,true);assert.equal(a.counts.judgments,100);assert.equal(a.score_certified,false);assert.equal(a.point_effect_proven,false)});
test('missing trace reported honestly',()=>{const p=cp();delete p.audit.local16_scoring_trace;assert.equal(audit({context,draft:p}).code,'NO_CRITERION_TRACE')});
test('score edited without trace update detected',()=>{const p=cp();p.runners[0].score++;assert.equal(audit({context,draft:p}).code,'SCORE_REASON_OR_IDENTITY_MISMATCH')});
test('injected unverified refs rejected',()=>{const p=cp();p.audit.local16_scoring_trace.rows[0].criteria[1].evidence_refs=['NOT_AN_OFFICIAL_REF'];assert.equal(audit({context,draft:p}).code,'UNSUPPORTED_CRITERION_JUDGMENT')});
test('favorable verdict without any source rejected',()=>{const p=cp();const a=p.audit.local16_scoring_trace.rows[0].criteria[1];a.judgment='FAVORABLE';a.evidence_refs=[];assert.equal(audit({context,draft:p}).code,'UNSUPPORTED_CRITERION_JUDGMENT')});
test('unknown source cannot be promoted to verified assessment',()=>{const p=cp();p.audit.local16_scoring_trace.rows[0].criteria[11].judgment='FAVORABLE';assert.equal(audit({context,draft:p}).code,'UNSUPPORTED_CRITERION_JUDGMENT')});
test('incomplete set rejected',()=>{const p=cp();p.audit.local16_scoring_trace.rows[0].criteria.pop();assert.equal(audit({context,draft:p}).code,'INCOMPLETE_CRITERION_TRACE')});
test('market reasons rejected',()=>{const p=cp();p.audit.local16_scoring_trace.rows[0].score_reason='オッズで上位人気なので高評価';assert.equal(audit({context,draft:p}).code,'SCORE_REASON_OR_IDENTITY_MISMATCH')});
test('no automatic score effect if official context not ready',()=>{const x=structuredClone(context);x.local16_scoring_criteria.status='NOT_READY';assert.equal(audit({context:x,draft}).status,'NOT_READY')});
