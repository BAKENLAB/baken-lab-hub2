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
test('Kanazawa 1: ranking rationale appears first and concrete historical results follow',()=>{
 const before=JSON.stringify(payload);
 const got=rank.comment(fire,payload,race);
 assert.match(got,/^【この順位にした理由】今回C2十四特別編成/);
 assert.match(got,/【根拠となる過去走】10\/27金沢1400m・4着、8\/17金沢1400m・11着/);
 assert.match(got,/【不安・未確認】特別編成の実際の相手水準は未検証/);
 assert.doesNotMatch(got,/確認できる近走材料が不足|A級での好走、相手はB級/);
 assert.match(rank.overview(payload,race),/今回C2十四特別編成/);
 assert.match(rank.headline(fire,payload,race),/条件変更/);
 assert.equal(JSON.stringify(payload),before);
});
test('Kanazawa 4: weak class-level assumption and risk are visible despite grade A',()=>{
 const got=rank.comment(helios,payload,race);
 assert.match(got,/【この順位にした理由】今回特別編成への条件下降/);
 assert.match(got,/【根拠となる過去走】10\/13金沢1500m・6着、9\/29金沢1400m・8着/);
 assert.match(got,/【不安・未確認】直近の1400mで3着内なし/);
 assert.match(got,/クラス差の推測/);
});
test('negative and positive clauses in one sentence must be separated',()=>{
 const got=rank.comment(timer,payload,race);
 assert.match(got,/【この順位にした理由】C2上の組の同場距離実績は評価/);
 assert.match(got,/【不安・未確認】近走は6～9着/);
 assert.doesNotMatch(rank.headline(timer,payload,race),/勝ち・2着以内実績なし/);
});
test('unparseable source does not create positive evidence or falsely claim history absent',()=>{
 const r={horse_no:3,horse_name:'検証',rank:3,score:75,
 reason:'過去走は複数の同場1400m実走。相手水準はまだ検証できない。'};
 const got=rank.comment(r,{top5:[fire,timer,r]},race);
 assert.match(got,/上位評価の決め手は保存理由に明記なし|具体的な評価理由は保存情報から確認できません/);
 assert.match(got,/具体的なレース結果の記載なし/);
 assert.doesNotMatch(got,/確認できる近走材料が不足/);
});
test('saved reason preferred over generic comment and ISO full dates accepted',()=>{
 const r={horse_no:8,horse_name:'検証馬',rank:3,score:70,comment:'根拠が不明',
 reason:'2026-10-20金沢1400mC2四で2着0.3差／2026-10-27同1400mC2四で5着1.2差。今回は同条件を確認。'};
 const got=rank.comment(r,{top5:[fire,timer,r]},race);
 assert.match(got,/10\/20金沢1400m・2着/);
 assert.doesNotMatch(got,/根拠が不明/);
});
test('real Kawasaki C2: saved same-course win is why rank1, not generic top5 praise',()=>{
 const first={horse_no:6,horse_name:'シェナベスト',rank:1,score:92,
  reason:'9/9川崎1500m2026川崎ジョッキーズカップC2勝ち0.2、10/13川崎1400mC2一二4着0.8、7/30同C2三着0.9、7/8同C2勝ち。今回と同一条件の勝利・現級の鮮度を最重要評価。'};
 const rival={horse_no:1,horse_name:'マロンルピナス',rank:2,score:89,
  reason:'9/9川崎1500m同名2026川崎ジョッキーズカップC2で3着1.2、10/20浦和1400mC2五六2着0.1。今回同名・同場同距離3着と直近連対を評価、10/12川崎1500mC2 6着1.5は反証。'};
 const p={top5:[first,rival]};
 const got=rank.comment(first,p,{track:'川崎'});
 assert.match(got,/^【この順位にした理由】今回と同一条件の勝利/);
 assert.match(got,/9\/9川崎1500m・1着/);
 assert.match(got,/【上位2頭の差】○1とは総合評価で3点差/);
 const two=rank.comment(rival,p,{track:'川崎'});
 assert.match(two,/2着以内を評価/);
 assert.match(two,/【不安・未確認】10\/12川崎1500mC2 6着/);
});
test('real JRA saved short MM/DD reason also works without inventing recent lap data',()=>{
 const r={horse_no:5,horse_name:'検証JRA',rank:1,score:96,
  reason:'10/17京都芝1400m1勝級2着0.1差、6/20阪神芝1600m1勝級2着0.3差、5/16京都芝1400m未勝利勝ち。現級での2走連対と同コース勝利を別々に確認。1月京都芝1600m未勝利12着は過去反証。'};
 const got=rank.comment(r,{top5:[r]},{track:'京都'});
 assert.match(got,/【この順位にした理由】今回と同じクラスでの2走2着以内/);
 assert.match(got,/10\/17京都1400m・2着/);
 assert.match(got,/【不安・未確認】1月京都芝1600m未勝利12着/);
 assert.doesNotMatch(got,/通過順|ラップが確認済み/);
});
test('unrated / no reason never receives an invented explanation',()=>{
 const r={horse_no:2,rank:null,score:null};
 assert.equal(rank.headline(r,{},race),'上位評価の理由が保存されていません');
});
