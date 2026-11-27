// Work04 metadata-only handshake. No raw access, no real engine bypass.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSupplyPlan} from './work02-supply-plan.mjs';
import {executeVerifiedSupply,ENGINE,sha} from './adapter.mjs';
export const WORK04='e6918e98a46e9de797b11a7a4ef0c116a21ab5cc';
export const sourceMap=JSON.parse(readFileSync(new URL('./work04-source-map.json',import.meta.url),'utf8'));
assert.equal(sourceMap.engine,ENGINE);assert.equal(sourceMap.scope,'METADATA_ONLY');assert.equal(sourceMap.items.length,115);assert.equal(sourceMap.counts.admitted,0);assert.equal(sourceMap.engineInput,null);assert.equal(sourceMap.realAdmission,false);
const exact=(x,k)=>assert.deepEqual(Object.keys(x).sort(),[...k].sort(),'UNEXPECTED_INTAKE_FIELDS');
export const realContract=Object.freeze({
 schema:'REBORN2_WORK04_REAL_INTAKE_1',
 target:['issuer','venueNativeId','dateJst','raceNo','nativeRaceId','officialPost','startLower','completeRoster'],
 roster:['nativeHorseId','horseNo','gate','weightG','status','statusProofRef'],
 historical:['nativeRaceId','nativeHorseId','finish','finishClockLiteral','marginLiteral','final600Ms','cornerGroupSlots','leaderLapSlots','context','refs'],
 context:['surface','distanceM','going','direction','venueNativeId','classLiteral','courseVersion'],
 provenance:['nativeSourceId','documentId','rowPointer','field','value','dependencies','publishedAt','updatedAt','capturedAt','version','sha256','permissionRef'],
 missing:['individual checkpoint clocks','exact distance ranks','normalized clock unless certified','status unless proven','effective course geometry'],
 prohibited:['odds','market','popularity','target result','legacy score','TOP5','name-only identity','fabricated clocks']
});
export function inspectWork04(input){
 exact(input,['schema','manifest','work04Commit','mapDigest']);
 assert.equal(input.schema,realContract.schema);assert.equal(input.work04Commit,WORK04);assert.equal(input.mapDigest,sha(sourceMap),'WORK04_MAP_PIN');
 const plan=prepareSupplyPlan(input.manifest);
 return {state:'HELD_REAL_ADMISSION',work04Commit:WORK04,engineCommit:ENGINE,mapDigest:sha(sourceMap),plan,contract:realContract,items:sourceMap.items.map(x=>({id:x.id,name:x.name,group:x.group,route:sourceMap.routes[x.group]??[],availability:input.manifest.circuit==='JRA'?x.jra:x.local,state:'HELD'})),blockers:[...plan.inspection.blockers,'WORK04_METADATA_ONLY_NO_ADMITTED_PACKET','FROZEN_V48_REAL_ADAPTER_NOT_APPROVED'],realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false};
}
export async function submitAnalysis(input){
 if(input?.scope==='FIXTURE_ONLY')return executeVerifiedSupply(input);
 // Check only metadata. No source loader, network, DB, CLAIM or permission
 // self-attestation is accepted here, even if the caller supplies a flag.
 return inspectWork04(input);
}
