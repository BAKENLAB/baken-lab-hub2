import test from 'node:test';
import assert from 'node:assert/strict';
import {createSitesAuthAdapter,SITES_USER_HEADER} from '../src/sites-auth.mjs';
import worker,{createSitesWorker} from '../src/worker.mjs';
import {UPSTREAM_URL} from '../src/mcp.mjs';

const NOW = Date.parse('2026-10-03T00:00:00Z');
const env = {LOCAL_MCP_BEARER_TOKEN:'fixture-internal-token-0123456789abcdef0123456789',
  SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key-only',LOCAL_MCP_WORKER_ID:'LOCAL_QUEUE_RESCUE',
  LOCAL_MCP_ALLOWED_SITES_USER_IDS:JSON.stringify(['site-scoped-fixture-owner']),OAUTH_CLIENT_SECRET:'fixture-oauth-client-secret-only'};
const token='fixture-valid-oauth-access-token', expired='fixture-expired-oauth-access-token';
const jobId='22222222-2222-4222-8222-222222222222',runId='11111111-1111-4111-8111-111111111111';
const claimToken='abcdefab-cdef-4abc-8def-abcdefabcdef';
const job={id:jobId,race_date:'2026-10-03',track:'高知',race_no:9,circuit:'LOCAL',job_status:'CLAIMED',
  claimed_by:'LOCAL_QUEUE_RESCUE',worker_run_id:runId,claim_token:claimToken,
  lease_until:'2026-10-03T00:30:00Z',attempts:1,max_attempts:3};
const run={id:runId,worker_id:'LOCAL_QUEUE_RESCUE',region:'RESCUE',status:'RUNNING'};
const context={race:{race_date:job.race_date,track:job.track,race_no:9,circuit:'LOCAL'},
  protocol:{protocol_key:'LOCAL_MAIN',version:'fixture',content:{compare:'all horses'}},
  protocol_version:'fixture',runners:[{horse_no:1,horse_name:'検証馬'}],missing_conditions:[],
  field_integrity_checked:true,stage:'AWAITING_FULL_DEPTH_COMPARISON',supplementation_audit:[]};
