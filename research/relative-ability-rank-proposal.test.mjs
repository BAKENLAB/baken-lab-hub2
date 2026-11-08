import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRelativeAbilityRankProposal as calculate} from '../automation/relative-ability-rank-proposal.mjs';
const names=Array.from({length:10},(_,i)=>'検証馬'+(i+1));
function fx(){
 const baseline=names.map((horse_name,i)=>({horse_no:i+1,horse_name,rank:i+1}));
 const supporting=names.map((_,i)=>{
  const idx=i+1,good=idx===6?2:idx===5?0:idx===9?2:1;
  const poor=idx===5?2:0, all=[];
  for(let k=0;k<good;k++)all.push({date:'2026-10-'+String(15+k).padStart(2,'0'),track:'福島',surface:'ダート',distance:1200,class:'1勝クラス',finish:k+1,margin:0.2,early_pos:2});
  for(let k=0;k<poor;k++)all.push({date:'2026-10-'+String(20+k).padStart(2,'0'),track:'福島',surface:'ダート',distance:1200,class:'1勝クラス',finish:9,margin:2.4,early_pos:7});
  return {horse_no:idx,horse_name:names[i],supporting_runs:all};
 });
 return {race:{race_date:'2026-11-08',post_time:'2026-11-08T13:40:00+09:00',
   observation_at:'2026-11-08T12:20:00+09:00',circuit:'JRA',
   track:'福島',class_name:'1勝クラス',surface:'ダート',distance:1150},
   baseline,comparison:{status:'READY',market_used:false,target_result_used:false,
     rank_effect:false,target_date:'2026-11-08',source_scope:'JRA_CLAIMED_RUNNER_HISTORY',
     runner_evidence:supporting}};
}
test('complete prerace field genuinely changes the 5/6 order and identifies displaced',()=>{
 const x=fx(),before=structuredClone(x),r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.baseline_top5,[1,2,3,4,5]);
 assert.deepEqual(r.top5,[1,2,3,4,6]);
 assert.equal(r.elected_challenger.horse_no,6);
 assert.equal(r.protected_incumbent,5);
 assert.deepEqual(r.rank_deltas.map(x=>[x.horse_no,x.original_rank,x.shadow_rank]),[[5,5,6],[6,6,5]]);
 assert.equal(r.production_rank_effect,false);
 assert.deepEqual(x,before);
});
test('does not promote rank6 just because it is next',()=>{
 const x=fx();x.comparison.runner_evidence[5].supporting_runs=[];
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');assert.deepEqual(r.top5,[1,2,3,4,5]);
});
test('protected fifth does not drop if it has two same-class recent close races',()=>{
 const x=fx();x.comparison.runner_evidence[4].supporting_runs=[
 {date:'2026-10-14',surface:'ダート',distance:1200,class:'1勝クラス',finish:1,margin:0.1},
 {date:'2026-10-20',surface:'ダート',distance:1200,class:'1勝クラス',finish:2,margin:0.2}];
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');assert.deepEqual(r.top5,[1,2,3,4,5]);
});
test('different-class maiden success cannot displace current Class1 fifth',()=>{
 const x=fx();
 x.comparison.runner_evidence[5].supporting_runs.forEach(h=>h.class='未勝利');
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
});
test('deep outside TOP5 with evidence is flagged, never auto promoted',()=>{
 const r=calculate(fx());
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.deep_review_candidates.map(h=>h.horse_no),[9]);
 assert.equal(r.top5.includes(9),false);
});
test('mixed LOCAL competitor with exact class history may use shared evaluator',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.class_name='C3-19';x.race.track='高知';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
   for(const h of row.supporting_runs){h.class='C3-17';h.track='高知';}
 const r=calculate(x);
 assert.equal(r.status,'REORDERED');
});
test('rejects target result leakage and popularity from prior baseline',()=>{
 const x=fx();x.race.result={winner:6};
 assert.equal(calculate(x).status,'RESULT_OR_MARKET_IN_PRERACE_INPUT');
 const y=fx();y.baseline[0].popularity=2;
 assert.equal(calculate(y).status,'RESULT_OR_MARKET_IN_PRERACE_INPUT');
});
test('rejects post-time observation, same day past race, and wrong target',()=>{
 const x=fx();x.race.observation_at=x.race.post_time;
 assert.equal(calculate(x).status,'PRE_RACE_IDENTITY_OR_TIME_UNVERIFIED');
 const y=fx();y.comparison.runner_evidence[5].supporting_runs[0].date='2026-11-08';
 assert.equal(calculate(y).status,'EVIDENCE_CONTAINS_CURRENT_OR_FUTURE_RACE');
 const z=fx();z.comparison.target_date='2026-11-09';
 assert.equal(calculate(z).status,'EVIDENCE_TARGET_DATE_MISMATCH');
});
test('rejects spoofed horse identity, missing full-field history and invalid source',()=>{
 const x=fx();x.comparison.runner_evidence[0].horse_name='別馬';
 assert.equal(calculate(x).status,'EVIDENCE_IDENTITY_OR_SHAPE_INVALID');
 const y=fx();y.comparison.runner_evidence.pop();
 assert.equal(calculate(y).status,'EVIDENCE_FIELD_SIZE_MISMATCH');
 const z=fx();z.comparison.source_scope='UNVERIFIED_IMPORT';
 assert.equal(calculate(z).status,'UNTRUSTED_EVIDENCE_SOURCE');
});

