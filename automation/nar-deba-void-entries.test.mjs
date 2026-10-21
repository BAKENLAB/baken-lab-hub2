import test from 'node:test';
import assert from 'node:assert/strict';
import {captureOwnedDebaPriorColumns} from './nar-deba-dom-columns.mjs';
import {extractOwnedDebaPastCorners} from './nar-deba-past-corners.mjs';
const track='門別',race={circuit:'LOCAL',track,race_date:'2026-10-21',race_no:10};
const ref='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=36&k_raceDate=2026%2F10%2F21&k_raceNo=10';
const headerText='2026年10月21日 水曜日 門別 第10競走';
const runners=[
{no:3,name:'カスケードループ',lineage:'30000000003',
 heading:['3','3','カスケードループ','岩橋勇','87.0','全 1-0-1-5','5 26.10.01 重 8頭 門別 右1200 6番','7 26.09.17 良 8頭 門別 右1200 1番','3 26.09.03 重 8頭 門別 右1000 7番','1 26.08.11 良 11頭 門別 右1000 2番','取消 26.07.02 良 9頭 門別 右1100 1番'],
 form:['コロナ','伊藤','1:16.2 3-1 40.3','1:16.0 4-5 39.4','1:03.0 1-1 39.3','1:02.8 1-1 38.3',''],slots:[1,2,3,4]},
{no:9,name:'メローニ',lineage:'30000000009',
 heading:['7','9','メローニ','落合玄','2.5','全 1-0-0-1','1 26.09.15 良 12頭 門別 右1100 6番','取消 26.09.09 良 6頭 門別 右1700 3番','4 26.08.20 良 12頭 門別 右1000 4番','',''],
 form:['ワットポー','大久保','1:08.4 1-1 38.0','','1:02.7 8-8 36.9','',''],slots:[1,3]},
{no:12,name:'アンビティオー',lineage:'30000000012',
 heading:['12','アンビティオー','松井伸','49.6','全 1-0-0-7','6 26.10.07 良 12頭 門別 右1000 6番','1 26.09.15 良 12頭 門別 右1000 3番','4 26.09.01 良 12頭 門別 右1000 3番','除外 26.08.18 良 10頭 門別 右1000 5番','4 26.08.05 良 10頭 門別 右1000 2番'],
 form:['ディアレイカ','馬主','1:03.0 5-4 37.8','1:01.7 4-4 36.4','1:03.2 8-7 37.9','','1:03.6 5-3 38.3'],slots:[1,2,3,5]}
];
const row=cells=>cells.map(text=>({text}));
function parse(subject,form=subject.form){
 const rows=[{row_index:2,cells:row(subject.heading)},
             {row_index:11,cells:row(form)},
             {row_index:13,cells:row(['NEXT'])}];
 const diagnosedRunners=[{horse_no:subject.no,row_index:2},{horse_no:99,row_index:13}];
 const columns=captureOwnedDebaPriorColumns({rows,diagnosedRunners,horseNo:subject.no,debaSourceRef:ref});
 const runner={status:'ACTIVE',horse_no:subject.no,horse_name:subject.name,row_index:2,
   identity_refs:['https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode='+subject.lineage]};
 const prior=extractOwnedDebaPastCorners({race,cardSourceRef:ref,cardHeader:headerText,runner,columns});
 return {columns,prior};
}
for(const subject of runners) {
 test(subject.name+': the 取消/除外 slot is omitted but other real runs stay aligned',()=>{
 const {columns,prior}=parse(subject);
 assert.deepEqual(columns.map(v=>v.slot),subject.slots);
 assert.equal(prior.length,subject.slots.length);
 assert.ok(prior.every(p=>p.race_date<'2026-10-21'));
 });
 test(subject.name+': passage claimed for void start is a conflict',()=>{
   const bad=[...subject.form];const voidSlot=subject.heading.findIndex(s=>/^(?:取消|除外)/.test(s))-(subject.heading.length-5);
   assert.ok(voidSlot>=0);
   bad[voidSlot+2]='1:01.0 1-1 39.9';
   assert.equal(parse(subject,bad).columns.length,0);
 });
}
test('a blank future start is not filled with a neighboring horses passage',()=>{
 const subject=runners[1],bad=[...subject.form];bad[5]='1:02.8 1-1 40.0';
 assert.equal(parse(subject,bad).columns.length,0);
});
