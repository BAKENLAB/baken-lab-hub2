import test from "node:test";
import assert from "node:assert/strict";
import {buildRebornPrediction} from "./lab-reborn-v01.mjs";

const ctx={date:"2026-10-17",track:"新潟",raceNo:3,surface:"ダート",distance:1200,className:"1勝クラス"};
const basic=(no,name,finish=2)=>({
 horse_no:no,horse_name:name,past_race_content:[{
 prior_date:"2026-09-19",prior_track:"中山",prior_surface:"ダート",
 prior_distance:1200,prior_class:"1勝クラス",finish,margin_to_winner:0.2,
 final3f_rank:null,final3f_source:"LIVE_PAST_RUN_FALLBACK",
 live_corner_positions:[1,1]
 }],opponent_followups:[]});
const old=(no,name)=>({horse_no:no,horse_name:name,
 older_same_surface_near_distance:[]});
const packet={race_date:ctx.date,track:ctx.track,race_no:ctx.raceNo,
 recent_evidence:{runners:[basic(1,"A"),basic(2,"B",6)]},
 older_same_course_evidence:[old(1,"A"),old(2,"B")]};
test("all available competitors ranked independently",()=>{
 const p=buildRebornPrediction(packet,ctx);
 assert.equal(p.status,"RESEARCH_READY");
 assert.equal(p.runners.length,2);
 assert.equal(p.runners[0].horse_name,"A");
 assert.equal(p.runners[0].reborn_rank,1);
 assert.ok(p.runners[0].score<=100&&p.runners[0].score>=0);
});
test("legacy old ranks and odds cannot influence reborn scores",()=>{
 const m={...packet,recent_evidence:{runners:packet.recent_evidence.runners
   .map((x,i)=>({...x,rank:99-i,base_rate:i*0.99,win_odds:1,LAB_RANK:1,
   target_finish:i===0?10:1}))}};
 const a=buildRebornPrediction(packet,ctx);
 const b=buildRebornPrediction(m,ctx);
 assert.deepEqual(a.runners,b.runners);
});
test("future historical evidence excluded",()=>{
 const p=structuredClone(packet);
 p.recent_evidence.runners[1].past_race_content.push({
 prior_date:"2026-10-18",prior_track:"新潟",prior_surface:"ダート",
 prior_distance:1200,prior_class:"1勝クラス",finish:1,margin_to_winner:0});
 const a=buildRebornPrediction(packet,ctx);
 const b=buildRebornPrediction(p,ctx);
 assert.deepEqual(a.runners,b.runners);
});
test("lower-class old victory does not dominate recent current-class second",()=>{
 const p=structuredClone(packet);
 p.older_same_course_evidence[1].older_same_surface_near_distance=[{
 date:"2025-05-24",track:"新潟",surface:"ダート",distance:1200,
 finish:1,class_name:"未勝利",final3f_rank:1}];
 const x=buildRebornPrediction(p,ctx);
 assert.ok(x.runners.find(v=>v.horse_name==="A").score >
  x.runners.find(v=>v.horse_name==="B").score);
});
test("missing rider-rank timing is not invented",()=>{
 const p=buildRebornPrediction(packet,ctx);
 assert.equal(p.runners[0].history.verified_content,1);
 assert.ok(p.runners[0].evidence[0].gap!==null);
});
test("identity mismatches and duplicated horse IDs refuse slate",()=>{
 const p=structuredClone(packet);
 p.older_same_course_evidence[0].horse_name="C";
 assert.equal(buildRebornPrediction(p,ctx).status,"IDENTITY_MISMATCH");
 const q=structuredClone(packet);
 q.recent_evidence.runners[0].horse_no=2;
 assert.equal(buildRebornPrediction(q,ctx).status,"DUPLICATE_ROSTER");
});
test("unavailable evidence produces missing score, not falsely zero ability",()=>{
 const p=structuredClone(packet);
 p.recent_evidence.runners[1].past_race_content=[];
 const x=buildRebornPrediction(p,ctx);
 assert.equal(x.status,"PARTIAL_HISTORY");
 assert.equal(x.runners.find(y=>y.horse_no===2).score,null);
 assert.equal(x.production_write,false);
});
test("surface and distance mismatches cannot create matching peak",()=>{
 const p=structuredClone(packet);
 p.recent_evidence.runners[1].past_race_content[0].prior_surface="芝";
 p.recent_evidence.runners[1].past_race_content[0].prior_distance=2200;
 const x=buildRebornPrediction(p,ctx);
 assert.equal(x.runners.find(y=>y.horse_no===2).score,null);
});
test("official FROZEN never changes",()=>{
 const result=buildRebornPrediction(packet,ctx);
 assert.equal(result.production_write,false);
 assert.equal(result.no_frozen_change,true);
});
