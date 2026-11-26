import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeField,compareClock } from './analyze.mjs';
import { compareHistory } from './trends.mjs';
import { historyQuery } from './readers.mjs';
import { retainPrestartCard,readPrestartCard } from './prestart-card.mjs';
const input={circuit:'LOCAL',targetDate:'2026-12-01',cutoff:'2026-11-30T10:00:00Z',roster:[1,2],
 rows:[{current_no:1,prior_no:1,prior_date:'2026-11-20',prior_track:'佐賀',prior_race_no:3,
 corner_source_ref:'fixture',corner_checked_at:'2026-11-25T00:00:00Z',corners:[
 {corner:1,position:5},{corner:2,position:2},{corner:4,position:1}]}]};
const a=analyzeField({input});
assert.equal(a.coverage['17'].with_output,1);
assert.deepEqual(a.runners[0].items['18'][0].value,[{from:1,to:2,gain:3}]);
assert.equal(a.coverage['01'].with_output,0);
const condition={track:'佐賀',surface:'ダート',distance:1200,going:'良',class_name:'fixture',layout:'fixture',weight_group:'fixture'};
const reference={...condition,circuit:'LOCAL',race_date:'2026-10-01',race_no:1,observed_at:'2026-10-01T12:00:00Z',winner_seconds:72,source_ref:'fixture',verified:true};
const run={...condition,race_date:'2026-11-20',start_at:'2026-11-20T12:00:00Z',elapsed_seconds:73};
assert.equal(compareClock(run,[reference],'LOCAL').residual_seconds,1);
assert.equal(compareClock(run,[reference],'JRA'),null);
const history=Array.from({length:4},(_,i)=>({...condition,identity_verified:true,benchmark_verified:true,evidence_id:String(i),race_date:'2026-11-2'+i,residual_seconds:4-i}));
assert.deepEqual(Object.keys(compareHistory(history,input.targetDate,true)),['13','14','32']);
assert.equal(compareHistory([...history,{...history[0],race_date:'2026-11-30',evidence_id:'missing',residual_seconds:null}],input.targetDate,true)['32'],undefined);
assert.match(historyQuery({circuit:'JRA',date:'2026-11-21',track:'福島',raceNo:12}),/r.track='福島'/);
assert.throws(()=>historyQuery({circuit:'LOCAL',date:'2026-02-31',track:'佐賀',raceNo:1}));
const dir=await mkdtemp(join(tmpdir(),'reborn-card-'));
try{
 const path=join(dir,'card.json'),url='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=32';
 const snapshot={sourceUrl:url,expectedSourceUrl:url,fetchedAt:'2026-11-20T01:00:00Z',postTime:'2026-11-20T02:00:00Z',bytes:new Uint8Array([1,2])};
 const hash=await retainPrestartCard(path,snapshot);
 assert.deepEqual((await readPrestartCard(path,hash)).bytes,Buffer.from([1,2]));
 await assert.rejects(retainPrestartCard(path,snapshot),{code:'EEXIST'});
 await assert.rejects(readPrestartCard(path,'wrong'),/CHANGED/);
 await assert.rejects(retainPrestartCard(join(dir,'late'),{...snapshot,fetchedAt:snapshot.postTime}),/INVALID/);
}finally{await rm(dir,{recursive:true,force:true});}
console.log('PASS circuit, benchmark, trend, historical reader and prestart capture');
const empty=Object.fromEntries(['02','03','04','05','06'].map(id=>[id,{observed_n:0}]));
const profile={circuit:'LOCAL',target_date:input.targetDate,scoring_authorized:false,final_grade_connected:false,
 runners:[{horse_no:1,historical_runs:1,visible_condition_profiles:[{tier:'ARCHIVE_ID_MATCH',visible_match:true,
   source_refs:['fixture'],history_n:1,days_since_latest:11,current_relevance_validated:false,
   metrics:{...empty,'02':{observed_n:1,wins:1,top3:1}}}],other_condition_profiles:[]},
 {horse_no:2,historical_runs:0,visible_condition_profiles:[],other_condition_profiles:[]}]};
