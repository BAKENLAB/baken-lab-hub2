import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {buildHistoryDocument,observeHistoryDocument} from '../research/jra-scoring-integrity-20261121/final-provider/capture-history-document.mjs';
import {collectDeclaredLedger} from '../automation/jra-score-ledger/declared-ledger.mjs';import {checkDeclaredLedger} from '../automation/jra-score-ledger/independent-check.mjs';
const root=new URL('../research/jra-scoring-integrity-20261121/',import.meta.url);
const cases=JSON.parse(readFileSync(new URL('remaining-blockers/archive-lineage.json',root))).rows;
function input(i=0){const c=cases[i].exact_archive_candidates[0];const rawBytes=new Uint8Array([...new TextEncoder().encode('<html>SYNTHETIC '),0x94,0x6e,...new TextEncoder().encode('</html>')]);return {rawBytes,decodedText:new TextDecoder('shift_jis').decode(rawBytes),sourceUrl:'https://www.jra.go.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(c.source_ref),sourceRef:c.source_ref,fetchedAt:'2026-11-22T03:00:00Z',extractorId:'SYNTHETIC_TEST_ONLY',raceId:c.race_id,runners:[{run_id:c.run_id,race_id:c.race_id,horse_id:c.horse_id,horse_name:c.horse_name}]};}
const hash=b=>createHash('sha256').update(b).digest('hex');
test('retains byte/text domains and four REAL archive identities with SYNTHETIC bytes, never authenticates them',async()=>{
 for(let i=0;i<4;i++){const x=input(i),r=await buildHistoryDocument(x);assert.deepEqual(r.raw_bytes,x.rawBytes);assert.equal(r.raw_bytes_sha256,hash(x.rawBytes));assert.equal(r.decoded_utf8_sha256,hash(new TextEncoder().encode(x.decodedText)));assert.notEqual(r.raw_bytes_sha256,r.decoded_utf8_sha256);assert.deepEqual(r.runners,x.runners);assert.equal(r.signature,null);assert.equal(r.claim_bound,false);assert.equal(r.formal_scoring_allowed,false);}
});
test('OFF makes no callback and no input access; retention failure and bounded timeout are fail-open',async()=>{
 let calls=0;assert.equal((await observeHistoryDocument(new Proxy({},{get(){throw Error('ACCESSED')}}),{retain:()=>calls++})).status,'OFF');assert.equal(calls,0);
 assert.equal((await observeHistoryDocument(input(),{enabled:true,retain:()=>{throw Error('UNAVAILABLE')}})).status,'CAPTURE_SKIPPED');
 const r=await observeHistoryDocument(input(),{enabled:true,timeoutMs:15,retain:()=>new Promise(()=>{})});assert.equal(r.status,'CAPTURE_SKIPPED');assert.equal(r.code,'RETENTION_TIMEOUT');
});
test('source substitution, decoded tampering and missing IDs are refused; request secrets are not retained',async()=>{
 for(const change of [x=>x.sourceUrl='https://other.invalid/a',x=>x.sourceRef='pw01sde00000/00',x=>x.decodedText+='changed',x=>x.runners[0].run_id=null]){const x=input();change(x);await assert.rejects(buildHistoryDocument(x));}
 const x=input();x.authorization='DO_NOT_RETAIN';x.claim_token='DO_NOT_RETAIN';const r=await buildHistoryDocument(x);assert.equal(Object.hasOwn(r,'authorization'),false);assert.equal(Object.hasOwn(r,'claim_token'),false);
});
test('Nov22 morning six actual FROZEN races / 81 horses replay submitted arithmetic, TOP5 and grade without mutation',()=>{
 const races=[1,2].flatMap(i=>JSON.parse(readFileSync(new URL('final-provider/morning-20261122-part-'+i+'.json',root))).rows);assert.equal(races.length,6);assert.equal(races.reduce((n,r)=>n+r.payload.runners.length,0),81);
 for(const r of races){const before=structuredClone(r),ledger=collectDeclaredLedger({payload:r.payload}),c=checkDeclaredLedger({ledger,payload:r.payload});assert.equal(c.ok,true,JSON.stringify(c.errors));assert.equal(c.engine_verified,false);assert.equal(c.provenance_verified,false);assert.deepEqual(r,before);
  const tampered=structuredClone(r.payload);tampered.runners[0].score++;assert.equal(checkDeclaredLedger({ledger,payload:tampered}).ok,false);
 }
});
