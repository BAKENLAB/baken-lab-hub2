import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLocal16EvidenceQuality} from '../automation/local-1-6-scoring-evidence-audit.mjs';

const CHECKS=[
 'distance_change','track_change','going_change','class_change',
 'promotion_demotion','weight_change','jockey_change','draw',
 'running_style','pace_peers','margins','passing_order','final_section',
 'trouble','layoff_preparation','current_suitability','same_condition_history'
];
const ref=n=>`COMPACT_V1.runners[horse_no=${n}].recent_runs[0]`;
function sample(){
 const verifiedRunners=Array.from({length:7},(_,i)=>({
  horse_no:i+1,horse_name:`正式馬${i+1}`,
  recent_runs:[{race_date:'2026-10-20',track:'笠松',
   distance:1400,finish:3,weight_carried:55,jockey:'テスト騎手'}]
 }));
 const runners=verifiedRunners.map((h,i)=>({
  horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,
  score:85-i*3,grade:'B',status:'ACTIVE',reason:'公式1400mの過去走を確認'
 }));
 const checks=()=>Object.fromEntries(CHECKS.map(k=>[k,{
  status:'MISSING',finding:'公式の裏付け未取得',evidence_refs:[]
 }]));
 const payload={runners,top5:runners.slice(0,5),eye:null,bets:[],
  summary:'検証用の架空レース、既存FROZENには触れない',
  bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',
  audit:{
   eye_candidate_audit:[6,7].map(horse_no=>({
    horse_no,rank:horse_no,review_checks:checks()
   })),
   eye_positive_factor_audit:[6,7].map(horse_no=>({
    horse_no,positive_factors:[]
   }))
  }
 };
 return {payload,verifiedRunners,targetDate:'2026-11-18'};
}
function addLedgers(f){
 for(const r of f.payload.runners){
  r.score_ledger={base_score:50,scorer_version:'TEST_SCORER_V1',
   scoring_policy_ref:'TEST_APPROVED_POLICY',
   components:[{rule_id:'verified_prior_run',points:r.score-50,
    evidence_refs:[ref(r.horse_no)]}]};
 }
 f.approvedScoringPolicy={version:'TEST_SCORER_V1',policy_ref:'TEST_APPROVED_POLICY'};
 return f;
}
test('old 1.6 without score ledger is NOT misreported as certified',()=>{
 const x=sample(),before=structuredClone(x);
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.ok,true);
 assert.equal(r.scoreTraceVerified,false);
 assert.equal(r.metrics.missing_score_traces,7);
 assert.equal(r.metrics.missing_checks,34);
 assert.equal(r.production_rank_changed,false);
 assert.deepEqual(x,before);
});
test('strict prospective score trace blocks unproved scores, does not invent point breakdown',()=>{
 const x=sample();
 const r=auditLocal16EvidenceQuality({...x,strictScoreTrace:true});
 assert.equal(r.ok,false);assert.equal(r.code,'LOCAL_SCORE_TRACE_UNPROVEN');
 assert.equal(r.issues.length,7);
});
test('certified source-bound arithmetically reconciled ledger passes strict checking',()=>{
 const x=addLedgers(sample());
 const r=auditLocal16EvidenceQuality({...x,strictScoreTrace:true});
 assert.equal(r.ok,true);assert.equal(r.scoreTraceVerified,true);
 assert.equal(r.metrics.missing_score_traces,0);
});
test('syntactically valid but not certified scorer identity is not accepted',()=>{
 const x=addLedgers(sample());delete x.approvedScoringPolicy;
 const r=auditLocal16EvidenceQuality({...x,strictScoreTrace:true});
 assert.equal(r.code,'LOCAL_SCORE_TRACE_UNPROVEN');
 assert.equal(r.issues[0].code,'SCORE_POLICY_NOT_CERTIFIED');
});
test('invented score addition does not pass only because it adds up near 100',()=>{
 const x=addLedgers(sample());
 x.payload.runners[6].score_ledger.components[0].points+=2;
 const r=auditLocal16EvidenceQuality({...x,strictScoreTrace:true});
 assert.equal(r.code,'LOCAL_SCORE_TRACE_UNPROVEN');
 assert.ok(r.issues.some(v=>v.code==='SCORE_LEDGER_SUM_MISMATCH'));
});
test('CHECKED referring to a different horse is rejected as unverified',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.margins={status:'CHECKED',finding:'公式過去走に着差を確認',
 evidence_refs:[ref(7)]};
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(v=>v.code==='CHECKED_WITHOUT_VERIFIED_RUN'));
});
test('layoff DATE checked never disguises missing training as verified',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.layoff_preparation={status:'CHECKED',
  finding:'10月20日以来の間隔は計算できる。調教未確認',
  evidence_refs:[ref(6)]};
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.ok,true);
 assert.ok(r.gaps.some(g=>g.criterion==='training_preparation'));
 assert.equal(r.metrics.missing_checks,33);
});
test('same-condition check tied to official CURRENT track, not a different track',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.same_condition_history={status:'CHECKED',
  finding:'笠松1400mの走歴が存在する',evidence_refs:[ref(6)]};
 const r=auditLocal16EvidenceQuality({...x,officialPreRace:{
  official_context_verified:true,track:'園田',distance:1400
 }});
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(v=>v.code==='SAME_CONDITION_NOT_VERIFIED'));
});
test('matching official track/distance and declared EYE evidence are accepted',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.same_condition_history={status:'CHECKED',finding:'笠松1400mの記録',
  evidence_refs:[ref(6)]};
 x.payload.audit.eye_positive_factor_audit[0].positive_factors=[{
  category:'same_condition_history',reason:'同場同距離3着',
  evidence_refs:[ref(6)],current_relevance:true
 }];
 const r=auditLocal16EvidenceQuality({...x,officialPreRace:{
  official_context_verified:true,track:'笠松',distance:1400
 }});
 assert.equal(r.ok,true);
});
test('post-race or future official history cannot be injected into scoring',()=>{
 const x=sample();x.verifiedRunners[0].recent_runs[0].race_date='2026-11-18';
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_AUDIT_HISTORY_ASOF_INVALID');
});
test('not even an EYE-positive factor may use invented COMPACT reference',()=>{
 const x=sample();
 x.payload.audit.eye_positive_factor_audit[0].positive_factors=[{
  category:'margins',reason:'当日相手との差',current_relevance:true,
  evidence_refs:['COMPACT_V1.runners[horse_no=6].recent_runs[9]']
 }];
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(v=>v.code==='EYE_FACTOR_NOT_VERIFIED'));
});

