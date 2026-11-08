/**
 * Explicitly invoked, server-only LOCAL pre-CLAIM official evidence workflow.
 * Not a scheduler, HTTP route, DB job claim or public tool.
 * All sources are injected by an authenticated worker. Invocations require
 * independent server-side authorization and current official-race verification.
 */
import {stageLocalCornerSnapshot} from './local-corner-snapshot-handoff.mjs';

const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const trackCodes=Object.freeze({
 '盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21',
 '金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28',
 '高知':'31','佐賀':'32','門別':'36'
});
const validHorseRef=x=>{
 try{
  const u=new URL(x);return u.protocol==='https:'&&u.hostname==='www.keiba.go.jp'&&
   u.pathname==='/KeibaWeb/DataRoom/HorseMarkInfo'&&
   u.searchParams.getAll('k_lineageLoginCode').length===1&&
   /^[0-9]{1,30}$/.test(u.searchParams.get('k_lineageLoginCode')??'')&&
   !u.username&&!u.password&&!u.hash&&
   [...u.searchParams.keys()].every(k=>k==='k_lineageLoginCode'||k==='k_activeCode');
 }catch{return false;}
};
const verifiedCurrent=({race,snapshot,now})=>{
 if(!snapshot||snapshot.source!=='NAR_OFFICIAL_DEBA'||
   snapshot.circuit!=='LOCAL'||snapshot.track!==race.track||
   snapshot.race_date!==race.race_date||snapshot.race_no!==race.race_no||
   !validTime(snapshot.fetched_at)||Date.parse(snapshot.fetched_at)>now||
   now-Date.parse(snapshot.fetched_at)>60000||
   !Array.isArray(snapshot.runners)||snapshot.runners.length>20)return null;
 const u=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
 u.searchParams.set('k_babaCode',trackCodes[race.track]);
 u.searchParams.set('k_raceDate',race.race_date.replaceAll('-','/'));
 u.searchParams.set('k_raceNo',String(race.race_no));
 if(snapshot.source_ref!==u.href)return null;
 const dbAll=race.field_payload?.runners;
 if(!Array.isArray(dbAll)||dbAll.length!==snapshot.runners.length||
    snapshot.runners.some(r=>!Number.isInteger(r.horse_no)||r.horse_no<1||
     r.horse_no>20||!norm(r.horse_name)||
     !['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status)||
     !dbAll.some(x=>x.horse_no===r.horse_no&&
      norm(x.horse_name)===norm(r.horse_name)&&x.status===r.status))||
    new Set(snapshot.runners.map(r=>r.horse_no)).size!==snapshot.runners.length||
    new Set(dbAll.map(r=>r.horse_no)).size!==dbAll.length)return null;
 const officialActive=snapshot.runners.filter(r=>r.status==='ACTIVE');
 return officialActive.length>0?officialActive:null;
};

export async function runAuthorizedLocalCornerPreclaim({
 race,officialReader,prepareCorners,store,assertAuthorized,
 clock=()=>Date.now(),reserveMs=5*60*1000,
 perHorseDeadlineMs=2500,officialCardTimeoutMs=5000
}){
 if(typeof assertAuthorized!=='function')throw new TypeError('AUTHORIZATION_GATE_REQUIRED');
 await assertAuthorized({raceKey:[race?.race_date,race?.track,race?.race_no]});
 if(!race||race.circuit!=='LOCAL'||!trackCodes[race.track]||
    !/^\d{4}-\d{2}-\d{2}$/.test(race.race_date||'')||
    !Number.isInteger(race.race_no)||race.race_no<1||race.race_no>14||
    !validTime(race.post_time)||!['PENDING','RETRY'].includes(race.prediction_status)||
    !officialReader||typeof officialReader.readRace!=='function'||
    typeof officialReader.readHistory!=='function'||typeof prepareCorners!=='function'||
    typeof store?.insertIfAbsent!=='function'||!Number.isInteger(reserveMs)||
    reserveMs<180000||reserveMs>900000||
    !Number.isInteger(perHorseDeadlineMs)||perHorseDeadlineMs<200||
    perHorseDeadlineMs>10000||!Number.isInteger(officialCardTimeoutMs)||
    officialCardTimeoutMs<10||officialCardTimeoutMs>10000)
  throw new TypeError('PRECLAIM_INVALID_OPTIONS');
 const post=Date.parse(race.post_time);
 if(post-clock()<=reserveMs)return {status:'SKIPPED_DEADLINE',storeWritten:false,readCount:0};
 const ctrl=new AbortController();
 let official,timer;
 try{
  official=await Promise.race([
   Promise.resolve().then(()=>officialReader.readRace(race,{limit:5},ctrl.signal)),
   new Promise((_,reject)=>{
    timer=setTimeout(()=>{ctrl.abort();reject(new Error('OFFICIAL_CARD_TIMEOUT'));},
      Math.min(officialCardTimeoutMs,Math.max(1,post-clock()-reserveMs)));
   })
  ]);
 }catch{
  return {status:'OFFICIAL_FIELD_UNAVAILABLE',storeWritten:false,readCount:0};
 }finally{clearTimeout(timer);ctrl.abort();}
 const active=verifiedCurrent({race,snapshot:official,now:clock()});
 if(!active)return {status:'OFFICIAL_FIELD_MISMATCH',storeWritten:false,readCount:0};
 const reports=[],linked=[],witnessRunners=[];let readCount=0;
 for(const runner of active){
  if(post-clock()<=reserveMs){
   witnessRunners.push({horseNo:runner.horse_no,horseName:runner.horse_name,
    status:'ACTIVE',verifiedRecentRuns:[]});
   reports.push({horseNo:runner.horse_no,status:'SKIPPED_DEADLINE'});continue;
  }
  const ref=runner.horse_link_evidence?.horse_ref;
  let history=[];
  if(validHorseRef(ref)&&runner.identity_refs?.includes(ref)){
   const controller=new AbortController();
   const delay=Math.min(perHorseDeadlineMs,Math.max(1,post-clock()-reserveMs));
   const timer=setTimeout(()=>controller.abort(),delay);
   try {
    const raw=await Promise.race([
     officialReader.readHistory(runner,{race,before:race.race_date,limit:5},controller.signal),
     new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>{
      reject(new Error('OFFICIAL_HISTORY_TIMEOUT'));
     },{once:true}))
    ]);
    readCount++;
    if(Array.isArray(raw)){
     history=raw.filter(h=>h?.horse_ref===ref&&norm(h.horse_name)===norm(runner.horse_name)&&
      h.source==='NAR_OFFICIAL_RESCUE'&&h.race_date<race.race_date&&
      /^\d{4}-\d{2}-\d{2}$/.test(h.race_date||'')&&
      Number.isInteger(h.race_no)&&Number.isInteger(h.horse_no)&&
      h.horse_no>=1&&h.horse_no<=24).slice(0,5).map(h=>({
       raceDate:h.race_date,track:h.track,raceNo:h.race_no,
       pastHorseNo:h.horse_no,horseRef:ref,identityVerifiedBy:'OFFICIAL_HORSE_REF',
       source:'NAR_OFFICIAL_RESCUE',earlyPos:h.early_pos??null,
       finalTurnPos:h.final_turn_pos??null
      }));
    }
    reports.push({horseNo:runner.horse_no,
     status:history.length?'VERIFIED':'NO_VERIFIED_PRIOR_RUNS',runs:history.length});
   }catch{
    reports.push({horseNo:runner.horse_no,status:'OPTIONAL_HISTORY_UNAVAILABLE'});
   }finally{clearTimeout(timer);controller.abort();}
  }else{
   reports.push({horseNo:runner.horse_no,status:'OFFICIAL_HORSE_REF_MISSING'});
  }
  witnessRunners.push({horseNo:runner.horse_no,horseName:runner.horse_name,
   status:'ACTIVE',verifiedRecentRuns:history});
 }
 const targetRace={raceDate:race.race_date,track:race.track,
   raceNo:race.race_no,postTime:race.post_time};
 if(post-clock()<=reserveMs)return {status:'SKIPPED_DEADLINE',storeWritten:false,
   readCount,horseReports:reports};
 let cornerPacket;
 try {
  cornerPacket=await prepareCorners({targetRace,officialVerifiedRunners:witnessRunners,
   clock,reserveMs,maxPriorRaces:40,timeoutMs:1500});
 }catch{
  return {status:'OPTIONAL_CORNERS_UNAVAILABLE',storeWritten:false,
   readCount,horseReports:reports};
 }
 const coverage={
  active_horses:active.length,
  successful_history_responses:readCount,
  horses_with_verified_history:reports.filter(r=>r.status==='VERIFIED').length,
  verified_prior_run_witnesses:witnessRunners.reduce((n,h)=>n+h.verifiedRecentRuns.length,0),
  missing_official_horse_links:reports.filter(r=>r.status==='OFFICIAL_HORSE_REF_MISSING').length,
  unavailable_or_empty_history:reports.filter(r=>['NO_VERIFIED_PRIOR_RUNS','OPTIONAL_HISTORY_UNAVAILABLE'].includes(r.status)).length
 };
 const saved=await stageLocalCornerSnapshot({race,officialRunners:witnessRunners,
  packet:cornerPacket,store,clock});
 return {status:saved.status,storeWritten:!!saved.inserted,
  readCount,horseReports:reports,coverage,linkedRunEvidence:cornerPacket?.linkedRunEvidence||0,
  claimStarted:false,predictionSaved:false};
}
