import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePrediction,reconcileToday,predictionSnapshot,protocolPolicy} from './hub-prediction-contract.mjs';
const v16='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013';
function fixture(){
 const runners=Array.from({length:8},(_,i)=>({horse_no:i+1,horse_name:'H'+(i+1),rank:i+1,grade:'C',reason:'Verified past performances and current conditions'}));
 const payload={runners,top5:runners.slice(0,5),eye:{horse_no:8,horse_name:'H8',rank:8,reason:'Three separate positive factors confirmed'},bets:[],
  summary:'Verified before post',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{
    eye_selection_method:'LOCAL_EYE_FACTOR_COUNT_V1',
    eye_pairwise_comparison:[],
    eye_positive_factor_audit:[{horse_no:6,positive_factors:[]},{horse_no:7,positive_factors:[]},
      {horse_no:8,positive_factors:[{category:'distance_change',reason:'Distance suitable',evidence_refs:['https://example.org/race'],current_relevance:true},
        {category:'margins',reason:'Recent margin narrowing',evidence_refs:['https://example.org/race'],current_relevance:true},
        {category:'current_suitability',reason:'Track shape suits',evidence_refs:['https://example.org/race'],current_relevance:true}]}],
    eye_tie_break:null
  }};
 const id='11111111-1111-4111-8111-111111111111';
 return {id,race_date:'2026-10-13',track:'門別',race_no:8,circuit:'LOCAL',protocol_version:v16,payload,integrity:{version:1,prediction_id:id,source:'OFFICIAL_SAVED',saved:predictionSnapshot(payload)}};
}
test('LOCAL v16 protocol is supported with EYE reason and optional partial coverage policy',()=>{
 const policy=protocolPolicy(v16);assert.deepEqual(policy.eyeFields,['reason']);assert.equal(policy.allowOneUnratedNoHistory,true);
});
test('LOCAL v16 official FROZEN data passes HUB integrity checking, without changing factor audit',()=>{
 const p=fixture();assert.equal(validatePrediction(p),p);assert.equal(p.payload.audit.eye_positive_factor_audit[2].positive_factors.length,3);
});
test('LOCAL v16 HUB TODAY retains the stored prediction and EYE',()=>{
 const p=fixture(),key='2026-10-13|門別|8|LOCAL';
 const result=reconcileToday({date:'2026-10-13',predictions:[p],races:[{key,race_date:p.race_date,track:p.track,race_no:p.race_no,circuit:p.circuit,prediction_status:'FROZEN',prediction:p}]},'2026-10-13');
 assert.equal(result.races[0].prediction_status,'FROZEN');assert.equal(result.races[0].prediction.payload.eye.horse_no,8);
});
