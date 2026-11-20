import test from "node:test";
import assert from "node:assert/strict";
import {auditLocal16PreFreezeBoundary as audit} from "./local16-pre-freeze-boundary-proof.mjs";

const p="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
const ref=(n,i=0)=>"COMPACT_V1.runners[horse_no="+n+"].recent_runs["+i+"]";
function caseData(){
 const race={race_date:"2026-11-19",track:"大井",race_no:4,
  post_time:"2026-11-19T07:07:00Z",
  conditions:{distance:1200,surface:"ダート"}};
 const verifiedRunners=Array.from({length:7},(_,i)=>({
  horse_no:i+1,horse_name:"SYNTHETIC_"+(i+1),
  recent_runs:[{race_date:"2026-11-01",track:"大井",distance:1200,
   surface:"ダート",finish:i===5?2:5,margin:i===5?"0.2":"1.0"}]
 }));
 const runners=verifiedRunners.map((h,i)=>({
  horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,
  score:95-i*3,grade:"B",reason:"Test score source"
 }));
 const draft={runners,top5:runners.slice(0,5),eye:null,bets:[],
  audit:{protocol_version:p}};
 return {race,verifiedRunners,draft,observationAt:"2026-11-19T04:00:00Z"};
}
function comparison(){return{
 rank5_horse_no:5,rank6_horse_no:6,
 fifth_evidence_refs:[ref(5)],sixth_evidence_refs:[ref(6)],
 fifth_advantage_reason:"Verified additional form supports fifth against sixth",
 sixth_counter_case_reason:"Sixth had a close podium in a same-condition race",
 conclusion:"KEEP_FIFTH"
};}
test("2-4pt boundary never passes silently without both sides",()=>{
 const c=caseData(),before=structuredClone(c),x=audit(c);
 assert.equal(x.code,"NARROW_BOUNDARY_TWO_SIDED_PROOF_MISSING");
 assert.equal(x.boundary.gap,3);
 assert.equal(x.boundary.sixth_same_condition_podium_advantage,true);
 assert.equal(x.rank_changed,false);assert.equal(x.score_certified,false);
 assert.equal(x.save_authorized,false);
 assert.deepEqual(c,before);
});
test("valid two-sided references document review, not scoring certification",()=>{
 const x=audit({...caseData(),comparison:comparison()});
 assert.equal(x.status,"PROOF_DOCUMENTED_UNCERTIFIED");
 assert.equal(x.review_documented,true);
 assert.equal(x.score_certified,false);
 assert.equal(x.rank_changed,false);
});
test("cannot silently promote sixth even with documented stronger evidence",()=>{
 const c=comparison();c.conclusion="REVISE_DRAFT";
 const x=audit({...caseData(),comparison:c});
 assert.equal(x.code,"PAIR_RANK_UNRESOLVED");
 assert.equal(x.review_documented,true);assert.equal(x.rank_changed,false);
});
test("a forged cross-horse reference does not pass",()=>{
 const c=comparison();c.sixth_evidence_refs=[ref(5)];
 assert.equal(audit({...caseData(),comparison:c}).code,"PAIR_COMPARISON_UNSUPPORTED");
});
test("market rationale does not enter criterion proof",()=>{
 const c=comparison();c.fifth_advantage_reason="オッズで見るとこちらが上です";
 assert.equal(audit({...caseData(),comparison:c}).code,"PAIR_COMPARISON_UNSUPPORTED");
});
test("future history or target result is prohibited",()=>{
 let c=caseData();c.verifiedRunners[5].recent_runs[0].race_date=c.race.race_date;
 assert.equal(audit(c).code,"PAST_RUN_SOURCE_OR_ROSTER_INVALID");
 c=caseData();c.race.result={finishers:[]};
 assert.equal(audit(c).code,"PRE_RACE_OFFICIAL_CONTEXT_REQUIRED");
});
test("after post time cannot issue pre-freeze approval",()=>{
 const c=caseData();c.observationAt=c.race.post_time;
 assert.equal(audit(c).code,"PRE_RACE_OFFICIAL_CONTEXT_REQUIRED");
});
test("non-narrow comparisons do not demand a new score rubric",()=>{
 const c=caseData();
 c.draft.runners.forEach((r,i)=>r.score=95-i*7);
 c.draft.top5=c.draft.runners.slice(0,5);
 const x=audit(c);
 assert.equal(x.code,"NOT_NARROW_BOUNDARY");
 assert.equal(x.score_certified,false);assert.equal(x.save_authorized,false);
});
test("invalid score order cannot be presented as valid comparison",()=>{
 const c=caseData();c.draft.runners[5].score=99;
 assert.equal(audit(c).code,"RANK_SCORE_OR_TOP5_CONFLICT");
});
