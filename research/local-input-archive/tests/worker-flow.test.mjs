
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {readFileSync} from 'node:fs'
import {capture,link} from '../candidate/local-ai-worker/input-archive.mjs'
for(const failure of ['capture','link']) test('actual candidate worker succeeds despite '+failure+' RPC failure',async()=>{
 const now=Date.now(),id=crypto.randomUUID()
 const job={id,race_date:'2026-10-08',track:'TEST',race_no:1,circuit:'LOCAL',worker_run_id:crypto.randomUUID(),claim_token:'NOT_ARCHIVED',lease_until:new Date(now+300000).toISOString()}
 const context={context_format:'COMPACT_V1',field_integrity_checked:true,protocol_version:'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004',race:{race_date:job.race_date,track:job.track,race_no:1,circuit:'LOCAL',post_time:new Date(now+400000).toISOString()},runners:[{horse_no:1,horse_name:'TEST',recent_runs:[],missing_items:[]}]}
 const calls=[]
 const c={rpc(name,args){calls.push(name)
   if(name==='local_shadow_capture_v1'||name==='local_shadow_link_v1')return {abortSignal:async()=>{if(name.includes(failure))throw Error('INJECTED');return {data:{ok:true,snapshot_id:'s',archive_event_id:'e'}}}}
   if(name==='lab_worker_secret_v1')return Promise.resolve({data:'test-only'})
   if(name==='lab_queue_claim_next_v2')return Promise.resolve({data:{claimed:true,job_id:id}})
   if(name==='lab_queue_save_prediction_v1')return Promise.resolve({data:{ok:true,prediction_id:'p',already_saved:false}})
   return Promise.resolve({data:null})
 },from(table){const q={select(){return q},eq(){return q},single:async()=>({data:table==='lab_prediction_jobs'?job:{version:context.protocol_version,content:{}}})};return q}}
 let handler,openai=0,prompt
 const sandbox={createClient:()=>c,capture,link,Request,Response,AbortSignal,console:{log(){},error(){}},Deno:{env:{get:()=> 'test-only'},serve:h=>{handler=h}},fetch:async(url,init)=>{
  if(url.includes('lab-claimed-context'))return Response.json({ok:true,context})
  assert.equal(url,'https://api.openai.com/v1/responses');openai++;prompt=JSON.parse(init.body)
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({runners:[{horse_no:1,rank:1,grade:'B',reason:'test',evidence_summary:'test'}],candidates:[],pairs:[],eye:null,summary:'test',eye_abstention_reason:'test'})}]}]})
 }}
 const source=readFileSync(new URL('../candidate/local-ai-worker/index.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'')
 vm.runInNewContext(stripTypeScriptTypes(source),sandbox)
 const res=await handler(new Request('https://test.invalid',{method:'POST',headers:{'x-baken-worker-token':'test-only'},body:JSON.stringify({worker_id:'LOCAL_QUEUE_WEST'})}))
 const body=await res.json();assert.equal(res.status,200,JSON.stringify(body));assert.equal(body.saved,true)
 assert.equal(openai,1);assert.equal(prompt.model,'gpt-5.6-sol');assert.equal(prompt.reasoning.effort,'low');assert.equal(prompt.max_output_tokens,10000)
 assert.ok(prompt.input[0].content[0].text.endsWith(JSON.stringify(context)))
 assert.ok(!calls.includes('lab_finish_prediction_job'))
})
