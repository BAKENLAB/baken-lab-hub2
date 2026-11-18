/**
 * LOCAL OFFICIAL CORNER pre-CLAIM read-only batch planner.
 * No network or database access in this module. No claim, save, odds or ranking.
 * fetchVerifiedRace is an injected (separately authenticated) official source.
 */
import {buildVerifiedPriorCornerEvidence} from './nar-prior-corners.mjs';

const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?x:null;
const normalizedHorseName=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const at=x=>Number.isFinite(Date.parse(x))?Date.parse(x):null;
const no=x=>Number.isInteger(Number(x))&&Number(x)>0?Number(x):null;
const key=x=>JSON.stringify([x.raceDate,x.track,x.raceNo]);
const validOfficialHorseRef=(ref)=>{
 try{
  const u=new URL(ref);
  return u.protocol==='https:' && u.hostname==='www.keiba.go.jp' &&
    u.pathname==='/KeibaWeb/DataRoom/HorseMarkInfo' &&
    !u.username && !u.password && !u.hash &&
    u.searchParams.getAll('k_lineageLoginCode').length===1 &&
    /^[0-9]{1,30}$/.test(u.searchParams.get('k_lineageLoginCode')??'') &&
    [...u.searchParams.keys()].every(k=>k==='k_lineageLoginCode'||k==='k_activeCode');
 }catch{return false;}
};

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
      !past.track||!validOfficialHorseRef(past.horseRef) ||
      !['OFFICIAL_HORSE_REF','OFFICIAL_RACE_HORSE_NO'].includes(past.identityVerifiedBy) ||
      !['NAR_OFFICIAL_RESCUE','NAR_OFFICIAL_HISTORY'].includes(past.source)) continue;
   // Prior horse-profile corners do not substitute for independent official
   // RACE-result corner witnesses, so they remain eligible for verification.
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
 // Prioritize per-horse official witness COVERAGE over redundant
 // newer races for horses already served. Share one result page among any
 // current horses who ran in it, and prefer newest when coverage ties.
 const remaining=[...jobs.values()].sort((a,b)=>
   b.priorRace.raceDate.localeCompare(a.priorRace.raceDate)||
   b.priorRace.raceNo-a.priorRace.raceNo||
   a.priorRace.track.localeCompare(b.priorRace.track));
 const covered=new Map(),selected=[];
 let tier=0;
 while(remaining.length&&selected.length<maxPriorRaces){
   const gain=work=>new Set(work.links.map(h=>h.horseNo)
     .filter(h=>(covered.get(h)||0)<=tier)).size;
   let best=-1,bestGain=0;
   for(let i=0;i<remaining.length;i++){
     const n=gain(remaining[i]);
     if(n>bestGain){bestGain=n;best=i;}
   }
   if(best===-1){tier++;continue;}
   const [chosen]=remaining.splice(best,1);
   selected.push(chosen);
   for(const horse of new Set(chosen.links.map(x=>x.horseNo)))
     covered.set(horse,(covered.get(horse)||0)+1);
 }
 return selected;
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
 reserveMs=5*60*1000,clock=()=>Date.now(),absoluteDeadlineMs=null
}) {
 if(typeof fetchVerifiedRace!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||
   timeoutMs>15000||!Number.isFinite(reserveMs)||reserveMs<0||
   (absoluteDeadlineMs!==null&&
    (!Number.isFinite(absoluteDeadlineMs)||absoluteDeadlineMs<=0)))
   throw new TypeError('INVALID_PREFETCH_OPTIONS');
 const plan=planLocalPriorCornerFetches({targetRace,runners,maxPriorRaces});
 const post=at(targetRace.postTime);
 if(post===null)throw new TypeError('INVALID_POST_TIME');
 const reports=[],gathered=[],raceLaps=[],observedRaces=[];
 for(const work of plan){
  const postBudget=post-clock()-reserveMs;
  const operationBudget=absoluteDeadlineMs===null?
    Number.POSITIVE_INFINITY:absoluteDeadlineMs-clock();
  if(postBudget<=0||operationBudget<=0){
   reports.push({priorRace:work.priorRace,status:
    postBudget<=0?'SKIPPED_PRE_RACE_BUDGET':'SKIPPED_OPERATION_BUDGET'});
   continue;
  }
  try {
   // A single canonical deadline extends across ALL prior-race pages;
   // otherwise 40 * 1.5s can exhaust the caller before the seal is written.
   const remaining=Math.min(postBudget,operationBudget);
   const raw=await readWithin(signal=>fetchVerifiedRace({priorRace:work.priorRace,signal}),Math.min(timeoutMs,remaining));
   const packet=buildVerifiedPriorCornerEvidence({
     ...raw,priorRace:work.priorRace,targetRaceDate:targetRace.raceDate,
     targetPostTime:targetRace.postTime
   });
   // A verified horse URL and past horse number are necessary but not sufficient:
   // the official result must also identify that past number by the same horse name.
   // Missing or partial result-name maps fail closed, without blocking the CLAIM path.
   const officialNames=raw?.officialHorseNames;
   if(!officialNames || typeof officialNames!=='object' ||
      !Array.isArray(raw?.knownHorseNos) ||
      raw.knownHorseNos.some(n=>!normalizedHorseName(officialNames[String(n)])))
     throw new Error('OFFICIAL_RESULT_HORSE_NAMES_UNVERIFIED');
   let identityRejected=0,linkedRunners=0;
   for(const link of work.links){
     if(normalizedHorseName(link.horseName)!==
        normalizedHorseName(officialNames[String(link.pastHorseNo)])){
       identityRejected++;
       continue;
     }
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
     linkedRunners++;
   }
   // Reuse verified existing race-result page and authenticated horse link.
   // Race-level lap is NOT any individual horse's 200m speed.
   if(linkedRunners>0 && raw?.officialRaceLaps?.status==='VERIFIED_RACE_LEVEL_LAPS' &&
     raw.officialRaceLaps.sourceRef===packet.source_ref &&
     raw.officialRaceLaps.sourceCheckedAt===packet.source_checked_at &&
     JSON.stringify(raw.officialRaceLaps.pastRace)===JSON.stringify(work.priorRace))
     raceLaps.push(raw.officialRaceLaps);
   // Captured from this same official result HTML; no extra network fetch.
   if(linkedRunners>0&&Array.isArray(raw?.officialFinishers)&&
      raw.officialFinishers.length<=24 &&
      raw.officialFinishers.every(h=>Number.isInteger(h.horseNo)&&
       Number.isInteger(h.finish)&&h.finish>=1&&h.finish<=24&&
       /^[0-9]{1,30}$/.test(h.officialHorseId??'')&&
       !!normalizedHorseName(h.horseName)) &&
      new Set(raw.officialFinishers.map(h=>h.officialHorseId)).size===raw.officialFinishers.length)
     observedRaces.push({priorRace:work.priorRace,
       sourceRef:packet.source_ref,sourceCheckedAt:packet.source_checked_at,
       finishers:raw.officialFinishers});
   reports.push({priorRace:work.priorRace,
     status:identityRejected?'VERIFIED_WITH_IDENTITY_REJECTIONS':'VERIFIED',
     linkedRunners,identityRejected});
  }catch{
   reports.push({priorRace:work.priorRace,status:'OPTIONAL_SOURCE_UNAVAILABLE'});
  }
 }
 // Any opponent follow-up requires TWO separately verified official result
 // pages fetched strictly before this target: a prior common race and a
 // LATER race in which the SAME official horse ID appeared. No name joins.
 const opponentFollowups=[],seenPeerLinks=new Set();
 for(const base of observedRaces){
  const linked=gathered.filter(x=>key(x.pastRace)===key(base.priorRace)&&x.sourceRef===base.sourceRef);
  for(const self of linked){
   let myId=null;
   try{myId=new URL(self.horseRef).searchParams.get('k_lineageLoginCode')}catch{}
   const myResult=base.finishers.find(x=>x.horseNo===self.pastHorseNo&&
     normalizedHorseName(x.horseName)===normalizedHorseName(self.horseName)&&
     x.officialHorseId===myId);
   if(!myResult)continue;
   for(const peer of base.finishers){
    if(peer.finish>3||peer.officialHorseId===myId)continue;
    for(const later of observedRaces){
     if(later.priorRace.raceDate<=base.priorRace.raceDate||
        later.priorRace.raceDate>=targetRace.raceDate)continue;
     const matched=later.finishers.filter(x=>x.officialHorseId===peer.officialHorseId&&
       normalizedHorseName(x.horseName)===normalizedHorseName(peer.horseName));
     if(matched.length!==1)continue;
     const unique=[self.horseNo,key(base.priorRace),peer.officialHorseId,key(later.priorRace)].join('|');
     if(seenPeerLinks.has(unique))continue;
     seenPeerLinks.add(unique);
     opponentFollowups.push({horseNo:self.horseNo,horseName:self.horseName,
      priorRace:base.priorRace,sourceRef:base.sourceRef,sourceCheckedAt:base.sourceCheckedAt,
      peerOfficialHorseId:peer.officialHorseId,peerName:peer.horseName,
      peerPriorFinish:peer.finish,followupRace:later.priorRace,
      followupSourceRef:later.sourceRef,followupCheckedAt:later.sourceCheckedAt,
      peerFollowupFinish:matched[0].finish,
      identityMethod:'EXACT_NAR_OFFICIAL_HORSE_ID_TWO_RESULT_PAGES',
      rankingEffect:'NONE_UNTIL_REVIEWED'});
     if(opponentFollowups.length>=80)break;
    }
    if(opponentFollowups.length>=80)break;
   }
   if(opponentFollowups.length>=80)break;
  }
  if(opponentFollowups.length>=80)break;
 }
 return {status:'PREFETCH_ONLY',raceDate:targetRace.raceDate,
  raceTrack:targetRace.track,raceNo:targetRace.raceNo,
  planned:plan.length,attempted:reports.filter(x=>
   !['SKIPPED_PRE_RACE_BUDGET','SKIPPED_OPERATION_BUDGET'].includes(x.status)).length,
  operation_budget_exhausted:reports.some(x=>x.status==='SKIPPED_OPERATION_BUDGET'),
  linkedRunEvidence:gathered.length,sourceReports:reports,evidence:gathered,officialRaceLaps:raceLaps,opponentFollowups,
  claimStarted:false,saveAuthorized:false,
  targetResultUsed:false,marketUsed:false,rankChanged:false};
}
