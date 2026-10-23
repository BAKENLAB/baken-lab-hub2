import test from "node:test";
import assert from "node:assert/strict";
import {reviewJraV04Boundary} from "./boundary-review-v04.mjs";

const base=[1,2,3,4,5,6,7].map(n=>({horse_no:n,horse_name:"馬"+n,rank:n}));
const ledger={status:"READY",target_race_date:"2026-10-18",
 runners:base.map(x=>({
 horse_no:x.horse_no,horse_name:x.horse_name,prior_history_count:2,
 competitive_near_condition_runs:x.rank===7?2:x.rank===5?1:0,
 verified_fast3f_runs:x.rank===7?1:0,
 distinct_rivals_with_followups:x.rank===7?1:0,
 facts:[{text:"確認済みの過去走"}],caveats:[]
 }))
};
test("flags difference but never ranks a horse",()=>{
 const x=reviewJraV04Boundary(base,ledger);
 assert.equal(x.status,"REVIEW_READY");
 assert.equal(x.rank_effect,false);
 assert.equal(x.approval_to_save,false);
 assert.equal(x.comparison.length,2);
 assert.equal(x.comparison[1].assessment,"REVIEW_DIFFERENT_POSITIVE");
 assert.equal(x.comparison[1].candidate.original_rank,7);
});
test("if evidence missing baseline review does not stop",()=>{
 const x=reviewJraV04Boundary(base,{...ledger,runners:ledger.runners.map(r=>
 r.horse_no===6?{...r,prior_history_count:0}:r)});
 assert.equal(x.comparison[0].assessment,"HISTORY_ABSENT");
 assert.equal(x.rank_effect,false);
});
test("no misleading recommendation on relative positive support",()=>{
 const x=reviewJraV04Boundary(base,ledger);
 assert.equal(x.comparison[1].direction,"COMPARE_ALL_RUNNERS; DO_NOT_AUTO_SWAP");
});
test("missing packet yields safe no-op",()=>{
 const x=reviewJraV04Boundary(base,null);
 assert.equal(x.status,"MISSING_INPUT");
 assert.equal(x.approval_to_save,false);
});
test("horse identity mismatch blocks comparison only",()=>{
 const x=reviewJraV04Boundary(base,{...ledger,runners:ledger.runners.map(r=>
 r.horse_no===1?{...r,horse_name:"WRONG"}:r)});
 assert.equal(x.status,"FIELD_OR_IDENTITY_MISMATCH");
});
test("no data means no fabricated benefit",()=>{
 const x=reviewJraV04Boundary(base,{...ledger,runners:ledger.runners.map(r=>({
 ...r,competitive_near_condition_runs:0,verified_fast3f_runs:0,
 distinct_rivals_with_followups:0
 }))});
 assert.ok(x.comparison.every(r=>r.assessment==="NO_SUPPORTED_POSITIVE"));
});
test("baselines with noncontiguous rank numbers are invalid",()=>{
 const x=reviewJraV04Boundary(base.map(x=>x.horse_no===7?{...x,rank:9}:x),ledger);
 assert.equal(x.status,"INVALID_BASE");
});
test("a tiny race with no rank6 remains a valid review",()=>{
 const x=reviewJraV04Boundary(base.slice(0,5),{...ledger,runners:ledger.runners.slice(0,5)});
 assert.equal(x.status,"REVIEW_READY");
 assert.equal(x.comparison.length,0);
});
