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
   for(const h of row.supporting_runs){h.class='C3-17';h.track='高知';if(h.finish===2){h.margin_unit='LENGTHS_TO_WINNER';h.margin_basis='NAR_SECOND_PLACE_PRECEDING_IS_WINNER';}}
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
   for(const h of row.supporting_runs){h.class='C3-17';h.track='高知';if(h.finish===2){h.margin_unit='LENGTHS_TO_WINNER';h.margin_basis='NAR_SECOND_PLACE_PRECEDING_IS_WINNER';}}
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

test('official fullwidth LOCAL class label Ｃ２四組 matches Ｃ２二組 at same track',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.track='盛岡';x.race.class_name='Ｃ２四組';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
  for(const h of row.supporting_runs){h.class='Ｃ２二組';h.track='盛岡';if(h.finish===2){h.margin_unit='LENGTHS_TO_WINNER';h.margin_basis='NAR_SECOND_PLACE_PRECEDING_IS_WINNER';}}
 const r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.top5,[1,2,3,4,6]);
});
test('official 園田 Ｃ１ ３歳以上特別 and Ｃ１二３歳以上 can compare',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.track='園田';x.race.class_name='Ｃ１ ３歳以上特別';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
  for(const h of row.supporting_runs){h.class='Ｃ１二３歳以上';h.track='園田';if(h.finish===2){h.margin_unit='LENGTHS_TO_WINNER';h.margin_basis='NAR_SECOND_PLACE_PRECEDING_IS_WINNER';}}
 const r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,2);
});
test('3-year-old-only Ｃ２ never proves equivalent adult Ｃ２',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.track='盛岡';x.race.class_name='Ｃ２四組';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
  for(const h of row.supporting_runs){h.class='３歳Ｃ２四組';h.track='盛岡';}
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
});
test('reporters Final does not auto swap even with class-matched historical evidence',()=>{
 const x=fx();x.race.circuit='LOCAL';x.race.track='高知';
 x.race.class_name='Ｃ３二';x.race.race_name='ファイナルレース 記者選抜';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)
   for(const h of row.supporting_runs){h.class='Ｃ３二';h.track='高知';}
 const before=structuredClone(x),r=calculate(x);
 assert.equal(r.status,'SPECIAL_FINAL_REVIEW_ONLY');
 assert.deepEqual(r.candidate_order,[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(r.top5,[1,2,3,4,5]);
 assert.equal(r.production_rank_effect,false);
 assert.deepEqual(x,before);
});

test('NAR lengths to prior finisher cannot be misread as seconds to winner',()=>{
 const x=fx();
 x.race.circuit='LOCAL';x.race.track='高知';x.race.class_name='Ｃ２四組';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)for(const h of row.supporting_runs){
  h.track='高知';h.class='Ｃ２二組';
 }
 // Third-place "クビ" means gap to the preceding horse, NOT confirmed
 // seconds-to-winner. A number string "3" means lengths, NOT three seconds.
 const challenger=x.comparison.runner_evidence[5];
 challenger.supporting_runs=[
  {date:'2026-10-05',track:'高知',class:'Ｃ２二組',surface:'ダート',
   distance:1200,finish:2,margin:'クビ'},
  {date:'2026-10-20',track:'高知',class:'Ｃ２三組',surface:'ダート',
   distance:1200,finish:3,margin:'1/2'}
 ];
 const incumbent=x.comparison.runner_evidence[4];
 incumbent.supporting_runs=[
  {date:'2026-10-05',track:'高知',class:'Ｃ２二組',surface:'ダート',
   distance:1200,finish:9,margin:'3'},
  {date:'2026-10-20',track:'高知',class:'Ｃ２三組',surface:'ダート',
   distance:1200,finish:8,margin:'大差'}
 ];
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===5).same_class_decisive_defeats,0);
 // Only separately verified winner-relative distance may count as close loss.
});


