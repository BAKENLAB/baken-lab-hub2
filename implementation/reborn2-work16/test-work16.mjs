import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMatrix,prestartFieldGate,historicalRaceGate,DIRECT_MEASUREMENT_UNAVAILABLE} from './work16-material-acquisition.mjs';

const sourceMap=JSON.parse(await readFile(new URL('../reborn2-pilot/work04-source-map.json',import.meta.url),'utf8'));
const inventory=JSON.parse(await readFile(new URL('./work16-existing-assets.json',import.meta.url),'utf8'));
const matrix=buildMatrix(sourceMap,inventory);

test('115項目と4分類を固定',()=>{
  assert.equal(matrix.items.length,115);
  assert.deepEqual(matrix.counts,{total:115,取得済み:20,取得可能:64,未取得:16,取得不能:15});
  assert.equal(DIRECT_MEASUREMENT_UNAVAILABLE.size,15);
});
test('V48・結果・市場・本番ガード',()=>{
  assert.equal(matrix.fixedEngine,'V48');
  assert.deepEqual(matrix.guards,{targetRaceResultUsed:false,marketUsed:false,productionChanged:false});
});
test('発走前公式カードは全掲載馬状態を固定し、事後実発走頭数を要求しない',()=>{
  const race={post_time:'2026-11-28T08:00:00Z'};
  const out=prestartFieldGate({source:'NAR_OFFICIAL_DEBA',fetched_at:'2026-11-28T06:00:00Z',runners:[
    {horse_no:1,horse_name:'A',status:'ACTIVE'},{horse_no:2,horse_name:'B',status:'CANCELLED'}
  ]},race);
  assert.equal(out.pass,true);assert.equal(out.listedCount,2);assert.equal(out.activeCount,1);
});
test('発走後取得と不正状態を拒否',()=>{
  assert.equal(prestartFieldGate({source:'NAR_OFFICIAL_DEBA',fetched_at:'2026-11-28T09:00:00Z',runners:[{horse_no:1,horse_name:'A',status:'ACTIVE'}]},{post_time:'2026-11-28T08:00:00Z'}).pass,false);
  assert.equal(prestartFieldGate({source:'NAR_OFFICIAL_DEBA',fetched_at:'2026-11-28T06:00:00Z',runners:[{horse_no:1,horse_name:'A',status:'UNKNOWN'}]},{post_time:'2026-11-28T08:00:00Z'}).pass,false);
});
test('過去競走は競走ID・馬ID・状態・証拠時刻を必須化',()=>{
  const good={race_id:'R1',horse_id:'H1',horse_no:1,horse_name:'A',status:'ACTIVE',source_ref:'https://official.example/R1',observed_at:'2026-11-20T00:00:00Z'};
  assert.equal(historicalRaceGate([good]).pass,true);
  assert.equal(historicalRaceGate([{...good,horse_id:null}]).pass,false);
});
test('Work13バイト不一致を正式入力から保留',()=>{
  assert.equal(inventory.identityConflict.state,'HOLD_NOT_SAME_BYTES');
  assert.notEqual(inventory.identityConflict.observedSha256,inventory.identityConflict.work15ExpectedWork13Sha256);
});
