import test from 'node:test';
import assert from 'node:assert/strict';
import {makeVerifiedResultReader} from './jra-jump-verified-cache.mjs';
import {resultIdentity} from './jra-jump-official-history.mjs';
const ref='pw01sde1003202602010520261107/AA',asOf='2026-11-15';
function fixture(){
 const r=resultIdentity(ref);
 return {...r,source_ref:ref,jump:true,distance:2750,class_name:'未勝利',registered_count:2,not_started_count:0,official_proof:{parser_version:'JUMP_RESULT_V2',html_sha256:'a'.repeat(64),fetched_at:'2026-11-14T00:00:00Z',source_url:'https://www.jra.go.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(ref)},rows:[1,2].map(n=>({horse_id:'202200000'+n,horse_no:n,jockey:'J '+n,finish:n,result_status:'FINISHED',final_turn_pos:n,field_size:2,verified:true,race_type:'障害',race_date:r.race_date,track:r.track,class_name:'未勝利',distance:2750,source_ref:ref,gap_seconds:n-1,odds:99,popularity:1}))};
}
function setup(){
 const records=[],store={get:async k=>records.filter(r=>r.key===k).at(-1)??null,append:async r=>{records.push(structuredClone(r))}};
 let reads=0,now='2026-11-15T00:00:00Z',result=fixture();
 const mk=()=>makeVerifiedResultReader({store,clock:()=>now,maxFetch:2});
 const readOfficial=async()=>{reads++;return structuredClone(result)};
 return {records,store,mk,readOfficial,reads:()=>reads,setNow:x=>now=x,setResult:x=>result=x};
}
test('cache persists across reader instances; no odds or raw HTML retained',async()=>{
 const f=setup(),a=await f.mk().read({ref,asOf,readOfficial:f.readOfficial});
 const b=await f.mk().read({ref,asOf,readOfficial:f.readOfficial});
 assert.equal(f.reads(),1);assert.equal(f.records.length,1);assert.deepEqual(a,b);assert.ok(!JSON.stringify(a).includes('odds'));assert.ok(!JSON.stringify(a).includes('popularity'));
});
test('mutated persisted record rejected, rather than silently fetched or used',async()=>{
 const f=setup();await f.mk().read({ref,asOf,readOfficial:f.readOfficial});
 f.records[0].result.rows[0].finish=2;
 await assert.rejects(()=>f.mk().read({ref,asOf,readOfficial:f.readOfficial}),/CACHE_INTEGRITY/);assert.equal(f.reads(),1);
});
test('same-day and future result never accessed',async()=>{
 const f=setup();await assert.rejects(()=>f.mk().read({ref,asOf:'2026-11-07',readOfficial:f.readOfficial}),/CACHE_ASOF/);assert.equal(f.reads(),0);
});
test('missing proof and missing runners rejected',async()=>{
 const f=setup(),r=fixture();delete r.official_proof;f.setResult(r);
 await assert.rejects(()=>f.mk().read({ref,asOf,readOfficial:f.readOfficial}),/CACHE_PROVENANCE/);
 const b=fixture();b.rows.pop();f.setResult(b);
 await assert.rejects(()=>f.mk().read({ref,asOf,readOfficial:f.readOfficial}),/CACHE_FIELD_COUNT/);assert.equal(f.records.length,0);
});
test('recent official correction creates new version, not overwrite',async()=>{
 const f=setup(),recentRef='pw01sde1003202602010520261114/AA',r=resultIdentity(recentRef);
 function rec(hash,time){const z=fixture();return {...z,...r,source_ref:recentRef,official_proof:{...z.official_proof,html_sha256:hash.repeat(64),fetched_at:time,source_url:'https://www.jra.go.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(recentRef)},rows:z.rows.map(x=>({...x,race_date:r.race_date,source_ref:recentRef}))}}
 f.setResult(rec('a','2026-11-14T20:00:00Z'));await f.mk().read({ref:recentRef,asOf,readOfficial:f.readOfficial});
 f.setResult(rec('b','2026-11-14T23:30:00Z'));await f.mk().read({ref:recentRef,asOf,readOfficial:f.readOfficial});
 assert.equal(f.records.length,2);assert.equal(f.records[0].result.official_proof.html_sha256,'a'.repeat(64));assert.equal(f.records[1].result.official_proof.html_sha256,'b'.repeat(64));
});
test('concurrent exact request coalesced',async()=>{
 const f=setup(),c=f.mk();await Promise.all([c.read({ref,asOf,readOfficial:f.readOfficial}),c.read({ref,asOf,readOfficial:f.readOfficial})]);assert.equal(f.reads(),1);assert.equal(f.records.length,1);
});
