import test from 'node:test';
import assert from 'node:assert/strict';
import {examineNewLocalSave} from '../automation/local-guarded-save-readiness.mjs';
import {CHECKS,FACTOR_VERSION} from './local-claimed-prod-guard-v19.mjs';
const now='2026-11-09T14:49:00+09:00',postTime='2026-11-09T15:30:00+09:00';
const make=()=>{
 const verifiedRunners=Array.from({length:7},(_,i)=>({
   horse_no:i+1,horse_name:'テスト馬'+(i+1),
   recent_runs:[{race_date:'2026-10-20',track:'川崎',finish:3,distance:1400}]
 }));
 const runners=verifiedRunners.map((h,i)=>({
   horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,
   score:90-i*5,grade:'A',status:'ACTIVE',
   running_style_reference:['?'],reason:'同場1400mの実走証拠あり'
 }));
 const review_checks=Object.fromEntries(CHECKS.map(key=>[key,{
   status:'MISSING',finding:'この観点の独立した事前証拠が取得できない',
   evidence_refs:[]
 }]));
 const outside=[6,7];
 const payload={
   runners,top5:runners.slice(0,5),eye:null,bets:[],
   bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',
   summary:'現行モデルの全頭比較によるTOP5',
   audit:{
    protocol_version:FACTOR_VERSION,rank6_auto_selected:false,
    market_used_for_eye:false,eye_selection_method:'LOCAL_EYE_FACTOR_COUNT_V1',
    eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',
    eye_pool_checked:outside,
    eye_candidate_audit:outside.map(horse_no=>({
      horse_no,rank:horse_no,upside_trigger:'近況の接近証拠が不足',
      hidden_evidence:'独立した好走歴を確認できない',
      finish_path:'今回の1400mで3着圏の根拠が不足',
      risk:'直近同場では未勝利',eye_case:false,
      evidence_refs:[],review_checks:structuredClone(review_checks)
    })),
    eye_positive_factor_audit:outside.map(horse_no=>({horse_no,positive_factors:[]})),
    eye_pairwise_comparison:[],eye_tie_break:null,eye_selected_rank:null,
    eye_abstention_reason:'TOP5外全頭の独立した今回条件適合因子2件以上を確認できない'
   }
 };
 return {payload,verifiedRunners,protocolVersion:FACTOR_VERSION,now,postTime};
};
test('valid first input passes full deployed v19 parity, read-only',()=>{
 const a=make(),copy=structuredClone(a);
 assert.equal(examineNewLocalSave(a).code,'PRE_SUBMIT_V19_PARITY_PASS');
 assert.deepEqual(a,copy);
});
test('Morioka3 negative market wording rejected before MCP; never rewrite',()=>{
 const a=make();a.payload.audit.eye_candidate_audit[0].hidden_evidence='人気薄を理由に採用しない';
 const before=structuredClone(a);
 assert.equal(examineNewLocalSave(a).code,'LOCAL_EYE_MARKET_EVIDENCE_PRE_SAVE_BLOCK');
 assert.deepEqual(a,before);
});
test('Kawasaki1 CHECKED with empty references blocked by full v19 even after weak SQL passes',()=>{
 const a=make();a.payload.audit.eye_candidate_audit[0].review_checks.weight_change={
  status:'CHECKED',finding:'斤量は取得している',evidence_refs:[]
 };
 assert.equal(examineNewLocalSave(a).code,'LOCAL_EYE_CHECK_EVIDENCE');
});
test('Kawasaki1 two horses without history never manufactured as rated',()=>{
 const a=make();
 for(const n of [4,5])a.verifiedRunners[n-1].recent_runs=[];
 assert.deepEqual(examineNewLocalSave(a),{
  ok:false,code:'MULTIPLE_RUNNERS_WITHOUT_VERIFIED_HISTORY',horse_nos:[4,5]
 });
});
test('one zero-history runner requires explicit partial coverage; cannot silently rank',()=>{
 const a=make();a.verifiedRunners[3].recent_runs=[];
 assert.equal(examineNewLocalSave(a).code,'PARTIAL_COVERAGE_MUST_BE_DECLARED');
});
test('known guard rejection, past cutoff, or mismatched roster fail closed',()=>{
 const a=make();
 assert.equal(examineNewLocalSave({...a,previousGuardRejected:true}).code,'PREVIOUS_GUARD_REJECTION_NO_RESUBMIT');
 assert.equal(examineNewLocalSave({...a,now:'2026-11-09T15:28:00+09:00'}).code,'NOT_SAFELY_PRE_RACE');
 a.verifiedRunners[0].horse_name='違う馬';
 assert.equal(examineNewLocalSave(a).code,'ROSTER_IDENTITY_MISMATCH');
});
test('deployed validator version drift cannot be silently accepted',()=>{
 assert.equal(examineNewLocalSave({...make(),deployedValidatorVersion:20}).code,'DEPLOYED_VALIDATOR_VERSION_CHANGED');
});
