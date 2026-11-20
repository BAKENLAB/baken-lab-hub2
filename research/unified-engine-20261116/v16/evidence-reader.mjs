// No transport is installed here; never query an admin DB to circumvent CLAIM.
import {safeVerifyEvidence} from '../v11/evidence-contract.mjs';
import {hash} from './capture.mjs';
const empty=(status)=>({status,accepted:[],facts:[],real_verified_histories:0,production_allowed:false});
export async function readOfficialEvidence({contextText,job_id,lease_until,post_time}, {authorizedRead,trust,now=()=>Date.now(),timeoutMs=150}={}) {
  if(typeof authorizedRead!=='function')return empty('READER_DISCONNECTED');
  let timer,controller;
  try{
    const time=now();
    if(!Number.isFinite(Date.parse(lease_until)) || !Number.isFinite(Date.parse(post_time)) || time>=Date.parse(lease_until) || time>=Date.parse(post_time)-180000)return empty('EXPIRED');
    const context=JSON.parse(contextText);
    if(context.job_id!==job_id)return empty('CONTEXT_JOB_MISMATCH');
    controller=new AbortController();
    // A fixed operation, NOT a caller-supplied SQL/URL. Provider must enforce OAuth,
    // ownership, READY, CLAIM and exact-selected-source on its existing authorized route.
    const packet=await Promise.race([
      Promise.resolve().then(()=>authorizedRead(Object.freeze({operation:'EXACT_SELECTED_CLAIM_EVIDENCE',job_id,context_sha256:hash(contextText)}),{signal:controller.signal})),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TIMEOUT'));},timeoutMs);})
    ]);
    if(now()>=Date.parse(lease_until) || now()>=Date.parse(post_time)-180000)return empty('EXPIRED');
    if(!packet || packet.contextText!==contextText)return empty('CONTEXT_BYTES_MISMATCH');
    // Existing V11 signature, gate, lineage, IDs, body hash, pinned extractor and
    // clock verification is reused. No synthetic signature is minted by this reader.
    return safeVerifyEvidence(packet,{...trust,now:()=>new Date(now()).toISOString()});
  }catch{return empty('READER_UNAVAILABLE');}
  finally{clearTimeout(timer);controller?.abort();}
}
