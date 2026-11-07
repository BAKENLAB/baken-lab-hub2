import test from 'node:test';
import assert from 'node:assert/strict';
import {planLocalPriorCornerFetches,fetchLocalPriorCornerEvidence} from '../automation/nar-corner-prefetch.mjs';

const race={raceDate:'2026-11-08',track:'佐賀',raceNo:7,postTime:'2026-11-08T15:30:00+09:00'};
const now=()=>Date.parse('2026-11-08T07:00:00+09:00');
const priorRace={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
const past=(pastHorseNo)=>({
 raceDate:'2026-11-07',track:'佐賀',raceNo:5,pastHorseNo,
 horseRef:'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=012345',
 identityVerifiedBy:'OFFICIAL_HORSE_REF',source:'NAR_OFFICIAL_RESCUE',
 earlyPos:null,finalTurnPos:null
});
const runners=[
 {horseNo:1,horseName:'A',verifiedRecentRuns:[past(6)]},
 {horseNo:2,horseName:'B',verifiedRecentRuns:[past(11)]}
];
const officialPacket={
 sourceUrl:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5',
 raceHeaderText:'2026年11月7日（土） 佐 賀 第5競走 競走成績',
 sourceCheckedAt:'2026-11-08T07:01:00+09:00',
 knownHorseNos:Array.from({length:11},(_,i)=>i+1),
 cornerRows:[['１角','6 , 7 , ( 4 , 9 ) , ( 8 , 11 ) , 5 - 1 , ( 3 , 10 )- 2'],
 ['４角','11 , 9 - 8 , 7 - 3 , 10 , 4 , 1 , 5 , ( 6 , 2 )']]
};
test('pre-claim deduplicates same historic race across official runners',()=>{
 const x=planLocalPriorCornerFetches({targetRace:race,runners});
 assert.equal(x.length,1);assert.equal(x[0].links.length,2);
});
test('never read historical pages for name-only ambiguous identity',()=>{
 const copy=structuredClone(runners);
 copy[0].verifiedRecentRuns[0].identityVerifiedBy=null;
 copy[1].verifiedRecentRuns[0].source='NAME_ONLY_DB';
 assert.equal(planLocalPriorCornerFetches({targetRace:race,runners:copy}).length,0);
});
test('official prior race corner facts linked by past horse number for two distinct current horses',async()=>{
 let queries=0;
 const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners,clock:now,
 fetchVerifiedRace:async()=>{queries++;return officialPacket;}});
 assert.equal(queries,1);assert.equal(out.planned,1);
 assert.equal(out.linkedRunEvidence,2);
 assert.equal(out.evidence.find(x=>x.horseNo===1).earlyPos,1);
 assert.equal(out.evidence.find(x=>x.horseNo===1).finalTurnPos,10);
 assert.equal(out.evidence.find(x=>x.horseNo===2).finalTurnPos,1);
 assert.equal(out.saveAuthorized,false);assert.equal(out.rankChanged,false);
});
test('optional network outage is isolated, does not block normal prediction path',async()=>{
 const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners,clock:now,
 fetchVerifiedRace:async()=>{throw Error('HTTP 500');}});
 assert.equal(out.sourceReports[0].status,'OPTIONAL_SOURCE_UNAVAILABLE');
 assert.equal(out.linkedRunEvidence,0);assert.equal(out.claimStarted,false);
});
test('as-of validation rejects source observed after target post time',async()=>{
 const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners,clock:now,
 fetchVerifiedRace:async()=>({...officialPacket,sourceCheckedAt:'2026-11-08T16:00:00+09:00'})});
 assert.equal(out.linkedRunEvidence,0);
 assert.equal(out.sourceReports[0].status,'OPTIONAL_SOURCE_UNAVAILABLE');
});
test('pre-race budget skips optional fetch and never starts claim',async()=>{
 let calls=0;
 const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners,
 clock:()=>Date.parse(race.postTime)-60000,reserveMs:300000,
 fetchVerifiedRace:async()=>{calls++;return officialPacket;}});
 assert.equal(calls,0);
 assert.equal(out.sourceReports[0].status,'SKIPPED_PRE_RACE_BUDGET');
});
test('hung official source times out independently',async()=>{
 const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners,clock:now,timeoutMs:10,
 fetchVerifiedRace:async()=>new Promise(()=>{})});
 assert.equal(out.linkedRunEvidence,0);
 assert.equal(out.sourceReports[0].status,'OPTIONAL_SOURCE_UNAVAILABLE');
});
