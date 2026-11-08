import test from 'node:test';
import assert from 'node:assert/strict';
import {joinVerifiedJraCornerAndRaceLaps} from '../automation/jra-corner-lap-evidence-join.mjs';
const url='/JRADB/accessS.html?CNAME=pw01sde1008202604040620261011/7E';
const targetRace={raceDate:'2026-11-08',postTime:'2026-11-08T12:50:00+09:00'};
const pastRun={race_date:'2026-10-11',track:'京都',surface:'ダート',
 distance:1800,finish:3,early_pos:2,final_turn_pos:3,final3f:38.1,
 historical_source_ref:url,deep_status:'EXACT_CLAIM_LIVE_HISTORY_MATCH'};
const officialRaceLaps={status:'OFFICIAL_RACE_LAPS_VERIFIED',verified:true,
 race_date:'2026-10-11',track:'京都',race_no:6,surface:'ダート',distance:1800,
 source_ref:'https://www.jra.go.jp'+url,
 source_checked_at:'2026-11-08T11:20:00+09:00',
 lap_seconds:[12,12,12.4,12.3,12.2,12.1,12.6,12.5,13.1],
 first_600m_seconds:36.4,last_600m_seconds:38.2};
const clock=()=>Date.parse('2026-11-08T11:30:00+09:00');
const run=(o={})=>joinVerifiedJraCornerAndRaceLaps({
 targetRace,pastRun,officialRaceLaps,clock,...o
});
test('exact official JRA past result joins corners + race laps without claiming loss causality',()=>{
 const x=run();
 assert.equal(x.status,'EVIDENCE_ONLY_MATCHED');
 assert.deepEqual(x.observation.position_change,
  {from_early:2,to_final_turn:3,positions_gained:-1});
 assert.equal(x.observation.race_first_600m,36.4);
 assert.equal(x.observation.race_last_600m,38.2);
 assert.equal(x.observation.runner_last_3f,38.1);
 assert.equal(x.observation.race_no,6);
 assert.equal(x.observation.true_loss_cause,'UNPROVEN');
 assert.equal(x.observation.race_pace_class,'UNDETERMINED_WITHOUT_PEER_REFERENCE');
 assert.equal(x.rank_effect,false);
 assert.equal(x.market_used,false);
 assert.equal(x.save_gate_effect,false);
});
test('wrong race source and surface cannot transfer official pace to another runner',()=>{
 const other={...pastRun,historical_source_ref:url.replace('/7E','/00')};
 assert.equal(run({pastRun:other}).status,'OFFICIAL_PAST_RACE_IDENTITY_MISMATCH');
 assert.equal(run({officialRaceLaps:{...officialRaceLaps,surface:'芝'}}).status,
  'OFFICIAL_PAST_RACE_IDENTITY_MISMATCH');
});
test('post-race or after-date results cannot join pre-race frozen audit',()=>{
 assert.equal(run({clock:()=>Date.parse(targetRace.postTime)}).status,
  'AFTER_POST_OR_UNVERIFIED_TIME');
 assert.equal(run({pastRun:{...pastRun,race_date:targetRace.raceDate}}).status,
  'AFTER_POST_OR_UNVERIFIED_TIME');
});
