/**
 * Manual, read-only JRA historic result lap acquisition.
 * Fetches only a VERIFIED prior-race result URL at the official JRA host,
 * requires injected server-only HTML text extraction, validates race/date
 * and source again before returning race-level splits.
 *
 * Never fetches target-race results, never writes to Supabase, and never
 * claims, ranks or freezes a race. Intended for a pre-CLAIM worker only.
 */
import {parseJraOfficialHistoricLaps} from './jra-official-historic-race-laps.mjs';
import {deriveVerifiedJraPriorRaceNo} from './jra-official-prior-raceno.mjs';
const invalidUrl=ref=>{
 try{
  if(typeof ref!=='string'||!ref.startsWith('/JRADB/accessS.html?CNAME='))
   return null;
  const u=new URL(ref,'https://www.jra.go.jp');
  const cname=u.searchParams.get('CNAME')??'';
  if(u.origin!=='https://www.jra.go.jp'||u.pathname!=='/JRADB/accessS.html'||
     u.searchParams.size!==1||!/^[sp]w[A-Za-z0-9/]{12,100}$/.test(cname)||
     u.hash||u.username||u.password)return null;
  return u.href;
 }catch{return null;}
};
/**
 * @param {{
 *  targetRace:{raceDate:string,postTime:string},
 *  priorRace:{raceDate:string,track:string,raceNo?:number,distance:number,surface:string,sourceRef:string},
 *  fetchImpl:(url:string,options:RequestInit)=>Promise<Response>,
 *  extractText:(html:string)=>string|Promise<string>,
 *  clock?:()=>number,timeoutMs?:number,reserveMs?:number
 * }} options
 * @returns {Promise<{
 *  status:string,verified:boolean,claim_started:boolean,prediction_saved:boolean,
 *  lap_seconds?:number[],first_600m_seconds?:number|null,last_600m_seconds?:number|null,
 *  pace_classification?:string,race_no?:number
 * }>}
 */
export async function acquireVerifiedJraHistoricLaps({
 targetRace,priorRace,fetchImpl,extractText,clock=()=>Date.now(),
 timeoutMs=7000,reserveMs=180000
}={}){
 const fail=status=>({status,verified:false,
  claim_started:false,prediction_saved:false});
 const now=clock(),post=Date.parse(targetRace?.postTime??'');
 if(!Number.isFinite(now)||!Number.isFinite(post)||
    now+reserveMs>=post||!Number.isInteger(reserveMs)||reserveMs<180000||
    !Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>15000||
    typeof fetchImpl!=='function'||typeof extractText!=='function'||
    !(priorRace?.raceDate<targetRace?.raceDate)||
    priorRace?.raceDate===targetRace?.raceDate)
  return fail('NO_SAFE_PRECLAIM_ACQUISITION');
 const url=invalidUrl(priorRace?.sourceRef);
 if(!url)return fail('OFFICIAL_PAST_URL_UNVERIFIED');
 try{
  const response=await fetchImpl(url,{
   method:'GET',redirect:'error',cache:'no-store',
   headers:{'accept':'text/html,application/xhtml+xml','accept-language':'ja-JP,ja;q=0.9'},
   signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response?.ok||response.url!==url)return fail('OFFICIAL_RESPONSE_REJECTED');
  const length=Number(response.headers?.get?.('content-length')??'0');
  if(!Number.isFinite(length)||length>2_000_000)return fail('OFFICIAL_HTML_OVERSIZE');
  const encoding=(response.headers?.get?.('content-type')??'').toLowerCase();
  const charset=encoding.includes('utf-8')?'utf-8':'shift_jis';
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<200||bytes.length>2_000_000)return fail('OFFICIAL_HTML_SIZE_REJECTED');
  const html=new TextDecoder(charset,{fatal:false}).decode(bytes);
  const text=await extractText(html);
  if(typeof text!=='string'||text.length<100||text.length>200_000)
   return fail('OFFICIAL_RESULT_TEXT_UNVERIFIED');
  const received=clock();
  if(received+reserveMs>=post)return fail('POST_OR_CLAIM_BUFFER_EXCEEDED');
  let verifiedPriorRace=priorRace;
  if(!Number.isInteger(priorRace.raceNo)){
   const identity=deriveVerifiedJraPriorRaceNo({
    targetRaceDate:targetRace.raceDate,targetPostTime:targetRace.postTime,
    priorRaceDate:priorRace.raceDate,track:priorRace.track,surface:priorRace.surface,
    sourceRef:priorRace.sourceRef,officialUrl:url,bodyText:text,
    sourceCheckedAt:new Date(received).toISOString(),
    verifiedOfficialResponse:true,clock:()=>received
   });
   if(!identity.verified)return fail(identity.status);
   verifiedPriorRace={...priorRace,raceNo:identity.race_no};
  }
  const parsed=parseJraOfficialHistoricLaps({
   targetRace,priorRace:verifiedPriorRace,
   source:{url,checkedAt:new Date(received).toISOString(),
    bodyText:text,verifiedOfficialResponse:true},
   clock:()=>received
  });
  return {...parsed,claim_started:false,prediction_saved:false};
 }catch{
  return fail('OFFICIAL_FETCH_OR_PARSE_UNAVAILABLE');
 }
}
