// Graph execution is separate from source verification. This module only
// registers the existing fixed research fixtures; no native graph authority
// is installed. Native state vocabulary is distinct, never a fixture alias.
import assert from 'node:assert/strict';
import {loadV40,acceptedRequest,verifyIntake} from '../../../research/reborn2-independent-engine/main47-integration/v43-generic.mjs';
import {makeEnvelope,validateEnvelope} from '../../../research/reborn2-work42/validate-v0.4.mjs';
import {sha} from '../adapter.mjs';
const contexts=new WeakMap(),domains=new WeakMap();
const vocabulary=Object.freeze({FIXTURE:Object.freeze({observation:'SYNTHETIC_OBSERVATION',comparable:'COMPARABLE_SYNTHETIC_RESPONSE'}),NATIVE:Object.freeze({observation:'OBSERVED_NATIVE_VERIFIED',comparable:'COMPARABLE_NATIVE_RESPONSE'})});
export function stateVocabulary(domain){assert.ok(Object.hasOwn(vocabulary,domain),'GRAPH_DOMAIN');return vocabulary[domain];}
const mode=x=>{const d=domains.get(x);assert.ok(d,'UNREGISTERED_GRAPH_DOMAIN');return d;};
export const observationState=x=>stateVocabulary(mode(x)).observation;
export const comparableState=x=>stateVocabulary(mode(x)).comparable;
export async function loadVerifiedFixtureGraph(name){
 assert.ok(['FK34_FULL','FK34_UNKNOWN'].includes(name),'FIXED_FIXTURE_ONLY');
 const V=await loadV40(),{request,receipt}=acceptedRequest(V,name),v=verifyIntake(V,request,receipt);
 const validated=validateEnvelope(makeEnvelope(v.docs));
 assert.deepEqual(validated.docs,v.docs);
 assert.equal(sha(v.packet),receipt.source_digest);
 assert.deepEqual(v.adapted.packet,v.packet);
 // Retain the verified graph rather than rebuilding synthetic packet in
 // each analytical stage. Keep caller-visible copy separate.
 const p=structuredClone(v.adapted);
 const graphReceipt=v.W.C.receipt.summary.find(x=>x.id===name);
 assert.ok(graphReceipt);assert.equal(graphReceipt.source_digest,receipt.source_digest);assert.equal(graphReceipt.bundle_sha256,receipt.bundle_sha256);
 assert.equal(graphReceipt.itemRows,v.docs[0].rows.length*115);
 const ctx={id:name,adapted:p,packet:structuredClone(v.packet),envelope:structuredClone(request.envelope),receipt:structuredClone(graphReceipt),canonical:structuredClone(v.W.C.canonical),adaptedDigest:sha(p)};
 contexts.set(v.W,ctx);domains.set(v.W,'FIXTURE');
 return {V:v.W,request,receipt,docs:v.docs,packet:v.packet,adapted:structuredClone(p),validated};
}
export function freshFixtureGraph(V,id){
 const c=contexts.get(V);assert.ok(c&&c.id===id,'VERIFIED_GRAPH_CAPABILITY_REQUIRED');
 assert.equal(sha(c.adapted),c.adaptedDigest);
 const p=structuredClone(c.adapted);
 const loaded={cases:new Map([[id,p]]),canonical:structuredClone(c.canonical),work30:new Map(),work27:new Map()};
 domains.set(loaded,'FIXTURE');
 return {loaded,packet:p.packet,envelope:structuredClone(c.envelope),receipt:structuredClone(c.receipt)};
}
