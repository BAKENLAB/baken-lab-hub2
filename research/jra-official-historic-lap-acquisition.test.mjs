import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireVerifiedJraHistoricLaps} from '../automation/jra-official-historic-lap-acquisition.mjs';
const now=()=>Date.parse('2026-11-08T10:12:00+09:00');
const race={raceDate:'2026-11-08',postTime:'2026-11-08T11:25:00+09:00'};
const prior={raceDate:'2026-11-07',track:'京都',raceNo:12,
 surface:'芝',distance:2000,
 sourceRef:'/JRADB/accessS.html?CNAME=sw01sde0108202605011220261107%2F84'};
const url='https://www.jra.go.jp'+prior.sourceRef;
const body='2026年11月7日 京都 第12競走 芝2000m '+ '公式レース結果 '.repeat(20)+
 'ハロンタイム 12.8 - 11.5 - 12.6 - 12.3 - 12.1 - 12.2 - 11.5 - 11.4 - 11.9 - 11.5 上り 3F34.8';
const bytes=new TextEncoder().encode(body);
const headers=new Headers({'content-type':'text/html;charset=utf-8','content-length':String(bytes.length)});
let requests=[];
const fetchImpl=async (requested,options)=>{
 requests.push({url:requested,options});
 return {ok:true,url:requested,headers,arrayBuffer:async()=>bytes.buffer};
};
const run=(overrides={})=>acquireVerifiedJraHistoricLaps({
 targetRace:race,priorRace:prior,fetchImpl,extractText:async html=>html,
 clock:now,...overrides
});
test('manual historic source fetch obtains 200m splits without any current race result or write',async()=>{
 requests=[];
 const x=await run();
 assert.equal(x.status,'OFFICIAL_RACE_LAPS_VERIFIED');
 assert.equal(x.first_600m_seconds,36.9);
 assert.equal(x.last_600m_seconds,34.8);
 assert.equal(x.claim_started,false);
 assert.equal(x.prediction_saved,false);
 assert.equal(x.rank_effect,'NONE');
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,url);
 assert.equal(requests[0].options.redirect,'error');
 assert.equal(requests[0].options.method,'GET');
});
test('invalid or external prior-race URL is rejected before any network fetch',async()=>{
 requests=[];
 const x=await run({priorRace:{...prior,sourceRef:'https://evil.example/results'}});
 assert.equal(x.status,'OFFICIAL_PAST_URL_UNVERIFIED');
 assert.equal(requests.length,0);
});
test('preclaim post-time reserve and future prior race reject before fetch',async()=>{
 requests=[];
 const x=await run({clock:()=>Date.parse('2026-11-08T11:23:00+09:00')});
 assert.equal(x.status,'NO_SAFE_PRECLAIM_ACQUISITION');
 assert.equal(requests.length,0);
 const y=await run({priorRace:{...prior,raceDate:'2026-11-08'}});
 assert.equal(y.status,'NO_SAFE_PRECLAIM_ACQUISITION');
});
test('redirected or oversized source data is not accepted as official',async()=>{
 const redir=await run({fetchImpl:async u=>({
  ok:true,url:u+'#redirect',headers,arrayBuffer:async()=>bytes.buffer
 })});
 assert.equal(redir.status,'OFFICIAL_RESPONSE_REJECTED');
 const huge=await run({fetchImpl:async u=>({
  ok:true,url:u,headers:new Headers({'content-length':'2000001'}),
  arrayBuffer:async()=>bytes.buffer
 })});
 assert.equal(huge.status,'OFFICIAL_HTML_OVERSIZE');
});
test('race-identity mismatch in a fetched result cannot invent 200m split evidence',async()=>{
 const wrong=await run({extractText:async html=>html.replace('京都 第12競走','東京 第12競走')});
 assert.equal(wrong.status,'OFFICIAL_RACE_IDENTITY_MISMATCH');
});
