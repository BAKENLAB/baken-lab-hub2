import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalSaveDuringTransition} from './local-eye.mjs';

const VERSION='CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004';
const CHECKS=['distance_change','track_change','going_change','class_change',
'promotion_demotion','weight_change','jockey_change','draw','running_style',
'pace_peers','margins','passing_order','final_section','trouble',
'layoff_preparation','current_suitability','same_condition_history'];
const currentRef='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=24&k_raceDate=2026%2F10%2F13&k_raceNo=1';
export function fixture(partial=true) {
 const runners=Array.from({length:6},(_,i)=>({
   horse_no:i+1,horse_name:'TEST_HORSE_'+(i+1),status:'ACTIVE',
   rank:i<5?i+1:partial?null:6,grade:i<5?'B':partial?null:'E',
   evaluation_status:i===5&&partial?'UNRATED_NO_VERIFIED_HISTORY':'RATED',
   reason:i===5&&partial?'NAR公式過去走が未確認で能力比較不能。今回の出走登録だけ確認した。':'確認済みの過去走に基づく具体的な能力評価。',
   running_style_reference:['?'],
   missing_items:i===5&&partial?['verified_history','recent_runs:0/5']:[]
 }));
 const c={horse_no:6,rank:partial?null:6,
   upside_trigger:'6番は公式近走履歴が取得できず上振れ材料不明。',
   hidden_evidence:'6番は公的履歴が確認できず隠れた好走証拠が不明。',
   finish_path:'6番は履歴ゼロのため1〜3着の到達筋を確認できない。',
   risk:'6番は未出走か取得不能かを確定できず能力不明。',
   eye_case:false,evidence_refs:[],
   review_checks:Object.fromEntries(CHECKS.map(key=>[key,{status:'MISSING',finding:'6番の'+key+'は公式過去走がなく確認不能。',evidence_refs:[]}]))
 };
 const audit={
   protocol_version:VERSION,rank6_auto_selected:false,
   eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',
   eye_selection_method:'LOCAL_EYE_COMPARISON_V1',
   market_used_for_eye:false,market_used_for_ranking:false,
   eye_pool_checked:[6],eye_candidate_audit:[c],eye_pairwise_comparison:[],
   eye_abstention_reason:'⑥の履歴が確認できず全候補を比較不能。EYEの選出を保留。',
   eye_selected_rank:null,all_runners_checked:true,
   runner_evidence_audit:runners.map(r=>({horse_no:r.horse_no,
    recent_runs_checked:r.horse_no===6&&partial?0:5,
    evidence_summary:r.horse_no===6&&partial?'履歴未確認':'過去走を個別確認',
    missing_items:r.missing_items
   }))
 };
 if(partial){
  audit.partial_coverage=true;
  audit.unrated_runner_nos=[6];
  audit.ability_coverage={rated_count:5,total_count:6,warning:'1頭未評価の暫定順位。未評価馬の走力は未確認。'};
 }
 return {circuit:'LOCAL',protocol_version:VERSION,
  payload:{runners,top5:runners.slice(0,5),eye:null,bets:[],
    summary:'5頭の履歴確認、1頭履歴未確認のため部分評価。',
    bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit}};
}
test('partial coverage accepts one unrated horse with null rank and grade and EYE abstention',()=>{
 assert.equal(assertLocalSaveDuringTransition(fixture(true)),true);
});
test('existing fully ranked LOCAL race remains valid unchanged',()=>{
 assert.equal(assertLocalSaveDuringTransition(fixture(false)),true);
});
test('unknown horse must not be silently assigned last rank',()=>{
 const x=fixture(true);x.payload.runners[5].rank=6;
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PARTIAL_UNRATED_EVIDENCE/);
});
test('unknown horse must not be silently given F grade',()=>{
 const x=fixture(true);x.payload.runners[5].grade='F';
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PARTIAL_UNRATED_EVIDENCE/);
});
test('verified_history missing evidence is mandatory',()=>{
 const x=fixture(true);x.payload.runners[5].missing_items=[];
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PARTIAL_UNRATED_EVIDENCE/);
});
test('unrated runner cannot be snuck into normal full rankings',()=>{
 const x=fixture(true);delete x.payload.audit.partial_coverage;
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PARTIAL_UNDECLARED|LOCAL_EYE_RUNNERS/);
});
test('a second unknown runner blocks partial coverage',()=>{
 const x=fixture(true);x.payload.runners[4].rank=null;x.payload.runners[4].grade=null;
 x.payload.runners[4].evaluation_status='UNRATED_NO_VERIFIED_HISTORY';
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PARTIAL_COVERAGE/);
});
test('unrated runners must not be silently omitted from EYE pool',()=>{
 const x=fixture(true);x.payload.audit.eye_pool_checked=[];
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_POOL_SET/);
});
test('unrated runner candidate cannot be selected EYE',()=>{
 const x=fixture(true);x.payload.eye={horse_no:6,horse_name:'TEST_HORSE_6',reason:'根拠不明'};
 assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_EYE_PARTIAL_COVERAGE/);
});
