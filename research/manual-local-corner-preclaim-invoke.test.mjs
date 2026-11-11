import test from 'node:test';
import assert from 'node:assert/strict';
import {runManualLocalCornerPreclaim} from '../automation/manual-local-corner-preclaim-invoke.mjs';
const key='never-print-this-private-service-value-'+ 'x'.repeat(100);
const now=()=>Date.parse('2026-11-08T10:50:00+09:00');
const original={
 raceDate:'2026-11-08',track:'盛岡',raceNo:4,serviceKey:key,
 supabaseUrl:'https://qjlvsndiqjfsfjinilig.supabase.co',
 explicitApproved:true,clock:now
};
const call=(opts={})=>runManualLocalCornerPreclaim({...original,...opts});
test('explicit authorized service call is one-race preclaim only; omits secret and market',async()=>{
 let invoked=0;
 const result=await call({fetchImpl:async (url,opts)=>{
  invoked++;
  assert.equal(url,'https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/lab-local-corner-preclaim');
  assert.equal(opts.method,'POST');
  assert.equal(opts.redirect,'error');
  assert.deepEqual(JSON.parse(opts.body),{
   intent:'AUTHORIZED_PRECLAIM_RESEARCH',race_date:'2026-11-08',track:'盛岡',race_no:4
  });
  assert.equal(opts.headers.authorization,'Bearer '+key);
  return {ok:true,url,
   json:async()=>({ok:true,status:'STORED',read_count:2,
    linked_prior_runs:3,stored:true,verified_profile_horses:2,
    verified_prior_witnesses:6,unavailable_or_empty_profiles:8,
    claim_started:false,prediction_saved:false})};
 }});
 assert.equal(invoked,1);
 assert.deepEqual(result,{
  status:'STORED',request_started:true,claim_started:false,
  prediction_saved:false,stored:true,read_count:2,linked_prior_runs:3,
  verified_profile_horses:2,verified_prior_witnesses:6,
  unavailable_or_empty_profiles:8
 });
 assert.equal(JSON.stringify(result).includes(key),false);
});
test('explicit ack, exact project, same JST day and key required before any network',async()=>{
 let sent=0;
 const f=async()=>{sent++;throw Error('must not invoke')};
 const checks=[
  {explicitApproved:false},{supabaseUrl:'https://untrusted.example'},
  {track:'東京'},{serviceKey:null},{raceNo:0},{raceDate:'2026-11-09'},
  {supabaseUrl:'http://qjlvsndiqjfsfjinilig.supabase.co'}
 ];
 for(const opts of checks){
  const out=await call({...opts,fetchImpl:f});
  assert.equal(out.status,'EXPLICIT_AUTHORIZATION_OR_PARAMETERS_MISSING');
  assert.equal(out.request_started,false);
 }
 assert.equal(sent,0);
});
test('backend refusal and malicious echo are fail-closed without leaking secret',async()=>{
 const denied=await call({fetchImpl:async url=>({ok:false,status:403,url})});
 assert.equal(denied.status,'BACKEND_DENIED_OR_UNAVAILABLE');
 const changed=await call({fetchImpl:async url=>({
  ok:true,url,json:async()=>({ok:true,status:'STORED',
   claim_started:true,prediction_saved:false})
 })});
 assert.equal(changed.status,'BACKEND_RESULT_NOT_VERIFIED');
 assert.equal(JSON.stringify(changed).includes(key),false);
});
test('timeout never loops or claims from the client',async()=>{
 let requests=0;
 const out=await call({fetchImpl:async()=>{
  requests++;throw Error('timeout');
 }});
 assert.equal(out.status,'BACKEND_TIMEOUT_OR_TRANSPORT_ERROR');
 assert.equal(requests,1);
 assert.equal(out.claim_started,false);
 assert.equal(out.prediction_saved,false);
});
