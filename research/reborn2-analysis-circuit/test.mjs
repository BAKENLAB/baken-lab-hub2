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
