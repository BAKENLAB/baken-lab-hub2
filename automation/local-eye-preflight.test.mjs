import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLocalEyePreflight as check, CHECKS, VERSION } from './local-eye-preflight.mjs';
const ref=(n,i)=>'COMPACT_V1.runners[horse_no='+n+'].recent_runs['+i+']';
function fixture(){
  const context={protocol_version:VERSION,field_integrity_checked:true,
    race:{race_date:'2026-11-04',track:'金沢',conditions:{distance:1400}},
    runners:Array.from({length:7},(_,i)=>({
      horse_no:i+1,horse_name:'horse'+(i+1),recent_runs:[
        {race_date:'2026-10-19',track:'金沢',race_no:3,distance:1400,finish:3},
        {race_date:'2026-10-06',track:'金沢',race_no:4,distance:1500,finish:2},
        {race_date:'2026-09-08',track:'金沢',race_no:2,distance:1400,finish:2}
      ]
    }))};
  const runners=context.runners.map((h,i)=>({
    horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,
    grade:'C',reason:'金沢過去レース実績を比較'
  }));
  const candidates=[6,7].map(n=>({
    horse_no:n,rank:n,eye_case:n===6,
    evidence_refs:[ref(n,0),ref(n,1),ref(n,2)],
    upside_trigger:'近走入着',hidden_evidence:'同場実績',
    finish_path:'再現性に注目',risk:'格上条件',
    review_checks:Object.fromEntries(CHECKS.map(k=>[k,{
      status:'CHECKED',finding:'公式過去走を確認',
      evidence_refs:[ref(n,0),ref(n,1),ref(n,2)]
    }]))
  }));
  const factors=[
    {category:'same_condition_history',reason:'1400m3着',evidence_refs:[ref(6,0)],current_relevance:true},
    {category:'margins',reason:'別開催1400m2着',evidence_refs:[ref(6,2)],current_relevance:true}
  ];
  const payload={runners,top5:runners.slice(0,5),
    eye:{horse_no:6,horse_name:'horse6',rank:6,reason:'独立する2レース'},
    bets:[],bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',
    audit:{protocol_version:VERSION,market_used_for_eye:false,market_used_for_ranking:false,
      eye_selection_method:'LOCAL_EYE_FACTOR_COUNT_V1',eye_pairwise_comparison:[],
      eye_tie_break:null,eye_selected_rank:6,eye_abstention_reason:'NOT_APPLICABLE_SELECTED',
      eye_pool_checked:[6,7],eye_candidate_audit:candidates,
      eye_positive_factor_audit:[
        {horse_no:6,positive_factors:factors},{horse_no:7,positive_factors:[]}
      ]
    }
  };
  return {context,payload};
}
test('valid independent evidence passes offline',()=>{
  const {context,payload}=fixture();assert.equal(check(context,payload).ok,true);
});
test('Kanazawa 1500m cannot support same-condition 1400m factor',()=>{
  const {context,payload}=fixture();
  payload.audit.eye_positive_factor_audit[0].positive_factors[0].evidence_refs=[ref(6,1)];
  assert.match(check(context,payload).errors.join(','),/SAME_CONDITION_MISMATCH/);
});
test('factor must be linked to its exact audited category',()=>{
  const {context,payload}=fixture();
  payload.audit.eye_candidate_audit[0].review_checks.same_condition_history.evidence_refs=[ref(6,2)];
  assert.match(check(context,payload).errors.join(','),/FACTOR_UNVERIFIED/);
});
test('generic URL is not a race-specific evidence reference',()=>{
  const {context,payload}=fixture(),url='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?x=1';
  payload.audit.eye_positive_factor_audit[0].positive_factors[0].evidence_refs=[url];
  payload.audit.eye_candidate_audit[0].evidence_refs.push(url);
  payload.audit.eye_candidate_audit[0].review_checks.same_condition_history.evidence_refs.push(url);
  assert.match(check(context,payload).errors.join(','),/NOT_EXACT_RUN_REFERENCE/);
});
test('past factor without current relevance does not count',()=>{
  const {context,payload}=fixture();
  payload.audit.eye_positive_factor_audit[0].positive_factors[1].current_relevance=false;
  assert.match(check(context,payload).errors.join(','),/EYE_BELOW_TWO_FACTORS/);
});
test('same race cannot count as two independent positives',()=>{
  const {context,payload}=fixture();
  payload.audit.eye_positive_factor_audit[0].positive_factors[1].evidence_refs=[ref(6,0)];
  assert.match(check(context,payload).errors.join(','),/SAME_RACE_DOUBLE_COUNT/);
});
test('TOP5 mismatch is rejected',()=>{
  const {context,payload}=fixture();payload.top5.pop();
  assert.match(check(context,payload).errors.join(','),/TOP5_SET/);
});
test('runner lacking verified history is rejected',()=>{
  const {context,payload}=fixture();context.runners[2].recent_runs=[];
  assert.match(check(context,payload).errors.join(','),/MISSING_VERIFIED_HISTORY/);
});
test('bets cannot be enabled',()=>{
  const {context,payload}=fixture();payload.bets=['test'];
  assert.match(check(context,payload).errors.join(','),/BETS_CONTRACT/);
});
