import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ENGINE,sha,assertFrozenEngine,executeFixtureWithProof} from './adapter.mjs';
import {computePartial} from './derived-partial-core.mjs';
import {exerciseFixtureObservationCompiler} from './native-partial-runtime.mjs';
import {submitAnalysis} from './work04-intake.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const bytes=readFileSync(new URL('../../research/reborn2-chatgpt-circuit/work44-partial-consumer.mjs',import.meta.url));
assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),'c6b1bfd83f7b86f228dd7ec509689e8d9119e66c');
const {snapshot,sourceProof}=await executeFixtureWithProof('WORK44_PARTIAL');
const actual=computePartial(sourceProof.packet);
assert.equal(actual.length,2);
for(const h of actual){const prior=snapshot.runners.find(r=>r.horseId===h.horse);assert.equal(h.grade,prior.grade);assert.deepEqual(h.analysisItems,prior.analysisItems);assert.deepEqual(h.ability.axes,prior.axes.map(({name,...rest})=>rest));assert.deepEqual(h.eye,prior.eye);}
console.log('CODEX05_FIXED_PARTIAL_EQUIVALENCE PASS');
const exercise=exerciseFixtureObservationCompiler(sourceProof.packet);
assert.equal(exercise.realAdmission,false);assert.equal(exercise.rosterCount,2);assert.ok(exercise.observationCount>0);
const view=r=>r.analysisItems.flatMap(i=>i.partialFindings.map(f=>({item:f.item,type:f.type,event:f.event,value:f.value})));
for(const h of exercise.runners){assert.equal(h.grade,'UNASSESSED');const prior=actual.find(x=>x.horse===h.horse);assert.deepEqual(view(h),view(prior));assert.equal(h.analysisItems.length,115);assert.equal(h.eye.length,15);assert.equal(h.winPaths.length,0);}
console.log('CODEX05_EXISTING_FIXTURE_CONVERSION PASS '+JSON.stringify({events:exercise.eventCount,roster:exercise.rosterCount,observations:exercise.observationCount,fields:exercise.fields,roots:exercise.compiled.roots.length}));
await assert.rejects(()=>submitAnalysis({schema:'REBORN2_NATIVE_ANALYSIS_REQUEST_1',mode:'PARTIAL',package:{},approval:{}}),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
await assert.rejects(()=>submitAnalysis({schema:'REBORN2_NATIVE_ANALYSIS_REQUEST_1',mode:'FULL',package:{},approval:{}}),/FULL_NATIVE_KERNEL_DEPENDENCY/);
console.log('CODEX05_NATIVE_APPROVAL_GATE PASS');
