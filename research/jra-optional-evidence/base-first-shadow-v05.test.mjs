import test from "node:test";
import assert from "node:assert/strict";
import {inspectV05Horse,compareV05EqualBands} from "./base-first-shadow-v05.mjs";
const h=(date,finish,margin,archive=1)=>({
 prior_date:date,prior_track:"中山",prior_surface:"芝",
 prior_distance:2000,finish,margin_to_winner:margin,
 prior_class:"1勝クラス",archive_match_count:archive,
 final3f_rank:archive===1?4:null
});
const C={date:"2026-10-17",track:"新潟",surface:"芝",distance:2200,className:"1勝クラス"};
test("valid 2nd place survives missing detail archive",()=>{
 const r=inspectV05Horse({past_race_content:[h("2026-09-20",2,0.1,0)]},C);
 assert.equal(r.status,"COMPARABLE_BASE_FACTS");
 assert.equal(r.sources.length,1);
 assert.ok(r.quality>0.6);
 assert.equal(r.sources[0].detailed,false);
});
test("missing rich detail alone cannot reduce base score",()=>{
 const yes=inspectV05Horse({past_race_content:[h("2026-09-20",2,0.1,1)]},C);
 const no=inspectV05Horse({past_race_content:[h("2026-09-20",2,0.1,0)]},C);
 assert.equal(yes.quality,no.quality);
});
test("past later-than-forecast finishes are barred",()=>{
 const r=inspectV05Horse({past_race_content:[h("2026-11-01",1,0.5,1)]},C);
 assert.equal(r.quality,null);
});
test("recent defeat does not erase one good historic effort",()=>{
 const r=inspectV05Horse({past_race_content:[
 h("2026-09-20",9,0.9,1),h("2026-07-20",2,0.1,1)]},C);
 assert.ok(r.max_effort>0.7);
 assert.ok(r.quality>0.5);
});
test("missing a whole running-history block yields unknown not negative",()=>{
 const r=inspectV05Horse({past_race_content:[]},C);
 assert.equal(r.quality,null);
});
test("winner's margin does not become a beaten deficit",()=>{
 const r=inspectV05Horse({past_race_content:[h("2026-09-20",1,1.4,1)]},C);
 assert.ok(r.quality>0.8);
});
test("strong lower-class form is bounded but never zeroed",()=>{
 const r=inspectV05Horse({past_race_content:[
 {...h("2026-09-20",1,0.3),prior_class:"未勝利"}]},C);
 assert.ok(r.quality>0.6&&r.quality<1);
});
test("win-rate tie is still required for any shadow reorder",()=>{
 const b=[
 {horse_no:1,horse_name:"A",rank:1,validated_core_base_rate:0.5},
 {horse_no:2,horse_name:"B",rank:2,validated_core_base_rate:0.4},
 ];
 const packet={race_date:"2026-10-17",track:"新潟",runners:[
 {horse_no:1,horse_name:"A",past_race_content:[h("2026-09-20",10,2.0)]},
 {horse_no:2,horse_name:"B",past_race_content:[h("2026-09-20",1,0.1)]},
 ]};
 const r=compareV05EqualBands(b,packet,{
  targetSurface:"芝",targetDistance:2200,targetTrack:"新潟",targetClass:"1勝クラス"});
 assert.equal(r.status,"V05_SHADOW_READY");
 assert.equal(r.changes.length,0);
});
test("missing runners never mutate frozen predictions",()=>{
 const b=[{horse_no:1,horse_name:"A",rank:1,validated_core_base_rate:0.3},
 {horse_no:2,horse_name:"B",rank:2,validated_core_base_rate:0.3}];
 const packet={race_date:"2026-10-17",track:"新潟",runners:[
 {horse_no:1,horse_name:"A",past_race_content:[h("2026-09-20",1,0.5)]},
 {horse_no:2,horse_name:"B",past_race_content:[]}
 ]};
 const out=compareV05EqualBands(b,packet,{
  targetSurface:"芝",targetDistance:2200,targetTrack:"新潟",targetClass:"1勝クラス"});
 assert.equal(out.changes.length,0);
 assert.ok(out.declined_reasons.includes("MISSING_COMPARABLE_BASIC_HISTORY"));
 assert.equal(out.rank_effect_on_saved,false);
});
