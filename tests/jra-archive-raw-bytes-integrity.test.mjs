import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLiveArchive} from '../research/jra-scoring-integrity-20261121/claim-retention/live-archive.mjs';

const bytes=Buffer.from('<div>JRA test history - synthetic only</div>','utf8');
const digest=x=>createHash('sha256').update(x).digest('hex');
const doc=()=>({
  schema:'JRA_LIVE_CARD_CAPTURE_V1',
  raceId:'fake-race-id',
  cname:'pw01dde0000000/AAAA',
  fetchedAt:'2026-11-22T22:50:00Z',
  bytes:bytes.toString('base64'),rawHash:digest(bytes),
  sourceUrl:'https://www.jra.go.jp/JRADB/accessD.html?CNAME=synthetic',
  runners:[{horseNo:1,horseId:'synthetic-horse',checkedAt:'2026-11-22T22:51:00Z',histories:['f'.repeat(64)]}]
});
function harness(){
  const held=[],calls=[];
  const writer={query:async(sql,params)=>{
    calls.push(sql);
    held.push({receipt_key:params[0],race_id:params[1],
      raw_bytes:Buffer.from(params[3]),raw_sha256:params[4],
      card_metadata:JSON.parse(params[5])});
    return {rowCount:1};
  }};
  const reader={query:async()=>({rows:held.map(x=>({...x,raw_bytes:Buffer.from(x.raw_bytes)}))})};
  return {archive:createLiveArchive({writer,reader}),held,calls};
}
test('synthetic original bytes retained and read only when binary SHA-256 and whole receipt match',async()=>{
 const x=harness(),input=doc();
 const receipt=await x.archive.retain(input);
 assert.match(receipt,/^[a-f0-9]{64}$/);
 assert.equal(x.calls.length,1);
 const read=await x.archive.readPrivateArchive({raceId:input.raceId,receiptKey:receipt});
 assert.deepEqual(read,[input]);
});
test('mismatched claimed raw hash never reaches writer',async()=>{
 const x=harness(),bad=doc();bad.rawHash='0'.repeat(64);
 await assert.rejects(x.archive.retain(bad),/ORIGINAL_BYTES_SHA256_MISMATCH/);
 assert.equal(x.calls.length,0);
});
test('ambiguous/noncanonical base64, missing metadata, and overlimit capture fail closed',async()=>{
 const x=harness();const bad=doc();bad.bytes=bad.bytes.slice(0,-1);
 await assert.rejects(x.archive.retain(bad),/ORIGINAL_BYTES_DOCUMENT_INVALID|ORIGINAL_BYTES_SHA256_MISMATCH/);
 const empty=doc();empty.fetchedAt='invalid';
 await assert.rejects(x.archive.retain(empty),/ORIGINAL_BYTES_DOCUMENT_INVALID/);
 const huge=Buffer.alloc(512*1024+1,65),tooLarge=doc();
 tooLarge.bytes=huge.toString('base64');tooLarge.rawHash=digest(huge);
 await assert.rejects(x.archive.retain(tooLarge),/ORIGINAL_BYTES_SHA256_MISMATCH/);
 assert.equal(x.calls.length,0);
});
test('altered raw bytes in archive are rejected even if original receipt key survives',async()=>{
 const x=harness();const input=doc();const receipt=await x.archive.retain(input);
 x.held[0].raw_bytes[0]^=1;
 await assert.rejects(x.archive.readPrivateArchive({raceId:input.raceId,receiptKey:receipt}),
  /ORIGINAL_BYTES_SHA256_MISMATCH/);
});
test('matching altered raw hash but stale whole-document receipt is rejected',async()=>{
 const x=harness(),input=doc();const receipt=await x.archive.retain(input);
 x.held[0].raw_bytes[0]^=1;x.held[0].raw_sha256=digest(x.held[0].raw_bytes);
 await assert.rejects(x.archive.readPrivateArchive({raceId:input.raceId,receiptKey:receipt}),
  /ARCHIVE_DIGEST_MISMATCH/);
});
test('metadata tampering is detected by whole-document receipt',async()=>{
 const x=harness(),input=doc();const receipt=await x.archive.retain(input);
 x.held[0].card_metadata.cname='another-cname';
 await assert.rejects(x.archive.readPrivateArchive({raceId:input.raceId,receiptKey:receipt}),
  /ARCHIVE_DIGEST_MISMATCH/);
});
