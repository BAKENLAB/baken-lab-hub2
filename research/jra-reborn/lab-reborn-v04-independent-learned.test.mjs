import test from "node:test";
import assert from "node:assert/strict";
import {prepareRebornV04,evaluateRebornV04,rankRebornV04}
from "./lab-reborn-v04-independent-learned.mjs";
import {readFileSync} from "node:fs";
const model=JSON.parse(readFileSync(
 new URL("./learned-2024-reborn-v04-coefficients.json",import.meta.url),"utf8"));
const base={race_date:"2026-10-24",track:"東京",race_no:1,field_size:7,
 segment:"CLASS1",surface:"ダート",n4:4,podium4:2,mean_gap4:0.4,
 near_close46:false,recent_sameclass_close:true,recent_near_top3:true,
 old_same_track_top3:false,recent_3f_close:false,recent_consistent:true};
const field=Array.from({length:7},(_,i)=>({...base,
 horse_no:i+1,horse_name:"TEST"+(i+1),podium4:i%4,
 mean_gap4:i*0.3,
 old_same_track_top3:i===3}));
test("2024 frozen evidence model integrity",()=>{
 const m=prepareRebornV04(model);
 assert.equal(m.cohort.size,8);
 assert.equal(m.weight.size,152);
});
test("entire field ranks 7 horses without old LAB scoring",()=>{
 const result=rankRebornV04(field,model);
 assert.equal(result.status,"RESEARCH_READY");
 assert.equal(result.runners.length,7);
 assert.equal(result.top5.length,5);
 assert.equal(result.production_write,false);
});
test("target finishes, odds, old LAB grade/base rank cannot alter score",()=>{
 const forged=field.map((x,i)=>({...x,finish:7-i,win_odds:i+1,
  popularity:7-i,lab_rank:1,lab_grade:"S",base_rate:i}));
 const x=rankRebornV04(field,model),y=rankRebornV04(forged,model);
 assert.deepEqual(x.runners,y.runners);
});
test("score changes when genuine past evidence changes",()=>{
 const x=evaluateRebornV04(field[0],prepareRebornV04(model));
 const y=evaluateRebornV04({...field[0],podium4:3},prepareRebornV04(model));
 assert.notEqual(x.independent_score_100,y.independent_score_100);
});
test("no uncalibrated number is asserted as a win probability",()=>{
 const r=rankRebornV04(field,model);
 assert.equal(r.calibrated_probability,false);
 assert.ok(r.runners.every(x=>x.independent_score_100>=0&&x.independent_score_100<=100));
});
test("missing boolean evidence rejects prediction, no false zeros",()=>{
 const f=field.map(x=>({...x}));
 f[2].recent_near_top3=null;
 assert.equal(rankRebornV04(f,model).status,"MISSING_REQUIRED_FEATURES");
});
test("missing, truncated and duplicate fields rejected",()=>{
 const q=field.slice(0,6);
 assert.equal(rankRebornV04(q,model).status,"INCOMPLETE_FIELD");
 const d=field.map(x=>({...x}));
 d[2].horse_no=1;
 assert.equal(rankRebornV04(d,model).status,"INVALID_FIELD_IDENTITIES");
});
test("tampered training dates, group or coefficient counts rejected",()=>{
 assert.equal(rankRebornV04(field,{...model,training:"2026-01-01/2026-09-13"}).status,
  "INVALID_LOCKED_MODEL");
 assert.equal(rankRebornV04(field,{...model,coeffs:model.coeffs.slice(1)}).status,
  "INVALID_LOCKED_MODEL");
});
test("missing grade/segment is not replaced by a legacy grade",()=>{
 const q=field.map(x=>({...x}));
 q[2].segment=null;
 assert.equal(rankRebornV04(q,model).status,"MISSING_REQUIRED_FEATURES");
});
test("rank is deterministic",()=>{
 const a=rankRebornV04(field,model);
 const b=rankRebornV04([...field].reverse(),model);
 assert.deepEqual(a.runners,b.runners);
});
