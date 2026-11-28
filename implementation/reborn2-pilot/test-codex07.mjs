import assert from 'node:assert/strict';
import {ENGINE,assertFrozenEngine,sha} from './adapter.mjs';
import {exerciseExistingGraph,readIssuedGraph,reviewAllHorses,reviewHorseItem,issueNativeGraph,validateGraphClosure} from './native-graph-issuance.mjs';
import {exerciseWork08EndToEnd} from './native-partial-runtime.mjs';
import {partialFixture} from './fixture-partial.mjs';
import {submitAnalysis} from './work04-intake.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const {b,trust}=partialFixture(),old=exerciseWork08EndToEnd(b,trust);
const view=h=>h.analysisItems.flatMap(i=>i.partialFindings.map(f=>({item:f.item,type:f.type,event:f.event,value:f.value})));
for(const version of ['07','08']){
 const c=exerciseExistingGraph(version),x=readIssuedGraph(c),v=reviewAllHorses(c),m=new Map(x.packet.roots.map(r=>[r.id,r]));
 assert.equal(x.facts.length,48);assert.equal(x.facts.filter(f=>f.state==='OBSERVED').length,43);
 assert.deepEqual(validateGraphClosure(x.packet),{roots:m.size,verified:m.size});
 assert.ok(x.packet.roots.every(r=>r.kind.startsWith('FIXTURE_')));
 assert.equal(x.receipt.sourceGraphDigest,sha(x.packet));assert.equal(x.receipt.factsDigest,sha(x.facts));assert.equal(x.receipt.outputDigest,sha(x.runners));assert.equal(c.receiptDigest,sha(x.receipt));
 assert.equal(v.roster.length,2);assert.equal(v.availability.fullEligible,false);assert.equal(v.availability.commonNativeFullConnected,false);
 assert.ok(x.facts.filter(f=>f.state==='HELD').every(f=>f.value===null&&f.sourceRefs.length>0&&m.has(f.factId)));
 for(const h of x.runners){
  assert.deepEqual(view(h),view(old.runners.find(q=>q.horse===h.horse)));
  assert.equal(h.analysisItems.length,115);assert.equal(h.eye.length,15);assert.equal(h.grade,'UNASSESSED');
  const detail=reviewHorseItem(c,h.horse,'RANK35'),diff=detail.findings[0].value;
  assert.equal(diff.final600DifferenceMs,h.horse==='TEST:HORSE_1'?-500:500);
  assert.equal(diff.order,h.horse==='TEST:HORSE_1'?'AHEAD':'BEHIND');
  const refs=new Set(detail.roots.map(r=>r.id));assert.ok(detail.findings.every(f=>f.refs.every(id=>refs.has(id))));
  for(const f of detail.findings){const seen=new Set();function visit(id){if(seen.has(id))return;seen.add(id);m.get(id).depends.forEach(visit);}f.directRefs.forEach(visit);assert.deepEqual([...seen].sort(),f.refs);}
  assert.equal(reviewHorseItem(c,h.horse,'RANK08').state,'HELD');
 }
 const broken=structuredClone(x.packet);broken.roots[0].payload.nativeId='CHANGED';assert.throws(()=>validateGraphClosure(broken),/GRAPH_ROOT_HASH/);
 const detached=structuredClone(x.packet);detached.roots.pop();detached.roots[0].depends=['missing'];assert.throws(()=>validateGraphClosure(detached));
 x.runners[0].grade='S';v.roster[0].grade='S';assert.equal(reviewAllHorses(c).roster[0].grade,'UNASSESSED');
 assert.throws(()=>readIssuedGraph({...c}),/ISSUED_GRAPH_CAPABILITY_REQUIRED/);assert.throws(()=>reviewHorseItem(c,'OUTSIDE','RANK35'),/HORSE_NOT_IN_ISSUED_ROSTER/);
 console.log('CODEX07_ISSUED_GRAPH_REVIEW PASS '+JSON.stringify({version,facts:x.facts.length,roots:m.size,findings:x.runners.map(h=>view(h).length),items:x.runners.map(h=>h.analysisItems.length),receipt:c.receiptDigest,fullEligible:false,realAdmission:false}));
}
assert.throws(()=>issueNativeGraph(null),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
await assert.rejects(()=>submitAnalysis({schema:'REBORN2_NATIVE_GRAPH_REVIEW_REQUEST_1',request:null}),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
console.log('CODEX07_NATIVE_AUTHORITY_CLOSED PASS');
