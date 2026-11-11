import test from 'node:test';
import assert from 'node:assert/strict';
import {runAuthorizedLocalCornerPreclaim} from '../automation/local-official-preclaim-workflow.mjs';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';
const now=()=>Date.parse('2026-11-08T09:00:00+09:00');
const code='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
const race={race_date:'2026-11-08',track:'佐賀',race_no:1,circuit:'LOCAL',
 prediction_status:'PENDING',post_time:'2026-11-08T11:45:00+09:00',
 field_payload:{runners:[{horse_no:1,horse_name:'架空馬6',status:'ACTIVE'}]}};
const source=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
source.searchParams.set('k_babaCode','32');
source.searchParams.set('k_raceDate','2026/11/08');
source.searchParams.set('k_raceNo','1');
const snapshot={
 race_date:race.race_date,track:'佐賀',race_no:1,circuit:'LOCAL',
 source:'NAR_OFFICIAL_DEBA',source_ref:source.href,
 fetched_at:'2026-11-08T08:59:55+09:00',
 runners:[{horse_no:1,horse_name:'架空馬6',status:'ACTIVE',identity_refs:[code],
  horse_link_evidence:{horse_no:1,horse_ref:code}}]
};
const history=[{race_date:'2026-11-07',track:'佐賀',race_no:5,horse_no:6,
 horse_name:'架空馬6',horse_ref:code,source:'NAR_OFFICIAL_RESCUE',
 early_pos:null,final_turn_pos:null}];
