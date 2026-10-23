import test from "node:test";
import assert from "node:assert/strict";
import {auditJraV04Race} from "./race-evidence-audit.mjs";

const hist={
 prior_date:"2025-12-14",prior_track:"阪神",prior_surface:"芝",
 prior_distance:1600,finish:2,margin_to_winner:0.2,
 archive_match_count:1,race_name:"阪神JF",final3f_rank:1,
};
const rival={
 historical_race_date:"2025-12-14",historical_target_finish:2,
 rival_name:"スターアニス",later_date:"2026-04-12",
 later_race:"桜花賞",later_finish:1
};
const bundle={
 race_date:"2026-10-18",runners:[{
 horse_no:1,horse_name:"ギャラボーグ",
 past_race_content:[hist],opponent_followups:[rival]
 },{
 horse_no:2,horse_name:"無関係馬",
 past_race_content:[],opponent_followups:[]
 }]
};
const options={targetSurface:"芝",targetDistance:1800};

test("verified content and rival information is observable",()=>{
 const x=auditJraV04Race(bundle,options);
 assert.equal(x.status,"READY");
 assert.equal(x.runners[0].full_content_verified_count,1);
 assert.equal(x.runners[0].verified_fast3f_runs,1);
 assert.equal(x.runners[0].competitive_near_condition_runs,1);
 assert.equal(x.runners[0].rival_followup_results,1);
 assert.ok(x.runners[0].facts.some(f=>f.text.includes("桜花賞")));
});
test("no comments nor historical data never blocks ranking",()=>{
 const x=auditJraV04Race(bundle,options);
 assert.equal(x.runners[1].prior_history_count,0);
 assert.equal(x.usable_without_extra_comments,true);
 assert.equal(x.scoring_status,"BASELINE_UNCHANGED");
 assert.equal(x.runners[1].score_effect,0);
});
test("future race results never enter evidence",()=>{
 const x=auditJraV04Race({
 ...bundle,runners:[{...bundle.runners[0],opponent_followups:[
 {...rival,later_date:"2026-11-01"}
 ]}]
 },options);
 assert.equal(x.runners[0].rival_followup_results,0);
});
test("post-target history is removed",()=>{
 const x=auditJraV04Race({
 ...bundle,runners:[{...bundle.runners[0],past_race_content:[
 {...hist,prior_date:"2026-11-01"}
 ],opponent_followups:[]
 }]
 },options);
 assert.equal(x.runners[0].prior_history_count,0);
 assert.equal(x.runners[0].verified_fast3f_runs,0);
});
test("duplicate horses make enrichment invalid without throwing",()=>{
 const x=auditJraV04Race({...bundle,runners:[bundle.runners[0],bundle.runners[0]]},options);
 assert.equal(x.status,"DUPLICATE_OR_INVALID_RUNNERS");
 assert.equal(x.rank_effect,false);
});
test("ambiguous archive match cannot verify top speed",()=>{
 const x=auditJraV04Race({...bundle,runners:[{
 ...bundle.runners[0],past_race_content:[{...hist,archive_match_count:2}],
 opponent_followups:[rival]
 }]},options);
 assert.equal(x.runners[0].verified_fast3f_runs,0);
 assert.equal(x.runners[0].rival_followup_results,0);
});
test("no surface history is uncertainty not negative score",()=>{
 const x=auditJraV04Race(bundle,{targetSurface:"ダート",targetDistance:1800});
 assert.equal(x.runners[0].same_surface_runs,0);
 assert.equal(x.runners[0].score_effect,0);
 assert.ok(x.runners[0].caveats.some(c=>c.includes("適性不明")));
});
test("does not manufacture a finish rank or override eye",()=>{
 const x=auditJraV04Race(bundle,options);
 assert.equal(x.rank_effect,false);
 assert.equal(x.eye_effect,false);
 assert.equal(x.runners[0].estimated_finish,null);
 assert.equal(x.runners[0].recommended_ability_score,null);
});
test("missing race packet returns safe no-op",()=>{
 const x=auditJraV04Race(null,options);
 assert.equal(x.status,"INVALID_OR_MISSING_EVIDENCE");
 assert.equal(x.score_effect,0);
});
test("wrong rival historical date is removed",()=>{
 const x=auditJraV04Race({...bundle,runners:[{
 ...bundle.runners[0],opponent_followups:[
 {...rival,historical_race_date:"2025-01-01"}
 ]}]},options);
 assert.equal(x.runners[0].rival_followup_results,0);
});
