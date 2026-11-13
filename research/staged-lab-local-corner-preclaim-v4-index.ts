// RESEARCH-STAGED v4. NOT DEPLOYED. Companion automation modules must
// be bundled from feature/pace-evidence-prereace-gate after tests and review.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
import {createNarOfficialReader} from "./automation/nar-official-data.mjs";
import {prepareLocalOfficialCornerPacket} from "./automation/nar-official-corner-acquisition.mjs";
import {runAuthorizedLocalCornerPreclaim} from "./automation/local-official-preclaim-workflow.mjs";
import {createLocalCornerServiceRpcStore} from "./automation/local-corner-service-rpc-store.mjs";

/**
 * DORMANT server-only pre-CLAIM research endpoint.
 * NEVER scheduled; no CLAIM, prediction save, rank, betting or DB core writes.
 * Caller MUST use the backend service role and request an exact race key.
 */
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const supabaseUrl=Deno.env.get('SUPABASE_URL')??'';
if(!serviceKey||!supabaseUrl)throw new Error('SERVICE_CONFIGURATION_REQUIRED');
const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const store=createLocalCornerServiceRpcStore({client:db,timeoutMs:1500});
const trk=new Set(['盛岡','水沢','浦和','船橋','大井','川崎','金沢','笠松','名古屋','園田','姫路','高知','佐賀','門別']);
const respond=(code: number,body: Record<string,unknown>)=>new Response(JSON.stringify(body),{status:code,
 headers:{'content-type':'application/json','cache-control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return respond(405,{ok:false,error:'POST_REQUIRED'});
 if(req.headers.get('authorization')!=='Bearer '+serviceKey)
  return respond(401,{ok:false,error:'UNAUTHORIZED'});
 const type=req.headers.get('content-type')??'';
 if(!type.startsWith('application/json'))return respond(400,{ok:false,error:'INVALID_REQUEST'});
 let raw='';
 try{
  const reader=req.body?.getReader();
  if(!reader)return respond(400,{ok:false,error:'INVALID_REQUEST'});
  const decoder=new TextDecoder();let bytes=0;
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    bytes+=value.byteLength;
    if(bytes>1024)return respond(413,{ok:false,error:'REQUEST_TOO_LARGE'});
    raw+=decoder.decode(value,{stream:true});
   }
  }finally{await reader.cancel();}
  raw+=decoder.decode();
 }catch{return respond(400,{ok:false,error:'INVALID_REQUEST'});}
 let input;
 try{input=JSON.parse(raw);}catch{return respond(400,{ok:false,error:'INVALID_REQUEST'});}
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).length!==4||
    input.intent!=='AUTHORIZED_PRECLAIM_RESEARCH'||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.race_date||'')||
    !trk.has(input.track)||!Number.isInteger(input.race_no)||
    input.race_no<1||input.race_no>14)
   return respond(400,{ok:false,error:'INVALID_REQUEST'});
 try{
  const q=db.from('official_races')
   .select('race_date,track,race_no,circuit,race_name,field_status,post_time,prediction_status,field_payload')
   .eq('race_date',input.race_date).eq('track',input.track)
   .eq('race_no',input.race_no).eq('circuit','LOCAL').limit(2);
  const {data,error}=await q.abortSignal(AbortSignal.timeout(3000));
  if(error||!Array.isArray(data)||data.length!==1)
   return respond(409,{ok:false,error:'OFFICIAL_RACE_UNAVAILABLE'});
  // No cross-date acquisition and no debut without authenticated
  // official prior-result witness. This endpoint cannot CLAIM or SAVE.
  const jstDate=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
  if(input.race_date!==jstDate)
   return respond(409,{ok:false,error:'PRECLAIM_DATE_NOT_TODAY'});
  if(data[0].field_status!=='READY'||
     !['PENDING','RETRY'].includes(data[0].prediction_status))
   return respond(409,{ok:false,error:'PRECLAIM_OFFICIAL_READY_REQUIRED'});
  if(/新馬|初出走|メイクデビュー|ゴールデンデビュー/.test(
      String(data[0].race_name??'')))
   return respond(409,{ok:false,error:'PRECLAIM_DEBUT_OUT_OF_SCOPE'});
  const now=()=>Date.now();
  const result=await runAuthorizedLocalCornerPreclaim({
   race:data[0],officialReader:createNarOfficialReader({now}),
   prepareCorners:prepareLocalOfficialCornerPacket,store,
   assertAuthorized:async()=>{
    // Caller was already authenticated above. Do not relax this gate on retry.
    if(req.headers.get('authorization')!=='Bearer '+serviceKey||
       input.intent!=='AUTHORIZED_PRECLAIM_RESEARCH')throw Error('FORBIDDEN');
   },
   clock:now,reserveMs:5*60*1000,
   perHorseDeadlineMs:1500,officialCardTimeoutMs:5000,
   maxOperationMs:75000
  });
  // Only counts, status and absence of CLAIM/SAVE are returned.
  const coverage=result.coverage;
  return respond(200,{ok:true,status:result.status,
   read_count:result.readCount??0,
   verified_profile_horses:coverage?.horses_with_verified_history??0,
   verified_prior_witnesses:coverage?.verified_prior_run_witnesses??0,
   unavailable_or_empty_profiles:coverage?.unavailable_or_empty_history??0,
   missing_official_horse_links:coverage?.missing_official_horse_links??0,
   linked_prior_runs:result.linkedRunEvidence??0,
   stored:Boolean(result.storeWritten),
   claim_started:false,prediction_saved:false});
 }catch{
  return respond(503,{ok:false,error:'PRECLAIM_UNAVAILABLE',
   claim_started:false,prediction_saved:false});
 }
});
