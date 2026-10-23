import test from "node:test";
import assert from "node:assert/strict";
import {buildJra06FeaturePanel,rankJra06Shadow,compareShadowOutcome} from "./modular-evidence-v06.mjs";
const recentRun=(o={})=>({
 prior_date:"2026-09-20",prior_track:"東京",prior_surface:"ダート",
 prior_distance:1400,prior_class:"1勝クラス",finish:2,margin_to_winner:0.1,
 archive_match_count:0,final3f_source:"LIVE_PAST_RUN_FALLBACK",
 final3f_rank:null,corner_positions:null,...o});
const olderRun=(o={})=>({
 date:"2025-05-24",track:"東京",surface:"ダート",distance:1600,
 class_name:"未勝利",finish:1,final3f_rank:2,
 older_than_recent_four:true,...o});
const base=[{horse_no:1,horse_name:"A",rank:1},{horse_no:2,horse_name:"B",rank:2}];
const packet={
 race_date:"2026-10-18",track:"東京",
 recent_evidence:{runners:[
 {horse_no:1,horse_name:"A",past_race_content:[recentRun(),recentRun({prior_date:"2026-08-01",finish:5,margin_to_winner:0.3})],opponent_followups:[]},
 {horse_no:2,horse_name:"B",past_race_content:[],opponent_followups:[]},
 ]},
 older_same_course_evidence:[
 {horse_no:1,horse_name:"A",older_same_surface_near_distance:[olderRun()]},
 {horse_no:2,horse_name:"B",older_same_surface_near_distance:[]},
 ]
};
const ctx={date:"2026-10-18",track:"東京",raceNo:8,surface:"ダート",distance:1400,className:"1勝クラス"};
const make=(p=packet,c=ctx,b=base)=>buildJra06FeaturePanel(b,p,c);
test("all four numeric components independently available",()=>{
 const p=make();const m=p.runners[0].metrics;
 assert.equal(p.status,"READY");
 assert.ok(m.historical_peak>0);
 assert.ok(m.recent_repeatability>0);
 assert.ok(m.course_distance_proof>0);
 assert.ok(m.current_class_proof>0);
});
test("missing evidence creates null components, not zero",()=>{
 const m=make().runners[1].metrics;
 assert.equal(m.historical_peak,null);
 assert.equal(m.recent_repeatability,null);
 assert.equal(m.course_distance_proof,null);
 assert.equal(m.current_class_proof,null);
});
test("older maiden win remains proof but discounted for 1-win class",()=>{
 const m=make().runners[0].metrics;
 const x=m.evidence.find(x=>x.older);
 assert.ok(x);
 assert.ok(x.adjusted_strength<1);
 assert.equal(x.comparable_current_class,false);
});
test("older placed result with missing gap is still evidence",()=>{
 const p={...packet,older_same_course_evidence:[{
 horse_no:1,horse_name:"A",older_same_surface_near_distance:[olderRun({finish:2})]},
 packet.older_same_course_evidence[1]]};
 const x=make(p).runners[0].metrics.evidence.find(x=>x.older);
 assert.ok(x.adjusted_strength>0);
 assert.equal(x.beaten_seconds,null);
});
test("archive presence never changes baseline strength",()=>{
 const same=recentRun();
 const a=make().runners[0].metrics.evidence.find(x=>x.date==="2026-09-20");
 const p={...packet,recent_evidence:{runners:[{
 ...packet.recent_evidence.runners[0],
 past_race_content:[{...same,archive_match_count:1,final3f_rank:1},
 recentRun({prior_date:"2026-08-01",finish:5,margin_to_winner:0.3})]},packet.recent_evidence.runners[1]]}};
 const b=make(p).runners[0].metrics.evidence.find(x=>x.date==="2026-09-20");
 assert.equal(a.adjusted_strength,b.adjusted_strength);
 assert.equal(b.final3f_rank,1);
});
test("horse ID or name mismatch closes just the enrichment panel",()=>{
 const p={...packet,recent_evidence:{runners:[
 {...packet.recent_evidence.runners[0],horse_name:"WRONG"},packet.recent_evidence.runners[1]]}};
 assert.equal(make(p).status,"HORSE_IDENTITY_MISMATCH");
});
test("future historical race or subsequent opponent results excluded",()=>{
 const p={...packet,recent_evidence:{runners:[
 {...packet.recent_evidence.runners[0],
 past_race_content:[recentRun({prior_date:"2026-11-01"})],
 opponent_followups:[{historical_race_date:"2026-09-20",later_date:"2026-12-01",rival_name:"X"}]},
 packet.recent_evidence.runners[1]]}};
 const m=make(p).runners[0].metrics;
 assert.equal(m.evidence.length,1); // older historical win only
 assert.equal(m.context_only.known_rival_followup_results,0);
});
test("turf performance is not reused as dirt proof",()=>{
 const p={...packet,recent_evidence:{runners:[
 {...packet.recent_evidence.runners[0],
 past_race_content:[recentRun({prior_surface:"芝"})]},
 packet.recent_evidence.runners[1]]},
 older_same_course_evidence:packet.older_same_course_evidence.map(x=>({...x,older_same_surface_near_distance:[]}))};
 const m=make(p).runners[0].metrics;
 assert.equal(m.historical_peak,null);
});
test("comments and odds do not affect any numeric component",()=>{
 const p=make();const variant=base.map(x=>({...x,win_odds:x.horse_no===1?1.1:999,popularity:1,comment:"great"}));
 const q=make(packet,ctx,variant);
 assert.deepEqual(p.runners.map(r=>r.metrics),q.runners.map(r=>r.metrics));
});
test("no alternative to frozen rank unless explicitly shadow called",()=>{
 const panel=make();
 assert.equal(panel.ranking_unchanged,true);
 assert.equal(panel.frozen_write,false);
 const shadow=rankJra06Shadow(panel);
 assert.equal(shadow.rank_effect_on_official,false);
 assert.deepEqual(shadow.runners.map(x=>x.shadow_rank).sort(),[1,2]);
});
test("blank or mismatched packet fails without affecting original rank",()=>{
 const p=make({...packet,race_date:"2026-10-19"});
 assert.equal(p.status,"INVALID_RACE_PACKET");
 assert.equal(p.ranking_unchanged,true);
});
test("one winning run not erased by bad run in separate peak component",()=>{
 const m=make().runners[0].metrics;
 const last=m.evidence.find(x=>x.date==="2026-08-01");
 assert.ok(m.historical_peak>last.adjusted_strength);
});


