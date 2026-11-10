import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../lab-rank-compare.js',import.meta.url),'utf8');
const window={};vm.runInNewContext(src,{window});
const rank=window.LabRankCompare;
const fire={horse_no:10,horse_name:'ファイヤーナイフ',rank:1,grade:'S',score:94,
 reason:'10/27金沢1400mC2二で4着1.6差、8/17同1400m3歳A4で11着2.2差、8/03同1400m3歳A3で8着1.7差。今回C2十四特別編成へ条件変更するため上のC2二での近接実績を最重要視。ただし特別編成の実際の相手水準は未検証、前回3着内ではない。'};
const timer={horse_no:5,horse_name:'ビッグタイマー',rank:2,grade:'A',score:89,
 reason:'10/27金沢1400mC2三で6着2.3差、9/29同1400mC2二で7着3.1差、9/01同1400mC2三特別編成で6着2.4差。C2上の組の同場距離実走は評価するが近走は6～9着で勝ち・連対実績なしを明記。'};
const helios={horse_no:4,horse_name:'ヘリオシース',rank:3,grade:'A',score:86,
 reason:'10/13金沢1500mC2三で6着2.9差、9/29同1400mC2二で8着4.1差、9/13同1400mC2三で8着3.3差。今回特別編成への条件下降と過去の組経験を評価。直近の1400mで3着内なし、好走材料より級差推定に依存することは反証。'};
const payload={top5:[fire,timer,helios]};
const race={track:'金沢',race_name:'若菜&春樹 夫婦スタートC2十四特別編成'};
test('Kanazawa 1R saved MM/DD runs appear despite old false-history fallback',()=>{
 const before=JSON.stringify(payload);
 const got=rank.comment(fire,payload,race);
 assert.match(got,/10\/27金沢1400m/);
 assert.match(got,/4着/);
 assert.match(got,/8\/17金沢1400m/);
 assert.match(got,/今回C2十四特別編成へ条件変更/);
 assert.match(got,/実際の相手水準は未検証/);
 assert.doesNotMatch(got,/確認できる近走材料が不足/);
 assert.match(rank.overview(payload,race),/10\/27金沢1400m/);
 assert.equal(JSON.stringify(payload),before);
});
test('Kanazawa 4: rank3 exposes weak current evidence and class-level inference',()=>{
 const got=rank.comment(helios,payload,race);
 assert.match(got,/10\/13金沢1500m/);
 assert.match(got,/9\/29金沢1400m/);
 assert.match(got,/過去の組経験を評価/);
 assert.match(got,/級差推定に依存/);
 assert.doesNotMatch(got,/確認できる近走材料が不足/);
});
test('unparseable dates must fall back to saved official reason, not claim data absent',()=>{
 const r={horse_no:3,horse_name:'検証',rank:3,score:75,
 reason:'過去走は複数の同場1400m実走。相手水準はまだ検証できない。'};
 const got=rank.comment(r,{top5:[fire,timer,r]},race);
 assert.match(got,/過去走は複数の同場1400m実走/);
 assert.doesNotMatch(got,/確認できる近走材料が不足/);
});
test('display prefers saved reason over generic comment and accepts full ISO dates',()=>{
 const r={horse_no:8,horse_name:'検証馬',rank:3,score:70,
 comment:'根拠が不明',
 reason:'2026-10-20金沢1400mC2四で2着0.3差／2026-10-27同1400mC2四で5着1.2差。今回は同条件を確認。'};
 const got=rank.comment(r,{top5:[fire,timer,r]},race);
 assert.match(got,/10\/20金沢1400m/);
 assert.doesNotMatch(got,/根拠が不明/);
});
