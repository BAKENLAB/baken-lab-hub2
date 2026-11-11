import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareClaimEvidence,jraAsOfArchiveRowsToProvider} from './claim-evidence-readiness.mjs';
import {persistPreclaimEvidence,sanitizePreclaimEvidence} from './claim-evidence-snapshots.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/jra-asof-fukushima10-mini.json',import.meta.url),'utf8'));
const asOf=fixture.asOf,clock=()=>Date.parse(asOf);
async function makeReport(){
 return prepareClaimEvidence({race:fixture.race,officialRunners:fixture.roster,asOf,clock,
 providers:[{id:'ARCHIVE',identity:'VERIFIED',
 load:async()=>jraAsOfArchiveRowsToProvider(fixture.packet)}]});
}
test('real prefreeze history produces market-free immutable-store record',async()=>{
 const report=await makeReport();const rows=[];
 const result=await persistPreclaimEvidence({report,race:fixture.race,
 officialRunners:fixture.roster,circuit:'JRA',clock,
 store:{insertIfAbsent:async row=>{rows.push(row);return {inserted:true};}}});
 assert.equal(result.status,'STORED');
 assert.equal(rows.length,1);
 assert.equal(rows[0].source_kind,'COMBINED');
 assert.equal(rows[0].source_status,'PARTIAL');
 assert.equal(rows[0].data_quality.unverifiedRuns,1);
 assert.equal(rows[0].active_runner_count,2);
 assert.equal(rows[0].official_roster_digest.length,64);
 assert.equal(rows[0].payload_digest.length,64);
 const json=JSON.stringify(rows[0].evidence);
 assert.ok(!json.includes('win_odds'));
 assert.ok(!json.includes('popularity'));
 assert.ok(!json.includes('targetRaceResult'));
 const apr=rows[0].evidence.runners.find(x=>x.horseNo==='8').historicalRuns.find(x=>x.raceDate==='2026-04-26');
 assert.equal(apr.source.identityVerified,false);
});
test('same record can be safely deduplicated by append-only store',async()=>{
 const report=await makeReport();
 const seen=new Set();
 const store={insertIfAbsent:async row=>{
  if(seen.has(row.payload_digest))return {inserted:false};
  seen.add(row.payload_digest);return {inserted:true};
 }};
 const params={report,race:fixture.race,officialRunners:fixture.roster,circuit:'JRA',clock,store};
 assert.equal((await persistPreclaimEvidence(params)).status,'STORED');
 assert.equal((await persistPreclaimEvidence(params)).status,'ALREADY_STORED');
});
test('source store outage remains diagnostic and does not break existing normal prediction path',async()=>{
 const report=await makeReport();
 const result=await persistPreclaimEvidence({report,race:fixture.race,
 officialRunners:fixture.roster,circuit:'JRA',clock,
 store:{insertIfAbsent:async()=>{throw new Error('Connection fail');}}});
 assert.equal(result.status,'OPTIONAL_STORE_FAILED');
 assert.equal(result.normalCorePathAllowed,true);
});
test('snapshot refuses post-time insert',async()=>{
 const report=await makeReport();let called=false;
 const result=await persistPreclaimEvidence({report,race:fixture.race,
 officialRunners:fixture.roster,circuit:'JRA',
 clock:()=>Date.parse(fixture.race.postTime)+1000,
 store:{insertIfAbsent:async()=>{called=true;return {inserted:true};}}});
 assert.equal(result.status,'SKIPPED_PAST_POST_OR_INVALID_ASOF');
 assert.equal(called,false);
});
test('snapshot refuses record where horse names or race key differ from official roster',async()=>{
 const report=await makeReport();
 let called=false;
 const result=await persistPreclaimEvidence({report,race:fixture.race,
 officialRunners:fixture.roster.map(x=>x.horseNo===8?{...x,horseName:'別馬'}:x),
 circuit:'JRA',clock,store:{insertIfAbsent:async()=>{called=true;return {inserted:true};}}});
 assert.equal(result.status,'SKIPPED_ROSTER_MISMATCH');
 assert.equal(called,false);
});
test('snapshot refuses future source as-of and never runs the store',async()=>{
 const report=await makeReport();let called=false;
 const result=await persistPreclaimEvidence({report:{...report,asOf:'2026-11-08T00:00:00Z'},
 race:fixture.race,officialRunners:fixture.roster,circuit:'JRA',clock,
 store:{insertIfAbsent:async()=>{called=true;return {inserted:true};}}});
 assert.equal(result.status,'SKIPPED_PAST_POST_OR_INVALID_ASOF');
 assert.equal(called,false);
});
