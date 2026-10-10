import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorksheet,createOutsideAuditSlots,validateCompleted,CHECKS,VERSION} from './template.mjs';
import {assertLocalSaveDuringTransition} from './baseline/mcp-v9/local-eye.mjs';

// SYNTHETIC ONLY: these names, facts, flags and refs are not official evidence.
function fixture() {
  const context={context_format:'COMPACT_V1',protocol_version:VERSION,field_integrity_checked:true,
    runners:Array.from({length:9},(_,i)=>({horse_no:i+1,horse_name:'TEST_ONLY_'+(i+1),running_style_reference:['?'],missing_items:['draw']}))};
  const p=createWorksheet(context);
  p.runners.forEach((r,i)=>Object.assign(r,{rank:i+1,grade:'C',reason:'SYNTHETIC_REASON_'+r.horse_no}));
  p.top5=structuredClone(p.runners.slice(0,5));
  Object.assign(p.audit,createOutsideAuditSlots(p));
  const a=p.audit;
  a.runner_evidence_audit.forEach(e=>Object.assign(e,{recent_runs_checked:true,
    evidence_summary:'SYNTHETIC_SUMMARY_'+e.horse_no,
    evidence_facts:['SYNTHETIC_DISTANCE_'+e.horse_no,'SYNTHETIC_MARGIN_'+e.horse_no]}));
  a.eye_candidate_audit.forEach(c=>{
    const ref='test-only://horse/'+c.horse_no;
    Object.assign(c,{upside_trigger:'TEST_ONLY_NO_CURRENT_TRIGGER_'+c.horse_no,
      hidden_evidence:'TEST_ONLY_MARGIN_'+c.horse_no,finish_path:'TEST_ONLY_UNCONFIRMED_PATH_'+c.horse_no,
      risk:'TEST_ONLY_DISTANCE_RISK_'+c.horse_no,evidence_refs:[ref]});
    for(const k of CHECKS)c.review_checks[k]={status:'MISSING',finding:'TEST_ONLY_UNAVAILABLE_'+k,evidence_refs:[]};
    c.review_checks.margins={status:'CHECKED',finding:'TEST_ONLY_MARGIN_FACT',evidence_refs:[ref]};
  });
  a.eye_pairwise_comparison.forEach(pair=>Object.assign(pair,{reason:'TEST_ONLY_NO_UNIQUE_UPSIDE_'+pair.horse_nos.join('_')}));
  Object.assign(a,{all_runners_checked:true,field_integrity_checked:true,
    outside_top5_reaudited:true,eye_audit_specificity_guard:true,
    eye_abstention_reason:'TEST_ONLY_NO_UNIQUE_CURRENT_UPSIDE'});
  p.summary='TEST_ONLY_OFFLINE_FORMAT_FIXTURE';
  return {p,context};
}
test('worksheet is incomplete and not save ready',()=>{
  const {context}=fixture();const p=createWorksheet(context);
  assert.equal(p.audit.all_runners_checked,false);
  assert.equal(p.audit.field_integrity_checked,false);
  assert.throws(()=>validateCompleted(p,context));
});
test('four outside candidates, 68 check slots and six unordered pairs',()=>{
  const {p}=fixture();assert.equal(p.audit.eye_candidate_audit.length,4);
  assert.equal(p.audit.eye_candidate_audit.flatMap(c=>Object.keys(c.review_checks)).length,68);
  assert.equal(p.audit.eye_pairwise_comparison.length,6);
});
test('synthetic null EYE passes actual deployed validator and offline checks',()=>{
  const {p,context}=fixture();const out=validateCompleted(p,context);
  assert.equal(out.production_save_verified,false);
  assert.equal(out.normalized_payload.eye,null);
  assertLocalSaveDuringTransition({circuit:'LOCAL',protocol_version:VERSION,payload:out.normalized_payload});
});
test('normalization does not mutate caller, ranks, grades, TOP5 or reasons',()=>{
  const {p,context}=fixture(),before=structuredClone(p);const out=validateCompleted(p,context);
  assert.deepEqual(p,before);assert.deepEqual(out.normalized_payload.runners,p.runners);
  assert.deepEqual(out.normalized_payload.top5,p.top5);
  assert.ok(out.normalized_payload.audit.eye_pairwise_comparison.every(x=>x.evidence_refs.length===2));
});
test('unreviewed check rejected',()=>{const {p,context}=fixture();p.audit.eye_candidate_audit[0].review_checks.draw.status='UNREVIEWED';assert.throws(()=>validateCompleted(p,context),/CHECK_STATUS/);});
test('CHECKED without evidence rejected',()=>{const {p,context}=fixture();p.audit.eye_candidate_audit[0].review_checks.draw.status='CHECKED';assert.throws(()=>validateCompleted(p,context),/CHECK_EVIDENCE/);});
test('MISSING with invented evidence rejected',()=>{const {p,context}=fixture();p.audit.eye_candidate_audit[0].review_checks.draw.evidence_refs=['test-only://invented'];assert.throws(()=>validateCompleted(p,context),/MISSING_INVENTED/);});
test('missing whole pair rejected',()=>{const {p,context}=fixture();p.audit.eye_pairwise_comparison.pop();assert.throws(()=>validateCompleted(p,context),/PAIR_COVERAGE/);});
test('duplicate pair rejected',()=>{const {p,context}=fixture();p.audit.eye_pairwise_comparison[1]=structuredClone(p.audit.eye_pairwise_comparison[0]);assert.throws(()=>validateCompleted(p,context),/PAIR_DUPLICATE/);});
test('null EYE without abstention reason rejected',()=>{const {p,context}=fixture();p.audit.eye_abstention_reason=null;assert.throws(()=>validateCompleted(p,context),/ABSTENTION/);});
test('market evidence rejected by actual validator',()=>{const {p,context}=fixture();p.audit.eye_candidate_audit[0].hidden_evidence='人気が低い';assert.throws(()=>validateCompleted(p,context),/MARKET_EVIDENCE/);});
test('runner audit not performed rejected',()=>{const {p,context}=fixture();p.audit.runner_evidence_audit[0].recent_runs_checked=false;assert.throws(()=>validateCompleted(p,context),/INCOMPLETE_RUNNER_EVIDENCE/);});
test('field flag cannot overcome unverified context',()=>{const {p,context}=fixture();context.field_integrity_checked=false;assert.throws(()=>validateCompleted(p,context),/CONTEXT_FIELD_UNVERIFIED/);});
test('TOP5 reason mismatch rejected',()=>{const {p,context}=fixture();p.top5[0].reason='CHANGED';assert.throws(()=>validateCompleted(p,context),/TOP5_CONTENT_MISMATCH/);});
test('context derived style cannot be guessed',()=>{const {p,context}=fixture();p.runners[0].running_style_reference=['逃'];assert.throws(()=>validateCompleted(p,context),/RUNNER_CONTEXT_MISMATCH/);});
test('nonempty bets rejected',()=>{const {p,context}=fixture();p.bets=[{}];assert.throws(()=>validateCompleted(p,context),/BET_CONTRACT/);});
test('extra payload key rejected',()=>{const {p,context}=fixture();p.score=123;assert.throws(()=>validateCompleted(p,context),/PAYLOAD_KEYS/);});
test('synthetic unique supported EYE accepted; conflicting null EYE rejected',()=>{
  const {p,context}=fixture();const c=p.audit.eye_candidate_audit[0];c.eye_case=true;
  for(const pair of p.audit.eye_pairwise_comparison)if(pair.horse_nos.includes(c.horse_no))pair.preferred_horse_no=c.horse_no;
  p.eye={horse_no:c.horse_no,horse_name:p.runners[5].horse_name,rank:6,reason:'TEST_ONLY_TWO_CURRENT_SIGNALS'};
  p.audit.eye_selected_rank=6;
  assert.equal(validateCompleted(p,context).format_valid,true);
  p.eye=null;p.audit.eye_selected_rank=null;assert.throws(()=>validateCompleted(p,context),/SELECTION_MISMATCH/);
});
