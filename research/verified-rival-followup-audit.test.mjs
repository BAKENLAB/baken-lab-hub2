import test from 'node:test';
import assert from 'node:assert/strict';
import {auditVerifiedRivalFollowUps} from '../automation/verified-rival-followup-audit.mjs';
const targetRaceDate='2026-11-08';
const targetPostTime='2026-11-08T10:55:00+09:00';
const priorRace={raceDate:'2026-10-20',track:'東京',raceNo:4};
const entrants=[
 {horseNo:1,horseId:'JRA:2024:001',finish:4,isTargetHorse:true},
 {horseNo:2,horseId:'JRA:2024:002',finish:1},
 {horseNo:3,horseId:'JRA:2024:003',finish:2},
 {horseNo:4,horseId:'JRA:2024:004',finish:3},
 {horseNo:5,horseId:'JRA:2024:005',finish:5}
];
const verifiedSource={kind:'JRA_PAST_OFFICIAL',verified:true,checkedAt:'2026-11-08T09:10:00+09:00'};
const clock=()=>Date.parse('2026-11-08T09:20:00+09:00');
const followUps=[
 {horseId:'JRA:2024:002',raceDate:'2026-10-25',finish:1,officialSourceVerified:true,sourceKind:'JRA_PAST_OFFICIAL'},
 {horseId:'JRA:2024:003',raceDate:'2026-11-01',finish:3,officialSourceVerified:true,sourceKind:'JRA_PAST_OFFICIAL'},
 {horseId:'JRA:2024:004',raceDate:'2026-11-02',finish:7,officialSourceVerified:true,sourceKind:'JRA_PAST_OFFICIAL'},
 {horseId:'JRA:2024:005',raceDate:'2026-11-03',finish:10,officialSourceVerified:true,sourceKind:'JRA_PAST_OFFICIAL'}
];
const run=(overrides={})=>auditVerifiedRivalFollowUps({
 targetRaceDate,targetPostTime,priorRace,entrants,followUps,
 verifiedSource,clock,...overrides
});
test('independent official rival follow-up results cannot be treated as causal proof',()=>{
 const x=run();
 assert.equal(x.status,'OBSERVED_RIVAL_FOLLOWUPS');
 assert.equal(x.eligible_rivals,4);
 assert.equal(x.observed_rivals,4);
 assert.equal(x.observed_wins,1);
 assert.equal(x.observed_top3,2);
 assert.equal(x.coverage,1);
 assert.equal(x.class_strength,'NOT_ESTABLISHED_FROM_FOLLOWUPS_ALONE');
 assert.equal(x.race_loss_cause,'NOT_DETERMINABLE');
 assert.equal(x.rank_effect,'NONE');
 assert.equal(x.market_used,false);
});
test('target horse, future results, unverified results and mismatched official sources excluded',()=>{
 const x=run({followUps:[
  ...followUps,
  {horseId:'JRA:2024:002',raceDate:'2026-11-08',finish:1,officialSourceVerified:true,sourceKind:'JRA_PAST_OFFICIAL'},
  {horseId:'JRA:2024:001',raceDate:'2026-10-28',finish:1,officialSourceVerified:true,sourceKind:'JRA_PAST_OFFICIAL'},
  {horseId:'JRA:2024:005',raceDate:'2026-10-24',finish:1,officialSourceVerified:false,sourceKind:'JRA_PAST_OFFICIAL'},
  {horseId:'JRA:2024:004',raceDate:'2026-10-29',finish:1,officialSourceVerified:true,sourceKind:'NAR_PAST_OFFICIAL'}
 ]});
 assert.equal(x.observed_rivals,4);
 assert.equal(x.observed_wins,1);
 assert.equal(x.follow_up_examples.find(h=>h.horseId==='JRA:2024:004').raceDate,'2026-11-02');
});
test('race, horse identity and source time fail closed',()=>{
 assert.throws(()=>run({entrants:[entrants[0],entrants[0]]}),/IDENTITY/);
 assert.throws(()=>run({verifiedSource:{...verifiedSource,verified:false}}),/UNVERIFIED/);
 assert.throws(()=>run({clock:()=>Date.parse(targetPostTime)}),/UNVERIFIED/);
 assert.throws(()=>run({priorRace:{...priorRace,raceDate:targetRaceDate}}),/UNVERIFIED/);
});
test('independent rival sample too sparse remains unknown',()=>{
 const x=run({followUps:[followUps[0]]});
 assert.equal(x.status,'INSUFFICIENT_RIVAL_FOLLOWUPS');
 assert.equal(x.observed_rivals,1);
 assert.equal(x.class_strength,'NOT_ESTABLISHED_FROM_FOLLOWUPS_ALONE');
});
