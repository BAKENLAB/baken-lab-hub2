import test from 'node:test';
import assert from 'node:assert/strict';
import {replayArchivedLocalRace,summarizeArchivedLocalReplays}
 from './local-archive-replay-v06.mjs';

const race=()=>{
 const runners=Array.from({length:8},(_,i)=>({
  horse_no:i+1,horse_name:'架空馬'+(i+1),rank:i+1,
  history:i===5?[{date:'2026-08-20',track:'園田',
   class:'Ｃ２二３歳以上',finish:3,surface:'ダート',distance:1230,
   early_pos:9,final_turn_pos:4}]:[]
 }));
 return {race_date:'2026-11-11',track:'園田',race_no:7,
  race_name:'Ｃ２一３歳以上特別',post_time:'2026-11-11 04:50:00+00',
  frozen_at:'2026-11-11 03:21:18.878311+00',
  retrospective_course_metadata:{surface:'ダート',distance:1230},
  retrospective_finishers:[{horse_no:6,finish:1},{horse_no:2,finish:2},{horse_no:8,finish:3}],
  runners};
};
test('archive replay never obtains official certified status',()=>{
 const src=race(),before=structuredClone(src),inputs=[];
 const out=replayArchivedLocalRace(src,{evaluator:input=>{
  inputs.push(input);
  return {status:'REORDERED',model_version:'ABILITY_RELATIVE_V0_6',top5:[1,2,3,4,6]};
 }});
 assert.equal(out.eligible_for_official_metrics,false);
 assert.equal(out.certified_improvements,0);
 assert.equal(out.official_frozen_modified,false);
 assert.equal(out.claim_started,false);
 assert.equal(out.retrospective_newly_captured,1);
 assert.equal(out.retrospective_lost_captured,0);
 assert.equal(inputs.length,1);
 assert.equal(inputs[0].race.post_time,'2026-11-11T04:50:00+00:00');
 assert.equal(inputs[0].race.observation_at,'2026-11-11T03:21:18.878311+00:00');
 assert.equal(inputs[0].comparison.runner_evidence.length,8);
 assert.equal('finishers' in inputs[0].race,false);
 assert.equal('result' in inputs[0].race,false);
 assert.equal(inputs[0].comparison.market_used,false);
 assert.equal(inputs[0].comparison.target_result_used,false);
 assert.deepEqual(src,before);
});
test('future or target-day archive rows are rejected before evaluator',()=>{
 const src=race();src.runners[5].history[0].date='2026-11-11';
 const out=replayArchivedLocalRace(src,{evaluator:()=>{throw Error('MUST_NOT_RUN')}});
 assert.equal(out.status,'SKIPPED');
 assert.equal(out.reason,'FUTURE_OR_INVALID_HISTORY');
});
test('post-race freeze and invalid baseline cannot be treated as replay evidence',()=>{
 const first=race();first.frozen_at='2026-11-11 05:00:00+00';
 const a=replayArchivedLocalRace(first,{evaluator:()=>{throw Error('MUST_NOT_RUN')}});
 assert.equal(a.reason,'NOT_VERIFIED_FROZEN_BEFORE_POST');
 const second=race();second.runners[5].rank=5;
 const b=replayArchivedLocalRace(second,{evaluator:()=>{throw Error('MUST_NOT_RUN')}});
 assert.equal(b.reason,'INCOMPLETE_FROZEN_BASELINE');
});
test('old winner must be reported as lost if a real podium horse leaves TOP5',()=>{
 const src=race();src.retrospective_finishers[0].horse_no=5;
 const out=replayArchivedLocalRace(src,{evaluator:()=>({
  status:'REORDERED',model_version:'ABILITY_RELATIVE_V0_6',
  top5:[1,2,3,4,6]})});
 assert.equal(out.retrospective_lost_captured,1);
 assert.equal(out.retrospective_newly_captured,0);
});
test('cohort totals never count archival information as certified uplift',()=>{
 const src=race(),result=summarizeArchivedLocalReplays([src,src],{
  evaluator:()=>({status:'REORDERED',top5:[1,2,3,4,6],model_version:'ABILITY_RELATIVE_V0_6'})});
 assert.equal(result.model_evaluable,2);
 assert.equal(result.retrospective_newly_captured,2);
 assert.equal(result.certified_improvements,0);
 assert.equal(result.eligible_for_official_metrics,false);
});
