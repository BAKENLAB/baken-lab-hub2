import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {queueNext,queueSave,publicError,bounded} from '../supabase/functions/local-claimed-mcp/queue-operation.mjs';
import {assertLocalSaveDuringTransition} from '../supabase/functions/local-claimed-mcp/local-eye.mjs';
import {fixture} from './validator.test.mjs';
const id='11111111-1111-4111-8111-111111111111';
async function boot({authorized=true,error=null}={}){
 const tools=new Map(),calls=[];let serve;let authCalls=0;
 const user={id};const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({error,data:name==='lab_queue_claim_next_v1'?{claimed:false,resumed:false}:{ok:true,prediction_id:id,already_saved:true}})};}};
 const schema=new Proxy(function(){return schema;},{get:()=>()=>schema,apply:()=>schema});
 const globals={queueNext,queueSave,publicError,bounded,assertLocalSaveDuringTransition,AbortSignal,Date,Map,JSON,Error,
  structuredClone,z:schema,createClient:()=>client,console:{log(){throw Error('Unexpected log');},error(){throw Error('Unexpected log');}},
  Deno:{env:{get:k=>({LOCAL_MCP_ALLOWED_USER_ID:id,SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'private-test-marker'})[k]},serve:fn=>serve=fn},
  pipeline:(_middleware,fn)=>fn,withOAuthProtectedResource:()=>null,withSupabase:()=>null,
  McpServer:class{registerTool(name,config,fn){tools.set(name,{config,fn});}},
  createMcpHandler:factory=>({fetch:()=>{factory();return new Response('fixture');}}),Response,
 };
 let source=readFileSync(new URL('../supabase/functions/local-claimed-mcp/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 source=stripTypeScriptTypes(source,{mode:'strip'});vm.runInNewContext(source,globals,{timeout:2000});
 await serve({}, {supabase:{auth:{getUser:async()=>{authCalls++;return {data:{user:authorized?user:null},error:null};}}}});
 return {tools,calls,get authCalls(){return authCalls;}};
}
test('actual candidate registers exactly three tools (SDK/hosting mocked)',async()=>{const f=await boot();assert.deepEqual([...f.tools.keys()].sort(),['lab_claimed_context','lab_queue_claim_next','lab_save_claimed_prediction']);});
test('actual queue callback invokes wrapper once',async()=>{const f=await boot();const r=await f.tools.get('lab_queue_claim_next').fn({worker_id:'LOCAL_QUEUE_RESCUE'});assert.deepEqual(JSON.parse(r.content[0].text),{ok:true,claimed:false,resumed:false});assert.equal(f.calls.length,1);});
test('actual queue callback authorization is before admin/RPC',async()=>{const f=await boot({authorized:false});const r=await f.tools.get('lab_queue_claim_next').fn({worker_id:'LOCAL_QUEUE_RESCUE'});assert.equal(r.isError,true);assert.equal(r.content[0].text,'FORBIDDEN');assert.equal(f.calls.length,0);});
test('actual queue callback hides DB errors',async()=>{const f=await boot({error:{message:'private-test-marker'}});const r=await f.tools.get('lab_queue_claim_next').fn({worker_id:'LOCAL_QUEUE_RESCUE'});assert.equal(r.content[0].text,'QUEUE_START_FAILED');assert.ok(!JSON.stringify(r).includes('private-test-marker'));});
test('actual save callback keeps validator before any RPC',async()=>{const f=await boot();const r=await f.tools.get('lab_save_claimed_prediction').fn({job_id:id,protocol_version:'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004',payload:{}});assert.equal(r.isError,true);assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(r).includes('private-test-marker'));});
test('actual save callback retains 7-key payload and supports exact replay',async()=>{const f=await boot(),version='CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004';const runners=Array.from({length:5},(_,i)=>({horse_no:i+1,rank:i+1,horse_name:'馬'+(i+1),running_style_reference:['?']}));const payload=fixture(null,5).payload;const r=await f.tools.get('lab_save_claimed_prediction').fn({job_id:id,protocol_version:version,payload});assert.equal(r.isError,undefined);assert.equal(r.structuredContent.already_saved,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'lab_queue_save_prediction_v1');assert.equal(Object.keys(f.calls[0].args.p_payload).length,7);});

test('actual save callback captures original input before pair normalization',async()=>{const f=await boot();const x=fixture(8),original=structuredClone(x.payload);x.payload.audit.eye_pairwise_comparison[0].evidence_refs=['raw-only'];const raw=structuredClone(x.payload);const r=await f.tools.get('lab_save_claimed_prediction').fn({job_id:id,protocol_version:x.protocol_version,payload:x.payload});assert.equal(r.isError,undefined);assert.deepEqual(f.calls[0].args.p_original_payload,raw);assert.notDeepEqual(f.calls[0].args.p_payload.audit.eye_pairwise_comparison[0].evidence_refs,raw.audit.eye_pairwise_comparison[0].evidence_refs);});

test('queue authenticates exactly once per tool execution',async()=>{const f=await boot();await f.tools.get('lab_queue_claim_next').fn({worker_id:'LOCAL_QUEUE_RESCUE'});assert.equal(f.authCalls,1);});
test('save authenticates exactly once and advertises idempotency',async()=>{const f=await boot(),x=fixture(null,5);const r=await f.tools.get('lab_save_claimed_prediction').fn({job_id:id,protocol_version:x.protocol_version,payload:x.payload});assert.equal(r.isError,undefined);assert.equal(f.authCalls,1);assert.equal(f.tools.get('lab_save_claimed_prediction').config.annotations.idempotentHint,true);});
test('save authorization failure never calls RPC',async()=>{const f=await boot({authorized:false}),x=fixture(null,5);const r=await f.tools.get('lab_save_claimed_prediction').fn({job_id:id,protocol_version:x.protocol_version,payload:x.payload});assert.equal(r.content[0].text,'FORBIDDEN');assert.equal(f.authCalls,1);assert.equal(f.calls.length,0);});
for(const [message,expected] of [['SAVE_RETRY_MISMATCH','SAVE_RETRY_MISMATCH'],['SAVE_REJECTED','SAVE_REJECTED'],['raw SQL secret private-test-marker','SAVE_REJECTED']])test('save public error mapping '+expected+' / '+(message===expected?'known':'unknown'),async()=>{const f=await boot({error:{message}}),x=fixture(null,5);const r=await f.tools.get('lab_save_claimed_prediction').fn({job_id:id,protocol_version:x.protocol_version,payload:x.payload});assert.equal(r.isError,true);assert.equal(r.content[0].text,expected);assert.ok(!JSON.stringify(r).includes('private-test-marker'));assert.equal(f.authCalls,1);});
