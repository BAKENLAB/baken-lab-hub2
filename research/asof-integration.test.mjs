import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareClaimEvidence,jraAsOfArchiveRowsToProvider} from './claim-evidence-readiness.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/jra-asof-fukushima10-mini.json',import.meta.url),'utf8'));
function runFixture(asOf=fixture.asOf){
  return prepareClaimEvidence({
    race:fixture.race,
    officialRunners:fixture.roster,
    asOf,
    clock:()=>Date.parse(asOf),
    providers:[{
      id:'JRA_ARCHIVED_ASOF',
      identity:'VERIFIED',
      load:async()=>jraAsOfArchiveRowsToProvider(fixture.packet)
    }]
  });
}
test('real DB fixture: JRA prefreeze as-of archive reconciles two actual named runners',async()=>{
 const out=await runFixture();
 assert.equal(out.rosterCount,2);
 assert.equal(out.fieldCoverage.anyHistory,2);
 assert.equal(out.fieldCoverage.position,2);
 assert.equal(out.fieldCoverage.laps,2);
 assert.equal(out.sourceReports[0].status,'OK');
 assert.equal(out.saveAuthorizedByThisModule,false);
});
test('real DB fixture: missing horse_ref 2026-04-26 win is retained UNVERIFIED and not silently promoted',async()=>{
 const out=await runFixture();
 const horse=out.runners.find(r=>r.horseNo==='8');
 const apr=horse.runs.find(r=>r.raceDate==='2026-04-26');
 assert.ok(apr);
 assert.equal(apr.finish,1);
 assert.equal(apr.track,'福島');
 assert.equal(apr.distance,1200);
 assert.equal(apr.earlyPos,1);
 assert.equal(apr.provenance.identity,'NAME_ONLY_UNVERIFIED');
 assert.equal(apr.provenance.identityVerified,false);
 assert.equal(apr.provenance.sourceTimestampVerified,false);
 assert.equal(horse.runs.find(r=>r.raceDate==='2025-11-15').provenance.identityVerified,true);
});
test('real DB fixture: archive checked after historical asOf is excluded',async()=>{
 const out=await runFixture('2026-09-01T00:00:00+00:00');
 assert.equal(out.fieldCoverage.anyHistory,0);
 assert.equal(out.optionalProviderFailures,0);
 assert.equal(out.runners[0].evidenceStatus,'NO_HISTORY');
});
test('real DB fixture: false after-race historical row is blocked even if archive metadata is early',async()=>{
 const rows=jraAsOfArchiveRowsToProvider(fixture.packet);
 rows[0].runs.push({...rows[0].runs[0],raceDate:'2026-11-07',identityStatus:'HORSE_REF_MATCH'});
 const out=await prepareClaimEvidence({race:fixture.race,asOf:fixture.asOf,officialRunners:fixture.roster,
   clock:()=>Date.parse(fixture.asOf),providers:[{id:'JRA_ARCHIVE_ASOF',identity:'VERIFIED',load:async()=>rows}]});
 assert.equal(out.runners.find(r=>r.horseNo==='5').counts.historicalRuns,2);
});
