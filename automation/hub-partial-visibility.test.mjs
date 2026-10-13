import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePayload,validatePrediction,reconcileToday,predictionSnapshot} from './hub-prediction-contract.mjs';
const version='CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004';
function fixture(){
 const runners=Array.from({length:6},(_,i)=>({
   horse_no:i+1,horse_name:'HORSE_'+(i+1),status:'ACTIVE',
   rank:i<5?i+1:null,grade:i<5?'B':null,
   evaluation_status:i<5?'RATED':'UNRATED_NO_VERIFIED_HISTORY',
   reason:i<5?'Verified historical results and current conditions.':'公式の過去走履歴未確認。評価を保留。',
   missing_items:i<5?[]:['verified_history','recent_runs:0/5']
 }));
 const payload={runners,top5:runners.slice(0,5).map(r=>({...r})),eye:null,bets:[],summary:'One of six runners has unverified history',
 bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{
  partial_coverage:true,
  unrated_runner_nos:[6],
  ability_coverage:{total_count:6,rated_count:5,warning:'1頭未評価の暫定順位'},
  market_used_for_ranking:false,market_used_for_eye:false,
  eye_abstention_reason:'履歴未確認馬を含むためEYE選定保留',
  runner_evidence_audit:runners.map(r=>({horse_no:r.horse_no,recent_runs_checked:r.horse_no===6?0:5,missing_items:r.missing_items}))
 }};
 const pred={id:'11111111-1111-4111-8111-111111111111',race_date:'2026-10-13',track:'名古屋',
 race_no:1,circuit:'LOCAL',protocol_version:version,payload,integrity:{
  version:1,prediction_id:'11111111-1111-4111-8111-111111111111',source:'OFFICIAL_SAVED',saved:predictionSnapshot(payload)
 }};
 return pred;
}
test('real contract accepts exactly one unrated horse and validates API integrity',()=>{
 const p=fixture();assert.equal(validatePayload(p.payload,false,version),p.payload);
 assert.equal(validatePrediction(p),p);
});
test('API list/reconciliation marks a valid partial prediction FROZEN rather than DATA_ERROR',()=>{
 const p=fixture(),key='2026-10-13|名古屋|1|LOCAL';
 const data={date:'2026-10-13',predictions:[p],races:[{key,race_date:p.race_date,track:p.track,
 race_no:p.race_no,circuit:p.circuit,prediction_status:'FROZEN',prediction:p}]};
 const result=reconcileToday(data,'2026-10-13');
 assert.equal(result.races[0].prediction_status,'FROZEN');
 assert.equal(result.races[0].prediction.id,p.id);
 assert.equal(result.races[0].prediction.payload.runners[5].rank,null);
});
test('fabricated rank and F are rejected for unknown horse',()=>{
 const p=fixture();p.payload.runners[5].rank=6;p.payload.runners[5].grade='F';
 assert.throws(()=>validatePayload(p.payload,false,version),/DATA ERROR/);
});
test('missing verified_history evidence cannot be hidden',()=>{
 const p=fixture();p.payload.runners[5].missing_items=[];
 assert.throws(()=>validatePayload(p.payload,false,version),/partial unrated runner evidence/);
});
test('partial coverage with two unknowns is rejected',()=>{
 const p=fixture();p.payload.runners[4].evaluation_status='UNRATED_NO_VERIFIED_HISTORY';
 p.payload.runners[4].rank=null;p.payload.runners[4].grade=null;
 assert.throws(()=>validatePayload(p.payload,false,version),/invalid partial coverage declaration/);
});
test('fake source credit or EYE selection blocks partial coverage',()=>{
 const p=fixture();p.payload.eye={horse_no:6,horse_name:'HORSE_6',reason:'unknown'};
 assert.throws(()=>validatePayload(p.payload,false,version),/invalid partial coverage declaration/);
});
test('non LOCAL 1.5 protocols retain old strict no-null-ranks rule',()=>{
 const p=fixture();
 assert.throws(()=>validatePayload(p.payload,false,'CHAPPY_LOCAL_1.4_EYE_UPSIDE_20260930'),/invalid saved runner/);
});
test('valid fully ranked LOCAL 1.5 remains backward compatible',()=>{
 const p=fixture();p.payload.runners[5].rank=6;p.payload.runners[5].grade='C';
 p.payload.runners[5].evaluation_status='RATED';
 delete p.payload.audit.partial_coverage;
 assert.equal(validatePayload(p.payload,false,version),p.payload);
});
test('malformed / forged partial TOP5 is rejected',()=>{
 const p=fixture();p.payload.top5[0].rank=2;
 assert.throws(()=>validatePayload(p.payload,false,version),/partial top5 mismatch/);
});
test('snapshot comparison detects any changed rank or grade',()=>{
 const p=fixture();p.payload.runners[1].grade='F';
 assert.throws(()=>validatePrediction(p),/prediction integrity mismatch/);
});
