import test from 'node:test';
import assert from 'node:assert/strict';
import {CHECKS,FACTOR_VERSION} from './local-claimed-prod-guard-v19.mjs';
import {testLocalPayloadBeforeOfficialMcp} from '../automation/local-production-v19-guard-parity.mjs';
const make=()=>{
 const runners=Array.from({length:7},(_,i)=>({
  horse_no:i+1,horse_name:'架空検証馬'+(i+1),status:'ACTIVE',
  rank:i+1,mark:i<5?['◎','○','▲','☆','△'][i]:null,
  score:94-i*7,grade:i<2?'S':i<5?'A':'B',
  running_style_reference:['?'],
  reason:'直近同場ダ1200mの着差と距離実績を検証'
 }));
 const reviewChecks=()=>Object.fromEntries(CHECKS.map(k=>[k,{
  status:'MISSING',finding:'この観点の独立証拠は取得できていない',evidence_refs:[]
 }]));
 const candidates=[6,7].map(n=>({
  horse_no:n,rank:n,
  upside_trigger:'現在条件での好走の証拠が揃わない',
  hidden_evidence:'過去の同場実績が乏しい',
  finish_path:'今回3着以内へ進出する資料が不足している',
  risk:'近走では同条件の好走を確認できない',
  eye_case:false,evidence_refs:[],review_checks:reviewChecks()
 }));
 return {
  runners,top5:runners.slice(0,5),eye:null,bets:[],
  bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',
  summary:'公式7頭を比較。能力評価とEYEは別監査。',
  audit:{
   protocol_version:FACTOR_VERSION,
   rank6_auto_selected:false,
   market_used_for_eye:false,
   eye_selection_method:'LOCAL_EYE_FACTOR_COUNT_V1',
   eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',
   eye_pool_checked:[6,7],
   eye_candidate_audit:candidates,
   eye_positive_factor_audit:[6,7].map(horse_no=>({horse_no,positive_factors:[]})),
   eye_pairwise_comparison:[],eye_tie_break:null,eye_selected_rank:null,
   eye_abstention_reason:'TOP5外2頭について同条件の独立肯定因子2件がない'
  }
 };
};
const pre=p=>testLocalPayloadBeforeOfficialMcp({
 payload:p,protocolVersion:FACTOR_VERSION
});
test('actual deployed LOCAL v19 guard approves structure with audited nonmarket negatives',()=>{
 const out=pre(make());
 assert.deepEqual(out,{ok:true,code:'PINNED_V19_VALIDATOR_ACCEPTS_STRUCTURE'});
});
test('original failed negative-market phrase is caught before calling official MCP',()=>{
 const p=make();p.audit.eye_candidate_audit[0].upside_trigger='人気薄という理由だけで採用しない';
 assert.deepEqual(pre(p),{ok:false,code:'LOCAL_EYE_MARKET_EVIDENCE'});
});
test('denial of market evaluation still rejects any market-key in EYE factors',()=>{
 const p=make();p.audit.eye_positive_factor_audit[0].market_used=false;
 assert.deepEqual(pre(p),{ok:false,code:'LOCAL_EYE_MARKET_EVIDENCE'});
});
test('EYE pool missing a horse refuses without submitting to MCP',()=>{
 const p=make();p.audit.eye_pool_checked=[6];
 assert.equal(pre(p).ok,false);
});
test('production validator version drift must fail closed',()=>{
 assert.deepEqual(testLocalPayloadBeforeOfficialMcp({
  payload:make(),protocolVersion:FACTOR_VERSION,currentDeployedMcpVersion:20
 }),{ok:false,code:'DEPLOYED_VALIDATOR_VERSION_CHANGED'});
});
