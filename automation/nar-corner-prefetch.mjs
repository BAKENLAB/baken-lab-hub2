/**
 * LOCAL OFFICIAL CORNER pre-CLAIM read-only batch planner.
 * No network or database access in this module. No claim, save, odds or ranking.
 * fetchVerifiedRace is an injected (separately authenticated) official source.
 */
import {buildVerifiedPriorCornerEvidence} from './nar-prior-corners.mjs';

const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?x:null;
const at=x=>Number.isFinite(Date.parse(x))?Date.parse(x):null;
const no=x=>Number.isInteger(Number(x))&&Number(x)>0?Number(x):null;
const key=x=>JSON.stringify([x.raceDate,x.track,x.raceNo]);

/**
 * plan.run witnesses MUST originate in official horse-specific history,
 * with both official horse link and the past-race horse number.
 * Name-only horse_runs cannot be used to invent an identity.
 */
export function planLocalPriorCornerFetches({targetRace,runners,maxPriorRaces=12}) {
 if(!targetRace||!day(targetRace.raceDate)||!targetRace.postTime||
   !Array.isArray(runners)||runners.length<1||!Number.isInteger(maxPriorRaces)||
   maxPriorRaces<1||maxPriorRaces>40)throw new TypeError('INVALID_PREFETCH_PLAN');
 const jobs=new Map();
 for(const runner of runners){
  if(no(runner.horseNo)===null || !runner.horseName ||
    !Array.isArray(runner.verifiedRecentRuns))throw new TypeError('INVALID_CURRENT_HORSE');
  for(const past of runner.verifiedRecentRuns){
   if(!day(past.raceDate)||past.raceDate>=targetRace.raceDate ||
      no(past.pastHorseNo)===null||no(past.raceNo)===null ||
      !past.track||!past.horseRef ||
      !['OFFICIAL_HORSE_REF','OFFICIAL_RACE_HORSE_NO'].includes(past.identityVerifiedBy) ||
      !['NAR_OFFICIAL_RESCUE','NAR_OFFICIAL_HISTORY'].includes(past.source)||
      past.earlyPos!=null && past.finalTurnPos!=null) continue;
   const race={raceDate:past.raceDate,track:past.track,raceNo:Number(past.raceNo)};
   const k=key(race);
   if(!jobs.has(k))jobs.set(k,{priorRace:race,links:[]});
   const l=jobs.get(k).links;
   if(!l.some(x=>x.horseNo===runner.horseNo&&x.pastHorseNo===past.pastHorseNo))l.push({
     horseNo:Number(runner.horseNo),horseName:runner.horseName,
     horseRef:past.horseRef,pastHorseNo:Number(past.pastHorseNo),
     identityVerifiedBy:past.identityVerifiedBy
   });
  }
 }
 return [...jobs.values()].sort((a,b)=>b.priorRace.raceDate.localeCompare(a.priorRace.raceDate))
   .slice(0,maxPriorRaces);
}

async function readWithin(fn,timeoutMs){
 const ctrl=new AbortController();
 let timer;
 try{
  return await Promise.race([
   Promise.resolve().then(()=>fn(ctrl.signal)),
   new Promise((_,reject)=>{timer=setTimeout(()=>{ctrl.abort();reject(new Error('OPTIONAL_SOURCE_TIMEOUT'));},timeoutMs);})
  ]);
 }finally{clearTimeout(timer);ctrl.abort();}
}

export async function fetchLocalPriorCornerEvidence({
 targetRace,runners,fetchVerifiedRace,maxPriorRaces=12,timeoutMs=3000,
 reserveMs=5*60*1000,clock=()=>Date.now()
}) {
 if(typeof fetchVerifiedRace!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||
   timeoutMs>15000||!Number.isFinite(reserveMs)||reserveMs<0)
   throw new TypeError('INVALID_PREFETCH_OPTIONS');
 const plan=planLocalPriorCornerFetches({targetRace,runners,maxPriorRaces});
 const post=at(targetRace.postTime);
 if(post===null)throw new TypeError('INVALID_POST_TIME');
 const reports=[],gathered=[];
 for(const work of plan){
  if(post-clock()<=reserveMs){
   reports.push({priorRace:work.priorRace,status:'SKIPPED_PRE_RACE_BUDGET'});continue;
  }
  try {
   const remaining=Math.max(1,post-clock()-reserveMs);
   const raw=await readWithin(signal=>fetchVerifiedRace({priorRace:work.priorRace,signal}),Math.min(timeoutMs,remaining));
   const packet=buildVerifiedPriorCornerEvidence({
     ...raw,priorRace:work.priorRace,targetRaceDate:targetRace.raceDate,
     targetPostTime:targetRace.postTime
   });
   for(const link of work.links){
     const prior=packet.runners.find(r=>r.prior_horse_no===link.pastHorseNo);
     if(prior?.evidence_status!=='OFFICIAL_CORNER_POSITIONS_VERIFIED')continue;
     gathered.push({horseNo:link.horseNo,horseName:link.horseName,horseRef:link.horseRef,
       identityVerifiedBy:link.identityVerifiedBy,
       pastRace:work.priorRace,pastHorseNo:link.pastHorseNo,
       earlyPos:prior.early_pos,finalTurnPos:prior.final_turn_pos,
       corners:prior.corner_positions,
       source:'NAR_OFFICIAL_PAST_RACE_RESULT',sourceRef:packet.source_ref,
       sourceCheckedAt:packet.source_checked_at,
       rankingEffect:'NONE_UNTIL_REVIEWED'});
   }
   reports.push({priorRace:work.priorRace,status:'VERIFIED',linkedRunners:
     gathered.filter(g=>key(g.pastRace)===key(work.priorRace)).length});
  }catch{
   reports.push({priorRace:work.priorRace,status:'OPTIONAL_SOURCE_UNAVAILABLE'});
  }
 }
 return {status:'PREFETCH_ONLY',raceDate:targetRace.raceDate,
  raceTrack:targetRace.track,raceNo:targetRace.raceNo,
  planned:plan.length,attempted:reports.filter(x=>x.status!=='SKIPPED_PRE_RACE_BUDGET').length,
  linkedRunEvidence:gathered.length,sourceReports:reports,evidence:gathered,
  claimStarted:false,saveAuthorized:false,
  targetResultUsed:false,marketUsed:false,rankChanged:false};
}
