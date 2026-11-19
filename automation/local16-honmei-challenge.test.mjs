import test from "node:test";
import assert from "node:assert/strict";
import {auditLocal16HonmeiChallenge as audit} from "./local16-pre-freeze-boundary-proof.mjs";
const PROTOCOL="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
const ref=(n,i=0)=>"COMPACT_V1.runners[horse_no="+n+"].recent_runs["+i+"]";
const create=()=>{
 const race={race_date:"2026-11-19",track:"大井",race_no:3,
  conditions:{distance:1200,surface:"ダート"},post_time:"2026-11-19T07:07:00Z"};
 const verifiedRunners=Array.from({length:7},(_,i)=>({
  horse_no:i+1,horse_name:"SYNTHETIC_"+(i+1),
  recent_runs:[{race_date:"2026-11-01",track:"大井",distance:1200,
   finish:i===1?2:5,margin:i===1?"0.1":"1.2"}]
 }));
 const runners=verifiedRunners.map((h,i)=>({
  horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,
  score:[91,88,83,80,75,72,68][i],grade:"B",reason:"Fixture only"}));
 return {race,verifiedRunners,draft:{runners,top5:runners.slice(0,5),
   eye:null,bets:[],audit:{protocol_version:PROTOCOL}},observationAt:"2026-11-19T04:00:00Z"};
};
const proof=()=>({
 challenger_horse_no:2,conclusion:"KEEP_HONMEI",
 honmei_advantage_reason:"Recorded strength across different official runs",
 challenger_counter_case_reason:"Recent same-distance podium despite lower rank",
 honmei_evidence_refs:[ref(1)],challenger_evidence_refs:[ref(2)]
});
test("unproven rank1 against close rank2 is flagged without auto-changing it",()=>{
 const c=create(),original=structuredClone(c),r=audit(c);
 assert.equal(r.code,"HONMEI_TWO_SIDED_REVIEW_MISSING");
 assert.equal(r.scope.ace_horse_no,1);
 assert.deepEqual(r.scope.challengers.map(x=>x.horse_no),[2]);
 assert.equal(r.score_certified,false);assert.equal(r.rank_changed,false);
 assert.equal(r.save_authorized,false);assert.deepEqual(c,original);
});
test("two sided sourced explanations can document but not certify score",()=>{
 const c=create(),r=audit({...c,comparisons:[proof()]});
 assert.equal(r.status,"PROOF_DOCUMENTED_UNCERTIFIED");
 assert.equal(r.review_documented,true);assert.equal(r.score_certified,false);
});
test("changing rank1 requires independent full re-evaluation, not swap",()=>{
 const c=create(),x=proof();x.conclusion="REVISE_DRAFT";
 const r=audit({...c,comparisons:[x]});
 assert.equal(r.code,"HONMEI_RANK_UNRESOLVED");
 assert.equal(r.rank_changed,false);
});
test("cross-horse false evidence reference is rejected",()=>{
 const c=create(),x=proof();x.honmei_evidence_refs=[ref(2)];
 assert.equal(audit({...c,comparisons:[x]}).code,"HONMEI_CHALLENGE_UNSUPPORTED");
});
test("missing additional challenger review does not silently pass",()=>{
 const c=create();c.draft.runners[2].score=87;
 const r=audit({...c,comparisons:[proof()]});
 assert.equal(r.scope.challengers.length,2);
 assert.equal(r.code,"HONMEI_TWO_SIDED_REVIEW_MISSING");
});
test("same-track podium is a review trigger, never a score correction",()=>{
 const c=create();c.draft.runners[1].score=85;
 c.draft.top5=c.draft.runners.slice(0,5);
 const r=audit(c);
 assert.equal(r.code,"HONMEI_TWO_SIDED_REVIEW_MISSING");
 assert.equal(r.scope.challengers[0].reason,"ACE_LACKS_RECENT_SAME_CONDITION_PODIUM");
 assert.equal(r.score_changed,false);
});
test("target result or post-time input cannot enter review",()=>{
 const c=create();c.race.result={finishers:[{horse_no:2,finish:1}]};
 assert.equal(audit(c).status,"INVALID");
 const d=create();d.observationAt=d.race.post_time;
 assert.equal(audit(d).status,"INVALID");
});
test("unknown market references are excluded from qualitative proof",()=>{
 const c=create(),x=proof();x.honmei_advantage_reason="Market trends and recent payouts favor this horse";
 assert.equal(audit({...c,comparisons:[x]}).status,"INVALID");
});
test("clearly separated contenders produce no forced audit",()=>{
 const c=create();c.draft.runners.forEach((r,i)=>r.score=[99,89,80,77,72,68,64][i]);
 c.draft.top5=c.draft.runners.slice(0,5);
 c.verifiedRunners[1].recent_runs[0].finish=5;
 const r=audit(c);
 assert.equal(r.code,"NO_SPECIFIC_HONMEI_CHALLENGE_SIGNAL");
 assert.equal(r.save_authorized,false);
});
