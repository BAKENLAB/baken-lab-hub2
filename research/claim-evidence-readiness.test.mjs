import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareClaimEvidence,jraV3RowsToProvider,localArchiveRowsToProvider} from './claim-evidence-readiness.mjs';

const race={raceDate:'2026-11-08',track:'福島',raceNo:10,postTime:'2026-11-08T07:00:00Z'};
const asOf='2026-11-08T05:00:00Z';
const roster=[
 {horseNo:8,horseName:'A',horseRef:'same-id',status:'ACTIVE'},
 {horseNo:9,horseName:'B',horseRef:'other-id',status:'ACTIVE'},
 {horseNo:10,horseName:'C',status:'CANCELLED'}
];
const run=(date='2026-08-01',ex={})=>({
 raceDate:date,track:'福島',raceNo:6,surface:'芝',distance:1200,
 finish:2,earlyPos:2,finalTurnPos:3,final3f:34.1,
 halonTimes:'12.1 - 11.3 - 11.4 - 11.2 - 11.7 - 12.0',
 sourceCheckedAt:asOf,...ex
});
const provider=(id,identity,rows)=>({id,identity,load:async()=>rows});

test('two matching active runners preserve official field and detailed coverage',async()=>{
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
  providers:[provider('JRA_ARCHIVE','VERIFIED',[
   {horseNo:8,horseName:'A',horseRef:'same-id',runs:[run()]},
   {horseNo:9,horseName:'B',horseRef:'other-id',runs:[run('2026-09-01',{earlyPos:5})]}
  ])],clock:()=>Date.parse(asOf)});
 assert.equal(a.rosterCount,2); assert.equal(a.fieldCoverage.position,2);
 assert.equal(a.fieldCoverage.laps,2); assert.equal(a.fieldCoverage.verifiedHistory,2);
 assert.equal(a.saveAuthorizedByThisModule,false);assert.equal(a.oddsUsed,false);
 assert.equal(a.normalCorePathAllowed,true);
});
test('one optional source failure does not stop a healthy alternate',async()=>{
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
 providers:[{id:'OFFICIAL_RECENT',identity:'VERIFIED',load:async()=>{throw Error('transient');}},
 provider('JRA_ARCHIVE','VERIFIED',[{horseNo:8,horseName:'A',runs:[run()]}])]
 ,clock:()=>Date.parse(asOf)});
 assert.equal(a.optionalProviderFailures,1); assert.equal(a.fieldCoverage.position,1);
 assert.equal(a.sourceReports[0].status,'SOURCE_FAILED');
});
test('all optional sources fail, core remains unblocked but data missing explicitly',async()=>{
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,providers:[
 {id:'one',load:async()=>{throw Error('bad');}},
 {id:'two',load:async()=>null}],clock:()=>Date.parse(asOf)});
 assert.equal(a.fieldCoverage.anyHistory,0);
 assert.equal(a.optionalProviderFailures,2);
 assert.equal(a.runners[0].evidenceStatus,'NO_HISTORY');
 assert.equal(a.normalCorePathAllowed,true);
});
test('claimed context must still reject duplicate official horse numbers',async()=>{
 await assert.rejects(prepareClaimEvidence({race,asOf,officialRunners:[roster[0],roster[0]]}),/roster conflict/);
});
test('future results and snapshots after asOf never enter evidence',async()=>{
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
 providers:[provider('ONE','VERIFIED',[{horseNo:8,horseName:'A',runs:[
  run('2026-11-08'),run('2026-08-01',{sourceCheckedAt:'2026-11-08T08:00:00Z'}),
  run('2026-07-01',{earlyPos:4,sourceCheckedAt:'2026-11-07T04:00:00Z'})
 ]}])],clock:()=>Date.parse(asOf)});
 assert.equal(a.runners[0].counts.historicalRuns,1);
 assert.equal(a.runners[0].runs[0].earlyPos,4);
});
test('wrong horse identity can never contaminate official roster',async()=>{
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
 providers:[provider('SRC','VERIFIED',[{horseNo:8,horseName:'A',horseRef:'different-id',runs:[run()]},
 {horseNo:9,horseName:'A',runs:[run()]}])],clock:()=>Date.parse(asOf)});
 assert.equal(a.fieldCoverage.anyHistory,0);
 assert.equal(a.runners[0].discrepancies[0].status,'HORSE_REF_MISMATCH');
});
test('name-only local archive never masquerades as identity-verified',async()=>{
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
 providers:[provider('LOCAL_HISTORY','NAME_ONLY',[{horseNo:8,horseName:'A',runs:[run('2026-07-01',{sourceCheckedAt:null})]}])],
 clock:()=>Date.parse(asOf)});
 assert.equal(a.fieldCoverage.position,1);
 assert.equal(a.fieldCoverage.verifiedHistory,0);
 assert.equal(a.runners[0].evidenceStatus,'UNVERIFIED_ONLY');
});
test('before claim deadline skips optional providers to protect lease time',async()=>{
 let calls=0;
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
 providers:[{id:'EXPENSIVE',identity:'VERIFIED',load:async()=>{calls++;return [];}}],
 clock:()=>Date.parse(race.postTime)-60000,minimumClaimBufferMs:300000});
 assert.equal(calls,0);
 assert.equal(a.sourceReports[0].status,'SKIPPED_DEADLINE_BUFFER');
 assert.equal(a.normalCorePathAllowed,true);
});
test('array conversion for existing JRA v3 detailed history',()=>{
 const rows=jraV3RowsToProvider([{horse_no:8,horse_name:'A',history:[
 {prior_date:'2026-04-26',prior_track:'福島',prior_surface:'芝',prior_distance:1200,
 finish:1,early_pos:1,final3f:34.3,race_halons:'12.5 - 11.1 - 11.3 - 11.1 - 11.3 - 11.9'}]}],asOf);
 assert.equal(rows[0].runs[0].halonTimes,'12.5 - 11.1 - 11.3 - 11.1 - 11.3 - 11.9');
 assert.equal(rows[0].runs[0].sourceCheckedAt,asOf);
});
test('array conversion for actual LOCAL archive fields',()=>{
 const rows=localArchiveRowsToProvider({runners:[{horse_no:'8',horse_name:'A',history:[
 {race_date:'2026-07-01',track:'高知',race_no:10,surface:'ダート',distance:1600,
 early_pos:2,final_turn_pos:3,final3f:40.1}]}]});
 assert.equal(rows[0].runs[0].earlyPos,2);
 assert.equal(rows[0].runs[0].sourceCheckedAt,null);
});
test('duplicate historical same-race source cannot inflate sample',async()=>{
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
 providers:[provider('A','VERIFIED',[{horseNo:8,horseName:'A',runs:[run()]}]),
 provider('B','NAME_ONLY',[{horseNo:8,horseName:'A',runs:[run('2026-08-01',{final3f:35.1,sourceCheckedAt:null})]}])],
 clock:()=>Date.parse(asOf)});
 assert.equal(a.runners[0].counts.historicalRuns,1);
 assert.equal(a.runners[0].runs[0].final3f,34.1);
});

