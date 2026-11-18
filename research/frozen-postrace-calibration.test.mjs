import test from 'node:test';
import assert from 'node:assert/strict';
import {auditFrozenPostrace} from './frozen-postrace-calibration.mjs';
function fixture({track='福島',race_no=8,circuit='JRA',grade='S',top=[15,14,4,3,6],eye=9,actual=[6,9,15],order=null}={}) {
 const fullOrder=order??[...top,...Array.from({length:16},(_,i)=>i+1).filter(n=>!top.includes(n))];
 const field=fullOrder.map((n,i)=>({horse_no:n,horse_name:'馬'+n,rank:i+1,status:'ACTIVE'}));
 const top5=top.map((n,i)=>({horse_no:n,horse_name:'馬'+n,rank:i+1,grade:i===0?grade:'A'}));
 const e=eye===null?null:{horse_no:eye,horse_name:'馬'+eye,rank:fullOrder.indexOf(eye)+1};
 return {prediction:{race_date:'2026-11-08',track,race_no,circuit,status:'FROZEN',
  frozen_at:'2026-11-08T12:31:28+09:00',post_time:'2026-11-08T13:40:00+09:00',
  payload:{top5,runners:field,eye:e}},result:{finishers:actual.map((n,i)=>({horse_no:n,finish:i+1,popularity:12-i,win_odds:60-i}))}};
}
test('Fukushima 8: winner in TOP5 and runner-up in independent EYE',()=>{
 const source=fixture({order:[15,14,4,3,6,7,9,13,10,5,11,8,2,12,1,16]}),before=structuredClone(source),a=auditFrozenPostrace([source]);
 assert.equal(a.accepted,1); assert.equal(a.all.winnerTop5,1);
 assert.equal(a.all.eyeTop3,1); assert.equal(a.all.allThreeTop5,0);
 assert.equal(a.all.allThreeTop5PlusEye,1);
 assert.deepEqual(a.missed_cases[0].outside_top5,[9]);
 assert.deepEqual(a.missed_cases[0].original_ranks.map(h=>h.rank),[5,7,1]);
 assert.equal(a.market_used,false);assert.equal(a.production_rank_changed,false);
 assert.deepEqual(source,before);
});
test('Kochi Final: exposes out-of-five winner and second, not a post-hoc promotion',()=>{
 const a=auditFrozenPostrace([fixture({track:'高知',race_no:12,circuit:'LOCAL',grade:'A',top:[12,6,3,1,8],eye:null,actual:[4,7,12],order:[12,6,3,1,8,2,9,4,5,10,11,7,13,14,15,16]})]);
 assert.equal(a.circuits.LOCAL.firstTop3,1);
 assert.equal(a.all.winnerTop5,0);
 assert.deepEqual(a.missed_cases[0].outside_top5,[4,7]);
 assert.deepEqual(a.missed_cases[0].original_ranks.map(h=>h.rank),[8,12,1]);
 assert.deepEqual(a.missed_cases[0].eye_caught,[]);
 assert.equal(a.production_score_changed,false);
});
test('sample-size-gated S/A calibration warning, no model changes',()=>{
 const pairs=[];
 for(let i=0;i<30;i++){
  const grade=i<20?'S':'A';
  const actual=(i<8 || i>=20)?[15,9,6]:[9,6,4];
  pairs.push(fixture({race_no:i%24+1,track:i<24?'福島':'東京',grade,actual}));
 }
 const a=auditFrozenPostrace(pairs,{minimumGradeSample:10});
 assert.equal(a.accepted,30);
 assert.equal(a.circuits.JRA.grades.S.races,20);
 assert.equal(a.circuits.JRA.grades.A.races,10);
 assert.ok(a.circuits.JRA.alerts.includes('S_NOT_MORE_CALIBRATED_THAN_A_REVIEW'));
 assert.equal(a.circuits.JRA.grades.S.top3Rate,0.4);
 assert.equal(a.circuits.JRA.grades.A.top3Rate,1);
});
test('fail closed on late freeze, duplicate, bad winner or missing field',()=>{
 const good=fixture(),late=fixture({race_no:9});late.prediction.frozen_at=late.prediction.post_time;
 const bad=fixture({race_no:10});bad.result.finishers[1].horse_no=bad.result.finishers[0].horse_no;
 const partial=fixture({race_no:11});partial.prediction.payload.runners=[];
 const got=auditFrozenPostrace([good,good,late,bad,partial]);
 assert.equal(got.accepted,1);assert.deepEqual(got.rejected.map(r=>r.reason),['DUPLICATE_RACE_KEY','NOT_VALID_PRERACE_FROZEN','RESULT_TOP3_INVALID','FIELD_OR_TOP5_INCOMPLETE']);
});
test('no-EYE race does not become an automatic rank-6 EYE',()=>{
 const a=auditFrozenPostrace([fixture({eye:null,actual:[6,9,15]})]);
 assert.equal(a.all.eyeSelected,0);assert.equal(a.all.eyeTop3Rate,null);
 assert.equal(a.all.winnerTop5PlusEye,1);
});
