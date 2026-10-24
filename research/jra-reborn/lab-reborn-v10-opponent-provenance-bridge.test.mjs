import test from "node:test";
import assert from "node:assert/strict";
import {auditFrozenFieldOpponents} from "./lab-reborn-v10-opponent-provenance-bridge.mjs";
const packet={
 race_date:"2026-10-24",track:"東京",race_no:10,
 saved_at:"2026-10-24T03:21:47Z",source_post_time:"2026-10-24T06:01:00Z",
 payload:{field_size:6,runners:Array.from({length:6},(_,i)=>({
  horse_no:i+1,horse_name:"HORSE"+i,
  horse_code:String(2020102703+i),history:[{race_date:"2026-05-10"}]
 }))}
};
const row={target_date:"2026-10-24",target_track:"東京",target_no:10,
 target_horse_code:"2020102703",meeting_date:"2026-05-10",
 meeting_track:"東京",meeting_no:12,own_finish:4,
 rival_horse:"RIVAL",rival_horse_code:"2019102143",rival_finish:5,
 later_date:"2026-06-13",later_track:"東京",later_no:10,
 later_name:"夏至ステークス",later_class:"3勝クラス",later_finish:3};
test("same historical meeting and later pre-target podium can be audited",()=>{
 const a=auditFrozenFieldOpponents(packet,[row]);
 assert.equal(a.status,"ASOF_OPPONENT_EVIDENCE_AUDIT_NOT_SCORE");
 assert.equal(a.total_accepted,1);
 assert.equal(a.runners_with_any_valid_context,1);
 assert.equal(a.runners_with_graded_proof,0);
 assert.equal(a.score_delta,0);
 assert.equal(a.production_write,false);
});
test("future rival results are always rejected",()=>{
 const a=auditFrozenFieldOpponents(packet,[{...row,later_date:"2026-10-25"}]);
 assert.equal(a.status,"RIVAL_BRIDGE_REJECTED");
});
test("different target/horse is not silently mixed",()=>{
 const a=auditFrozenFieldOpponents(packet,[{...row,target_horse_code:"0000000000"}]);
 assert.equal(a.reason,"MIXED_TARGET_RIVAL_PACKET");
});
test("no probability from an unverified OP registry",()=>{
 const a=auditFrozenFieldOpponents(packet,[{...row,
 later_class:"オープン",later_name:"UNVERIFIED_OP_EVENT"}]);
 assert.equal(a.runners_with_graded_proof,0);
 assert.equal(a.runners[0].ungraded_open_unknown_rivals,1);
});
test("old ranks odds or actual target result do not affect rivals",()=>{
 const a=auditFrozenFieldOpponents(packet,[row]);
 const b=auditFrozenFieldOpponents({...packet,win_odds:1.1,
  actual_result:{winner:3},old_lab_rank:1},[row]);
 assert.deepEqual(a,b);
});
test("saved-after-post packets cannot be treated as prestart",()=>{
 const a=auditFrozenFieldOpponents({...packet,saved_at:"2026-10-24T07:00:00Z"},[row]);
 assert.equal(a.status,"RIVAL_BRIDGE_REJECTED");
});
test("empty rivals stay unknown; zero accepted is not proof of weak horse",()=>{
 const a=auditFrozenFieldOpponents(packet,[]);
 assert.equal(a.status,"ASOF_OPPONENT_EVIDENCE_AUDIT_NOT_SCORE");
 assert.equal(a.runners_with_any_valid_context,0);
 assert.equal(a.runners_with_graded_proof,0);
 assert.equal(a.rank_modified,false);
});
