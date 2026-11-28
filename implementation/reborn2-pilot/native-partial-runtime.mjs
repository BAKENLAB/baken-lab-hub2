// Native executable partial runtime; actual use requires an out-of-band
// Main-approved protected authority. No key is installed in this branch.
// Never relabel real rows into research inputs or call synthetic verifiers.
import assert from 'node:assert/strict';
import {createHash,verify,createPublicKey} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ENGINE,sha} from './adapter.mjs';
import {inspectNativeStructureOffline,WORK06} from './native-entry.mjs';
import {supplyContract} from './work06/inspect-native-facts.mjs';
import {computePartial} from './derived-partial-core.mjs';
import {convertExistingWork44,convertApprovedLocal} from '../reborn2-work07/offline-converter.mjs';
import {inspectNativeFacts} from './work06/inspect-native-facts.mjs';
import {convertExistingWork44 as convertWork08Fixture,convertApprovedLocal as convertWork08Local} from '../reborn2-work08/offline-converter.mjs';
export const WORK07='3bd160c01d153f72c9f99a6e4d68eca9652cfcdd';
const exact=(v,k)=>{assert.ok(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...k].sort(),'NATIVE_APPROVAL_FIELDS');};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const authority=Object.freeze({state:'NOT_CONFIGURED',publicKeyPem:null,allowedApprovalDigests:Object.freeze([]),sourceManifestDigests:Object.freeze([])});
const observed='OBSERVED_NATIVE_VERIFIED';
const typedLiteral=(field,v)=>{
 if(['surfaceLiteral','directionLiteral','goingLiteral'].includes(field)){
  const set={surfaceLiteral:['芝','ダート','ダ','障害','TURF','DIRT'],directionLiteral:['右','左','直線','RIGHT','LEFT','STRAIGHT'],goingLiteral:['良','稍重','重','不良','GOOD','YIELDING','SOFT','HEAVY']}[field];
  return typeof v==='string'&&set.includes(v);
 }
 if(field==='finishClockLiteral')return typeof v==='string'&&/^(?:[0-9]{1,2}[:.])?[0-9]{1,2}\.[0-9]{1,3}$/.test(v);
 if(field==='officialMarginLiteral')return typeof v==='string'&&/^(?:ハナ|アタマ|クビ|大差|同着|[0-9]+(?:\s*[0-9]+\/[0-9]+)?|[0-9]+\/[0-9]+)$/.test(v);
 if(field==='cornerPositionsLiteral')return typeof v==='string'&&/^[0-9０-９,，\-ー()（）*＋+\s]+$/.test(v)&&v.length<=128;
 if(['leaderLapSlots','cornerGroupSlots'].includes(field))return Array.isArray(v)&&v.every(x=>x===null||typeof x==='string'&&/^[0-9０-９.,，\-ー()（）*＋+\s]+$/.test(x)&&x.length<=128);
 if(['displayName','classLiteral','courseVersion','sexAge','equipmentLiteral'].includes(field))return typeof v==='string'&&v.length<=128&&!/[<>{}\r\n]/.test(v)&&!/(?:オッズ|人気|TOP5|targetResult|odds)/i.test(v);
 return true; // Work06 shape inspector validates numeric/status fields.
};
const itemIds=supplyContract.items.map(i=>i.id.startsWith('EYE-')?i.id.replace('-',''):'RANK'+i.id);
function authorize(pkg,approval){
 assert.equal(authority.state,'CONFIGURED','MAIN_NATIVE_APPROVAL_NOT_CONFIGURED');
 exact(approval,['payload','signature']);const a=approval.payload;
 exact(a,['schema','engineCommit','work06Commit','packageDigest','rightsVerified','identityVerified','rosterVerified','custodyVerified','versionInventoryVerified','fieldProofs','eventProofs','rosterProofs','rowProofs','validUntil']);
 assert.equal(a.schema,'REBORN2_NATIVE_PARTIAL_APPROVAL_1');assert.equal(a.engineCommit,ENGINE);assert.equal(a.work06Commit,WORK06);assert.equal(a.packageDigest,sha(pkg));
 for(const k of ['rightsVerified','identityVerified','rosterVerified','custodyVerified','versionInventoryVerified'])assert.equal(a[k],true);
 assert.ok(authority.allowedApprovalDigests.includes(sha(a)),'MAIN_APPROVAL_PIN');
 assert.ok(verify(null,Buffer.from(JSON.stringify(a)),createPublicKey(authority.publicKeyPem),Buffer.from(approval.signature,'base64')),'MAIN_APPROVAL_SIGNATURE');
 assert.ok(Date.now()<Date.parse(a.validUntil)&&Date.now()<Date.parse(pkg.startLower),'NATIVE_POST_BOUNDARY');
 return a;
}
// Map each admitted field to a source root whose identity is derived from
// the complete native event, horse, source version, row and field binding.
// Same field with many roots is a single observation, not extra votes.
function compile(pkg,a,{fixture=false,strict=false}={}){
 const obsState=fixture?'OBSERVED_TEST_FORMAT':observed;
 const eventMap=new Map(pkg.events.map(e=>[e.id,e])),docs=new Map(pkg.documents.map(d=>[d.id,d]));
 const roots=new Map(),events=new Map(),byHorseNo=new Map();
 const add=(kind,payload,depends=[])=>{const id=sha([kind,payload,depends]);if(!roots.has(id))roots.set(id,{id,kind,payload,depends});return id;};
 const fieldProofs=new Map(a.fieldProofs.map(x=>[x.key,x]));
 const eventProofs=new Map(a.eventProofs.map(x=>[x.eventId,x]));
 const rosterProofs=new Map(a.rosterProofs.map(x=>[x.horseId,x]));
 assert.equal(fieldProofs.size,a.fieldProofs.length);assert.equal(eventProofs.size,a.eventProofs.length);assert.equal(rosterProofs.size,a.rosterProofs.length);
 for(const e of pkg.events){
  const proof=eventProofs.get(e.id);assert.ok(proof&&proof.identityDigest===sha(e),'OFFICIAL_EVENT_PROOF_BINDING');
  const id=add(fixture?'FIXTURE_EVENT':'VERIFIED_NATIVE_EVENT',e);
  events.set(e.id,{eventId:e.id,role:e.role,nativeRaceIdentity:{issuer:e.issuer,nativeId:e.nativeId,venueId:e.venueId,dateJst:e.dateJst,raceNo:e.raceNo},observations:{},rows:[],eventRoot:id});
 }
 const target=events.get(pkg.targetId);
 for(const h of pkg.roster){
  const proof=rosterProofs.get(h.horseId);assert.ok(proof&&proof.identityDigest===sha(h),'OFFICIAL_ROSTER_PROOF_BINDING');
  const rid=add(fixture?'FIXTURE_ROSTER':'VERIFIED_NATIVE_ROSTER',h,[target.eventRoot]);
  const row={nativeId:h.horseId,observations:{no:{state:obsState,value:h.horseNo,evidenceId:rid}},unavailable:[]};target.rows.push(row);
  byHorseNo.set(JSON.stringify([pkg.targetId,h.horseId]),row);
 }
 const missing=[],rowProofs=new Map((a.rowProofs??[]).map(x=>[JSON.stringify([x.eventId,x.horseId]),x]));
 const observedRows=new Set(pkg.observations.filter(x=>x.state==='OBSERVED'&&x.horseId!==null).map(x=>JSON.stringify([x.eventId,x.horseId])));
 for(const o of pkg.observations){
  const event=events.get(o.eventId),e=eventMap.get(o.eventId);
  let row=null,obs=event.observations;
  if(o.horseId!==null){
   const k=JSON.stringify([o.eventId,o.horseId]);row=byHorseNo.get(k);
   if(!row){
    assert.equal(e.role,'HISTORICAL_RESULT');
    if(!observedRows.has(k)){missing.push({key:JSON.stringify([o.eventId,o.horseId,o.field]),state:o.state,reason:o.reason});continue;}
    const rowWitness=rowProofs.get(k);
    if(!fixture)assert.ok(rowWitness&&rowWitness.pastHorseNo===o.pastHorseNo&&hex(rowWitness.proofDigest),'HISTORICAL_NATIVE_ROW_PROOF_REQUIRED');
    const rid=add(fixture?'FIXTURE_HISTORICAL_ROW':'VERIFIED_NATIVE_HISTORICAL_ROW',{eventId:o.eventId,horseId:o.horseId,pastHorseNo:o.pastHorseNo,...(rowWitness?{rowWitness}:{})},[event.eventRoot]);
    row={nativeId:o.horseId,observations:{no:{state:obsState,value:o.pastHorseNo,evidenceId:rid}},unavailable:[]};event.rows.push(row);byHorseNo.set(k,row);
   }
   obs=row.observations;
  }
  const key=JSON.stringify([o.eventId,o.horseId,o.field]);
  if(o.state!=='OBSERVED'){obs[o.field]={state:o.state,value:null,reason:o.reason};missing.push({key,state:o.state,reason:o.reason});if(row)row.unavailable.push({field:o.field,state:o.state,reason:o.reason});continue;}
  if(!fixture||strict)assert.ok(typedLiteral(o.field,o.value),'NATIVE_LITERAL_FORMAT '+o.field);
  const proof=fieldProofs.get(key);assert.ok(proof&&proof.observationDigest===sha(o),'VERIFIED_FIELD_BINDING');
  const refs=o.roots.map(root=>{const doc=docs.get(root.documentId);assert.ok(doc&&doc.eventId===o.eventId);const did=add(fixture?'FIXTURE_DOCUMENT':'VERIFIED_NATIVE_DOCUMENT',doc,[event.eventRoot]);return add(fixture?'FIXTURE_FIELD_ROOT':'VERIFIED_NATIVE_FIELD_ROOT',{eventId:o.eventId,horseId:o.horseId,pastHorseNo:o.pastHorseNo,...root},[did]);}).sort();
  const rid=add(fixture?'FIXTURE_OBSERVATION':'VERIFIED_NATIVE_OBSERVATION',{eventId:o.eventId,horseId:o.horseId,field:o.field,value:o.value},refs);
  obs[o.field]={state:obsState,value:o.value,evidenceId:rid};
 }
 // Require every target row to have source-bound status; unknown remains
 // unknown rather than defaulting to ACTIVE. Full roster attestation needed.
 if(!fixture)for(const row of target.rows){const status=row.observations.status,expected=pkg.roster.find(h=>h.horseId===row.nativeId).status;
  if(expected==='UNKNOWN'){assert.ok(status?.state!==observed||status.value==='UNKNOWN','ROSTER_STATUS_NOT_BOUND');}
  else assert.ok(status?.state===observed&&status.value===expected,'ROSTER_STATUS_NOT_BOUND');}
 return {schema:'REBORN2_NATIVE_PARTIAL_OBSERVATIONS_1',scope:fixture?'FIXTURE_COMPILER_MAPPING_TEST_ONLY':'REAL_NATIVE_VERIFIED',target:{eventId:pkg.targetId},cutoff:pkg.cutoff,events:[target,...[...events.values()].filter(e=>e!==target)],roots:[...roots.values()],items:target.rows.map(h=>({horseId:h.nativeId,items:itemIds.map(item=>({item,state:'HELD',reason:'FULL_ITEM_JUDGMENT_NOT_ESTABLISHED'}))})),groups:118,held:826,missing,formal:false};
}
export function executeNativePartial(pkg,approval){
 const a=authorize(pkg,approval); // closed before any material inspection
 const preflight=inspectNativeStructureOffline(pkg);
 assert.equal(preflight.countMismatch,false,'NATIVE_ROSTER_COUNT_UNVERIFIED');
 const p=compile(pkg,a),runners=computePartial(p,{native:true});
 return {schema:'REBORN2_NATIVE_PARTIAL_ANALYSIS_1',scope:p.scope,engineCommit:ENGINE,sourceDigest:sha(p),sourcePacket:p,runners,formal:false,gradeAuthority:false,persistenceAllowed:false,realAdmission:false};
}
// Explicit development-only transformation exercise using a previously
// verified fixture packet, never accepting native material or producing a
// native admission receipt. Map real-shaped fields using existing values.
export function exerciseFixtureObservationCompiler(verifiedFixturePacket){
 assert.equal(verifiedFixturePacket.scope,'SYNTHETIC_OFFICIAL_FORMAT_TEST');
 const p=verifiedFixturePacket;const pkg={events:[],roster:[],documents:[],observations:[],targetId:p.target.eventId,cutoff:p.cutoff};
 const a={fieldProofs:[],eventProofs:[],rosterProofs:[]};
 // The fixture graph is used as the original witness in this test only.
 for(const e of p.events){
  const event={id:e.eventId,issuer:'TEST:WORK44',nativeId:e.eventId,venueId:e.nativeRaceIdentity.venueId,role:e.role};
  pkg.events.push(event);a.eventProofs.push({eventId:event.id,identityDigest:sha(event)});
  const doc={id:'fixture-document:'+e.eventId,eventId:e.eventId,fixtureRootDigest:sha(p.roots)};pkg.documents.push(doc);
  const addObs=(o,field,horseId,pastHorseNo)=>{
   if(field==='no'||!supplyContract.package.eventFields.concat(supplyContract.package.horseFields).includes(field))return;
   if(o.state!=='OBSERVED_TEST_FORMAT')return;
   const obs={eventId:e.eventId,horseId,pastHorseNo,field,state:'OBSERVED',value:o.value,reason:null,roots:[{documentId:doc.id,rowPointer:o.evidenceId,field,proofRef:o.evidenceId}]};
   pkg.observations.push(obs);a.fieldProofs.push({key:JSON.stringify([e.eventId,horseId,field]),observationDigest:sha(obs)});
  };
  for(const [field,o] of Object.entries(e.observations))addObs(o,field,null,null);
  for(const h of e.rows){
   if(e.role==='TARGET_CARD'){const row={horseId:h.nativeId,horseNo:h.observations.no.value,status:'UNKNOWN'};pkg.roster.push(row);a.rosterProofs.push({horseId:row.horseId,identityDigest:sha(row)});
    // Fixture source has unknown status; no invented status observation.
   }
   for(const [field,o] of Object.entries(h.observations))addObs(o,field,h.nativeId,e.role==='TARGET_CARD'?null:h.observations.no.value);
  }
 }
 const compiled=compile(pkg,a,{fixture:true});
 return {scope:'FIXTURE_COMPILER_MAPPING_TEST_ONLY',eventCount:pkg.events.length,rosterCount:pkg.roster.length,observationCount:pkg.observations.length,fields:[...new Set(pkg.observations.map(o=>o.field))],runners:computePartial(compiled),compiled,realAdmission:false};
}
export function executeNativeFull(){throw new Error('FULL_NATIVE_KERNEL_DEPENDENCY_ON_SYNTHETIC_PACKET_NOT_REVIEWED');}

