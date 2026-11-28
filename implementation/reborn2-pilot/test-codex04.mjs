import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ENGINE,sha,assertFrozenEngine,executeFixtureWithProof} from './adapter.mjs';
import {submitAnalysis} from './work04-intake.mjs';
import {WORK06,WORK06_CONTRACT_BLOB,WORK06_INSPECTOR_BLOB,inspectNativeStructureOffline} from './native-entry.mjs';
import {makeOfflineTimestampQuery,verifyLocalTimestampProtocol,sharedRegistryPlan} from './native-custody.mjs';
import {saveCompact,readManifest,restoreSnapshot,readField} from './compact-store.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
for(const circuit of ['JRA','LOCAL']){
 const q={schema:'REBORN2_NATIVE_ADMISSION_PREFLIGHT_1',circuit,work06Commit:WORK06,contractBlob:WORK06_CONTRACT_BLOB,inspectorBlob:WORK06_INSPECTOR_BLOB};
 const p=await submitAnalysis(q);assert.equal(p.items.length,115);assert.equal(p.admitted,0);
 assert.equal(p.policy.full.state,'BLOCKED_FIXED_SYNTHETIC_INTAKE_AND_MISSING_REQUIRED_FIELDS');assert.equal(p.policy.partial.grade,'UNASSESSED');
 for(const k of ['realAdmission','projectionAllowed','persistenceAllowed'])assert.equal(p[k],false);
 assert.equal(p.engineInput,null);await assert.rejects(()=>submitAnalysis({...q,observations:[]}));await assert.rejects(()=>submitAnalysis({...q,mainApproved:true}));await assert.rejects(()=>submitAnalysis({...q,contractBlob:'0'.repeat(40)}));
}
await assert.rejects(()=>submitAnalysis({schema:'REBORN2_NATIVE_FACT_PACKAGE_1'}),/NATIVE_EXECUTION_CLOSED/);
assert.throws(()=>inspectNativeStructureOffline({schema:'REBORN2_NATIVE_FACT_PACKAGE_1'}),/UNEXPECTED_KEYS/);
assert.equal(sharedRegistryPlan.realWritesAllowed,false);
console.log('CODEX04_NATIVE_ENTRY_CLOSED PASS');
const dir=await mkdtemp(join(tmpdir(),'codex04-protocol-'));
try{
 // Existing fixed partial fixture, not a new research race.
 const a=(await executeFixtureWithProof('WORK44_PARTIAL')).snapshot;
 const original=sha(a),root=join(dir,'race');
 const pending=saveCompact(root,a);
 // Mutate caller object after save reached its first await. The captured
 // engine-issued bytes must remain exact.
 const old=a.runners[0].name,oldHash=a.snapshotDigest;
 a.runners[0].name='MUTATED_AFTER_ENTRY';const {snapshotDigest,...body}=a;a.snapshotDigest=sha(body);
 const out=await pending;const restored=await restoreSnapshot(root,out.manifestDigest);
 assert.equal(sha(restored),original,'TOCTOU_POISONED_COMMIT');
 a.runners[0].name=old;a.snapshotDigest=oldHash;
 const m=await readManifest(root,out.manifestDigest);
 assert.throws(()=>{m.summary.runners[0].grade='S';},TypeError);
 assert.throws(()=>{m.rows[0].fields[0].digest='0'.repeat(64);},TypeError);
 assert.equal(sha(await restoreSnapshot(root,out.manifestDigest)),original);
 const b=(await executeFixtureWithProof('WORK44_PARTIAL')).snapshot;
 const root2=join(dir,'concurrent');
 const results=await Promise.allSettled([saveCompact(root2,a),saveCompact(root2,b)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'EEXIST');
 assert.equal((await readdir(join(root2,'identities'))).length,1);
 const winner=results.find(x=>x.status==='fulfilled').value;
 await restoreSnapshot(root2,winner.manifestDigest,winner.archiveTrust);
 console.log('CODEX04_CAPTURE_AND_CONCURRENT_REGISTRY PASS');
 // Local protocol exercise only, no official data and no independent TSA.
 const ca=join(dir,'tsa.crt'),key=join(dir,'tsa.key'),query=join(dir,'query.tsq'),reply=join(dir,'reply.tsr'),config=join(dir,'tsa.cnf'),serial=join(dir,'serial');
 const run=args=>execFileSync('openssl',args,{stdio:['ignore','pipe','pipe']});
 run(['req','-x509','-newkey','rsa:2048','-keyout',key,'-out',ca,'-days','1','-nodes','-subj','/CN=REBORN2 Local Protocol TSA','-addext','extendedKeyUsage=critical,timeStamping']);
 await writeFile(serial,'01\n');
 const policy='1.3.6.1.4.1.55555.1';
 await writeFile(config,['[ tsa ]','default_tsa = tsa_config1','[ tsa_config1 ]','dir = '+dir,'serial = '+serial,'crypto_device = builtin','signer_cert = '+ca,'signer_key = '+key,'signer_digest = sha256','default_policy = '+policy,'digests = sha256','accuracy = secs:1','ordering = yes','tsa_name = yes','ess_cert_id_chain = no'].join('\n')+'\n');
 const imprint=out.manifestDigest;await writeFile(query,makeOfflineTimestampQuery(imprint));
 run(['ts','-reply','-config',config,'-queryfile',query,'-out',reply]);
 const q={scope:'LOCAL_PROTOCOL_TEST_ONLY',queryPath:query,replyPath:reply,caPath:ca,caDigest:createHash('sha256').update(await readFile(ca)).digest('hex'),imprint,policyOid:policy,analysisAt:new Date(Date.now()-20000).toISOString(),startLower:new Date(Date.now()+60000).toISOString(),uncertaintyMs:2000};
 const verified=verifyLocalTimestampProtocol(q);assert.equal(verified.protocolSignatureVerified,true);assert.equal(verified.externalTimestampVerified,false);
 assert.throws(()=>verifyLocalTimestampProtocol({...q,imprint:'0'.repeat(64)}));
 assert.throws(()=>verifyLocalTimestampProtocol({...q,caDigest:'0'.repeat(64)}),/TSA_CA_PIN/);
 assert.throws(()=>verifyLocalTimestampProtocol({...q,startLower:verified.genTime}),/TIMESTAMP_NOT_PRESTART/);
 console.log('CODEX04_RFC3161_LOCAL_PROTOCOL PASS '+JSON.stringify(verified));
}finally{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