function officialLocalBackfieldFixture(){
 const x=fx();x.race.circuit='LOCAL';x.race.track='高知';x.race.class_name='Ｃ２四組';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)for(const h of row.supporting_runs){
   h.track='高知';h.class='Ｃ２二組';
   if(h.finish===2){h.margin=0.3;h.margin_unit='LENGTHS_TO_WINNER';
     h.margin_basis='NAR_SECOND_PLACE_PRECEDING_IS_WINNER';}
 }
 // Isolate the rank9 policy: rank6's old independent challenger remains
 // covered by other tests and must not mask whether rank9 was rejected.
 x.comparison.runner_evidence[5].supporting_runs=[];
 const fifth=x.comparison.runner_evidence[4];
 for(const h of fifth.supporting_runs){h.margin=null;h.margin_unit=null;h.margin_basis='UNVERIFIED_WINNER_GAP';}
 const deep=x.comparison.runner_evidence[8];
 deep.supporting_runs.push({date:'2026-10-30',track:'高知',surface:'ダート',
   distance:1200,class:'Ｃ２二組',finish:1,margin:0,margin_basis:'WINNER',
   margin_unit:'LENGTHS_TO_WINNER',early_pos:2});
 return x;
}
test('LOCAL rank9 can earn a strict shadow promotion from independent official backfield finishes, no invented margins',()=>{
 const x=officialLocalBackfieldFixture(),before=structuredClone(x),r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.top5,[1,2,3,4,9]);
 assert.equal(r.elected_challenger.backfield_evidence_effect,'VERIFIED_REPEATED_BACKFIELD_FINISH_ONLY');
 assert.equal(r.elected_challenger.incumbent_backfield_finishes,2);
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===5).same_class_decisive_defeats,0);
 assert.ok(r.proof_by_horse.find(h=>h.horse_no===5).qualifying_proof.some(p=>p.type==='MATCHED_CLASS_BACKFIELD_FINISH_NOT_MARGIN'));
 assert.equal(r.production_rank_effect,false);
 assert.equal(r.frozen_modified,false);
 assert.equal(r.market_used,false);
 assert.equal(r.target_result_used,false);
 assert.deepEqual(x,before);
});
test('LOCAL deep promotion requires two distinct official comparable backfield finishes',()=>{
 const x=officialLocalBackfieldFixture(),fifth=x.comparison.runner_evidence[4];
 fifth.supporting_runs[1].finish=7;
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===5).same_class_backfield_finishes,1);
});
test('LOCAL deep promotion will not fabricate a second backfield result from a duplicate race',()=>{
 const x=officialLocalBackfieldFixture(),fifth=x.comparison.runner_evidence[4];
 fifth.supporting_runs[1]={...fifth.supporting_runs[0]};
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===5).same_class_backfield_finishes,1);
});
test('LOCAL deep promotion refuses backfield data from a different district',()=>{
 const x=officialLocalBackfieldFixture(),fifth=x.comparison.runner_evidence[4];
 fifth.supporting_runs[1].track='園田';
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===5).same_class_backfield_finishes,1);
});
test('LOCAL two incumbent comparable close runs remain protected despite backfield observations',()=>{
 const x=officialLocalBackfieldFixture(),fifth=x.comparison.runner_evidence[4];
 fifth.supporting_runs.push({date:'2026-09-25',track:'高知',surface:'ダート',
   distance:1200,class:'Ｃ２二組',finish:1,margin:0,early_pos:2});
 fifth.supporting_runs.push({date:'2026-10-01',track:'高知',surface:'ダート',
   distance:1200,class:'Ｃ２二組',finish:1,margin:0,early_pos:2});
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===5).same_class_close_runs,2);
});