// Actual Work07 handoff: no caller key or digest is trusted as authority.
// A future reviewed protected configuration must supply the pinned manifest
// and approval, separately. Before that, not even raw source conversion runs.
export function executeWork07NativePartial(signed,raws,approval){
 assert.equal(authority.state,'CONFIGURED','MAIN_NATIVE_APPROVAL_NOT_CONFIGURED');
 const manifestDigest=sha(signed.payload);
 assert.ok(authority.sourceManifestDigests.includes(manifestDigest),'WORK07_MANIFEST_AUTHORITY_PIN');
 const converted=convertApprovedLocal(signed,raws,{authorityPublicKeyPem:authority.publicKeyPem,expectedManifestSha256:manifestDigest});
 assert.equal(converted.scope,'LOCAL_EXTRACTION_NOT_ADMISSION');
 const result=executeNativePartial(converted.package,approval);
 return {...result,work07Commit:WORK07,sourceStates:converted.sourceStates,sourceManifestDigest:manifestDigest};
}
// Existing fixed Work44 bytes only, actual Work07 parser and Work06 complete
// schema validation. Never mint native authority or native state from tests.
export function exerciseWork07EndToEnd(bundle,trust){
 const x=convertExistingWork44(bundle,trust),pkg=x.package;
 assert.equal(x.scope,'EXISTING_WORK44_FIXTURE_CONVERSION_ONLY');
 assert.deepEqual(inspectNativeFacts(pkg),x.inspection);
 const a={eventProofs:pkg.events.map(e=>({eventId:e.id,identityDigest:sha(e)})),rosterProofs:pkg.roster.map(h=>({horseId:h.horseId,identityDigest:sha(h)})),fieldProofs:pkg.observations.filter(o=>o.state==='OBSERVED').map(o=>({key:JSON.stringify([o.eventId,o.horseId,o.field]),observationDigest:sha(o)}))};
 const p=compile(pkg,a,{fixture:true,strict:true});
 const runners=computePartial(p,{strictMissing:true});
 return {scope:'EXISTING_WORK44_WORK07_ANALYSIS_TEST_ONLY',work07Commit:WORK07,package:pkg,inspection:x.inspection,sourceStates:x.sourceStates,sourcePacket:p,runners,formal:false,realAdmission:false,persistenceAllowed:false};
}

 // Work08 uses the corrected converter; the original Work07 exercise remains
 // independently runnable. Never accept a caller-supplied fixture package.
 export function exerciseWork08EndToEnd(bundle,trust){
  const x=convertWork08Fixture(bundle,trust),pkg=x.package;
  assert.equal(x.scope,'EXISTING_WORK44_FIXTURE_CONVERSION_ONLY');
  assert.deepEqual(inspectNativeFacts(pkg),x.inspection);
  const a={eventProofs:pkg.events.map(e=>({eventId:e.id,identityDigest:sha(e)})),rosterProofs:pkg.roster.map(h=>({horseId:h.horseId,identityDigest:sha(h)})),fieldProofs:pkg.observations.filter(o=>o.state==='OBSERVED').map(o=>({key:JSON.stringify([o.eventId,o.horseId,o.field]),observationDigest:sha(o)}))};
  const p=compile(pkg,a,{fixture:true,strict:true});
  return {scope:'EXISTING_WORK44_WORK08_ANALYSIS_TEST_ONLY',package:pkg,inspection:x.inspection,sourceStates:x.sourceStates,sourcePacket:p,runners:computePartial(p,{strictMissing:true}),formal:false,realAdmission:false,persistenceAllowed:false};
 }
 export function executeWork08NativePartial(signed,raws,approval){
  assert.equal(authority.state,'CONFIGURED','MAIN_NATIVE_APPROVAL_NOT_CONFIGURED');
  const manifestDigest=sha(signed.payload);
  assert.ok(authority.sourceManifestDigests.includes(manifestDigest),'WORK08_MANIFEST_AUTHORITY_PIN');
  const x=convertWork08Local(signed,raws,{authorityPublicKeyPem:authority.publicKeyPem,expectedManifestSha256:manifestDigest});
  assert.equal(x.scope,'LOCAL_EXTRACTION_NOT_ADMISSION');
  return {...executeNativePartial(x.package,approval),sourceStates:x.sourceStates,sourceManifestDigest:manifestDigest};
 }
