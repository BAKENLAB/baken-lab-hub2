import assert from 'node:assert/strict';
import {resultIdentity,verifyCalendar,makeJraResultCollector} from './jra-jump-official-history.mjs';
import {makeJumpHistoryReader} from './jra-jump-history-reader.mjs';
const day='2026-11-15',from='2022-01-01';
const c='pw01sde1003202602010520261107/AA',f='pw01sde1003202602010620261107/BB';
const r=resultIdentity(c),flat=resultIdentity(f);
assert.equal(r.track,'福島');assert.equal(r.race_no,5);assert.equal(r.race_date,'2026-11-07');
assert.equal(resultIdentity('fake'),null);
const meetings=[{date:'2026-11-07',track:'福島',race_nos:[5,6]}];
assert.equal(verifyCalendar([r,flat],meetings,from,day).length,2);
assert.throws(()=>verifyCalendar([r],meetings,from,day),/CALENDAR_INCOMPLETE/);
assert.throws(()=>verifyCalendar([r,{...flat,cname:'pw01sde1003202602010520261107/BB',race_no:5}],meetings,from,day),/RESULT_ID_CONFLICT/);
const entries=Array.from({length:5},(_,i)=>({horse_no:i+1,horse_name:'Horse '+(i+1),horse_ref:'pw01dud00202200000'+(i+1)+'/AA',jockey:'Jockey '+(i+1),status:'ACTIVE'}));
const raw={race:{race_date:day,track:'福島',race_no:5,field_payload:{race:{race_type:'障害'},runners:entries}}};
const calendarCalls=[];
const calendarReader=async(from,to)=>{calendarCalls.push({from,to});return {from,to,source_ref:'fixture official calendar witness:'+from,rows:r.race_date>=from&&r.race_date<to?[r,flat]:[]}};
let resultReads=0;
const resultReader=async(cname,asOf)=>{assert.equal(asOf,day);resultReads++;return cname===f?{...flat,source_ref:f,jump:false}:{...r,source_ref:c,jump:true,rows:[{race_type:'障害',race_date:r.race_date,track:r.track,verified:true,source_ref:c,horse_id:'2022000001',jockey:'Jockey 1',result_status:'FINISHED',finish:2},{race_type:'障害',race_date:r.race_date,track:r.track,verified:true,source_ref:c,horse_id:'2023000009',jockey:'Jockey 2',result_status:'DNF',finish:null}]}};
const h=await makeJumpHistoryReader({calendarReader,resultReader})(raw);
assert.equal(resultReads,2);assert.equal(calendarCalls.length,5);assert.equal(h.horses[0].calendar_sources.length,5);assert.equal(h.horses[0].runs.length,1);assert.equal(h.horses[1].runs.length,0);assert.equal(h.horses[1].jockey.starts.length,1);assert.equal(h.horses[1].jockey.starts[0].result_status,'DNF');
await assert.rejects(()=>makeJumpHistoryReader({calendarReader,resultReader:async()=>null})(raw),/HISTORY_RESULT_ID/);
await assert.rejects(()=>makeJumpHistoryReader({calendarReader:async(a,b)=>({from:a,to:b,source_ref:'fixture',rows:[{...r,race_date:day}]}),resultReader})(raw),/HISTORY_CALENDAR_SCOPE/);
await assert.rejects(()=>makeJumpHistoryReader({calendarReader,resultReader,maxResults:1})(raw),/HISTORY_CALENDAR/);
let network=0;const collector=makeJraResultCollector({load:()=>{},expectedMeetingsReader:async()=>null,fetcher:async()=>{network++;throw Error('unexpected')}});
await assert.rejects(()=>collector.result('pw01sde1003202602010520261115/AA',day),/ASOF_RESULT/);assert.equal(network,0);
await assert.rejects(()=>collector.calendar(from,day),/CALENDAR_WITNESS/);assert.equal(network,0);
console.log('PASS 10 history boundary/coverage checks and independent rider aggregation');

const oldHorseRaw=structuredClone(raw);
for(const horse of oldHorseRaw.race.field_payload.runners)horse.horse_ref=horse.horse_ref.replace('2022','2018');
const oldWindows=[];
const annualReader=async(a,b)=>{
 oldWindows.push([a,b]);
 return {from:a,to:b,source_ref:'verified calendar from '+a,
  rows:r.race_date>=a&&r.race_date<b?[r,flat]:[]};
};
const oldRead=await makeJumpHistoryReader({calendarReader:annualReader,resultReader})(oldHorseRaw);
assert.equal(oldWindows.length,9); // 2018 ... 2026: no birth-year truncation
assert.equal(oldWindows[0][0],'2018-01-01');
assert.equal(oldWindows.at(-1)[1],day);
assert.equal(oldRead.horses[0].calendar_sources.length,9);
await assert.rejects(
 ()=>makeJumpHistoryReader({calendarReader:annualReader,resultReader,maxYears:8})(oldHorseRaw),
 /HISTORY_YEAR_LIMIT/
);
await assert.rejects(
 ()=>makeJumpHistoryReader({calendarReader:annualReader,resultReader,maxTotalResults:1})(oldHorseRaw),
 /HISTORY_TOTAL_BUDGET/
);
await assert.rejects(
 ()=>makeJumpHistoryReader({calendarReader:async(a,b)=>({
  from:a,to:b,source_ref:a.slice(0,4)==='2023'?'':('verified:'+a),
  rows:r.race_date>=a&&r.race_date<b?[r,flat]:[]
 }),resultReader})(raw),
 /HISTORY_CALENDAR/
);
console.log('PASS annual full-birth-year coverage, no partial-year acceptance, bounded source verification');
