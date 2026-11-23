// Synthetic-only deterministic factor replayer. No real JRA signature, operator
// approval, official full model, or current production write is supplied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateResearchSourcePoints} from
 '../research/jra-scoring-integrity-20261121/claim-retention/source-to-points-scorer.candidate.mjs';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
function fixture(){
 const runs=[
  {race_date:'2026-11-08',run_id:'run1',horse_id:'horse1',source_ref:'archive:run1',
   original_sha256:a,track:'東京',surface:'芝',distance:1800,
   margin_to_winner:0.2,final3f:34.4,corner_positions:[5,4,2,2],
   race_class:'2勝クラス',going:'良'},
  {race_date:'2026-10-18',run_id:'run2',horse_id:'horse1',source_ref:'archive:run2',
   original_sha256:b,track:'京都',surface:'芝',distance:1600,
   margin_to_winner:0.7,final3f:35.1,corner_positions:[4,7],
   race_class:'1勝クラス',going:'稍重'},
  {race_date:'2026-11-15',run_id:'run3',horse_id:'horse2',source_ref:'archive:run3',
   original_sha256:c,track:'東京',surface:'芝',distance:1800,
   margin_to_winner:1.2,final3f:36,corner_positions:[7,8,10],
   race_class:'1勝クラス',going:'良'}
 ];
 const context={race:{race_date:'2026-11-23',track:'東京',field_payload:{
   race:{surface:'芝',distance:1800,going:'良'}}},
   runner_history:[
    {horse_no:1,horse_name:'合成1',past_runs:runs.slice(0,2)},
    {horse_no:2,horse_name:'合成2',past_runs:runs.slice(2)}],
   candidates:[{horse_no:1,base_rank:1,base_rate:0.5},
    {horse_no:2,base_rank:2,base_rate:0.4}]};
 const selectedRuns=runs.map((r,i)=>({horse_no:i<2?1:2,run_id:r.run_id,
   horse_id:r.horse_id,source_ref:r.source_ref,original_sha256:r.original_sha256,
   original_bytes_verified:true,verified_before_post:true}));
 const policy={classification:'UNAPPROVED_RESEARCH_ONLY',
   id:'SYNTHETIC_NOT_A_REAL_SCORING_POLICY',
   base_policy_id:'JRA_RESEARCH_BASE_30PLUS38_V1',
   rules:[
    {kind:'margin',mode:'numeric',bands:[{lte:0.4,points:3},{lte:1.0,points:1}],
     otherwise_points:-1},
    {kind:'distance',mode:'numeric',bands:[{lte:0,points:2},{lte:200,points:1}],
     otherwise_points:-1},
    {kind:'corners',mode:'numeric',bands:[{lte:0,points:-1},{lte:3,points:2}],
     otherwise_points:3},
    {kind:'class',mode:'category',
     categories:{'2勝クラス':2,'1勝クラス':-1},
     otherwise_points:-2}
   ]};
 return {context,selectedRuns,policy};
}
test('same full fact snapshot and exactly same policy generates identical full points and order',()=>{
 const x=fixture(),before=structuredClone(x);
 const a=generateResearchSourcePoints(x);
 const b=generateResearchSourcePoints(structuredClone(x));
 assert.deepEqual(a,b);
 assert.deepEqual(x,before);
 assert.equal(a.runners.length,2);
 assert.equal(a.runners[0].base_score,49);
 assert.equal(a.runners[0].research_score,58);
 assert.equal(a.runners[1].base_score,45);
 assert.equal(a.runners[1].research_score,44);
 assert.equal(a.source_runs_used,3);
 assert.equal(a.runners[0].effects.length,8);
 assert.equal(a.official_issuer_verified,false);
 assert.equal(a.formal_score_verified,false);
 assert.equal(a.original_scorer_recovered,false);
 assert.equal(a.production_allowed,false);
 assert.equal(a.full_factor_coverage,false);
 assert.deepEqual(a.unconnected_factor_categories,['pace','opponent','race_shape','eval']);
});
test('semantic input reordering does not change generated points, ranks or evidence hash',()=>{
 const x=fixture(),before=generateResearchSourcePoints(x);
 const shuffled=fixture();
 shuffled.context.runner_history.reverse();
 shuffled.context.runner_history[1].past_runs.reverse();
 shuffled.context.candidates.reverse();
 shuffled.selectedRuns.reverse();
 shuffled.policy.rules.reverse();
 const after=generateResearchSourcePoints(shuffled);
 assert.deepEqual(after,before);
});
test('one changed official fact with same identity creates a different non-hidden point result',()=>{
 const x=fixture(),before=generateResearchSourcePoints(x);
 x.context.runner_history[0].past_runs[0].margin_to_winner=1.3;
 const after=generateResearchSourcePoints(x);
 assert.notEqual(after.runners[0].research_score,before.runners[0].research_score);
 assert.notEqual(after.input_sha256,before.input_sha256);
 assert.equal(after.runners[0].research_score,54);
});
test('no implicit factor weights and unknown full-score formula refuse calculation',()=>{
 const x=fixture();delete x.policy.rules;
 assert.throws(()=>generateResearchSourcePoints(x),/POLICY_NOT_DECLARED/);
 const y=fixture();y.policy.rules.push({kind:'pace',mode:'numeric',
   bands:[{lte:10,points:5}],otherwise_points:0});
 assert.throws(()=>generateResearchSourcePoints(y),/RULE_KIND_OR_MODE/);
 const z=fixture();z.policy.rules[0].bands=[{lte:1,points:1},{lte:0.2,points:2}];
 assert.throws(()=>generateResearchSourcePoints(z),/NUMERIC_BANDS_OVERLAP/);
});
test('unverified original bytes, wrong run identity and surrogate source refuse',()=>{
 const x=fixture();x.selectedRuns[0].original_bytes_verified=false;
 assert.throws(()=>generateResearchSourcePoints(x),/ORIGINAL_SOURCE_PROOF_UNAVAILABLE/);
 const y=fixture();y.selectedRuns[0].horse_id='other';
 assert.throws(()=>generateResearchSourcePoints(y),/EXACT_SELECTED_RUN_MISMATCH/);
 const z=fixture();z.selectedRuns[0].source_ref='CLAIMED_CONTEXT_RUN:1:0';
 z.context.runner_history[0].past_runs[0].source_ref=z.selectedRuns[0].source_ref;
 assert.throws(()=>generateResearchSourcePoints(z),/ORIGINAL_SOURCE_PROOF_UNAVAILABLE/);
});
test('no later target result, missing score fact or duplicate selected run',()=>{
 const x=fixture();x.context.runner_history[0].past_runs[0].race_date='2026-11-23';
 assert.throws(()=>generateResearchSourcePoints(x),/RUN_IDENTITY_OR_ASOF_INVALID/);
 const y=fixture();delete y.context.runner_history[0].past_runs[0].corner_positions;
 assert.throws(()=>generateResearchSourcePoints(y),/CORNERS_MISSING/);
 const z=fixture();z.selectedRuns.push(structuredClone(z.selectedRuns[0]));
 assert.throws(()=>generateResearchSourcePoints(z),/DUPLICATE_SELECTED_RUN_PROOF/);
});

