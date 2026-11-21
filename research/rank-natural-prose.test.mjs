import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync(new URL('../lab-rank-compare.js',import.meta.url),'utf8');
const env={window:{}};
vm.runInNewContext(src,env,{filename:'lab-rank-compare.js'});
const view=env.window.LabRankCompare;
const rank3=[
 {horse_no:8,horse_name:'アルテクィーン',rank:1,score:85,reason:'09-19阪神ダート1400m 7着・1.6秒差、08-30札幌芝1200m 2着・0.2秒差、07-19函館芝1200m 8着・0.9秒差。芝1200m±200mの実走3走、0.6秒差以内2走、3着内2走、3番手以内2走。公式照合済みの通過1 1、上がり34.6秒・2位を確認。'},
 {horse_no:17,horse_name:'カツダルマ',rank:2,score:83,reason:'09-21阪神芝1200m 2着・0.9秒差、08-16中京芝1200m 3着・0秒差、06-20阪神芝1400m 5着・0.3秒差。芝1200m±200mの実走3走、0.6秒差以内2走、3着内2走、3番手以内1走。公式照合済みの通過8 8、上がり32.9秒・1位を確認。'},
 {horse_no:4,horse_name:'スマートエール',rank:3,score:57,reason:'09-26阪神芝1400m 10着・1.3秒差、09-05阪神芝1400m 2着・0秒差。芝1200m±200mの実走2走、0.6秒差以内1走、3着内1走、3番手以内2走。'},
 {horse_no:1,horse_name:'ヤマニンアルセド',rank:5,score:53,reason:'09-26阪神芝1400m 6着・0.9秒差、09-06阪神芝1400m 6着・0.6秒差、06-28福島芝1200m 5着・2秒差。芝1200m±200mの実走3走、0.6秒差以内1走、3着内0走、3番手以内1走。条件近傍の大敗を減点。'},
 {horse_no:6,horse_name:'スピリッツ',rank:6,score:52,reason:'09-12札幌芝1200m 3着・0.4秒差。芝1200m±200mの実走1走、0.6秒差以内1走、3着内1走。'}
];
const jra={runners:rank3,top5:rank3.slice(0,4),eye:null,audit:{}};

test('Kyoto 3R: leader is explained in natural Japanese, never raw counters',()=>{
 const original=JSON.stringify(jra);
 const head=view.headline(rank3[0],jra,{track:'京都',race_no:3});
 const detail=view.comment(rank3[0],jra,{track:'京都',race_no:3});
 assert.match(head,/札幌の芝1200mで2着/);
 assert.match(head,/前で運んだ記録/);
 assert.match(detail,/直近の阪神のダート1400mで7着/);
 assert.match(detail,/カツダルマにも阪神の芝1200mで2着/);
 assert.doesNotMatch(head,/実走3走|0\.6秒差以内|3着内2走|【/);
 assert.doesNotMatch(head,/道中で位置を上げる走り/);
 assert.equal(JSON.stringify(jra),original);
});

test('Kyoto 3R: rival has two legitimate grass podiums, not made-up pace',()=>{
 const head=view.headline(rank3[1],jra,{track:'京都',race_no:3});
 assert.match(head,/阪神の芝1200mで2着/);
 assert.match(head,/中京の芝1200mで3着/);
 assert.doesNotMatch(head,/逃げ|先頭|上がり32\.9秒を使って勝利/);
});

test('Kyoto 3R: old podium never hides a latest tenth, fifth is conservative',()=>{
 const third=view.comment(rank3[2],jra,{track:'京都',race_no:3});
 assert.match(third,/阪神の芝1400mで2着/);
 assert.match(third,/直近の阪神の芝1400mで10着/);
 const fifth=view.comment(rank3[3],jra,{track:'京都',race_no:3});
 assert.match(fifth,/3着以内は保存走歴から確認できない/);
 assert.match(fifth,/6位のスピリッツ/);
});

