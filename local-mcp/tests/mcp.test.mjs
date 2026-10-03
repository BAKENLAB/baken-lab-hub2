import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMcp, TOOL, UPSTREAM_URL, PROTOCOL_VERSION} from '../src/mcp.mjs';
import {REST_BASE, JOB_COLUMNS, RUN_COLUMNS} from '../src/claim-resolver.mjs';
import worker from '../src/worker.mjs';
const env = {LOCAL_MCP_BEARER_TOKEN:'local-mcp-test-token-0123456789abcdef0123456789', SUPABASE_SERVICE_ROLE_KEY:'fake-service-role-for-local-test-only',LOCAL_MCP_WORKER_ID:'LOCAL_QUEUE_RESCUE'};
const claim = {run_id:'11111111-1111-4111-8111-111111111111',job_id:'22222222-2222-4222-8222-222222222222',claim_token:'33333333-3333-4333-8333-333333333333'};
const alternate = {run_id:'44444444-4444-4444-8444-444444444444',job_id:'55555555-5555-4555-8555-555555555555',claim_token:'66666666-6666-4666-8666-666666666666'};
const NOW=Date.parse('2026-10-03T09:30:00Z');
const toolArgs={job_id:claim.job_id};
const job={id:claim.job_id,race_date:'2026-10-03',track:'高知',race_no:9,circuit:'LOCAL',job_status:'CLAIMED',worker_run_id:claim.run_id,claim_token:claim.claim_token,claimed_by:env.LOCAL_MCP_WORKER_ID,lease_until:'2026-10-03T09:45:00Z',attempts:1,max_attempts:3};
const run={id:claim.run_id,worker_id:env.LOCAL_MCP_WORKER_ID,status:'RUNNING',region:'RESCUE'};
const context = {race:{race_date:'2026-10-03',track:'高知',race_no:9,circuit:'LOCAL',post_time:'2026-10-03T10:00:00Z'},protocol:{protocol_key:'LOCAL_MAIN',version:'LOCAL_FIXTURE',content:{instruction:'全頭比較はChatGPTで実施'}},runners:[{horse_no:1,horse_name:'検証馬',recent_runs:[],missing_items:['history']}],missing_conditions:[],field_integrity_checked:true,stage:'AWAITING_FULL_DEPTH_COMPARISON',protocol_version:'LOCAL_FIXTURE',supplementation_audit:[]};
function request(message, {token=env.LOCAL_MCP_BEARER_TOKEN,url='https://local-mcp.example/mcp',headers={}}={}) {
 return new Request(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify(message)});
}
const call=(a=toolArgs)=>({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'lab_claimed_context',arguments:a}});
const response=(status=200,body={ok:true,context})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const text=r=>r.result.content[0].text;
function fixtureFetch(upstream=async()=>response(), {readJob=()=>[job],readRun=()=>[run],onFetch=()=>{}}={}) {
 let jobs=0,runs=0;
 return async(url,options)=>{
  onFetch(url,options);
  if(url===UPSTREAM_URL)return upstream(url,options);
  const parsed=new URL(url);assert.equal(parsed.origin+'/',new URL(REST_BASE).origin+'/');
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.body,undefined);
  assert.equal(options.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);assert.equal(options.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(parsed.searchParams.get('limit'),'2');
  if(parsed.pathname==='/rest/v1/lab_prediction_jobs'){
   assert.equal(parsed.searchParams.get('select'),JOB_COLUMNS);assert.equal(parsed.searchParams.get('circuit'),'eq.LOCAL');assert.equal(parsed.searchParams.get('job_status'),'eq.CLAIMED');assert.equal(parsed.searchParams.get('claimed_by'),'eq.'+env.LOCAL_MCP_WORKER_ID);
   assert.deepEqual([...parsed.searchParams.keys()].sort(),['select','limit','id','circuit','job_status','claimed_by'].sort());
   return response(200,await readJob(++jobs,parsed,options));
  }
  assert.equal(parsed.pathname,'/rest/v1/lab_worker_runs');assert.equal(parsed.searchParams.get('select'),RUN_COLUMNS);assert.equal(parsed.searchParams.get('worker_id'),'eq.LOCAL_QUEUE_RESCUE');assert.equal(parsed.searchParams.get('status'),'eq.RUNNING');assert.equal(parsed.searchParams.get('region'),'eq.RESCUE');
  assert.ok(parsed.searchParams.get('select').split(',').includes('region'));
  assert.deepEqual([...parsed.searchParams.keys()].sort(),['select','limit','id','worker_id','status','region'].sort());
  return response(200,await readRun(++runs,parsed,options));
 };
}
function bridge({fetchImpl,fixture={},...options}={}) {return createLocalMcp({env,now:()=>NOW,...options,fetchImpl:fixtureFetch(fetchImpl,fixture)});}
const invoke=async(handle,a=toolArgs)=>await(await handle(request(call(a)))).json();

