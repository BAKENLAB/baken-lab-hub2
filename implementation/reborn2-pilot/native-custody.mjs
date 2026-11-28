// Offline protocol preparation. No external TSA calls or real registry writes.
// This verifies a local RFC3161 protocol test, not an independent real TSA.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {ENGINE,sha} from './adapter.mjs';
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ts=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const exact=(v,k)=>assert.deepEqual(Object.keys(v).sort(),[...k].sort(),'UNEXPECTED_CUSTODY_FIELDS');
export const sharedRegistryPlan=Object.freeze({
 schema:'REBORN2_SHARED_REGISTRY_PREPARATION_1',engineCommit:ENGINE,
 canonicalKey:'sha256(JSON([engineCommit,verifiedIssuer,canonicalNativeRaceId]))',
 lockScope:'ONE_AUTHORIZED_SHARED_ROOT_AND_PROTECTED_SIGNER',
 workflow:['preregister independently verified canonical race and cutoff','reserve canonical race key atomically, no version/cutoff/mode bypass','write content-addressed source/native output/projection objects','sign manifest with protected signer','verify independent RFC3161 token against pinned trust and conservative start boundary','atomically commit identity once; failures remain uncommitted','read only with pinned trust'],
 sharedRegistryConfigured:false,protectedSignerConfigured:false,independentTimestampConfigured:false,realWritesAllowed:false
});
// A digest-only request has no official source bytes. Sending it requires
// approval for disclosure; this function does not send or write anything.
export function makeOfflineTimestampQuery(imprint){
 assert.ok(hex(imprint),'IMPRINT_FORMAT');
 return execFileSync('openssl',['ts','-query','-digest',imprint,'-sha256','-cert'],{maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
}
export function verifyLocalTimestampProtocol(q){
 exact(q,['scope','queryPath','replyPath','caPath','caDigest','imprint','policyOid','analysisAt','startLower','uncertaintyMs']);
 assert.equal(q.scope,'LOCAL_PROTOCOL_TEST_ONLY','INDEPENDENT_TSA_TRUST_NOT_CONFIGURED');
 assert.ok(hex(q.caDigest)&&hex(q.imprint));
 assert.ok(typeof q.policyOid==='string'&&/^\d+(?:\.\d+)+$/.test(q.policyOid));
 assert.ok(ts(q.analysisAt)&&ts(q.startLower)&&Date.parse(q.analysisAt)<Date.parse(q.startLower));
 assert.ok(Number.isSafeInteger(q.uncertaintyMs)&&q.uncertaintyMs>=0&&q.uncertaintyMs<=60000);
 assert.equal(createHash('sha256').update(readFileSync(q.caPath)).digest('hex'),q.caDigest,'TSA_CA_PIN');
 const run=a=>execFileSync('openssl',a,{encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
 // Verify both query/nonce binding and exact independently expected imprint.
 run(['ts','-verify','-queryfile',q.queryPath,'-in',q.replyPath,'-CAfile',q.caPath]);
 run(['ts','-verify','-digest',q.imprint,'-in',q.replyPath,'-CAfile',q.caPath]);
 const t=run(['ts','-reply','-in',q.replyPath,'-text']);
 assert.match(t,/^Status: Granted\.$/m);assert.match(t,/^Hash Algorithm: sha256$/m);
 const policy=t.match(/^Policy OID: (.+)$/m)?.[1];assert.equal(policy,q.policyOid,'TSA_POLICY');
 const gen=t.match(/^Time stamp: (.+ GMT)$/m)?.[1];assert.ok(gen,'TSA_GEN_TIME');
 const millis=Date.parse(gen);assert.ok(Number.isFinite(millis),'TSA_GEN_TIME');
 const acc=t.match(/^Accuracy: (.+)$/m)?.[1];assert.ok(acc,'TSA_ACCURACY');
 const unit=(u)=>{const m=acc.match(new RegExp('(0x[0-9A-Fa-f]+|unspecified) '+u));assert.ok(m,'TSA_ACCURACY_FORMAT');return m[1]==='unspecified'?0:parseInt(m[1],16);};
 const reported=unit('seconds')*1000+unit('millis')+unit('micros')/1000;
 assert.ok(reported<=q.uncertaintyMs,'TSA_ACCURACY_BOUND');
 assert.ok(Date.parse(q.analysisAt)<=millis-q.uncertaintyMs,'TIMESTAMP_BEFORE_ANALYSIS');
 assert.ok(millis+q.uncertaintyMs<Date.parse(q.startLower),'TIMESTAMP_NOT_PRESTART');
 return {protocolSignatureVerified:true,imprint:q.imprint,genTime:new Date(millis).toISOString(),reportedAccuracyMs:reported,policy,externalTimestampVerified:false,prospective:false,realAdmission:false};
}
