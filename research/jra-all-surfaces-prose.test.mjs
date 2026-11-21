import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync(new URL('../lab-rank-compare.js',import.meta.url),'utf8');
const env={window:{}};
vm.runInNewContext(src,env,{filename:'lab-rank-compare.js'});
const view=env.window.LabRankCompare;

const kyoto1=[
 {horse_no:8,horse_name:'クリコリンダ',rank:1,score:59,
 reason:'11-14京都ダート1400m2着0.5秒差、10-31京都ダート1400m8着1.5秒差。今回ダート1400m±300mの実走2走（0.6秒差以内1走、3着以内1走、3番手以内0走）。複数実走を比較。前走からの間隔が短く反動は未確認。'},
 {horse_no:13,horse_name:'ラッキーハナコ',rank:2,score:55,
 reason:'11-01京都ダート1400m3着0.5秒差、10-17京都芝1200m6着0.6秒差、10-04京都芝1600m6着1.6秒差。今回ダート1400m±300mの実走1走（0.6秒差以内1走、3着以内1走、3番手以内0走）。比較可能な実走は1走のみ。'},
 {horse_no:12,horse_name:'スカイランデヴー',rank:3,score:33,
 reason:'10-10京都ダート1200m6着1.4秒差。今回ダート1400m±300mの実走1走（0.6秒差以内0走、3着以内0走、3番手以内1走）。比較可能な実走は1走のみ。'},
 {horse_no:11,horse_name:'オンアロール',rank:4,score:32,
 reason:'11-01京都ダート1400m6着1.4秒差、10-12京都ダート1400m9着2.2秒差、07-25新潟ダート1200m11着1.9秒差。今回ダート1400m±300mの実走3走（0.6秒差以内0走、3着以内0走、3番手以内1走）。複数実走を比較。同条件近傍の大敗は減点。'},
 {horse_no:7,horse_name:'ホットハニーラグ',rank:5,score:30,
 reason:'11-01京都ダート1400m4着1秒差、09-26阪神ダート1800m7着6.2秒差、09-20阪神ダート1200m6着1.8秒差。今回ダート1400m±300mの実走2走（0.6秒差以内0走、3着以内0走、3番手以内0走）。複数実走を比較。同条件近傍の大敗は減点。'},
 {horse_no:14,horse_name:'スターリーデー',rank:6,score:30,
 reason:'09-21阪神芝1600m7着0.7秒差、08-16新潟芝1600m8着0.9秒差、06-20東京芝1400m6着1.4秒差。今回ダート1400m±300mの実走0走（0.6秒差以内0走、3着以内0走、3番手以内0走）。近距離ダートでの実績は未確認。'}
];
const p={runners:kyoto1,top5:kyoto1.slice(0,5),eye:null};
const race={track:'京都',race_no:1};
const banned=/【この順位にした理由】|【根拠となる過去走】|ダート1400m±300m|実走\d+走|0\.6秒差以内\d+走|3着以内\d+走|3番手以内\d+走/;

test('Kyoto 1R: old metric block becomes a proper evidence-grounded Japanese explanation',()=>{
 const before=JSON.stringify(p);
 const head=view.headline(kyoto1[0],p,race),detail=view.comment(kyoto1[0],p,race);
 assert.match(head,/前走は京都ダート1400mで2着/);
 assert.match(head,/2走前の同条件8着から前走では2着まで着順を上げ/);
 assert.match(detail,/前走からの間隔が短く、反動/);
 assert.match(detail,/ラッキーハナコにも京都ダート1400mで3着/);
 assert.match(detail,/4点差/);
 assert.doesNotMatch(head,banned);
 assert.doesNotMatch(detail,banned);
 assert.equal(JSON.stringify(p),before);
});

test('Kyoto 1R: 2nd to 5th are natural Japanese, never fabricate a podium',()=>{
 for(const x of kyoto1.slice(1,5)){
  const head=view.headline(x,p,race),detail=view.comment(x,p,race);
  assert.match(head,/着|条件/);
  assert.match(head,/(?:\d位(?:とした|の評価|評価としている)|\d位とした)/);
  assert.doesNotMatch(head,banned);
  assert.doesNotMatch(detail,banned);
 }
 const third=view.headline(kyoto1[2],p,race);
 assert.match(third,/これまでの最高着順は6着/);
 assert.doesNotMatch(third,/3着.*好走/);
 const last=view.comment(kyoto1[4],p,race);
 assert.match(last,/評価点は同点/);
});

test('Fukushima 2R: no 今回 keyword format also becomes prose and venue correctly',()=>{
 const first={horse_no:1,horse_name:'検証馬A',rank:1,score:76,
  reason:'08-30札幌ダート1000m1勝クラス3着・0.1秒差、08-08札幌ダート1000m1勝クラス6着・1.1秒差、07-19函館ダート1000m1勝クラス2着・0.1秒差。ダート1150m近傍の実走4走、同級0.6秒差以内3走・同級3着以内3走、同条件近傍で3番手以内3走。'};
 const other={horse_no:2,horse_name:'検証馬B',rank:2,score:70,
  reason:'09-26中山ダート1200m1勝クラス2着0.3秒差。ダート1150m近傍の実走1走。'};
 const q={runners:[first,other],top5:[first,other]};
 assert.match(view.headline(first,q,{track:'福島'}),/札幌ダート1000mで3着、函館ダート1000mで2着/);
 assert.doesNotMatch(view.headline(first,q,{track:'福島'}),banned);
});

test('Fukushima course is parsed correctly, not labelled unknown',()=>{
 const first={horse_no:3,horse_name:'検証馬',rank:1,score:79,
  reason:'11-08福島芝1800m1勝ク、3着・0.2秒差、通過4-4-4-4。09-05中山芝1600m未勝利、1着・0秒差。今回1勝クラス・重芝1800m、同馬場近距離の有効実走4。'};
 const q={runners:[first],top5:[first]};
 const text=view.headline(first,q,{track:'福島'});
 assert.match(text,/福島芝1800mで3着/);
 assert.doesNotMatch(text,/競馬場未記録/);
});

test('legacy and EYE remain outside the JRA prose converter',()=>{
 const legacy={horse_no:5,rank:4,reason:'10/14園田1400mC3で3着。今回同距離実績を評価。'};
 assert.match(view.comment(legacy,{runners:[legacy],top5:[legacy]},{}),/根拠となる過去走/);
 const e={horse_no:9,rank:6,reason:'10/10同距離2着で好走'};
 assert.doesNotMatch(view.headline(e,{eye:{horse_no:9,reason:'10/10同距離2着'},runners:[e],top5:[]},{}),/6位の評価/);
});

test('TODAY and RESULT reference the corrected all-JRA narrative code',()=>{
 for(const page of ['today.html','result.html']){
  const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');
  assert.match(html,/lab-rank-compare\.js\?v=20261121-jra-all-surfaces-v2/);
 }
});
