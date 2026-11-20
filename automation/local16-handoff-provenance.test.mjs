import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLocal16HandoffProvenance as audit} from '../supabase/functions/local-claimed-mcp/local16-handoff-provenance.mjs';
const live=(count=2)=>({field_integrity_checked:true,runners:[{horse_no:1}],
 official_corner_shadow:{status:"DESCRIPTIVE_SHADOW_ONLY",
  verified_corner_sources:Array.from({length:count},(_,i)=>({past:"prior"+i}))},
 official_opponent_followup:{followup_count:5},
 local16_scoring_criteria:{status:"READY_FOR_INDEPENDENT_100_POINT_SCORING"}});
const saved=(corners)=>({audit:{official_past_content_audit:{verified_corner_runs:corners}}});
test("recorded source with no FROZEN provenance must flag missing handoff, not score use",()=>{
 const r=audit({context:live(3),draft:saved(0)});
 assert.equal(r.status,"SOURCE_PRESENT_AUDIT_NOT_RECORDED");
 assert.equal(r.source_corner_count,3);
 assert.equal(r.saved_corner_count,0);
 assert.equal(r.review_required,true);
 assert.equal(r.numeric_score_certified,false);
 assert.equal(r.evidence_used_for_rank_certified,false);
});
test("absent numeric audit also flags, never infer source was used",()=>{
 assert.equal(audit({context:live(5),draft:{audit:{}}}).status,"SOURCE_PRESENT_AUDIT_NOT_RECORDED");
});
test("recorded source count is only an observation, not proof of points",()=>{
 const r=audit({context:live(5),draft:saved(2)});
 assert.equal(r.status,"SOURCE_RECORDED_EFFECT_UNCERTIFIED");
 assert.equal(r.review_required,false);
 assert.equal(r.numeric_score_certified,false);
});
test("unavailable live context must not claim that no source existed",()=>{
 const r=audit({context:null,draft:saved(3)});
 assert.equal(r.status,"CONTEXT_UNVERIFIED");
 assert.equal(r.review_required,true);
});
test("an old FROZEN audit without reconfirmed source is not auto-certified",()=>{
 const r=audit({context:live(0),draft:saved(3)});
 assert.equal(r.status,"AUDIT_SOURCE_NOT_RECONFIRMED");
 assert.equal(r.review_required,true);
});
test("no claimed source and no saved audit is a distinct non-positive state",()=>{
 const r=audit({context:live(0),draft:saved(0)});
 assert.equal(r.status,"NO_PRECLAIM_CORNER_EVIDENCE_IN_CONTEXT");
 assert.equal(r.source_corner_count,0);
 assert.equal(r.followup_source_count,5);
 assert.equal(r.review_required,true);
});
test("optional criterion trace never certifies arithmetic by self-labeling",()=>{
 const draft={...saved(1),audit:{...saved(1).audit,local16_scoring_trace:{score_certified:true}}};
 const r=audit({context:live(2),draft});
 assert.equal(r.criterion_trace_status,"PRESENT_UNCERTIFIED");
 assert.equal(r.numeric_score_certified,false);
});
test("all operational safety flags are false even on alert",()=>{
 const r=audit({context:live(2),draft:saved(0)});
 for(const k of ["automatic_rank_effect","rank_changed","eye_changed","frozen_modified",
 "save_authorized","market_used","target_result_used"])assert.equal(r[k],false,k);
});
