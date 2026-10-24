import test from "node:test";
import assert from "node:assert/strict";
import {enrichLockedRebornHistory} from "./lab-reborn-v09-eight-run-verified-bridge.mjs";

const code=i=>String(2020100000+i);
const target={
 race_date:"2026-10-24",track:"東京",race_no:10,
 saved_at:"2026-10-24T03:21:47Z",source_post_time:"2026-10-24T06:01:00Z",
 payload:{field_size:6,surface:"ダート",distance:1600,
 class_name:"3勝クラス",race_name:"錦秋ステークス",
 runners:Array.from({length:6},(_,i)=>({
  horse_no:i+1,horse_name:"TEST"+(i+1),horse_code:code(i+1),
  history:[0,1,2,3].map(j=>({
   race_date:`2026-0${9-j}-11`,track:"東京",surface:"ダート",
   distance:"1600",finish:String(j+1),race_class:"3勝クラス",
   final3f:"36.5",field_size:"12",corner_positions:[8,8],
   margin_to_winner:j===0?"0":"0.4"
  }))
 }))}
};
const archive=target.payload.runners.flatMap(h=>[
 ...h.history.map((r,j)=>({
  source:"JRA_LAB_ARCHIVE",record_role:"full_runner",
  horse_code:h.horse_code,horse_name:h.horse_name,race_no:j+1,
  race_date:r.race_date,track:r.track,surface:r.surface,
  distance:1600,finish:j+1,class_name:"3勝クラス",race_name:"VERIFIED",
  field_size:12,final3f_rank:2,corner_positions:"8 8"
 })),
 ...Array.from({length:4},(_,j)=>({
  source:"JRA_LAB_ARCHIVE",record_role:"full_runner",
  horse_code:h.horse_code,horse_name:h.horse_name,
  race_no:j+5,race_date:`2025-0${9-j}-11`,
  track:"東京",surface:"ダート",distance:1600,
  finish:j+2,class_name:"3勝クラス",race_name:"VERIFIED",
  field_size:12,final3f_rank:3,corner_positions:"8 8"
 }))
]);
const copy=x=>JSON.parse(JSON.stringify(x));
test("all six can reach strictly verified eight when independent source exists",()=>{
 const r=enrichLockedRebornHistory(target,archive);
 assert.equal(r.status,"RESEARCH_ENRICHED_SOURCE_DIAGNOSTIC");
 assert.equal(r.runner_count,6);
 assert.equal(r.strictly_eight_verified_horses,6);
 assert.equal(r.completed_eight_verified,true);
 assert.equal(r.recent_verified_total,24);
 assert.equal(r.older_attached_total,24);
 assert.equal(r.complete_model_ready,false); // no sourced rivals.
 assert.equal(r.axes_present.rival_strength,0);
});
test("locked prior missing matching archive is not silently verified",()=>{
 const r=enrichLockedRebornHistory(target,archive.filter(a=>!(
   a.horse_code===code(1)&&a.race_date==="2026-09-11"
 )));
 assert.equal(r.completed_eight_verified,false);
 assert.equal(r.strictly_eight_verified_horses,5);
 assert.equal(r.missing_live_archive_total,1);
});
test("shorter career than eight is not a missing-data failure claimed as 8",()=>{
 const p=copy(target);p.payload.runners[0].history=p.payload.runners[0].history.slice(0,1);
 const r=enrichLockedRebornHistory(p,archive);
 assert.equal(r.completed_eight_verified,false);
 assert.equal(r.runner_status[0].strict_eight_verified,false);
});
test("archived rows at or after target date fail before any scoring",()=>{
 const a=[...archive,{...archive[0],race_date:"2026-10-25"}];
 assert.equal(enrichLockedRebornHistory(target,a).status,"RESEARCH_ENRICHMENT_REJECTED");
});
test("wrong horse code or unknown candidate archive rejects",()=>{
 const a=[...archive,{...archive[0],horse_code:"0000000000"}];
 assert.equal(enrichLockedRebornHistory(target,a).status,"RESEARCH_ENRICHMENT_REJECTED");
});
test("false old LAB and target-result payload does not change evidence result",()=>{
 const clean=enrichLockedRebornHistory(target,archive);
 const dirty=enrichLockedRebornHistory({...target,actual_result:{finish:1},
  old_lab_rank:2,win_odds:1.3,popularity:1},archive);
 assert.deepEqual(clean,dirty);
});
test("mismatched live finish is not proof of archived final3f",()=>{
 const a=archive.map(r=>r.horse_code===code(1)&&r.race_date==="2026-09-11"?
   {...r,finish:8}:r);
 const report=enrichLockedRebornHistory(target,a);
 assert.equal(report.runner_status[0].verified_recent,3);
});
test("older rows must be strictly before earliest frozen dated event",()=>{
 const a=[...archive,{...archive[0],race_no:12,race_date:"2026-07-12"}];
 const r=enrichLockedRebornHistory(target,a);
 assert.equal(r.older_attached_total,24);
});
test("later rank snapshots are not forged by this enrichment",()=>{
 const r=enrichLockedRebornHistory(target,archive);
 assert.equal(r.potential_ranks_not_reported,true);
 assert.equal(r.target_results_used,false);
 assert.equal(r.production_write,false);
});
test("duplicate archive runner events fail closed",()=>{
 const a=[...archive,copy(archive[0])];
 assert.equal(enrichLockedRebornHistory(target,a).reason,"DUPLICATE_ARCHIVE_EVENT");
});
test("race source timestamp after posttime rejected",()=>{
 const r=enrichLockedRebornHistory({...target,saved_at:"2026-10-24T07:01:00Z"},archive);
 assert.equal(r.status,"RESEARCH_ENRICHMENT_REJECTED");
});
