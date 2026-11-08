import test from 'node:test';
import assert from 'node:assert/strict';
import {jraPostTimeJst,planJraOfficialCardAcquisition,
 runAuthorizedJraOfficialCardAcquisition} from '../automation/jra-official-card-preclaim-plan.mjs';

const date='2026-11-08';
const now=()=>Date.parse('2026-11-08T09:00:00+09:00');
const mk=(track,race_no,post_time,extra={})=>({
 race_date:date,track,race_no,post_time,
 race_type:'平地',surface:'ダート',field_size:2,cname:'jra-'+track+'-'+race_no,...extra
});
const live=[
 mk('福島',1,'9時45分'),
 mk('東京',1,'9時55分'),
 mk('京都',1,'10時05分',{race_type:'障害'}),
 mk('福島',2,'10時15分')
];
const runs=(track,race_no,n=2)=>Array.from({length:n},(_,i)=>({
 race_date:date,track,race_no,horse_no:i+1,
 horse_name:'架空馬'+(i+1),horse_ref:'/JRADB/accessU.html?CNAME=test'+(i+1)
}));
const runners=[...runs('福島',1),...runs('東京',1),...runs('京都',1),...runs('福島',2,1)];
const plans=(overrides={})=>planJraOfficialCardAcquisition({
 raceDate:date,liveRaces:live,runnerRows:runners,
 officialRaces:[],clock:now,...overrides});
test('JST official time parsing is strict and chronological',()=>{
 assert.equal(jraPostTimeJst(date,'9時45分'),Date.parse('2026-11-08T09:45:00+09:00'));
 assert.equal(jraPostTimeJst(date,'10時05分'),Date.parse('2026-11-08T10:05:00+09:00'));
 assert.equal(jraPostTimeJst(date,'25時00分'),null);
 assert.equal(jraPostTimeJst(date,'9:45'),null);
});
test('JRA candidate schedule is not official READY even with complete live runners',()=>{
 const p=plans();
 assert.equal(p.complete,false);assert.equal(p.scoringAllowed,false);
 assert.deepEqual(p.items.map(x=>x.status),[
  'NEEDS_FRESH_JRA_OFFICIAL_CARD',
  'NEEDS_FRESH_JRA_OFFICIAL_CARD',
  'EXCLUDED_NOT_FLAT',
  'LIVE_CANDIDATE_UNVERIFIED'
 ]);
 assert.deepEqual(p.items.slice(0,3).map(x=>x.post_time),['9時45分','9時55分','10時05分']);
 assert.equal(p.claimStarted,false);assert.equal(p.predictionSaved,false);
});
test('existing verified full field is preserved and never republished',()=>{
 const p=plans({officialRaces:[{
  race_date:date,track:'福島',race_no:1,
  field_status:'BASIC_READY',prediction_status:'PENDING',
  source:'JRA_OFFICIAL_VERIFIED_GATE_V1',
  field_payload:{official_status_verification:{html_sha256:'b'.repeat(64)}}
 }]});
 assert.equal(p.items[0].status,'ALREADY_OFFICIAL_READY');
 assert.equal(p.items[0].needsOfficialFullField,false);
});
test('after post buffer and previous FROZEN never queue official publisher',()=>{
 const p=plans({clock:()=>Date.parse('2026-11-08T09:41:00+09:00'),
  frozenKeys:[date+'/東京/1']});
 assert.equal(p.items[0].status,'TOO_LATE_FOR_SAFE_VERIFICATION');
 assert.equal(p.items[1].status,'PREVIOUS_FROZEN');
});
test('explicit server authorization is mandatory before any official fetch',async()=>{
 let count=0;
 const p=plans();
 await assert.rejects(runAuthorizedJraOfficialCardAcquisition({
  plan:p,assertAuthorized:async()=>{throw Error('DENIED')},
  publishOfficial:async()=>{count++;return {ok:true}},
  clock:now
 }),/DENIED/);
 assert.equal(count,0);
});
test('authorized publisher is only called for eligible flat races and no safety retry',async()=>{
 const invoked=[],plan=plans();
 const out=await runAuthorizedJraOfficialCardAcquisition({
  plan,assertAuthorized:async intent=>assert.equal(intent,'AUTHORIZED_JRA_OFFICIAL_CARD_ACQUISITION'),
  clock:now,
  publishOfficial:async ({track,race_no})=>{
   invoked.push(track+race_no);
   if(track==='福島')throw Error('source down');
   return {ok:true,field_status:'BASIC_READY',official_status_verified:true};
  }
 });
 assert.deepEqual(invoked,['福島1','東京1']);
 assert.equal(out.reports[0].status,'OFFICIAL_SOURCE_UNAVAILABLE');
 assert.equal(out.reports[1].status,'OFFICIALLY_VERIFIED');
 assert.equal(out.reports[2].status,'EXCLUDED_NOT_FLAT');
 assert.equal(out.claimStarted,false);assert.equal(out.predictionSaved,false);
});
test('malformed or duplicate candidate race metadata never produces a safe candidate',()=>{
 assert.throws(()=>plans({liveRaces:[live[0],live[0]]}),/DUPLICATE_LIVE_RACE/);
 const p=plans({liveRaces:[mk('福島',1,'wrong')]});
 assert.equal(p.items[0].status,'INVALID_RACE_METADATA');
});

test('a BASIC_READY label without verified official provenance is not trusted',()=>{
 const p=plans({officialRaces:[{
  race_date:date,track:'福島',race_no:1,
  field_status:'BASIC_READY',source:'SCHEDULE',
  field_payload:{},prediction_status:'PENDING'
 }]});
 assert.equal(p.items[0].status,'EXISTING_OFFICIAL_ROW_UNVERIFIED');
 assert.equal(p.items[0].needsOfficialFullField,false);
});
