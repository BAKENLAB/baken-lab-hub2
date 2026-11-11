import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRaceEvidence, parseHalonTimes } from './pace-evidence.mjs';

const ASOF = '2026-11-07T04:00:00Z';
const race = { raceDate: '2026-11-07', track: '福島', raceNo: 10, surface: '芝', distance: 1200 };
const run = (date, early, finish, extras={}) => ({ raceDate:date, track:'福島', distance:1200,
  surface:'芝', earlyPos:early, finalTurnPos:early, finish, final3f:34.3,
  sourceCheckedAt:'2026-11-01T00:00:00Z', ...extras });

test('1200m 200m split parsing is exact', () => {
  const l=parseHalonTimes('11.9 - 10.6 - 10.9 - 11.1 - 11.2 - 12.0',1200);
  assert.equal(l.status,'OK'); assert.equal(l.first600,33.4);assert.equal(l.last600,34.3);
  assert.deepEqual(l.halves,{first:33.4,last:34.3});assert.equal(l.slowDown600,0.9);
});
test('1700m has 100m first split; never invent 600m intermediate segment time', () => {
 const l=parseHalonTimes('6.9 - 10.6 - 11.2 - 12.3 - 12.7 - 13.5 - 13.6 - 13.7 - 13.0',1700);
 assert.equal(l.status,'OK');assert.equal(l.segmentMeters[0],100);
 assert.equal(l.first600,null);assert.equal(l.last600,40.3);assert.equal(l.slowDown600,null);
});
test('wrong split length or missing split is not a fabricated pace', () => {
 assert.equal(parseHalonTimes('12.0-11.3',1200).status,'LENGTH_MISMATCH');
 assert.equal(parseHalonTimes('',1200).status,'MISSING');
});
test('historical same-condition wins beyond last four are preserved as evidence', () => {
 const r=buildRaceEvidence({race,asOf:ASOF,runners:[{horseNo:8,horseName:'カレンデュラ',pastRuns:[
  run('2026-10-18',null,4,{track:'新潟',distance:1000}),
  run('2026-09-12',1,7,{track:'新潟',distance:1000}),
  run('2026-08-30',1,9,{track:'新潟',distance:1000}),
  run('2026-08-09',1,3,{track:'新潟',distance:1000}),
  run('2026-04-26',1,1),run('2025-11-15',1,3)
 ]}]});
 assert.equal(r.runners[0].olderSameTrackDistanceTop3,2);
 assert.equal(r.runners[0].sameTrackDistanceTop3,2);
 assert.equal(r.runners[0].frontStyle,true);
});
test('future races and snapshots after FROZEN are excluded, not retrospectively leaked', () => {
 const r=buildRaceEvidence({race,asOf:ASOF,runners:[{horseNo:8,horseName:'A',pastRuns:[
  run('2026-11-08',1,1),run('2026-11-06',1,1,{sourceCheckedAt:'2026-11-08T00:00:00Z'}),
  run('2026-11-03',3,4)]}]});
 assert.equal(r.runners[0].pastRuns,1);
 assert.equal(r.runners[0].excluded.laterRace,1);
 assert.equal(r.runners[0].excluded.sourceAfterFreeze,1);
});
test('unverified source timestamps remain explicitly flagged', () => {
 const r=buildRaceEvidence({race,asOf:ASOF,runners:[{horseNo:8,horseName:'A',pastRuns:[run('2026-10-30',2,1,{sourceCheckedAt:null})]}]});
 assert.equal(r.runners[0].evidenceQuality,'PARTLY_UNVERIFIED_SOURCE_TIME');
 assert.equal(r.runners[0].excluded.missingSourceTimestamp,1);
});
test('opponent-relative front runners are counted across whole field, not only TOP5', () => {
 const r=buildRaceEvidence({race,asOf:ASOF,runners:[
  {horseNo:1,horseName:'A',pastRuns:[run('2026-10-01',1,4),run('2026-09-01',2,6)]},
  {horseNo:2,horseName:'B',pastRuns:[run('2026-10-01',1,2),run('2026-09-01',3,5)]},
  {horseNo:3,horseName:'C',pastRuns:[run('2026-10-01',8,1),run('2026-09-01',9,1)]}
 ]});
 assert.equal(r.frontStyleCount,2);assert.equal(r.fieldWithComparable,3);
 assert.equal(r.runners[2].frontStyle,false);
 assert.equal('score' in r.runners[0],false);
});
test('historic lap lookup must be timestamp verified and match race facts',()=>{
 const one=run('2026-04-26',1,1,{runKey:'2026-04-26/Fukushima/4'});
 const laps={ [one.runKey]: {raceDate:one.raceDate,track:one.track,surface:one.surface,
   distance:1200,halonTimes:'12.5 - 11.1 - 11.3 - 11.1 - 11.3 - 11.9',sourceCheckedAt:'2026-11-01T00:00:00Z'}};
 const r=buildRaceEvidence({race,asOf:ASOF,runners:[{horseNo:8,horseName:'A',pastRuns:[one]}],archivedLaps:laps});
 assert.equal(r.runners[0].lapAvailable,1);
 const bad=buildRaceEvidence({race,asOf:ASOF,runners:[{horseNo:8,horseName:'A',pastRuns:[one]}],archivedLaps:{[one.runKey]:{...laps[one.runKey],sourceCheckedAt:'2026-11-09T00:00:00Z'}}});
 assert.equal(bad.runners[0].lapAvailable,0);
});
test('duplicate horse numbers are rejected',()=>{
 assert.throws(()=>buildRaceEvidence({race,asOf:ASOF,runners:[{horseNo:2,pastRuns:[]},{horseNo:2,pastRuns:[]}]}),/duplicate/);
});
