// Work04 metadata-only handshake. No raw access, no real engine bypass.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSupplyPlan} from './work02-supply-plan.mjs';
import {executeVerifiedSupply,ENGINE,sha} from './adapter.mjs';
import {planWork05,WORK05,WORK05_BLOB,WORK05_DIGEST} from './work05-native-plan.mjs';
import {inspectNativeAdmissionRequest,rejectNativeExecution} from './native-entry.mjs';
import {executeNativePartial,executeNativeFull,executeWork07NativePartial,executeWork08NativePartial} from './native-partial-runtime.mjs';
import {issueNativeGraph,reviewAllHorses,runNormalReview} from './native-graph-issuance.mjs';
export const WORK04='fe0857f8590e06377273d922461217796dcd61a6';
export const sourceMap=JSON.parse(readFileSync(new URL('./work04-source-map.json',import.meta.url),'utf8'));
assert.equal(sourceMap.engine,ENGINE);assert.equal(sourceMap.scope,'METADATA_ONLY');assert.equal(sourceMap.items.length,115);assert.equal(sourceMap.counts.admitted,0);assert.equal(sourceMap.engineInput,null);assert.equal(sourceMap.realAdmission,false);
const exact=(x,k)=>assert.deepEqual(Object.keys(x).sort(),[...k].sort(),'UNEXPECTED_INTAKE_FIELDS');
export const realContract=Object.freeze({
 schema:'REBORN2_WORK04_REAL_INTAKE_1',
 target:['issuer','venueNativeId','dateJst','raceNo','nativeRaceId','officialPost','startLower','completeRoster'],
 roster:['nativeHorseId','horseNo','gate','weightG','status','statusProofRef'],
 historical:['nativeRaceId','nativeHorseId','pastHorseNo','status','finish','finishClockLiteral','marginLiteral','final600Ms','cornerGroupSlots','leaderLapSlots','context','refs'],
 context:['surface','distanceM','going','direction','venueNativeId','classLiteral','courseVersion'],
 provenance:['nativeSourceId','documentId','rowPointer','field','value','dependencies','publishedAt','updatedAt','capturedAt','version','sha256','permissionRef'],
 joinRules:['JRA stable key is candidate only: non-null extracted key + independent official native horse and event witness','JRA accessS vs pw01 requires validated event crosswalk; no date/track equivalence','LOCAL preclaim packet.evidence array, linkedRunEvidence is count; roster and payload digests; as_of/captured_at/post and sourceCheckedAt bound','LOCAL horse_runs has no native horse ID; hold without verified prior race+pastHorseNo+horseRef','dedup issuer/native race/native horse/version; conflicting duplicates held'],
 missing:['individual checkpoint clocks','exact distance ranks','normalized clock unless certified','status unless proven','effective course geometry'],
 prohibited:['odds','market','popularity','target result','legacy score','TOP5','name-only identity','fabricated clocks']
});
export function inspectWork04(input){
 exact(input,['schema','manifest','work04Commit','mapDigest']);
 assert.equal(input.schema,realContract.schema);assert.equal(input.work04Commit,WORK04);assert.equal(input.mapDigest,sha(sourceMap),'WORK04_MAP_PIN');
 const plan=prepareSupplyPlan(input.manifest),nativeJoin=planWork05(input.manifest.circuit);
 return {state:'HELD_REAL_ADMISSION',work04Commit:WORK04,engineCommit:ENGINE,mapDigest:sha(sourceMap),plan,nativeJoin,contract:realContract,items:sourceMap.items.map(x=>({id:x.id,name:x.name,group:x.group,route:sourceMap.routes[x.group]??[],availability:input.manifest.circuit==='JRA'?x.jra:x.local,state:'HELD'})),blockers:[...plan.inspection.blockers,...nativeJoin.blockers,'WORK04_METADATA_ONLY_NO_ADMITTED_PACKET','FROZEN_V48_REAL_ADAPTER_NOT_APPROVED'],realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false};
}
// Explicit Work05 metadata handshake. No row/evidence payload is accepted.
export function inspectWork05(input){
 exact(input,['schema','work05Commit','work05Blob','work05Digest','work04']);
 assert.equal(input.schema,'REBORN2_WORK05_NATIVE_PREFLIGHT_1');
 assert.equal(input.work05Commit,WORK05,'WORK05_COMMIT_PIN');
 assert.equal(input.work05Blob,WORK05_BLOB,'WORK05_BLOB_PIN');
 assert.equal(input.work05Digest,WORK05_DIGEST,'WORK05_DIGEST_PIN');
 const prior=inspectWork04(input.work04);
 return {...prior,work05Commit:WORK05,work05Blob:WORK05_BLOB,work05Digest:WORK05_DIGEST};
}
export async function submitAnalysis(input){
 if(input?.schema==='REBORN2_NORMAL_CANDIDATE_REQUEST_1'){exact(input,['schema','request']);return runNormalReview(issueNativeGraph(input.request));}
 if(input?.schema==='REBORN2_NATIVE_GRAPH_REVIEW_REQUEST_1'){exact(input,['schema','request']);return reviewAllHorses(issueNativeGraph(input.request));}
 if(input?.schema==='REBORN2_NATIVE_ADMISSION_PREFLIGHT_1')return inspectNativeAdmissionRequest(input);
 if(input?.schema==='REBORN2_WORK08_ANALYSIS_REQUEST_1'){exact(input,['schema','mode','signedManifest','raws','approval']);assert.equal(input.mode,'PARTIAL');return executeWork08NativePartial(input.signedManifest,input.raws,input.approval);}
 if(input?.schema==='REBORN2_WORK07_ANALYSIS_REQUEST_1'){exact(input,['schema','mode','signedManifest','raws','approval']);assert.equal(input.mode,'PARTIAL');return executeWork07NativePartial(input.signedManifest,input.raws,input.approval);}
 if(input?.schema==='REBORN2_NATIVE_ANALYSIS_REQUEST_1'){exact(input,['schema','mode','package','approval']);if(input.mode==='PARTIAL')return executeNativePartial(input.package,input.approval);if(input.mode==='FULL')return executeNativeFull();throw new Error('NATIVE_MODE');}
 if(input?.schema==='REBORN2_NATIVE_FACT_PACKAGE_1'||input?.scope==='REAL_NATIVE')return rejectNativeExecution();
 if(input?.schema==='REBORN2_WORK05_NATIVE_PREFLIGHT_1')return inspectWork05(input);
 if(input?.scope==='FIXTURE_ONLY')return executeVerifiedSupply(input);
 // Check only metadata. No source loader, network, DB, CLAIM or permission
 // self-attestation is accepted here, even if the caller supplies a flag.
 return inspectWork04(input);
}
