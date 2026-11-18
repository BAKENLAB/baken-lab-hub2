import test from 'node:test';
import assert from 'node:assert/strict';
import {stageLocalCornerSnapshot,lookupLocalCornerSnapshot} from './local-corner-snapshot-handoff.mjs';
import {validateOfficialNarRaceLaps} from './nar-official-lap-evidence.mjs';
const now=Date.parse('2026-11-19T07:00:00+09:00');
const date='2026-11-19',post='2026-11-19T12:00:00+09:00',sourceCheckedAt=new Date(now-1000).toISOString();
const past={raceDate:'2026-10-30',track:'園田',raceNo:2};
const sourceRef='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=27&k_raceDate=2026%2F10%2F30&k_raceNo=2';
const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456789';
const race={race_date:date,track:'園田',race_no:5,post_time:post};
const officialRunners=[{horseNo:5,horseName:'SYNTHETIC',status:'ACTIVE',verifiedRecentRuns:[
 {raceDate:past.raceDate,track:past.track,raceNo:past.raceNo,pastHorseNo:8,horseRef,identityVerifiedBy:'OFFICIAL_HORSE_REF',source:'NAR_OFFICIAL_RESCUE'}]}];
const entry={horseNo:5,horseName:'SYNTHETIC',horseRef,identityVerifiedBy:'OFFICIAL_HORSE_REF',pastRace:past,
 pastHorseNo:8,earlyPos:3,finalTurnPos:2,corners:[{corner:1,position:3},{corner:4,position:2}],
 source:'NAR_OFFICIAL_PAST_RACE_RESULT',sourceRef,sourceCheckedAt,rankingEffect:'NONE_UNTIL_REVIEWED'};
const laps=validateOfficialNarRaceLaps({past,targetDate:date,targetPostTime:post,sourceUrl:sourceRef,
 sourceCheckedAt,distance:1400,winnerTime:'1:35.6',halonTimes:[13.7,12.5,14.3,14.2,13.4,14.1,13.4]});
const preclaim={status:'PREFETCH_ONLY',raceDate:date,raceTrack:'園田',raceNo:5,linkedRunEvidence:1,
 evidence:[entry],officialRaceLaps:[laps],claimStarted:false,saveAuthorized:false,
 targetResultUsed:false,marketUsed:false,rankChanged:false};
const makeStore=()=>{let row=null;return {insertIfAbsent:async r=>{row={...r,captured_at:new Date(now).toISOString()};return {inserted:true}},findLatest:async()=>row,get:()=>row}};
test('as-of preclaim stores official race-wide laps without changing valid corners',async()=>{
 const store=makeStore();
 const a=await stageLocalCornerSnapshot({race,officialRunners,packet:preclaim,store,clock:()=>now});
 assert.equal(a.status,'STORED');assert.equal(store.get().evidence.packet.evidence.length,1);
 assert.equal(store.get().evidence.packet.officialRaceLaps.length,1);
 const b=await lookupLocalCornerSnapshot({race,officialRunners,store,clock:()=>now+1000});
 assert.equal(b.evidence.length,1);assert.equal(b.officialRaceLaps.length,1);
 assert.equal(b.officialRaceLaps[0].individual_horse_sectionals,false);
});
test('modified optional lap does not break verified historical corner snapshot',async()=>{
 const p=structuredClone(preclaim);p.officialRaceLaps[0].segments[0].seconds+=1;
 const store=makeStore();const a=await stageLocalCornerSnapshot({race,officialRunners,packet:p,store,clock:()=>now});
 assert.equal(a.status,'STORED');assert.equal(store.get().evidence.packet.evidence.length,1);
 assert.equal(store.get().evidence.packet.officialRaceLaps.length,0);
});
test('post-start cannot add a snapshot',async()=>{
 const store=makeStore();
 const a=await stageLocalCornerSnapshot({race,officialRunners,packet:preclaim,store,clock:()=>Date.parse(post)+1});
 assert.equal(a.inserted,false);assert.equal(store.get(),null);
});