// The comparison is independent of caller-supplied review scores. It must
// reject effects that differ from the deterministic re-computation.
test('source-to-points comparator checks every effect, base, rank and final score',async()=>{
 const {compareResearchGeneratedToDeclared}=await import(
  '../research/jra-scoring-integrity-20261121/claim-retention/source-to-points-compare.candidate.mjs');
 const x=fixture(),computed=generateResearchSourcePoints(x);
 const payload={runners:computed.runners.map(r=>({horse_no:r.horse_no,
    horse_name:r.horse_name,rank:r.research_rank,score:r.research_score})),
  audit:{runner_history_checked:computed.runners.map(r=>({horse_no:r.horse_no,
    base_score:r.base_score,score_after:r.research_score,rank_after:r.research_rank,
    evidence_effects:structuredClone(r.effects)}))}};
 const valid=compareResearchGeneratedToDeclared({...x,payload});
 assert.equal(valid.ok,true,JSON.stringify(valid));
 assert.equal(valid.checked_horses,2);
 assert.equal(valid.formal_scoring_allowed,false);
 assert.equal(valid.official_original_verified,false);
 const diff=structuredClone(payload);diff.audit.runner_history_checked[0].evidence_effects[0].points++;
 assert.equal(compareResearchGeneratedToDeclared({...x,payload:diff}).reason,
  'REPLAY_FACTOR_POINTS_OR_PROVENANCE_MISMATCH');
 const fake=structuredClone(payload);fake.audit.runner_history_checked[0].evidence_effects[0].original_sha256='f'.repeat(64);
 assert.equal(compareResearchGeneratedToDeclared({...x,payload:fake}).reason,
  'REPLAY_FACTOR_POINTS_OR_PROVENANCE_MISMATCH');
 const base=structuredClone(payload);base.audit.runner_history_checked[0].base_score++;
 assert.equal(compareResearchGeneratedToDeclared({...x,payload:base}).reason,
  'REPLAY_BASE_MISMATCH');
 const score=structuredClone(payload);score.runners[0].score++;
 assert.equal(compareResearchGeneratedToDeclared({...x,payload:score}).reason,
  'REPLAY_FINAL_SCORE_MISMATCH');
 const rank=structuredClone(payload);rank.runners[0].rank=2;
 assert.equal(compareResearchGeneratedToDeclared({...x,payload:rank}).reason,
  'REPLAY_RANK_MISMATCH');
 const unavailable=compareResearchGeneratedToDeclared({context:x.context,selectedRuns:[],policy:x.policy,payload});
 assert.equal(unavailable.ok,false);
 assert.equal(unavailable.formal_scoring_allowed,false);
});
