import test from "node:test";
import assert from "node:assert/strict";
import {buildRebornV03,rebornClassLevel} from "./lab-reborn-v03.mjs";
const ctx={date:"2026-10-18",track:"京都",raceNo:11,
 raceName:"秋華賞",className:"オープン",surface:"芝",distance:2000};
const runner=(id,name,date="2026-09-13",options={})=>({
 horse_no:id,horse_name:name,past_race_content:[{
 prior_date:date,prior_track:"阪神",prior_surface:"芝",
 prior_distance:1800,prior_class:"ローズS",finish:1,
 margin_to_winner:0.5,source_kind:"LIVE",final3f_source:"LIVE_PAST_RUN_FALLBACK",
 ...options
 }],opponent_followups:[]});
const packet={race_date:ctx.date,track:ctx.track,race_no:11,
 recent_evidence:{runners:[runner(1,"A"),runner(2,"B"),runner(3,"C"),
 runner(4,"D"),runner(5,"E")]},
 older_same_course_evidence:[1,2,3,4,5].map(id=>({
 horse_no:id,horse_name:String.fromCharCode(64+id),older_same_surface_near_distance:[]})
 )};
const clone=x=>JSON.parse(JSON.stringify(x));
test("GII aliases, GI target and literal L/OP parsed safely",()=>{
 assert.equal(rebornClassLevel("ローズS",null),6);
 assert.equal(rebornClassLevel("GIII",null),5);
 assert.equal(rebornClassLevel("GII",null),6);
 assert.equal(rebornClassLevel("GI",null),7);
 assert.equal(rebornClassLevel("ＧⅢ",null),5);
 assert.equal(rebornClassLevel("紫苑S",null),6);
 assert.equal(rebornClassLevel("オープン","秋華賞"),7);
 assert.equal(rebornClassLevel("オープン","優駿牝馬"),7);
 assert.equal(rebornClassLevel("オープン","東風ステークス"),4);
 assert.equal(rebornClassLevel("2勝クラス","未登録特別"),2);
 assert.equal(rebornClassLevel(null,"わからない特別"),null);
});
test("winner margin 0.5 is not incorrectly counted as loss",()=>{
 const res=buildRebornV03(packet,ctx);
 const a=res.runners.find(x=>x.horse_no===1);
 assert.equal(a.evidence[0].gap_behind_winner,0);
 assert.equal(a.evidence[0].unverified_winning_margin,0.5);
 assert.equal(a.evidence[0].class_level,6);
});
test("winner with 0.5 and 0 win margin scores identical",()=>{
 const p=clone(packet);
 p.recent_evidence.runners[0].past_race_content[0].margin_to_winner=0;
 const b=buildRebornV03(packet,ctx),c=buildRebornV03(p,ctx);
 assert.equal(b.runners.find(x=>x.horse_no===1).score,
              c.runners.find(x=>x.horse_no===1).score);
});
test("1800 GII winner is valued as class-proven in GI 2000",()=>{
 const a=buildRebornV03(packet,ctx).runners.find(x=>x.horse_no===1);
 assert.ok(a.evidence[0].adjusted_run_quality>=75);
});
test("graded winning evidence outranks maiden-only win at same distance",()=>{
 const p=clone(packet);
 p.recent_evidence.runners[1].past_race_content[0].prior_class="未勝利";
 const a=buildRebornV03(p,ctx);
 assert.ok(a.runners.find(x=>x.horse_no===1).score>
           a.runners.find(x=>x.horse_no===2).score);
});
test("missing same-track history is not a low artificial course ability",()=>{
 const x=buildRebornV03(packet,ctx);
 const a=x.runners.find(x=>x.horse_no===1);
 assert.ok(a.axes.course_fit>50);
 assert.ok(a.data_warnings.includes("COURSE_FIT_TRANSFER_ONLY"));
 assert.ok(!a.data_warnings.includes("NO_PROVEN_NEAR_DISTANCE_HISTORY"));
});
test("unknown last3f rank does not invent proven fast finish",()=>{
 const x=buildRebornV03(packet,ctx).runners.find(x=>x.horse_no===1);
 assert.equal(x.evidence[0].final3f_verified,false);
 assert.ok(x.data_warnings.includes("UNVERIFIED_POSITION_AND_3F_CONTENT"));
});
test("after-race info is never used",()=>{
 const p=clone(packet);p.recent_evidence.runners[0].past_race_content.push({
 prior_date:"2026-10-19",prior_surface:"芝",prior_track:"京都",prior_distance:2000,
 prior_class:"G1",finish:1,margin_to_winner:5.0
 });
 const original=buildRebornV03(packet,ctx);
 const altered=buildRebornV03(p,ctx);
 assert.deepEqual(original.runners,altered.runners);
});
test("old LAB scores, rank and odds cannot affect any horse",()=>{
 const p=clone(packet);
 p.recent_evidence.runners=p.recent_evidence.runners.map((x,i)=>({
  ...x,lab_grade:"S",validated_core_base_rate:i+100,
  popularity:i,win_odds:0.1,base_rank:i,actual_finish:i+1}));
 const a=buildRebornV03(packet,ctx),b=buildRebornV03(p,ctx);
 assert.deepEqual(a.runners,b.runners);
});
test("missed identity refuses as mixed field",()=>{
 const p=clone(packet);p.older_same_course_evidence[0].horse_name="OTHER";
 assert.equal(buildRebornV03(p,ctx).status,"IDENTITY_MISMATCH");
});
test("missing history for one horse blocks published TOP5",()=>{
 const p=clone(packet);p.recent_evidence.runners[4].past_race_content=[];
 const x=buildRebornV03(p,ctx);
 assert.equal(x.status,"PARTIAL_HISTORY");
 assert.equal(x.top5.length,0);
 assert.equal(x.provisional_top5.length,4);
});
test("unrelated surface evidence discounted but still available as a transfer",()=>{
 const p=clone(packet);
 p.recent_evidence.runners[0].past_race_content[0].prior_surface="ダート";
 const x=buildRebornV03(p,ctx).runners.find(x=>x.horse_no===1);
 assert.ok(x.score!==null);
 assert.ok(x.source_summary.transfer>0);
 assert.ok(x.source_summary.comparable===0);
});
test("entirely future source cannot fill zero-data horse",()=>{
 const p=clone(packet);
 p.recent_evidence.runners[0].past_race_content=[{
 ...p.recent_evidence.runners[0].past_race_content[0],prior_date:"2026-10-19"
 }];
 const x=buildRebornV03(p,ctx);
 assert.equal(x.status,"PARTIAL_HISTORY");
 assert.equal(x.runners.find(x=>x.horse_no===1).score,null);
});
test("no official writes; scores not calibrated probabilities",()=>{
 const x=buildRebornV03(packet,ctx);
 assert.equal(x.production_write,false);
 assert.equal(x.calibrated,false);
 assert.equal(x.uses_old_lab,false);
});

