// Research-only boundary between an already-authorized HTTP response and
// isolated private archival storage. No network is initiated here, and the
// injected archive MUST NOT be a production connection in this PR.
// A successful receipt only proves byte integrity, NOT JRA issuer authenticity,
// original selected past-run identity, or authorization to submit predictions.
import {captureRawJraCardResponse,checkRawJraCapture}
 from './jra-raw-response-capture.mjs';
const reject=(reason,extra={})=>({ok:false,reason,
   production_allowed:false,official_issuer_verified:false,
   claim_bound:false,score_allowed:false,...extra});
function sameCapture(a,b){
 return a?.schema===b?.schema&&a.bytes===b.bytes&&a.rawHash===b.rawHash&&
  a.decoded_utf8_sha256===b.decoded_utf8_sha256&&a.cname===b.cname&&
  a.sourceUrl===b.sourceUrl&&a.actualResponseUrl===b.actualResponseUrl&&
  a.raceId===b.raceId&&a.raceKey===b.raceKey&&
  a.fetchedAt===b.fetchedAt&&a.postTime===b.postTime;
}
export async function captureRetainAndRecheck({
 job,rawBytes,responseUrl,officialPostTime,observedAt,archive
}={}){
 if(!archive||typeof archive.retain!=='function'||
    typeof archive.readPrivateArchive!=='function')
   return reject('AUTHORIZED_PRIVATE_ARCHIVE_DISCONNECTED');
 if(!job||typeof job.cname!=='string'||typeof job.race_date!=='string'||
    typeof job.track!=='string'||!Number.isSafeInteger(job.race_no)||
    typeof job.live_race_id!=='string'||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(job.live_race_id))
   return reject('JOB_OR_RACE_IDENTITY_INVALID');
 // This is exactly the URL the existing JRA live fetch uses. The final URL
 // must match independently so a redirected login page is not retained.
 const sourceUrl='https://www.jra.go.jp/JRADB/accessD.html?CNAME='+
  encodeURIComponent(job.cname);
 let material;
 try{
   material=captureRawJraCardResponse({
     cname:job.cname,
     sourceUrl,actualResponseUrl:responseUrl,rawBytes,
     fetchedAt:observedAt,postTime:officialPostTime,
     raceId:job.race_date+'/'+job.track+'/'+job.race_no
   });
 }catch(e){return reject('RAW_SOURCE_REFUSED',{detail:String(e?.message??e)});}
 const origin=checkRawJraCapture(material);
 if(!origin.ok)return reject('BYTE_CAPTURE_NOT_SELF_CONSISTENT',{detail:origin.reason});
 // DB schema requires UUID race_id. Keep CNAME-derived canonical raceKey
 // separately so JRA identity cannot be silently replaced by a DB UUID.
 const storedCapture={...material.capture,
    raceKey:material.capture.raceId,raceId:job.live_race_id};
 let receipt,retained;
 try{
   receipt=await archive.retain(storedCapture);
   if(!/^[0-9a-f]{64}$/.test(receipt))throw Error('INVALID_PRIVATE_RECEIPT');
   retained=await archive.readPrivateArchive({
     raceId:job.live_race_id,receiptKey:receipt
   });
 }catch(e){return reject('PRIVATE_RETENTION_OR_READBACK_FAILED',{detail:String(e?.message??e)});}
 if(!Array.isArray(retained)||retained.length!==1||
    !sameCapture(retained[0],storedCapture))
   return reject('PRIVATE_READBACK_MISMATCH');
 // Do not expose the archived body from this function. The future V11 reader
 // must independently enforce issuer signature, job/lease, as-of and selected
 // original *past-run* identity before authorizing any score.
 return {ok:true,reason:'RESEARCH_ONLY_RAW_BYTE_RETENTION_AND_READBACK',
  receipt_key:receipt,race_id:job.live_race_id,
  race_key:material.capture.raceId,
  raw_sha256:material.capture.rawHash,
  decoded_utf8_sha256:material.capture.decoded_utf8_sha256,
  original_byte_length:material.capture.original_byte_length,
  fetched_at:material.capture.fetchedAt,
  production_allowed:false,score_allowed:false,claim_bound:false,
  official_issuer_verified:false,official_original_past_runs_verified:false};
}
