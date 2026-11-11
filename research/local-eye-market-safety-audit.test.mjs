import test from 'node:test';
import assert from 'node:assert/strict';
import {checkLocalEyeTextBeforeSave} from '../automation/local-eye-market-safety-audit.mjs';
const proto='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013';
const base=()=>({eye:null,audit:{
 eye_candidate_audit:[{horse_no:10,rank:6,eye_case:false,
  risk:'11/1同場ダ1200m5着1.7秒差',
  finish_path:'同場同距離で現在性のある証拠が不足',
  upside_trigger:'近走の同条件好走の根拠を確認できない',
  hidden_evidence:'以前の水沢3着0.3秒差と直近盛岡5着1.7秒差',
  evidence_refs:[],review_checks:{}}],
 eye_positive_factor_audit:[{horse_no:10,positive_factors:[]}],
 eye_pairwise_comparison:[],eye_tie_break:null,
 eye_abstention_reason:'上位入線を裏付ける肯定材料2件に達しない'
}});
const check=p=>checkLocalEyeTextBeforeSave({payload:p,protocolVersion:proto});
test('ordinary independent evidence leaves production market-text guard satisfied',()=>{
 const r=check(base());
 assert.equal(r.ok,true);
 assert.deepEqual(r.issues,[]);
});
test('a NEGATED popularity phrase still triggers production text guard and must fail pre-save',()=>{
 const p=base();p.audit.eye_candidate_audit[0].upside_trigger='人気薄だから選ばない';
 const x=check(p);
 assert.equal(x.ok,false);
 assert.equal(x.status,'LOCAL_EYE_MARKET_EVIDENCE_PRE_SAVE_BLOCK');
 assert.deepEqual(x.issues,[{
  path:'audit.eye_candidate_audit[0].upside_trigger',
  reason:'FORBIDDEN_MARKET_TEXT'
 }]);
});
test('EYE explanation cannot contain forbidden odds or market identifiers',()=>{
 const p=base();
 p.audit.eye_candidate_audit[0].hidden_evidence='オッズを使わず独立評価';
 p.audit.eye_abstention_reason='市場情報を採点しない';
 const x=check(p);
 assert.equal(x.ok,false);
 assert.equal(x.issues.length,2);
});
test('market field key is blocked even if its value is a denial',()=>{
 const p=base();
 p.audit.eye_positive_factor_audit[0].market_used=false;
 const x=check(p);
 assert.equal(x.ok,false);
 assert.ok(x.issues.some(x=>x.reason==='FORBIDDEN_MARKET_KEY'));
});
test('unknown protocol is never accepted as safe',()=>{
 const r=checkLocalEyeTextBeforeSave({
  payload:base(),protocolVersion:'UNVERIFIED_MODEL'
 });
 assert.equal(r.ok,false);
 assert.equal(r.status,'INVALID_LOCAL_PRE_SAVE_OPTIONS');
});