test("one stale poor exact course must not eclipse current near-distance form",()=>{
 const p=clone(packet);
 p.recent_evidence.runners[0].past_race_content=[{
  prior_date:"2026-09-11",prior_track:"函館",prior_surface:"芝",
  prior_distance:1800,prior_class:"オープン",finish:2,margin_to_winner:0.1
 }];
 p.older_same_course_evidence[0].older_same_surface_near_distance=[{
  date:"2025-08-01",track:"京都",surface:"芝",distance:2000,
  class_name:"未勝利",finish:11
 }];
 const s=buildRebornV03(p,ctx).runners.find(z=>z.horse_no===1);
 assert.ok(s.source_summary.near_ability>60);
 assert.ok(s.source_summary.local_proof<40);
 assert.ok(s.axes.course_fit>55);
 assert.ok(s.data_warnings.includes("PRIOR_EXACT_COURSE_CAUTION"));
});
test("no local history is UNKNOWN not low numeric fitness",()=>{
 const out=buildRebornV03(packet,ctx).runners.find(x=>x.horse_no===1);
 assert.ok(out.source_summary.exact_course===0);
 assert.ok(out.axes.course_fit>50);
 assert.ok(out.data_warnings.includes("COURSE_FIT_TRANSFER_ONLY"));
});
test("race content needs corroborating position or verified 3f source",()=>{
 const p=clone(packet);
 p.recent_evidence.runners[0].past_race_content[0].race_halons="12.1 - 11.2 - 12.0 - 12.0 - 12.3 - 11.9";
 const a=buildRebornV03(packet,ctx).runners.find(x=>x.horse_no===1);
 const b=buildRebornV03(p,ctx).runners.find(x=>x.horse_no===1);
 assert.equal(a.axes.race_content,b.axes.race_content);
});
