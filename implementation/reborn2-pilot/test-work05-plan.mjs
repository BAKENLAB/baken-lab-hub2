import assert from 'node:assert/strict';
import {ENGINE,sha,assertFrozenEngine} from './adapter.mjs';
import {WORK04,sourceMap,submitAnalysis} from './work04-intake.mjs';
import {WORK05,WORK05_AUDIT,WORK05_BLOB,WORK05_DIGEST,handoff,nativeContract,planWork05} from './work05-native-plan.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const meta={schema:'REBORN2_REAL_SUPPLY_MANIFEST_1',circuit:'JRA',race:{nativeRaceId:'JRA-DEMO-METADATA',scheduledPost:'2026-11-28T06:00:00.000Z',startLower:'2026-11-28T05:59:00.000Z'},cutoff:'2026-11-28T05:45:00.000Z',sourceDigest:'a'.repeat(64),sourceDocuments:[{documentId:'D1',role:'TARGET_CARD',nativeRaceId:'JRA-DEMO-METADATA',version:1,publishedAt:'2026-11-28T05:10:00.000Z',updatedAt:'2026-11-28T05:10:00.000Z',capturedAt:'2026-11-28T05:20:00.000Z',uncertaintyMs:1000,sha256:'b'.repeat(64),sourcePermissionRef:'UNVERIFIED_TEST_REF'}],permissionEvidence:[],custodyEvidence:[]};
const intake=manifest=>({schema:'REBORN2_WORK04_REAL_INTAKE_1',manifest,work04Commit:WORK04,mapDigest:sha(sourceMap)});

const request=manifest=>({schema:'REBORN2_WORK05_NATIVE_PREFLIGHT_1',work05Commit:WORK05,work05Blob:WORK05_BLOB,work05Digest:WORK05_DIGEST,work04:intake(manifest)});
for(const circuit of ['JRA','LOCAL']){
 const old=await submitAnalysis(intake({...meta,circuit})),out=await submitAnalysis(request({...meta,circuit})),p=out.nativeJoin;
 assert.deepEqual(old.nativeJoin,p);
 assert.equal(out.items.length,115);assert.ok(out.items.every(i=>i.state==='HELD'));
 assert.equal(p.mainAudit,WORK05_AUDIT);assert.equal(p.blob,WORK05_BLOB);assert.equal(p.admitted,0);assert.equal(p.joined,0);
 assert.deepEqual(p.candidateCounts,circuit==='JRA'?handoff.jra.counts:handoff.local.counts);
 for(const x of [out,p]){assert.equal(x.realAdmission,false);assert.equal(x.engineInput,null);assert.equal(x.projectionAllowed,false);assert.equal(x.persistenceAllowed,false);}
 assert.deepEqual(p.nativeContract.dedup.factKey,['issuer','canonicalNativeRaceId','nativeHorseId','field']);
 assert.deepEqual(p.nativeContract.dedup.versionKey,['sourceDocumentId','version','rowPointer','field']);
 assert.ok(p.blockers.includes('INDEPENDENT_OFFICIAL_EVENT_ALIAS_WITNESS'));
 console.log('CODEX03_WORK05_PLAN '+JSON.stringify({circuit,counts:p.candidateCounts,admitted:p.admitted,joined:p.joined,blockers:p.blockers}));
}
const q=request(meta);
for(const [key,value] of [['work05Commit','0'.repeat(40)],['work05Blob','0'.repeat(40)],['work05Digest','0'.repeat(64)],['realAdmission',true],['observations',[]],['nativeRows',[]],['aliasWitnesses',[]]])await assert.rejects(()=>submitAnalysis({...q,[key]:value}));
await assert.rejects(()=>submitAnalysis({...q,work04:{...q.work04,manifest:{...meta,permissionEvidence:[{verified:true}]}}}));
await assert.rejects(()=>submitAnalysis({...q,work04:{...q.work04,manifest:{...meta,custodyEvidence:[{verified:true}]}}}));
assert.throws(()=>{handoff.jra.counts.uniqueEventCandidate=0;},TypeError);
assert.ok(nativeContract.fieldStates.includes('HELD_CONFLICT')&&nativeContract.fieldStates.includes('REJECTED_TARGET_ALIAS'));
console.log('CODEX03_WORK05_METADATA_HANDSHAKE PASS');
