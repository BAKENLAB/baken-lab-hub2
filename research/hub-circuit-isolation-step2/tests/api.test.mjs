import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runApi} from './api-harness.mjs';
for(const action of ['list','results']){
 test(action+' both normal legacy compatibility',async()=>{const old=await runApi(true,{},action),now=await runApi(false,{},action);const {circuit_status,partial,...legacy}=now.body;assert.deepEqual(legacy,old.body);assert.equal(now.status,200);assert.equal(partial,false)});
 for(const fail of [['LOCAL'],['JRA'],['JRA','LOCAL']])test(action+' isolated failure '+fail.join(','),async()=>{const r=await runApi(false,{fail},action);assert.equal(r.status,fail.length===2?503:200);for(const c of fail)assert.equal(r.body.circuit_status[c].state,'ERROR');if(fail.length===1)assert.deepEqual((action==='list'?r.body.races:r.body.results).map(x=>x.circuit),[fail[0]==='JRA'?'LOCAL':'JRA'])});
 test(action+' empty is successful',async()=>{const r=await runApi(false,{empty:true},action);assert.equal(r.status,200);assert.equal(r.body.circuit_status.JRA.state,'READY');assert.equal(r.body.partial,false)});
 test(action+' DATA_ERROR is per race',async()=>{const r=await runApi(false,{bad:true},action);assert.equal(r.status,200);const rows=action==='list'?r.body.races:r.body.results;assert.equal(rows.find(x=>x.circuit==='JRA').data_error.startsWith('DATA ERROR:'),true);assert.equal(rows.find(x=>x.circuit==='LOCAL').data_error,null)});
 test(action+' explicit circuit queries scoped',async()=>{const r=await runApi(false,{},action,'JRA');assert.equal(r.status,200);assert.equal(r.calls.some(x=>x.table==='chappy_predictions'),false);assert(r.calls.every(x=>x.filters.some(([k,v])=>k==='circuit'&&v==='JRA')))});
 test(action+' invalid circuit',async()=>{assert.equal((await runApi(false,{},action,'OTHER')).status,400)});
}

test('prediction contract copied unchanged',()=>assert.equal(readFileSync(new URL('../candidate/prediction-contract.mjs',import.meta.url),'utf8'),readFileSync(new URL('../baseline/prediction-contract.mjs',import.meta.url),'utf8')));
