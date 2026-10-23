import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canonicalHorseId,parseRaceSeconds,parseVerifiedHalons,prepareConditionReference,
 assessHistoricalRun,buildRebornV06Evidence} from "./lab-reborn-v06-clock-evidence.mjs";
const profile=JSON.parse(readFileSync(new URL("./REBORN_V06_2023_2024_CONDITION_REFERENCES.json",import.meta.url),"utf8"));
const prepared=prepareConditionReference(profile);
const ref="/JRADB/accessU.html?CNAME=pw01dud102020104523/CF";
const fakeRef=i=>"/JRADB/accessU.html?CNAME=pw01dud10"+String(2020104523+i)+"/CF";
const runner={date:"2025-01-12",track:"中京",surface:"ダート",distance:1200,
 going:"良",segment:"CLASS1",horse_ref:ref,finish:1,runner_time:"1:12.2",
 winner_time:"1:12.2",halon_times:"12.7 - 11.2 - 12.3 - 12.3 - 11.6 - 12.1",
 final3f:35.9,early_pos:2,final_turn_pos:2};
test("frozen reference has at least 190 valid conditions",()=>{
 assert.equal(profile.groups.length,190);
 assert.equal(prepared.size,190);
});
test("source time string parser never guesses decimal seconds",()=>{
 assert.equal(parseRaceSeconds("1:12.2"),72.2);
 assert.equal(parseRaceSeconds("0:59.9"),59.9);
 assert.equal(parseRaceSeconds("1:72.2"),null);
 assert.equal(parseRaceSeconds("1:12"),null);
});
test("verified halons sum must match winner clock",()=>{
 const a=parseVerifiedHalons(runner.halon_times,1200,72.2);
 assert.equal(a.first600,36.2);
 assert.equal(a.last600,36);
 assert.equal(a.clock_integrity,0);
 assert.equal(parseVerifiedHalons(runner.halon_times,1200,73.5),null);
});
test("odd distance 1150m and forged extra splits never accepted for pace",()=>{
 assert.equal(parseVerifiedHalons(runner.halon_times,1150,72.2),null);
 assert.equal(parseVerifiedHalons("12.7 - 11.2 - 12.3 - 12.3 - 11.6",1200,60.1),null);
});
test("historical Chukyo 2025 winner is compared with 2023-24 same condition",()=>{
 const a=assessHistoricalRun(runner,{date:"2025-09-13",horse_ref:ref},prepared);
 assert.equal(a.status,"CONDITION_EVIDENCE_READY");
 assert.equal(a.clock.gap_to_winner,0);
 assert.equal(a.clock.condition_median_winner,72.0);
 assert.equal(a.clock.comparative_seconds,-0.2);
 assert.equal(a.sample.reference_races,23);
 assert.equal(a.sample.metadata_condition_group_matched,true);
 assert.equal(a.sample.course_geometry_verified,false);
 assert.equal(a.sample.exact_condition,false);
 assert.deepEqual(a.sample.matched_reference_dimensions,
  ["track","surface","distance","going","segment"]);
 assert.equal(a.pace.first600,36.2);
 assert.equal(a.pace.early_speed_ahead_of_reference,-1.6);
 assert.equal(a.score_delta,0);
});
test("do not treat an unknown racing condition as bad ability",()=>{
 const r=assessHistoricalRun({...runner,going:"不良"},{date:"2025-09-13",horse_ref:ref},prepared);
 assert.ok(["CONDITION_EVIDENCE_READY","NO_MATCHED_REFERENCE"].includes(r.status));
});
test("target from same day / future cannot be included",()=>{
 assert.equal(assessHistoricalRun(runner,{date:"2025-01-12"},prepared).status,"INVALID_ASOF");
 assert.equal(assessHistoricalRun({...runner,date:"2026-10-24"},{date:"2026-10-24"},prepared).status,"INVALID_ASOF");
});
test("no 2023-24 target can use same-period fitted profile",()=>{
 assert.equal(assessHistoricalRun({...runner,date:"2024-01-12"},{date:"2024-10-17"},prepared).status,"INVALID_ASOF");
});
test("horse identity remains fixed when enriching previous races",()=>{
 assert.equal(assessHistoricalRun(runner,{date:"2025-09-13",horse_ref:"different"},prepared).status,"IDENTITY_MISMATCH");
});
test("misreported winner seconds cannot be silently trusted",()=>{
 assert.equal(assessHistoricalRun({...runner,winner_time:"1:13.0"},
  {date:"2025-09-13",horse_ref:ref},prepared).status,"INVALID_TIMING");
});
test("market data old ranks and target result do not affect evidence",()=>{
 const context={date:"2025-09-13",horse_ref:ref};
 const x=assessHistoricalRun(runner,context,prepared);
 const y=assessHistoricalRun({...runner,odds:1.2,lab_rank:1,base_rate:0.9,
  target_finish:1},context,prepared);
 assert.deepEqual(x,y);
});
test("full-field packet integrity and no production score",()=>{
 const target={date:"2025-09-13",runners:Array.from({length:6},(_,i)=>({
   horse_ref:fakeRef(i),horse_no:i+1,horse_name:"H"+i,
   history:[{...runner,horse_ref:fakeRef(i)}]
 }))};
 const result=buildRebornV06Evidence(target,profile);
 assert.equal(result.status,"RESEARCH_EVIDENCE_READY");
 assert.equal(result.runners.length,6);
 assert.equal(result.actual_rank_modified,false);
 assert.equal(result.production_write,false);
 assert.equal(result.runners.every(x=>x.usable_runs===1),true);
});
test("a single future record poisons whole packet; never ignore it",()=>{
 const target={date:"2025-09-13",runners:Array.from({length:5},(_,i)=>({
 horse_ref:fakeRef(i),horse_no:i+1,history:[{
 ...runner,date:i===1?"2025-10-01":runner.date,horse_ref:fakeRef(i)}]}))};
 assert.equal(buildRebornV06Evidence(target,profile).status,"ASOF_OR_IDENTITY_REJECTED");
});

test("same horse live/archive URLs with distinct tokens still match",()=>{
 const fromLive="/JRADB/accessU.html?CNAME=pw01dud002023105825/F4";
 const fromArchive="/JRADB/accessU.html?CNAME=pw01dud102023105825/DB";
 assert.equal(canonicalHorseId(fromLive),canonicalHorseId(fromArchive));
 assert.equal(canonicalHorseId(fromLive),"2023105825");
 const result=assessHistoricalRun({...runner,horse_ref:fromArchive},
   {date:"2025-09-13",horse_ref:fromLive},prepared);
 assert.notEqual(result.status,"IDENTITY_MISMATCH");
});
test("two different URL variants of same horse are duplicate roster entries",()=>{
 const a="/JRADB/accessU.html?CNAME=pw01dud002023105825/F4";
 const b="/JRADB/accessU.html?CNAME=pw01dud102023105825/DB";
 const rows=[a,b,...[2,3,4].map(fakeRef)].map((id,i)=>({
 horse_ref:id,horse_no:i+1,history:[]}));
 assert.equal(buildRebornV06Evidence({date:"2025-09-13",runners:rows},profile).status,
 "DUPLICATE_OR_MISSING_HORSE_REF");
});
test("cannot use horse name alone or malformed reference as identity",()=>{
 assert.equal(canonicalHorseId("ギャラボーグ"),null);
 assert.equal(canonicalHorseId("/JRADB/accessU.html?CNAME=pw01dud102023105825/"),null);
});
