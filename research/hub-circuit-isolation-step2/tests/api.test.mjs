import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as contract from '../candidate/prediction-contract.mjs';
import {collectCircuitResponses} from '../candidate/supabase/functions/hub2-api/circuit-responses.mjs';
const date='2026-10-11';
function fixture(circuit){const track=circuit==='JRA'?'東京':'高知',identity={race_date:date,track,race_no:1,circuit};const runner={horse_no:1,horse_name:'TEST ONLY',rank:1,grade:'A',comment:'synthetic evidence'};
 const prediction={...identity,id:circuit,race_name:'TEST',protocol_version:'CHAPPY_DIRECT_1',status:'FROZEN',predicted_at:date+'T00:00:00Z',frozen_at:date+'T00:00:00Z',payload:{runners:[runner,{...runner,horse_no:2,rank:2,horse_name:'EYE TEST'}],top5:[runner],eye:{horse_no:2,horse_name:'EYE TEST',reason:'SYNTHETIC independent evidence'},bets:[],summary:'TEST',bet_strategy:'TEST',audit:{}}};
 return {official_predictions:prediction,official_races:{...identity,race_name:'TEST',prediction_status:'FROZEN',market_status:'PENDING',result_status:'READY',field_payload:{runners:[]}},official_results:{...identity,id:'result'+circuit,result:{finishers:[{horse_no:1,horse_name:'TEST ONLY',finish:1}]},settled_at:date+'T03:00:00Z'}};
}
export async function runApi(baseline=false,{fail=[],empty=false,bad=false}={},action='list',circuit){
 const calls=[];let handler;
 const rows={};for(const c of ['JRA','LOCAL'])for(const [t,row]of Object.entries(fixture(c))){(rows[t]??=[]).push(row)}
 if(bad)rows.official_predictions[0].payload={};
 const db={from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},abortSignal(){return q},then(resolve,reject){calls.push({table,filters});const branch=filters.find(([k])=>k==='circuit')?.[1]??(table==='chappy_predictions'?'LOCAL':null);return Promise.resolve({data:empty?[]:(rows[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v)),error:fail.includes(branch)?{message:'synthetic_failure'}:null}).then(resolve,reject)}};return q}};
 let source=readFileSync(new URL(baseline?'../baseline/index.ts':'../candidate/supabase/functions/hub2-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
 source=stripTypeScriptTypes(source);const context=vm.createContext({...contract,collectCircuitResponses,createClient:()=>db,Deno:{env:{get:()=> 'TEST_ONLY'},serve:fn=>{handler=fn}},structuredClone,Response,Request,URL,AbortSignal,setTimeout,clearTimeout,console});vm.runInContext(source,context);
 const response=await handler(new Request('https://test.invalid/?action='+action+'&date='+date+(circuit?'&circuit='+circuit:'')));
 return {status:response.status,body:await response.json(),calls};
}
for(const action of ['list','results']){
 test(action+' both normal legacy compatibility',async()=>{const old=await runApi(true,{},action),now=await runApi(false,{},action);const {circuit_status,partial,...legacy}=now.body;assert.deepEqual(legacy,old.body);assert.equal(now.status,200);assert.equal(partial,false)});
 for(const fail of [['LOCAL'],['JRA'],['JRA','LOCAL']])test(action+' isolated failure '+fail.join(','),async()=>{const r=await runApi(false,{fail},action);assert.equal(r.status,fail.length===2?503:200);for(const c of fail)assert.equal(r.body.circuit_status[c].state,'ERROR');if(fail.length===1)assert.deepEqual((action==='list'?r.body.races:r.body.results).map(x=>x.circuit),[fail[0]==='JRA'?'LOCAL':'JRA'])});
 test(action+' empty is successful',async()=>{const r=await runApi(false,{empty:true},action);assert.equal(r.status,200);assert.equal(r.body.circuit_status.JRA.state,'READY');assert.equal(r.body.partial,false)});
 test(action+' DATA_ERROR is per race',async()=>{const r=await runApi(false,{bad:true},action);assert.equal(r.status,200);const rows=action==='list'?r.body.races:r.body.results;assert.equal(rows.find(x=>x.circuit==='JRA').data_error.startsWith('DATA ERROR:'),true);assert.equal(rows.find(x=>x.circuit==='LOCAL').data_error,null)});
 test(action+' explicit circuit queries scoped',async()=>{const r=await runApi(false,{},action,'JRA');assert.equal(r.status,200);assert.equal(r.calls.some(x=>x.table==='chappy_predictions'),false);assert(r.calls.every(x=>x.filters.some(([k,v])=>k==='circuit'&&v==='JRA')))});
 test(action+' invalid circuit',async()=>{assert.equal((await runApi(false,{},action,'OTHER')).status,400)});
}

test('prediction contract copied unchanged',()=>assert.equal(readFileSync(new URL('../candidate/prediction-contract.mjs',import.meta.url),'utf8'),readFileSync(new URL('../baseline/prediction-contract.mjs',import.meta.url),'utf8')));
