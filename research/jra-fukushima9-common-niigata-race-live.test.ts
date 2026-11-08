/**
 * ONE-OFF PUBLIC READ ONLY: actual JRA historical result for 2026-08-02
 * Niigata historic race (turf 1800m) referenced by independently retrieved 2026-11-08
 * Fukushima9R runners. No secrets, user account, betting, CLAIM, DB or FROZEN.
 */
import {acquireVerifiedJraHistoricLaps} from '../automation/jra-official-historic-lap-acquisition.mjs';
const priorRace={
 raceDate:'2026-08-02',track:'新潟',raceNo:undefined,
 distance:1800,surface:'芝',
 sourceRef:'/JRADB/accessS.html?CNAME=pw01sde1004202602040820260802/81'
};
const targetRace={
 raceDate:'2026-11-08',postTime:'2026-11-08T14:10:00+09:00'
};
Deno.test('REAL official JRA 2026-08-02 Niigata candidate race laps read-only preclaim source',async()=>{
 const now=Date.now();
 if(now>=Date.parse(targetRace.postTime)-15*60000){
  console.log(JSON.stringify({status:'SKIPPED_SAFETY_DEADLINE'}));
  return;
 }
 let requestCount=0,httpStatus:null|number=null,
  contentType:null|string=null,rawHtmlLength=0,
  extractedTextLength=0,hasHarontime=false,hasDate=false;
 const result=await acquireVerifiedJraHistoricLaps({
  priorRace,targetRace,clock:()=>Date.now(),timeoutMs:9500,
  fetchImpl:async (url:string,opts:RequestInit)=>{
   requestCount++;
   const response=await fetch(url,opts);
   httpStatus=response.status;
   contentType=response.headers.get('content-type');
   return response;
  },
  extractText:async (html:string)=>{
   rawHtmlLength=html.length;
   const normalized=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/\s+/g,' ').trim();
   extractedTextLength=normalized.length;
   const folded=normalized.normalize('NFKC');
   console.log(JSON.stringify({
    identity_probe:{
     has_niigata:folded.includes('新潟'),
     race_r_matches:[...Array(12)].map((_,i)=>i+1).filter(n=>
      new RegExp('(?:^|[^0-9])0?'+n+'\\s*R(?=[^0-9]|$)','i').test(folded)),
     race_kyoso_matches:[...Array(12)].map((_,i)=>i+1).filter(n=>
      new RegExp('第\\s*0?'+n+'競走').test(folded)),
     race_lace_matches:[...Array(12)].map((_,i)=>i+1).filter(n=>
      new RegExp('(?:^|[^0-9])0?'+n+'\\s*レース').test(folded)),
     prior_date_header_verified:folded.includes('2026年8月2日')
    }
   }));
   hasHarontime=normalized.includes('ハロンタイム');
   hasDate=normalized.includes('2026年8月2日');
   return normalized;
  }
 });
 console.log(JSON.stringify({
  status:result.status,verified:result.verified,
  request_count:requestCount,http_status:httpStatus,content_type:contentType,
  html_length:rawHtmlLength,extracted_text_length:extractedTextLength,
  has_harontime:hasHarontime,has_prior_date:hasDate,
  reported_splits:result.lap_seconds?.length??0,
  first600:result.first_600m_seconds??null,
  last600:result.last_600m_seconds??null,
  pace_classification:result.pace_classification??null,
  claim_started:false,prediction_saved:false
 }));
 if(result.status!=='OFFICIAL_RACE_LAPS_VERIFIED'||!Number.isInteger(result.race_no)||requestCount!==1)
  throw Error('OFFICIAL_JRA_PRIOR_LAPS_NOT_VERIFIED');
});
