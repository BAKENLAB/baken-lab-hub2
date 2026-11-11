import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalCornerServiceRpcStore} from '../automation/local-corner-service-rpc-store.mjs';
const digest='a'.repeat(64);
const record={
 circuit:'LOCAL',source_kind:'LOCAL_OFFICIAL_CORNERS',
 source_version:'LOCAL_CORNER_1',as_of:'2026-11-08T08:00:00+09:00',
 evidence:{schemaVersion:'LOCAL_OFFICIAL_CORNERS_1'}
};
const query={
 circuit:'LOCAL',source_kind:'LOCAL_OFFICIAL_CORNERS',
 race_date:'2026-11-08',track:'佐賀',race_no:1,
 official_roster_digest:digest,before:'2026-11-08T08:00:01+09:00'
};
test('service role RPC adapter uses only the two approved function names and bound arguments',async()=>{
 const calls=[],client={rpc:(name,args)=>{
  calls.push({name,args});return {abortSignal:()=>Promise.resolve({
   data:name.endsWith('insert_v1')?{inserted:true}:null,error:null
  })};
 }};
 const store=createLocalCornerServiceRpcStore({client});
 assert.equal((await store.insertIfAbsent(record)).inserted,true);
 assert.equal(await store.findLatest(query),null);
 assert.equal(calls.length,2);
 assert.equal(calls[0].name,'lab_preclaim_local_corner_insert_v1');
 assert.equal(calls[1].name,'lab_preclaim_local_corner_read_v1');
 assert.deepEqual(calls[0].args,{p_record:record});
 assert.deepEqual(calls[1].args,{
  p_race_date:'2026-11-08',p_track:'佐賀',p_race_no:1,
  p_roster_digest:digest,p_before:'2026-11-08T08:00:01+09:00'
 });
});
test('untrusted lookup and record cannot invoke privileged RPC',async()=>{
 let calls=0;
 const store=createLocalCornerServiceRpcStore({client:{rpc:()=>{calls++;return Promise.resolve({data:null});}}});
 await assert.rejects(store.findLatest({...query,official_roster_digest:'bad'}),/UNSAFE_RPC_LOOKUP/);
 await assert.rejects(store.findLatest({...query,race_no:15}),/UNSAFE_RPC_LOOKUP/);
 await assert.rejects(store.insertIfAbsent({...record,circuit:'JRA'}),/UNSAFE_RPC_RECORD/);
 assert.equal(calls,0);
});
test('backend permission denial and malformed write result are isolated as errors',async()=>{
 const err=createLocalCornerServiceRpcStore({client:{rpc:()=>Promise.resolve({data:null,error:{message:'403'}})}});
 await assert.rejects(err.insertIfAbsent(record),/OPTIONAL_RPC_FAILED/);
 const malformed=createLocalCornerServiceRpcStore({client:{rpc:()=>Promise.resolve({data:{inserted:'yes'}})}});
 await assert.rejects(malformed.insertIfAbsent(record),/OPTIONAL_RPC_RESULT_INVALID/);
});
test('nonreturning provider stops at optional timeout even when AbortSignal ignored',async()=>{
 const store=createLocalCornerServiceRpcStore({client:{rpc:()=>new Promise(()=>{})},timeoutMs:12});
 await assert.rejects(store.findLatest(query),/OPTIONAL_RPC_TIMEOUT/);
});
test('invalid options cannot create an unsafe adapter',()=>{
 assert.throws(()=>createLocalCornerServiceRpcStore({client:{}}),/SERVER_RPC_CLIENT_REQUIRED/);
 assert.throws(()=>createLocalCornerServiceRpcStore({client:{rpc(){}},timeoutMs:2501}),/SERVER_RPC_CLIENT_REQUIRED/);
});
