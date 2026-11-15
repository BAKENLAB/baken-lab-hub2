import test from 'node:test';
import assert from 'node:assert/strict';
import {planJraIncidentBatch as plan,runJraIncidentBatch as batch} from '../automation/jra-incident-batch-research.mjs';
const ref='/JRADB/accessS.html?CNAME=pw01sde1003202502060120250713/BF';
const url='https://www.jra.go.jp'+ref,checked='2026-11-15T07:50:00+09:00';
const targetRace={raceDate:'2026-11-15',postTime:'2026-11-15T12:00:00+09:00'};
const clock=()=>Date.parse('2026-11-15T08:00:00+09:00');
const officialRunners=[{horse_no:7,horse_name:'試験A',horse_ref:'/JRADB/accessU.html?CNAME=pw01dud102023103702/53',status:'ACTIVE'},{horse_no:8,horse_name:'試験B',horse_ref:'/JRADB/accessU.html?CNAME=pw01dud102023106608/A1',status:'ACTIVE'}];
const prior={race_date:'2025-07-13',source_ref:ref};
const liveRunners=officialRunners.map(h=>({...h,past_runs:[prior]}));
const pi={independentlyVerified:true,priorRace:{raceDate:prior.race_date,track:'福島',raceNo:1,raceKey:'20250713_福島_1R',sourceRef:ref},expectedRoster:officialRunners.map((h,i)=>({horseNo:i+1,horseName:h.horse_name,horseRef:h.horse_ref}))};
const args={targetRace,clock,officialRunners,liveRunners,priorRaceInputs:[pi]};
const packet={verified:true,status:'EXPLICIT_NO_RECORDED_INCIDENTS',source_kind:'RESULT',race_date:prior.race_date,race_key:pi.priorRace.raceKey,source_ref:url,source_checked_at:checked,roster_ids:['2023103702','2023106608'],events:[]};
test('shared prior race fetches once and attributes by stable IDs to both horses',async()=>{
 const p=plan(args);assert.equal(p.unique_prior_races,1);assert.equal(p.expected_runs,2);assert.equal(p.items[0].links.length,2);
 let calls=0;const x=await batch({...args,acquire:async()=>{calls++;return {verified:true,packets:[packet]}}});
 assert.equal(calls,1);assert.equal(x.incident_review.coverage.verified_source_runs,2);assert.equal(x.incident_review.coverage.not_supplied_slots,8);
 assert.equal(x.rank_effect,'NONE');assert.equal(x.prediction_saved,false);
});
test('missing, conflicting, or mislabeled independent roster does not fetch',async()=>{
 for(const supplied of [[],[pi,pi],[{...pi,independentlyVerified:false}],[{...pi,expectedRoster:pi.expectedRoster.slice(0,1)}],[{...pi,reportRef:'https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw2fsrp1003202502060120250714/4A'}]]){
  const x=await batch({...args,priorRaceInputs:supplied,acquire:async()=>{throw Error('must not fetch')}});
  assert.equal(x.attempted_prior_races,0);assert.equal(x.incident_review.coverage.unverified_runs,2);
 }
});
test('same horse repeated history is tracked, not additionally fetched',()=>{
 const p=plan({...args,liveRunners:[{...liveRunners[0],past_runs:[prior,prior]},liveRunners[1]]});
 assert.equal(p.duplicate_runs,1);assert.equal(p.items.length,1);assert.equal(p.items[0].links.length,2);
});
test('post deadline and wrong-race response do not count as verified',async()=>{
 assert.equal(plan({...args,clock:()=>Date.parse(targetRace.postTime)}).status,'UNVERIFIED_FIELD_OR_DEADLINE');
 const x=await batch({...args,acquire:async()=>({verified:true,packets:[{...packet,source_ref:url.replace('20250713','20250714')}]})});
 assert.equal(x.incident_review.coverage.verified_source_runs,0);
 assert.equal(x.receipts[0].status,'PACKET_UNVERIFIED');
});

test('unavailable source receipt preserves bounded reason codes without claiming coverage',async()=>{
 const x=await batch({...args,acquire:async()=>({verified:false,status:'INCIDENT_SOURCES_UNAVAILABLE',failures:['INCIDENT_SECTION_UNAVAILABLE','REPORT_LINK_NOT_VERIFIED','<html>not a status</html>']})});
 assert.equal(x.incident_review.coverage.verified_source_runs,0);
 assert.deepEqual(x.receipts[0].failures,['INCIDENT_SECTION_UNAVAILABLE','REPORT_LINK_NOT_VERIFIED']);
});

const timing={status:'OFFICIAL_RACE_LAPS_VERIFIED',verified:true,scope:'SAME_VERIFIED_RESULT_HTML_RACE_WIDE',source_ref:url,source_checked_at:checked,race_date:prior.race_date,track:'福島',race_no:1,surface:'芝',distance:1200,lap_seconds:[12.4,10.9,11.4,12.1,11.8,13.1],segment_distances_m:[200,200,200,200,200,200],first_600m_seconds:34.7,last_600m_seconds:37,market_used:false,rank_effect:'NONE'};
const timingArgs={...args,priorRaceInputs:[{...pi,priorRace:{...pi.priorRace,distance:1200,surface:'芝'}}]};
test('verified race-wide timing survives absent incident section with independent coverage',async()=>{
 const x=await batch({...timingArgs,acquire:async()=>({verified:false,status:'INCIDENT_SOURCES_UNAVAILABLE',lap_observation:timing})});
 assert.equal(x.incident_review.coverage.verified_source_runs,0);
 assert.equal(x.lap_coverage.verified_distinct_races,1);
 assert.equal(x.lap_coverage.linked_prior_runs,2);
 assert.equal(x.lap_coverage.supplied_prior_runs,2);
 assert.deepEqual(x.lap_packets[0].lap_seconds,timing.lap_seconds);
 assert.equal(x.rank_effect,'NONE');assert.equal(x.prediction_saved,false);
});
test('wrong source/course, invalid segments or future timing is not counted',async()=>{
 for(const p of [{...timing,source_ref:url.replace('20250713','20250714')},{...timing,surface:'ダート'},{...timing,segment_distances_m:[100,200,200,200,200,200]},{...timing,last_600m_seconds:36},{...timing,source_checked_at:'2026-11-15T08:01:00+09:00'}]){
  const x=await batch({...timingArgs,acquire:async()=>({verified:false,lap_observation:p})});
  assert.equal(x.lap_coverage.verified_distinct_races,0);
  assert.equal(x.lap_coverage.linked_prior_runs,0);
 }
});