test('valid LOCAL_QUEUE_RESCUE / RESCUE CLAIMED resolves its linked run before and after upstream',async()=>{
 const calls=[];const handle=bridge({fixture:{onFetch:(url,options)=>calls.push({url,options})},fetchImpl:async(url,options)=>{assert.equal(url,UPSTREAM_URL);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);assert.deepEqual(JSON.parse(options.body),claim);return response();}});
 const res=await handle(request(call()));assert.equal(res.status,200);const data=await res.json();
 assert.deepEqual(data.result.structuredContent.context,context);assert.deepEqual(JSON.parse(text(data)),context);
 assert.deepEqual(calls.map(c=>c.options.method),['GET','GET','POST','GET','GET']);assert.equal(res.headers.get('cache-control'),'no-store');
 for(const i of [0,3])assert.equal(new URL(calls[i].url).searchParams.get('id'),'eq.'+claim.job_id);
 for(const i of [1,4])assert.equal(new URL(calls[i].url).searchParams.get('id'),'eq.'+claim.run_id);
});
test('MCP initialize, tools/list, ping and notifications make no network calls',async()=>{
 let calls=0;const handle=createLocalMcp({env,fetchImpl:()=>{calls++;throw Error('should not call');}});
 const init=await(await handle(request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:PROTOCOL_VERSION}}))).json();assert.equal(init.result.protocolVersion,PROTOCOL_VERSION);
 const list=await(await handle(request({jsonrpc:'2.0',id:2,method:'tools/list'}))).json();assert.equal(list.result.tools.length,1);assert.equal(list.result.tools[0].name,TOOL.name);
 assert.deepEqual(TOOL.inputSchema.required,['job_id']);assert.deepEqual(Object.keys(TOOL.inputSchema.properties),['job_id']);
 assert.equal((await handle(request({jsonrpc:'2.0',method:'notifications/initialized'}))).status,202);
 assert.deepEqual((await(await handle(request({jsonrpc:'2.0',id:3,method:'ping'}))).json()).result,{});assert.equal(calls,0);
});
for(const token of [null,'wrong'])test('unauthorized makes zero DB and upstream calls: '+token,async()=>{
 let calls=0;const h=createLocalMcp({env,fetchImpl:()=>{calls++;}});assert.equal((await h(request(call(),{token}))).status,401);assert.equal(calls,0);
});
test('non-LOCAL input rejected before every network call',async()=>{
 let calls=0;const h=createLocalMcp({env,fetchImpl:()=>{calls++;}});assert.equal(text(await invoke(h,{...toolArgs,circuit:'JRA'})),'INVALID_TOOL_INPUT');assert.equal(calls,0);
});
test('non-LOCAL upstream context is never returned',async()=>{
 const h=bridge({fetchImpl:async()=>response(200,{ok:true,context:{...context,race:{...context.race,circuit:'JRA'}}})});assert.equal(text(await invoke(h)),'UPSTREAM_INVALID_CONTEXT');
});
for(const [label,patch] of [
 ['RETRY',{job_status:'RETRY'}],['QUEUED',{job_status:'QUEUED'}],['expired',{lease_until:'2026-10-03T09:29:59Z'}],['expiry equality',{lease_until:'2026-10-03T09:30:00Z'}],['invalid lease',{lease_until:'invalid'}],['non-LOCAL',{circuit:'JRA'}],['other worker',{claimed_by:'another-worker'}],['wrong job',{id:alternate.job_id}],['NULL run',{worker_run_id:null}],['missing run',{worker_run_id:undefined}],['invalid token',{claim_token:'invalid'}],['NULL token',{claim_token:null}],['missing token',{claim_token:undefined}],['exhausted attempts',{attempts:4}],
])test('resolver denies '+label+' without calling upstream',async()=>{
 let calls=0;const h=bridge({fixture:{readJob:()=>[{...job,...patch}]},fetchImpl:async()=>{calls++;return response();}});assert.equal(text(await invoke(h)),'CLAIM_UNAVAILABLE');assert.equal(calls,0);
});
for(const [label,rows] of [['missing',[]],['duplicate',[job,job]],['invalid type',{}]])test('resolver rejects '+label+' job rows without revealing existence',async()=>{
 let calls=0;const h=bridge({fixture:{readJob:()=>rows},fetchImpl:async()=>{calls++;return response();}});assert.equal(text(await invoke(h)),'CLAIM_UNAVAILABLE');assert.equal(calls,0);
});
for(const [label,patch] of [['different run',{id:alternate.run_id}],['other worker',{worker_id:'another-worker'}],['finished',{status:'COMPLETED'}],['other region',{region:'LOCAL'}],['NULL region',{region:null}],['missing region',{region:undefined}]])test('resolver rejects '+label+' worker_run despite matching job.claimed_by',async()=>{
 let calls=0;const h=bridge({fixture:{readRun:()=>[{...run,...patch}]},fetchImpl:async()=>{calls++;return response();}});assert.equal(text(await invoke(h)),'CLAIM_UNAVAILABLE');assert.equal(calls,0);
});
test('matching claimed_by does not authorize a job whose linked worker run is absent',async()=>{
 let calls=0;const h=bridge({fixture:{readRun:()=>[]},fetchImpl:async()=>{calls++;return response();}});
 assert.equal(text(await invoke(h)),'CLAIM_UNAVAILABLE');assert.equal(calls,0);
});
test('worker_run_id query must follow the job and reject a different returned run',async()=>{
 let calls=0;const h=bridge({fixture:{readJob:()=>[{...job,worker_run_id:alternate.run_id}],readRun:(n,url)=>{assert.equal(url.searchParams.get('id'),'eq.'+alternate.run_id);return [run];}},fetchImpl:async()=>{calls++;return response();}});
 assert.equal(text(await invoke(h)),'CLAIM_UNAVAILABLE');assert.equal(calls,0);
});
test('worker header cannot select another worker or override configured ownership',async()=>{
 let calls=0;const h=bridge({fixture:{readJob:()=>[{...job,claimed_by:'another-worker'}]},fetchImpl:async()=>{calls++;return response();}});
 assert.equal(text(await(await h(request(call(),{headers:{'x-worker-id':'another-worker'}}))).json()),'CLAIM_UNAVAILABLE');assert.equal(calls,0);
});
test('upstream still authoritatively rejects a revoked claim with no retry',async()=>{
 let calls=0;const h=bridge({fetchImpl:async()=>{calls++;return response(409,{ok:false,error:'STALE_OR_EXPIRED_CLAIM'});}});const r=await invoke(h);assert.equal(r.result.isError,true);assert.equal(text(r),'STALE_OR_EXPIRED_CLAIM');assert.equal(r.result.structuredContent,undefined);assert.equal(calls,1);
});
for(const [label,patch] of [['token',{claim_token:alternate.claim_token}],['run',{worker_run_id:alternate.run_id}],['race',{race_no:10}]])test('post-upstream '+label+' change rejects context',async()=>{
 const h=bridge({fixture:{readJob:n=>[{...job,...(n===1?{}:patch)}],readRun:n=>[{...run,...(n>1&&label==='run'?{id:alternate.run_id}:{})}]}});const r=await invoke(h);assert.equal(text(r),'CLAIM_CHANGED');assert.equal(r.result.structuredContent,undefined);assert.ok(!JSON.stringify(r).includes(alternate.claim_token));
});
test('post-upstream lease expiry rejects otherwise valid context',async()=>{
 let time=NOW;const h=bridge({now:()=>time,fetchImpl:async()=>{time=Date.parse(job.lease_until);return response();}});const r=await invoke(h);assert.equal(text(r),'CLAIM_UNAVAILABLE');assert.equal(r.result.structuredContent,undefined);
});
test('lease expiry during run lookup rejects before upstream',async()=>{
 let time=NOW,calls=0;const h=bridge({now:()=>time,fixture:{readRun:()=>{time=Date.parse(job.lease_until);return [run];}},fetchImpl:async()=>{calls++;return response();}});assert.equal(text(await invoke(h)),'CLAIM_UNAVAILABLE');assert.equal(calls,0);
});
test('post-upstream ownership revocation rejects context',async()=>{
 const h=bridge({fixture:{readJob:n=>[{...job,...(n>1?{claimed_by:'another-worker'}:{})}]}});assert.equal(text(await invoke(h)),'CLAIM_UNAVAILABLE');
});
for(const [label,patch] of [['job status',{job_status:'RETRY'}],['NULL token',{claim_token:null}],['NULL run',{worker_run_id:null}],['circuit',{circuit:'JRA'}]])test('post-upstream '+label+' revocation discards context',async()=>{
 let upstreamCalls=0;const h=bridge({fixture:{readJob:n=>[{...job,...(n>1?patch:{})}]},fetchImpl:async()=>{upstreamCalls++;return response();}});
 const result=await invoke(h);assert.equal(text(result),'CLAIM_UNAVAILABLE');assert.equal(result.result.structuredContent,undefined);assert.equal(upstreamCalls,1);
});
for(const [label,patch] of [['status',{status:'COMPLETED'}],['region',{region:'LOCAL'}],['worker',{worker_id:'another-worker'}],['ID',{id:alternate.run_id}]])test('post-upstream run '+label+' change discards context',async()=>{
 let upstreamCalls=0;const h=bridge({fixture:{readRun:n=>[{...run,...(n>1?patch:{})}]},fetchImpl:async()=>{upstreamCalls++;return response();}});
 const result=await invoke(h);assert.equal(text(result),'CLAIM_UNAVAILABLE');assert.equal(result.result.structuredContent,undefined);assert.equal(upstreamCalls,1);
});
test('a lease extension with the same live capability is accepted',async()=>{
 const h=bridge({fixture:{readJob:n=>[{...job,lease_until:n===1?job.lease_until:'2026-10-03T09:50:00Z'}]}});assert.deepEqual((await invoke(h)).result.structuredContent.context,context);
});
test('stable authorized worker handles multiple jobs and tokens without secret updates',async()=>{
 const bodies=[];const h=bridge({fixture:{readJob:(n,url)=>url.searchParams.get('id')==='eq.'+claim.job_id?[job]:[{...job,id:alternate.job_id,worker_run_id:alternate.run_id,claim_token:alternate.claim_token,race_no:10}],readRun:(n,url)=>url.searchParams.get('id')==='eq.'+claim.run_id?[run]:[{...run,id:alternate.run_id}]},fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);bodies.push(body);return response(200,{ok:true,context:{...context,race:{...context.race,race_no:body.job_id===claim.job_id?9:10}}});}});
 const first=await invoke(h),second=await invoke(h,{job_id:alternate.job_id});assert.equal(first.result.structuredContent.context.race.race_no,9);assert.equal(second.result.structuredContent.context.race.race_no,10);assert.deepEqual(bodies,[claim,alternate]);
 for(const result of [first,second])for(const token of [claim.claim_token,alternate.claim_token])assert.ok(!JSON.stringify(result).includes(token));
});
test('upstream context for another LOCAL race is rejected',async()=>{
 const h=bridge({fetchImpl:async()=>response(200,{ok:true,context:{...context,race:{...context.race,race_no:10}}})});assert.equal(text(await invoke(h)),'UPSTREAM_INVALID_CONTEXT');
});
test('upstream timeout aborts request even if fetch ignores signal',async()=>{
 let signal;const h=bridge({timeoutMs:10,fetchImpl:async(u,o)=>{signal=o.signal;return new Promise(()=>{});}});assert.equal(text(await invoke(h)),'UPSTREAM_TIMEOUT');assert.equal(signal.aborted,true);
});
test('resolver timeout bounds total request and aborts DB request',async()=>{
 let signal;const h=createLocalMcp({env,now:()=>NOW,timeoutMs:10,fetchImpl:async(u,o)=>{signal=o.signal;return new Promise(()=>{});}});assert.equal(text(await invoke(h)),'UPSTREAM_TIMEOUT');assert.equal(signal.aborted,true);
});
for(const status of [401,403,429,500,302])test('upstream HTTP error '+status+' hides response body',async()=>{
 const h=bridge({fetchImpl:async()=>response(status,{error:env.SUPABASE_SERVICE_ROLE_KEY})});assert.equal(text(await invoke(h)),[401,403].includes(status)?'UPSTREAM_AUTH_FAILED':'UPSTREAM_UNAVAILABLE');
});
test('DB errors, redirects, malformed and oversized bodies hide credentials and do not invoke upstream',async()=>{
 for(const fetchImpl of [async()=>{throw Error('Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);},async()=>response(500,{error:claim.claim_token}),async()=>response(302,{error:env.LOCAL_MCP_BEARER_TOKEN}),async()=>new Response('{broken'),async()=>new Response('x'.repeat(16385))]){
  const h=createLocalMcp({env,now:()=>NOW,fetchImpl});const r=await invoke(h);assert.equal(text(r),'CLAIM_UNAVAILABLE');for(const secret of [env.LOCAL_MCP_BEARER_TOKEN,env.SUPABASE_SERVICE_ROLE_KEY,claim.claim_token])assert.ok(!JSON.stringify(r).includes(secret));
 }
});
test('no secrets in response or logs on DB/upstream errors and malicious successful payload',async()=>{
 const logs=[];const methods=['log','error','warn','info','debug'];const originals=methods.map(k=>console[k]);methods.forEach(k=>{console[k]=(...a)=>logs.push(a);});
 try {
  const malicious=[{authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},{note:claim.claim_token},{[claim.claim_token]:'hidden key'},{password:'fixture-password'}];
  const fetches=[async()=>{throw Error('Authorization Bearer '+env.LOCAL_MCP_BEARER_TOKEN+' '+env.SUPABASE_SERVICE_ROLE_KEY+' '+claim.claim_token);},...malicious.map(content=>async()=>response(200,{ok:true,context:{...context,protocol:{...context.protocol,content}}}))];
  for(const fetchImpl of fetches){const output=await(await bridge({fetchImpl})(request(call()))).text();for(const secret of [env.LOCAL_MCP_BEARER_TOKEN,env.SUPABASE_SERVICE_ROLE_KEY,claim.claim_token,'fixture-password'])assert.ok(!output.includes(secret));}
  const dbError=createLocalMcp({env,fetchImpl:async()=>{throw Error('Authorization Bearer '+env.SUPABASE_SERVICE_ROLE_KEY+' '+claim.claim_token);}});await invoke(dbError);assert.deepEqual(logs,[]);
 }finally{methods.forEach((k,i)=>{console[k]=originals[i];});}
});
test('no JSON-RPC ID echo of server secrets or UUID-shaped claim capabilities',async()=>{
 let calls=0;const h=createLocalMcp({env,fetchImpl:()=>{calls++;throw Error('must not call');}});
 for(const id of [env.LOCAL_MCP_BEARER_TOKEN,env.SUPABASE_SERVICE_ROLE_KEY,claim.claim_token,'prefix-'+alternate.claim_token]){const r=await h(request({...call(),id}));assert.ok(!(await r.text()).includes(id));}assert.equal(calls,0);
});
test('dynamic claim UUID capability is secret in uppercase values and keys too',async()=>{
 const secret='abcdefab-cdef-4abc-8def-abcdefabcdef';
 for(const content of [{note:secret.toUpperCase()},{[secret.toUpperCase()]:'redacted'}]){
  const h=bridge({fixture:{readJob:()=>[{...job,claim_token:secret}]},fetchImpl:async()=>response(200,
   {ok:true,context:{...context,protocol:{...context.protocol,content}}})});
  const r=await invoke(h);assert.equal(text(r),'UPSTREAM_UNSAFE_RESPONSE');
  assert.ok(!JSON.stringify(r).toLowerCase().includes(secret));
 }
});
test('configuration fails closed; fixed claim JSON removed and host adapter sanitizes errors',async()=>{
 for(const key of Object.keys(env)){const bad={...env};delete bad[key];assert.throws(()=>createLocalMcp({env:bad}),/CONFIGURATION_INVALID/);}
 for(const oldClaim of ['',JSON.stringify(claim),undefined])assert.throws(()=>createLocalMcp({env:{...env,LOCAL_MCP_CLAIM_JSON:oldClaim}}),/CONFIGURATION_INVALID/);
 for(const workerId of ['', '*', 'worker,name', 'x'.repeat(129),'another-worker','local_queue_rescue','LOCAL_QUEUE_RESCUE '])assert.throws(()=>createLocalMcp({env:{...env,LOCAL_MCP_WORKER_ID:workerId}}),/CONFIGURATION_INVALID/);
 const r=await worker.fetch(request(call()),{});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'LOCAL_MCP_UNAVAILABLE'});
});
test('HTTP, browser Origin and unknown routes refused before any network',async()=>{
 let calls=0;const h=createLocalMcp({env,fetchImpl:()=>{calls++;throw Error('must not call');}});
 assert.equal((await h(request(call(),{url:'http://local-mcp.example/mcp',headers:{'x-forwarded-proto':'https'}}))).status,400);assert.equal((await h(request(call(),{headers:{origin:'https://evil.example'}}))).status,403);assert.equal((await h(request(call(),{url:'https://local-mcp.example/save'}))).status,404);assert.equal(calls,0);
});
test('no caller-selected run, worker, token, race, endpoint, or ranking input',async()=>{
 let calls=0;const h=createLocalMcp({env,fetchImpl:()=>{calls++;throw Error('must not call');}});
 for(const a of [{...toolArgs,rank:1},{...toolArgs,job_id:'bad'},{...toolArgs,url:'https://evil.example'},{...toolArgs,claim_token:claim.claim_token},{...toolArgs,run_id:claim.run_id},{...toolArgs,worker_id:env.LOCAL_MCP_WORKER_ID},{...toolArgs,race_no:9},{...toolArgs,race_date:'2026-10-03'},{...toolArgs,track:'高知'}])assert.equal(text(await invoke(h,a)),'INVALID_TOOL_INPUT');assert.equal(calls,0);
});
test('upstream CONTEXT_CHANGED is preserved without retry or bypass',async()=>{
 let calls=0;const h=bridge({fetchImpl:async()=>{calls++;return response(409,{ok:false,error:'CONTEXT_CHANGED'});}});assert.equal(text(await invoke(h)),'CONTEXT_CHANGED');assert.equal(calls,1);
});
test('oversized upstream and malformed JSON fail closed',async()=>{
 for(const body of ['{broken','x'.repeat(1024*1024+1)]){const h=bridge({fetchImpl:async()=>new Response(body)});assert.equal(text(await invoke(h)),'UPSTREAM_UNAVAILABLE');}
});
