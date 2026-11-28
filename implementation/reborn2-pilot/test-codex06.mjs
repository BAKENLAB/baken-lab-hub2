import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {partialFixture} from './fixture-partial.mjs';
import {exerciseWork07EndToEnd,WORK07} from './native-partial-runtime.mjs';
import {submitAnalysis} from './work04-intake.mjs';
import {assertFrozenEngine,ENGINE} from './adapter.mjs';
import {inspectNativeStructureOffline} from './native-entry.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const bytes=readFileSync(new URL('../reborn2-work07/offline-converter.mjs',import.meta.url));
assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),'d86fb5f23749fd53f30ce39e0b7977bff976dc96');
const {b,trust}=partialFixture(),x=exerciseWork07EndToEnd(b,trust),p=x.package;
assert.equal(x.work07Commit,WORK07);assert.equal(x.realAdmission,false);assert.equal(x.runners.length,2);assert.ok(p.roster.every(h=>h.status==='UNKNOWN'));
const roots=new Map(x.sourcePacket.roots.map(r=>[r.id,r]));
assert.ok([...roots.values()].every(r=>r.kind.startsWith('FIXTURE_')&&r.depends.every(id=>roots.has(id))));
for(const h of x.runners){
 assert.equal(h.grade,'UNASSESSED');assert.equal(h.analysisItems.length,115);assert.equal(h.eye.length,15);assert.equal(h.winPaths.length,0);
 const f=h.analysisItems.flatMap(i=>i.partialFindings);
 assert.ok(f.length>0&&f.every(q=>q.refs.every(id=>roots.has(id))));
 const expected=h.horse==='TEST:HORSE_1'?37000:37500;
 assert.ok(f.some(q=>q.type==='REPORTED_INDIVIDUAL_FINAL600'&&q.value.ms===expected));
 assert.ok(f.some(q=>q.type==='DIRECT_REPORTED_COMPARISON'&&Math.abs(q.value.final600DifferenceMs)===500));
}
assert.ok(x.sourcePacket.missing.some(q=>q.key.includes('finishClockLiteral')&&q.state==='HELD'));
assert.throws(()=>inspectNativeStructureOffline(p),/RESEARCH_ID_FORBIDDEN/);
const broken=structuredClone(b);broken.rawFiles[0].base64=broken.rawFiles[1].base64;assert.throws(()=>exerciseWork07EndToEnd(broken,trust),/RAW_HASH/);
await assert.rejects(()=>submitAnalysis({schema:'REBORN2_WORK07_ANALYSIS_REQUEST_1',mode:'PARTIAL',signedManifest:null,raws:null,approval:null}),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
console.log('CODEX06_WORK07_END_TO_END PASS '+JSON.stringify({observations:p.observations.length,counts:x.inspection.counts,roots:roots.size,items:x.runners.map(h=>h.analysisItems.length),findings:x.runners.map(h=>h.analysisItems.flatMap(i=>i.partialFindings).length),realAdmission:false}));
