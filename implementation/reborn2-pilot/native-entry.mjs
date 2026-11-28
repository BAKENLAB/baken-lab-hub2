// Native-only admission boundary. No real data execution or persistence.
// The fixed Work06 shape inspector is NOT an authority or a source parser.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectNativeFacts,supplyContract} from './work06/inspect-native-facts.mjs';
import {ENGINE,sha} from './adapter.mjs';
import {WORK05,WORK05_BLOB,planWork05} from './work05-native-plan.mjs';
export const WORK06='82d72c31f7996b2f0d34971b6d157c34dc3838dc';
export const WORK06_CONTRACT_BLOB='60963aca4678b2debeb431ede06f3c79851111f1';
export const WORK06_INSPECTOR_BLOB='4094e00ff458b7bf305f49e9ce6167fee91681c4';
const exact=(o,k)=>{assert.ok(o&&typeof o==='object'&&!Array.isArray(o),'OBJECT_REQUIRED');assert.deepEqual(Object.keys(o).sort(),[...k].sort(),'UNEXPECTED_NATIVE_FIELDS');};
const gitBlob=p=>{const b=readFileSync(new URL(p,import.meta.url));return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');};
assert.equal(gitBlob('./work06/native-fact-contract.json'),WORK06_CONTRACT_BLOB);
assert.equal(gitBlob('./work06/inspect-native-facts.mjs'),WORK06_INSPECTOR_BLOB);
assert.equal(supplyContract.engineCommit,ENGINE);assert.equal(supplyContract.work05.commit,WORK05);
assert.equal(supplyContract.work05.blob,WORK05_BLOB);
assert.equal(supplyContract.items.length,115);
assert.equal(new Set(supplyContract.items.map(x=>x.id)).size,115);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
freeze(supplyContract);
export const NATIVE_ADMISSION_POLICY=freeze({
 schema:'REBORN2_NATIVE_ADMISSION_POLICY_1',engineCommit:ENGINE,work06:WORK06,
 publicRequest:['schema','circuit','work06Commit','contractBlob','inspectorBlob'],
 authorityRequirements:['MAIN_APPROVAL_AND_SOURCE_RIGHTS_SCOPE','INDEPENDENT_NATIVE_EVENT_ALIAS_AND_ROW_WITNESSES','COMPLETE_SOURCE_VERSION_AND_DEPENDENCY_INVENTORY','INDEPENDENT_COMPLETE_ROSTER_STATUS','ORIGINAL_OR_APPROVED_EQUIVALENT_CUSTODY','INDEPENDENT_PRESTART_TIMESTAMP','PROTECTED_SHARED_REGISTRY_AND_SIGNER'],
 full:{required:['verified full roster including historical opponents','official conditions and effective geometry/class versions','individual measured crossing clocks and distance ranks','validated historical finish clocks and race-level laps','independent complete evidence graph','reviewed real kernel admission boundary'],state:'BLOCKED_FIXED_SYNTHETIC_INTAKE_AND_MISSING_REQUIRED_FIELDS'},
 partial:{availableFields:supplyContract.package.horseFields.concat(supplyContract.package.eventFields),state:'BLOCKED_REAL_BOUNDARY_AND_AUTHORITY',grade:'UNASSESSED',winPaths:[],placePaths:[]},
 canonicalIdentity:['engineCommit','issuer','canonicalNativeRaceId'],oneInitialPrediction:true,
 timestampBinds:['canonicalRaceKey','engineCommit','adapterPin','sourcePackageDigest','verifiedRosterDigest','dependencyGraphDigest','outputDigest','archiveManifestDigest','analysisAt','cutoff','startLower'],
 actualExecutionAllowed:false,realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false
});
export function inspectNativeAdmissionRequest(q){
 exact(q,NATIVE_ADMISSION_POLICY.publicRequest);assert.equal(q.schema,'REBORN2_NATIVE_ADMISSION_PREFLIGHT_1');
 assert.equal(q.work06Commit,WORK06,'WORK06_PIN');
 assert.equal(q.contractBlob,WORK06_CONTRACT_BLOB,'WORK06_CONTRACT_PIN');
 assert.equal(q.inspectorBlob,WORK06_INSPECTOR_BLOB,'WORK06_INSPECTOR_PIN');
 const work05=planWork05(q.circuit);
 return {state:'HELD_REAL_ADMISSION',scope:'METADATA_ONLY',circuit:q.circuit,policy:NATIVE_ADMISSION_POLICY,work05,items:supplyContract.items,admitted:0,joined:0,realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false};
}
// For a separately authorized isolated operator's *structural* inspection.
// This routine never fetches, trusts proof refs, emits observation values,
// persists data, creates a TEST packet or invokes the engine.
// It is intentionally not routed from submitAnalysis; no approved source
// or trust registry exists in this branch.
export function inspectNativeStructureOffline(p){
 const base=inspectNativeFacts(p);
 const tuple=new Set(),horseByEventNo=new Map(),docVersions=new Set(),superseded=new Set();
 const id=(...a)=>JSON.stringify(a);
 for(const e of p.events){
  const k=id(e.issuer,e.venueId,e.dateJst,e.raceNo);
  assert.ok(!tuple.has(k),'UNVERIFIED_EVENT_ALIAS_OR_DUPLICATE_TUPLE');tuple.add(k);
  assert.ok(!e.nativeId.startsWith('TEST:'),'RESEARCH_ID_FORBIDDEN');
 }
 const target=p.events.find(e=>e.id===p.targetId);
 const docById=new Map(p.documents.map(d=>[d.id,d]));
 for(const d of p.documents){
  const k=id(d.eventId,d.sourceRef,d.version);assert.ok(!docVersions.has(k),'DUPLICATE_SOURCE_VERSION');docVersions.add(k);
  if(d.supersedes!==null){assert.ok(!superseded.has(d.supersedes),'CORRECTION_LINEAGE_FORK');superseded.add(d.supersedes);}
 }
 for(const o of p.observations){
  if(o.horseId!==null)assert.ok(!o.horseId.startsWith('TEST:'),'RESEARCH_HORSE_ID_FORBIDDEN');
  if(o.pastHorseNo!==null){const k=id(o.eventId,o.pastHorseNo);const prior=horseByEventNo.get(k);assert.ok(prior===undefined||prior===o.horseId,'PAST_NUMBER_MULTIPLE_HORSE_IDS');horseByEventNo.set(k,o.horseId);}
  const roots=new Set();
  for(const root of o.roots){const k=id(root.documentId,root.rowPointer,root.field,root.proofRef);assert.ok(!roots.has(k),'DUPLICATE_ROOT');roots.add(k);}
  // Do not choose a later value or discard old roots on shape alone.
  // Supersession proof, official aliases, source values and rights remain held.
 }
 const missingRoster=p.roster.filter(h=>h.status==='UNKNOWN'||!p.observations.some(o=>o.eventId===p.targetId&&o.horseId===h.horseId&&o.field==='status'&&o.state==='OBSERVED')).length;
 const conditions=['surfaceLiteral','distanceM','directionLiteral','goingLiteral','classLiteral','declaredCount'];
 const missingConditions=conditions.filter(f=>!p.observations.some(o=>o.eventId===p.targetId&&o.horseId===null&&o.field===f&&o.state==='OBSERVED'));
 const declared=p.observations.find(o=>o.eventId===p.targetId&&o.field==='declaredCount'&&o.state==='OBSERVED');
 // Work06 does not define whether declaredCount excludes cancellations:
 // report mismatch, never infer that roster is complete.
 const countMismatch=declared?declared.value!==p.roster.length:null;
 return {...base,scope:'STRUCTURAL_INSPECTION_ONLY',packageDigest:sha(p),targetIdentityCandidate:sha([ENGINE,target.issuer,target.nativeId]),missingRosterStatus:missingRoster,missingConditions,countMismatch,
  full:{state:'HELD',missing:supplyContract.package.heldByDefault},
  partial:{state:'HELD_UNVERIFIED_SOURCE',grade:'UNASSESSED',winPaths:[],placePaths:[]},
  blockers:[...base.blockers,'INDEPENDENT_ALIAS_WITNESSES_AND_DEPENDENCY_GRAPH','APPROVED_TYPED_LITERAL_PARSER','MAIN_APPROVAL_REQUIRED'],
  realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false};
}
// No caller-provided 'approved' flag, signature or fixture conversion
// can invoke the frozen synthetic verifier through the native route.
export function rejectNativeExecution(){throw new Error('NATIVE_EXECUTION_CLOSED_MAIN_APPROVAL_AND_REVIEWED_KERNEL_BOUNDARY_REQUIRED');}
