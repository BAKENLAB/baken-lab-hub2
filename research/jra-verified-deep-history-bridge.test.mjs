import test from 'node:test';
import assert from 'node:assert/strict';
import {rescueJraDeepHistory} from '../automation/jra-verified-deep-history-bridge.mjs';
import {auditPreRaceLossEvidence} from '../automation/prerace-why-lost-audit.mjs';
const clock=()=>Date.parse('2026-11-08T10:03:00+09:00');
const checked='2026-11-08T09:45:00+09:00';
const cname='pw01dde0103202603020320261108/87';
const ref=n=>'/JRADB/accessU.html?CNAME=pw01dud002024101234/'+n;
const official=(n)=>'/JRADB/accessS.html?CNAME=pw01sde1001202601050920260808/'+n;
const runners=[
 {horse_no:1,horse_name:'架空ギンケイ',status:'ACTIVE',horse_ref:ref('3D')},
 {horse_no:2,horse_name:'架空ルージュ',status:'ACTIVE',horse_ref:ref('4C')}
];
const liveRace={id:'6d202e46-35fa-49d0-ab83-5f04d0ed1111',
 race_date:'2026-11-08',track:'福島',race_no:3,cname};
const current=()=>({
 stage:'AWAITING_JRA_FULL_DEPTH_COMPARISON',
 race:{race_date:'2026-11-08',track:'福島',race_no:3,
  post_time:'2026-11-08T10:45:00+09:00',
  field_payload:{
   race:{surface:'ダート',distance:1700,class_name:'1勝クラス',cname},
   source_checked_at:checked,
   official_status_verification:{verified:true,html_sha256:'f'.repeat(64)},
   runners:structuredClone(runners)
  }
 },
 runner_history:[
  {horse_no:1,horse_name:'架空ギンケイ',past_runs:[
   {race_date:'2026-08-08',track:'札幌',surface:'ダート',
    distance:1700,finish:2,margin_to_winner:0.1,early_pos:8},
   {race_date:'2026-07-04',track:'函館',surface:'ダート',
    distance:1700,finish:1,margin_to_winner:0.8,early_pos:11}
  ]},
  {horse_no:2,horse_name:'架空ルージュ',past_runs:[
   {race_date:'2026-08-30',track:'札幌',surface:'ダート',
    distance:1700,finish:2,margin_to_winner:0.3,early_pos:1}
  ]}
 ]
});
const live=()=>[
 {live_race_id:liveRace.id,...runners[0],source_checked_at:checked,
  past_runs:[
   {race_date:'2026-08-08',track:'札幌',surface:'ダート',distance:1700,finish:2,
    early_pos:8,final_turn_pos:3,corner_positions:[8,10,7,3],final3f:39.3,
    margin_to_winner:0.1,source_ref:official('08'),popularity:8,win_odds:34.1,raw:'data'},
   {race_date:'2026-07-04',track:'函館',surface:'ダート',distance:1700,finish:1,
    early_pos:11,final_turn_pos:5,corner_positions:[11,10,7,5],final3f:37.8,
    margin_to_winner:0.8,source_ref:official('0E'),popularity:4}
  ]},
 {live_race_id:liveRace.id,...runners[1],source_checked_at:checked,
  past_runs:[
   {race_date:'2026-08-30',track:'札幌',surface:'ダート',distance:1700,finish:2,
    early_pos:1,final_turn_pos:1,corner_positions:[1,1,1,1],final3f:38.2,
    margin_to_winner:0.3,source_ref:official('DD'),popularity:1}
  ]}
];
const run=(overrides={})=>rescueJraDeepHistory({
 claimedContext:current(),liveRace,liveRunners:live(),clock,...overrides
});
test('claim-to-JRA snapshot identity bridge reveals four corners and 3F without market data',()=>{
 const x=run();
 assert.equal(x.status,'SNAPSHOT_MATCHED');
 assert.equal(x.verified_runner_count,2);
 assert.equal(x.matched_prior_runs,3);
 assert.equal(x.corner_runs,3);
 assert.equal(x.last3f_runs,3);
 assert.equal(x.market_used,false);
 assert.equal(x.rank_effect,'NONE');
 assert.equal(x.save_gate_effect,'NONE');
 assert.equal(x.runner_history[0].past_runs[0].final_turn_pos,3);
 assert.deepEqual(x.runner_history[0].past_runs[0].corner_positions,[8,10,7,3]);
 assert.equal(x.runner_history[0].past_runs[0].final3f,39.3);
 assert.equal(JSON.stringify(x).includes('popularity'),false);
 assert.equal(JSON.stringify(x).includes('win_odds'),false);
 assert.equal(JSON.stringify(x).includes('raw":"data'),false);
});
test('winner margin reported as a positive lead is not a 0.8-second defeat',()=>{
 const x=run().runner_history[0].past_runs[1];
 assert.equal(x.finish,1);
 assert.equal(x.margin_to_winner,0);
 assert.equal(x.margin_source_value,0.8);
 assert.equal(x.margin_basis,'WINNER_LEAD_NOT_LOSS');
});
test('downstream research cause remains unproven even after corner rescue',()=>{
 const x=run();
 const audit=auditPreRaceLossEvidence({
  targetRace:{raceDate:'2026-11-08',track:'福島',raceNo:3,
   postTime:'2026-11-08T10:45:00+09:00',
   surface:'ダート',distance:1700,className:'1勝クラス'},
  runners:x.runner_history,
  source:{kind:'JRA_CLAIMED_CONTEXT',verified:true,checkedAt:checked},clock
 });
 assert.equal(audit.verified_runner_count,2);
 assert.equal(audit.runners[0].observed_corners_count,2);
 assert.equal(audit.runners[0].records[0].clues[1].code,'ADVANCED_BEFORE_FINAL_TURN');
 assert.equal(audit.runners[0].records[0].true_loss_cause,'UNPROVEN');
});
test('swapped horse references, stale claim or after-start evidence fails closed',()=>{
 const a=live();a[0].horse_ref=ref('OTHER');
 assert.equal(run({liveRunners:a}).status,'LIVE_RUNNER_IDENTITY_MISMATCH');
 const b=current();b.race.field_payload.official_status_verification.verified=false;
 assert.equal(run({claimedContext:b}).status,'CURRENT_RACE_NOT_VERIFIED');
 assert.equal(run({clock:()=>Date.parse('2026-11-08T10:45:00+09:00')}).status,'CURRENT_RACE_NOT_VERIFIED');
});
test('unverifiable historic result URL never produces official corner evidence',()=>{
 const a=live();a[0].past_runs[0].source_ref='https://unverified.example/claim';
 const x=run({liveRunners:a});
 assert.equal(x.status,'PARTIAL_SNAPSHOT_MATCH');
 assert.equal(x.runner_history[0].past_runs[0].final_turn_pos,null);
 assert.equal(x.unmatched_prior_runs,1);
});
test('ambiguous matching past histories are quarantined',()=>{
 const a=live();a[0].past_runs.push({...a[0].past_runs[0]});
 const x=run({liveRunners:a});
 assert.equal(x.unmatched_prior_runs,1);
 assert.equal(x.runner_history[0].past_runs[0].deep_status,'HISTORY_MATCH_NOT_UNIQUE');
});
test('impossible 4-corner values never enter the loss comparison',()=>{
 const a=live();a[0].past_runs[0].corner_positions=[8,10,77,3];
 const x=run({liveRunners:a});
 assert.equal(x.runner_history[0].past_runs[0].final_turn_pos,null);
 assert.equal(x.runner_history[0].past_runs[0].final3f,39.3);
});
