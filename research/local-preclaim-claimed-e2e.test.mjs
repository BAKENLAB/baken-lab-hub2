import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchLocalPriorCornerEvidence} from '../automation/nar-corner-prefetch.mjs';
import {stageLocalCornerSnapshot} from '../automation/local-corner-snapshot-handoff.mjs';
import {makeLocalClaimedCornerLookup} from '../automation/local-corner-claimed-lookup.mjs';
import {buildLocalClaimedCornerShadow} from '../automation/local-claimed-corner-shadow.mjs';

const stamp=Date.parse('2026-11-08T08:48:00+09:00');
const clock=()=>stamp;
const race={raceDate:'2030-01-01',track:'佐賀',raceNo:1,postTime:'2030-01-01T09:30:00+09:00'};
const prior={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
const ref=n=>'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode='+n;
const runners=[
 {horseNo:1,horseName:'ハヤブサブロー',verifiedRecentRuns:[{
  ...prior,pastHorseNo:6,horseRef:ref('123456'),identityVerifiedBy:'OFFICIAL_HORSE_REF',
  source:'NAR_OFFICIAL_HISTORY',earlyPos:null,finalTurnPos:null
 }]},
 {horseNo:2,horseName:'シエルブリエ',verifiedRecentRuns:[{
  ...prior,pastHorseNo:11,horseRef:ref('223456'),identityVerifiedBy:'OFFICIAL_HORSE_REF',
  source:'NAR_OFFICIAL_RESCUE',earlyPos:null,finalTurnPos:null
 }]}
];
const names=Object.fromEntries(Array.from({length:11},(_,i)=>[String(i+1),'架空馬'+(i+1)]));
names['6']='ハヤブサブロー';names['11']='シエルブリエ';
const officialRaw={
 sourceUrl:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5',
 raceHeaderText:'2026年11月7日（土） 佐賀 第5競走 競走成績',
 sourceCheckedAt:'2026-11-08T08:45:00+09:00',
 knownHorseNos:Array.from({length:11},(_,i)=>i+1),
 officialHorseNames:names,
 cornerRows:[
  ['１角','6,7,(4,9),(8,11),5-1,(3,10)-2'],
  ['４角','11,9-8,7-3,10,4,1,5,(6,2)']
 ]
};
const compact=runners.map(r=>({
 horse_no:r.horseNo,horse_name:r.horseName,
 recent_runs:[{race_date:prior.raceDate,track:prior.track,race_no:prior.raceNo,
 surface:'ダート',distance:1300,early_pos:null,final_turn_pos:null}]
}));
const context=runners.map(r=>({
 horse_no:r.horseNo,horse_name:r.horseName,identity_refs:[r.verifiedRecentRuns[0].horseRef],
 recent_runs:[{...compact.find(c=>c.horse_no===r.horseNo).recent_runs[0],
  horse_no:r.verifiedRecentRuns[0].pastHorseNo,
  horse_ref:r.verifiedRecentRuns[0].horseRef,
  identity_verified_by:'OFFICIAL_HORSE_REF',
  source:r.verifiedRecentRuns[0].source}]
}));
const store=()=>{
 let row=null;
 return {
  async insertIfAbsent(rec){row={...structuredClone(rec),captured_at:rec.as_of};return {inserted:true};},
  async findLatest(){return row;}
 };
};
test('historic RaceMarkTable -> official identity -> append-only -> claimed lookup -> shadow pace',async()=>{
 const count={calls:0};
 const p=await fetchLocalPriorCornerEvidence({
  targetRace:race,runners,clock,fetchVerifiedRace:async()=>{
   count.calls++;return officialRaw;
  }
 });
 assert.equal(count.calls,1);
 assert.equal(p.linkedRunEvidence,2);
 const privateStore=store();
 const saved=await stageLocalCornerSnapshot({
  race,officialRunners:runners,packet:p,store:privateStore,clock
 });
 assert.equal(saved.status,'STORED');
 const read=makeLocalClaimedCornerLookup({store:privateStore});
 const fetched=await read({race,verifiedRunners:context},stamp+1000);
 assert.equal(fetched.linkedRunEvidence,2);
 const original=structuredClone(compact);
 const shadow=buildLocalClaimedCornerShadow({
  targetRace:race,verifiedRunners:context,compactRunners:compact,
  cornerPacket:fetched,conditions:{surface:'ダート',distance:1300},
  clock:()=>stamp+1000
 });
 assert.equal(shadow.applied_prior_runs,2);
 assert.equal(shadow.inserted_corner_fields,4);
 assert.equal(shadow.field_pace_evidence.runners_with_historical_passing_order,2);
 assert.equal(shadow.field_pace_evidence.runners.find(r=>r.horse_no===1)?.verified_passing_order_examples[0]?.early_pos,1);
 assert.equal(shadow.field_pace_evidence.runners.find(r=>r.horse_no===2)?.verified_passing_order_examples[0]?.final_turn_pos,1);
 assert.deepEqual(compact,original);
 assert.equal(shadow.use_for_rank,false);
 assert.equal(shadow.use_for_save_gate,false);
});
test('offline official archive is omitted; optional path does not authorize CLAIM/SAVE',async()=>{
 const p=await fetchLocalPriorCornerEvidence({
  targetRace:race,runners,clock,fetchVerifiedRace:async()=>{throw Error('archive unavailable');}
 });
 assert.equal(p.linkedRunEvidence,0);
 const saved=await stageLocalCornerSnapshot({
  race,officialRunners:runners,packet:p,store:store(),clock
 });
 assert.equal(saved.status,'SKIPPED_NO_EVIDENCE');
 assert.equal(p.claimStarted,false);
 assert.equal(p.saveAuthorized,false);
});
