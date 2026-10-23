import test from "node:test";
import assert from "node:assert/strict";
import { analyzePastRace } from "./race-content-evidence.mjs";

const race={
  race_date:"2025-12-14",track:"阪神",race_no:11,
  race_name:"阪神ジュベナイルフィリーズ",class_name:"オープン",
  surface:"芝",distance:1600,field_size:3,going:"良",archive_complete:false,
};
const field=[
  {horse_no:9,horse_name:"スターアニス",horse_ref:"star",finish:1,draw:5,
    corner_positions:"8 7",final_turn_pos:7,final3f:34.5,final3f_rank:2,time_raw:"1:32.6"},
  {horse_no:5,horse_name:"ギャラボーグ",horse_ref:"gal",finish:2,draw:3,
    corner_positions:"12 13",final_turn_pos:13,final3f:34.3,final3f_rank:1,time_raw:"1:32.8"},
  {horse_no:17,horse_name:"タイセイボーグ",horse_ref:"taisei",finish:3,draw:8,
    corner_positions:"6 6",final_turn_pos:6,final3f:35.0,final3f_rank:7,time_raw:"1:32.9"},
];
const history=[
  {horse_ref:"star",race_date:"2026-04-12",race_name:"桜花賞",finish:1},
  {horse_ref:"star",race_date:"2026-05-24",race_name:"優駿牝馬",finish:12},
  {horse_ref:"star",race_date:"2026-11-01",race_name:"未来のレース",finish:1},
  {horse_ref:"gal",race_date:"2026-04-12",race_name:"桜花賞",finish:2},
  {horse_ref:"other",race_date:"2026-04-12",race_name:"桜花賞",finish:1},
];
const base={race,run:field[1],field,opponentHistory:history,
  asOf:"2026-10-18T15:40:00+09:00"};

test("observed race results not invented race excuses",()=>{
  const r=analyzePastRace(base);
  assert.equal(r.status,"READY");
  assert.equal(r.horse.finish,2);
  assert.deepEqual(r.horse.corner_positions,[12,13]);
  assert.equal(r.horse.final3f_rank,1);
  assert.equal(r.horse.margin_to_winner_seconds,0.2);
  assert.equal(r.horse.position_gain_final_turn_to_finish,11);
  assert.ok(r.facts.some(x=>x.includes("勝ち馬と0.2秒差")));
  assert.ok(r.facts.every(x=>!/出遅れ|不利|接触|大外/.test(x)));
  assert.equal(r.ability_score,null);
  assert.equal(r.evaluation_comment,null);
});
test("later winner evidence attributable by id but not a bonus",()=>{
  const r=analyzePastRace(base);
  assert.equal(r.opponent_followups.length,2);
  assert.ok(r.opponent_followups.every(x=>x.horse_name==="スターアニス"));
  assert.equal(r.opponent_followups[0].race_name,"桜花賞");
  assert.equal(r.ability_score,null);
});
test("future results blocked by cutoff",()=>{
  const r=analyzePastRace({...base,asOf:"2026-04-01T09:00:00+09:00"});
  assert.equal(r.opponent_followups.length,0);
});
test("same-day historical race blocked even at night",()=>{
  const r=analyzePastRace({...base,asOf:"2025-12-14T23:00:00+09:00"});
  assert.equal(r.status,"NOT_HISTORIC_AS_OF");
});
test("timestamps without time zone blocked",()=>{
  const r=analyzePastRace({...base,asOf:"2026-10-18T15:40:00"});
  assert.equal(r.status,"NOT_HISTORIC_AS_OF");
});
test("cutoff normalized to Asia/Tokyo from UTC",()=>{
  const r=analyzePastRace({...base,asOf:"2026-10-17T15:00:00Z"});
  assert.equal(r.status,"READY");
});
test("wrong horse ref not paired by identical name",()=>{
  const r=analyzePastRace({...base,opponentHistory:[{
    horse_ref:"stranger",horse_name:"スターアニス",race_date:"2026-04-12",finish:1}]});
  assert.equal(r.opponent_followups.length,0);
});
test("partial field caveat and no hard failure",()=>{
  const r=analyzePastRace({...base,field:field.slice(0,2)});
  assert.equal(r.status,"READY");
  assert.equal(r.context.full_field,false);
  assert.ok(r.caveats.some(x=>x.includes("部分的")));
});
test("duplicate horse numbers are rejected",()=>{
  const r=analyzePastRace({...base,field:[...field,field[0]]});
  assert.equal(r.status,"FIELD_MISMATCH");
});
test("contradictory horse result is rejected",()=>{
  const r=analyzePastRace({...base,run:{...field[1],finish:1}});
  assert.equal(r.status,"FIELD_MISMATCH");
});
test("no finish time does not fabricate margin",()=>{
  const adjusted=field.map(r=>({...r,time_raw:null}));
  const r=analyzePastRace({...base,field:adjusted,run:adjusted[1]});
  assert.equal(r.horse.margin_to_winner_seconds,null);
});
test("does not require opponent followups or trainer quotes",()=>{
  const r=analyzePastRace({...base,opponentHistory:[]});
  assert.equal(r.status,"READY");
  assert.equal(r.opponent_followups.length,0);
});
test("2-win and maiden classes supported equally",()=>{
  for(const class_name of ["2勝クラス","未勝利","オープン"]){
    const r=analyzePastRace({...base,race:{...race,class_name}});
    assert.equal(r.status,"READY");
    assert.equal(r.ability_score,null);
  }
});
test("archive completeness cannot be inferred from field count",()=>{
  const r=analyzePastRace(base);
  assert.equal(r.context.full_field,true);
  assert.ok(r.caveats.some(x=>x.includes("完全性")));
});
