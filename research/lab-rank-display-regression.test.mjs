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
 assert.match(got,/【この順位にした理由】評価理由の要約に失敗。詳細で保存済みの原文を確認/);
 assert.match(got,/【保存理由の原文】過去走は複数の同場1400m実走/);
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
 assert.match(full[0],/【不安・未確認】中央札幌1700m大敗は別条件として不安材料/);
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

test('JRA maiden fourth and fifth are never parsed as victories',()=>{
 const h={horse_no:8,rank:4,reason:'8/30中京1400m2歳未勝利4着、8/8同1600m2歳未勝利5着。中央2戦で掲示板周辺の素地がある。'};
 const p={top5:[h]},detail=rank.comment(h,p,{track:'名古屋'});
 assert.match(detail,/8\/30中京1400m・4着/);
 assert.match(detail,/8\/8中京1600m・5着/);
 assert.doesNotMatch(detail,/中京1400m・1着|中京1600m・1着/);
});
test('EYE positive evidence is not inverted with its negative counterexample',()=>{
 const h={horse_no:1,horse_name:'サンウイング',rank:6,
 reason:'10/2園田1400mC2二勝利と8/13同C2二3着という別日の好走証拠2件。10/21同C2一6着1.1は反証だが今回同条件の3着圏再浮上余地を検討。'};
 const p={top5:[],eye:h},detail=rank.comment(h,p,{track:'園田'});
 assert.match(detail,/【EYEに選んだ理由】10\/2園田1400m・1着、8\/13園田1400m・3着/);
 assert.match(detail,/【不安・未確認】10\/21同C2一6着/);
 assert.doesNotMatch(detail,/【EYEに選んだ理由】10\/21/);
});
test('EYE date results after the sixth-place prefix are extracted',()=>{
 const h={horse_no:4,rank:6,reason:'TOP5外6位。8/26園田1400mC2二1着と8/5同C2二3着0.7差という別々の公式実走証拠があり、今回C3一への相手緩和で再浮上余地。直近C2一で3走連続7〜8着という反証があり過信しない。'};
 const p={top5:[],eye:h},detail=rank.comment(h,p,{track:'園田'});
 assert.match(detail,/8\/26園田1400m・1着/);
 assert.match(detail,/8\/5園田1400m・3着/);
 assert.match(detail,/【不安・未確認】直近C2一で3走連続7〜8着/);
});
test('EYE two documented factors include meaningful promotion caution',()=>{
 const h={horse_no:7,rank:7,reason:'10/28門別1000mC4-2 3着0.1という今回同級同距離の実走に、9/30同場同距離C4-3勝利の別走証拠を加え2因子として監査。直近1200m4着と昇級リスクも明記。'};
 const p={top5:[],eye:h},detail=rank.comment(h,p,{track:'門別'});
 assert.match(detail,/【EYEに選んだ理由】10\/28門別1000m・3着/);
 assert.match(detail,/9\/30門別1000m・1着/);
 assert.match(detail,/【不安・未確認】直近1200m4着と昇級リスク/);
});
test('hyphenated JRA prior result remains a sixth, not a first',()=>{
 const h={horse_no:3,rank:2,reason:'10-17京都芝1800m6着・勝馬差1秒・序盤8番手。京都芝1800m新馬6着1.0秒差、2000m延長・相手比較は不確実。'};
 const detail=rank.comment(h,{top5:[h]},{track:'京都'});
 assert.match(detail,/10\/17京都1800m・6着/);
 assert.doesNotMatch(detail,/10\/17京都1800m・1着/);
});

test('adjacent rank comparison cites both actual classes without re-ranking or claiming an ability advantage',()=>{
 const first={horse_no:1,horse_name:'C4-2実績',rank:2,reason:'10/6門別1000mC4-2 2着0.2。今回同級の連対を評価。'};
 const second={horse_no:2,horse_name:'C4-3実績',rank:3,reason:'10/27門別1000mC4-3 1着0.8。今回昇級初戦で相手強化が懸念。'};
 const p={top5:[first,second]},before=JSON.stringify(p);
 const got=rank.comment(second,p,{track:'門別'});
 assert.match(got,/▲C4-3実績：10\/27門別1000mC4-3・1着/);
 assert.match(got,/○C4-2実績：10\/6門別1000mC4-2・2着/);
 assert.match(got,/順位差の採点理由を断定するものではありません/);
 assert.equal(JSON.stringify(p),before);
});
test('rank one compares to rank two, not to an unrelated horse',()=>{
 const one={horse_no:1,rank:1,reason:'10/14名古屋1500mA4特別3着0.4。今回同級距離で直近好走。'};
 const two={horse_no:2,rank:2,reason:'9/4名古屋1500mA4特別2着0.3。A4で連対。'};
 const three={horse_no:3,rank:3,reason:'10/5名古屋1400mB1勝ち。'};
 const got=rank.comparison(one,{top5:[three,one,two]},{track:'名古屋'});
 assert.match(got,/◎1：10\/14名古屋1500mA4・3着/);
 assert.match(got,/○2：9\/4名古屋1500mA4・2着/);
 assert.doesNotMatch(got,/▲3/);
});
test('top5 comparison is hidden rather than fabricating history when a rival has no saved dated run',()=>{
 const one={horse_no:1,rank:1,reason:'過去走の内容は確認できない。'};
 const two={horse_no:2,rank:2,reason:'10/1門別1000mC4-2 3着。'};
 assert.equal(rank.comparison(one,{top5:[one,two]},{}),'');
});
test('generic headline gains an actual race, specific condition rationale is retained',()=>{
 const generic={horse_no:1,rank:2,reason:'10/14名古屋1500mA4特別3着0.4。今回A4への通用を示す同距離3着が直近にある。'};
 const specific={horse_no:2,rank:1,reason:'10/27金沢1400mC2二4着。今回C2十四特別編成へ条件変更するため上のC2二での近接実績を最重要視。'};
 assert.match(rank.headline(generic,{top5:[generic]},{}),/^10\/14名古屋1500m・3着/);
 assert.match(rank.headline(specific,{top5:[specific]},{}),/^今回C2十四特別編成/);
});

