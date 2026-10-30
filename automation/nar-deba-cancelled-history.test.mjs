import test from 'node:test';
import assert from 'node:assert/strict';
import {captureOwnedDebaPriorColumns} from './nar-deba-dom-columns.mjs';
import {extractOwnedDebaPastCorners} from './nar-deba-past-corners.mjs';
import {buildDebaRunningStyleShadow} from './nar-deba-style-shadow.mjs';

// Real published 2026-10-21 Kasamatsu 11R DebaTable row texts, from live GET.
// The "取止" 2026-09-08 0-horse canceled race is NOT a run and has no passage.
const race={circuit:'LOCAL',track:'笠松',race_date:'2026-10-21',race_no:11};
const cardSourceRef='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F10%2F21&k_raceNo=11';
const cardHeader='2026年10月21日(水)　笠 松 第11競走 YJSトライアルラウンド笠松第2戦';
const subjects=[
  {horse_no:1,horse_name:'ジョリーメモリー',start:2,next:13,lineage:'30045407986',
  head:['1','1','ジョリーメモリー','田山旺(JRA)','3.7 (1人気)','全 3- 12- 5- 35','5 26.09.24 良 10頭 笠松 右1400 7番','取止 26.09.08 不良 0頭 笠松 右1400 2番','7 26.08.25 良 8頭 笠松 右1400 7番','8 26.08.11 良 8頭 笠松 右1400 3番','4 26.07.22 良 8頭 笠松 右1400 1番'],
  form:['プリンセスメモリー','海谷幸司','1:31.4 3-3-5-4 40.2','','1:32.9 7-8-8-8 39.0','1:32.2 7-7-7-8 40.0','1:32.0 1-1-1-1 40.9'],
  expected_style:['差']},
  {horse_no:7,horse_name:'カジカライズ',start:68,next:79,lineage:'30098404386',
  head:['7','7','カジカライズ','森田誠(JRA)','9.2 (6人気)','全 5- 3- 1- 18','9 26.09.22 良 9頭 笠松 右1580 5番','取止 26.09.08 不良 0頭 笠松 右1400 9番','6 26.08.25 良 8頭 笠松 右1400 6番','5 26.07.22 良 8頭 笠松 右1400 3番','1 26.06.24 良 8頭 笠松 右1400 2番'],
  form:['ジプシーマイラブ','(株)ファーストビジョン','1:50.0 1-1-1-5 45.1','','1:32.2 1-1-1-4 40.9','1:32.1 1-1-1-1 41.7','1:30.2 1-1-1-1 39.0'],
  expected_style:['逃']}
];
function run(subject,overrideForm=null){
 const owner=subject.start, id='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode='+subject.lineage;
 const rows=[{row_index:owner,cells:subject.head.map(text=>({text}))},
   {row_index:owner+9,cells:(overrideForm??subject.form).map(text=>({text}))},
   {row_index:subject.next,cells:[{text:'NEXT'}]}];
 const runner={horse_no:subject.horse_no,horse_name:subject.horse_name,
  status:'ACTIVE',row_index:owner,identity_refs:[id],current_source_ref:cardSourceRef,
  running_style_reference:['?'],recent_runs:[],rank:subject.horse_no,grade:'B'};
 const columns=captureOwnedDebaPriorColumns({rows,diagnosedRunners:[
 {horse_no:subject.horse_no,row_index:owner},{horse_no:99,row_index:subject.next}],
 horseNo:subject.horse_no,debaSourceRef:cardSourceRef});
 const prior=extractOwnedDebaPastCorners({race,cardSourceRef,cardHeader,runner,columns});
 const shadow=buildDebaRunningStyleShadow({context:{race,runners:[runner]},priorEvidence:prior});
 return {columns,prior,shadow,runner};
}
for(const subject of subjects){
 test(subject.horse_name+' skips exactly the canceled prior slot but retains four prior passages',()=>{
   const {columns,prior,shadow,runner}=run(subject);
   assert.deepEqual(columns.map(x=>x.slot),[1,3,4,5]);
   assert.equal(prior.length,4);
   assert.ok(prior.every(x=>x.race_date!=='2026-09-08'));
   assert.deepEqual(shadow.runners[0].shadow_style,subject.expected_style);
   assert.equal(shadow.ranking_changed,false);assert.equal(runner.rank,subject.horse_no);
 });
 test(subject.horse_name+' refuses invented passage for the 0-horse canceled race',()=>{
   const bad=[...subject.form];bad[3]='1:31.0 1-1-1-1 40.0';
   assert.equal(run(subject,bad).columns.length,0);
   assert.deepEqual(run(subject,bad).shadow.runners[0].shadow_style,['?']);
 });
 test(subject.horse_name+' refuses missing real passage, never shift columns',()=>{
   const bad=[...subject.form];bad[4]='';
   assert.equal(run(subject,bad).columns.length,0);
 });
}
