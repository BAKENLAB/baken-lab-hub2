import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {canonical,hash,capture,link,BUDGET_MS} from '../candidate/local-ai-worker/input-archive.mjs'
const now=Date.now()
const job={id:crypto.randomUUID(),worker_run_id:crypto.randomUUID(),race_date:'2026-10-08',track:'TEST',race_no:1,circuit:'LOCAL',lease_until:new Date(now+300000).toISOString()}
const context={race:{race_date:job.race_date,track:job.track,race_no:1,circuit:'LOCAL',post_time:new Date(now+400000).toISOString()},protocol_version:'TEST',runners:[]}
const options={now:()=>now,logger:()=>{}}
function client(fn) {return {rpc(name,args){return {abortSignal(signal){return fn(name,args,signal)}}}}}
const ok=()=>({data:{ok:true,snapshot_id:'s',archive_event_id:'e'}})
test('canonical key order, array order preserved',()=>{assert.equal(canonical({b:2,a:[2,1]}),'{"a":[2,1],"b":2}');assert.notEqual(canonical([1,2]),canonical([2,1]))})
test('SHA256 standard vector',async()=>assert.equal(await hash('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'))
test('captures exact prompt and separate hashes without fake revision',async()=>{
 const before=JSON.stringify(context)
 const a=await capture(client(async(n,{p_input:p})=>{
  assert.equal(n,'local_shadow_capture_v1');assert.equal(p.prompt_context_json,before)
  assert.equal(p.context_version,null);assert.equal(p.archive_format_version,'LOCAL_INPUT_ARCHIVE_V1')
  assert.equal(p.context_hash,await hash(canonical(context)))
  assert.equal(p.prompt_context_hash,await hash(before))
  assert.equal(p.protocol_hash,await hash('{"x":1}'))
  assert.equal(p.claim_token,undefined);return ok()
 }),job,context,{x:1},options)
 assert.equal(a.snapshot_id,'s');assert.equal(JSON.stringify(context),before)
})
for(const mode of ['hash','snapshot','event','conflict','logger']) test('FAIL-OPEN '+mode,async()=>{
 const a=await capture(client(async()=>{if(mode==='conflict')return {data:{ok:false}};throw Error(mode)}),job,context,{},{
  ...options,hash:mode==='hash'?async()=>{throw Error('hash')}:hash,
  logger:mode==='logger'?()=>{throw Error('logger')}:options.logger,
 })
 assert.equal(a,null)
 // Existing prediction proceeds once; no retry or OpenAI call is made by module.
 let calls=0; calls++; assert.equal(calls,1)
})
test('capture hung RPC terminates at budget',async()=>{
 const start=performance.now()
 assert.equal(await capture(client(()=>new Promise(()=>{})),job,context,{},options),null)
 const elapsed=performance.now()-start
 assert.ok(elapsed>=BUDGET_MS-30 && elapsed<BUDGET_MS+250)
})
for(const margin of [180000,185000,NaN]) test('skip near or unknown post '+margin,async()=>{
 let calls=0
 const c={...context,race:{...context.race,post_time:Number.isNaN(margin)?null:new Date(now+margin).toISOString()}}
 assert.equal(await capture(client(()=>{calls++;return ok()}),job,c,{},options),null);assert.equal(calls,0)
})
test('skip short lease',async()=>assert.equal(await capture(client(ok),{...job,lease_until:new Date(now+5000).toISOString()},context,{},options),null))
test('reject secret nested field without saving',async()=>{
 let calls=0;assert.equal(await capture(client(()=>{calls++;return ok()}),job,{...context,nested:{claim_token:'forbidden'}},{},options),null);assert.equal(calls,0)
})
test('reject JRA',async()=>assert.equal(await capture(client(ok),{...job,circuit:'JRA'},context,{},options),null))
test('link exact successful attempt',async()=>{
 await link(client(async(n,p)=>{assert.equal(n,'local_shadow_link_v1');assert.deepEqual(p,{p_prediction_id:'p',p_archive_event_id:'e'});return ok()}),{snapshot_id:'s',archive_event_id:'e'},{prediction_id:'p',already_saved:false},options)
})
test('already_saved never creates link',async()=>{
 let calls=0;await link(client(()=>{calls++;return ok()}),{archive_event_id:'e'},{prediction_id:'p',already_saved:true},options);assert.equal(calls,0)
})
test('link failure fail-open',async()=>await link(client(()=>{throw Error('db')}),{archive_event_id:'e'},{prediction_id:'p'},options))
test('link timeout fail-open',async()=>{const start=performance.now();await link(client(()=>new Promise(()=>{})),{archive_event_id:'e'},{prediction_id:'p'},options);assert.ok(performance.now()-start<750)})
test('candidate baseline equivalence except archive hooks; one OpenAI site',()=>{
 const base=readFileSync(new URL('../baseline/local-ai-worker-v6/index.ts',import.meta.url),'utf8')
 const cand=readFileSync(new URL('../candidate/local-ai-worker/index.ts',import.meta.url),'utf8')
 const restored=cand.replace("import { capture, link } from './input-archive.mjs'\n\n",'').replace('    const archive = await capture(client, job, context, protocolRow.content)\n\n','').replace('    await link(client, archive, saved)\n\n','')
 assert.equal(restored,base)
 assert.equal((cand.match(/api.openai.com/g)||[]).length,1)
})
test('migration scoped immutable/ACL guards (static, NOT DB proof)',()=>{
 const sql=readFileSync(new URL('../sql/input-archive-migration-proposal.sql',import.meta.url),'utf8')
 assert.ok(!/SECURITY DEFINER|UPDATE public\.|ALTER TABLE public\./i.test(sql))
 for(const term of ['BEFORE UPDATE OR DELETE','BEFORE TRUNCATE','SECURITY INVOKER','FROM PUBLIC,anon,authenticated','archive_event_id uuid UNIQUE','context_version IS NOT NULL','context_hash=encode'])assert.ok(sql.includes(term),term)
})

test('retry context changes hash; same context keeps snapshot identity inputs',async()=>{
 const seen=[]
 const c=client(async(n,{p_input:p})=>{seen.push(p);return ok()})
 await capture(c,job,context,{},options)
 await capture(c,job,{...context,runners:[{horse_no:1}]},{},options)
 await capture(c,job,context,{},options)
 assert.notEqual(seen[0].context_hash,seen[1].context_hash)
 assert.equal(seen[0].context_hash,seen[2].context_hash)
 assert.notEqual(seen[0].trace_id,seen[2].trace_id)
})
test('real upstream version preserved; changed hash not hidden by version',async()=>{
 const seen=[];const c=client(async(n,{p_input:p})=>{seen.push(p);return ok()})
 await capture(c,job,{...context,context_version:'revision-1'},{},options)
 await capture(c,job,{...context,context_version:'revision-1',runners:[1]},{},options)
 assert.equal(seen[0].context_version,seen[1].context_version)
 assert.notEqual(seen[0].context_hash,seen[1].context_hash)
})
