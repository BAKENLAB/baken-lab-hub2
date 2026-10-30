import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOwnedDebaPastCorners} from './nar-deba-past-corners.mjs';
const base={
  "race": {
    "race_date": "2026-08-14",
    "track": "笠松",
    "race_no": 11,
    "circuit": "LOCAL"
  },
  "cardSourceRef": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
  "cardHeader": "2026年8月14日（金）笠 松 第11競走 16:05発走",
  "runner": {
    "status": "ACTIVE",
    "horse_no": 6,
    "horse_name": "ウィステリアベル",
    "row_index": 25,
    "identity_refs": [
      "https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901"
    ]
  },
  "columns": [
    {
      "slot": 1,
      "owner_horse_no": 6,
      "owner_row_index": 25,
      "deba_source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
      "headline": "6 26.07.09 良 10頭 笠松 右1400 10番",
      "form": "1:31.6 2-2-1-2 41.1"
    },
    {
      "slot": 2,
      "owner_horse_no": 6,
      "owner_row_index": 25,
      "deba_source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
      "headline": "1 26.06.26 不良 10頭 笠松 右1580 6番",
      "form": "1:45.6 1-1-1-1 40.7"
    },
    {
      "slot": 3,
      "owner_horse_no": 6,
      "owner_row_index": 25,
      "deba_source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
      "headline": "1 26.06.10 良 12頭 笠松 右1400 6番",
      "form": "1:33.8 1-1-1-1 41.3"
    }
  ]
};
const run=opts=>extractOwnedDebaPastCorners(opts);
test('published 2026-08-14 Kasamatsu 11R previous starts, correctly matched',()=>{const r=run(base);assert.deepEqual(r.map(x=>x.early_pos),[2,1,1]);assert.equal(r[1].passing_order,'1-1-1-1');});
test('reject wrong race header/number',()=>assert.deepEqual(run({...base,race:{...base.race,race_no:12}}),[]));
test('reject row ownership mismatch',()=>assert.deepEqual(run({...base,columns:base.columns.map((x,i)=>({...x,owner_row_index:i===0?26:25}))}),[]));
test('reject changed owner horse',()=>assert.deepEqual(run({...base,columns:base.columns.map((x,i)=>({...x,owner_horse_no:i===0?7:6}))}),[]));
test('same-day passage never available',()=>assert.deepEqual(run({...base,columns:[{...base.columns[0],headline:'1 26.08.14 良 10頭 笠松 右1400 10番'}]}),[]));
test('missing stable lineage evidence cannot be used',()=>assert.deepEqual(run({...base,runner:{...base.runner,identity_refs:[]}}),[]));
test('duplicate position slots reject runner',()=>assert.deepEqual(run({...base,columns:[base.columns[0],{...base.columns[1],slot:1}]}),[]));
test('malformed passage is skipped',()=>assert.deepEqual(run({...base,columns:[{...base.columns[0],form:'1:31.6 2,,1 41.1'}]}),[]));
test('out-of-field passage is skipped',()=>assert.deepEqual(run({...base,columns:[{...base.columns[0],form:'1:31.6 2-11-1-2 41.1'}]}),[]));
test('cancelled horse is not analyzed',()=>assert.deepEqual(run({...base,runner:{...base.runner,status:'CANCELLED'}}),[]));
test('only exact expected official DebaTable source',()=>assert.deepEqual(run({...base,cardSourceRef:base.cardSourceRef.replace('www.keiba.go.jp','example.org')}),[]));
