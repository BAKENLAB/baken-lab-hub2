import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(readFileSync(new URL('../lab-rank-compare.js',import.meta.url),'utf8'),{window});
const rank=window.LabRankCompare;

test('2yo maiden-class 4th and 5th cannot become two wins in explanation',()=>{
 const r={horse_no:8,horse_name:'架空馬',rank:4,
  reason:'8/30中京1400m2歳未勝利4着、8/8同1600m2歳未勝利5着。中央2戦で掲示板周辺の素地がある。'};
 const before=JSON.stringify(r),title=rank.headline(r,{top5:[r]},{track:'名古屋'});
 const detail=rank.comment(r,{top5:[r]},{track:'名古屋'});
 assert.match(title,/8\/30中京1400m・4着/);
 assert.match(title,/8\/8中京1600m・5着/);
 assert.match(detail,/8\/30中京1400m・4着/);
 assert.doesNotMatch(title,/中京1400m・1着|中京1600m・1着/);
 assert.deepEqual(JSON.stringify(r),before);
});
test('the word 未勝利 alone is not sufficient to fabricate a first-place finish',()=>{
 const r={horse_no:3,rank:3,
  reason:'8/30中京1400m2歳未勝利、7/10中京1600m新馬6着。今回の条件適性は未確認。'};
 const result=rank.comment(r,{top5:[r]},{track:'名古屋'});
 assert.match(result,/7\/10中京1600m・6着/);
 assert.doesNotMatch(result,/8\/30中京1400m・1着/);
});
test('an explicit same-course victory remains recognized as a win',()=>{
 const r={horse_no:2,rank:2,
  reason:'10/20川崎1500mC2勝ち0.3差、9/22同1500mC2で3着。今回の条件を重視。'};
 const result=rank.comment(r,{top5:[r]},{track:'川崎'});
 assert.match(result,/10\/20川崎1500m・1着/);
 assert.match(result,/9\/22川崎1500m・3着/);
});
test('unverifiable rival level is not promoted to an ability reason',()=>{
 const r={horse_no:4,rank:4,
  reason:'過去走は複数の同場1400m実走。相手水準はまだ検証できない。'};
 const result=rank.comment(r,{top5:[r]},{track:'園田'});
 assert.match(result,/評価理由の要約に失敗/);
 assert.match(result,/【保存理由の原文】/);
});
