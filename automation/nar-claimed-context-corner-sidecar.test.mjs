import test from 'node:test';
import assert from 'node:assert/strict';
import {attachResearchCornerSidecar} from './nar-claimed-context-corner-sidecar.mjs';
const src='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11';
const ref='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=30094407896';
const runner={horse_no:6,horse_name:'ウィステリアベル',status:'ACTIVE',
 identity_refs:[ref],
 horse_link_evidence:{horse_no:6,row_index:57,deba_source_ref:src,horse_ref:ref},
 rank:3,grade:'B',recent_runs:[{finish:3,race_date:'2026-06-10'}],
 running_style_reference:['?']};
const snapshot={race_date:'2026-08-14',track:'笠松',race_no:11,circuit:'LOCAL',
 source_ref:src,history:[{race_date:'2026-07-09',race_no:4,track:'笠松'}],
 runners:[runner]};
const diagnosedRunners=[
{horse_no:6,horse_name:'ウィステリアベル',row_index:57,horse_cell_links:[{href:'../DataRoom/HorseMarkInfo?k_lineageLoginCode=30094407896'}]},
{horse_no:7,horse_name:'サンモスクテール',row_index:68,horse_cell_links:[]}];
const domRows=[
{row_index:57,cells:['6','6','ウィステリアベル','加藤聡','7.3','全 2-5',
 '6 26.07.09 良 10頭 笠松 右1400 10番',
 '1 26.06.26 不良 10頭 笠松 右1580 6番',
 '1 26.06.10 良 12頭 笠松 右1400 6番',
 '8 26.05.27 良 10頭 笠松 右1400 3番',
 '3 26.05.12 良 8頭 笠松 右1580 7番'].map(text=>({text}))},
{row_index:66,cells:['スズベルベット','(同)JPN',
 '1:31.6 2-2-1-2 41.1','1:45.6 1-1-1-1 40.7',
 '1:33.8 1-1-1-1 41.3','1:33.6 1-1-1-3 42.1',
 '1:47.3 1-2-1-1 41.2'].map(text=>({text}))},
{row_index:68,cells:[{text:'7'},{text:'サンモスクテール'}]}];
const opts={snapshot,domRows,diagnosedRunners,
raceHeader:'2026年8月14日（金）笠松 第11競走'};
test('researched running style enters shadow-only input without touching ranking/history',()=>{
 const before=JSON.stringify(snapshot);
 const result=attachResearchCornerSidecar(opts);
 assert.equal(result.snapshot.runners[0].shadow_card_corner_evidence.length,5);
 assert.deepEqual(result.snapshot.runners[0].shadow_running_style_reference,['逃']);
 assert.equal(JSON.stringify(snapshot),before);
 assert.equal(result.snapshot.runners[0].rank,3);
 assert.deepEqual(result.snapshot.history,snapshot.history);
 assert.ok(result.snapshot.runners[0].shadow_card_corner_evidence.every(x=>!('race_no' in x)));
});
test('identity disagreement produces NO evidence instead of a false join',()=>{
 const wrong=structuredClone(snapshot);
 wrong.runners[0].identity_refs[0]='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901';
 const result=attachResearchCornerSidecar({...opts,snapshot:wrong});
 assert.equal(result.snapshot.runners[0].shadow_card_corner_evidence.length,0);
 assert.deepEqual(result.snapshot.runners[0].shadow_running_style_reference,['?']);
});
test('horse_link_evidence wrong owner is rejected',()=>{
 const wrong=structuredClone(snapshot);wrong.runners[0].horse_link_evidence.row_index=58;
 const result=attachResearchCornerSidecar({...opts,snapshot:wrong});
 assert.equal(result.snapshot.runners[0].shadow_card_corner_evidence.length,0);
});
test('sidecar rejects unapproved source entirely',()=>{
 const wrong=structuredClone(snapshot);wrong.source_ref='https://example.invalid/fake';
 assert.throws(()=>attachResearchCornerSidecar({...opts,snapshot:wrong}),/OFFICIAL_SOURCE/);
});
test('before target-date condition ensures no current race leakage',()=>{
 const wrong=structuredClone(snapshot);wrong.race_date='2026-06-10';
 const result=attachResearchCornerSidecar({...opts,snapshot:wrong});
 assert.equal(result.snapshot.runners[0].shadow_card_corner_evidence.length,0);
});