function localPodiumFixture(){
 const x=fx();x.race.circuit='LOCAL';x.race.track='高知';x.race.class_name='Ｃ２四組';
 x.comparison.source_scope=undefined;
 x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
 for(const row of x.comparison.runner_evidence)for(const h of row.supporting_runs){
   h.track='高知';h.class='Ｃ２二組';
 }
 // 5th-place incumbent: two distinct verified backfield finishes.
 for(const h of x.comparison.runner_evidence[4].supporting_runs){
   h.margin=null;h.margin_basis='UNVERIFIED_WINNER_GAP';
 }
 // Challenger: two official 3rd-place results. Their preceding-runner
 // margin is UNKNOWN as a winner gap; no close-to-winner evidence is claimed.
 x.comparison.runner_evidence[5].supporting_runs=[
  {date:'2026-10-15',track:'高知',surface:'ダート',distance:1200,
   class:'Ｃ２二組',finish:3,margin:null,margin_basis:'UNVERIFIED_WINNER_GAP'},
  {date:'2026-10-20',track:'高知',surface:'ダート',distance:1200,
   class:'Ｃ２二組',finish:3,margin:null,margin_basis:'UNVERIFIED_WINNER_GAP'},
  {date:'2026-10-25',track:'高知',surface:'ダート',distance:1200,
   class:'Ｃ２二組',finish:3,margin:null,margin_basis:'UNVERIFIED_WINNER_GAP'}
 ];
 return x;
}
test('LOCAL three independently verified third-place finishes can trigger strict rank6 shadow rescue despite unknown winner margins',()=>{
 const x=localPodiumFixture(),before=structuredClone(x),r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.top5,[1,2,3,4,6]);
 assert.equal(r.elected_challenger.podium_evidence_effect,'VERIFIED_REPEATED_PODIUM_NOT_WINNER_MARGIN');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_podium_finishes,3);
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===5).same_class_backfield_finishes,2);
 assert.equal(r.production_rank_effect,false);
 assert.equal(r.frozen_modified,false);
 assert.deepEqual(x,before);
});
test('LOCAL podium alternative refuses one podium, different venue and unknown incumbent',()=>{
 let x=localPodiumFixture();
 x.comparison.runner_evidence[5].supporting_runs[1].finish=4;
 assert.equal(calculate(x).status,'UNCHANGED');
 x=localPodiumFixture();
 x.comparison.runner_evidence[5].supporting_runs[1].track='園田';
 assert.equal(calculate(x).status,'UNCHANGED');
 x=localPodiumFixture();
 x.comparison.runner_evidence[4].supporting_runs=[];
 assert.equal(calculate(x).status,'UNCHANGED');
});
test('LOCAL proven incumbents and special-composition events are not displaced by podium alternative',()=>{
 let x=localPodiumFixture();
 x.comparison.runner_evidence[4].supporting_runs=[
  {date:'2026-10-14',track:'高知',surface:'ダート',distance:1200,class:'Ｃ２二組',finish:3},
  {date:'2026-10-20',track:'高知',surface:'ダート',distance:1200,class:'Ｃ２二組',finish:3}
 ];
 assert.equal(calculate(x).status,'UNCHANGED');
 x=localPodiumFixture();x.race.race_name='Ｃ２十四 特別編成';
 assert.equal(calculate(x).status,'UNCHANGED');
});
test('LOCAL rank9 three independently verified podiums including win can qualify in shadow',()=>{
 const x=localPodiumFixture();
 x.comparison.runner_evidence[5].supporting_runs=[];
 x.comparison.runner_evidence[8].supporting_runs=[
  {date:'2026-09-20',track:'高知',surface:'ダート',distance:1200,class:'Ｃ２二組',finish:3},
  {date:'2026-10-10',track:'高知',surface:'ダート',distance:1200,class:'Ｃ２三組',finish:1},
  {date:'2026-10-30',track:'高知',surface:'ダート',distance:1200,class:'Ｃ２四組',finish:3}
 ];
 const r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.top5,[1,2,3,4,9]);
 assert.equal(r.elected_challenger.depth,'RANK9_PLUS_STRICT');
 assert.equal(r.elected_challenger.podium_evidence_effect,'VERIFIED_REPEATED_PODIUM_NOT_WINNER_MARGIN');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===9).same_class_close_runs,1);
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===9).same_class_podium_finishes,3);
});


test('two verified LOCAL sustained-front podiums genuinely change rank6 shadow with no invented winning gap',()=>{
 const x=localPodiumFixture(),runner=x.comparison.runner_evidence[5];
 runner.supporting_runs.pop(); // two historical podiums: short of v0.4 3-run rescue
 const plain=calculate(x);
 assert.equal(plain.status,'UNCHANGED');
 for(const h of runner.supporting_runs){h.early_pos=2;h.final_turn_pos=3;}
 const before=structuredClone(x),r=calculate(x);
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.top5,[1,2,3,4,6]);
 assert.equal(r.elected_challenger.podium_evidence_effect,'VERIFIED_SUSTAINED_FRONT_PODIUM_NO_WINNER_GAP');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_sustained_front_podium_runs,2);
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
 assert.equal(r.production_rank_effect,false);
 assert.equal(r.frozen_modified,false);
 assert.deepEqual(x,before);
});
test('missing final turn, different class and special composition cannot cause corner-based promotion',()=>{
 let x=localPodiumFixture(),h=x.comparison.runner_evidence[5].supporting_runs;
 h.pop();for(const r of h)r.early_pos=2;
 h[0].final_turn_pos=3;
 assert.equal(calculate(x).status,'UNCHANGED');
 x=localPodiumFixture();h=x.comparison.runner_evidence[5].supporting_runs;h.pop();
 for(const r of h){r.early_pos=2;r.final_turn_pos=3;}
 h[1].class='Ｃ３二組';
 assert.equal(calculate(x).status,'UNCHANGED');
 x=localPodiumFixture();h=x.comparison.runner_evidence[5].supporting_runs;h.pop();
 for(const r of h){r.early_pos=2;r.final_turn_pos=3;}
 x.race.race_name='Ｃ２十四 特別編成';
 assert.equal(calculate(x).status,'UNCHANGED');
});


