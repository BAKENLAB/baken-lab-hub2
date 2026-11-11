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
 assert.match(got,/【この順位にした理由】C2上の組の同場距離実績/);
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
 assert.doesNotMatch(got,/【上位2頭の差】/);
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


test('2026-11-11 Sonoda 1R: all saved top5 get concrete reasons, including date-led evaluation sentences',()=>{
 const runners=[
 {horse_no:10,horse_name:'ハギノメルヴェイユ',rank:1,score:84,reason:'10/14園田1400mC3二5着（記録着差0.5）、9/30同C3三2着0.9、9/10同C3三5着1.2。近3走の同場同距離で相手との隔たりが比較的小さく、今回C3三で巻き返しを期待。過去の角通過順は未確認。'},
 {horse_no:3,horse_name:'テーオーモンブラン',rank:2,score:81,reason:'9/23と8/26の園田1400mC3三でともに3着（記録着差0.5）。今回の同条件で複数回の3着内実績を評価。10/29同C3二9着、10/7同C3二7着は近況面の反証。'},
 {horse_no:1,horse_name:'ゴールドプレミアム',rank:3,score:78,reason:'7/29園田1400mC3二2着（記録着差0.0）を評価。10/23と10/1は同C3二で7着1.3、7着2.1と近況低調だが、C3三への組替わりで相手緩和の可能性。'},
 {horse_no:5,horse_name:'シトロネット',rank:4,score:74,reason:'9/18園田1400mC3三3着0.6を今回条件への実績として評価。ただし10/30 C3二10着1.9、10/14同8着2.0、10/1同6着2.1と近走の順位は低い。'},
 {horse_no:4,horse_name:'ワンダーフレックス',rank:5,score:71,reason:'8/26園田1400mC3三5着0.6、9/16同C3三5着1.1、10/22同C3二6着1.5。近走に3着内実績はなく上位根拠は限定的だが、今回の同場同距離経験を評価。'}
 ];
 const p={top5:runners},race={track:'園田',race_name:'C3三3歳以上'};
 const snapshot=JSON.stringify(p);
 const headings=runners.map(r=>rank.headline(r,p,race));
 const details=runners.map(r=>rank.comment(r,p,race));
 assert.match(headings[0],/9\/30園田1400m.*C3三.*2着/);
 assert.match(details[0],/【不安・未確認】過去の角通過順は未確認/);
 assert.match(headings[1],/9\/23・8\/26.*ともに3着/);
 assert.match(details[1],/【不安・未確認】10\/29同C3二9着/);
 assert.match(headings[2],/7\/29園田1400mC3二2着/);
 assert.match(details[2],/【不安・未確認】10\/23と10\/1は同C3二で7着/);
 assert.match(headings[3],/9\/18園田1400mC3三3着/);
 assert.match(details[3],/【不安・未確認】10\/30 C3二10着/);
 assert.match(headings[4],/今回の同じ競馬場・距離経験を評価/);
 assert.match(details[4],/【不安・未確認】近走に3着内実績はなく上位根拠は限定的/);
 for(const text of [...headings,...details]){
  assert.doesNotMatch(text,/上位評価の決め手は保存理由に明記なし|確認できる近走材料が不足|【上位2頭の差】/);
 }
 assert.equal(JSON.stringify(p),snapshot);
});


test('real Nagoya 5R: all five ranks explain their own factual merits, not "no stored reason"',()=>{
 const top=[
 {horse_no:1,horse_name:'アークレオン',rank:1,score:93,
  reason:'10/1名古屋1500mJ認セレクトゴールド第3で2着0.1、10/16同1500m2歳1組特別3着0.5。交流戦の今回条件で地元上位級に通じた新鮮な連対・3着証拠が2件あり、中央札幌1700m大敗は別条件として反証。'},
 {horse_no:7,horse_name:'デナリ',rank:2,score:90,
  reason:'10/29名古屋1500mネオステージフューチャー戦2歳2着0.1、10/16同1500m2歳1組特別6着1.3、7/31同900m新馬勝ち。今回地元ダ1500mへ戻る近況の好走証拠がある。'},
 {horse_no:4,horse_name:'ナガノアリス',rank:3,score:84,
  reason:'9/3名古屋1500mJ認セレクトゴールド第1で2着0.3、7/30同2歳2組1着0.2。上級組への実走水準は実証したが10/29ネクストスター10着3.4、10/16特別9着2.5、9/16認定10着6.5が強い近況反証。'},
 {horse_no:8,horse_name:'ロンリーマン',rank:4,score:81,
  reason:'8/30中京1400m2歳未勝利4着、8/8同1600m2歳未勝利5着。中央2戦で掲示板周辺の素地がある。ただし今回名古屋ダ1500m・左回りから右回りへの転入初戦で、芝・ダートと地区水準の直結は未検証。'},
 {horse_no:6,horse_name:'カローナ',rank:5,score:78,
  reason:'8/8中京1600m2歳未勝利4着、9/27阪神1600m未勝利7着、7/19小倉1800m新馬6着。中央で短い距離の経験あり、今回は名古屋1500m交流のダート適性が未実証で暫定評価。'}
 ];
 const p={top5:top},race={track:'名古屋',race_name:'J交 名古屋チャレンジカップ コメッ2歳'};
 const before=JSON.stringify(p);
 const headlines=top.map(r=>rank.headline(r,p,race));
 const full=top.map(r=>rank.comment(r,p,race));
 for(const str of [...headlines,...full]){
  assert.doesNotMatch(str,/決め手は保存理由に明記なし|確認できる近走材料が不足|【上位2頭の差】/);
 }
 assert.match(headlines[0],/10\/1名古屋1500m・2着/);
 assert.match(headlines[0],/10\/16名古屋1500m・3着/);
 assert.match(full[0],/【不安・未確認】中央札幌1700m大敗は別条件として反証/);
 assert.match(headlines[1],/地元ダ1500mへ戻る近況の好走証拠/);
 assert.match(headlines[2],/9\/3名古屋1500m・2着/);
 assert.match(headlines[2],/7\/30名古屋1500m・1着/);
 assert.match(full[2],/【不安・未確認】10\/29ネクストスター10着/);
 assert.match(headlines[3],/8\/30中京1400m・4着/);
 assert.match(headlines[3],/中央2戦で掲示板周辺の素地/);
 assert.match(full[3],/【不安・未確認】今回名古屋ダ1500m/);
 assert.match(full[4],/ダート適性が未確認/);
 assert.equal(JSON.stringify(p),before);
});
test('mixed strength + risk in same sentence stays separated without inventing race data',()=>{
 const h={horse_no:3,rank:3,score:83,
  reason:'10/2名古屋1500m2歳一2着、10/15同3着。上位クラスで2着と3着の実績あり、直近特別戦で大敗は不安材料。'};
 const got=rank.comment(h,{top5:[h]},{track:'名古屋'});
 assert.match(got,/【この順位にした理由】上位クラスで2着と3着の実績あり/);
 assert.match(got,/【不安・未確認】直近特別戦で大敗は不安材料/);
 assert.doesNotMatch(got,/確認できる近走材料が不足/);
});
