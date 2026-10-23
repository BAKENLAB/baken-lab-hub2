import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rankRebornV05,verifyContentModel} from "./lab-reborn-v05-content.mjs";
const v4=JSON.parse(readFileSync(new URL("./learned-2024-reborn-v04-coefficients.json",import.meta.url),"utf8"));
const v5=JSON.parse(readFileSync(new URL("./REBORN_V05_CONTENT_2024_FROZEN.json",import.meta.url),"utf8"));
const core={race_date:"2025-09-13",track:"阪神",race_no:7,field_size:7,
 segment:"CLASS1",surface:"ダート",n4:4,podium4:2,mean_gap4:0.4,
 near_close46:false,recent_sameclass_close:true,recent_near_top3:true,
 old_same_track_top3:false,recent_3f_close:false,recent_consistent:true};
const rows=Array.from({length:7},(_,i)=>({...core,
 horse_no:i+1,horse_name:"H"+(i+1),podium4:i%4,mean_gap4:0.3*i}));
const content=rows.map((r,i)=>({horse_no:r.horse_no,race_date:r.race_date,
 track:r.track,race_no:r.race_no,segment:r.segment,surface:r.surface,
 late_position_gain:i===0,hot_front_survivor:i===1,overlooked_closer:i===2}));
test("24 independent frozen 2024 content coefficients loaded",()=>{
 assert.equal(verifyContentModel(v5).size,24);
});
test("scores all 7 runners with independent v04 plus content sources",()=>{
 const x=rankRebornV05(rows,content,v4,v5);
 assert.equal(x.status,"RESEARCH_READY");
 assert.equal(x.top5.length,5);
 assert.equal(x.runners.length,7);
 assert.equal(x.production_write,false);
});
test("official old prediction and odds never influence REBORN",()=>{
 const x=rankRebornV05(rows,content,v4,v5);
 const y=rankRebornV05(rows.map(z=>({...z,base_rate:0.99,
  LAB_RANK:1,market_rank:1,win_odds:0.1,actual_finish:1})),content,v4,v5);
 assert.deepEqual(x.runners,y.runners);
});
test("unscored field never publishes",()=>{
 const y=rankRebornV05(rows.slice(0,6),content,v4,v5);
 assert.notEqual(y.status,"RESEARCH_READY");
 assert.equal(y.runners.length,0);
});
test("missing content cannot be interpreted as no change",()=>{
 const y=rankRebornV05(rows,content.slice(1),v4,v5);
 assert.equal(y.status,"INCOMPLETE_CONTENT");
});
test("future or different target cannot supply historical signal",()=>{
 const fake=content.map(v=>({...v}));fake[0].race_date="2025-09-14";
 const y=rankRebornV05(rows,fake,v4,v5);
 assert.equal(y.status,"INVALID_CONTENT_IDENTITIES");
});
test("null flags refuse inference as false",()=>{
 const fake=content.map(v=>({...v}));fake[0].hot_front_survivor=null;
 const y=rankRebornV05(rows,fake,v4,v5);
 assert.equal(y.status,"INVALID_CONTENT_FLAGS");
});
test("no model training or arbitrary coefficient edits",()=>{
 const bad={...v5,training:"2025-01-01/2025-12-31"};
 const y=rankRebornV05(rows,content,v4,bad);
 assert.equal(y.status,"INVALID_V05_MODEL");
});
test("deterministic whole-field rankings",()=>{
 const a=rankRebornV05(rows,content,v4,v5);
 const b=rankRebornV05([...rows].reverse(),[...content].reverse(),v4,v5);
 assert.deepEqual(a.runners,b.runners);
});
test("unknown content model must be rejected",()=>{
 const bad={...v5,coefficients:v5.coefficients.slice(0,23)};
 assert.equal(verifyContentModel(bad),null);
});