test('same-date same-track distance and class records take priority over each horse best finish',()=>{
 const one={horse_no:1,horse_name:'オッシレイション',rank:1,reason:'10/14名古屋1500mA4特別3着0.4、9/1名古屋1500mB1勝ち。今回A4同距離3着を評価。'};
 const two={horse_no:2,horse_name:'ドラゴステ',rank:2,reason:'10/14名古屋1500mA4特別4着0.5、9/4同距離A4特別2着0.3。今回A4で連対歴を評価。'};
 const p={top5:[one,two]},before=JSON.stringify(p);
 const got=rank.comparison(one,p,{track:'名古屋'});
 assert.match(got,/同条件の記録を比較/);
 assert.match(got,/◎オッシレイション：10\/14名古屋1500mA4・3着/);
 assert.match(got,/○ドラゴステ：10\/14名古屋1500mA4・4着/);
 assert.doesNotMatch(got,/○ドラゴステ：9\/4/);
 assert.equal(JSON.stringify(p),before);
});
test('different class or year never becomes same-condition comparison',()=>{
 const first={horse_no:1,rank:1,reason:'2025-10-14名古屋1500mA4特別3着。'};
 const second={horse_no:2,rank:2,reason:'2026-10-14名古屋1500mA4特別4着。'};
 const third={horse_no:3,rank:2,reason:'2025-10-14名古屋1500mB4特別4着。'};
 assert.doesNotMatch(rank.comparison(first,{top5:[first,second]},{}),/同条件の記録を比較/);
 assert.doesNotMatch(rank.comparison(first,{top5:[first,third]},{}),/同条件の記録を比較/);
});


// Actual Kanazawa 8R (2026-11-16): both positive conditions must survive
// the display proxy, and the seventh place must stay in the risk section.
const mystic={horse_no:6,horse_name:'ミスティックパワー',rank:6,grade:'C',reason:'11/4 C1三1400m6着、⑨と同時計で②に先着、上がり39.6。9/22 C1四1400m7着。10/20不良1500m7着で⑨に後着。今回C1七への組替わりと57→54kg軽減に注目。'};
const eye8={horse_no:6,rank:6,horse_name:mystic.horse_name,reason:'11/4 C1三から今回C1七への組替わり。 前走57kgから54kgへ3kg軽減。 10/20不良1500m7着'};
const kan8={runners:[mystic],top5:[],eye:eye8,audit:{partial_coverage:false,
 eye_positive_factor_audit:[{horse_no:6,positive_factors:[
 {category:'class_change',reason:'11/4 C1三から今回C1七への組替わり。',current_relevance:true,evidence_refs:['verified source']},
 {category:'weight_change',reason:'前走57kgから54kgへ3kg軽減。',current_relevance:true},
 {category:'old',reason:'古い材料',current_relevance:false}]},
 {horse_no:2,positive_factors:[{reason:'別の馬の理由',current_relevance:true}]}],
 eye_candidate_audit:[{horse_no:6,eye_case:true,hidden_evidence:'11/4 C1三1400mで②⑨に先着',finish_path:'斤量減で11/4の同距離内容を上回れば上位争い',risk:'10/20不良1500m7着',review_checks:{private:'large'}},
 {horse_no:2,eye_case:false,risk:'別の馬の不安'}]}};
