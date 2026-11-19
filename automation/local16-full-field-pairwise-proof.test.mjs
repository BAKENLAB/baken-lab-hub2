import test from "node:test";
import assert from "node:assert/strict";
import {auditLocal16FullFieldPairwise} from "./local16-full-field-pairwise-proof.mjs";
const protocol="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
function fixture(){
 const history=(no)=>({race_date:"2026-11-16",track:"大井",race_no:3,
  race_name:"C1 1600m",distance:1600,surface:"ダート",finish:no});
 const verifiedRunners=Array.from({length:6},(_,i)=>({
   horse_no:i+1,horse_name:"馬"+(i+1),recent_runs:i<2?[history(i+1)]:[]}));
 const evidence_refs=[
  "COMPACT_V1.runners[horse_no=1].recent_runs[0]",
  "COMPACT_V1.runners[horse_no=2].recent_runs[0]"];
 const facts={status:"VERIFIED_WHOLE_FIELD_FACTS",head_to_head:[{
  race_date:"2026-11-16",track:"大井",race_no:3,
  horse_nos:[1,2],refs:evidence_refs,finish_leader:1}]};
 const draft={runners:verifiedRunners.map((h,i)=>({
  horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,score:96-i*3})),
  audit:{protocol_version:protocol}};
 const pairwiseTrace=[{race_date:"2026-11-16",track:"大井",race_no:3,
   horse_nos:[1,2],evidence_refs,
   rank_impact:"SUPPORTS_SAVED_ORDER",
   rank_rationale:"公式の同一レース直接対戦で1番が2番に先着。ただし今回の全条件を別途比較した。"}];
 return {race:{race_date:"2026-11-20",track:"大井",race_no:10,
   post_time:"2026-11-20T15:00:00+09:00",conditions:{distance:1600}},
   verifiedRunners,facts,draft,observationAt:"2026-11-20T13:00:00+09:00",pairwiseTrace};
}
test("valid official paired source and rank rationale are documented, but scores remain uncertified",()=>{
 const r=auditLocal16FullFieldPairwise(fixture());
 assert.equal(r.status,"DOCUMENTED_UNCERTIFIED");
 assert.equal(r.covered_horses,2);
 assert.equal(r.verified_pair_count,1);
 assert.equal(r.certified_score_math,false);
 assert.equal(r.save_authorized,false);
 assert.equal(r.rank_changed,false);
});
test("available verified same-race rivals without rank linkage require review",()=>{
 const f=fixture();delete f.pairwiseTrace;
 const r=auditLocal16FullFieldPairwise(f);
 assert.equal(r.code,"RANK_LINK_NOT_DOCUMENTED");
 assert.deepEqual(r.missing_horse_nos,[1,2]);
});
test("unsupported official ref and fake pair fail closed",()=>{
 const f=fixture();f.pairwiseTrace[0].evidence_refs[1]="COMPACT_V1.runners[horse_no=3].recent_runs[0]";
 assert.equal(auditLocal16FullFieldPairwise(f).code,"PAIRWISE_TRACE_SOURCE_MISMATCH");
 const g=fixture();g.facts.head_to_head[0].horse_nos=[1,3];
 assert.equal(auditLocal16FullFieldPairwise(g).code,"UNVERIFIED_DIRECT_OPPONENT_SOURCE");
});
test("post-start, target outcomes and market-tainted explanation are rejected",()=>{
 const f=fixture();f.observationAt="2026-11-20T15:00:00+09:00";
 assert.equal(auditLocal16FullFieldPairwise(f).status,"INVALID");
 const g=fixture();g.draft.result={winner:1};
 assert.equal(auditLocal16FullFieldPairwise(g).status,"INVALID");
 const h=fixture();h.pairwiseTrace[0].rank_rationale="1番を人気が高いので選んだ。";
 assert.equal(auditLocal16FullFieldPairwise(h).status,"INVALID");
});
test("explicit contradictory pair is review-required, never auto re-ranked",()=>{
 const f=fixture();f.pairwiseTrace[0].rank_impact="COUNTER_EVIDENCE";
 const r=auditLocal16FullFieldPairwise(f);
 assert.equal(r.code,"RANK_COUNTER_EVIDENCE_NEEDS_DECISION");
 assert.equal(r.rank_changed,false);
});
test("zero official direct pairs cannot be treated as missing analysis evidence",()=>{
 const f=fixture();f.facts.head_to_head=[];
 const r=auditLocal16FullFieldPairwise(f);
 assert.equal(r.code,"NO_VERIFIED_DIRECT_PAIRS");
 assert.equal(r.verified_pair_count,0);
});
test("all official horses must retain a valid unique 100-point order",()=>{
 const f=fixture();f.draft.runners[1].rank=1;
 assert.equal(auditLocal16FullFieldPairwise(f).code,"SAVED_RANK_IDENTITY_INVALID");
});
