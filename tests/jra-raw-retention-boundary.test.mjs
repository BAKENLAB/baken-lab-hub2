import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveArchive} from '../research/jra-scoring-integrity-20261121/claim-retention/live-archive.mjs';
import {captureRetainAndRecheck}
 from '../research/jra-scoring-integrity-20261121/claim-retention/authorized-byte-retention-candidate.mjs';
const cn='pw01dde0103202603060120261123/EC',
 url='https://www.jra.go.jp/JRADB/accessD.html?CNAME='+encodeURIComponent(cn),
 body=Buffer.concat([Buffer.from('<html><body>Horse:'),
  Buffer.from([0x82,0xa0]),Buffer.from('</body></html>')]);
function args(){return {
 job:{race_date:'2026-11-23',track:'福島',race_no:1,cname:cn},
 rawBytes:Buffer.from(body),responseUrl:url,
 officialPostTime:'2026-11-23T09:45:00+09:00',
 observedAt:'2026-11-23T08:39:00+09:00'
};}
function createArchive(){
 const held=[];
 const archive=createLiveArchive({
  writer:{query:async(_sql,params)=>{
    held.push({receipt_key:params[0],race_id:params[1],
      raw_bytes:Buffer.from(params[3]),raw_sha256:params[4],
      card_metadata:JSON.parse(params[5])});return {rowCount:1};}},
  reader:{query:async()=>({rows:held.map(x=>({...x,raw_bytes:Buffer.from(x.raw_bytes)}))})}
 });
 return {archive,held};
}
test('auth-proxy only saves exact raw response bytes after checked JRA URL/date and reads back',async()=>{
 const {archive,held}=createArchive();
 const out=await captureRetainAndRecheck({...args(),archive});
 assert.equal(out.ok,true,JSON.stringify(out));
 assert.match(out.receipt_key,/^[0-9a-f]{64}$/);
 assert.notEqual(out.raw_sha256,out.decoded_utf8_sha256);
 assert.equal(held.length,1);
 assert.deepEqual(held[0].raw_bytes,body);
 assert.equal(out.official_issuer_verified,false);
 assert.equal(out.claim_bound,false);
 assert.equal(out.score_allowed,false);
 assert.equal(out.production_allowed,false);
});
test('invalid final URL, post-start timestamp, race ID or absent archive never retain body',async()=>{
 for(const mutate of [
  x=>{x.responseUrl='https://fake.invalid/JRADB/accessD.html?CNAME='+encodeURIComponent(cn);},
  x=>{x.observedAt='2026-11-23T09:44:00+09:00';},
  x=>{x.job.race_date='2026-11-22';},
  x=>{x.job.track='東京';},
 ]){
  const {archive,held}=createArchive(),x=args();mutate(x);
  const out=await captureRetainAndRecheck({...x,archive});
  assert.equal(out.ok,false);
  assert.equal(out.reason,'RAW_SOURCE_REFUSED');
  assert.equal(held.length,0);
 }
 const noArchive=await captureRetainAndRecheck(args());
 assert.equal(noArchive.reason,'AUTHORIZED_PRIVATE_ARCHIVE_DISCONNECTED');
});
test('retained original tampering is rejected at immediate read-back',async()=>{
 const x=createArchive();
 const tamper={
  retain:async doc=>{
   const receipt=await x.archive.retain(doc);
   x.held[0].raw_bytes[0]^=1;
   return receipt;
  },
  readPrivateArchive:(...args)=>x.archive.readPrivateArchive(...args)
 };
 const out=await captureRetainAndRecheck({...args(),archive:tamper});
 assert.equal(out.ok,false);
 assert.equal(out.reason,'PRIVATE_RETENTION_OR_READBACK_FAILED');
 assert.equal(out.score_allowed,false);
});
test('extra or mismatched archive rows are not accepted as an unambiguous source receipt',async()=>{
 const f=async returned=>{
  const fake={retain:async()=> 'a'.repeat(64),readPrivateArchive:async()=>returned};
  return captureRetainAndRecheck({...args(),archive:fake});
 };
 assert.equal((await f([])).reason,'PRIVATE_READBACK_MISMATCH');
 assert.equal((await f([{},{}])).reason,'PRIVATE_READBACK_MISMATCH');
 assert.equal((await f([{}])).reason,'PRIVATE_READBACK_MISMATCH');
});
