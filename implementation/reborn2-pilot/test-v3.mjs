import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {executeFixtureWithProof,assertFrozenEngine,ENGINE,sha} from './adapter.mjs';
import {submitAnalysis,inspectWork04,sourceMap,WORK04} from './work04-intake.mjs';
import {saveCompact,readManifest,restoreSnapshot,readField} from './compact-store.mjs';
import {makeSealPlan,signFixtureSeal,verifyFixtureSeal,saveFixtureSeal,readFixtureSeal} from './prestart-seal.mjs';
import {pairs,witness,resolvePeer} from './comments-ja.mjs';
import {startPreview} from './mobile-preview.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const meta={schema:'REBORN2_REAL_SUPPLY_MANIFEST_1',circuit:'JRA',race:{nativeRaceId:'JRA-DEMO-METADATA',scheduledPost:'2026-11-28T06:00:00.000Z',startLower:'2026-11-28T05:59:00.000Z'},cutoff:'2026-11-28T05:45:00.000Z',sourceDigest:'a'.repeat(64),sourceDocuments:[{documentId:'D1',role:'TARGET_CARD',nativeRaceId:'JRA-DEMO-METADATA',version:1,publishedAt:'2026-11-28T05:10:00.000Z',updatedAt:'2026-11-28T05:10:00.000Z',capturedAt:'2026-11-28T05:20:00.000Z',uncertaintyMs:1000,sha256:'b'.repeat(64),sourcePermissionRef:'UNVERIFIED_TEST_REF'}],permissionEvidence:[],custodyEvidence:[]};
const intake=manifest=>({schema:'REBORN2_WORK04_REAL_INTAKE_1',manifest,work04Commit:WORK04,mapDigest:sha(sourceMap)});
for(const circuit of ['JRA','LOCAL']){const out=await submitAnalysis(intake({...meta,circuit}));assert.equal(out.items.length,115);assert.ok(out.items.every(x=>x.state==='HELD'));assert.equal(out.engineInput,null);assert.equal(out.persistenceAllowed,false);}
await assert.rejects(()=>submitAnalysis({...intake(meta),realAdmission:true}));
await assert.rejects(()=>submitAnalysis({...intake(meta),mapDigest:'0'.repeat(64)}),/WORK04_MAP_PIN/);
await assert.rejects(()=>submitAnalysis({scope:'FIXTURE_ONLY',mode:'REAL',manifest:meta}));
console.log('CODEX03_WORK04_INTAKE_CLOSED PASS');
const dir=await mkdtemp(join(tmpdir(),'reborn2-codex03-'));
try{
 for(const [name,expected] of [['FK34_FULL',['B','A','UNASSESSED','A','C']],['WORK44_PARTIAL',['UNASSESSED','UNASSESSED']]]){
  const {snapshot:s,sourceProof:proof}=await executeFixtureWithProof(name);
  assert.deepEqual(s.runners.map(h=>h.grade),expected);
  const root=join(dir,name),out=await saveCompact(root,s),m=await readManifest(root,out.manifestDigest);
  assert.equal(sha(await restoreSnapshot(root,m.manifestDigest)),sha(s));
  const rootIds=new Set(proof.mode==='PARTIAL'?proof.packet.roots.map(x=>x.id):proof.packet.evidence.map(x=>x.evidenceId));
  assert.ok(rootIds.size);
  const plan=makeSealPlan(s,m,proof),keys=generateKeyPairSync('ed25519'),signed=signFixtureSeal(plan,keys.privateKey),trust={scope:'LOCAL_FIXTURE_KEY_ONLY',publicKey:keys.publicKey,expectedDigest:plan.digest};
  assert.equal(verifyFixtureSeal(signed,trust,plan).externalTimestampVerified,false);
  const bad=structuredClone(signed);bad.signature=Buffer.alloc(64).toString('base64');assert.throws(()=>verifyFixtureSeal(bad,trust,plan),/SEAL_SIGNATURE/);
  const tamper=structuredClone(proof);tamper.packet={};assert.throws(()=>makeSealPlan(s,m,tamper));
  const file=await saveFixtureSeal(root,m.manifestDigest,proof,signed,trust),read=await readFixtureSeal(root,file,trust);assert.equal(read.verification.verified,true);assert.equal(sha(read.proof),sha(proof));
  await assert.rejects(()=>saveFixtureSeal(root,m.manifestDigest,proof,signed,trust),e=>e.code==='EEXIST');
  console.log('CODEX03_SEAL '+JSON.stringify({name,sourceNodes:rootIds.size,sealBytes:(await readFile(file)).length,localSignature:true,externalTimestamp:false,prospective:false}));
  let checked=0;
  for(const h of m.summary.runners){const original=s.runners.find(x=>x.horseId===h.horseId);
   for(const f of h.findings){if(!f.proof)continue;const p=f.proof;
    if(p.direction){const route=original.paths.find(x=>x.id===f.link.route),w=witness(route,p.direction,s.runners,original);assert.ok(w);assert.equal(w.peer,p.peer);assert.deepEqual(w.intervalMs,p.intervalMs);assert.equal(sha(w.refs),p.refsDigest);assert.ok(p.direction==='support'?p.intervalMs[0]>0:p.intervalMs[1]<0);assert.equal(resolvePeer(w.peer,s.runners,original).name,p.peerName);assert.ok(f.text.includes(p.peerName));checked++;}
    else {const q=original.analysisItems.find(x=>x.item===f.link.item).partialFindings.find(x=>x.event===p.event&&x.type===p.type&&sha(x.refs)===p.refsDigest);assert.ok(q);assert.deepEqual(q.value,p.value);assert.ok(q.refs.every(id=>rootIds.has(id)));checked++;}
   }
  }
  assert.ok(checked>0);
  const preview=await startPreview(root,m.manifestDigest);
  try{
   const list=await (await fetch(preview.url)).text();assert.equal(preview.detailReads(),0);
   const h=m.summary.runners[0].horseId,params=new URLSearchParams({horse:h,field:'analysisItems'});
   const idx=await (await fetch(preview.url+'/detail?'+params)).text();assert.ok(idx.includes('全115分析項目')&&idx.includes('近走成績・着順')&&idx.includes('複数の条件好転の組み合わせ'));
   const links=[...idx.matchAll(/href="([^"]+item=[^"]+)"/g)];assert.equal(links.length,115);
   const q=await (await fetch(preview.url+'/detail?'+params+'&item=RANK06')).text();assert.ok(q.includes('上がりタイム')&&q.includes('証拠原文'));if(name==='WORK44_PARTIAL')assert.ok(q.includes('37.0秒'));
   console.log('CODEX03_DETAIL '+JSON.stringify({name,items:links.length,commentWitnesses:checked,rawBytes:out.rawBytes,objectBytes:out.objectBytes,manifestBytes:out.manifestBytes,summaryBytes:out.summaryBytes,initialHtmlBytes:Buffer.byteLength(list),reconstructed:true}));
  }finally{await new Promise(ok=>preview.server.close(ok));}
 }
 console.log('CODEX03_SOURCE_SEAL_DETAIL PASS');
}finally{await rm(dir,{recursive:true,force:true});}
