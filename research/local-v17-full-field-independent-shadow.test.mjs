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
 assert.equal(x.lab_eye_status,'SEPARATE_AFTER_TOP5_NOT_AUTO_SELECTED');
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
 assert.equal(v17(d).reason,'WHOLE_FIELD_IDENTITY_OR_HISTORY_UNVERIFIED');
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
