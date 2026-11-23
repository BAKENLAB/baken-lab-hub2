// Optional authenticated observation export only. No signer, CLAIM, network or storage.
// Original bytes may contain market information; do not send them into ability scoring.
const bound=524288;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export async function verifyObservedBodyHash({bytes,expected_sha256,domain}={}){
 try{
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>bound)return {ok:false,code:'BODY_BOUND',source_authenticity_verified:false};
 if(!['HTTP_RESPONSE_BYTES','DECODED_SHIFT_JIS_HTML_UTF8'].includes(domain))return {ok:false,code:'HASH_DOMAIN_REQUIRED',source_authenticity_verified:false};
 const measured=domain==='HTTP_RESPONSE_BYTES'?bytes:new TextEncoder().encode(new TextDecoder('shift_jis').decode(bytes));
 const actual=await digest(measured);return {ok:actual===expected_sha256,domain,actual_sha256:actual,source_authenticity_verified:false};
 }catch{return {ok:false,code:'HASH_UNAVAILABLE',source_authenticity_verified:false};}
}
const closed=(status)=>({status,scoring_authorized:false,claim_bound:false,signature:null,production_allowed:false});
export async function captureCardObservation(options={}){
 if(options.requested!==true)return null;
 if(options.enabled!==true)return closed('OFF');
 try{
  const {bytes,proof,source_url,response_url,fetched_at,identities}=options;
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>bound)throw Error('BODY_BOUND');
  const request=new URL(source_url),response=new URL(response_url);
  for(const u of [request,response])if(u.protocol!=='https:'||u.hostname!=='www.jra.go.jp'||u.username||u.password)throw Error('SOURCE');
  if([...response.searchParams.keys()].some(k=>k!=='CNAME'))throw Error('RESPONSE_QUERY');
  if(request.pathname!=='/JRADB/accessD.html'||request.searchParams.size!==1||request.searchParams.get('CNAME')!==proof?.cname)throw Error('SOURCE_ID');
  if(!Number.isFinite(Date.parse(fetched_at))||!Number.isFinite(Date.parse(proof.checked_at))||Date.parse(fetched_at)>Date.parse(proof.checked_at))throw Error('CLOCK');
  const copy=bytes.slice(),hash=await digest(copy);
  const decoded=new TextEncoder().encode(new TextDecoder('shift_jis').decode(copy));
  const decodedHash=await digest(decoded);
  if(hash!==proof.html_sha256||copy.length!==proof.html_bytes)throw Error('HASH');
  if(!Array.isArray(identities)||identities.length!==proof.runners.length||new Set(identities.map(x=>x.horse_no)).size!==identities.length||identities.some(x=>!proof.runners.some(r=>r.horse_no===x.horse_no&&r.horse_name===x.horse_name)))throw Error('ROSTER');
  const cleanIdentities=identities.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name,horse_id:x.horse_id??null,horse_ref:x.horse_ref??null}));
  let binary='';for(let i=0;i<copy.length;i++)binary+=String.fromCharCode(copy[i]);
  return {...closed('CAPTURED_OBSERVATION'),schema:'JRA_AUTHENTICATED_CARD_OBSERVATION_V1',
   source_url,response_url,fetched_at,checked_at:proof.checked_at,race:{race_date:proof.race_date,track:proof.track,race_no:proof.race_no,post_time:proof.post_time??null},
   html_sha256:hash,hash_domain:'HTTP_RESPONSE_BYTES',html_bytes:copy.length,
   decoded_html_utf8:{hash_domain:'DECODED_SHIFT_JIS_HTML_UTF8',sha256:decodedHash,bytes:decoded.length},original_bytes_base64:btoa(binary),identities:cleanIdentities,
   identity_verified_for_scoring:false,history_run_ids:[],context_sha256:null,
   note:'Observation only. Requires authorized issuer receipt, CLAIM/context and selected-run lineage before scoring.'};
 }catch{return closed('OBSERVATION_UNAVAILABLE');}
}
