import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMcp, UPSTREAM_URL} from '../src/mcp.mjs';
import {createHandler} from '../supabase-candidate/supabase/functions/lab-claimed-context/handler.mjs';

// Local transport -> patched handler -> unchanged real collector. All external I/O is fixture-only.
const instant = Date.parse('2026-10-03T00:00:00Z');
const env = {LOCAL_MCP_BEARER_TOKEN:'local-e2e-fixture-0123456789abcdef0123456789',
  SUPABASE_SERVICE_ROLE_KEY:'local-e2e-service-fixture-only', LOCAL_MCP_WORKER_ID:'LOCAL_QUEUE_RESCUE'};
const runId = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const claimToken = '33333333-3333-4333-8333-333333333333';
const clone = value => JSON.parse(JSON.stringify(value));
function fixture({afterEdge = () => {}, mutate = () => {}} = {}) {
  const race = {race_date:'2026-10-03',track:'高知',race_no:9,circuit:'LOCAL',race_name:'fixture',
    post_time:'2026-10-03T01:00:00Z',prediction_status:'PENDING',
    field_payload:{runners:[{horse_no:1,horse_name:'検証馬',status:'ACTIVE',jockey:'騎手A',weight_carried:55}]}};
  const tables = {
    lab_prediction_jobs:[{id:jobId,...race,field_payload:undefined,job_status:'CLAIMED',worker_run_id:runId,
      claimed_by:env.LOCAL_MCP_WORKER_ID,lease_until:'2026-10-03T00:30:00Z',attempts:1,max_attempts:3,claim_token:claimToken}],
    lab_worker_runs:[{id:runId,worker_id:env.LOCAL_MCP_WORKER_ID,status:'RUNNING',region:'RESCUE'}],
    official_races:[race],
    lab_prediction_protocols:[{protocol_key:'LOCAL_MAIN',version:'fixture-v1',is_active:true,content:{rules:{compare:'all runners'}}}],
    horse_runs:[],jra_lab_runs:[],
  };
  mutate(tables);
  const operations = [];
  const client = {from(table) {
    assert.ok(Object.hasOwn(tables,table)); const filters = [];
    return {select(){return this;},eq(k,v){filters.push([k,v]);return this;},lt(){return this;},in(){return this;},
      order(){return this;},limit(){return this;},abortSignal(){
        return Promise.resolve({data:clone(tables[table].filter(row=>filters.every(([k,v])=>row[k]===v))),error:null});
      }};
  }};
  const official = {async readRace(){return {...clone(race),source:'NAR_OFFICIAL_DEBA',
    fetched_at:new Date(instant).toISOString(),source_ref:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=31&k_raceDate=2026/10/03&k_raceNo=9',
    runners:[{...clone(race.field_payload.runners[0]),sex_age:'牡3',identity_refs:[]}],
    history:[],conditions:{surface:'ダート',distance:1400}};},async readHistory(){return [];}};
  const edge = createHandler({client,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY,now:()=>instant,officialFactory:()=>official});
  const mcp = createLocalMcp({env,now:()=>instant,fetchImpl:async(url,options)=>{
    operations.push({method:options.method,url});
    if (url === UPSTREAM_URL) {
      const result = await edge(new Request(url,options)); afterEdge(tables); return result;
    }
    assert.equal(options.method,'GET');
    const u = new URL(url), table = u.pathname.split('/').at(-1);
    assert.ok(['lab_prediction_jobs','lab_worker_runs'].includes(table));
    const filters = [...u.searchParams].filter(([k])=>!['select','limit'].includes(k));
    const rows = tables[table].filter(row=>filters.every(([k,v])=>String(row[k])===v.slice(3)));
    return Response.json(clone(rows));
  }});
  return {tables,operations,async invoke(id=jobId){return (await mcp(new Request('https://mcp.example/mcp',{
    method:'POST',headers:{authorization:`Bearer ${env.LOCAL_MCP_BEARER_TOKEN}`,'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'lab_claimed_context',arguments:{job_id:id}}}),
  }))).json();}};
}
test('local integration: independently reloaded identical context succeeds with the unchanged collector',async()=>{
  const f = fixture(); const a = await f.invoke(), b = await f.invoke();
  assert.equal(a.result.isError,undefined); assert.deepEqual(a,b);
  assert.equal(a.result.structuredContent.context.runners[0].jockey,'騎手A');
  assert.equal(a.result.structuredContent.context.stage,'AWAITING_FULL_DEPTH_COMPARISON');
  assert.ok(!JSON.stringify(a).includes(claimToken));
  assert.equal(f.operations.filter(o=>o.method==='POST').length,2);
  assert.ok(f.operations.every(o=>o.method==='GET'||o.url===UPSTREAM_URL));
});
test('local integration: next owned LOCAL job uses fresh DB token without secret/config changes',async()=>{
  const f = fixture(); assert.equal((await f.invoke()).result.isError,undefined);
  const nextId = '44444444-4444-4444-8444-444444444444';
  f.tables.lab_prediction_jobs[0].id = nextId;
  f.tables.lab_prediction_jobs[0].claim_token = '55555555-5555-4555-8555-555555555555';
  assert.equal((await f.invoke(nextId)).result.isError,undefined);
});
test('local integration: expired claim never reaches Edge Function',async()=>{
  const f = fixture({mutate:t=>{t.lab_prediction_jobs[0].lease_until=new Date(instant).toISOString();}});
  assert.equal((await f.invoke()).result.content[0].text,'CLAIM_UNAVAILABLE');
  assert.equal(f.operations.filter(o=>o.method==='POST').length,0);
});
test('local integration: reassignment after successful upstream response discards context',async()=>{
  const f = fixture({afterEdge:t=>{t.lab_prediction_jobs[0].claimed_by='different-worker';}});
  const r = await f.invoke();assert.equal(r.result.content[0].text,'CLAIM_UNAVAILABLE');
  assert.equal(r.result.structuredContent,undefined);
});
for (const [label, mutate] of [
  ['missing linked run',t=>{t.lab_worker_runs=[];}],
  ['different run',t=>{t.lab_worker_runs[0].id='44444444-4444-4444-8444-444444444444';}],
  ['different worker',t=>{t.lab_worker_runs[0].worker_id='another-worker';}],
  ['different region',t=>{t.lab_worker_runs[0].region='LOCAL';}],
  ['finished run',t=>{t.lab_worker_runs[0].status='COMPLETED';}],
]) test('local integration: matching claimed_by with '+label+' is rejected before Edge',async()=>{
  const f=fixture({mutate});const r=await f.invoke();
  assert.equal(r.result.content[0].text,'CLAIM_UNAVAILABLE');
  assert.equal(r.result.structuredContent,undefined);
  assert.equal(f.operations.filter(o=>o.method==='POST').length,0);
});
for (const [label, afterEdge, error] of [
  ['token rotation',t=>{t.lab_prediction_jobs[0].claim_token='55555555-5555-4555-8555-555555555555';},'CLAIM_CHANGED'],
  ['run replacement',t=>{const next='44444444-4444-4444-8444-444444444444';t.lab_prediction_jobs[0].worker_run_id=next;t.lab_worker_runs[0].id=next;},'CLAIM_CHANGED'],
  ['lease expiry',t=>{t.lab_prediction_jobs[0].lease_until=new Date(instant).toISOString();},'CLAIM_UNAVAILABLE'],
  ['job status change',t=>{t.lab_prediction_jobs[0].job_status='RETRY';},'CLAIM_UNAVAILABLE'],
  ['run completion',t=>{t.lab_worker_runs[0].status='COMPLETED';},'CLAIM_UNAVAILABLE'],
]) test('local integration: '+label+' after Edge context succeeds still discards the context',async()=>{
  const f=fixture({afterEdge});const r=await f.invoke();
  assert.equal(r.result.content[0].text,error);assert.equal(r.result.structuredContent,undefined);
  assert.equal(f.operations.filter(o=>o.method==='POST').length,1);
  for(const secret of [claimToken,f.tables.lab_prediction_jobs[0].claim_token,env.SUPABASE_SERVICE_ROLE_KEY,env.LOCAL_MCP_BEARER_TOKEN])
    assert.ok(!JSON.stringify(r).includes(secret));
});
