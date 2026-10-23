import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildRebornV06Research} from "./lab-reborn-v06-integrated-shadow.mjs";
const locked=JSON.parse(readFileSync(new URL("./learned-2024-reborn-v04-coefficients.json",import.meta.url),"utf8"));
const references=JSON.parse(readFileSync(new URL("./REBORN_V06_2023_2024_CONDITION_REFERENCES.json",import.meta.url),"utf8"));
const pastRef=i=>"/JRADB/accessU.html?CNAME=pw01dud10"+String(2020104523+i)+"/CF";
const liveRef=i=>"/JRADB/accessU.html?CNAME=pw01dud00"+String(2020104523+i)+"/ED";
const core={race_date:"2025-09-13",track:"阪神",race_no:7,field_size:7,
 segment:"CLASS1",surface:"ダート",n4:4,podium4:2,mean_gap4:0.4,
 near_close46:false,recent_sameclass_close:true,recent_near_top3:true,
 old_same_track_top3:false,recent_3f_close:false,recent_consistent:true};
const rows=Array.from({length:7},(_,i)=>({...core,horse_no:i+1,horse_name:"HORSE"+i,
 podium4:i%4,mean_gap4:0.2*i}));
const packet={date:"2025-09-13",track:"阪神",race_no:7,
 runners:rows.map((x,i)=>({horse_no:x.horse_no,horse_name:x.horse_name,
 horse_ref:liveRef(i),history:[{
 date:"2025-01-12",track:"中京",surface:"ダート",distance:1200,
 going:"良",segment:"CLASS1",horse_ref:pastRef(i),finish:1,
 runner_time:"1:12.2",winner_time:"1:12.2",
 halon_times:"12.7 - 11.2 - 12.3 - 12.3 - 11.6 - 12.1",
 early_pos:2,final_turn_pos:2,final3f:35.9
 }]}))};
const clone=x=>JSON.parse(JSON.stringify(x));
test("complete integrated research field produces independent scores and context",()=>{
 const r=buildRebornV06Research(rows,packet,[],locked,references);
 assert.equal(r.status,"RESEARCH_READY");
 assert.equal(r.runners.length,7);
 assert.equal(r.top5.length,5);
 assert.equal(r.rank_changes_from_v04,0);
 assert.equal(r.production_write,false);
 assert.equal(r.runners[0].condition_clock.usable_runs,1);
});
test("no old LAB / market / actual target result influence",()=>{
 const a=buildRebornV06Research(rows,packet,[],locked,references);
 const b=buildRebornV06Research(rows.map(x=>({...x,old_rank:1,
 win_odds:1,popularity:1,LAB_RANK:1,actual_finish:1})),packet,[],locked,references);
 assert.deepEqual(a.runners,b.runners);
});
test("reject wrong field size and target race",()=>{
 const p=clone(packet);p.race_no=8;
 assert.equal(buildRebornV06Research(rows,p,[],locked,references).status,"TARGET_OR_ROSTER_MISMATCH");
 const q=clone(packet);q.runners.pop();
 assert.equal(buildRebornV06Research(rows,q,[],locked,references).status,"TARGET_OR_ROSTER_MISMATCH");
});
test("identity mismatch between independent feature and archive blocks slate",()=>{
 const p=clone(packet);p.runners[0].horse_name="not-HORSE0";
 assert.equal(buildRebornV06Research(rows,p,[],locked,references).status,"HORSE_IDENTITY_MISMATCH");
});
test("future relative to target previous run cannot be accepted",()=>{
 const p=clone(packet);p.runners[1].history[0].date="2025-09-15";
 assert.equal(buildRebornV06Research(rows,p,[],locked,references).status,
 "CLOCK_ASOF_OR_IDENTITY_REJECTED");
});
test("future or different-race rival record fails whole report",()=>{
 const opponent={target_date:"2025-09-13",target_track:"阪神",target_no:7,
 target_horse_code:"2020104523",meeting_date:"2025-05-24",
 later_date:"2025-10-01"};
 assert.equal(buildRebornV06Research(rows,packet,[opponent],locked,references).status,
 "MIXED_OR_FUTURE_RIVAL_SOURCE");
});
test("unknown past opponent code must not be attached",()=>{
 const opponent={target_date:"2025-09-13",target_track:"阪神",target_no:7,
 target_horse_code:"0000000000",meeting_date:"2025-05-24",
 later_date:"2025-07-01"};
 assert.equal(buildRebornV06Research(rows,packet,[opponent],locked,references).status,
 "MIXED_OR_FUTURE_RIVAL_SOURCE");
});
test("tampered independent training coefficients reject field",()=>{
 const invalid={...locked,training:"2026-01-01/2026-09-13"};
 const r=buildRebornV06Research(rows,packet,[],invalid,references);
 assert.equal(r.status,"BASE_INVALID_LOCKED_MODEL");
});
test("deterministic roster ordering",()=>{
 const a=buildRebornV06Research(rows,packet,[],locked,references);
 const p=clone(packet);p.runners.reverse();
 const b=buildRebornV06Research([...rows].reverse(),p,[],locked,references);
 assert.deepEqual(a.runners,b.runners);
});
