import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJraRecordedCornerResearchOverlay} from '../automation/jra-verified-corner-relative-shadow.mjs';
import {buildRelativeAbilityRankProposal} from '../automation/relative-ability-rank-proposal.mjs';

const ref='https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw01sde1005202604060920261017/13';
const now='2026-11-13T09:00:00+09:00';
const sample=()=>{
 const rows=Array.from({length:6},(_,i)=>({
  horse_no:i+1,horse_name:'検証馬'+(i+1),supporting_runs:[
   {date:'2026-10-17',surface:'芝',distance:1800,class:'1勝クラス',
    finish:3,margin:0.1,early_pos:6}
  ]
 }));
 return {
  claimedContext:{
   race:{race_date:'2026-11-13',track:'福島',race_no:8,post_time:'2026-11-13T14:20:00+09:00'},
   relative_condition_evidence:{
    status:'READY',source_scope:'JRA_CLAIMED_RUNNER_HISTORY',
    target_date:'2026-11-13',market_used:false,target_result_used:false,
    rank_effect:false,runner_evidence:rows
   }
  },
  deepHistory:{
   status:'SNAPSHOT_MATCHED',source_scope:'RECORDED_JRA_LIVE_PRIOR_SNAPSHOT_NOT_NEW_OFFICIAL_FETCH',
   race_date:'2026-11-13',track:'福島',race_no:8,verified_runner_count:6,
   rank_effect:'NONE',market_used:false,target_race_result_used:false,
   runner_history:rows.map((r,i)=>({
    horse_no:r.horse_no,horse_name:r.horse_name,
    past_runs:[{
     race_date:'2026-10-17',track:'東京',surface:'芝',distance:1800,
     finish:3,early_pos:6,final_turn_pos:3,
     corner_positions:[6,3,3],final3f:33.8,
     historical_source_ref:ref,
     deep_status:'EXACT_CLAIM_LIVE_HISTORY_MATCH',
     official_source_scope:'HISTORIC_JRA_RESULT_URL_RECORDED_NOT_REFETCHED',
     popularity:i+1,win_odds:2.5,raw:'NOT_ALLOWED'
    }]
   }))
  },
  observedAt:now
 };
};
test('6-runner same-field join adds historical corners and 3F but not score permission',()=>{
 const x=sample(),original=structuredClone(x);
 const r=buildJraRecordedCornerResearchOverlay(x);
 assert.equal(r.status,'DESCRIPTIVE_SHADOW_ONLY');
 assert.equal(r.joined_history_runs,6);
 assert.equal(r.prior_runs_with_corners,6);
 assert.equal(r.prior_runs_with_final3f,6);
 assert.equal(r.runner_evidence[0].supporting_runs[0].final_turn_pos,3);
 assert.equal(r.runner_evidence[0].supporting_runs[0].final3f,33.8);
 assert.equal(r.runner_evidence[0].supporting_runs[0].track,'東京');
 assert.equal(r.runner_evidence[0].supporting_runs[0].independent_official_result_refetch,false);
 assert.equal(r.scoring_permission,false);
 assert.equal(r.rank_effect,false);
 assert.equal(r.market_used,false);
 assert.equal(r.frozen_modified,false);
 assert.equal(JSON.stringify(r).includes('popularity'),false);
 assert.equal(JSON.stringify(r).includes('NOT_ALLOWED'),false);
 assert.deepEqual(x,original);
});
test('the actual rank engine refuses this unrefetched evidence as READY',()=>{
 const x=sample(),r=buildJraRecordedCornerResearchOverlay(x);
 const baseline=Array.from({length:6},(_,i)=>({
  horse_no:i+1,horse_name:'検証馬'+(i+1),rank:i+1
 }));
 const preview=buildRelativeAbilityRankProposal({
  race:{race_date:'2026-11-13',track:'福島',race_no:8,
   post_time:x.claimedContext.race.post_time,observation_at:now,
   circuit:'JRA',class_name:'1勝クラス',surface:'芝',distance:1800},
  baseline,comparison:r
 });
 assert.equal(preview.status,'BASELINE_OR_EVIDENCE_NOT_READY');
 assert.equal(preview.candidate_order,null);
});
test('after post or future target history is forbidden',()=>{
 const x=sample();x.observedAt='2026-11-13T14:21:00+09:00';
 assert.equal(buildJraRecordedCornerResearchOverlay(x).status,'UNVERIFIED_JRA_CLAIM_COMPARISON');
 const y=sample();y.claimedContext.relative_condition_evidence.runner_evidence[0].supporting_runs[0].date='2026-11-13';
 assert.equal(buildJraRecordedCornerResearchOverlay(y).status,'FUTURE_OR_UNVERIFIED_JRA_HISTORY');
});
test('partial or swapped horse identifiers reject entire field',()=>{
 const x=sample();x.deepHistory.runner_history.pop();
 assert.equal(buildJraRecordedCornerResearchOverlay(x).status,'UNVERIFIED_DEEP_RECORDED_SNAPSHOT');
 const y=sample();y.deepHistory.runner_history[0].horse_name='別馬';
 assert.equal(buildJraRecordedCornerResearchOverlay(y).status,'JRA_FULL_FIELD_IDENTITY_MISMATCH');
});
test('missing official source URL or forged URL cannot contribute corners',()=>{
 for(const invalid of [null,'https://fake-jra.example/JRADB/accessS.html?CNAME=pw01sde1005202604060920261017/13']){
  const x=sample();x.deepHistory.runner_history[0].past_runs[0].historical_source_ref=invalid;
  const r=buildJraRecordedCornerResearchOverlay(x);
  assert.equal(r.status,'DESCRIPTIVE_SHADOW_ONLY');
  assert.equal(r.joined_history_runs,5);
  assert.deepEqual(r.runner_evidence[0].supporting_runs[0].corner_positions,[]);
  assert.equal(r.runner_evidence[0].supporting_runs[0].final3f,null);
 }
});
test('contradictory or duplicated historical running orders never create proof',()=>{
 const x=sample();x.deepHistory.runner_history[0].past_runs[0].corner_positions=[6,22,3];
 x.deepHistory.runner_history[0].past_runs[0].final_turn_pos=2;
 const a=buildJraRecordedCornerResearchOverlay(x);
 assert.deepEqual(a.runner_evidence[0].supporting_runs[0].corner_positions,[]);
 const y=sample();y.deepHistory.runner_history[0].past_runs.push(structuredClone(
  y.deepHistory.runner_history[0].past_runs[0]));
 const b=buildJraRecordedCornerResearchOverlay(y);
 assert.equal(b.ambiguous_history_matches,1);
 assert.deepEqual(b.runner_evidence[0].supporting_runs[0].corner_positions,[]);
});
