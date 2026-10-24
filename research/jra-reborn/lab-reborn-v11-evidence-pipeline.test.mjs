import test from "node:test";
import assert from "node:assert/strict";
import {rebuildRebornEvidencePipeline} from "./lab-reborn-v11-evidence-pipeline.mjs";
const packet={
 race_date:"2026-10-24",track:"東京",race_no:10,
 saved_at:"2026-10-24T03:21:47Z",source_post_time:"2026-10-24T06:01:00Z",
 payload:{field_size:6,surface:"ダート",distance:1600,class_name:"1勝クラス",
  runners:Array.from({length:6},(_,i)=>({
   horse_no:i+1,horse_name:"TEST"+i,
   horse_code:String(2020102703+i),
   history:[{race_date:"2026-05-10",track:"東京",surface:"ダート",
    distance:1600,finish:2,race_class:"1勝クラス",
    margin_to_winner:0.2,corner_positions:[4,4]}]
  }))
 }
};
const rival={target_date:"2026-10-24",target_track:"東京",target_no:10,
 target_horse_code:"2020102703",
 meeting_date:"2026-05-10",meeting_track:"東京",meeting_no:12,
 own_finish:2,rival_horse:"RIVAL",rival_horse_code:"2019102143",rival_finish:2,
 later_date:"2026-06-13",later_track:"東京",later_no:10,
 later_name:"夏至ステークス",later_class:"3勝クラス",later_finish:3};
test("ONE bridge connects history and opponent source without claiming prediction",()=>{
 const r=rebuildRebornEvidencePipeline(packet,{priorOpponentRows:[rival]});
 assert.equal(r.status,"PARTIAL_UNIFIED_EVIDENCE_READY_NOT_SCORED_MODEL");
 assert.equal(r.runner_count,6);
 assert.equal(r.source_coverage.rival_context_runners,1);
 assert.equal(r.full_reborn_ready,false);
 assert.equal(r.can_compare_as_full_reborn,false);
 assert.equal(r.production_write,false);
});
test("no rank may be frozen using incomplete opponent grade",()=>{
 const r=rebuildRebornEvidencePipeline(packet,{priorOpponentRows:[rival]});
 assert.equal(r.score_or_rank_persisted,false);
 assert.equal(r.source_coverage.verified_graded_rival_runners,0);
});
test("foreign target rival evidence rejects entire field",()=>{
 const r=rebuildRebornEvidencePipeline(packet,{priorOpponentRows:[{...rival,target_no:11}]});
 assert.equal(r.status,"EVIDENCE_PIPELINE_REJECTED");
});
test("no after-off source record",()=>{
 const r=rebuildRebornEvidencePipeline({...packet,saved_at:"2026-10-24T07:01:00Z"});
 assert.equal(r.status,"EVIDENCE_PIPELINE_REJECTED");
});
test("historical future-to-target cannot enter",()=>{
 const p=JSON.parse(JSON.stringify(packet));
 p.payload.runners[0].history[0].race_date="2026-10-25";
 assert.equal(rebuildRebornEvidencePipeline(p).status,"EVIDENCE_PIPELINE_REJECTED");
});
test("odds, prior old rank, actual target result ignored",()=>{
 const a=rebuildRebornEvidencePipeline(packet,{priorOpponentRows:[rival]});
 const b=rebuildRebornEvidencePipeline({...packet,old_rank:1,
  odds:1.01,actual_result:{winner:1}},{priorOpponentRows:[rival]});
 assert.deepEqual(a,b);
});
