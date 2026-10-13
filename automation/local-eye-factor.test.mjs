import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalSaveDuringTransition,FACTOR_VERSION} from './local-eye.mjs';
const C=['distance_change','track_change','going_change','class_change','promotion_demotion','weight_change','jockey_change','draw','running_style','pace_peers','margins','passing_order','final_section','trouble','layoff_preparation','current_suitability','same_condition_history'];
const ref='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=40020402017';
const pos=(key)=>({category:key,reason:'今回の'+key+'に好走実績があり条件合致',evidence_refs:[ref],current_relevance:true});
function fixture(counts=[2,3,4],pick=8,tie=null){
 const runners=Array.from({length:8},(_,i)=>({horse_no:i+1,horse_name:'TEST'+(i+1),rank:i+1,grade:'C',reason:'今回条件で確認した比較内容',running_style_reference:['?']}));
 const cand=counts.map((n,i)=>({horse_no:i+6,rank:i+6,upside_trigger:'馬'+(i+6)+'今回条件で上振れ',hidden_evidence:'馬'+(i+6)+'直近着差改善',finish_path:'馬'+(i+6)+'展開合えば上位',risk:'馬'+(i+6)+'相手強化不安',eye_case:pick===i+6,evidence_refs:[ref],review_checks:Object.fromEntries(C.map((k,j)=>[k,{status:j<n?'CHECKED':'MISSING',finding:'馬'+(i+6)+' '+k+' 実走確認',evidence_refs:j<n?[ref]:[]}]))}));
 const factorAudit=counts.map((n,i)=>({horse_no:i+6,positive_factors:C.slice(0,n).map(pos)}));
 const audit={protocol_version:FACTOR_VERSION,rank6_auto_selected:false,eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',eye_selection_method:'LOCAL_EYE_FACTOR_COUNT_V1',market_used_for_eye:false,eye_pool_checked:[6,7,8],eye_candidate_audit:cand,eye_pairwise_comparison:[],eye_positive_factor_audit:factorAudit,eye_tie_break:tie,eye_selected_rank:pick,eye_abstention_reason:pick===null?'好走根拠が2個以上の候補なし、または比較が同等':'NOT_APPLICABLE_SELECTED'};
 return {circuit:'LOCAL',protocol_version:FACTOR_VERSION,payload:{runners,top5:runners.slice(0,5),eye:pick===null?null:{horse_no:pick,horse_name:'TEST'+pick,rank:pick,reason:'複数の独立好走条件が今回揃う'},bets:[],summary:'全頭比較',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit}};
}
const tb=(pick)=>({selected_horse_no:pick,strength_reason:'当該馬の同条件での再現性が強い',recency_reason:'前走の内容が優位',risk_reason:'相手強化の不安が軽い',evidence_refs:[ref]});
test('highest factor count wins, not lowest rank',()=>{assert.equal(assertLocalSaveDuringTransition(fixture()),true)});
test('lower-count EYE rejected',()=>{const v=fixture([2,3,4],7);assert.throws(()=>assertLocalSaveDuringTransition(v),/LOCAL_EYE_SELECTION_MISMATCH/)});
test('two factors minimum enforced',()=>{const v=fixture([1,0,1],null);assert.equal(assertLocalSaveDuringTransition(v),true);v.payload.eye={horse_no:6,horse_name:'TEST6',rank:6,reason:'強い'};assert.throws(()=>assertLocalSaveDuringTransition(v),/LOCAL_EYE_SELECTION_MISMATCH|LOCAL_EYE_ABSTENTION/)});
test('ties resolved with documented rationale',()=>{assert.equal(assertLocalSaveDuringTransition(fixture([2,4,4],8,tb(8))),true)});
test('tie cannot be picked without detailed reasons',()=>{assert.throws(()=>assertLocalSaveDuringTransition(fixture([2,4,4],8,null)),/LOCAL_EYE_TIE_BREAK_SCHEMA|LOCAL_EYE_SELECTION_MISMATCH/)});
test('true tie may abstain',()=>{assert.equal(assertLocalSaveDuringTransition(fixture([2,4,4],null,null)),true)});
test('same category repeated cannot inflate factor count',()=>{const v=fixture();v.payload.audit.eye_positive_factor_audit[2].positive_factors[1].category='distance_change';assert.throws(()=>assertLocalSaveDuringTransition(v),/LOCAL_EYE_FACTOR_DUPLICATE/)});
test('unverified factor cannot count as positive',()=>{const v=fixture();v.payload.audit.eye_positive_factor_audit[2].positive_factors[1].evidence_refs=['FAKE'];assert.throws(()=>assertLocalSaveDuringTransition(v),/LOCAL_EYE_FACTOR_UNVERIFIED/)});
test('market references are forbidden',()=>{const v=fixture();v.payload.audit.eye_positive_factor_audit[2].positive_factors[1].reason='オッズが良い';assert.throws(()=>assertLocalSaveDuringTransition(v),/LOCAL_EYE_MARKET_EVIDENCE/)});

test('recency is a tie criterion, never a hidden eligibility veto',()=>{const v=fixture([2,3,4],8);for(const r of v.payload.audit.eye_positive_factor_audit)for(const f of r.positive_factors)f.current_relevance=false;assert.equal(assertLocalSaveDuringTransition(v),true)});
