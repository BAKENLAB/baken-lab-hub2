import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executeFixtureWithProof,executeFixture,verifiedOrigin,sha,ENGINE,executeVerifiedSupply} from './adapter.mjs';
import {saveCompact,readManifest,restoreSnapshot,readNativeArtifact} from './compact-store.mjs';
import {makeSealPlan} from './prestart-seal.mjs';
const dir=await mkdtemp(join(tmpdir(),'codex03-integrity-'));
const resign=x=>{const {snapshotDigest,...body}=x;return {...body,snapshotDigest:sha(body)};};
try{
 const {snapshot:s,sourceProof:proof}=await executeFixtureWithProof('FK34_FULL');
 const root=join(dir,'shared'),a=await saveCompact(root,s),m=await readManifest(root,a.manifestDigest);
 assert.equal(sha(await restoreSnapshot(root,a.manifestDigest)),sha(s));
 const checks=[
  ['nested-target-result',x=>x.runners[0].targetResult={winner:x.runners[0].horseId,finish:1}],
  ['deep-target-result',x=>x.runners[0].analysisItems[0].injected={data:{targetResult:{finish:1}}}],
  ['semantic-grade',x=>x.runners[0].grade='A'],
  ['alternate-cutoff',x=>x.time.cutoff-=1],
  ['alternate-mode',x=>x.mode='PARTIAL'],
  ['target-alias',x=>x.race.raceId+='-ALIAS'],
  ['post-boundary',x=>x.time.analysisAt=x.time.startLower]
 ];
 for(const [id,mutate] of checks){const q=structuredClone(s);mutate(q);await assert.rejects(()=>saveCompact(root,resign(q)));console.log('CODEX03_INTEGRITY_REJECT '+id);}
 // In-place mutation of authenticated object must also be rejected.
 const old=s.runners[0].grade,oldHash=s.snapshotDigest;s.runners[0].grade='A';s.snapshotDigest=resign(s).snapshotDigest;
 await assert.rejects(()=>saveCompact(root,s),/ENGINE_OUTPUT_CHANGED/);s.runners[0].grade=old;s.snapshotDigest=oldHash;
 await assert.rejects(()=>saveCompact(root,s),e=>e.code==='EEXIST');assert.equal((await readdir(join(root,'identities'))).length,1);
 assert.equal(m.identity,sha([ENGINE,m.canonicalRace.issuer,m.canonicalRace.eventId]));
 console.log('CODEX03_CANONICAL_NO_REPLACE PASS');
 for(const name of ['nativeOutput','sourceProof','verifiedInput']){
  const raw=await readNativeArtifact(root,a.manifestDigest,name,a.archiveTrust);
  assert.equal(sha(raw),verifiedOrigin(s).artifacts[name].digest);
  const value=JSON.parse(raw);
  if(name==='nativeOutput'){assert.equal(value.candidate.runners.length,5);assert.equal(value.candidate.runners[0].analysisItems.length,115);assert.ok(value.runners&&value.work42);}
  if(name==='sourceProof')assert.equal(sha(value),sha(proof));
  if(name==='verifiedInput')assert.equal(value.request.id,'FK34_FULL');
  console.log('CODEX03_NATIVE '+JSON.stringify({name,rawBytes:Buffer.byteLength(raw),storedBytes:m.nativeArtifacts[name].compressedBytes,digest:sha(raw)}));
 }
 const plan=makeSealPlan(s,m,proof);assert.equal(plan.payload.nativeOutputDigest,m.nativeArtifacts.nativeOutput.digest);assert.equal(plan.payload.raceKey,m.identity);
 const alteredProof=structuredClone(proof);alteredProof.receipt.blob='fabricated';assert.throws(()=>makeSealPlan(s,m,alteredProof),/SOURCE_PROOF_ORIGIN/);
 const forged=structuredClone(m);forged.summary.runners[0].grade='S';const {manifestDigest,...body}=forged;forged.manifestDigest=sha(body);
 await writeFile(join(root,'manifests',forged.manifestDigest+'.json'),JSON.stringify(forged));
 await assert.rejects(()=>readManifest(root,forged.manifestDigest));
 const badTrust={...a.archiveTrust,expectedManifestDigest:'0'.repeat(64)};await assert.rejects(()=>readManifest(root,a.manifestDigest,badTrust));
 const n=m.nativeArtifacts.nativeOutput,filename=join(root,'native',n.digest+'.json.gz'),buf=await readFile(filename);
 await writeFile(filename,Buffer.concat([buf,Buffer.from('x')]));await assert.rejects(()=>readNativeArtifact(root,a.manifestDigest,'nativeOutput'));await writeFile(filename,buf);
 console.log('CODEX03_NATIVE_ORIGIN PASS '+JSON.stringify({projectionRaw:a.rawBytes,projectionObjects:a.objectBytes,manifest:a.manifestBytes,nativeBytes:a.nativeBytes,list:a.summaryBytes}));
 const p=await executeFixtureWithProof('WORK44_PARTIAL'),pa=await saveCompact(join(dir,'partial'),p.snapshot);
 const pr=JSON.parse(await readNativeArtifact(pa.root,pa.manifestDigest,'nativeOutput'));assert.equal(pr.runners.length,2);assert.deepEqual(pr.sourcePacket,p.sourceProof.packet);
 const pi=JSON.parse(await readNativeArtifact(pa.root,pa.manifestDigest,'verifiedInput'));assert.ok(pi.bundle.rawFiles.length&&pi.trust.authorityKey.includes('PUBLIC KEY'));
 await assert.rejects(()=>executeVerifiedSupply({scope:'FIXTURE_ONLY',mode:'PARTIAL',bundle:pi.bundle,trust:pi.trust,candidate:pi.candidate}),/PARTIAL_FIXTURE_AUTHORITY_NOT_ISSUED/);
 console.log('CODEX03_PARTIAL_NATIVE PASS '+JSON.stringify({nativeBytes:pa.nativeBytes}));
}finally{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
