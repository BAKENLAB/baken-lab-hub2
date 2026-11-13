import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalV17IndependentShadow as v17} from
 '../automation/local-v17-full-field-independent-shadow.mjs';
import {buildLocalRelativeConditionComparison} from
 '../automation/local-relative-condition-comparison.mjs';

const date='2026-11-13',past='2026-10-15';
const witnessUrl='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?'+
 'k_babaCode=27&k_raceDate=2026%2F10%2F15&k_raceNo=2';
function fixture(){
 const race={circuit:'LOCAL',race_date:date,track:'園田',race_no:7,
  race_name:'C2一3歳以上',class_name:'C2',surface:'ダート',
  distance:1400,observation_at:'2026-11-13T11:45:00+09:00',
  post_time:'2026-11-13T14:00:00+09:00'};
 const finishes=[1,1,2,2,3,3,4,5,6,7];
 const compact=finishes.map((finish,i)=>({
  horse_no:i+1,horse_name:'架空馬'+(i+1),recent_runs:[{
   race_date:past,track:'園田',race_no:2,race_name:'C2二3歳以上',
   surface:'ダート',distance:1400,finish,margin:null,
   early_pos:i===5?9:2,final_turn_pos:3
  }]
 }));
 const comparison=buildLocalRelativeConditionComparison(compact,
  {surface:'ダート',distance:1400},date);
 assert.equal(comparison.status,'READY');
 const witness={horse_no:6,horse_name:'架空馬6',
  evidence_ref:'COMPACT_V1.runners[horse_no=6].recent_runs[0]',
  race_date:past,track:'園田',race_no:2,
  early_pos:9,final_turn_pos:3,official_source_ref:witnessUrl,
  source_checked_at:'2026-11-13T11:40:00+09:00',
  verification_scope:'VERIFIED_PRECLAIM_OFFICIAL_PAST_RESULT'};
 return {race,comparison,witness};
}
function certified(fx,changes={}){
 const c=structuredClone(fx.comparison);
 c.corner_evidence_scope='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY';
 c.corner_enriched_prior_runs=1;
 c.verified_corner_witnesses=[{...fx.witness,...changes}];
 return c;
}
test('same history: old profile corners no bonus; exact independently verified corner advances score and top5',()=>{
 const x=fixture(),plain=v17({race:x.race,comparison:x.comparison});
 const enriched=v17({race:x.race,comparison:certified(x)});
 assert.equal(plain.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(enriched.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.deepEqual(plain.top5,[1,2,3,4,5]);
 assert.deepEqual(enriched.top5,[1,2,3,4,6]);
 const old=plain.ability_evidence_audit.find(h=>h.horse_no===6);
 const now=enriched.ability_evidence_audit.find(h=>h.horse_no===6);
 assert.equal(old.runs[0].corner_position_bonus,0);
 assert.equal(now.runs[0].corner_position_bonus,3);
 assert.equal(now.independently_verified_corner_runs,1);
 assert.equal(now.runs[0].corner_reason,'VERIFIED_LATE_CORNER_ADVANCE_PLUS_PODIUM');
 assert.equal(now.runs[0].certified_official_corner_source,witnessUrl);
 assert.equal(now.runs[0].corner_verification_status,'EXACT_VERIFIED_PRECLAIM_OFFICIAL_PAST_RESULT');
 assert.ok(now.independent_score>old.independent_score);
 assert.equal(enriched.official_corner_witness_status,'VERIFIED_PRECLAIM_CORNER_WITNESSES');
 assert.equal(enriched.official_corner_witness_count,1);
 assert.equal(enriched.production_rank_effect,false);
 assert.equal(enriched.frozen_modified,false);
});
test('same official history but absent certificate never gains position points',()=>{
 const x=fixture(),copy=structuredClone(x.comparison);
 copy.runner_evidence[5].context_runs[0].early_pos=9;
 copy.runner_evidence[5].context_runs[0].final_turn_pos=3;
 const p=v17({race:x.race,comparison:copy});
 assert.equal(p.ability_evidence_audit[5].corner_bonus_points,0);
 assert.equal(p.official_corner_witness_count,0);
});
test('post-observation witness, spoofed result URL and wrong historical race are all rejected',()=>{
 for(const change of [
  {source_checked_at:'2026-11-13T11:46:00+09:00'},
  {source_checked_at:'2026-11-13T14:01:00+09:00'},
  {official_source_ref:'https://fake.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable'},
  {race_no:3},{horse_name:'別の馬'},{early_pos:8},
  {verification_scope:'UNVERIFIED_HORSE_PROFILE'}
 ]){
  const x=fixture(),p=v17({race:x.race,comparison:certified(x,change)});
  assert.equal(p.status,'UNVERIFIED',JSON.stringify(change));
  assert.match(p.reason,/^CORNER_WITNESS_/);
  assert.equal(p.production_rank_effect,false);
 }
});
test('invalid scope or mismatched witness count fails closed',()=>{
 const x=fixture(),scope=certified(x);
 scope.corner_enriched_prior_runs=2;
 const bad=v17({race:x.race,comparison:scope});
 assert.equal(bad.reason,'CORNER_WITNESS_SCOPE_OR_COUNT_UNVERIFIED');
 const wrong=certified(x);wrong.verified_corner_witnesses.push({...x.witness});
 assert.equal(v17({race:x.race,comparison:wrong}).status,'UNVERIFIED');
});
test('verified historical 9th place is not rewarded as a brave corner advance',()=>{
 const x=fixture(),r=x.comparison.runner_evidence[5];
 r.context_runs[0].finish=9;r.supporting_runs[0].finish=9;
 const ordinary=v17({race:x.race,comparison:x.comparison});
 const enriched=v17({race:x.race,comparison:certified(x)});
 assert.equal(ordinary.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(enriched.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(enriched.ability_evidence_audit.find(h=>h.horse_no===6).corner_bonus_points,0);
 assert.equal(enriched.ability_evidence_audit.find(h=>h.horse_no===6).independent_score,
   ordinary.ability_evidence_audit.find(h=>h.horse_no===6).independent_score);
});
test('official alternate condition podium does not become same-condition corner bonus',()=>{
 const x=fixture();
 x.comparison.runner_evidence[5].context_runs[0].track='佐賀';
 x.comparison.runner_evidence[5].context_runs[0].race_no=2;
 const moved={...x.witness,track:'佐賀',
  official_source_ref:witnessUrl.replace('k_babaCode=27','k_babaCode=32')};
 const p=v17({race:x.race,comparison:certified(x,moved)});
 assert.equal(p.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(p.ability_evidence_audit.find(h=>h.horse_no===6).corner_bonus_points,0);
});