const call=(args={job_id:jobId})=>({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'lab_claimed_context',arguments:args}});
function request(message=call(),{access=token,user='site-scoped-fixture-owner',headers={}}={}) {
  return new Request('https://sites-fixture.example/mcp',{method:'POST',headers:{'content-type':'application/json',
    ...(access?{authorization:'Bearer '+access}:{}),...(user?{[SITES_USER_HEADER]:user}:{}),...headers},body:JSON.stringify(message)});
}
function setup({envOverride={},verifyOverride,dbFailure=false,output=context}={}) {
  const calls=[];let time=NOW,verifications=0;
  // Fixture-only OAuth authority. This is NOT a guessed Sites token validator.
  const grants=new Map([[token,{user:'site-scoped-fixture-owner',until:NOW+60000}],
    [expired,{user:'site-scoped-fixture-owner',until:NOW}],
    ['fixture-other-user',{user:'site-scoped-other',until:NOW+60000}]]);
  const verify=verifyOverride??(async req=>{
    verifications++;const value=req.headers.get('authorization')?.replace(/^Bearer /,'');const grant=grants.get(value);
    return !!grant&&grant.until>time&&req.headers.get(SITES_USER_HEADER)===grant.user;
  });
  const handle=createSitesAuthAdapter({env:{...env,...envOverride},now:()=>time,verifyHostingRequest:verify,
    fetchImpl:async(url,options)=>{
      calls.push({url,options});
      assert.equal(options.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);
      assert.ok(!JSON.stringify(options.headers).includes(token));
      assert.equal(options.headers[SITES_USER_HEADER],undefined);
      if(dbFailure)throw Error(token+' '+claimToken+' '+env.OAUTH_CLIENT_SECRET+' '+env.SUPABASE_SERVICE_ROLE_KEY);
      if(url===UPSTREAM_URL){assert.deepEqual(JSON.parse(options.body),{job_id:jobId,run_id:runId,claim_token:claimToken});return Response.json({ok:true,context:output});}
      const u=new URL(url);assert.equal(options.method,'GET');
      if(u.pathname.endsWith('lab_prediction_jobs')){
        assert.equal(u.searchParams.get('claimed_by'),'eq.LOCAL_QUEUE_RESCUE');return Response.json([job]);
      }
      assert.equal(u.searchParams.get('worker_id'),'eq.LOCAL_QUEUE_RESCUE');
      assert.equal(u.searchParams.get('region'),'eq.RESCUE');return Response.json([run]);
    }});
  return {handle,calls,expire(){time=NOW+60000;},get verifications(){return verifications;}};
}
for(const [name,access,user] of [['no authentication',null,null],['broken token','broken-token','site-scoped-fixture-owner'],
  ['expired token',expired,'site-scoped-fixture-owner'],['spoofed trusted header','broken-token','site-scoped-fixture-owner']]){
  test(name+' is rejected before resolver',async()=>{
    const f=setup();assert.equal((await f.handle(request(call(),{access,user}))).status,401);assert.equal(f.calls.length,0);
  });
}
test('authenticated other user has no LOCAL permission',async()=>{
  const f=setup();assert.equal((await f.handle(request(call(),{access:'fixture-other-user',user:'site-scoped-other'}))).status,403);assert.equal(f.calls.length,0);
});
test('email, name and worker headers cannot manufacture permission',async()=>{
  const f=setup();assert.equal((await f.handle(request(call(),{access:'fixture-other-user',user:'site-scoped-other',
    headers:{'oai-authenticated-user-email':'owner@example.invalid','x-worker-id':'LOCAL_QUEUE_RESCUE','x-region':'RESCUE'}}))).status,403);
  assert.equal(f.calls.length,0);
});
test('authorized Sites identity reaches resolver and fixed LOCAL context',async()=>{
  const f=setup(),r=await f.handle(request());assert.equal(r.status,200);const data=await r.json();
  assert.deepEqual(data.result.structuredContent.context,context);assert.deepEqual(f.calls.map(c=>c.options.method),['GET','GET','POST','GET','GET']);
  assert.equal(f.verifications,2);
});
for(const [key,value] of [['worker_id','LOCAL_QUEUE_RESCUE'],['region','RESCUE'],['circuit','LOCAL'],
  ['claim_token',claimToken],['worker_run_id',runId],['run_id',runId],['race_no',9]]){
  test('tool rejects caller supplied '+key+' even if equal to fixed permission',async()=>{
    const f=setup(),r=await f.handle(request(call({job_id:jobId,[key]:value})));const data=await r.json();
    assert.ok(r.status===400||data.result?.isError===true);assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(data).includes(claimToken));
  });
}
test('worker configuration cannot widen fixed authority',async()=>{
  const f=setup({envOverride:{LOCAL_MCP_WORKER_ID:'another-worker'}});assert.equal((await f.handle(request())).status,503);assert.equal(f.calls.length,0);
});
test('missing/invalid allowlist fails closed',async()=>{
  for(const raw of [undefined,'broken','[]','["*"]','["owner,other"]']){
    const f=setup({envOverride:{LOCAL_MCP_ALLOWED_SITES_USER_IDS:raw}}),r=await f.handle(request());
    assert.ok(r.status===503||r.status===403);assert.equal(f.calls.length,0);
  }
});
test('Sites worker has no internal Bearer fallback when dispatch user identity is absent',async()=>{
  const r=await worker.fetch(request(call(),{access:env.LOCAL_MCP_BEARER_TOKEN,user:null}),env);assert.equal(r.status,401);
});
test('auth verifier errors hide raw credentials and never reach resolver',async()=>{
  const f=setup({verifyOverride:async()=>{throw Error(token+' '+env.OAUTH_CLIENT_SECRET);}}),r=await f.handle(request());
  assert.equal(r.status,401);const body=await r.text();assert.ok(!body.includes(token));assert.ok(!body.includes(env.OAUTH_CLIENT_SECRET));assert.equal(f.calls.length,0);
});
test('OAuth revocation/expiry during context retrieval discards successful context',async()=>{
  let count=0;const f=setup({verifyOverride:async()=>++count===1});const r=await f.handle(request());assert.equal(r.status,401);
  assert.equal((await r.json()).error,'UNAUTHORIZED');assert.equal(f.calls.length,5);
});
test('platform-consumed OAuth token needs no application JWT parsing',async()=>{
  const f=setup({verifyOverride:async()=>true});const r=await f.handle(request(call(),{access:null}));
  assert.equal(r.status,200);assert.equal(f.calls.length,5);
});
test('verified service request with no user identity is not authorized',async()=>{
  const f=setup({verifyOverride:async()=>true});assert.equal((await f.handle(request(call(),{access:null,user:null}))).status,401);assert.equal(f.calls.length,0);
});
test('OAuth/internal/service/claim secrets cannot enter responses or error details',async()=>{
  for(const secret of [token,env.OAUTH_CLIENT_SECRET,env.LOCAL_MCP_BEARER_TOKEN,env.SUPABASE_SERVICE_ROLE_KEY,claimToken]){
    const f=setup({output:{...context,protocol:{...context.protocol,content:{note:secret}}}}),r=await f.handle(request());
    const body=await r.text();assert.ok(!body.includes(secret));assert.ok(!body.includes('Authorization'));
  }
  const f=setup({dbFailure:true}),r=await f.handle(request());const body=await r.text();
  for(const secret of [token,claimToken,env.OAUTH_CLIENT_SECRET,env.SUPABASE_SERVICE_ROLE_KEY])assert.ok(!body.includes(secret));
});
test('OAuth credential in RPC id is rejected without echo or resolver access',async()=>{
  const f=setup(),r=await f.handle(request({...call(),id:token}));assert.equal(r.status,400);assert.ok(!(await r.text()).includes(token));assert.equal(f.calls.length,0);
});
test('no logs on success, denied auth, verifier error, unsafe response or resolver error',async()=>{
  const logs=[],keys=['log','warn','error','info','debug'],originals=keys.map(k=>console[k]);keys.forEach(k=>{console[k]=(...a)=>logs.push(a);});
  try {
    await setup().handle(request());await setup().handle(request(call(),{access:'bad'}));
    await setup({dbFailure:true}).handle(request());
    await setup({verifyOverride:async()=>{throw Error(env.OAUTH_CLIENT_SECRET);}}).handle(request());
    await setup({output:{...context,protocol:{...context.protocol,content:{note:token}}}}).handle(request());
    assert.deepEqual(logs,[]);
  } finally {keys.forEach((k,i)=>{console[k]=originals[i];});}
});
test('auth verifier that never completes is bounded and cannot reach resolver',async()=>{
  let signal;const h=createSitesAuthAdapter({env,timeoutMs:10,verifyHostingRequest:async(req,o)=>{signal=o.signal;return new Promise(()=>{});},fetchImpl:()=>{throw Error('must not call');}});
  assert.equal((await h(request())).status,504);assert.equal(signal.aborted,true);
});
test('discovery is authorized and advertises job_id only',async()=>{
  const f=setup(),r=await f.handle(request({jsonrpc:'2.0',id:1,method:'tools/list'}));
  const data=await r.json();assert.deepEqual(Object.keys(data.result.tools[0].inputSchema.properties),['job_id']);assert.equal(f.calls.length,0);
});
test('bound worker preserves failclosed authorization',async()=>{
  const bound=createSitesWorker({verifyHostingRequest:async()=>false});assert.equal((await bound.fetch(request(),env)).status,401);
});
test('Sites-only worker consumes dispatch user identity with OAuth already handled by hosting',async()=>{
  const hosted=createSitesWorker({fetchImpl:()=>{throw Error('discovery must not reach DB');}});
  const r=await hosted.fetch(request({jsonrpc:'2.0',id:1,method:'tools/list'},{access:null}),env);
  assert.equal(r.status,200);assert.equal((await r.json()).result.tools[0].name,'lab_claimed_context');
});
test('Sites-only worker enforces app allowlist on dispatch-authenticated user',async()=>{
  const hosted=createSitesWorker({fetchImpl:()=>{throw Error('unauthorized user must not reach DB');}});
  const r=await hosted.fetch(request(call(),{access:null,user:'site-scoped-other'}),env);
  assert.equal(r.status,403);
});
test('Sites-only worker cannot treat platform service access as user identity',async()=>{
  const hosted=createSitesWorker({fetchImpl:()=>{throw Error('service identity must not reach DB');}});
  const r=await hosted.fetch(request(call(),{access:null,user:null,headers:{'OAI-Sites-Authorization':'Bearer fixture-service-access'}}),env);
  assert.equal(r.status,401);
});
