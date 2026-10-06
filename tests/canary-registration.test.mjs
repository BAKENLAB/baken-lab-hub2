import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=readFileSync(new URL('../supabase/functions/local-claimed-mcp-canary/index.ts',import.meta.url),'utf8');
const candidate=readFileSync(new URL('../supabase/functions/local-claimed-mcp/index.ts',import.meta.url),'utf8');
const names=['lab_queue_claim_next','lab_claimed_context','lab_save_claimed_prediction'];
const id='11111111-1111-4111-8111-111111111111';
const prefix=(src,name)=>src.split('\n').find(l=>l.trim().startsWith('s.registerTool("'+name+'"')).trim().split(',async')[0];
async function boot({allowed=id,userId=id,authError=null,throws=false}={}){
 const tools=new Map();let serve,authCalls=0,dbCalls=0;
 const schema=new Proxy(function(){return schema;},{get:()=>()=>schema,apply:()=>schema});
 const context={z:schema,Response,setTimeout,clearTimeout,console:{log(){throw Error('Unexpected log');},error(){throw Error('Unexpected log');}},
 Deno:{env:{get:key=>key==='LOCAL_MCP_ALLOWED_USER_ID'?allowed:undefined},serve:fn=>serve=fn},
 pipeline:(_middleware,fn)=>fn,withOAuthProtectedResource:()=>null,withSupabase:()=>null,
 McpServer:class{registerTool(name,config,fn){tools.set(name,{config,fn});}},
 createMcpHandler:factory=>({fetch:()=>{factory();return new Response('mock discovery');}})};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm,''),{mode:'strip'}),context,{timeout:2000});
 const response=await serve({}, {supabase:{auth:{getUser:async()=>{authCalls++;if(throws)throw Error('secret-marker raw SQL internal stack');return {data:{user:userId?{id:userId}:null},error:authError};}},rpc(){dbCalls++;throw Error('DB forbidden');},from(){dbCalls++;throw Error('DB forbidden');}}});
 return {tools,response,get authCalls(){return authCalls;},get dbCalls(){return dbCalls;}};
}
for(const name of names)test('canary identical candidate config '+name,()=>assert.equal(prefix(source,name),prefix(candidate,name)));
test('canary only registers expected tools, auth once, zero DB calls',async()=>{const f=await boot();assert.deepEqual([...f.tools.keys()].sort(),[...names].sort());for(const name of names){const r=await f.tools.get(name).fn({job_id:id});const o=JSON.parse(r.content[0].text);assert.equal(o.canary,true);assert.equal(o.code,'CANARY_READ_ONLY');assert.ok(!JSON.stringify(r).includes('secret-marker'));}assert.equal(f.authCalls,1);assert.equal(f.dbCalls,0);});
for(const [label,opts,status] of [['missing allowlist',{allowed:''},503],['missing user',{userId:null},403],['different user',{userId:'22222222-2222-4222-8222-222222222222'},403],['invalid authentication',{authError:{message:'secret-marker'}},403],['auth exception',{throws:true},503]])test('canary fail closed '+label,async()=>{const f=await boot(opts);assert.equal(f.response.status,status);assert.equal(f.tools.size,0);assert.equal(f.dbCalls,0);assert.ok(!(await f.response.text()).includes('secret-marker'));});
test('canary source has no privileged key, DB/table/RPC/context invocation or logs',()=>{assert.doesNotMatch(source.replace("handler.fetch(req)","MCP_TRANSPORT"),/SUPABASE_SERVICE_ROLE_KEY|createClient|\.rpc\s*\(|\.from\s*\(|fetch\s*\(|console\./);assert.doesNotMatch(source,/claim_token|official_predictions|official_results|lab_prediction_jobs|lab_worker_runs|\/functions\/v1\/lab-claimed-context/);});

test("canary reuses existing allowlist without new secret",()=>{assert.match(source,/Deno\.env\.get\("LOCAL_MCP_ALLOWED_USER_ID"\)/);assert.doesNotMatch(source,/LOCAL_MCP_CANARY_ALLOWED_USER_ID/);});
