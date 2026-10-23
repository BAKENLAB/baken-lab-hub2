import test from "node:test";
import assert from "node:assert/strict";
import {auditOpponentEvidence} from "./lab-reborn-v06-rival-evidence.mjs";
const target="2026-10-18",horse="2023105825";
const valid={target_date:target,target_track:"京都",target_no:11,
  target_horse_code:horse,meeting_date:"2025-12-14",meeting_track:"阪神",meeting_no:11,
  own_finish:2,rival_finish:1,rival_horse_code:"2023101120",rival_horse:"スターアニス",
  later_date:"2026-04-12",later_track:"阪神",later_no:11,later_name:"桜花賞",
  later_class:"オープン",later_finish:1};
const clone=x=>JSON.parse(JSON.stringify(x));
test("official pretarget GI winner rival is recognized and unique",()=>{
 const x=auditOpponentEvidence([valid],target,horse);
 assert.equal(x.status,"RESEARCH_OPPONENT_EVIDENCE_READY");
 assert.equal(x.graded_future_podium_rival_count,1);
 assert.equal(x.evidence[0].later_grade,7);
 assert.equal(x.scored,false);
 assert.equal(x.production_write,false);
});
test("cannot include target-race result or following-day rival result",()=>{
 const future={...valid,later_date:"2026-10-19"};
 const sameDay={...valid,later_date:target};
 assert.equal(auditOpponentEvidence([future,sameDay],target,horse).evidence.length,0);
});
test("cannot use same-date meeting, target same-day, or reversed dates",()=>{
 const one={...valid,meeting_date:target};
 const two={...valid,meeting_date:"2026-07-01",later_date:"2026-02-20"};
 assert.equal(auditOpponentEvidence([one,two],target,horse).evidence.length,0);
});
test("same horse code only: name match alone is not identity",()=>{
 const one={...valid,target_horse_code:"2023109999"};
 assert.equal(auditOpponentEvidence([one],target,horse).evidence.length,0);
});
test("do not award credit to a past distant loss",()=>{
 const far={...valid,own_finish:9,rival_finish:1};
 assert.equal(auditOpponentEvidence([far],target,horse).evidence.length,0);
});
test("do not count the same rival twice within same shared and subsequent race",()=>{
 const x=auditOpponentEvidence([valid,clone(valid)],target,horse);
 assert.equal(x.matched_prior_followups,1);
 assert.equal(x.graded_future_podium_rival_count,1);
 assert.equal(x.skipped.duplicate,1);
});
test("two strong later finishes from one rival count one rival",()=>{
 const extra={...valid,later_date:"2026-05-24",later_track:"東京",later_no:11,
 later_name:"優駿牝馬",later_finish:2};
 const x=auditOpponentEvidence([valid,extra],target,horse);
 assert.equal(x.matched_prior_followups,2);
 assert.equal(x.graded_future_podium_rival_count,1);
});
test("unconfirmed OP grade is NOT a verified grade",()=>{
 const row={...valid,later_date:"2026-09-01",later_track:"新潟",
 later_name:"未登録オープン",later_class:"オープン"};
 const x=auditOpponentEvidence([row],target,horse);
 assert.equal(x.graded_future_podium_rival_count,0);
 assert.equal(x.open_unknown_grade_future_podium_rival_count,1);
});
test("missing fields fail closed",()=>{
 const row={...valid,later_no:null};
 assert.equal(auditOpponentEvidence([row],target,horse).evidence.length,0);
});
test("past unknown-class followups don't imply a strong G1/G2 rival",()=>{
 const row={...valid,later_class:"1勝クラス",later_name:"3歳以上1勝クラス"};
 const x=auditOpponentEvidence([row],target,horse);
 assert.equal(x.graded_future_podium_rival_count,0);
 assert.equal(x.open_unknown_grade_future_podium_rival_count,0);
});
test("base LAB ranks, odds and postrace results do not affect any evidence",()=>{
 const x=auditOpponentEvidence([valid],target,horse);
 const y=auditOpponentEvidence([{...valid,old_rank:10,win_odds:1.2,
  target_result_finish:1,lab_grade:"S"}],target,horse);
 assert.deepEqual(x,y);
});
