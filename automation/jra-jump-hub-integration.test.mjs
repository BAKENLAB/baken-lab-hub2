import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION} from './jra-jump-k2-adapter.mjs';
import {protocolPolicy,predictionSnapshot,validatePrediction,reconcileToday,validateResults} from './hub-prediction-contract.mjs';
function fixture(protocol=VERSION,circuit='JRA'){
 const runners=Array.from({length:7},(_,i)=>({horse_no:i+1,horse_name:'Fixture '+(i+1),rank:i+1,score:90-i*9,grade:'B',status:'ACTIVE',reason:'Synthetic verified fixture',mark:['◎','○','▲','☆','△'][i]??null}));
 const p={runners,top5:runners.slice(0,5),eye:null,bets:[],summary:{text:'Synthetic fixture'},bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{protocol_version:protocol}};
 const row={id:'fixture-id',race_date:'2026-01-01',race_no:5,track:circuit==='JRA'?'福島':'名古屋',circuit,protocol_version:protocol,status:'FROZEN',payload:p,integrity:{version:1,prediction_id:'fixture-id',saved:predictionSnapshot(p)}};
 const key=[row.race_date,row.track,row.race_no,circuit].join('|');return {row,key};
}
for(const [version,circuit] of [[VERSION,'JRA'],['JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023','JRA'],['CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013','LOCAL']]){
 test('shared HUB transport accepts '+version,()=>{const {row,key}=fixture(version,circuit);assert.equal(validatePrediction(row),row);
 const rr={key,race_date:row.race_date,race_no:row.race_no,track:row.track,circuit,prediction_status:'FROZEN',prediction:row};
 const view=reconcileToday({date:row.race_date,races:[rr],predictions:[row]},row.race_date);
 assert.equal(view.races[0].prediction_status,'FROZEN');
 assert.deepEqual(view.races[0].prediction.payload.top5,row.payload.top5);
 const result=validateResults({date:row.race_date,results:[{...rr,prediction_state:'FOUND',result:{finishers:[]}}]},row.race_date);
 assert.equal(result[0].prediction_state,'FOUND');
 });
}
test('unknown protocol remains rejected',()=>assert.throws(()=>protocolPolicy('UNKNOWN'),/unsupported protocol_version/));
test('rank tampering still fails integrity verification',()=>{const {row}=fixture();row.payload.runners[0].rank=7;assert.throws(()=>validatePrediction(row),/integrity mismatch/);});
