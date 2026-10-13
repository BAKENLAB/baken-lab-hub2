import test from 'node:test';
import assert from 'node:assert/strict';
import {publicError,queueSave} from './local-queue-operation.mjs';

test('Local EYE protocol errors are explicit without exposing internal details',()=>{
 for(const name of ['LOCAL_EYE_CHECKS_INCOMPLETE','LOCAL_EYE_PAIR_PREFERENCE','LOCAL_EYE_PAIR_UNLINKED','LOCAL_EYE_CANDIDATE_SET','LOCAL_EYE_SELECTION_MISMATCH'])
  assert.equal(publicError(new Error(name)),name);
});
test('Unknown errors and arbitrary strings remain generic',()=>{
 for(const name of ['Postgres exception with SQL, secret=xyz','LOCAL_EYE_SQL_DATA_EXPOSE_123','LOCAL_EYE_x','LOCAL_EYE_','context secret'])
  assert.equal(publicError(new Error(name)),'OPERATION_FAILED');
 assert.equal(publicError({message:null}),'OPERATION_FAILED');
 assert.equal(publicError(null),'OPERATION_FAILED');
});
test('Other approved stable error codes are unchanged',()=>{
 for(const name of ['SAVE_REJECTED','SAVE_RETRY_MISMATCH','QUEUE_STATE_UNAVAILABLE','CLAIM_UNAVAILABLE'])
  assert.equal(publicError(new Error(name)),name);
});
test('RPC error details still never leak through publicError',async()=>{
 const job_id='bf9864eb-33a7-4028-b22f-b8893ddce59a';
 const fake={rpc:()=>({abortSignal:async()=>({data:null,error:{message:'SQL secret token=very-secret'}})})};
 await assert.rejects(()=>queueSave({job_id,protocol_version:'TEST',payload:{},original_payload:{}},{userId:'637e44b1-fc51-4ce4-8c10-a3e1f2a8604c',client:fake,timeoutMs:1500}),/SAVE_REJECTED/);
});
