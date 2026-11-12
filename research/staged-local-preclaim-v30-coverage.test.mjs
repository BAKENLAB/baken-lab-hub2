import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Tests only the isolated v30 preclaim tool callback, with mocked auth and DB.
// There is NO live network, service credential, CLAIM, save, or scheduler.
const source=readFileSync(
 new URL('./staged-local-claimed-mcp-preclaim-v30.ts',import.meta.url),'utf8');
const start=source.indexOf('s.registerTool("lab_preclaim_official_corners"');
const end=source.indexOf('s.registerTool("lab_claimed_context"',start);
assert.ok(start>0 && end>start,'Exact preclaim tool must exist');
const handlerSource=source.slice(start,end);
const dummySchema=new Proxy(()=>({}),{get(){return ()=>dummySchema}});
const z={object:()=>dummySchema,string:()=>dummySchema,
 number:()=>dummySchema,enum:()=>dummySchema};
const now=Date.parse('2026-11-13T06:00:00+09:00');
class FrozenDate extends Date{static now(){return now}}
const secret='ONLY_FOR_MOCK_NEVER_REAL_SERVICE_KEY';
function make(overrides={}){
 const trace={reads:0,requests:0,requestBodies:[]};
 const row={field_status:'READY',prediction_status:'PENDING',
  post_time:'2026-11-13T10:00:00+09:00',...overrides.row};
 const db={from(table){
  assert.equal(table,'official_races');
  trace.reads++;
  return {select(){return this},eq(){return this},
   limit(){return Promise.resolve({data:overrides.races??[row],error:null})}};
 }};
 let callback;
 const tool={registerTool(name,_meta,cb){
  assert.equal(name,'lab_preclaim_official_corners');callback=cb;
 }};
 const result={ok:true,status:'STORED',stored:true,linked_prior_runs:3,
  read_count:4,verified_profile_horses:2,
  verified_prior_witnesses:5,unavailable_or_empty_profiles:1,
  missing_official_horse_links:0,
  claim_started:false,prediction_saved:false,...overrides.result};
 const transport=async (url,request)=>{
  trace.requests++;
  assert.equal(url,'https://mock.supabase.co/functions/v1/lab-local-corner-preclaim');
  assert.equal(request.method,'POST');
  assert.equal(request.redirect,'error');
  assert.equal(request.headers.authorization,'Bearer '+secret);
  trace.requestBodies.push(JSON.parse(request.body));
  return {ok:true,json:async()=>result};
 };
 const auth=async()=>{if(overrides.denied)throw Error('FORBIDDEN')};
 new Function('s','z','auth','admin','Date','fetch','AbortSignal','err',
  handlerSource)(tool,z,auth,
   ()=>({u:'https://mock.supabase.co',k:secret,c:db}),
   FrozenDate,transport,{timeout:ms=>({timeout:ms})},
   e=>String(e?.message||'ERROR'));
 return {trace,call:(args={})=>callback({
  race_date:'2026-11-13',track:'名古屋',race_no:1,...args})};
}
test('one authorized LOCAL preclaim returns all bounded source coverage without secrets',async()=>{
 const t=make(),response=await t.call(),v=response.structuredContent;
 assert.equal(t.trace.requests,1);
 assert.equal(t.trace.reads,1);
 assert.deepEqual(t.trace.requestBodies,[{
  intent:'AUTHORIZED_PRECLAIM_RESEARCH',
  race_date:'2026-11-13',track:'名古屋',race_no:1
 }]);
 assert.deepEqual({
  verified_prior_witnesses:v.verified_prior_witnesses,
  unavailable_or_empty_profiles:v.unavailable_or_empty_profiles,
  missing_official_horse_links:v.missing_official_horse_links
 },{verified_prior_witnesses:5,unavailable_or_empty_profiles:1,
    missing_official_horse_links:0});
 assert.equal(v.claim_started,false);
 assert.equal(v.prediction_saved,false);
 assert.equal(v.frozen_modified,false);
 assert.equal(v.market_used,false);
 assert.equal(JSON.stringify(response).includes(secret),false);
});
test('backend malformed or extreme counts never appear as verified coverage',async()=>{
 const t=make({result:{verified_prior_witnesses:-3,
  unavailable_or_empty_profiles:999,missing_official_horse_links:'5'}});
 const v=(await t.call()).structuredContent;
 assert.equal(v.verified_prior_witnesses,0);
 assert.equal(v.unavailable_or_empty_profiles,0);
 assert.equal(v.missing_official_horse_links,0);
});
test('different JST date cannot call source endpoint',async()=>{
 const t=make(),x=await t.call({race_date:'2026-11-12'});
 assert.equal(x.isError,true);
 assert.equal(t.trace.requests,0);
 assert.equal(t.trace.reads,0);
});
test('FROZEN, invalid roster, and deadline blocks have no source network calls',async()=>{
 for(const row of [
  {prediction_status:'FROZEN'},
  {field_status:'UNVERIFIED'},
  {post_time:'2026-11-13T06:09:00+09:00'}
 ]){
  const t=make({row});
  assert.equal((await t.call()).isError,true);
  assert.equal(t.trace.requests,0);
 }
});
test('server ownership and exact official race row are mandatory',async()=>{
 for(const settings of [{denied:true},{races:[]}]){
  const t=make(settings);
  assert.equal((await t.call()).isError,true);
  assert.equal(t.trace.requests,0);
 }
});
test('manual preclaim callback has no CLAIM, FROZEN, Cron, odds or result update',()=>{
 for(const banned of [
  'lab_queue_claim_next','lab_save_claimed_prediction',
  'official_predictions','cron.schedule','bet_strategy'
 ])assert.equal(handlerSource.includes(banned),false);
 assert.ok(handlerSource.includes('await auth()'));
 assert.ok(handlerSource.includes('PRECLAIM_NOT_ELIGIBLE'));
});
