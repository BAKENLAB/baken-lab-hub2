import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPreRaceFrozen,hypotheticalShadowTop5,evaluateShadowAfterResult} from './snapshot-review.mjs';
const frozen=()=>({race_date:'2026-10-30',track:'金沢',race_no:1,protocol_version:'CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013',
  status:'FROZEN',frozen_at:'2026-10-30T01:00:00Z',post_time:'2026-10-30T04:00:00Z',
  payload:{runners:Array.from({length:7},(_,i)=>({horse_no:i+1,horse_name:'Horse '+(i+1),rank:i+1,score:91-i*2,status:'ACTIVE',
    reason:i===5?'中央OP出走があるが近走大敗、同距離未確認':'園田C1 1400m好走',evidence_summary:'過去実績確認中'})),
    top5:Array.from({length:5},(_,i)=>({horse_no:i+1,rank:i+1})),eye:{horse_no:7},bets:[],
    bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{market_used_for_ranking:false,market_used_for_eye:false}}});
const result=()=>({race_date:'2026-10-30',track:'金沢',race_no:1,
    finishers:[{horse_no:6,finish:1},{horse_no:2,finish:2},{horse_no:3,finish:3}]});
test('01 pre-race review does not mutate frozen / EYE',()=>{
  const f=frozen(),before=structuredClone(f),r=reviewPreRaceFrozen(f);
  assert.deepEqual(f,before);assert.deepEqual(r.original_top5,[1,2,3,4,5]);
  assert.deepEqual(r.original_eye,[7]);assert.equal(r.ranking_modified,false);
});
test('02 unverified text never certifies a positive factor',()=>{
  const r=reviewPreRaceFrozen(frozen());
  assert(r.alerts.some(x=>x.horse_no===6&&x.kind==='GRADE_TEXT_REVIEW'&&x.verification==='REQUIRED'));
  assert(r.alerts.some(x=>x.horse_no===6&&x.kind==='PRIOR_FORM_TEXT_REVIEW'));
  assert.match(r.data_warning,/do not prove/);
});
test('03 simulated switch records only newly gained 3rd-or-better horses',()=>{
  const r=reviewPreRaceFrozen(frozen()),h=hypotheticalShadowTop5(r,'ALL_RANK5_6'),v=evaluateShadowAfterResult(r,h,result());
  assert.equal(h.simulated_only,true);assert.equal(h.switched,true);
  assert.deepEqual(v.newly_covered,[6]);assert.deepEqual(v.lost_covered,[]);
  assert.equal(v.newly_captured_winner,true);assert.equal(v.eye_preserved,true);
});
test('04 losing correct fifth is recorded, not hidden',()=>{
  const r=reviewPreRaceFrozen(frozen()),h=hypotheticalShadowTop5(r,'ALL_RANK5_6');
  const d=result();d.finishers[0].horse_no=5;
  const v=evaluateShadowAfterResult(r,h,d);assert.deepEqual(v.lost_covered,[5]);assert.equal(v.lost_winner,true);
});
test('05 gap gate does not force any rank change in original snapshot',()=>{
  const f=frozen();f.payload.runners[5].score=70;const r=reviewPreRaceFrozen(f);
  assert.equal(hypotheticalShadowTop5(r,'GAP_LE_2').switched,false);
  f.payload.runners[5].score=81;const x=reviewPreRaceFrozen(f);
  assert.equal(hypotheticalShadowTop5(x,'GAP_LE_2').switched,true);
  assert.deepEqual(x.original_top5,[1,2,3,4,5]);
});
test('06 invalid late frozen and unknown protocol are rejected',()=>{
  const f=frozen();f.frozen_at=f.post_time;assert.throws(()=>reviewPreRaceFrozen(f),/NOT_PRESTART_FROZEN/);
  f.frozen_at='2026-10-30T01:00:00Z';f.protocol_version='UNKNOWN';assert.throws(()=>reviewPreRaceFrozen(f),/UNSUPPORTED_FROZEN/);
});
test('07 odds use and betting outside suspended policy rejected',()=>{
  const f=frozen();f.payload.audit.market_used_for_ranking=true;assert.throws(()=>reviewPreRaceFrozen(f),/MARKET_CONTRACT/);
  f.payload.audit.market_used_for_ranking=false;f.payload.bets=[{stake:1000}];assert.throws(()=>reviewPreRaceFrozen(f),/BET_CONTRACT/);
});
test('08 result matching and completeness required',()=>{
  const r=reviewPreRaceFrozen(frozen()),h=hypotheticalShadowTop5(r,'ALL_RANK5_6');
  const d=result();d.finishers.pop();assert.throws(()=>evaluateShadowAfterResult(r,h,d),/REQUIRE_COMPLETE_TOP3/);
  d.finishers.push({horse_no:3,finish:3});d.track='大井';
  assert.throws(()=>evaluateShadowAfterResult(r,h,d),/RESULT_RACE_MISMATCH/);
});
test('09 future results and popularity fields cannot influence pre-race choice',()=>{
  const f=frozen();f.popularity=1;f.result=result();
  const a=reviewPreRaceFrozen(f);delete f.popularity;delete f.result;
  assert.deepEqual(reviewPreRaceFrozen(f),a);
});
test('10 both gain and loss hypotheses remain possible',()=>{
  const r=reviewPreRaceFrozen(frozen()),h=hypotheticalShadowTop5(r,'GAP_LE_2_WITH_PRIOR_TEXT');
  assert.equal(h.switched,true);assert.equal(evaluateShadowAfterResult(r,h,result()).newly_captured_winner,true);
  const d=result();d.finishers[0].horse_no=5;
  assert.equal(evaluateShadowAfterResult(r,h,d).lost_winner,true);
});