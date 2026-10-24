import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNarCornerRows} from './nar-official-result-parser.mjs';
import {enrichVerifiedCornerHistory} from './nar-verified-corner-evidence.mjs';

// Research-only transcription of the published NAR official RaceMarkTable headers
// and first two finishers; NO post-race inputs are allowed into the current race.
// Primary reference 2026-08-14 Kasamatsu 11R:
// https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11
// IPAT official reference 2026-08-14 Kasamatsu 5R:
// https://www.keiba.go.jp/KeibaWeb_IPAT/TodayRaceInfo/RaceMarkTable_ipat?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=5
const cols=['着順','枠','馬番','馬名','所属','性齢','負担\n重量','騎手（所属）','調教師','馬体重\n（増減）','タイム','着差','上がり\n3F','コーナー\n通過順','人気','単勝\nオッズ'];
function row(finish,no,name,pass){
 const cells=Array(16).fill('');cells[0]=String(finish);cells[2]=String(no);cells[3]=name;cells[13]=pass;return {cells};
}
const site='https://www.keiba.go.jp';
function page(date,no,officialPath,finishers){
 return {race:{race_date:date,track:'笠松',race_no:no,circuit:'LOCAL'},
 source_ref:site+officialPath+'?k_babaCode=23&k_raceDate='+date.replaceAll('-','%2F')+'&k_raceNo='+no,
 header_text:'2026年8月14日（金）　笠　松　第'+no+'競走　競走成績',
 rows:[{cells:cols},...finishers.map(x=>row(...x))]};
}
const race5=page('2026-08-14',5,'/KeibaWeb_IPAT/TodayRaceInfo/RaceMarkTable_ipat',[
 [1,4,'コスモフィネス','1-1-1-1'],[2,5,'テルケンレングレー','2-2-2-2']]);
const race11=page('2026-08-14',11,'/KeibaWeb/TodayRaceInfo/RaceMarkTable',[
 [1,6,'ウィステリアベル','1-1-1-1'],[2,5,'カーシュジアン','7-7-7-5']]);
const ref='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=30052409996';
test('2026-08-14 Kasamatsu 5R official published result rows reproduce exact corners',()=>{
 const rows=parseNarCornerRows(race5);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>[x.finish,x.horse_no,x.horse_name,x.corner_order]),[
 [1,4,'コスモフィネス','1-1-1-1'],[2,5,'テルケンレングレー','2-2-2-2']]);
});
test('2026-08-14 Kasamatsu 11R official standard-page rows reproduce exact corners',()=>{
 const rows=parseNarCornerRows(race11);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>[x.finish,x.horse_no,x.corner_order]),[[1,6,'1-1-1-1'],[2,5,'7-7-7-5']]);
});
test('documented horse lineage plus historical race result accepts verified corner',()=>{
 const result=enrichVerifiedCornerHistory({
 runner:{horse_no:5,horse_name:'コスモフィネス',identity_refs:[ref]},
 currentRace:{race_date:'2026-10-21',track:'笠松',race_no:11,circuit:'LOCAL'},
 profileRuns:[{race_date:'2026-08-14',track:'笠松',race_no:5,horse_no:4,horse_name:'コスモフィネス',horse_ref:ref,source:'NAR_OFFICIAL_RESCUE',finish:1}],
 resultRows:parseNarCornerRows(race5)});
 assert.equal(result.accepted,1);assert.equal(result.runs[0].early_pos,1);assert.equal(result.runs[0].final_turn_pos,1);
});
test('official NAR IPAT path accepted, unknown impersonation path not accepted',()=>{
 const rows=parseNarCornerRows(race5);
 const inputs={runner:{horse_no:5,horse_name:'コスモフィネス',identity_refs:[ref]},
 currentRace:{race_date:'2026-10-21',track:'笠松',race_no:11,circuit:'LOCAL'},
 profileRuns:[{race_date:'2026-08-14',track:'笠松',race_no:5,horse_no:4,horse_name:'コスモフィネス',horse_ref:ref,source:'NAR_OFFICIAL_RESCUE',finish:1}]};
 assert.equal(enrichVerifiedCornerHistory({...inputs,resultRows:rows}).accepted,1);
 assert.equal(enrichVerifiedCornerHistory({...inputs,resultRows:[{...rows[0],source_ref:rows[0].source_ref.replace('/KeibaWeb_IPAT/','/KeibaWeb_FAKE/')}] }).accepted,0);
});