function localLateAdvanceFixture(){
 const x=localPodiumFixture();
 const runs=x.comparison.runner_evidence[5].supporting_runs;
 runs.pop(); // two official podium finishes, not enough for old three-podium rule
 for(const h of runs){h.early_pos=9;h.final_turn_pos=4;}
 return x;
}
test('LOCAL verified late-corner advance podium proof changes shadow rank6',()=>{
 const x=localLateAdvanceFixture(),before=structuredClone(x),r=calculate(x);
 assert.equal(r.model_version,'ABILITY_RELATIVE_V0_6');
 assert.equal(r.status,'REORDERED');
 assert.deepEqual(r.top5,[1,2,3,4,6]);
 assert.equal(r.elected_challenger.podium_evidence_effect,
   'VERIFIED_LATE_CORNER_ADVANCE_PODIUM_NO_PACE_CAUSALITY');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_late_advance_podium_runs,2);
 assert.ok(r.proof_by_horse.find(h=>h.horse_no===6).qualifying_proof.every(
   p=>p.type!=='VERIFIED_LATE_CORNER_ADVANCE_PODIUM'||p.cause==='UNPROVEN'));
 assert.equal(r.production_rank_effect,false);
 assert.equal(r.frozen_modified,false);
 assert.deepEqual(x,before);
});
test('LOCAL late-corner advance needs both official early and final corner positions',()=>{
 const x=localLateAdvanceFixture(),runs=x.comparison.runner_evidence[5].supporting_runs;
 runs[0].final_turn_pos=null;
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_late_advance_podium_runs,1);
});
test('LOCAL late-corner advance needs repeated distinct podiums with 4+ places gained',()=>{
 let x=localLateAdvanceFixture(),runs=x.comparison.runner_evidence[5].supporting_runs;
 runs[1].final_turn_pos=6; // only 3 places gained
 let r=calculate(x);assert.equal(r.status,'UNCHANGED');
 x=localLateAdvanceFixture();runs=x.comparison.runner_evidence[5].supporting_runs;
 runs[1]={...runs[0]}; // duplicate, not independent
 r=calculate(x);assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_late_advance_podium_runs,1);
});
test('LOCAL late-corner advance cannot displace proven incumbent or win from rank9 alone',()=>{
 let x=localLateAdvanceFixture();
 x.comparison.runner_evidence[4].supporting_runs=[
  {date:'2026-10-14',track:'高知',surface:'ダート',distance:1200,class:'Ｃ２二組',finish:3},
  {date:'2026-10-20',track:'高知',surface:'ダート',distance:1200,class:'Ｃ２二組',finish:3}
 ];
 assert.equal(calculate(x).status,'UNCHANGED');
 x=localLateAdvanceFixture();
 x.comparison.runner_evidence[8].supporting_runs=
   structuredClone(x.comparison.runner_evidence[5].supporting_runs);
 x.comparison.runner_evidence[5].supporting_runs=[];
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.deepEqual(r.top5,[1,2,3,4,5]);
});
test('LOCAL late-corner advance cannot qualify in special composition or different class',()=>{
 let x=localLateAdvanceFixture();
 x.race.race_name='C2十四 特別編成';
 assert.equal(calculate(x).status,'UNCHANGED');
 x=localLateAdvanceFixture();
 x.comparison.runner_evidence[5].supporting_runs[1].class='Ｃ３二組';
 assert.equal(calculate(x).status,'UNCHANGED');
});

test('LOCAL C4-tier podium form can rescue a boundary outsider; C3 cannot',()=>{
 const make=()=>{
  const x=fx();x.race.circuit='LOCAL';x.race.track='門別';
  x.race.class_name='3歳以上 C4-2';x.race.race_name='3歳以上 C4-2';
  delete x.comparison.source_scope;
  x.comparison.data_scope='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY';
  for(const row of x.comparison.runner_evidence)
   for(const run of row.supporting_runs){
    run.track='門別';run.class='C4-3';
    if(run.finish===2){
     run.margin_unit='LENGTHS_TO_WINNER';
     run.margin_basis='NAR_SECOND_PLACE_PRECEDING_IS_WINNER';
    }
   }
  return x;
 };
 const yes=calculate(make());
 assert.equal(yes.status,'REORDERED');
 assert.deepEqual(yes.top5,[1,2,3,4,6]);
 assert.equal(yes.proof_by_horse.find(h=>h.horse_no===6).target_class_status,'LOCAL_C4');
 const wrong=make();
 for(const row of wrong.comparison.runner_evidence)
  for(const run of row.supporting_runs)run.class='C3-2';
 assert.equal(calculate(wrong).status,'UNCHANGED');
 const mixed=make();mixed.race.race_name='3歳以上 C3-2 C4-1';
 mixed.race.class_name='3歳以上 C3-2 C4-1';
 assert.equal(calculate(mixed).status,'PRE_RACE_IDENTITY_OR_TIME_UNVERIFIED');
});