test('hung optional provider times out, so the normal prediction path can continue',async()=>{
 const start=Date.now();
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,clock:()=>Date.parse(asOf),
  providerTimeoutMs:15,providers:[
   {id:'HUNG',identity:'VERIFIED',load:async()=>new Promise(()=>{})},
   provider('FALLBACK','VERIFIED',[{horseNo:8,horseName:'A',runs:[run()]}])
 ]});
 assert.equal(a.sourceReports[0].status,'SOURCE_TIMEOUT');
 assert.equal(a.sourceReports[1].status,'OK');
 assert.equal(a.fieldCoverage.anyHistory,1);
 assert.equal(a.normalCorePathAllowed,true);
 assert.ok(Date.now()-start<1500);
});
test('provider cancellation signal is passed for cooperative abort',async()=>{
 let signal;
 const a=await prepareClaimEvidence({race,asOf,officialRunners:roster,
 clock:()=>Date.parse(asOf),providerTimeoutMs:15,
 providers:[{id:'SLOW',identity:'VERIFIED',load:({signal:abortSignal})=>{
  signal=abortSignal;
  return new Promise(()=>{});
 }}]});
 assert.equal(a.sourceReports[0].status,'SOURCE_TIMEOUT');
 assert.equal(signal.aborted,true);
});