const priorRace={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
const packet=(targetRace)=>({
 status:'PREFETCH_ONLY',raceDate:targetRace.raceDate,
 raceTrack:targetRace.track,raceNo:targetRace.raceNo,
 linkedRunEvidence:1,claimStarted:false,saveAuthorized:false,
 marketUsed:false,targetResultUsed:false,rankChanged:false,
 evidence:[{horseNo:1,horseName:'架空馬6',horseRef:code,identityVerifiedBy:'OFFICIAL_HORSE_REF',
 pastHorseNo:6,pastRace:priorRace,earlyPos:1,finalTurnPos:5,
 corners:[{corner:1,position:1},{corner:4,position:5}],
 source:'NAR_OFFICIAL_PAST_RACE_RESULT',sourceRef:officialNarPastResultUrl(priorRace),
 sourceCheckedAt:'2026-11-08T08:59:57+09:00',rankingEffect:'NONE_UNTIL_REVIEWED'}]
});
const make=(override={})=>{
 const calls={card:0,history:0,corners:0,writes:0,authorized:0};
 let witnessed=null;
 const officialReader={
  async readRace(){calls.card++;return snapshot;},
  async readHistory(){calls.history++;return history;}
 };
 const store={async insertIfAbsent(){calls.writes++;return {inserted:true};}};
 const opts={race,officialReader,store,
  assertAuthorized:async()=>{calls.authorized++;},
  prepareCorners:async ({targetRace,officialVerifiedRunners})=>{
   calls.corners++;
   witnessed=structuredClone(officialVerifiedRunners);
   return packet(targetRace);
  },clock:now,...override};
 return {calls,getWitness:()=>witnessed,run:()=>runAuthorizedLocalCornerPreclaim(opts)};
};
test('explicit authorized preclaim traverses official card and exact horse history, without CLAIM',async()=>{
 const x=make(),out=await x.run();
 assert.equal(out.status,'STORED',JSON.stringify({out,calls:x.calls,witness:x.getWitness()}));assert.equal(out.storeWritten,true);
 assert.equal(x.getWitness()?.[0]?.verifiedRecentRuns?.[0]?.pastHorseNo,6,
   'Official history witness must include prior race horse number');
 assert.equal(out.linkedRunEvidence,1);assert.equal(out.claimStarted,false);
 assert.equal(out.predictionSaved,false);
 assert.deepEqual(x.calls,{card:1,history:1,corners:1,writes:1,authorized:1});
});
test('missing or denied server authorization prevents all official reads',async()=>{
 const x=make({assertAuthorized:async()=>{throw Error('FORBIDDEN')}});
 await assert.rejects(x.run(),/FORBIDDEN/);
 assert.equal(x.calls.card,0);assert.equal(x.calls.writes,0);
 await assert.rejects(runAuthorizedLocalCornerPreclaim({...{race},officialReader:{},prepareCorners(){},store:{}}),/AUTHORIZATION_GATE_REQUIRED/);
});
test('official runner mismatch forbids corner acquisition',async()=>{
 const bad=structuredClone(snapshot);
 bad.runners[0].horse_name='別の馬';
 const x=make({officialReader:{readRace:async()=>bad,readHistory:async()=>history}});
 const out=await x.run();
 assert.equal(out.status,'OFFICIAL_FIELD_MISMATCH');
 assert.equal(x.calls.corners,0);assert.equal(x.calls.writes,0);
});
test('near post-time budget protects safe final prediction window',async()=>{
 const x=make({clock:()=>Date.parse(race.post_time)-180000});
 const out=await x.run();
 assert.equal(out.status,'SKIPPED_DEADLINE');
 assert.equal(x.calls.card,0);
});
test('horse history outage quarantined without overclaiming readiness',async()=>{
 const x=make({officialReader:{
  readRace:async()=>snapshot,
  readHistory:async()=>{throw Error('history not available')}
 },prepareCorners:async ({targetRace})=>({
  status:'PREFETCH_ONLY',raceDate:targetRace.raceDate,
  raceTrack:targetRace.track,raceNo:targetRace.raceNo,
  linkedRunEvidence:0,evidence:[],
  claimStarted:false,saveAuthorized:false,marketUsed:false,targetResultUsed:false,rankChanged:false
 })});
 const out=await x.run();
 assert.equal(out.status,'SKIPPED_NO_EVIDENCE');
 assert.equal(out.horseReports[0].status,'OPTIONAL_HISTORY_UNAVAILABLE');
 assert.equal(x.calls.writes,0);
});

test('cancelled/excluded field mismatch is also detected, even if active horses look equal',async()=>{
 const mismatched=structuredClone(race);
 mismatched.field_payload.runners.push({
  horse_no:2,horse_name:'取消馬',status:'CANCELLED'
 });
 const x=make({race:mismatched});
 const out=await x.run();
 assert.equal(out.status,'OFFICIAL_FIELD_MISMATCH');
 assert.equal(x.calls.corners,0);assert.equal(x.calls.writes,0);
});
test('unresponsive official card times out without claiming or writing',async()=>{
 const x=make({officialReader:{
  readRace:async()=>new Promise(()=>{}),
  readHistory:async()=>history
 },officialCardTimeoutMs:15});
 const out=await x.run();
 assert.equal(out.status,'OFFICIAL_FIELD_UNAVAILABLE');
 assert.equal(x.calls.corners,0);assert.equal(x.calls.writes,0);
});
test('stale official card fails independent freshness check',async()=>{
 const stale=structuredClone(snapshot);
 stale.fetched_at='2026-11-08T08:55:00+09:00';
 const x=make({officialReader:{
  readRace:async()=>stale,
  readHistory:async()=>history
 }});
 assert.equal((await x.run()).status,'OFFICIAL_FIELD_MISMATCH');
 assert.equal(x.calls.writes,0);
});

test('history response with zero verified runs is not labelled VERIFIED',async()=>{
 const x=make({officialReader:{
  readRace:async()=>snapshot,
  readHistory:async()=>[]
 }});
 const out=await x.run();
 assert.equal(out.status,'REJECTED_UNVERIFIED_EVIDENCE');
 assert.equal(out.horseReports[0].status,'NO_VERIFIED_PRIOR_RUNS');
 assert.equal(out.coverage.active_horses,1);
 assert.equal(out.coverage.successful_history_responses,1);
 assert.equal(out.coverage.horses_with_verified_history,0);
 assert.equal(out.coverage.verified_prior_run_witnesses,0);
 assert.equal(out.coverage.unavailable_or_empty_history,1);
 assert.equal(x.calls.writes,0);
});
test('saved official profile witness returns truthful verified coverage',async()=>{
 const x=make(),out=await x.run();
 assert.equal(out.status,'STORED');
 assert.equal(out.coverage.active_horses,1);
 assert.equal(out.coverage.horses_with_verified_history,1);
 assert.equal(out.coverage.verified_prior_run_witnesses,1);
 assert.equal(out.coverage.missing_official_horse_links,0);
});
