import test from 'node:test';
import assert from 'node:assert/strict';
import {queueNext} from './queue-operation.mjs';
const id1='11111111-1111-4111-8111-111111111111';
const id2='22222222-2222-4222-8222-222222222222';
const lease='2026-10-13T02:00:00.000Z';
function mock(data){const calls=[];return {calls,client:{rpc(name,args){
  calls.push({name,args});
  return {abortSignal(){return Promise.resolve({data,error:null})}};
}}};}
test('queue recovers expired claims through v2 and returns verified claim',async()=>{
 const m=mock({claimed:true,resumed:false,job_id:id1,run_id:id2,region:'中部',lease_until:lease});
 const got=await queueNext({worker_id:'LOCAL_QUEUE_CHUBU'},{client:m.client,now:()=>Date.parse('2026-10-13T01:25:00Z')});
 assert.equal(m.calls.length,1);
 assert.deepEqual(m.calls[0],{name:'lab_queue_claim_next_v2',args:{p_worker_id:'LOCAL_QUEUE_CHUBU'}});
 assert.equal(got.claimed,true);
 assert.equal(got.job_id,id1);
});
test('no eligible job keeps a safe no-claim response',async()=>{
 const m=mock({claimed:false,resumed:false});
 const got=await queueNext({worker_id:'LOCAL_QUEUE_HOKKAIDO_TOHOKU'},{client:m.client,now:()=>0});
 assert.equal(got.claimed,false);
 assert.equal(m.calls[0].name,'lab_queue_claim_next_v2');
});
test('invalid worker cannot call recovery',async()=>{
 const m=mock({claimed:false,resumed:false});
 await assert.rejects(()=>queueNext({worker_id:'INVALID'},{client:m.client}),/WORKER_NOT_ALLOWED/);
 assert.equal(m.calls.length,0);
});
