import test from "node:test";
import assert from "node:assert/strict";
import {official2026Grade} from "./jra-official-2026-grade-registry.mjs";
import {buildRebornV03G} from "./lab-reborn-v03g-official-grade.mjs";
const ctx={date:"2026-10-12",track:"京都",raceNo:11,
 className:"オープン",raceName:"MBS賞スワンステークス",
 surface:"芝",distance:1400};
const spec=(no,name,priorDate,priorClass,raceName)=>({
 horse_no:no,horse_name:name,past_race_content:[{
 prior_date:priorDate,prior_track:"阪神",prior_surface:"芝",prior_distance:1200,
 prior_class:priorClass,race_name:raceName,finish:2,margin_to_winner:0.1,
 final3f_rank:3,final3f_source:"VERIFIED_ARCHIVE"}],opponent_followups:[]});
const p={race_date:ctx.date,track:ctx.track,race_no:11,
 recent_evidence:{runners:[
 spec(1,"CERTIFIED","2026-09-06","オープン","セントウルS"),
 spec(2,"UNKNOWN_OPEN","2026-09-06","オープン",null),
 spec(3,"LOWER_CLASS","2026-09-19","1勝クラス",null),
 spec(4,"C","2026-09-05","オープン",null),
 spec(5,"D","2026-09-01","オープン",null)
 ]},older_same_course_evidence:Array.from({length:5},(_,i)=>({
 horse_no:i+1,horse_name:["CERTIFIED","UNKNOWN_OPEN","LOWER_CLASS","C","D"][i],
 older_same_surface_near_distance:[]}))};
test("official JRA GII Swans lookup matches exact date and track",()=>{
 assert.equal(official2026Grade("2026-10-12","京都","MBS賞スワンステークス").level,6);
 assert.equal(official2026Grade("2026-10-12","東京","MBS賞スワンステークス"),null);
});
test("a known GII predecessor is recognized as level 6",()=>{
 const r=buildRebornV03G(p,ctx).runners.find(x=>x.horse_no===1);
 assert.equal(r.evidence[0].class_level,6);
 assert.equal(r.evidence[0].grade_source,"JRA_2026_OFFICIAL");
 assert.equal(r.evidence[0].historical_grade_uncertain,false);
});
test("a stripped previous OPEN is marked unknown instead of safely called ungraded",()=>{
 const r=buildRebornV03G(p,ctx).runners.find(x=>x.horse_no===2);
 assert.equal(r.evidence[0].historical_grade_uncertain,true);
 assert.equal(r.evidence[0].grade_source,"NAME_OR_CLASS_FALLBACK");
});
test("actual 1-win class remains lower than a GII target",()=>{
 const r=buildRebornV03G(p,ctx).runners.find(x=>x.horse_no===3);
 assert.equal(r.evidence[0].historical_grade_uncertain,false);
 assert.equal(r.evidence[0].class_level,1);
});
test("unknown OP grade not over-penalized versus officially GII class",()=>{
 const r=buildRebornV03G(p,ctx).runners;
 const known=r.find(x=>x.horse_no===1),unknown=r.find(x=>x.horse_no===2);
 assert.ok(unknown.evidence[0].adjusted_run_quality>=
   known.evidence[0].adjusted_run_quality*0.80);
});
test("never consume old LAB score, post-race result or odds",()=>{
 const extra=JSON.parse(JSON.stringify(p));
 extra.recent_evidence.runners.forEach((x,i)=>{
 x.win_odds=0.1;x.base_rate=i*99;x.rank=1;x.finish_actual=5-i;
 });
 const a=buildRebornV03G(p,ctx),b=buildRebornV03G(extra,ctx);
 assert.deepEqual(a.runners,b.runners);
});
test("returns no official write and uncalibrated model",()=>{
 const r=buildRebornV03G(p,ctx);
 assert.equal(r.production_write,false);
 assert.equal(r.calibrated,false);
});
