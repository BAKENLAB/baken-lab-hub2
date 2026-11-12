import test from 'node:test';
import assert from 'node:assert/strict';
import {auditJraFrozenAsOfHistory} from '../automation/jra-frozen-asof-source-guard.mjs';
const SOURCE='/JRADB/accessS.html?CNAME=pw01sde1005202604060920261017/13';
const ref=n=>'/JRADB/accessU.html?CNAME=pw01dud002024105492/'+String(n).padStart(2,'0');
const sample=()=>{
 const officialRunners=Array.from({length:6},(_,i)=>({
  horse_no:i+1,horse_name:'検証'+(i+1),horse_ref:ref(i+1),status:'ACTIVE'
 }));
 const liveRunners=officialRunners.map(r=>({
  horse_no:r.horse_no,horse_name:r.horse_name,horse_ref:r.horse_ref,
  source_checked_at:'2026-11-08T13:00:00+09:00',
  past_runs:[{race_date:'2026-10-17',track:'東京',surface:'芝',distance:1800,
   field_size:12,horse_no:4,finish:3,early_pos:6,final_turn_pos:3,
   corner_positions:[6,3,3],final3f:33.8,source_ref:SOURCE,
   popularity:12,win_odds:120.5,raw:'do not echo'}]
 }));
 const race={circuit:'JRA',race_date:'2026-11-08',track:'東京',race_no:9,
  frozen_at:'2026-11-08T14:00:00+09:00',
  post_time:'2026-11-08T14:20:00+09:00',
  official_proof:{verified:true,html_sha256:'a'.repeat(64)}};
 return {race,officialRunners,liveRunners};
};
test('full field before frozen stays read-only and never certified',()=>{
 const x=sample(),original=structuredClone(x),res=auditJraFrozenAsOfHistory(x);
 assert.equal(res.status,'WHOLE_FIELD_LAST_CHECK_PRE_FROZEN_NOT_CERTIFIED');
 assert.equal(res.certified,false);assert.equal(res.eligible_for_official_metrics,false);
 assert.equal(res.market_used,false);assert.equal(res.rank_effect,false);
 assert.equal(res.frozen_modified,false);
 assert.equal(res.roster_count,6);
 assert.equal(res.prior_corner_runs_with_recorded_url,6);
 assert.equal(res.prior_last3f_runs_with_recorded_url,6);
 assert.equal(res.runner_history[0].prior_runs[0].final_turn_pos,3);
 assert.equal(res.runner_history[0].prior_runs[0].true_loss_cause,'UNPROVEN');
 assert.equal(JSON.stringify(res).includes('popularity'),false);
 assert.equal(JSON.stringify(res).includes('win_odds'),false);
 assert.equal(JSON.stringify(res).includes('do not echo'),false);
 assert.deepEqual(x,original);
});
test('one late-checked runner invalidates the whole pre-frozen sample',()=>{
 const x=sample();x.liveRunners[5].source_checked_at='2026-11-08T14:01:00+09:00';
 const r=auditJraFrozenAsOfHistory(x);
 assert.equal(r.status,'LIVE_RUNNER_NOT_LAST_CHECKED_BEFORE_FROZEN');
 assert.equal(r.rejected_horse_no,6);
 assert.equal(r.runner_history,undefined);
});
test('one swapped horse or altered official URL cannot pass exact identity',()=>{
 const x=sample();x.liveRunners[0].horse_ref=ref(9);
 assert.equal(auditJraFrozenAsOfHistory(x).status,'LIVE_HORSE_IDENTITY_OR_HISTORY_MISMATCH');
 const y=sample();y.officialRunners[1].horse_name='他馬';
 assert.equal(auditJraFrozenAsOfHistory(y).status,'LIVE_HORSE_IDENTITY_OR_HISTORY_MISMATCH');
});
test('no verified official card hash and post-frozen seals are both rejected',()=>{
 const x=sample();x.race.official_proof.verified=false;
 assert.equal(auditJraFrozenAsOfHistory(x).status,'OFFICIAL_RACE_OR_FROZEN_GATE_UNVERIFIED');
 const y=sample();y.race.frozen_at=y.race.post_time;
 assert.equal(auditJraFrozenAsOfHistory(y).status,'OFFICIAL_RACE_OR_FROZEN_GATE_UNVERIFIED');
});
test('unlinked past race and bad corners cannot masquerade as verified facts',()=>{
 const x=sample();x.liveRunners[0].past_runs[0].source_ref=null;
 x.liveRunners[1].past_runs[0].corner_positions=[6,99,3];
 x.liveRunners[2].past_runs[0].race_date=x.race.race_date;
 const r=auditJraFrozenAsOfHistory(x);
 assert.equal(r.status,'WHOLE_FIELD_LAST_CHECK_PRE_FROZEN_NOT_CERTIFIED');
 assert.equal(r.runner_history[0].prior_runs[0].historic_result_ref,null);
 assert.deepEqual(r.runner_history[0].prior_runs[0].corner_positions,[]);
 assert.equal(r.runner_history[1].prior_runs[0].final_turn_pos,null);
 assert.equal(r.runner_history[2].prior_runs.length,0);
 assert.equal(r.prior_corner_runs_with_recorded_url,3);
 assert.equal(r.prior_last3f_runs_with_recorded_url,4);
});
