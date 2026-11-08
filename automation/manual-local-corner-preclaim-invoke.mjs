/**
 * BAKEN LAB — explicit service-side manual LOCAL official-corner pre-CLAIM.
 *
 * No credentials in source, args or output. The caller must already have a
 * server-only SUPABASE_SERVICE_ROLE_KEY in a secured runtime environment.
 * This is NOT a scheduler or a result updater; never calls CLAIM, ranking,
 * prediction save or FROZEN. Exactly one race per invocation; no retries.
 */
import {pathToFileURL} from 'node:url';

const PROJECT_HOST='qjlvsndiqjfsfjinilig.supabase.co';
const VALID_TRACKS=new Set(['盛岡','水沢','浦和','船橋','大井','川崎','金沢','笠松',
  '名古屋','園田','姫路','高知','佐賀','門別']);
const todayJst=now=>new Date(now+9*3600000).toISOString().slice(0,10);
function keySafe(v){return typeof v==='string'&&v.length>=32&&v.length<=4096&&
  !/[\s\r\n]/.test(v);}
function originSafe(url){
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&u.hostname===PROJECT_HOST&&
   u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password;
 }catch{return false;}
}
export async function runManualLocalCornerPreclaim({
 raceDate,track,raceNo,serviceKey,supabaseUrl,
 explicitApproved=false,clock=()=>Date.now(),
 fetchImpl=fetch,timeoutMs=20000
}={}){
 const refused=code=>({status:code,request_started:false,
  claim_started:false,prediction_saved:false});
 const now=clock();
 if(explicitApproved!==true||!Number.isFinite(now)||
    !/^\d{4}-\d{2}-\d{2}$/.test(raceDate??'')||
    raceDate!==todayJst(now)||!VALID_TRACKS.has(track)||
    !Number.isInteger(raceNo)||raceNo<1||raceNo>14||
    !keySafe(serviceKey)||!originSafe(supabaseUrl)||
    typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||
    timeoutMs<1000||timeoutMs>20000)
   return refused('EXPLICIT_AUTHORIZATION_OR_PARAMETERS_MISSING');
 const endpoint=new URL('/functions/v1/lab-local-corner-preclaim',supabaseUrl).href;
 let response;
 try{
  response=await fetchImpl(endpoint,{
   method:'POST',redirect:'error',cache:'no-store',
   headers:{authorization:'Bearer '+serviceKey,apikey:serviceKey,
    'content-type':'application/json','cache-control':'no-store'},
   body:JSON.stringify({intent:'AUTHORIZED_PRECLAIM_RESEARCH',
    race_date:raceDate,track,race_no:raceNo}),
   signal:AbortSignal.timeout(timeoutMs)
  });
  if(response.url!==endpoint||!response.ok)
   return {status:'BACKEND_DENIED_OR_UNAVAILABLE',http_status:response.status,
    request_started:true,claim_started:false,prediction_saved:false};
  const body=await response.json();
  if(!body||body.ok!==true||body.claim_started!==false||
     body.prediction_saved!==false||typeof body.status!=='string')
   return {status:'BACKEND_RESULT_NOT_VERIFIED',request_started:true,
    claim_started:false,prediction_saved:false};
  return {
   status:body.status,request_started:true,claim_started:false,
   prediction_saved:false,stored:body.stored===true,
   read_count:Number.isInteger(body.read_count)?body.read_count:0,
   linked_prior_runs:Number.isInteger(body.linked_prior_runs)?body.linked_prior_runs:0
  };
 }catch{
  return {status:'BACKEND_TIMEOUT_OR_TRANSPORT_ERROR',request_started:Boolean(response),
   claim_started:false,prediction_saved:false};
 }
}
// Run only on an explicit server operator command, never on import.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [raceDate,track,raceNoText]=process.argv.slice(2);
 const out=await runManualLocalCornerPreclaim({
  raceDate,track,raceNo:Number(raceNoText),
  serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseUrl:process.env.SUPABASE_URL,
  explicitApproved:process.env.BAKEN_LAB_MANUAL_PRECLAIM_APPROVED==='YES'
 });
 // This result intentionally prints no URLs, headers, bearer tokens or raw HTML.
 process.stdout.write(JSON.stringify(out)+'\n');
 if(!['STORED','ALREADY_STORED','SKIPPED_NO_EVIDENCE'].includes(out.status))
  process.exitCode=1;
}
