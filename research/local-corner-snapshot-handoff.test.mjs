import test from 'node:test';
import assert from 'node:assert/strict';
import {stageLocalCornerSnapshot,lookupLocalCornerSnapshot} from '../automation/local-corner-snapshot-handoff.mjs';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';

const clock=()=>Date.parse('2026-11-08T08:45:00+09:00');
const race={raceDate:'2026-11-08',track:'佐賀',raceNo:1,postTime:'2026-11-08T09:30:00+09:00'};
const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
const otherRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=987654';
const pastRace={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
const runners=[
 {horseNo:1,horseName:'架空馬6',status:'ACTIVE',verifiedRecentRuns:[{
  ...pastRace,pastHorseNo:6,horseRef,identityVerifiedBy:'OFFICIAL_HORSE_REF',
  source:'NAR_OFFICIAL_HISTORY'
 }]},
 {horseNo:2,horseName:'架空馬11',status:'ACTIVE',verifiedRecentRuns:[]}
];
const packet={status:'PREFETCH_ONLY',raceDate:race.raceDate,raceTrack:race.track,raceNo:race.raceNo,
 claimStarted:false,saveAuthorized:false,targetResultUsed:false,marketUsed:false,rankChanged:false,
 linkedRunEvidence:1,evidence:[{
  horseNo:1,horseName:'架空馬6',horseRef,identityVerifiedBy:'OFFICIAL_HORSE_REF',
  pastRace,pastHorseNo:6,earlyPos:1,finalTurnPos:10,
  corners:[{corner:1,position:1},{corner:4,position:10}],
  source:'NAR_OFFICIAL_PAST_RACE_RESULT',
  sourceRef:officialNarPastResultUrl(pastRace),
  sourceCheckedAt:'2026-11-08T08:40:00+09:00',rankingEffect:'NONE_UNTIL_REVIEWED'
 }]};
const makeStore=()=>{
 const rows=[];
 return {rows,
  async insertIfAbsent(record){
   if(rows.some(x=>x.payload_digest===record.payload_digest))return {inserted:false};
   rows.push({...structuredClone(record),captured_at:record.as_of});
   return {inserted:true};
  },
  async findLatest(criteria){
   return rows.filter(r=>r.circuit===criteria.circuit&&
    r.race_date===criteria.race_date&&r.track===criteria.track&&
    r.race_no===criteria.race_no&&r.source_kind===criteria.source_kind&&
    r.official_roster_digest===criteria.official_roster_digest&&
    Date.parse(r.as_of)<=Date.parse(criteria.before)
   ).sort((a,b)=>b.as_of.localeCompare(a.as_of))[0]??null;
  }
 };
};
const stage=(store,p=packet,rs=runners,clk=clock)=>stageLocalCornerSnapshot({
 race,officialRunners:rs,packet:p,store,clock:clk
});
const lookup=(store,rs=runners,clk=clock)=>lookupLocalCornerSnapshot({
 race,officialRunners:rs,store,clock:clk
});
test('authorized as-of capture can be reloaded for same official roster only',async()=>{
 const store=makeStore();const before=structuredClone(packet);
 assert.equal((await stage(store)).status,'STORED');
 assert.equal(store.rows.length,1);
 const record=store.rows[0];
 assert.equal(record.source_kind,'LOCAL_OFFICIAL_CORNERS');
 assert.equal(record.evidence.schemaVersion,'LOCAL_OFFICIAL_CORNERS_1');
 assert.equal(JSON.stringify(record).includes('bet_strategy'),false);
 assert.equal(JSON.stringify(record).includes('target_finish'),false);
 assert.deepEqual(packet,before);
 const out=await lookup(store);
 assert.equal(out.evidence.length,1);
 assert.equal(out.evidence[0].earlyPos,1);
 assert.equal(out.evidence[0].finalTurnPos,10);
 assert.equal(out.saveAuthorized,false);
});
test('duplicate append never overwrites an existing frozen-in-time packet',async()=>{
 const store=makeStore();assert.equal((await stage(store)).status,'STORED');
 assert.equal((await stage(store)).status,'ALREADY_STORED');
 assert.equal(store.rows.length,1);
});
test('official runner name change invalidates snapshot even with same numbers',async()=>{
 const store=makeStore();await stage(store);
 const rs=structuredClone(runners);rs[0].horseName='別の馬';
 assert.equal(await lookup(store,rs),null);
});
test('no inherited position evidence from unrelated or switched past horse number',async()=>{
 const store=makeStore();const p=structuredClone(packet);
 p.evidence[0].pastHorseNo=11;
 assert.equal((await stage(store,p)).status,'REJECTED_UNVERIFIED_EVIDENCE');
 assert.equal(store.rows.length,0);
});
test('no URL substitution or later source timestamp',async()=>{
 const store=makeStore(),bad=structuredClone(packet);
 bad.evidence[0].sourceRef='https://evil.example/';
 assert.equal((await stage(store,bad)).status,'REJECTED_UNVERIFIED_EVIDENCE');
 bad.evidence[0].sourceRef=packet.evidence[0].sourceRef;
 bad.evidence[0].sourceCheckedAt='2026-11-08T09:40:00+09:00';
 assert.equal((await stage(store,bad)).status,'REJECTED_UNVERIFIED_EVIDENCE');
});
test('premature CLAIM or market flags cannot be stored',async()=>{
 const store=makeStore();
 assert.equal((await stage(store,{...packet,claimStarted:true})).status,'REJECTED_UNVERIFIED_EVIDENCE');
 assert.equal((await stage(store,{...packet,marketUsed:true})).status,'REJECTED_UNVERIFIED_EVIDENCE');
 assert.equal(store.rows.length,0);
});
test('post-time capture and post-time read rejected without touching store',async()=>{
 const store=makeStore();
 await stage(store);
 const late=()=>Date.parse(race.postTime)+1;
 assert.equal((await stage(store,packet,runners,late)).status,'SKIPPED_POST_TIME');
 assert.equal(await lookup(store,runners,late),null);
});
test('tampered record, later capture and wrong source kind are all discarded',async()=>{
 const store=makeStore();await stage(store);
 store.rows[0].evidence.packet.evidence[0].earlyPos=8;
 assert.equal(await lookup(store),null);
 store.rows[0].evidence.packet.evidence[0].earlyPos=1;
 store.rows[0].captured_at='2026-11-08T10:00:00+09:00';
 assert.equal(await lookup(store),null);
 store.rows[0].captured_at=store.rows[0].as_of;
 store.rows[0].source_kind='COMBINED';
 assert.equal(await lookup(store),null);
});
test('storage outage isolated and late lookup failures return null',async()=>{
 const broken={insertIfAbsent:async()=>{throw Error('db down');},
  findLatest:async()=>{throw Error('db down');}};
 assert.equal((await stage(broken)).status,'OPTIONAL_STORE_FAILED');
 assert.equal(await lookup(broken),null);
});
test('same race but conflicting field size and unknown horse ref fail closed',async()=>{
 const store=makeStore();const bad=structuredClone(packet);
 bad.evidence[0].horseRef=otherRef;
 assert.equal((await stage(store,bad)).status,'REJECTED_UNVERIFIED_EVIDENCE');
 assert.equal((await stage(store,packet,[runners[0],runners[0]])).status,'REJECTED_UNVERIFIED_EVIDENCE');
});
