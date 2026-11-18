import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../lab-rank-compare.js',import.meta.url),'utf8');
const browser={window:{}};
vm.runInNewContext(source,browser,{filename:'lab-rank-compare.js'});
const {headline,comment}=browser.window.LabRankCompare;
const rank2={
 horse_no:4,rank:2,horse_name:'クリムゾンバースト',
 reason:'10/28大井1200m3歳一二4着0.6差、金沢3歳A2 2着とB4勝ち。現級でも近接したが連対の裏付けはない。直近公式実走 2026-10-28 大井1200m 4着・着差0.6・上がり38.5。次走歴 2026-10-08 大井1600m 5着・着差1.2・上がり40.4。過去の角通過順は記録のある走のみ採用、全走ラップ・不利・調教は未確認。'
};
const rank1={
 horse_no:1,rank:1,horse_name:'ベルベットオニキス',
 reason:'10/28大井1200m3歳一二3着0.5差、9/14同1200m2着1.8差。現級直近3着と同場距離の複数好走が強み。10/8の7着は反証。直近公式実走 2026-10-28 大井1200m 3着・着差0.5・上がり38.5。次走歴 2026-10-08 大井1200m 7着・着差1.7・上がり39.2。過去の角通過順は記録のある走のみ採用、全走ラップ・不利・調教は未確認。'
};
const predicted={runners:[rank1,rank2],top5:[rank1,rank2],eye:null};
test('rank 2 shows specific verified ability rather than no top-two proof',()=>{
 const short=headline(rank2,predicted,{});
 const detail=comment(rank2,predicted,{});
 assert.match(short,/10\/28大井1200m/);
 assert.match(detail,/金沢3歳A2 2着とB4勝ち/);
 assert.doesNotMatch(short,/裏付けはない|2着以内/);
 assert.doesNotMatch(detail,/裏付けはない|2着以内の裏付け/);
 assert.equal((detail.match(/10\/28/g)||[]).length,1,'no repeated recent race');
 assert.doesNotMatch(detail,/近い順位の馬と|採点理由を断定/);
});
test('rank 1 keeps meaningful positive summary, factual risk, without duplicated facts',()=>{
 const short=headline(rank1,predicted,{});
 const detail=comment(rank1,predicted,{});
 assert.match(short,/複数好走が強み/);
 assert.match(detail,/10\/28大井1200m/);
 assert.match(detail,/10\/8の7着/);
 assert.equal((detail.match(/10\/28/g)||[]).length,1);
 assert.doesNotMatch(detail,/調教は未確認|採点理由を断定/);
});
test('legacy comments are not routed through the new LOCAL-specific handler',()=>{
 const legacy={horse_no:4,rank:2,reason:'9/15大井1200mで4着。同条件の実績を評価。'};
 const p={runners:[legacy],top5:[legacy],eye:null};
 assert.match(comment(legacy,p,{}),/根拠となる過去走/);
});
test('presentation adapter never rewrites the saved prediction',()=>{
 const original=JSON.stringify(predicted);
 comment(rank2,predicted,{});
 headline(rank1,predicted,{});
 assert.equal(JSON.stringify(predicted),original);
});
