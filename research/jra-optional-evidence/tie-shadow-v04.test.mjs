import test from "node:test";
import assert from "node:assert/strict";
import {buildJraV04TieShadow} from "./tie-shadow-v04.mjs";
const base=[
 {horse_no:1,horse_name:"A",rank:1,validated_core_base_rate:0.4},
 {horse_no:2,horse_name:"B",rank:2,validated_core_base_rate:0.3},
 {horse_no:3,horse_name:"C",rank:3,validated_core_base_rate:0.3},
 {horse_no:4,horse_name:"D",rank:4,validated_core_base_rate:0.2},
];
const hist=(finish,margin)=>({
 prior_date:"2026-09-01",prior_track:"東京",prior_surface:"芝",
 prior_distance:1600,finish,margin_to_winner:margin,
 archive_match_count:1,final3f_rank:2,
});
const packet={race_date:"2026-10-18",track:"東京",runners:[
 {horse_no:1,horse_name:"A",past_race_content:[hist(1,0.4)],opponent_followups:[]},
 {horse_no:2,horse_name:"B",past_race_content:[hist(8,1.0)],opponent_followups:[]},
 {horse_no:3,horse_name:"C",past_race_content:[hist(2,0.1)],opponent_followups:[]},
 {horse_no:4,horse_name:"D",past_race_content:[hist(1,0.2)],opponent_followups:[]},
]};
const opt={targetSurface:"芝",targetDistance:1600,targetTrack:"東京"};
test("same-base-rate group can reorder, other probability bands cannot",()=>{
 const x=buildJraV04TieShadow(base,packet,opt);
 assert.equal(x.status,"SHADOW_READY");
 assert.equal(x.runners.find(r=>r.horse_no===3).shadow_rank,2);
 assert.equal(x.runners.find(r=>r.horse_no===2).shadow_rank,3);
 assert.equal(x.runners.find(r=>r.horse_no===1).shadow_rank,1);
 assert.equal(x.runners.find(r=>r.horse_no===4).shadow_rank,4);
 assert.equal(x.rank_effect_on_saved_prediction,false);
});
test("missing one runner's comparable history freezes whole group",()=>{
 const b={...packet,runners:packet.runners.map(x=>
  x.horse_no===2?{...x,past_race_content:[]}:x)};
 const x=buildJraV04TieShadow(base,b,opt);
 assert.equal(x.reordered,false);
 assert.ok(x.safeguards.includes("NO_CHANGE_INCOMPLETE_EQUAL_RATE_BAND"));
});
test("no data is not treated as zero ability",()=>{
 const x=buildJraV04TieShadow(base,{...packet,runners:[]},opt);
 assert.equal(x.status,"FIELD_SIZE_DISAGREEMENT");
});
test("the baseline horse roster must exactly agree",()=>{
 const b={...packet,runners:packet.runners.map(x=>
  x.horse_no===1?{...x,horse_name:"WRONG"}:x)};
 assert.equal(buildJraV04TieShadow(base,b,opt).status,"INCOMPLETE_OR_CONFLICTING_BASE");
});
test("future history cannot affect quality",()=>{
 const b={...packet,runners:packet.runners.map(x=>x.horse_no===3?{
 ...x,past_race_content:[{...hist(1,0.4),prior_date:"2026-11-01"}]}:x)};
 const out=buildJraV04TieShadow(base,b,opt);
 assert.equal(out.reordered,false);
});
test("tied evidence preserves old ordering",()=>{
 const b={...packet,runners:packet.runners.map(x=>x.horse_no===2?{
 ...x,past_race_content:[hist(2,0.1)]}:x)};
 const out=buildJraV04TieShadow(base,b,opt);
 assert.equal(out.reordered,false);
});
test("winner margin is not a beaten gap",()=>{
 const b={...packet,runners:packet.runners.map(x=>x.horse_no===3?{
 ...x,past_race_content:[hist(1,1.5)]}:x)};
 const out=buildJraV04TieShadow(base,b,opt);
 assert.ok(out.runners.find(x=>x.horse_no===3).evidence_quality>1);
});
test("no rating if target turf/dirt conditions unknown",()=>{
 assert.equal(buildJraV04TieShadow(base,packet,{...opt,targetSurface:null}).status,
  "INVALID_TARGET_CONDITIONS");
});
test("all runners remain present with contiguous ranks",()=>{
 const out=buildJraV04TieShadow(base,packet,opt);
 assert.deepEqual([...out.runners.map(r=>r.shadow_rank)].sort((a,b)=>a-b),[1,2,3,4]);
});
