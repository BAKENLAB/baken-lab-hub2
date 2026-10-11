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
export async function runApi(baseline=false,{fail=[],empty=false,bad=false,records=null}={},action='list',circuit){
 const calls=[];let handler;
 const rows={};for(const c of ['JRA','LOCAL'])for(const [t,row]of Object.entries(fixture(c))){(rows[t]??=[]).push(row)}
 if(records){for(const k of Object.keys(rows))delete rows[k];Object.assign(rows,structuredClone(records));}if(bad)rows.official_predictions[0].payload={};
 const db={from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},abortSignal(){return q},then(resolve,reject){calls.push({table,filters});const branch=filters.find(([k])=>k==='circuit')?.[1]??(table==='chappy_predictions'?'LOCAL':null);return Promise.resolve({data:empty?[]:(rows[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v)),error:fail.includes(branch)?{message:'synthetic_failure'}:null}).then(resolve,reject)}};return q}};
 let source=readFileSync(new URL(baseline?'../baseline/index.ts':'../candidate/supabase/functions/hub2-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
 source=stripTypeScriptTypes(source);const context=vm.createContext({...contract,collectCircuitResponses,createClient:()=>db,Deno:{env:{get:()=> 'TEST_ONLY'},serve:fn=>{handler=fn}},structuredClone,Response,Request,URL,AbortSignal,setTimeout,clearTimeout,console});vm.runInContext(source,context);
 const requestDate=records?.official_races?.[0]?.race_date??date;const response=await handler(new Request('https://test.invalid/?action='+action+'&date='+requestDate+(circuit?'&circuit='+circuit:'')));
 return {status:response.status,body:await response.json(),calls};
}
