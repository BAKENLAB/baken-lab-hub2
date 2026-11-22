// Research-only JRA source capture from bytes returned by an ALREADY-authorized
// fetch. No fetch/network, source retention rights, key or deployment here.
// Preserve raw response bytes BEFORE Shift-JIS decode. Existing jra-live v32
// hashes TextEncoder(HTML decoded string), which is a different hash domain.
// Nothing here authenticates the remote issuer by itself or unblocks FROZEN.
import {createHash} from 'node:crypto';

const HASH=x=>createHash('sha256').update(x).digest('hex');
const cn=/^pw01dde01(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{8})\/([0-9A-F]{2})$/i;
const tracks={
 '01':'札幌','02':'函館','03':'福島','04':'新潟','05':'東京',
 '06':'中山','07':'中京','08':'京都','09':'阪神','10':'小倉'
};
function reject(code){throw Error('JRA_RAW_CAPTURE_'+code);}
const bytesOf=x=>x instanceof Uint8Array?Buffer.from(x):reject('BYTES_MISSING');
function isoMoment(x){
 if(typeof x!=='string'||!/^(?:20\d\d)-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(x))
  reject('SIGNED_TIMESTAMP_REQUIRED');
 const ms=Date.parse(x);
 if(!Number.isFinite(ms))reject('INVALID_TIMESTAMP');
 return ms;
}
export function captureRawJraCardResponse({
 cname,sourceUrl,actualResponseUrl,rawBytes,fetchedAt,postTime,raceId
}={}){
 const match=typeof cname==='string'?cname.match(cn):null;
 if(!match||!tracks[match[1]])reject('CNAME_INVALID');
 const expectedRace=match[2]+'-'+match[3]+'-'+match[4]+'/'+tracks[match[1]]+'/'+Number(match[5]);
 if(expectedRace!==raceId)reject('CNAME_RACE_BINDING');
 let address,finalUrl;
 try{address=new URL(sourceUrl);finalUrl=new URL(actualResponseUrl);}
 catch{reject('SOURCE_URL_INVALID');}
 const permitted=u=>u.protocol==='https:'&&u.origin==='https://www.jra.go.jp'&&
  u.pathname==='/JRADB/accessD.html'&&!u.username&&!u.password&&
  u.searchParams.size===1&&u.searchParams.get('CNAME')===cname&&
  u.hash==='';
 if(!permitted(address)||!permitted(finalUrl)||address.href!==finalUrl.href)
  reject('FINAL_OFFICIAL_URL_CHANGED_OR_UNTRUSTED');
 const capturedAt=isoMoment(fetchedAt),postAt=isoMoment(postTime);
 if(capturedAt>=postAt-180000||postAt-capturedAt>7*86400000)
  reject('OUTSIDE_PREPOST_WINDOW');
 const original=bytesOf(rawBytes);
 if(original.length<32||original.length>512*1024)
  reject('RAW_RESPONSE_SIZE_INVALID');
 const decoded=new TextDecoder('shift_jis').decode(original);
 if(!decoded.trim()||!decoded.includes('<'))
  reject('DECODED_HTML_EMPTY');
 const rawHash=HASH(original),decodedUtf8=Buffer.from(decoded,'utf8');
 const parsedDomainHash=HASH(decodedUtf8);
 // Do not claim original-byte hash == previously recorded html_sha256.
 // Never sign without an approved official issuer, TRUST and CLAIM binding.
 const capture={
  schema:'JRA_RAW_CAPTURE_OFFLINE_V1',raceId,cname,
  sourceUrl:address.href,actualResponseUrl:finalUrl.href,
  fetchedAt,postTime,
  bytes:original.toString('base64'),rawHash,
  original_byte_length:original.length,
  decoded_utf8_sha256:parsedDomainHash,
  decoded_utf8_length:decodedUtf8.length,
  original_hash_domain:'HTTP_RESPONSE_RAW_BYTES',
  parsed_hash_domain:'TEXT_ENCODER_UTF8_OF_SHIFT_JIS_DECODED_RESPONSE',
  extractor_encoding:'shift_jis',
  // Audited source metadata is not proof of origin issuer without separate
  // original-body signature and current authorized CLAIM trust.
  issuer_signature_verified:false,
  original_source_issuer_authenticated:false,
  authorized_claim_bound:false,
  production_allowed:false
 };
 return {capture,decoded_html:decoded};
}
export function checkRawJraCapture(packet){
 try{
  const c=packet?.capture;
  if(!c||c.schema!=='JRA_RAW_CAPTURE_OFFLINE_V1'||
   c.issuer_signature_verified!==false||c.production_allowed!==false||
   c.authorized_claim_bound!==false)
   return {ok:false,reason:'CAPTURE_ENVELOPE_INVALID'};
  const raw=Buffer.from(c.bytes,'base64');
  if(raw.toString('base64')!==c.bytes||HASH(raw)!==c.rawHash||
    raw.length!==c.original_byte_length)
   return {ok:false,reason:'RAW_BYTE_HASH_MISMATCH'};
  // Revalidate the entire capture metadata as well as bytes on read. A
  // hash alone does not protect a claimed race ID, URL or as-of cutoff.
  const replay=captureRawJraCardResponse({
    cname:c.cname,sourceUrl:c.sourceUrl,
    actualResponseUrl:c.actualResponseUrl,
    rawBytes:raw,fetchedAt:c.fetchedAt,postTime:c.postTime,raceId:c.raceId
  });
  if(replay.decoded_html!==packet.decoded_html||
    replay.capture.decoded_utf8_sha256!==c.decoded_utf8_sha256||
    replay.capture.decoded_utf8_length!==c.decoded_utf8_length||
    c.original_hash_domain!==replay.capture.original_hash_domain||
    c.parsed_hash_domain!==replay.capture.parsed_hash_domain)
   return {ok:false,reason:'DECODED_SOURCE_HASH_MISMATCH'};
  return {ok:true,reason:'UNSIGNED_RAW_AND_DECODED_DOMAINS_MATCH',
    raw_sha256:c.rawHash,decoded_utf8_sha256:c.decoded_utf8_sha256,
    issuer_signature_verified:false,official_original_authenticated:false,
    production_allowed:false};
 }catch{return {ok:false,reason:'RAW_CAPTURE_RECHECK_FAILED'};}
}
