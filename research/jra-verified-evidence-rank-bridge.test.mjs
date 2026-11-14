import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJraVerifiedEvidenceRankBridge as rankBridge,
 verifyJraBridgeAlreadyApplied as verify} from '../automation/jra-verified-evidence-rank-bridge.mjs';

const NOW='2026-11-14T09:50:00+09:00';
function fixture(){
 const horses=Array.from({length:7},(_,i)=>({horse_no:i+1,horse_name:'検証馬'+(i+1)}));
 const context={stage:'AWAITING_JRA_FULL_DEPTH_COMPARISON',
  race:{race_date:'2026-11-14',post_time:'2026-11-14T10:50:00+09:00'},
  runner_history:horses.map(h=>({...h,past_runs:[]}))};
 const ev=horses.map(h=>({...h,all_eval_correlated_past_runs:[]}));
 const evalInput={status:'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW',
  market_used:false,target_result_used:false,authorized_to_save:false,
  eval_normal_rows:1942,eval_remaining_normal_rows_not_loaded:0,runners:ev};
 const runners=horses.map((h,i)=>({...h,rank:i+1,
  score:[97,93,91,89,86,85,81][i],grade:i<3?'S':'A',
  reason:'公式確認済みの過去走による評価',mark:['◎','○','▲','☆','△'][i]??null,
  status:'ACTIVE'}));
 const payload={runners,top5:runners.slice(0,5),eye:null,bets:[],
  summary:'検証用',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',
  audit:{all_runners_checked:true,market_used_for_ranking:false,
   eye_pool_checked:[6,7],rank6_auto_selected:false}};
 return {context,evalInput,payload};
}
function evidence(no,type){
 const ref=i=>'JRA_CLAIMED_CONTEXT.runner_history[horse_no='+no+'].past_runs['+i+']';
 const podium={verified_run_ref:ref(0),prior_finish:2,
  prior_date:'2026-10-20',prior_track:'中山',prior_distance:1800,
  eval_rank_among_all_conditions:8,eval_tier:'A',
  bounded_eval_point_budget_eligible:true,
  independently_corrobated_direction:true,
  independent_JRA_training_reliability:'HIGH',independent_JRA_training_n:342};
 const close={verified_run_ref:ref(1),prior_finish:4,
  verified_close_loss_review:true,official_archive_detail_verified:true,
  official_corner_positions:'9 8 5 3',
  official_race_halon_laps:'12.5 - 11.9 - 12.0',
  official_final3f_rank:2,prior_winner_margin_seconds:0.3,
  prior_date:'2026-10-01',prior_track:'中京'};
 return type==='both'?[podium,close]:type==='podium'?[podium]:type==='close'?[close]:[];
}
test('actual score is changed, rank 6 crosses TOP5 with independently verified two different runs',()=>{
 const {context,evalInput,payload}=fixture();
 const before=structuredClone(payload);
 evalInput.runners[5].all_eval_correlated_past_runs=evidence(6,'both');
 const r=rankBridge({context,evalInput,payload,observedAt:NOW});
 assert.equal(r.status,'EYE_REAUDIT_REQUIRED');
 assert.equal(r.runner_score_changes,1);
 assert.equal(r.score_and_rank_diff.find(x=>x.horse_no===6).score_before,85);
 assert.equal(r.score_and_rank_diff.find(x=>x.horse_no===6).score_after,87);
 assert.equal(r.proposed_payload.runners.find(x=>x.horse_no===6).rank,5);
 assert.deepEqual(r.before_top5,[1,2,3,4,5]);
 assert.deepEqual(r.after_top5,[1,2,3,4,6]);
 assert.equal(r.proposed_payload.top5[4].mark,'△');
 assert.equal(r.proposed_payload.eye,null);
 assert.equal(r.proposed_payload.audit.evidence_rank_bridge.per_runner.length,7);
 assert.deepEqual(payload,before);
});
test('one official podium plus Eval gives exactly one point, not duplicated by multiple runs',()=>{
 const {context,evalInput,payload}=fixture();
 evalInput.runners[5].all_eval_correlated_past_runs=[
  ...evidence(6,'podium'),...evidence(6,'podium')
 ];
 const r=rankBridge({context,evalInput,payload,observedAt:NOW});
 assert.equal(r.status,'READY_FOR_OFFICIAL_SAVE');
 assert.equal(r.score_and_rank_diff.find(x=>x.horse_no===6).applied_delta,1);
 assert.equal(r.proposed_payload.runners.find(x=>x.horse_no===6).score,86);
 assert.deepEqual(r.after_top5,[1,2,3,4,5]);
});
test('verified content without official corners or full lap string cannot trigger close loss bonus',()=>{
 const {context,evalInput,payload}=fixture();
 const noArchive={...evidence(6,'close')[0],official_race_halon_laps:null};
 evalInput.runners[5].all_eval_correlated_past_runs=[noArchive];
 const r=rankBridge({context,evalInput,payload,observedAt:NOW});
 assert.equal(r.status,'READY_FOR_OFFICIAL_SAVE');
 assert.equal(r.runner_score_changes,0);
});
test('applied score and rank need exact rebuild receipt, and EYE re-audit when top5 changes',()=>{
 const {context,evalInput,payload}=fixture();
 evalInput.runners[5].all_eval_correlated_past_runs=evidence(6,'both');
 const r=rankBridge({context,evalInput,payload,observedAt:NOW});
 assert.equal(verify({context,evalInput,payload:r.proposed_payload,observedAt:NOW}).reason,'EYE_REAUDIT_REQUIRED');
 r.proposed_payload.audit.eye_reaudited_after_rank_change=true;
 const verified=verify({context,evalInput,payload:r.proposed_payload,observedAt:NOW});
 assert.equal(verified.status,'VERIFIED',JSON.stringify(verified));
 r.proposed_payload.runners.find(x=>x.horse_no===6).score=98;
 assert.equal(verify({context,evalInput,payload:r.proposed_payload,observedAt:NOW}).status,'REJECTED');
});
test('no eligible official claimed context, stale time or missing full history cannot auto-write anything',()=>{
 const {context,evalInput,payload}=fixture();
 assert.equal(rankBridge({context,evalInput,payload,observedAt:'2026-11-14T10:51:00+09:00'}).status,'NOT_READY');
 evalInput.status='EVAL_TRANSFER_UNAVAILABLE';
 const r=rankBridge({context,evalInput,payload,observedAt:NOW});
 assert.equal(r.status,'NOT_READY');
 assert.equal(r.mutates_existing_frozen,false);
 assert.equal(r.official_saved,false);
});
test('horse identity mismatch is refused, no market or results in any output',()=>{
 const {context,evalInput,payload}=fixture();
 payload.runners[4].horse_name='偽名';
 const r=rankBridge({context,evalInput,payload,observedAt:NOW});
 assert.equal(r.status,'REJECTED');
 assert.equal(r.market_used,false);
 assert.equal(r.target_result_used,false);
});