test('Kanazawa 8 EYE: saved factors and risk are separate, both card and rank read the same decision',async()=>{
 const {displayPrediction}=await import('../api/hub-data.js');
 const p={payload:kan8,integrity:{saved:kan8,version:1}},before=JSON.stringify(p);
 const view=displayPrediction(p),a=view.payload.audit;
 assert.equal(a.eye_positive_factor_audit.length,1);
 assert.equal(a.eye_positive_factor_audit[0].positive_factors.length,2);
 assert.equal(a.eye_candidate_audit.length,1);
 assert.equal(a.eye_candidate_audit[0].review_checks,undefined);
 assert.equal(view.integrity.saved,undefined);
 for(const r of [mystic,{...mystic,...eye8}]){
  const detail=rank.comment(r,view.payload,{track:'金沢'});
  assert.match(detail,/^【EYEに選んだ理由】11\/4 C1三から今回C1七への組替わり。前走57kgから54kgへ3kg軽減。/);
  assert.match(detail,/【根拠となる過去走・材料】11\/4 C1三1400mで②⑨に先着/);
  assert.match(detail,/【不安・未確認】10\/20不良1500m7着/);
  assert.doesNotMatch(detail.split('\n')[0],/7着|出走記録を参照/);
  assert.doesNotMatch(detail,/別の馬|古い材料/);
 }
 assert.equal(JSON.stringify(p),before);
});
test('Kanazawa 8 older stripped API: preserve two explicit conditions, no losing finish as selection reason',()=>{
 const p={...kan8,audit:{partial_coverage:false}};
 const got=rank.comment({...mystic,...eye8},p,{track:'金沢'});
 assert.match(got,/組替わり。前走57kgから54kgへ3kg軽減/);
 assert.match(got,/【保存された補足・原文】10\/20不良1500m7着/);
 assert.doesNotMatch(got.split('\n')[0],/7着|出走記録を参照/);
});
test('EYE with only poor past result cannot claim this as the selection reason',()=>{
 const r={horse_no:7,rank:7,reason:'10/20金沢1500m7着。'};
 const p={runners:[r],top5:[],eye:r},got=rank.comment(r,p,{});
 assert.match(got,/^【EYEに選んだ理由】保存された肯定材料を判別できません/);
 assert.match(got,/【参考過去走】10\/20金沢1500m・7着/);
 assert.doesNotMatch(got.split('\n')[0],/7着|出走記録を参照/);
});
test('display proxy preserves partial flag but no EYE audit when abstained',async()=>{
 const {displayPrediction}=await import('../api/hub-data.js');
 const v=displayPrediction({payload:{...kan8,eye:null,audit:{...kan8.audit,partial_coverage:true}}});
 assert.deepEqual(v.payload.audit,{partial_coverage:true});
});


test('current audited LOCAL note leads with the recorded judgment rather than five runs',()=>{
 const r={horse_no:6,rank:1,reason:'10/30大井稍重1200m C3一二勝利1:14.4・上がり37.4、10/6良1200m C3一等勝利1:14.3。9/17不良1200m5着0.7差、9/3良5着0.4差、8/17重8着。近2走の同距離連勝を評価するがC2再昇級と重馬場での再現性が課題。 個別不利・全ラップ・対戦相手後続実績は未確認。 通過順未取得。'};
 const p={runners:[r],top5:[r],eye:null},snap=JSON.stringify(p);
 assert.match(rank.headline(r,p,{}),/^近2走の同距離連勝を評価/);
 const detail=rank.comment(r,p,{});
 assert.match(detail,/根拠：10\/30大井稍重1200m.*10\/6良1200m/);
 assert.match(detail,/注意：C2再昇級と重馬場/);
 assert.doesNotMatch(detail,/個別不利|全ラップ|通過順未取得|8\/17/);
 assert.equal(JSON.stringify(p),snap);
});
test('current EYE uses two recorded current factors and separates the contrary finish',()=>{
 const r={horse_no:6,rank:6,reason:'10/20不良1500m7着。 個別不利・全ラップ・相手後続未確認。'};
 const eye={horse_no:6,rank:6,reason:'11/4 C1三から今回C1七への組替わり。 前走57kgから54kgへ3kg軽減。 10/20不良1500m7着'};
 const p={runners:[r],top5:[],eye,audit:{eye_positive_factor_audit:[{horse_no:6,positive_factors:[{reason:'11/4 C1三から今回C1七への組替わり。',current_relevance:true},{reason:'前走57kgから54kgへ3kg軽減。',current_relevance:true},{reason:'除外される古い因子',current_relevance:false}]}],eye_candidate_audit:[{horse_no:6,eye_case:true,finish_path:'条件好転で巻き返せれば浮上',risk:'10/20不良1500m7着'}]}};
 const snap=JSON.stringify(p),head=rank.headline(eye,p,{}),detail=rank.comment(eye,p,{});
 assert.match(head,/C1三から今回C1七/);
 assert.match(head,/57→54kg/);
 assert.doesNotMatch(head,/7着|古い因子/);
 assert.match(detail,/期待する走り：条件好転/);
 assert.match(detail,/注意：10\/20不良1500m7着/);
 assert.equal(JSON.stringify(p),snap);
});
test('missing narrative is not converted into unrecorded praise',()=>{
 const r={horse_no:2,rank:3,reason:'11/3金沢1500m7着。 個別不利・全ラップ・相手後続未確認。'};
 const p={runners:[r],top5:[r]};
 assert.equal(rank.headline(r,p,{}),'評価の決め手は原文で確認');
 assert.match(rank.comment(r,p,{}),/保存された評価理由：11\/3金沢1500m7着/);
 assert.doesNotMatch(rank.comment(r,p,{}),/勝ち負け|期待|全ラップ/);
});