const assessed=analyzeField({input,profile});
assert.deepEqual(assessed.runners[0].ability_trace.consumed_items,['02']);
assert.equal(assessed.coverage['01'].with_output,1);
assert.equal(assessed.coverage['02'].consumed,1);
assert.equal(assessed.runners[1].ability_trace.final_grade,null);

assert.equal(a.coverage['18'].context_read,1);
assert.equal(a.coverage['18'].consumed,0);
assert.equal(a.runners[0].historical_context.length,1);
const {assessContext}=await import('./context-assessment.mjs');
const items=Object.fromEntries(['17','18','19','21','22','28','30'].map(id=>[id,[]]));
items['17']=[{evidence_id:'run',value:{positions:[5,3]}}];
items['19']=[{evidence_id:'run',value:{individual_sectionals:false}}];
const result={prior_no:1,horse_id:'123',source_ref:'prior',race_date:'2026-11-20',finish:2,gap_winner:0.3};
const at='2026-11-21T00:00:00Z';
const incident={verified:true,horse_id:'123',result_ref:'prior',document_ref:'report',role:'SUFFERED',
 finding:'fixture',phase:'BEFORE_LAST_CORNER',published_at:at,checked_at:at};
const context={verified:true,source_ref:'prior',prior_no:1,horse_id:'123',observed_at:at,
 last_corner:5,relative_final3f_seconds:-0.5,early_pace_residual_seconds:-0.2,
 pace_benchmark_verified:true,forward_rival_finishes:[1,6],opposition_verified:true,current_relevance_verified:true,
 special_condition_verified:true,comparable_baseline_n:3,residual_vs_own_baseline_seconds:1,incident};
const runContext=(patch={},ratings=[])=>assessContext({items,targetDate:input.targetDate,cutoff:input.cutoff,ratings,
 runPairs:[{run:result,id:'run',context:{...context,...patch}}]});
const verified=runContext({},[{verified:true,horse_id:'123',performance_ref:'prior',performance_date:result.race_date,
 published_at:at,observed_at:at,source_ref:'rating',version:'fixture',value:110}]);
for(const id of ['15','16','20','25','26','27','29','31']) assert.ok(verified.findings[id]?.length,id);
assert.deepEqual(verified.consumed,['17','19']);
assert.deepEqual(runContext({horse_id:'456'}).findings,{});
assert.equal(runContext({incident:{...incident,checked_at:'2026-12-01T00:00:00Z'}}).findings['26'],undefined);
assert.ok(runContext({last_corner:1,early_group_documented:true}).findings['23']);
assert.ok(runContext({last_corner:1}).findings['24']);
console.log('PASS contextual ability read and extended item gates');

const {collectLocalProfileHistory}=await import('./local-profile.mjs');
const ref='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123';
const current={horse_no:1,horse_name:'試験馬',identity_refs:[ref],horse_link_evidence:{horse_no:1,horse_ref:ref}};
const header='年月日|競馬場|R|競走名|格組|距離|天候・馬場|頭数|枠|馬番|人気|着順|タイム|差|上3F|体重|騎手(所属)|重量|調教師|収得賞金|1着馬または(2着馬)'.split('|');
const rows=[{cells:header},...Array.from({length:6},(_,i)=>({cells:Object.assign(Array(23).fill(''),{
 0:'2026/11/0'+(i+1),1:'佐賀',2:'1',5:'1200',11:'1',13:'2',14:'1:13.0',15:'0.2',16:'37.0'})}))];
const profileInput={roster:[current,{horse_no:2}],targetDate:input.targetDate,asOf:input.cutoff,
 profiles:[{horseNo:1,profile:{url:ref,ok:true,diagnostic_only:true,truncated:false,
 fetched_at:'2026-11-25T00:00:00Z',body:'試験馬 牡3 現役 年月日',rows}}]};
const expanded=collectLocalProfileHistory(profileInput);
assert.equal(expanded[0].runs.length,6);
assert.equal(expanded[0].history_complete,false);
assert.equal(expanded[1].status,'PROFILE_UNAVAILABLE');
assert.throws(()=>collectLocalProfileHistory({...profileInput,profiles:[...profileInput.profiles,...profileInput.profiles]}));
console.log('PASS supplied LOCAL profile beyond five starts');
