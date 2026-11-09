import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyNarOfficialPodium} from '../automation/nar-official-podium-guard.mjs';

const row=(finish,horse_no,horse_name,time)=>({...{finish,horse_no,horse_name},...(time?{time}:{})});
const result=(finishers,combinations=['8'])=>({
  finishers,
  payouts:{win:combinations.map(combination=>({combination,payout_yen:370}))}
});
const check=(finishers,combinations)=>verifyNarOfficialPodium({
  source:'NAR_OFFICIAL_RACEMARK',result:result(finishers,combinations)
});

test('2026-11-09 Saga 8R: ignores false first row and protects real 8-4-9 podium',()=>{
 const x=check([
  row(1,1,'カッサンドラ'),
  row(1,8,'フクノスナノバラ','1:22.3'),
  row(2,4,'ライジングハース','1:23.0'),
  row(3,9,'ノブノリオウ','1:23.1')
 ]);
 assert.equal(x.status,'VERIFIED');
 assert.deepEqual(x.podium_horse_nos,[8,4,9]);
 assert.deepEqual(x.ignored_duplicate_first_horse_nos,[1]);
 assert.equal(x.correction_applied,true);
 assert.equal(x.rank_effect,false);
});
test('2026-11-09 Saga 11R: ignores erroneous extra 1 and verifies actual 8-10-6',()=>{
 const x=check([
  row(1,1,'テイエムタワードン'),
  row(1,8,'デッドフレイ','2:02.9'),
  row(2,10,'シトリンテソーロ','2:03.2'),
  row(3,6,'ウインユアソング','2:03.6')
 ]);
 assert.deepEqual(x.podium_horse_nos,[8,10,6]);
});
test('official payout is sufficient when valid first-row time is missing',()=>{
 const x=check([row(1,8,'勝馬'),row(2,2,'二着'),row(3,3,'三着')]);
 assert.equal(x.status,'VERIFIED');
 assert.deepEqual(x.podium_horse_nos,[8,2,3]);
});
test('never accept the first finish=1 when the official win payout disagrees',()=>{
 const x=check([row(1,4,'誤勝馬'),row(2,2,'二着'),row(3,3,'三着')]);
 assert.equal(x.status,'UNVERIFIED');
 assert.equal(x.reason,'WINNER_ROW_AND_PAYOUT_NOT_UNIQUE');
});
test('a dead heat with two official win receipts is not silently normalized',()=>{
 const x=check([row(1,8,'一着'),row(1,7,'同着'),row(2,4,'二着'),row(3,9,'三着')],['8','7']);
 assert.equal(x.status,'UNVERIFIED');
});
test('missing or repeated podium positions are rejected',()=>{
 assert.equal(check([row(1,8,'勝馬'),row(2,2,'二着')]).status,'UNVERIFIED');
 assert.equal(check([row(1,8,'勝馬'),row(2,2,'二着'),row(2,4,'二着'),row(3,3,'三着')]).status,'UNVERIFIED');
});
test('duplicate runner identity and malformed win payout are rejected',()=>{
 assert.equal(check([row(1,8,'勝馬'),row(2,8,'二着'),row(3,3,'三着')]).status,'UNVERIFIED');
 assert.equal(check([row(1,8,'勝馬'),row(2,2,'二着'),row(3,3,'三着')],['8-2']).status,'UNVERIFIED');
});
test('untrusted result sources and absent official payout fail closed',()=>{
 const x=verifyNarOfficialPodium({source:'UNVERIFIED_CACHE',result:result([row(1,8,'勝馬'),row(2,2,'二着'),row(3,3,'三着')])});
 assert.equal(x.status,'UNVERIFIED');
 assert.equal(check([row(1,8,'勝馬'),row(2,2,'二着'),row(3,3,'三着')],[]).status,'UNVERIFIED');
});
