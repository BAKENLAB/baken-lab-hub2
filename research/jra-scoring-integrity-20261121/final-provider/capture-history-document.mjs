// Candidate only: observes bytes ALREADY fetched by an authorized acquisition path.
// No fetch/DB/CLAIM/signing keys. Unsigned retention is NOT authenticated scoring proof.
const hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
export async function buildHistoryDocument({rawBytes,decodedText,sourceUrl,sourceRef,fetchedAt,extractorId,raceId,runners}){
 if(!(rawBytes instanceof Uint8Array)||rawBytes.length===0||rawBytes.length>512*1024)throw Error('BODY_SIZE_OR_TYPE');
 const bytes=rawBytes.slice();
 const url=new URL(sourceUrl);
 if(url.origin!=='https://www.jra.go.jp'||url.pathname!=='/JRADB/accessS.html'||url.searchParams.size!==1||url.searchParams.get('CNAME')!==sourceRef||!/^pw01sde\d+\/[0-9a-f]+$/i.test(sourceRef))throw Error('OFFICIAL_HISTORY_SOURCE_MISMATCH');
 if(typeof decodedText!=='string'||new TextDecoder('shift_jis').decode(bytes)!==decodedText)throw Error('DECODED_BYTES_MISMATCH');
 if(typeof fetchedAt!=='string'||!/(?:Z|[+-]\d\d:\d\d)$/.test(fetchedAt)||!Number.isFinite(Date.parse(fetchedAt))||typeof extractorId!=='string'||!extractorId||!uuid(raceId))throw Error('ACQUISITION_IDENTITY_MISSING');
 if(!Array.isArray(runners)||!runners.length)throw Error('RUNNER_IDS_MISSING');
 const ids=new Set();
 const linked=runners.map(r=>{
  if(!uuid(r.run_id)||r.race_id!==raceId||!/^\d{10}$/.test(r.horse_id??'')||typeof r.horse_name!=='string'||!r.horse_name.trim()||ids.has(r.run_id))throw Error('RUNNER_IDENTITY_INVALID');ids.add(r.run_id);
  return {run_id:r.run_id,race_id:raceId,horse_id:r.horse_id,horse_name:r.horse_name};
 });
 // Copies preserve exact bytes; whitelist prevents request headers/secrets escaping.
 return {schema:'UNSIGNED_OFFICIAL_HISTORY_RETENTION_CANDIDATE_V1',source_url:url.href,source_ref:sourceRef,fetched_at:fetchedAt,extractor_id:extractorId,race_id:raceId,runners:linked,
  raw_bytes:bytes.slice(),decoded_text:decodedText,raw_bytes_sha256:await hex(bytes),decoded_utf8_sha256:await hex(new TextEncoder().encode(decodedText)),
  signature:null,signature_verified:false,claim_bound:false,historical_asof_proven:false,formal_scoring_allowed:false};
}
export async function observeHistoryDocument(input,{enabled=false,retain,timeoutMs=75}={}){
 if(enabled!==true)return {status:'OFF',formal_scoring_allowed:false};
 let timer;
 try{
  if(typeof retain!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>250)throw Error('RETENTION_UNCONNECTED');
  const controller=new AbortController();
  const task=(async()=>{const record=await buildHistoryDocument(input);if(controller.signal.aborted)throw Error('RETENTION_TIMEOUT');await retain(record,{signal:controller.signal});return record;})();
  const record=await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('RETENTION_TIMEOUT'));},timeoutMs);})]);
  return {status:'RETAINED_UNSIGNED',raw_bytes_sha256:record.raw_bytes_sha256,decoded_utf8_sha256:record.decoded_utf8_sha256,formal_scoring_allowed:false};
 }catch(e){return {status:'CAPTURE_SKIPPED',code:e.message,formal_scoring_allowed:false};}
 finally{clearTimeout(timer);}
}
