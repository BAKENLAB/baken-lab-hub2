// Preparation for external time/custody. Local fixture signature only;
// real pilot not authorized. No external TSA request, result access or DB.
import assert from 'node:assert/strict';
import {sign,verify} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {sha,ENGINE,validateSnapshot} from './adapter.mjs';
import {readManifest,restoreSnapshot} from './compact-store.mjs';
const bytes=x=>Buffer.from(JSON.stringify(x));
const keyOf=s=>sha([s.engineCommit,s.race.circuit,s.race.raceId]); // no mode/cutoff bypass
const exact=(v,k)=>assert.deepEqual(Object.keys(v).sort(),[...k].sort());
export function makeSealPlan(snapshot,archive,proof){
 const s=validateSnapshot(snapshot);
 assert.equal(archive.header.snapshotDigest,s.snapshotDigest);assert.equal(archive.header.sourceDigest,s.sourceDigest);
 assert.equal(proof.scope,'FIXTURE_ONLY');assert.equal(proof.sourceDigest,s.sourceDigest);assert.equal(proof.mode,s.mode);
 // Validate source packet hash, not just a declared sourceDigest.
 if(proof.mode==='PARTIAL')assert.equal(sha(proof.packet),proof.sourceDigest);
 else assert.equal(sha(proof.packet),proof.packetDigest);
 const payload={schema:'REBORN2_PRESTART_SEAL_PLAN_1',scope:'FIXTURE_ONLY',raceKey:keyOf(s),race:s.race,engineCommit:ENGINE,sourceDigest:s.sourceDigest,sourceProofDigest:sha(proof),snapshotDigest:s.snapshotDigest,manifestDigest:archive.manifestDigest,time:s.time,externalTimestampVerified:false,prospective:false,realAdmission:false};
 return {payload,digest:sha(payload),timestampRequest:{algorithm:'SHA256',messageImprint:sha(payload),state:'NOT_SENT'}};
}
export function signFixtureSeal(plan,privateKey){
 assert.equal(plan.payload.scope,'FIXTURE_ONLY');assert.equal(plan.digest,sha(plan.payload));return {plan,signature:sign(null,bytes(plan.payload),privateKey).toString('base64')};
}
export function verifyFixtureSeal(seal,trust,expected){
 assert.equal(trust.scope,'LOCAL_FIXTURE_KEY_ONLY');
 assert.equal(seal.plan.payload.scope,'FIXTURE_ONLY');assert.equal(seal.plan.digest,sha(seal.plan.payload));
 assert.deepEqual(seal.plan,expected);assert.equal(trust.expectedDigest,expected.digest);
 assert.ok(verify(null,bytes(seal.plan.payload),trust.publicKey,Buffer.from(seal.signature,'base64')),'SEAL_SIGNATURE');
 return {verified:true,externalTimestampVerified:false,prospective:false,realAdmission:false};
}
export async function saveFixtureSeal(root,archiveDigest,proof,seal,trust){
 const m=await readManifest(root,archiveDigest),s=await restoreSnapshot(root,archiveDigest),plan=makeSealPlan(s,m,proof);
 verifyFixtureSeal(seal,trust,plan);
 await mkdir(join(root,'seals'),{recursive:true,mode:0o700});
 // One local preregistered fixture race/model; use atomic exclusive create.
 // A crash is fail-closed (an incomplete seal cannot verify). No WORM claim.
 const file=join(root,'seals',plan.payload.raceKey+'.json.gz');
 await writeFile(file,gzipSync(bytes({seal,proof})),{flag:'wx',mode:0o600});
 return file;
}
export async function readFixtureSeal(root,file,trust){
 const {seal,proof}=JSON.parse(gunzipSync(await readFile(file)).toString('utf8'));
 const m=await readManifest(root,seal.plan.payload.manifestDigest),s=await restoreSnapshot(root,m.manifestDigest),plan=makeSealPlan(s,m,proof);
 return {seal,proof,verification:verifyFixtureSeal(seal,trust,plan)};
}