test('same race course means track + distance + SURFACE, not just numeric distance',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 x.verifiedRunners[5].recent_runs[0].surface='ダート';
 check.same_condition_history={status:'CHECKED',finding:'笠松1400mの履歴あり',
  evidence_refs:[ref(6)]};
 const r=auditLocal16EvidenceQuality({...x,officialPreRace:{
  official_context_verified:true,track:'笠松',distance:1400,surface:'芝'
 }});
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(v=>v.code==='SAME_CONDITION_NOT_VERIFIED'));
});
test('outdated EYE factors remain diagnostic, never count toward two current positives',()=>{
 const x=sample(),c=x.payload.audit.eye_candidate_audit[0];
 for(const category of ['margins','same_condition_history']){
  c.review_checks[category]={status:'CHECKED',finding:'過去走は確認、今回は不適合',
   evidence_refs:[ref(6)]};
 }
 x.payload.audit.eye_positive_factor_audit[0].positive_factors=
  ['margins','same_condition_history'].map(category=>({
   category,reason:'今回は古い材料 '+category,
   evidence_refs:[ref(6)],current_relevance:false
  }));
 x.payload.eye={horse_no:6,horse_name:'正式馬6',reason:'テスト用EYE'};
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(v=>v.code==='EYE_WITHOUT_TWO_CURRENT_FACTORS'));
 assert.equal(r.metrics.non_current_positive_factors,2);
 assert.equal(r.metrics.current_positive_factors,0);
});

test('LOCAL COMPACT can lack surface; track/distance matches but provenance stays scoped missing',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 // Ordinary local historical records give track/distance without a surface field.
 check.same_condition_history={status:'CHECKED',finding:'笠松1400mを確認、歴史surface欠落',
  evidence_refs:[ref(6)]};
 const r=auditLocal16EvidenceQuality({...x,officialPreRace:{
  official_context_verified:true,track:'笠松',distance:1400,surface:'ダート'
 }});
 assert.equal(r.ok,true);
 assert.ok(r.gaps.some(g=>g.criterion==='same_condition_history'&&
  g.code==='SURFACE_NOT_DIRECTLY_VERIFIED_IN_HISTORY'));
});
test('independent directly supplied matching surface eliminates missingness gap',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 x.verifiedRunners[5].recent_runs[0].surface='ダート';
 check.same_condition_history={status:'CHECKED',finding:'笠松ダート1400m',
  evidence_refs:[ref(6)]};
 const r=auditLocal16EvidenceQuality({...x,officialPreRace:{
  official_context_verified:true,track:'笠松',distance:1400,surface:'ダート'
 }});
 assert.equal(r.ok,true);
 assert.equal(r.gaps.some(g=>g.code==='SURFACE_NOT_DIRECTLY_VERIFIED_IN_HISTORY'),false);
});

test('duplicate COMPACT refs are blocked before the LOCAL MCP guard (real 11/18 failure class)',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.current_suitability={status:'CHECKED',finding:'過去走の比較事実',
  evidence_refs:[ref(6),ref(6)]};
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(v=>v.code==='CHECKED_DUPLICATE_OR_EXCESS_EVIDENCE_REFS'));
});
test('duplicate EYE positive factor refs cannot inflate apparent verification',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.margins={status:'CHECKED',finding:'過去走着差確認',evidence_refs:[ref(6)]};
 x.payload.audit.eye_positive_factor_audit[0].positive_factors=[{
  category:'margins',reason:'出典複製は認めない',
  current_relevance:true,evidence_refs:[ref(6),ref(6)]
 }];
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(v=>v.code==='EYE_FACTOR_NOT_VERIFIED'));
});

test('CHECKED passing order cannot cite history with no actual turn positions',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.passing_order={status:'CHECKED',finding:'通過順確認',evidence_refs:[ref(6)]};
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(z=>z.criterion==='passing_order'&&z.code==='CHECKED_WITHOUT_CATEGORY_SPECIFIC_FACT'));
});
test('CHECKED margin and final section cannot borrow a run with missing metric',()=>{
 const x=sample(),check=x.payload.audit.eye_candidate_audit[0].review_checks;
 check.margins={status:'CHECKED',finding:'着差確認',evidence_refs:[ref(6)]};
 check.final_section={status:'CHECKED',finding:'上がり確認',evidence_refs:[ref(6)]};
 const r=auditLocal16EvidenceQuality(x);
 assert.equal(r.code,'LOCAL_EVIDENCE_ASSERTION_MISMATCH');
 assert.ok(r.issues.some(z=>z.criterion==='margins'&&z.code==='CHECKED_WITHOUT_CATEGORY_SPECIFIC_FACT'));
 assert.ok(r.issues.some(z=>z.criterion==='final_section'&&z.code==='CHECKED_WITHOUT_CATEGORY_SPECIFIC_FACT'));
});