test('JRA G1 vs ordinary OP/listed or lower G2/G3 cannot count as same-class rescue',()=>{
 const make=(pastClass)=>{
  const x=fx();
  x.race.class_name='GⅠ';
  for(const e of x.comparison.runner_evidence)
   for(const run of e.supporting_runs)run.class=pastClass;
  return x;
 };
 for(const other of ['OP','オープン','リステッド','L','GⅡ','GIII','重賞']){
  const r=calculate(make(other));
  assert.equal(r.status,'UNCHANGED',other);
  assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0,other);
 }
 for(const same of ['G1','GⅠ','GI']){
  const r=calculate(make(same));
  assert.equal(r.status,'REORDERED',same);
  assert.deepEqual(r.top5,[1,2,3,4,6],same);
 }
});
test('JRA exact G2, G3, listed and ordinary OP each retain their own tier',()=>{
 for(const [target,matching,wrong] of [
  ['GⅡ','G2','G1'],['GⅢ','GIII','GII'],
  ['リステッド','L','OP']
 ]){
  const make=c=>{
   const x=fx();x.race.class_name=target;
   for(const e of x.comparison.runner_evidence)
    for(const h of e.supporting_runs)h.class=c;
   return calculate(x);
  };
  assert.equal(make(matching).status,'REORDERED',target+' '+matching);
  assert.equal(make(wrong).status,'UNCHANGED',target+' '+wrong);
 }
});

test('coarse JRA Open class cannot masquerade as an identical graded/non-graded tier',()=>{
 const x=fx();x.race.class_name='オープン';x.race.race_name='架空の重賞';
 for(const row of x.comparison.runner_evidence)
  for(const run of row.supporting_runs)run.class='OP';
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.deepEqual(r.top5,[1,2,3,4,5]);
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).target_class_status,
  'JRA_OPEN_UNSPECIFIED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
 assert.equal(r.target_class_evidence.status,'JRA_OPEN_GRADE_UNVERIFIED');
 // A specific official class G2 plus corresponding GII history *is*
 // interpretable, even while a generic Open class is not.
 const graded=fx();graded.race.class_name='GⅡ';
 for(const row of graded.comparison.runner_evidence)
  for(const run of row.supporting_runs)run.class='GII';
 assert.equal(calculate(graded).status,'REORDERED');
});


test('named JRA special races use distinct official 2勝ク detail to recover same-tier evidence',()=>{
 const x=fx();
 x.race.class_name='2勝クラス';
 for(const row of x.comparison.runner_evidence)
  for(const h of row.supporting_runs){
   h.class='WASJ3';h.class_detail='2勝ク';
  }
 const fixed=calculate(x);
 assert.equal(fixed.status,'REORDERED');
 assert.deepEqual(fixed.top5,[1,2,3,4,6]);
 assert.equal(fixed.elected_challenger.horse_no,6);
 assert.equal(fixed.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,2);
 // Demonstrate the original missing-detail path remains non-certifying.
 for(const row of x.comparison.runner_evidence)
  for(const h of row.supporting_runs)delete h.class_detail;
 assert.equal(calculate(x).status,'UNCHANGED');
});
test('conflicting JRA named class and explicit detail reject same-class promotion',()=>{
 const x=fx();
 x.race.class_name='2勝クラス';
 for(const row of x.comparison.runner_evidence)
  for(const h of row.supporting_runs){
   h.class='3勝クラス';h.class_detail='2勝ク';
  }
 const r=calculate(x);
 assert.equal(r.status,'UNCHANGED');
 assert.equal(r.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
});
test('JRA bare graded/Open/unknown detail cannot be assigned to 2勝',()=>{
 const x=fx();x.race.class_name='2勝クラス';
 for(const row of x.comparison.runner_evidence)
  for(const h of row.supporting_runs){
   h.class='桑園特別';h.class_detail='重賞';
  }
 assert.equal(calculate(x).status,'UNCHANGED');
});
