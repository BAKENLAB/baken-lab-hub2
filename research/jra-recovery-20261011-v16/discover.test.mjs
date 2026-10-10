import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const original=fs.readFileSync(new URL('./candidate/index.ts',import.meta.url),'utf8');
const seed='pw01dde0105202604040120261011/7C';
const future='pw01dde0105202604050120261012/AA'; // Synthetic fixture, never an official URL assertion.
function setup({noSeed=false,seedError=false,futureError=false,futureTransport=false,withFuture=true}={}){
 const reads=[],writes=[],logs=[];let handler;
 const q={select(){return q},eq(){return q},gte(){return q},order(){return q},limit(){return q},async maybeSingle(){return {data:noSeed?null:{race_date:'2026-10-11',seed_cname:seed},error:seedError?{}:null}}};
 const db={from(name){reads.push(name);if(name==='jra_live_seeds')return {...q,async upsert(){writes.push(name);if(futureTransport)throw Error('fixture transport');return {error:futureError?{}:null}}};if(name==='jra_live_queue')return {async upsert(){writes.push(name);return {error:null}}};throw Error('unexpected table')}};
 const anchor={};const load=()=>selector=>selector==='a'?{each(fn){if(withFuture)fn(0,anchor)}}:{attr(key){return key==='href'?future:''}};
 const env={createClient:()=>db,load,TextDecoder,Request,Response,URL,console:{warn(...x){logs.push(x)},error(...x){logs.push(x)}},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),Deno:{env:{get:()=> 'ISOLATED_FIXTURE'},serve(fn){handler=fn}}};
 vm.runInNewContext(stripTypeScriptTypes(original.replace(/^import .*;\s*$/gm,'')),env);
 return {async run(){return handler(new Request('https://offline.invalid',{method:'POST',body:JSON.stringify({action:'discover'})}))},reads,writes,logs};
}
test('no seed returns warning/503 without network or writes',async()=>{const h=setup({noSeed:true});const r=await h.run();assert.equal(r.status,503);assert.equal((await r.json()).error,'JRA_NO_SEED');assert.deepEqual(h.writes,[]);assert.equal(h.logs[0][0],'JRA_NO_SEED')});
test('seed query failure remains 500 and performs no writes',async()=>{const h=setup({seedError:true});assert.equal((await h.run()).status,500);assert.deepEqual(h.writes,[])});
test('future seed DB error becomes explicit failure after queue stage',async()=>{const h=setup({futureError:true});const r=await h.run();assert.equal(r.status,500);const b=await r.json();assert.equal(b.error,'JRA_FUTURE_SEED_SAVE_FAILED');assert.equal(b.queued,1);assert.equal(h.logs[0][0],'JRA_FUTURE_SEED_SAVE_FAILED');assert.deepEqual(h.writes,['jra_live_queue','jra_live_seeds'])});
test('success retains existing discovered race output',async()=>{const r=await setup().run();assert.equal(r.status,200);const b=await r.json();assert.equal(b.ok,true);assert.equal(b.race_date,'2026-10-11');assert.equal(b.queued,1);assert.deepEqual(b.future_seeds,['2026-10-12'])});
test('no future links means no future seed write',async()=>{const h=setup({withFuture:false});const r=await h.run();assert.equal(r.status,200);assert.deepEqual((await r.json()).future_seeds,[]);assert.deepEqual(h.writes,['jra_live_queue'])});
test('transport failure cannot be returned as successful discovery',async()=>assert.rejects(()=>setup({futureTransport:true}).run(),/fixture transport/));
