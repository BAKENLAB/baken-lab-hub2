import test from 'node:test';
import assert from 'node:assert/strict';
import {captureOwnedDebaPriorColumns} from './nar-deba-dom-columns.mjs';
const inputs={
  "rows": [
    {
      "row_index": 20,
      "cells": [
        {
          "text": "6"
        },
        {
          "text": "ウィステリアベル"
        },
        {
          "text": "加藤聡"
        }
      ]
    },
    {
      "row_index": 21,
      "cells": [
        {
          "text": "備考"
        },
        {
          "text": "6 26.07.09 良 10頭 笠松 右1400 10番"
        },
        {
          "text": "1 26.06.26 不良 10頭 笠松 右1580 6番"
        },
        {
          "text": "1 26.06.10 良 12頭 笠松 右1400 6番"
        }
      ]
    },
    {
      "row_index": 22,
      "cells": [
        {
          "text": "別欄"
        },
        {
          "text": "1:31.6 2-2-1-2 41.1"
        },
        {
          "text": "1:45.6 1-1-1-1 40.7"
        },
        {
          "text": "1:33.8 1-1-1-1 41.3"
        }
      ]
    },
    {
      "row_index": 25,
      "cells": [
        {
          "text": "5"
        },
        {
          "text": "カーシュジアン"
        }
      ]
    },
    {
      "row_index": 26,
      "cells": [
        {
          "text": "備考"
        },
        {
          "text": "1 26.07.20 良 6頭 笠松 右1580 5番"
        }
      ]
    },
    {
      "row_index": 27,
      "cells": [
        {
          "text": "別欄"
        },
        {
          "text": "1:47.9 3-3-1-1 42.1"
        }
      ]
    }
  ],
  "diagnosedRunners": [
    {
      "horse_no": 6,
      "row_index": 20
    },
    {
      "horse_no": 5,
      "row_index": 25
    }
  ],
  "horseNo": 6,
  "debaSourceRef": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11"
};
test('capture exactly three position pairs owned by one current horse',()=>{const r=captureOwnedDebaPriorColumns(inputs);assert.equal(r.length,3);assert.equal(r[1].owner_horse_no,6);assert.equal(r[1].slot,2);});
test('never join another horse position block',()=>{const r=captureOwnedDebaPriorColumns(inputs);assert.ok(r.every(x=>x.owner_horse_no===6));});
test('duplicate date rows reject without guessing',()=>{const rows=[...inputs.rows,{...inputs.rows[1],row_index:23}];assert.deepEqual(captureOwnedDebaPriorColumns({...inputs,rows}),[]);});
test('missing passage column stops extraction',()=>{const q=structuredClone(inputs);q.rows[2].cells[2].text='NO DATA';assert.deepEqual(captureOwnedDebaPriorColumns(q),[]);});
test('ambiguous owner refuses extraction',()=>{const r=[...inputs.diagnosedRunners,{horse_no:6,row_index:30}];assert.deepEqual(captureOwnedDebaPriorColumns({...inputs,diagnosedRunners:r}),[]);});
test('misaligned form-row count rejects',()=>{const q=structuredClone(inputs);q.rows[2].cells.shift();assert.deepEqual(captureOwnedDebaPriorColumns(q),[]);});
test('second horse returns only own column',()=>{const r=captureOwnedDebaPriorColumns({...inputs,horseNo:5});assert.equal(r.length,1);assert.equal(r[0].owner_horse_no,5);});


test('actual official 2026-08-14 Kasamatsu 11R HTML row layout (11 date cols / 7 form cols)',()=>{
  const source=inputs.debaSourceRef;
  const values=[
    '6','6','ウィステリアベル','加藤聡(愛知)','7.3 (4人気)',
    '全 2- 5- 2- 9 左 0- 0- 0- 1 右 2- 5- 2- 7 場 2- 5- 2- 6',
    '6 26.07.09 良 10頭 笠松 右1400 10番',
    '1 26.06.26 不良 10頭 笠松 右1580 6番',
    '1 26.06.10 良 12頭 笠松 右1400 6番',
    '8 26.05.27 良 10頭 笠松 右1400 3番',
    '3 26.05.12 良 8頭 笠松 右1580 7番'
  ];
  const forms=[
    'スズベルベット','(同)JPN技研','1:31.6 2-2-1-2 41.1',
    '1:45.6 1-1-1-1 40.7','1:33.8 1-1-1-1 41.3',
    '1:33.6 1-1-1-3 42.1','1:47.3 1-2-1-1 41.2'
  ];
  const observed=[
    {row_index:57,cells:values.map(text=>({text}))},
    {row_index:66,cells:forms.map(text=>({text}))},
    {row_index:68,cells:[{text:'7'},{text:'サンモスクテール'}]}
  ];
  const result=captureOwnedDebaPriorColumns({
    rows:observed,horseNo:6,debaSourceRef:source,
    diagnosedRunners:[{horse_no:6,row_index:57},{horse_no:7,row_index:68}]
  });
  assert.equal(result.length,5);
  assert.deepEqual(result.map(x=>x.form.split(/\s+/)[1]),
    ['2-2-1-2','1-1-1-1','1-1-1-1','1-1-1-3','1-2-1-1']);
});
test('official 11/7 columns cannot be silently shifted',()=>{
 const date=['6','6','ウィステリアベル','加藤聡','7.3','前走情報',
 '6 26.07.09 良 10頭 笠松 右1400 10番','1 26.06.26 不良 10頭 笠松 右1580 6番',
 '1 26.06.10 良 12頭 笠松 右1400 6番','8 26.05.27 良 10頭 笠松 右1400 3番',
 '3 26.05.12 良 8頭 笠松 右1580 7番'].map(text=>({text}));
 const form=['母','馬主','1:31.6 2-2-1-2 41.1','1:45.6 1-1-1-1 40.7',
 '1:33.8 1-1-1-1 41.3','1:33.6 1-1-1-3 42.1','1:47.3 1-2-1-1 41.2'].map(text=>({text}));
 const rows=[{row_index:57,cells:date},{row_index:66,cells:form.slice(1)},
             {row_index:68,cells:[]}];
 const result=captureOwnedDebaPriorColumns({rows,horseNo:6,
 diagnosedRunners:[{horse_no:6,row_index:57},{horse_no:7,row_index:68}],
 debaSourceRef:inputs.debaSourceRef});
 assert.deepEqual(result,[]);
});