test("unranked frozen runner makes shadow SKIPPED, never zero-hit loss",()=>{
 const unranked=[{horse_no:1,horse_name:"A",rank:1},{horse_no:2,horse_name:"B",rank:null}];
 const panel=buildJra06FeaturePanel(unranked,packet,ctx);
 const shadow=rankJra06Shadow(panel);
 const report=compareShadowOutcome(unranked,shadow,[
  {horse_no:1,horse_name:"A",finish:1},
  {horse_no:2,horse_name:"B",finish:2}
 ]);
 assert.equal(panel.status,"INVALID_ROSTER_OR_RANKS");
 assert.equal(report.status,"SHADOW_SKIPPED");
 assert.equal(report.baseline_caught,1);
 assert.equal(report.shadow_caught,null);
});
test("gain and loss counted horse-by-horse rather than net only",()=>{
 const report=compareShadowOutcome(base,{status:"SHADOW_READY",runners:[
 {horse_no:1,shadow_rank:2},{horse_no:2,shadow_rank:6}]},[
 {horse_no:1,horse_name:"A",finish:1},{horse_no:2,horse_name:"B",finish:2}
 ]);
 assert.equal(report.status,"COMPARABLE");
 assert.equal(report.baseline_caught,2);
 assert.equal(report.shadow_caught,1);
 assert.equal(report.lost.length,1);
});


test("archive string corner order is interpreted and non-scoring pace is separate",()=>{
 const source=recentRun({prior_date:"2026-09-20",
  archive_match_count:1,final3f_rank:2,corner_positions:"8 7 6",
  race_halons:"12.0 - 11.2 - 11.8 - 12.5 - 12.6 - 12.7",finish:4});
 const p={...packet,recent_evidence:{runners:[{
  ...packet.recent_evidence.runners[0],past_race_content:[source]},
  packet.recent_evidence.runners[1]]}};
 const panel=make(p);
 const m=panel.runners[0].metrics;
 assert.equal(m.context_only.runs_with_corners,1);
 assert.equal(m.context_only.runs_gaining_places_after_final_turn,1);
 assert.equal(m.context_only.high_early_pace_races,1);
 const signal=m.historical_peak;
 const q={...packet,recent_evidence:{runners:[{
  ...packet.recent_evidence.runners[0],past_race_content:[{
   ...source,race_halons:null,corner_positions:null,final3f_rank:null}]},
  packet.recent_evidence.runners[1]]}};
 assert.equal(make(q).runners[0].metrics.historical_peak,signal);
});
