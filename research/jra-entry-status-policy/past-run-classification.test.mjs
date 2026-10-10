import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPastRun, splitPastRuns } from './past-run-classification.mjs';
const cases = [
  ['除外', 'EXCLUDED', false, false],
  ['取消', 'CANCELLED', false, false],
  ['中止', 'DID_NOT_FINISH', true, false],
  ['JRAへ転入', 'TRANSFER', false, false],
];
for (const [token,kind,start,finish] of cases) test(token,()=>{
 const raw=token==='JRAへ転入'?'2026年2月26日 JRAへ転入':`2026年9月21日 阪神 新馬 ${token} 14頭7番`;
 assert.deepEqual(classifyPastRun({raw,finish:null}),{kind,countAsStart:start,countAsFinish:finish});
});
test('numeric finish counts as started and finished',()=>assert.deepEqual(classifyPastRun({raw:'2026年10月4日 東京 未勝利 3着',finish:3}),{kind:'FINISHED',countAsStart:true,countAsFinish:true}));
test('unknown record fails closed',()=>assert.equal(splitPastRuns([{raw:'unknown',finish:null}]).state,'REVIEW'));
test('mixed history separates actual starts from non-starts',()=>{
 const r=splitPastRuns([{raw:'2026年9月21日 阪神 新馬 除外',finish:null},{raw:'2026年9月28日 東京 未勝利 2着',finish:2},{raw:'2026年2月26日 JRAへ転入',finish:null}]);
 assert.equal(r.state,'READY'); assert.equal(r.starts,1); assert.equal(r.finishes,1);
});