const localRunners=[
 {horse_no:1,horse_name:'カラバッシュ',rank:1,score:94,reason:'高知ファイナルC3-20、稍重ダ1400mに対する独立評価。11/08高知C3-14 1600m2着0.6差で1角1番手→最終角1番手、上がり40.4と先行持続を確認。10/25高知C3-17 1400m3着0.8差、10/11高知1300m5着1.1差。今回1400mでも近距離で連続好走する現在性は全頭中高い。別距離1600mの逃げ1走のみで今回も逃げ確定とはしない。 直近3走：11-08 高知1600m C3-14 2着、差0.6。'},
 {horse_no:7,horse_name:'ソックス',rank:2,score:89,reason:'高知ファイナルC3-20、稍重ダ1400mに対する独立評価。10/24高知ファイナルC3-19 1400m3着0.3差、5番手→最終角3番手。11/07高知C3-10 1300m5着2.4差は③3着に直接後着したが6番手→4番手。9/12高知1400mでも8番手→5番手の実証があり、今回の位置を押し上げる再現性が強い。今回は逃げの推定をしない。 直近3走：11-07 高知1300m C3-10 5着、差2.4。'},
 {horse_no:8,horse_name:'メイショウゴウケツ',rank:3,score:85,reason:'高知ファイナルC3-20、稍重ダ1400mに対する独立評価。11/08高知C3-15 1300m4着1.5差、10/24高知C3-12 1400m4着0.9差、9/12高知1400m2着1.7差。10/11は10番手→6番手、9/26は10番手→4番手、9/12は6番手→2番手と複数レースで中盤の位置進出が実証される。 直近3走：11-08 高知1300m C3-15 4着、差1.5。'},
 {horse_no:11,horse_name:'ジョウショーブリエ',rank:5,score:78,reason:'高知ファイナルC3-20、稍重ダ1400mに対する独立評価。10/10高知C3-11 1300m3着0.9差、9/26高知3歳-1 1300m2着0.4差。 直近3走：11-07 高知1300m C3-10 6着、差2.4。'},
 {horse_no:3,horse_name:'フウリンカザン',rank:6,score:76,reason:'高知ファイナルC3-20、稍重ダ1400mに対する独立評価。11/07高知C3-10 1300m3着2.1差。 直近3走：11-07 高知1300m3着、差2.1。'}
];
const local={runners:localRunners,top5:localRunners.slice(0,4),eye:null,audit:{official_past_content_audit:{status:'VERIFIED_WHOLE_FIELD_FACTS'}}};
test('Kochi final: rank1 is a front-runner, rank2 and rank3 can gain position',()=>{
 const first=view.headline(localRunners[0],local,{track:'高知'});
 const two=view.comment(localRunners[1],local,{track:'高知'});
 const three=view.headline(localRunners[2],local,{track:'高知'});
 assert.match(first,/前で運んだ記録/);
 assert.doesNotMatch(first,/道中で位置を上げる走り/);
 assert.match(two,/道中で位置を上げる走り/);
 assert.match(two,/直近の高知の1300mで5着/);
 assert.match(three,/道中で位置を上げる走り/);
 assert.doesNotMatch(two,/【この順位|過去の着順.*羅列/);
});
test('Kochi final: fifth-sixth gap retains the actual archived scores',()=>{
 const note=view.comment(localRunners[3],local,{track:'高知'});
 assert.match(note,/6位のフウリンカザン/);
 assert.match(note,/2点差/);
});
test('non-verified legacy and independently selected EYE retain existing behavior',()=>{
 const legacy={horse_no:4,rank:4,reason:'10/14名古屋1400mC3で2着。同距離好走を評価。'};
 assert.match(view.comment(legacy,{runners:[legacy],top5:[legacy]},{}),/根拠となる過去走/);
 const eye={horse_no:11,rank:6,reason:'10/10同距離2着で好走'};
 const selection={eye:{horse_no:11,reason:'10/10同距離2着と条件好転'},top5:[],runners:[eye],audit:{}};
 assert.doesNotMatch(view.headline(eye,selection,{}),/位に置いた/);
});
test('the two HUB pages load the natural-voice helper in a fresh cache version',()=>{
 for(const path of ['today.html','result.html']){
  const h=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(h,/lab-rank-compare\.js\?v=20261121-natural-prose-v1/);
 }
});
