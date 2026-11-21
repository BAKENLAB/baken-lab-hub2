import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../lab-rank-compare.js',import.meta.url), 'utf8');
const browser = {window:{}};
vm.runInNewContext(src,browser,{filename:'lab-rank-compare.js'});
const rank=browser.window.LabRankCompare;
const base=[
 {horse_no:1,horse_name:'カラバッシュ',rank:1,score:94,reason:'高知ファイナルC3-20、稍重ダ1400mに対する独立評価。11/08高知C3-14 1600m2着0.6差で1角1番手→最終角1番手。10/25高知C3-17 1400m3着0.8差。今回1400mでも近距離で連続好走する現在性は高い。 直近3走：11-08高知1600m2着。実ラップ未検証。'},
 {horse_no:7,horse_name:'ソックス',rank:2,score:89,reason:'10/24高知ファイナルC3-19 1400m3着0.3差、5番手→最終角3番手。11/07高知C3-10 1300m5着2.4差。9/12高知1400mでも8番手→5番手の実証があり、今回の位置を押し上げる再現性が強い。 直近3走：10/24高知1400m3着。'},
 {horse_no:8,horse_name:'メイショウゴウケツ',rank:3,score:85,reason:'11/08高知C3-15 1300m4着1.5差、10/24高知C3-12 1400m4着0.9差。10/11は10番手→6番手、9/26は10番手→4番手と複数レースで中盤の位置進出が実証される。 直近3走：11/08高知1300m4着。'},
 {horse_no:10,horse_name:'シデンイッセン',rank:4,score:82,reason:'10/24高知ファイナルC3-19 1400m4着0.5差・上がり39.6、11番手→5番手の6ポジション進出が確認できる。9/12高知ファイナル1400m2着0.7差もある。一方11/07高知C3-11 1300m7着2.5差で直近は不安定。 直近3走：10/24高知1400m4着。'},
 {horse_no:11,horse_name:'ジョウショーブリエ',rank:5,score:78,reason:'10/10高知C3-11 1300m3着0.9差・上がり39.1、9/26高知3歳-1 1300m2着0.4差。 直近3走：11/07高知1300m6着。'},
 {horse_no:3,horse_name:'フウリンカザン',rank:6,score:76,reason:'11/07高知C3-10 1300m3着2.1差。 直近3走：11/07高知1300m3着。'}
];
const audit={
 official_past_content_audit:{status:'VERIFIED_WHOLE_FIELD_FACTS'},
 honmei_review:{reason:'①11/08高知1600m2着。⑦前回高知ファイナル3着。①の近2走連続3着内を重視、⑦の差し能力が対抗。'},
 boundary_review:{reason:'5位⑪10/10高知1300m3着。6位③は前走3着も1400m9着。近距離での2走の接戦内容を採り⑪を僅かに上位としたが2点差で不確実。'}
};
const payload={runners:base,top5:base.slice(0,5),eye:null,audit};

test('first rank explains saved choice before one concrete race and score comparison',()=>{
 const snapshot=JSON.stringify(payload);
 const text=rank.comment(base[0],payload,{track:'高知'});
 assert.match(text,/^高知の1600mで2着/);
 assert.match(text,/2位のソックスとの評価点差は5点/);
 assert.match(text,/高知の1400mで3着/);
 assert.doesNotMatch(text,/実ラップ未検証|直近3走：/);
 assert.equal(JSON.stringify(payload),snapshot);
});

test('rank 2 and rank 3 keep the individual reason, not a generic date list',()=>{
 assert.match(rank.headline(base[1],payload,{}),/道中で位置を上げる走り/);
 const three=rank.comment(base[2],payload,{});
 assert.match(three,/道中で位置を上げる走り/);
 assert.match(three,/2位のソックスにも高知の1400mで3着/);
 assert.doesNotMatch(three,/順位差の採点内訳は保存記録だけでは特定できません/);
});

test('rank 5 explains the TOP5 boundary against rank 6, not rank 4',()=>{
 const fifth=rank.comment(base[4],payload,{});
 assert.match(fifth,/6位のフウリンカザン/);
 assert.match(fifth,/2点差/);
 assert.doesNotMatch(fifth,/☆4位 82点/);
});

test('JRA shows frozen 78 points despite old intermediate 77-point string',()=>{
 const first={horse_no:6,rank:1,score:81,reason:'08-29札幌芝2000m2勝クラス2着0.2差。今回京都良芝2000m 2勝クラスとの近距離4走・0.7秒以内3走。基礎46点に根拠別効果+35点で81点。Eval1,942相関を確認。'};
 const second={horse_no:1,rank:2,score:78,reason:'08-30中京芝2200m2勝クラス3着0.2差。今回京都良芝2000m 2勝クラスとの近距離4走・0.7秒以内4走。基礎39点に根拠別効果+38点で77点。Eval1,942相関を確認。【補正】最終78点。'};
 const got=rank.comment(second,{runners:[first,second],top5:[first,second]}, {});
 assert.match(got,/○2位 78点 ／ ◎1位 81点/);
 assert.doesNotMatch(got,/77点|基礎39点/);
});

test('legacy, unrated and EYE comments still use established handlers',()=>{
 const legacy={horse_no:2,rank:3,reason:'9/15園田1400mC3で3着。同距離好走を評価。'};
 assert.match(rank.comment(legacy,{runners:[legacy],top5:[legacy]},{}),/根拠となる過去走/);
 const noRank={horse_no:3,rank:null,reason:''};
 assert.match(rank.headline(noRank,{},{}),/保存されていません/);
});

test('TODAY and RESULT use the revised reason helper and readable text',()=>{
 for(const name of ['today.html','result.html']){
  const html=readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.match(html,/lab-rank-compare\.js\?v=20261121-jra-all-surfaces-v2/);
  assert.match(html,/\.runner-headline\{[^}]*font-size:12px/);
 }
});
