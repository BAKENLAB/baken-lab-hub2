import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalV17IndependentShadow as v17} from '../automation/local-v17-full-field-independent-shadow.mjs';

const race={
 circuit:'LOCAL',race_date:'2026-11-10',track:'名古屋',race_no:6,
 race_name:'C2組',class_name:'C2',surface:'ダート',distance:1500,
 observation_at:'2026-11-09T23:15:00Z',
 post_time:'2026-11-10T15:00:00+09:00'
};
const run=(n,i,finish,overrides={})=>({
 race_date:i===0?'2026-10-20':'2026-09-20',
 track:'名古屋',class:'C2',surface:'ダート',distance:1500,finish,
 evidence_ref:'COMPACT_V1.runners[horse_no='+n+'].recent_runs['+i+']',
 early_pos:2,final_turn_pos:3,...overrides
});
const make=()=>{
 const names=Array.from({length:12},(_,i)=>i+1);
 const runner_evidence=names.map(n=>({
  horse_no:n,horse_name:'馬'+n,
  supporting_runs:[run(n,0,7)],
  context_runs:[run(n,0,7),run(n,1,8)]
 }));
 const set=(n,history)=>{runner_evidence[n-1].context_runs=history};
 // Strong horse 9 from a DIFFERENT venue/distance must be considered,
 // independently of its old rank or original 1.6 score.
 set(9,[run(9,0,1,{track:'佐賀',distance:1300,class:'C1'}),
  run(9,1,1,{track:'東京',surface:'芝',distance:1800,class:'1勝クラス'})]);
 set(3,[run(3,0,1),run(3,1,2)]);
 set(2,[run(2,0,9),run(2,1,10)]);
 return {race:structuredClone(race),comparison:{
  status:'READY',
  data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY',
  target_date:race.race_date,market_used:false,target_result_used:false,
  rank_effect:false,score_effect:false,runner_evidence
 }};
};
test('v1.7 creates an independent 100pt full-field order with no old ranks or scores',()=>{
 const x=v17(make());
 assert.equal(x.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(x.all_runners_checked,12);
 assert.equal(x.runners.length,12);
 assert.equal(x.top5.length,5);
 assert.equal(x.runners.every(h=>Number.isInteger(h.score)&&h.score>=0&&h.score<=100),true);
 assert.equal(new Set(x.runners.map(h=>h.horse_no)).size,12);
 assert.equal(x.ability_evidence_audit.length,12);
 assert.equal(x.lab_eye_status,'ABSTAINED');
 assert.equal(x.eye_candidate,null);
 assert.equal(x.eye_all_outsider_audits.length,7);
 assert.equal(x.production_rank_effect,false);
 assert.equal(x.frozen_modified,false);
});
test('other track, surface and distance history is not discarded or coded as low ability',()=>{
 const x=v17(make());
 const a=x.ability_evidence_audit.find(x=>x.horse_no===9);
 assert.equal(a.evidence_runs_used,2);
 assert.equal(a.other_condition_runs,2);
 assert.equal(a.missing_information_penalty,0);
 assert.equal(a.runs.some(h=>h.track==='東京'),true);
 assert.equal(a.runs.some(h=>h.track==='佐賀'),true);
 assert.equal(a.runs.some(h=>h.context_band==='OTHER_TRACK'),true);
 assert.equal(x.top5.includes(9),true);
});
test('two old poor results do not become a market-based or missing-data penalty',()=>{
 const x=v17(make());
 const horse=x.ability_evidence_audit.find(h=>h.horse_no===2);
 assert.equal(horse.missing_information_penalty,0);
 assert.equal(horse.runs.filter(r=>r.finish>=9).length,2);
 assert.equal(x.market_used,false);
 assert.equal(x.target_result_used,false);
});
test('no after-start or target-day run can influence 1.7',()=>{
 const d=make();
 d.comparison.runner_evidence[8].context_runs[0].race_date=race.race_date;
 assert.equal(v17(d).reason,'HISTORY_IDENTITY_ASOF_OR_PROVENANCE_UNVERIFIED');
 const e=make();
 e.race.observation_at='2026-11-10T15:00:00+09:00';
 assert.equal(v17(e).reason,'RACE_OR_ASOF_UNVERIFIED');
});
test('empty history is unknown, not bottom-ranked with invented neutral score',()=>{
 const d=make();
 d.comparison.runner_evidence[4].context_runs=[];
 const x=v17(d);
 assert.equal(x.status,'UNVERIFIED');
 assert.equal(x.reason,'INSUFFICIENT_EVIDENCE_FOR_FAIR_WHOLE_FIELD_RANK');
 assert.equal(x.proposed_top5,null);
 assert.equal(x.missing[0].horse_no,5);
});
test('old 1.6 rank/score, target result or market are refused as evidence',()=>{
 const d=make();
 d.comparison.runner_evidence[8].baseline_rank=6;
 assert.equal(v17(d).reason,'COMPLETE_OFFICIAL_PRE_RACE_PACKET_UNVERIFIED');
 const e=make();
 e.comparison.runner_evidence[8].context_runs[0].odds=1.1;
 assert.equal(v17(e).reason,'COMPLETE_OFFICIAL_PRE_RACE_PACKET_UNVERIFIED');
 const f=make();
 f.race.result={winner:9};
 assert.equal(v17(f).reason,'RACE_OR_ASOF_UNVERIFIED');
});
test('requires full history, not same-distance-only filtered input',()=>{
 const d=make();
 delete d.comparison.runner_evidence[0].context_runs;
 assert.equal(v17(d).reason,'WHOLE_FIELD_IDENTITY_OR_HISTORY_UNVERIFIED');
});
test('duplicate horse identity and repeated history ref both fail closed',()=>{
 const d=make();
 d.comparison.runner_evidence[1].horse_no=1;
 assert.equal(v17(d).reason,'WHOLE_FIELD_IDENTITY_OR_HISTORY_UNVERIFIED');
 const e=make();
 e.comparison.runner_evidence[0].context_runs[1].evidence_ref=
  e.comparison.runner_evidence[0].context_runs[0].evidence_ref;
 assert.equal(v17(e).reason,'HISTORY_IDENTITY_ASOF_OR_PROVENANCE_UNVERIFIED');
});
test('future JST racedate is protected even when UTC observation is previous day',()=>{
 const d=make();
 assert.equal(v17(d).status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 const e=make();
 e.race.observation_at='2026-11-09T14:59:59Z';
 assert.equal(v17(e).reason,'RACE_OR_ASOF_UNVERIFIED');
});

test('1.7 EYE is separate from TOP5 and reviews all outsiders without auto rank6',()=>{
 const d=make();
 for(let n=1;n<=7;n++){
  d.comparison.runner_evidence[n-1].context_runs=[
   run(n,0,1),run(n,1,2)];
 }
 d.comparison.runner_evidence[11].context_runs=[
  run(12,0,2,{track:'佐賀',distance:1400,class:'C2'}),
  run(12,1,3,{track:'名古屋',distance:1500,class:'C2'})
 ];
 const x=v17(d);
 assert.equal(x.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(x.eye_all_outsider_audits.length,7);
 // The independent current evidence and two distinct races, not a
 // rank position, determine whether an outsider is interesting.
 const a=x.eye_all_outsider_audits.find(h=>h.horse_no===12);
 assert.equal(a?.prior_evidence_count,2);
 assert.equal(a?.eye_case,true);
 assert.equal(a?.independent_podium_refs.length,2);
 assert.equal(x.production_eye_effect,false);
 assert.equal(x.frozen_modified,false);
});

test('Kanazawa special 編成 must not treat ordinary C2 as proven equal class',()=>{
 const ordinary=make();
 ordinary.race.track='金沢';ordinary.race.race_name='C2十四組';ordinary.race.class_name='C2十四組';
 const special=structuredClone(ordinary);
 special.race.race_name='若菜&春樹 夫婦スタートC2十四特別編成';
 special.race.class_name=null;
 for(const data of [ordinary,special])
  for(const r of data.comparison.runner_evidence){
   for(const h of r.context_runs){h.track='金沢';h.class='C2';}
   for(const h of r.supporting_runs){h.track='金沢';h.class='C2';}
  }
 const baseline=v17(ordinary),changed=v17(special);
 assert.equal(baseline.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(changed.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(changed.special_selection_class_equivalence,'NOT_VERIFIED');
 const a=baseline.ability_evidence_audit.find(r=>r.horse_no===3);
 const b=changed.ability_evidence_audit.find(r=>r.horse_no===3);
 assert.equal(a.runs.every(x=>x.context_band==='SAME_OFFICIAL_CLASS'),true);
 assert.equal(b.runs.every(x=>x.context_band==='SPECIAL_SELECTION_CLASS_COMPARABILITY_UNVERIFIED'),true);
 assert.equal(b.runs.every(x=>x.class_equivalence_unverified===true),true);
 assert.equal(b.runs.every(x=>x.special_selection_class_match_suppressed===true),true);
 assert.ok(b.independent_score<a.independent_score);
 assert.equal(changed.production_rank_effect,false);
});
test('ordinary class comparison unchanged and special status does not invent absent history',()=>{
 const before=v17(make());
 assert.equal(before.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST');
 assert.equal(before.special_selection_class_equivalence,'NOT_APPLICABLE');
 const special=make();
 special.race.race_name='C2十四特別編成';
 special.comparison.runner_evidence[4].context_runs=[];
 const after=v17(special);
 assert.equal(after.status,'UNVERIFIED');
 assert.equal(after.reason,'INSUFFICIENT_EVIDENCE_FOR_FAIR_WHOLE_FIELD_RANK');
});

test('official Hyogo ability test lets a no-race debutant enter independent provisional all-horse comparison',()=>{
 const d=make();
 d.race={...d.race,race_date:'2026-11-11',track:'園田',race_no:1,
   race_name:'C3三',class_name:'C3',distance:1400,
   observation_at:'2026-11-11T10:15:00+09:00',
   post_time:'2026-11-11T10:40:00+09:00'};
 d.comparison.target_date=d.race.race_date;
 const current=d.comparison.runner_evidence[1];
 current.horse_name='エディットフォース';current.context_runs=[];
 current.supporting_runs=[];current.trainer='柏原誠路';current.sex_age='牡3';
 current.ability_test={
  horse_no:2,horse_name:'エディットフォース',source:'HYOGO_OFFICIAL_ABILITY_TEST',
  identity_method:'EXACT_NAME_AGE_TRAINER_NOT_STABLE_HORSE_ID',
  category:'能力検査',passed:true,official_race_result:false,
  valid_for_provisional_comparison:true,trainer:'柏原 誠路',age:3,
  event_date:'2026-10-27',source_ref:'https://www.sonoda-himeji.jp/data/ability/detail/135',
  time_seconds:78,distance:1200,same_session_distance_peer_count:3,
  same_session_faster_or_equal_count:1,as_of:d.race.observation_at
 };
 const result=v17(d);
 assert.equal(result.status,'READY_FOR_PROSPECTIVE_PAIRED_TEST',JSON.stringify(result));
 assert.equal(result.runners.length,12);
 const debut=result.runners.find(x=>x.horse_no===2);
 assert.equal(Number.isInteger(debut.score),true);
 assert.equal(debut.confidence,'ABILITY_TEST_ONLY_UNCALIBRATED');
 const audit=result.ability_evidence_audit.find(x=>x.horse_no===2);
 assert.equal(audit.official_ability_test_used,true);
 assert.equal(audit.evidence_runs_used,0);
 assert.equal(audit.gaps,'NO_RACE_HISTORY_ABILITY_TEST_ONLY');
 assert.equal(audit.score_contributions[0].category,'OFFICIAL_ABILITY_TEST_ONLY_UNCALIBRATED');
 assert.equal(result.production_rank_effect,false);
 assert.equal(result.frozen_modified,false);
});
test('fake, wrong trainer or post-race Hyogo test cannot alter a debut ranking',()=>{
 const d=make();
 d.race={...d.race,race_date:'2026-11-11',track:'園田',race_no:1,distance:1400,
  observation_at:'2026-11-11T10:15:00+09:00',post_time:'2026-11-11T10:40:00+09:00'};
 d.comparison.target_date=d.race.race_date;
 const first=d.comparison.runner_evidence[1];first.context_runs=[];
 first.trainer='柏原誠路';first.sex_age='牡3';
 first.ability_test={horse_no:2,horse_name:first.horse_name,
  source:'HYOGO_OFFICIAL_ABILITY_TEST',category:'能力検査',
  identity_method:'EXACT_NAME_AGE_TRAINER_NOT_STABLE_HORSE_ID',
  passed:true,official_race_result:false,valid_for_provisional_comparison:true,
  trainer:'別厩舎',age:3,event_date:'2026-10-27',
  source_ref:'https://www.sonoda-himeji.jp/data/ability/detail/135',
  time_seconds:78,distance:1200,same_session_distance_peer_count:3,
  same_session_faster_or_equal_count:1,as_of:d.race.observation_at};
 assert.equal(v17(d).reason,'ABILITY_TEST_IDENTITY_ASOF_OR_PROVENANCE_UNVERIFIED');
 first.ability_test.trainer='柏原誠路';
 first.ability_test.event_date='2026-11-11';
 assert.equal(v17(d).reason,'ABILITY_TEST_IDENTITY_ASOF_OR_PROVENANCE_UNVERIFIED');
});
