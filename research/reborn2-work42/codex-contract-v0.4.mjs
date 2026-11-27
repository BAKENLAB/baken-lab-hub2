// Codex integration entry: derives the packet exclusively from validated raw
// bytes, verifies it using the exact common producer, returns field-specific
// native dependencies and canonical target items. No self-issued real custody.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateEnvelope,sha} from './validate-v0.4.mjs';
import {buildSupply} from './eye-supply-v0.4.mjs';
import {run31,pipeline31,verifier31} from '../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
import {loadV40} from '../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
let loaded;
export async function prepareSupply(envelope,{id}={}){
 const validated=validateEnvelope(envelope),V=await (loaded??=loadV40()),canonical=V.C.canonical;
 const name=id??'WORK42_'+validated.analysisSha256.slice(0,24);
 assert.match(name,/^[A-Za-z0-9_-]+$/);
 const {input,registry,out}=run31(validated.docs,canonical,sha);
 assert.equal(out.state,'TEST_PACKET');assert.equal(out.digest,sha(JSON.stringify(out.packet)));
 const bundleText=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical,cases:[{n:name,input,registry,expectedDigest:out.digest}]})+'\n';
 const receipt={id:name,source_digest:out.digest,bundle_sha256:sha(bundleText),evidence:out.packet.evidence.length,itemRows:validated.docs[0].rows.length*115,blob:null};
 const verified=V.C.verify32(bundleText,name,out,sha,pipeline31,verifier31,receipt.bundle_sha256);
 assert.equal(verified.state,'VERIFIED_SYNTHETIC_ENVELOPE');
 const supply=buildSupply(envelope,out.packet);
 assert.equal(supply.commonSha256,receipt.source_digest);
 return {request:{id:name,bundleText,envelope:out},receipt,supply,scope:'SYNTHETIC_SELF_REPLAY_NOT_EXTERNAL_CUSTODY',formal:false};
}
