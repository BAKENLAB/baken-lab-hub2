import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalSaveDuringTransition } from './local-eye.mjs';
import { fixture } from './local-eye-partial.test.mjs';

const keys=['distance_change','track_change','going_change','class_change','promotion_demotion',
'weight_change','jockey_change','draw','running_style','pace_peers','margins','passing_order',
'final_section','trouble','layoff_preparation','current_suitability','same_condition_history'];

function sample(){
 const x=fixture(false);
 const runners=x.payload.runners;
 for(let n=7;n<=8;n++)runners.push({
   horse_no:n,horse_name:'TEST_HORSE_'+n,status:'ACTIVE',rank:n,grade:'C',
   reason:n+'番の検証済み過去走で能力を判断',
   running_style_reference:['?'],missing_items:[]
 });
 x.payload.audit.runner_evidence_audit=runners.map(r=>({
   horse_no:r.horse_no,recent_runs_checked:4,
   evidence_summary:r.horse_no+'番の根拠を確認',missing_items:[]}));
 const outside=[6,7,8];
 const profile=n=>({
  horse_no:n,rank:n,eye_case:n===6,
  upside_trigger:n+'番の前走と今回距離の相性を確認',
  hidden_evidence:n+'番の同場の近走で着差を確認',
  finish_path:n+'番が前走を再現すれば3着可能',
  risk:n+'番は今回展開と級の変化が不明',
  evidence_refs:['https://www.keiba.go.jp/example/'+n],
  review_checks:Object.fromEntries(keys.map(k=>[k,{
   status:'CHECKED',finding:n+'番 '+k+'の過去走の根拠を確認',
   evidence_refs:['https://www.keiba.go.jp/example/'+n]
  }]))
 });
 x.payload.audit.eye_pool_checked=outside;
 x.payload.audit.eye_candidate_audit=outside.map(profile);
 const pair=(a,b,p)=>({
   horse_nos:[a,b],preferred_horse_no:p,
   criterion:'CURRENT_UPSIDE_OVER_BASELINE',
   reason:a+'番と'+b+'番の今回条件での上振れを独立比較',
   evidence_refs:['https://www.keiba.go.jp/example/'+a,'https://www.keiba.go.jp/example/'+b]
 });
 x.payload.audit.eye_pairwise_comparison=[pair(6,7,6),pair(6,8,6),pair(7,8,7)];
 x.payload.audit.eye_selected_rank=6;
 x.payload.audit.eye_abstention_reason=null;
 x.payload.eye={horse_no:6,horse_name:'TEST_HORSE_6',rank:6,
 reason:'同場・同距離の実績と直近の着差で独立上振れを比較'};
 return x;
}
test('non-EYE pair winner can be preferred when a unique EYE wins all their pairs',()=>{
 const x=sample();
 assert.equal(x.payload.audit.eye_pairwise_comparison[2].preferred_horse_no,7);
 assert.equal(x.payload.audit.eye_candidate_audit[1].eye_case,false);
 assert.equal(assertLocalSaveDuringTransition(x),true);
});
test('candidate selected as EYE must still defeat every other candidate',()=>{
 const x=sample();
 x.payload.audit.eye_pairwise_comparison[1].preferred_horse_no=8;
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_ABSTENTION|LOCAL_EYE_SELECTION_MISMATCH/);
});
test('unrelated pair winner cannot be outside that pair',()=>{
 const x=sample();
 x.payload.audit.eye_pairwise_comparison[2].preferred_horse_no=6;
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PAIR_PREFERENCE/);
});
test('every pair needs real references linked to both candidates',()=>{
 const x=sample();
 x.payload.audit.eye_pairwise_comparison[2].evidence_refs=['https://www.keiba.go.jp/example/7'];
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PAIR_UNLINKED/);
});
