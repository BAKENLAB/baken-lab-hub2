import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEvalTransferForJraClaim as candidate} from '../research/jra-scoring-integrity-20261121/integration-validation/eval-course-transfer-candidate.mjs';
import {buildJraVerifiedEvidenceRankBridge as bridge} from '../automation/jra-verified-evidence-rank-bridge.mjs';
const original=(await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../research/jra-scoring-integrity-20261121/baseline/mcp/eval-course-transfer-live.mjs.txt',import.meta.url))).toString('base64'))).buildEvalTransferForJraClaim;
// Entirely fabricated fixtures, NOT the private licensed cache or official proof.
function fixture(){
 const rows=[['東京','芝','',1800]];
 for(const track of ['札幌','函館','福島','新潟','中山','中京','京都','阪神','小倉'])
  for(let d=1000;d<=3600;d+=100)rows.push([track,'芝','',d]);
 const snapshot={v:'2026-11-13',observed_at:'2026-11-13T21:30:21Z',scope:'NORMAL_ALL_1942',targets:rows.slice(0,82),sources:rows.slice(0,94),pairs:[]};
 for(let t=0;t<82;t++)for(let s=0;s<(t<56?24:23);s++)snapshot.pairs.push([t,s,5,s+1]);
 const runners=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:'架空検証馬'+(i+1),rank:i+1,score:90-i*5,grade:'B',reason:'合成データに基づくテスト専用評価',status:'ACTIVE'}));
 const context={stage:'AWAITING_JRA_FULL_DEPTH_COMPARISON',race:{race_date:'2026-11-22',track:'東京',race_no:1,post_time:'2026-11-22T02:00:00Z',field_payload:{race:{race_type:'平地',surface:'芝',distance:1800}}},runner_history:runners.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,past_runs:[{race_date:'2026-11-01',track:'東京',surface:'芝',distance:1800,finish:2,margin_to_winner:0.3}]}))};
 const ownedTransferStats=[{source_course_key:'東京|芝|1800|左',target_course_key:'東京|芝|1800|左',reliability:'HIGH',runners:200,top3_lift:1.2,condition_precision:'COARSE_NO_INNER_OUTER',training_to:'2025-12-31'}];
 const payload={runners,top5:runners.slice(0,5),eye:null,bets:[],summary:'合成テスト',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{all_runners_checked:true,market_used_for_ranking:false,eye_pool_checked:[6],rank6_auto_selected:false}};
 return {context,snapshot,ownedTransferStats,payload,observedAt:'2026-11-22T00:00:00Z'};
}
const run=(fn,x)=>bridge({context:x.context,payload:x.payload,evalInput:fn(x),observedAt:x.observedAt});
test('actual baseline producer recommends +1 but actual consumer applies zero: mismatch reproduced',()=>{
 const x=fixture(),e=original(x);assert.equal(e.status,'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW');
 assert.equal(e.runners[0].optional_course_fit_budget_points,1);
 assert.equal(run(original,x).runner_score_changes,0);
});
test('candidate aliases connect exact existing +1 budget; input, rank, TOP5 and null EYE unchanged',()=>{
 const x=fixture(),before=structuredClone(x),r=run(candidate,x);
 assert.equal(r.status,'READY_FOR_OFFICIAL_SAVE');assert.equal(r.runner_score_changes,6);
 assert.ok(r.score_and_rank_diff.every(h=>h.applied_delta===1));
 assert.deepEqual(r.before_top5,r.after_top5);assert.equal(r.proposed_payload.eye,null);assert.deepEqual(x,before);
 const e=candidate(x),b=original(x);
 for(const [i,h] of e.runners.entries())for(const [j,run] of h.all_eval_correlated_past_runs.entries()){
  for(const [key,value] of Object.entries(b.runners[i].all_eval_correlated_past_runs[j]))assert.deepEqual(run[key],value);
 }
});
test('unreliable/too-small cohort, non-podium or expired context cannot acquire +1',()=>{
 for(const mutate of [x=>x.ownedTransferStats[0].runners=119,x=>x.ownedTransferStats[0].reliability='LOW',x=>x.context.runner_history.forEach(h=>h.past_runs[0].finish=4)]){
  const x=fixture();mutate(x);assert.equal(run(candidate,x).runner_score_changes,0);
 }
 const x=fixture();x.observedAt=x.context.race.post_time;assert.equal(run(candidate,x).status,'NOT_READY');
});
test('same input repeats identically; duplicate history does not multiply budget',()=>{
 const x=fixture();x.context.runner_history.forEach(h=>h.past_runs.push(structuredClone(h.past_runs[0])));
 assert.deepEqual(run(candidate,x),run(candidate,x));assert.ok(run(candidate,x).score_and_rank_diff.every(h=>h.applied_delta===1));
});
