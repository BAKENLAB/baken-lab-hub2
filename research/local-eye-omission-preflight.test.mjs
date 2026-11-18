import test from "node:test";
import assert from "node:assert/strict";
import {auditLocalEyeOmissions} from "../automation/local-eye-omission-preflight.mjs";
const r=(n,i=0)=>"COMPACT_V1.runners[horse_no="+n+"].recent_runs["+i+"]";
function fixture(){
 const race={race_date:"2026-11-18",track:"笠松",race_no:9,
 post_time:"2026-11-18T05:35:00Z",conditions:{surface:"ダート",distance:1400}};
 const verifiedRunners=Array.from({length:8},(_,i)=>({horse_no:i+1,horse_name:"馬"+(i+1),
 recent_runs:[{race_date:"2026-11-02",track:"笠松",distance:1400,finish:i===5?2:6,
 going:"不良",margin:"2.9",final3f:"40.0"}]}));
 const ranked=[1,2,3,4,5,7,6,8].map((n,i)=>({horse_no:n,horse_name:"馬"+n,rank:i+1}));
 const outsiders=ranked.filter(x=>x.rank>5);
 const payload={runners:ranked,eye:null,top5:ranked.slice(0,5),bets:[],
 audit:{eye_candidate_audit:outsiders.map(x=>({horse_no:x.horse_no,
 review_checks:{same_condition_history:{status:"CHECKED",evidence_refs:[r(x.horse_no)]}}})),
 eye_positive_factor_audit:outsiders.map(x=>({horse_no:x.horse_no,positive_factors:[]}))}};
 return {race,verifiedRunners,payload,observationAt:"2026-11-18T05:00:00Z"};
}
test("realistic 11/18 Kasamatsu 9R runner with recent same-course 2nd and zero positives requires review",()=>{
 const f=fixture(),before=structuredClone(f);
 const x=auditLocalEyeOmissions(f);
 assert.equal(x.status,"REVIEW_REQUIRED");
 assert.equal(x.missing_count,1);
 assert.equal(x.missing[0].horse_no,6);
 assert.equal(x.missing[0].evidence_ref,r(6));
 assert.equal(x.rank_effect,false);
 assert.equal(x.eye_effect,false);
 assert.deepEqual(f,before);
});
test("real run cited by independent positive factor is accounted for without auto promotion",()=>{
 const f=fixture(),p=f.payload.audit.eye_positive_factor_audit.find(x=>x.horse_no===6);
 p.positive_factors=[{category:"same_condition_history",current_relevance:true,evidence_refs:[r(6)]}];
 const x=auditLocalEyeOmissions(f);
 assert.equal(x.status,"READY");assert.equal(x.covered.length,1);
 assert.equal(f.payload.eye,null);
});
test("reasoned individual review may decline positivity but retains acknowledged evidence",()=>{
 const f=fixture();
 f.payload.audit.eye_coverage_reviewed_runs=[{horse_no:6,evidence_ref:r(6),
 decision:"NOT_CURRENT_POSITIVE",reason_code:"CLASS_OR_OPPONENT_UNVERIFIED",
 reason:"前走の相手級が今回より低く、直近2着だけでは今回の独立肯定因子にできない"}];
 const x=auditLocalEyeOmissions(f);
 assert.equal(x.ok,true);assert.equal(x.acknowledged.length,1);
 assert.equal(f.payload.audit.eye_positive_factor_audit.find(x=>x.horse_no===6).positive_factors.length,0);
});
test("same single race cannot be relabeled as two independent positive factors",()=>{
 const f=fixture(),p=f.payload.audit.eye_positive_factor_audit.find(x=>x.horse_no===6);
 p.positive_factors=[
  {category:"same_condition_history",current_relevance:true,evidence_refs:[r(6)]},
  {category:"current_suitability",current_relevance:true,evidence_refs:[r(6)]}
 ];
 const x=auditLocalEyeOmissions(f);
 assert.equal(x.code,"EYE_FACTOR_SHARED_SINGLE_RUN_NOT_INDEPENDENT");
});
test("different official runs can support distinct categories; no automatic EYE",()=>{
 const f=fixture(),h=f.verifiedRunners[5],p=f.payload.audit.eye_positive_factor_audit.find(x=>x.horse_no===6);
 h.recent_runs.push({race_date:"2026-10-23",track:"笠松",distance:1400,finish:3,surface:"ダート"});
 p.positive_factors=[
  {category:"same_condition_history",current_relevance:true,evidence_refs:[r(6)]},
  {category:"current_suitability",current_relevance:true,evidence_refs:[r(6,1)]}
 ];
 const x=auditLocalEyeOmissions(f);
 assert.equal(x.status,"READY");assert.equal(x.covered.length,2);
 assert.equal(f.payload.eye,null);
});
test("single recent 820m podium is not a same-condition podium for 1400m",()=>{
 const f=fixture();f.verifiedRunners[5].recent_runs[0].distance=820;
 const x=auditLocalEyeOmissions(f);assert.equal(x.status,"READY");assert.equal(x.missing_count,0);
});
test("old podium beyond 90 days is not an automatic current alert",()=>{
 const f=fixture();f.verifiedRunners[5].recent_runs[0].race_date="2026-03-12";
 const x=auditLocalEyeOmissions(f);assert.equal(x.status,"READY");
});
test("surface explicitly opposite target never counts as same-condition",()=>{
 const f=fixture();f.verifiedRunners[5].recent_runs[0].surface="芝";
 const x=auditLocalEyeOmissions(f);assert.equal(x.status,"READY");
});
test("missing historical surface is a review gap, never proof of matching surface",()=>{
 const x=auditLocalEyeOmissions(fixture());assert.equal(x.missing[0].surface_verified,false);
 assert.equal(x.unverified_surface_count,1);
});
test("same race date as target cannot enter pre-race history",()=>{
 const f=fixture();f.verifiedRunners[5].recent_runs[0].race_date="2026-11-18";
 const x=auditLocalEyeOmissions(f);assert.equal(x.code,"HISTORY_NOT_PRE_RACE");
});
test("post-start observation fails closed",()=>{
 const f=fixture();f.observationAt="2026-11-18T05:35:00Z";
 const x=auditLocalEyeOmissions(f);assert.equal(x.code,"VERIFIED_PRE_RACE_CONTEXT_REQUIRED");
});
test("race/result contamination fails closed",()=>{
 const f=fixture();f.race.result={finishers:[]};
 assert.equal(auditLocalEyeOmissions(f).code,"TARGET_RESULT_CONTAMINATION");
});
test("a fabricated evidence_ref is rejected",()=>{
 const f=fixture();f.payload.audit.eye_positive_factor_audit.find(x=>x.horse_no===6)
 .positive_factors=[{category:"current_suitability",current_relevance:true,
 evidence_refs:["COMPACT_V1.runners[horse_no=6].recent_runs[99]"]}];
 assert.equal(auditLocalEyeOmissions(f).code,"EYE_FACTOR_UNVERIFIED_REFERENCE");
});
test("no silently accepted generic avoidance without concrete reason",()=>{
 const f=fixture();f.payload.audit.eye_coverage_reviewed_runs=[{horse_no:6,
 evidence_ref:r(6),decision:"NOT_CURRENT_POSITIVE",reason_code:"CLASS_OR_OPPONENT_UNVERIFIED",reason:"不明"}];
 assert.equal(auditLocalEyeOmissions(f).code,"EYE_OMISSION_EXPLANATION_INVALID");
});
test("orphan review cannot blindly acknowledge unrelated run",()=>{
 const f=fixture();
 f.payload.audit.eye_coverage_reviewed_runs=[{horse_no:7,evidence_ref:r(7),
 decision:"NOT_CURRENT_POSITIVE",reason_code:"CURRENT_FORM_NEGATIVE",
 reason:"直近6着で上位の適性を示す証拠は確認できていない"}];
 assert.equal(auditLocalEyeOmissions(f).code,"EYE_REVIEW_REFERENCE_NOT_APPLICABLE");
});
test("no odds, results, ranking changes or FROZEN modification",()=>{
 const f=fixture(),before=structuredClone(f);
 const x=auditLocalEyeOmissions(f);
 assert.equal(x.results_used,false);assert.equal(x.market_used,false);
 assert.equal(x.frozen_effect,false);
 assert.deepEqual(f,before);
});
