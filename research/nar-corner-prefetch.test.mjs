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
 {horseNo:1,horseName:'ハヤブサブロー',verifiedRecentRuns:[past(6)]},
 {horseNo:2,horseName:'シエルブリエ',verifiedRecentRuns:[past(11)]}
];
const officialPacket={
 sourceUrl:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5',
 raceHeaderText:'2026年11月7日（土） 佐 賀 第5競走 競走成績',
 sourceCheckedAt:'2026-11-08T07:01:00+09:00',
 knownHorseNos:Array.from({length:11},(_,i)=>i+1),
 officialHorseNames:{
   '1':'タイショウロマン','2':'クラックアスマイル','3':'ポジターノ',
   '4':'アルクノワール','5':'ロードゴスペル','6':'ハヤブサブロー',
   '7':'ボンレジェンド','8':'コスモペンタス','9':'マハーギータ',
   '10':'ロードアルフィーネ','11':'シエルブリエ'
 },
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

test('official past race cannot attach another horse position to a correct current horse',async()=>{
 const swapped=structuredClone(runners);
 swapped[0].verifiedRecentRuns[0].pastHorseNo=11;
 const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners:swapped,clock:now,
 fetchVerifiedRace:async()=>officialPacket});
 assert.equal(out.linkedRunEvidence,1);
 assert.equal(out.evidence[0].horseName,'シエルブリエ');
 assert.equal(out.sourceReports[0].status,'VERIFIED_WITH_IDENTITY_REJECTIONS');
 assert.equal(out.sourceReports[0].identityRejected,1);
});
test('official result name map missing or partial: no horse evidence admitted',async()=>{
 for(const names of [undefined,{'6':'ハヤブサブロー'}]){
  const raw={...officialPacket,officialHorseNames:names};
  const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners,clock:now,
   fetchVerifiedRace:async()=>raw});
  assert.equal(out.linkedRunEvidence,0);
  assert.equal(out.sourceReports[0].status,'OPTIONAL_SOURCE_UNAVAILABLE');
  assert.equal(out.claimStarted,false);
 }
});
test('horse names allow only typographic width and spacing normalization',async()=>{
 const spaced=structuredClone(runners);
 spaced[0].horseName='  ハヤブサ ブロー　';
 const out=await fetchLocalPriorCornerEvidence({targetRace:race,runners:spaced,clock:now,
 fetchVerifiedRace:async()=>officialPacket});
 assert.equal(out.linkedRunEvidence,2);
 assert.equal(out.sourceReports[0].identityRejected,0);
});

test('bounded 10 official reads cover 10 different current horses before a sixth recent page for the same horse',()=>{
 const pageRace={...race,raceDate:'2026-11-13'};
 const eligible=Array.from({length:10},(_,i)=>({
  horseNo:i+1,horseName:'検証馬'+(i+1),
  verifiedRecentRuns:Array.from({length:5},(_,j)=>({
   ...past(i+1),raceDate:i===9?'2026-07-'+String(10-j).padStart(2,'0'):
    '2026-11-'+String(10-j).padStart(2,'0'),
   track:'園田',raceNo:i+1
  }))
 }));
 const planned=planLocalPriorCornerFetches({targetRace:pageRace,
  runners:eligible,maxPriorRaces:10});
 assert.equal(planned.length,10);
 const covered=new Set(planned.flatMap(job=>job.links.map(h=>h.horseNo)));
 assert.equal(covered.size,10);
 for(let i=1;i<=10;i++)assert.equal(covered.has(i),true,'horse '+i);
 // A slower/archive-only horse is served before the second history from
 // the other nine horses, despite having a much older result.
 assert.equal(planned.at(-1).links[0].horseNo,10);
});
test('already observed profile corner fields still require official past-result verification',()=>{
 const seen=structuredClone(runners);
 seen[0].verifiedRecentRuns[0].earlyPos=2;
 seen[0].verifiedRecentRuns[0].finalTurnPos=3;
 seen[1].verifiedRecentRuns[0].earlyPos=4;
 seen[1].verifiedRecentRuns[0].finalTurnPos=2;
 const planned=planLocalPriorCornerFetches({targetRace:race,runners:seen});
 assert.equal(planned.length,1);
 assert.equal(planned[0].links.length,2);
 assert.deepEqual(runners[0].verifiedRecentRuns[0],past(6));
});
test('shared official past race is one fetch but counts as evidence for two horses',()=>{
 const prior=structuredClone(runners);
 prior[0].verifiedRecentRuns.push({...past(6),
  raceDate:'2026-11-06',raceNo:2});
 prior[1].verifiedRecentRuns.push({...past(11),
  raceDate:'2026-11-05',raceNo:2});
 const first=planLocalPriorCornerFetches({
  targetRace:race,runners:prior,maxPriorRaces:1});
 assert.equal(first.length,1);
 assert.equal(first[0].links.length,2);
});

test('shared absolute preclaim deadline stops remaining official race reads even when far before post',async()=>{
 const start=Date.parse('2026-11-08T07:00:00+09:00');
 let current=start,attempts=0;
 const separate=structuredClone(runners);
 separate[1].verifiedRecentRuns[0].raceDate='2026-11-06';
 separate[1].verifiedRecentRuns[0].raceNo=4;
 const got=await fetchLocalPriorCornerEvidence({
  targetRace:race,runners:separate,clock:()=>current,
  absoluteDeadlineMs:start+1000,timeoutMs:900,
  fetchVerifiedRace:async()=>{attempts++;current+=2100;return officialPacket;}
 });
 assert.equal(got.planned,2);
 assert.equal(attempts,1);
 assert.equal(got.attempted,1);
 assert.equal(got.operation_budget_exhausted,true);
 assert.equal(got.sourceReports.filter(x=>x.status==='SKIPPED_OPERATION_BUDGET').length,1);
 assert.equal(got.claimStarted,false);
 assert.equal(got.saveAuthorized,false);
});
test('invalid optional absolute deadline fails before reading any official races',async()=>{
 let attempts=0;
 await assert.rejects(fetchLocalPriorCornerEvidence({
  targetRace:race,runners,absoluteDeadlineMs:-1,
  fetchVerifiedRace:async()=>{attempts++;return officialPacket;}
 }),/INVALID_PREFETCH_OPTIONS/);
 assert.equal(attempts,0);
});