test('LOCAL C3 class-tier evidence can actually promote a verified challenger',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.class_name='C3-19';x.race.track='高知';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
   for(const h of row.supporting_runs){h.class='C3-17';h.track='高知';}
 const result=calculate(x);
 assert.equal(result.status,'REORDERED');assert.deepEqual(result.top5,[1,2,3,4,6]);
});
test('different LOCAL class C2 cannot be treated as matching C3 evidence',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.class_name='C3-19';x.race.track='高知';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
   for(const h of row.supporting_runs){h.class='C2-1';h.track='高知';}
 const result=calculate(x);
 assert.equal(result.status,'UNCHANGED');
});

test('rank 9 with three independent similar-class close runs and win beats unprotected fifth',()=>{
 const x=fx(),deep=x.comparison.runner_evidence[8];
 deep.supporting_runs.push({date:'2026-10-30',track:'福島',surface:'ダート',
   distance:1200,class:'1勝クラス',finish:1,margin:0.0,early_pos:3});
 const before=structuredClone(x),r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.top5,[1,2,3,4,9]);
 assert.equal(r.elected_challenger.depth,'RANK9_PLUS_STRICT');
 assert.equal(r.elected_challenger.independent_condition_proof,3);
 assert.equal(r.elected_challenger.historical_wins,2);
 assert.equal(r.deep_review_candidates.find(e=>e.horse_no===9).status,'SHADOW_PROMOTED_NOT_PRODUCTION');
 assert.deepEqual(x,before);
});
test('rank 9 is NOT rescued by two wins alone or an old win beyond six months',()=>{
 let x=fx();x.comparison.runner_evidence[5].supporting_runs=[];
 let r=calculate(x);
 assert.equal(r.status,'UNCHANGED');assert.equal(r.deep_review_candidates.length,1);
 x=fx();x.comparison.runner_evidence[5].supporting_runs=[];
 const deep=x.comparison.runner_evidence[8];
 deep.supporting_runs=[
 {date:'2025-01-01',track:'福島',surface:'ダート',distance:1200,class:'1勝クラス',finish:1,margin:0.0},
 {date:'2025-02-01',track:'福島',surface:'ダート',distance:1200,class:'1勝クラス',finish:1,margin:0.0},
 {date:'2025-03-01',track:'福島',surface:'ダート',distance:1200,class:'1勝クラス',finish:1,margin:0.0}
 ];
 r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.ok(r.deep_review_candidates.some(e=>e.horse_no===9));
});
test('rank 9 cannot replace a fifth with unknown comparison history',()=>{
 const x=fx();
 x.comparison.runner_evidence[4].supporting_runs=[];
 x.comparison.runner_evidence[5].supporting_runs=[];
 x.comparison.runner_evidence[8].supporting_runs.push(
 {date:'2026-10-30',track:'福島',surface:'ダート',distance:1200,class:'1勝クラス',finish:1,margin:0.0});
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');assert.deepEqual(r.top5,[1,2,3,4,5]);
});
test('duplicate same-date evidence is not counted as independent rank9 proof',()=>{
 const x=fx();x.comparison.runner_evidence[5].supporting_runs=[];
 const deep=x.comparison.runner_evidence[8];
 deep.supporting_runs.push({...deep.supporting_runs[0]});
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(e=>e.horse_no===9).same_class_close_runs,2);
});
test('different LOCAL tracks do not establish equivalent same-class proof',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.track='高知';x.race.class_name='C3-19';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
   for(const h of row.supporting_runs){h.class='C3-18';h.track='川崎';}
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(x=>x.horse_no===6).same_class_close_runs,0);
});
test('rank9 with recent close races but without a class-level win stays review-only',()=>{
 const x=fx();x.comparison.runner_evidence[5].supporting_runs=[];
 const deep=x.comparison.runner_evidence[8];
 for(const h of deep.supporting_runs){if(h.finish===1)h.finish=2;}
 deep.supporting_runs.push({date:'2026-10-30',track:'福島',surface:'ダート',
   distance:1200,class:'1勝クラス',finish:3,margin:0.1});
 const r=calculate(x);
 assert.equal(r.proof_by_horse.find(e=>e.horse_no===9).same_class_wins,0);
 assert.equal(r.status,'UNCHANGED');
});
