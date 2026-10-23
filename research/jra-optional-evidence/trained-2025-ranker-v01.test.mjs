import test from "node:test";
import assert from "node:assert/strict";
import {rankWithLocked2025Evidence} from "./trained-2025-ranker-v01.mjs";
import {readFileSync} from "node:fs";
const model=JSON.parse(readFileSync(new URL("./trained-2025-coefficients-v01.json",import.meta.url),"utf8"));
const a={race_date:"2026-10-24",track:"東京",race_no:7,
  horse_no:1,horse_name:"テストA",segment:"CLASS1",base_rate:0.15,
  mean_gap4:0.5,near_close46:true,recent_near_top3:false,
  recent_sameclass_close:false,old_same_track_top3:true,recent_3f_close:false};
const b={...a,horse_no:2,horse_name:"テストB",near_close46:false,
  old_same_track_top3:false};
test("locked train fixture creates 100-point output and rank explanation",()=>{
 const x=rankWithLocked2025Evidence([a,b],model);
 assert.equal(x.status,"RESEARCH_READY");
 assert.equal(x.runners.length,2);
 assert.equal(x.official_ranking_modified,false);
 assert.ok(x.runners.every(r=>r.score_100>=0&&r.score_100<=100));
 assert.ok(x.runners[0].signals.some(s=>s.signal==="CLOSE_4TO6"));
});
test("later current-race results must not influence any score",()=>{
 const x=rankWithLocked2025Evidence([a,b],model);
 const fake=[{...a,finish:1,win_odds:1,popularity:1,target_top3:true},
  {...b,finish:18,win_odds:999,popularity:18,target_top3:false}];
 const y=rankWithLocked2025Evidence(fake,model);
 assert.deepEqual(x.runners,y.runners);
});
test("data-missing optional flag creates no artificial penalty",()=>{
 const x=rankWithLocked2025Evidence([a,b],model);
 const y=rankWithLocked2025Evidence([{
  ...a,recent_3f_close:null
 },b],model);
 assert.equal(x.runners.find(r=>r.horse_no===1).score_100,
  y.runners.find(r=>r.horse_no===1).score_100);
});
test("missing base rate refuses new ranking, not saved prediction",()=>{
 const x=rankWithLocked2025Evidence([a,{...b,base_rate:null}],model);
 assert.equal(x.status,"MISSING_BASE_RATE_OR_SEGMENT");
 assert.equal(x.official_ranking_modified,false);
});
test("old or forged coefficient tables rejected",()=>{
 const x=rankWithLocked2025Evidence([a,b],{...model,train_to:"2026-09-13"});
 assert.equal(x.status,"INVALID_OR_UNLOCKED_MODEL");
});
test("duplicate horse number and mixed races refuse calculation",()=>{
 assert.equal(rankWithLocked2025Evidence([a,{...b,horse_no:1}],model).status,
  "INVALID_OR_MIXED_RACE_ROSTER");
 assert.equal(rankWithLocked2025Evidence([a,{...b,race_no:8}],model).status,
  "INVALID_OR_MIXED_RACE_ROSTER");
});
test("signals learned from data can move ranking, no FROZEN change",()=>{
 const x=rankWithLocked2025Evidence([a,b],model);
 assert.ok(x.runners.find(r=>r.horse_no===1).research_rate>
  x.runners.find(r=>r.horse_no===2).research_rate);
 assert.equal(x.original_frozen_modified,false);
});
