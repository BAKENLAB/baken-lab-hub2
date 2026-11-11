import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeLocalClaimedCornerLookup} from '../automation/local-corner-claimed-lookup.mjs';
import {stageLocalCornerSnapshot} from '../automation/local-corner-snapshot-handoff.mjs';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';

const at=Date.parse('2026-11-08T08:46:00+09:00');
const race={race_date:'2026-11-08',track:'佐賀',race_no:1,
 post_time:'2026-11-08T09:30:00+09:00'};
const prior={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
const official=[{horseNo:1,horseName:'架空馬6',verifiedRecentRuns:[{
 ...prior,pastHorseNo:6,horseRef,identityVerifiedBy:'OFFICIAL_HORSE_REF',
 source:'NAR_OFFICIAL_HISTORY'}]}];
const packet={status:'PREFETCH_ONLY',raceDate:race.race_date,
 raceTrack:race.track,raceNo:race.race_no,
 claimStarted:false,saveAuthorized:false,marketUsed:false,
 targetResultUsed:false,rankChanged:false,linkedRunEvidence:1,
 evidence:[{horseNo:1,horseName:'架空馬6',horseRef,
 identityVerifiedBy:'OFFICIAL_HORSE_REF',pastRace:prior,pastHorseNo:6,
 earlyPos:1,finalTurnPos:10,
 corners:[{corner:1,position:1},{corner:4,position:10}],
 source:'NAR_OFFICIAL_PAST_RACE_RESULT',sourceRef:officialNarPastResultUrl(prior),
 sourceCheckedAt:'2026-11-08T08:40:00+09:00',rankingEffect:'NONE_UNTIL_REVIEWED'}]};
test('actual staged handler input shape can load only same-race preclaim evidence',async()=>{
 let record;
 const store={insertIfAbsent:async r=>{record={...structuredClone(r),captured_at:r.as_of};return {inserted:true};},
  findLatest:async()=>record};
 assert.equal((await stageLocalCornerSnapshot({
  race,officialRunners:official,packet,store,clock:()=>at})).status,'STORED');
 const lookup=makeLocalClaimedCornerLookup({store});
 const out=await lookup({race,verifiedRunners:[{
  horse_no:1,horse_name:'架空馬6',identity_refs:[horseRef],
  recent_runs:[]}]},at+1000);
 assert.equal(out.evidence.length,1);
 assert.equal(out.evidence[0].earlyPos,1);
 assert.equal(out.claimStarted,false);
 assert.equal(await lookup({race,verifiedRunners:[{
  horse_no:1,horse_name:'取り違え',identity_refs:[horseRef],recent_runs:[]}]},at+1000),null);
});
test('missing or untrusted lookup conditions are optional null, not save authorization',async()=>{
 const lookup=makeLocalClaimedCornerLookup({store:{findLatest:async()=>null}});
 assert.equal(await lookup({race,verifiedRunners:[]},at),null);
 assert.equal(await lookup({race,verifiedRunners:[{horse_no:1,horse_name:'a'}]},NaN),null);
 assert.throws(()=>makeLocalClaimedCornerLookup({store:{}}),/PRIVATE_STORE_REQUIRED/);
});
test('staged LOCAL v14 retains original three-key claim and safety gates',()=>{
 const old=readFileSync(new URL('./staged-lab-claimed-context-handler-v13.mjs',import.meta.url),'utf8');
 const staged=readFileSync(new URL('./staged-lab-claimed-context-handler-v14.mjs',import.meta.url),'utf8');
 for(const required of [
  "assertLiveClaim(state,now());",
  "if(!(req.headers.get('content-type')??'').startsWith('application/json'))",
  "Object.keys(input).length!==3",
  "const fresh=await loadState(client,input,now);",
  "JSON.stringify(fresh.race.field_payload)!==JSON.stringify(state.race.field_payload)"
 ]){
  assert.ok(old.includes(required),'legacy guard not found: '+required);
  assert.ok(staged.includes(required),'safety guard lost: '+required);
 }
 assert.ok(staged.includes("verifiedRunners:context.runners"));
 assert.ok(staged.includes("if(typeof preclaimLookup==='function')"));
 assert.ok(staged.includes("use_for_rank:false,use_for_save_gate:false"));
});
