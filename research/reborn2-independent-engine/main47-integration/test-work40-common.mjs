import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyzeWork40,prepareWork40} from './work40-common.mjs';

const clean=({analysis,analysisSha256})=>({analysis,analysisSha256});
const base=prepareWork40(),sealed=prepareWork40([{evidence_id:'SEALED',raw_sha256:'f'.repeat(64)}]);
assert.notDeepEqual(base.sealedResults,sealed.sealedResults);
assert.deepEqual(clean(base),clean(sealed));
await assert.rejects(analyzeWork40(sealed));
for(const modify of [
  x=>x.analysis.target.odds=5,
  x=>x.analysis.source[0].bytes+=' ',
  x=>x.analysis.source[1].metadata.captured_at='invalid',
  x=>x.analysis.runner_supplies[0].horse.native_horse_id='TEST:OTHER'
]){
  const variant=structuredClone(clean(base));
  modify(variant);
  variant.analysisSha256=createHash('sha256').update(JSON.stringify(variant.analysis)).digest('hex');
  await assert.rejects(analyzeWork40(variant));
}
const result=await analyzeWork40(clean(base)),withoutEye=await analyzeWork40(clean(sealed),{eyeEnabled:false});
assert.equal(result.evidence,537);
assert.equal(result.groups,118);
assert.equal(result.held,826);
assert.equal(result.decision.runners.length,5);
assert.ok(result.decision.runners.every(h=>h.items.length===115&&h.grade===null&&h.current_grade===null));
assert.deepEqual(result.decision.routes,withoutEye.decision.routes);
assert.equal(result.decision.digest,withoutEye.decision.digest);
const h=result.decision.runners.find(h=>h.horse.endsWith('|TEST:H4'));
assert.ok(h.eye.some(e=>e.item==='EYE03'));
assert.ok(withoutEye.decision.runners.every(h=>h.eye.length===0));
console.log(JSON.stringify({schema:'WORK40_COMMON_EXECUTION_V1',analysisSha256:result.analysisSha256,
  commonSha256:result.decision.digest,documents:base.analysis.source.length,evidence:result.evidence,
  groups:result.groups,held:result.held,runners:result.decision.runners.map(h=>({horse:h.horse,items:h.items.length,
    conditionalGrade:h.conditional_grade,currentGrade:h.current_grade,eye:[...new Set(h.eye.map(e=>e.item))],
    paths:h.paths.length,win:h.reasons.win.length,place:h.reasons.place.length,counter:h.reasons.counter.length})),formal:false}));
