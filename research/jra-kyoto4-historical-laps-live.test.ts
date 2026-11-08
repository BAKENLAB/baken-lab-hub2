/**
 * ONE-OFF PUBLIC READ ONLY: actual JRA historical result for 2026-10-11
 * Kyoto4R (dirt 1800m) referenced by independently retrieved 2026-11-08
 * Kyoto4R runners. No secrets, user account, betting, CLAIM, DB or FROZEN.
 */
import {acquireVerifiedJraHistoricLaps} from '../automation/jra-official-historic-lap-acquisition.mjs';
const priorRace={
 raceDate:'2026-10-11',track:'京都',raceNo:4,
 distance:1800,surface:'ダート',
 sourceRef:'/JRADB/accessS.html?CNAME=pw01sde1008202604040620261011/7E'
};
const targetRace={
 raceDate:'2026-11-08',postTime:'2026-11-08T12:50:00+09:00'
};
Deno.test('REAL official JRA 2026-10-11 Kyoto4 race laps read-only preclaim source',async()=>{
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
   hasHarontime=normalized.includes('ハロンタイム');
   hasDate=normalized.includes('2026年10月11日');
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
 if(result.status!=='OFFICIAL_RACE_LAPS_VERIFIED'||requestCount!==1)
  throw Error('OFFICIAL_JRA_PRIOR_LAPS_NOT_VERIFIED');
});
