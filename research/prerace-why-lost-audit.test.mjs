import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPreRaceLossEvidence} from '../automation/prerace-why-lost-audit.mjs';
const clock=()=>Date.parse('2026-11-08T09:40:00+09:00');
const targetRace={
 raceDate:'2026-11-08',track:'福島',raceNo:3,
 postTime:'2026-11-08T10:45:00+09:00',
 surface:'ダート',distance:1700,className:'1勝クラス'
};
const source={kind:'JRA_CLAIMED_CONTEXT',verified:true,checkedAt:'2026-11-08T09:30:00+09:00'};
const runners=[
 {horse_no:11,horse_name:'ギンケイ',past_runs:[
  {race_date:'2026-07-04',track:'函館',surface:'ダート',distance:1700,
   finish:1,margin_to_winner:0.1,early_pos:11,final_turn_pos:5,
   final3f:37.8,race_class:'未勝利',field_size:16},
  {race_date:'2026-04-19',track:'中山',surface:'ダート',distance:1800,
   finish:2,margin_to_winner:0,early_pos:3,final_turn_pos:2,
   final3f:38.1,field_size:12}
 ]},
 {horse_no:15,horse_name:'プレイメイカー',past_runs:[
  {race_date:'2026-04-05',track:'中山',surface:'ダート',distance:1800,
   finish:2,margin_to_winner:0.1,early_pos:1,final_turn_pos:1,
   lap_times:[12.5,12.6,13.1,12.7,13.0,12.4,13.1,12.9,12.6]},
  {race_date:'2026-01-25',track:'中山',surface:'ダート',distance:1800,
   finish:1,margin_to_winner:0.7,early_pos:1,final_turn_pos:1}
 ]}
];
const run=(o={})=>auditPreRaceLossEvidence({
 targetRace,runners,source,clock,...o
});
test('evidence only: track, distance, close finish and passing-order clues',()=>{
 const result=run();
 assert.equal(result.verified_runner_count,2);
 assert.equal(result.ranking_effect,'NONE');
 assert.equal(result.save_gate_effect,'NONE');
 assert.equal(result.market_used,false);
 assert.equal(result.causal_claims_allowed,false);
 assert.equal(result.target_result_used,false);
 const x=result.runners[0].records[0];
 assert.equal(x.course_match.near_course_distance,true);
 assert.equal(x.course_match.same_track,false);
 assert.equal(x.clues[0].code,'ADVANCED_BEFORE_FINAL_TURN');
 assert.equal(x.true_loss_cause,'UNPROVEN');
 assert.equal(x.opponent_level,'UNKNOWN_UNLESS_INDEPENDENT_RIVALS_VERIFIED');
 assert.ok(x.missed_facts.includes('RACE_LAPS_MISSING'));
});
test('valid split arrays can be recorded but cannot prove high/slow pace',()=>{
 const x=run().runners[1].records[0];
 assert.equal(x.lap_evidence.status,'SPLITS_PRESENT_200M_ASSUMED');
 assert.equal(x.lap_evidence.first_600m,38.2);
 assert.equal(x.lap_evidence.last_600m,38.6);
 assert.equal(x.lap_evidence.pace_classification,'UNDETERMINED');
 assert.equal(x.lap_evidence.comparability,'NEEDS_TRACK_DISTANCE_CLASS_REFERENCE');
});
test('runner with absent corner and lap evidence gets explicit missing flags',()=>{
 const x=run({runners:[{horse_no:1,horse_name:'別馬',past_runs:[{
  race_date:'2026-10-01',track:'福島',surface:'ダート',distance:1700,
  finish:9,margin_to_winner:2.2,early_pos:9
 }]}]}).runners[0].records[0];
 assert.equal(x.early_pos,9);
 assert.equal(x.final_turn_pos,null);
 assert.equal(x.lap_evidence.status,'LAPS_UNAVAILABLE');
 assert.ok(x.missed_facts.includes('CORNER_SEQUENCE_INCOMPLETE'));
 assert.ok(x.missed_facts.includes('LAST_3F_MISSING'));
 assert.equal(x.clues.length,0);
});
test('possible lost-position clue is observational, not a proven cause',()=>{
 const x=run({runners:[{horse_no:9,horse_name:'検証馬',past_runs:[{
  race_date:'2026-10-10',track:'福島',surface:'ダート',distance:1700,
  finish:10,margin_to_winner:2.2,early_pos:2,final_turn_pos:9
 }]}]}).runners[0].records[0];
 assert.equal(x.clues[0].code,'LOST_POSITION_BEFORE_FINAL_TURN');
 assert.equal(x.true_loss_cause,'UNPROVEN');
});
test('no post-target evidence, market or target outcome can leak through',()=>{
 const x=run({runners:[{horse_no:1,horse_name:'検証馬',past_runs:[
  {race_date:'2026-11-08',track:'福島',finish:1,popularity:1,odds:2},
  {race_date:'2026-10-20',track:'東京',finish:2,margin_to_winner:0.2,
   popularity:1,odds:1.4}
 ]}]}).runners[0];
 assert.equal(x.excluded_unverified_or_future,1);
 assert.equal(x.records.length,1);
 assert.equal('odds' in x.records[0],false);
 assert.equal('popularity' in x.records[0],false);
});
test('unverified, stale or after-start data cannot enter the audit',()=>{
 assert.throws(()=>run({source:{...source,verified:false}}),/UNVERIFIED/);
 assert.throws(()=>run({clock:()=>Date.parse(targetRace.postTime)}),/UNVERIFIED/);
 assert.throws(()=>run({source:{...source,checkedAt:'2026-11-05T09:40:00+09:00'}}),/UNVERIFIED/);
});
test('duplicate runner number or name is rejected',()=>{
 assert.throws(()=>run({runners:[runners[0],runners[0]]}),/IDENTITY_MISMATCH/);
 assert.throws(()=>run({runners:[runners[0],{...runners[1],horse_name:'ギンケイ'}]}),/IDENTITY_MISMATCH/);
});
test('LOCAL official prior races support the same guardrails',()=>{
 const x=run({
  source:{...source,kind:'LOCAL_OFFICIAL_PAST_RESULT'},
  runners:[{horseNo:1,horseName:'地方馬',verifiedRecentRuns:[{
   raceDate:'2026-10-01',track:'盛岡',surface:'ダート',distance:1600,
   finish:3,marginToWinner:0.4,earlyPos:10,finalTurnPos:4
  }]}]
 });
 assert.equal(x.runners[0].records[0].clues.length,2);
 assert.equal(x.status,'EVIDENCE_ONLY_NOT_YET_SCORED');
});
