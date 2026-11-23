import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {captureRawJraCardResponse,checkRawJraCapture} from
 '../research/jra-scoring-integrity-20261121/claim-retention/jra-raw-response-capture.mjs';
import {createLiveArchive} from
 '../research/jra-scoring-integrity-20261121/claim-retention/live-archive.mjs';

// Actual live race-key shape, confirmed against 2026-11-23 Fukushima 1R.
const cname='pw01dde0103202603060120261123/EC';
const sourceUrl='https://www.jra.go.jp/JRADB/accessD.html?CNAME='+encodeURIComponent(cname);
// A byte pair valid in Shift-JIS, representing 'あ' (different from UTF-8).
const raw=Buffer.concat([Buffer.from('<html><body>horse:'),
 Buffer.from([0x82,0xa0]),Buffer.from(':1</body></html>')]);
const sha=x=>createHash('sha256').update(x).digest('hex');
function args(){return {cname,sourceUrl,actualResponseUrl:sourceUrl,
 rawBytes:Buffer.from(raw),raceId:'2026-11-23/福島/1',
 fetchedAt:'2026-11-23T08:40:30+09:00',
 postTime:'2026-11-23T09:45:00+09:00'};}
test('preserves original Shift-JIS bytes and separately hashes UTF8 of decoded HTML',()=>{
 const x=captureRawJraCardResponse(args());
 assert.equal(x.capture.rawHash,sha(raw));
 assert.equal(x.capture.original_byte_length,raw.length);
 assert.equal(x.capture.bytes,raw.toString('base64'));
 assert.equal(x.capture.decoded_utf8_sha256,sha(Buffer.from(x.decoded_html,'utf8')));
 assert.notEqual(x.capture.rawHash,x.capture.decoded_utf8_sha256);
 assert.match(x.decoded_html,/horse:あ:1/);
 const checked=checkRawJraCapture(x);
 assert.equal(checked.ok,true,JSON.stringify(checked));
 assert.equal(checked.production_allowed,false);
 assert.equal(x.capture.issuer_signature_verified,false);
 assert.equal(x.capture.original_source_issuer_authenticated,false);
 assert.equal(x.capture.authorized_claim_bound,false);
});
test('actual Tokyo R1 CNAME layout binds race date to final 8 digits rather than internal year/month/day fields',()=>{
 const tokyoCname='pw01dde0105202605060120261123/E2';
 const tokyo={...args(),cname:tokyoCname,
  sourceUrl:'https://www.jra.go.jp/JRADB/accessD.html?CNAME='+encodeURIComponent(tokyoCname),
  actualResponseUrl:'https://www.jra.go.jp/JRADB/accessD.html?CNAME='+encodeURIComponent(tokyoCname),
  raceId:'2026-11-23/東京/1',
  postTime:'2026-11-23T10:00:00+09:00'};
 const packet=captureRawJraCardResponse(tokyo);
 assert.equal(packet.capture.raceId,'2026-11-23/東京/1');
 assert.equal(checkRawJraCapture(packet).ok,true);
});
test('aborting untrusted URLs, redirect aliases, inconsistent CNAME and post-start capture',()=>{
 const x=args();x.actualResponseUrl='https://example.com/JRADB/accessD.html?CNAME='+encodeURIComponent(cname);
 assert.throws(()=>captureRawJraCardResponse(x),/FINAL_OFFICIAL_URL_CHANGED_OR_UNTRUSTED/);
 const y=args();y.raceId='2026-11-23/東京/1';
 assert.throws(()=>captureRawJraCardResponse(y),/CNAME_RACE_BINDING/);
 const z=args();z.fetchedAt='2026-11-23T09:44:00+09:00';
 assert.throws(()=>captureRawJraCardResponse(z),/OUTSIDE_PREPOST_WINDOW/);
 const a=args();a.sourceUrl=sourceUrl+'&market=1';
 assert.throws(()=>captureRawJraCardResponse(a),/FINAL_OFFICIAL_URL_CHANGED_OR_UNTRUSTED/);
});
test('raw-byte and decoded-text mutations are independently detected',()=>{
 const x=captureRawJraCardResponse(args());
 x.capture.bytes=Buffer.from('<html>fake</html>').toString('base64');
 assert.equal(checkRawJraCapture(x).reason,'RAW_BYTE_HASH_MISMATCH');
 const y=captureRawJraCardResponse(args());
 y.decoded_html='fake html';
 assert.equal(checkRawJraCapture(y).reason,'DECODED_SOURCE_HASH_MISMATCH');
 const z=captureRawJraCardResponse(args());
 z.capture.decoded_utf8_sha256='0'.repeat(64);
 assert.equal(checkRawJraCapture(z).reason,'DECODED_SOURCE_HASH_MISMATCH');
});
test('archive read never trusts modified race/URL/as-of metadata even when raw digest is intact',()=>{
 const badUrl=captureRawJraCardResponse(args());
 badUrl.capture.actualResponseUrl='https://example.invalid/JRADB/accessD.html?CNAME='+encodeURIComponent(cname);
 assert.equal(checkRawJraCapture(badUrl).reason,'RAW_CAPTURE_RECHECK_FAILED');
 const badRace=captureRawJraCardResponse(args());
 badRace.capture.raceId='2026-11-23/東京/1';
 assert.equal(checkRawJraCapture(badRace).reason,'RAW_CAPTURE_RECHECK_FAILED');
 const expired=captureRawJraCardResponse(args());
 expired.capture.fetchedAt='2026-11-23T09:44:30+09:00';
 assert.equal(checkRawJraCapture(expired).reason,'RAW_CAPTURE_RECHECK_FAILED');
});
test('isolated private archive retains full original bytes, rejects tampering on reading',async()=>{
 const rows=[];
 const archive=createLiveArchive({
  writer:{query:async(_sql,params)=>{
   rows.push({receipt_key:params[0],race_id:params[1],
    raw_bytes:Buffer.from(params[3]),raw_sha256:params[4],
    card_metadata:JSON.parse(params[5])});return {rowCount:1};}},
  reader:{query:async()=>({rows:rows.map(r=>({
   ...r,raw_bytes:Buffer.from(r.raw_bytes)}))})}
 });
 const data=captureRawJraCardResponse(args());
 const receipt=await archive.retain(data.capture);
 assert.match(receipt,/^[a-f0-9]{64}$/);
 assert.equal(rows[0].raw_sha256,sha(raw));
 assert.deepEqual(await archive.readPrivateArchive({
  raceId:data.capture.raceId,receiptKey:receipt}),[data.capture]);
 rows[0].raw_bytes[0]^=1;
 await assert.rejects(archive.readPrivateArchive({
  raceId:data.capture.raceId,receiptKey:receipt}),/ORIGINAL_BYTES_SHA256_MISMATCH/);
});
