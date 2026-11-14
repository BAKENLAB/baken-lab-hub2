/**
 * Bounded research orchestration. Historical race sources/rosters must be
 * independently supplied and verified by the caller. No target results,
 * prediction saves, schedules or DB access. Never mint a result/report URL.
 */
import {officialHorseId,officialRaceCore,attachJraPriorIncidentEvidence} from './jra-official-stewards-incident-link.mjs';
const ts=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const validNo=x=>Number.isInteger(x)&&x>=1&&x<=24;
const fail=status=>({status,items:[],rank_effect:'NONE',market_used:false,target_result_used:false,prediction_saved:false});
export function planJraIncidentBatch({targetRace,officialRunners,liveRunners,priorRaceInputs,clock=()=>Date.now(),reserveMs=180000}={}){
 const now=clock(),post=ts(targetRace?.postTime);
 if(!Number.isFinite(now)||post===null||!Number.isInteger(reserveMs)||reserveMs<180000||now+reserveMs>=post||
 !Array.isArray(officialRunners)||!officialRunners.length||officialRunners.length>24||
 !Array.isArray(liveRunners)||liveRunners.length!==officialRunners.length||!Array.isArray(priorRaceInputs))return fail('UNVERIFIED_FIELD_OR_DEADLINE');
 const ids=new Set(),byNo=new Map();
 for(const h of officialRunners){const id=officialHorseId(h.horse_ref);if(h.status!=='ACTIVE'||!validNo(h.horse_no)||!id||ids.has(id)||byNo.has(h.horse_no))return fail('UNVERIFIED_FIELD_ID');ids.add(id);byNo.set(h.horse_no,{id,name:h.horse_name});}
 const groups=new Map(),seen=new Set(),missing=[];
 let expectedRuns=0,duplicates=0;
 for(const h of liveRunners){
  const o=byNo.get(h.horse_no);
  if(!o||seen.has(h.horse_no)||o.name!==h.horse_name||o.id!==officialHorseId(h.horse_ref)||!Array.isArray(h.past_runs))return fail('LIVE_FIELD_MISMATCH');
  seen.add(h.horse_no);const local=new Set();
  for(const [idx,r] of h.past_runs.slice(0,5).entries()){
   expectedRuns++;
   const core=officialRaceCore(r.source_ref,'result');
   if(!core||!(r.race_date<targetRace.raceDate)||core.slice(-8)!==String(r.race_date).replace(/-/g,'')){
    missing.push({horse_no:h.horse_no,run_index:idx,status:'UNVERIFIED_PRIOR_RACE'});continue;
   }
   if(local.has(core)){duplicates++;missing.push({horse_no:h.horse_no,run_index:idx,status:'DUPLICATE_PRIOR_RACE'});continue;}
   local.add(core);
   if(!groups.has(core))groups.set(core,[]);
   groups.get(core).push({horse_no:h.horse_no,horse_id:o.id,run_index:idx,race_date:r.race_date});
  }
 }
 const supplied=new Map();
 for(const p of priorRaceInputs){const k=officialRaceCore(p?.priorRace?.sourceRef,'result');if(!k)continue;if(!supplied.has(k))supplied.set(k,[]);supplied.get(k).push(p);}
 const items=[];
 for(const [core,links] of groups){
  const candidates=supplied.get(core)??[],p=candidates.length===1?candidates[0]:null;
  const rr=p?.expectedRoster,prior=p?.priorRace;
  const rosterIds=Array.isArray(rr)?rr.map(h=>officialHorseId(h.horseRef)):[];
  const valid=!!p&&p.independentlyVerified===true&&rr?.length>=1&&rr.length<=24&&rr.every(h=>validNo(h.horseNo)&&typeof h.horseName==='string'&&h.horseName.trim())&&
   new Set(rr.map(h=>h.horseNo)).size===rr.length&&rosterIds.every(Boolean)&&new Set(rosterIds).size===rr.length&&
   links.every(l=>l.race_date===prior.raceDate&&rosterIds.includes(l.horse_id))&&
   core.slice(-8)===prior.raceDate.replace(/-/g,'')&&Number(core.slice(-10,-8))===prior.raceNo&&
   (!p.reportRef||officialRaceCore(p.reportRef,'report')===core);
  if(!valid){items.push({race_core:core,links,status:'INDEPENDENT_PRIOR_ROSTER_UNAVAILABLE'});continue;}
  items.push({race_core:core,links,status:'READY_FOR_RESEARCH_FETCH',priorRace:prior,expectedRoster:rr,reportRef:p.reportRef??null});
 }
 return {status:'RESEARCH_BATCH_PLANNED',items,missing,expected_runs:expectedRuns,duplicate_runs:duplicates,unique_prior_races:items.length,ready_prior_races:items.filter(x=>x.status==='READY_FOR_RESEARCH_FETCH').length,rank_effect:'NONE',market_used:false,target_result_used:false,prediction_saved:false};
}
// A missing incident section must not discard independently verified timing.
function acceptLap(p,item,targetRace,now){
 const prior=item.priorRace,checked=ts(p?.source_checked_at),post=ts(targetRace.postTime);
 if(p?.status!=='OFFICIAL_RACE_LAPS_VERIFIED'||p.verified!==true||p.scope!=='SAME_VERIFIED_RESULT_HTML_RACE_WIDE'||
 p.market_used!==false||p.rank_effect!=='NONE'||officialRaceCore(p.source_ref,'result')!==item.race_core||
 p.race_date!==prior.raceDate||p.track!==prior.track||p.race_no!==prior.raceNo||
 !Number.isInteger(prior.distance)||prior.distance<1000||prior.distance>4500||!['芝','ダート'].includes(prior.surface)||
 p.distance!==prior.distance||p.surface!==prior.surface||checked===null||checked>now||checked>=post||checked<Date.parse(prior.raceDate+'T00:00:00+09:00'))return null;
 const laps=p.lap_seconds,lengths=p.segment_distances_m,first=prior.distance%200||200;
 if(!Array.isArray(laps)||laps.length!==Math.ceil(prior.distance/200)||
 laps.some((n,i)=>typeof n!=='number'||!Number.isFinite(n)||n<(i===0?5:8)||n>30)||
 !Array.isArray(lengths)||lengths.length!==laps.length||lengths.some((n,i)=>n!==(i===0?first:200)))return null;
 const sum=a=>Math.round(a.reduce((n,v)=>n+v,0)*10)/10;
 if(p.first_600m_seconds!==(first===200?sum(laps.slice(0,3)):null)||p.last_600m_seconds!==sum(laps.slice(-3)))return null;
 return {status:p.status,verified:true,scope:p.scope,source_ref:p.source_ref,source_checked_at:p.source_checked_at,
 race_date:p.race_date,track:p.track,race_no:p.race_no,surface:p.surface,distance:p.distance,
 lap_seconds:[...laps],segment_distances_m:[...lengths],first_600m_seconds:p.first_600m_seconds,last_600m_seconds:p.last_600m_seconds,
 market_used:false,rank_effect:'NONE'};
}

export async function runJraIncidentBatch({targetRace,officialRunners,liveRunners,priorRaceInputs,acquire,clock=()=>Date.now(),reserveMs=180000,maxRaces=8}={}){
 if(typeof acquire!=='function'||!Number.isInteger(maxRaces)||maxRaces<1||maxRaces>12)return fail('INVALID_RESEARCH_BATCH_LIMIT');
 const plan=planJraIncidentBatch({targetRace,officialRunners,liveRunners,priorRaceInputs,clock,reserveMs});
 if(plan.status!=='RESEARCH_BATCH_PLANNED')return plan;
 const packets=[],receipts=[],lapPackets=[];let attempted=0,lapLinkedRuns=0;
 for(const item of plan.items){
  const receipt={race_core:item.race_core,linked_runs:item.links.length,lap_status:'NOT_ATTEMPTED'};
  if(item.status!=='READY_FOR_RESEARCH_FETCH'){receipts.push({...receipt,status:item.status});continue;}
  if(attempted>=maxRaces){receipts.push({...receipt,status:'BATCH_LIMIT'});continue;}
  if(clock()+reserveMs>=ts(targetRace.postTime)){receipts.push({...receipt,status:'DEADLINE'});continue;}
  attempted++;
  try{
   const x=await acquire({targetRace,priorRace:item.priorRace,expectedRoster:item.expectedRoster,reportRef:item.reportRef,clock,reserveMs});
   const timing=acceptLap(x?.lap_observation,item,targetRace,clock());
   if(timing){lapPackets.push(timing);lapLinkedRuns+=item.links.length;}
   receipt.lap_status=timing?'VERIFIED_RACE_WIDE_LAPS':'LAPS_UNVERIFIED_OR_UNAVAILABLE';
   if(x?.verified===true&&Array.isArray(x.packets)){
    const accepted=x.packets.filter(p=>p?.verified===true&&['RESULT','REPORT'].includes(p.source_kind)&&officialRaceCore(p.source_ref,p.source_kind==='REPORT'?'report':'result')===item.race_core&&p.race_date===item.priorRace.raceDate);
    packets.push(...accepted);
    receipts.push({...receipt,status:accepted.length?'SOURCE_REVIEW_AVAILABLE':'PACKET_UNVERIFIED',accepted_sources:accepted.length,failures:x.failures??[]});
   }else receipts.push({...receipt,status:x?.status??'SOURCE_UNAVAILABLE',failures:Array.isArray(x?.failures)?x.failures.filter(v=>typeof v==='string'&&/^[A-Z0-9_]{1,100}$/.test(v)).slice(0,12):[]});
  }catch{receipts.push({...receipt,status:'SOURCE_UNAVAILABLE'});}
 }
 const industry=attachJraPriorIncidentEvidence({targetRace,officialRunners,liveRunners,packets,clock});
 return {status:'RESEARCH_BATCH_COMPLETE',plan,receipts,attempted_prior_races:attempted,incident_review:industry,lap_packets:lapPackets,lap_coverage:{verified_distinct_races:lapPackets.length,linked_prior_runs:lapLinkedRuns,supplied_prior_runs:plan.expected_runs},rank_effect:'NONE',market_used:false,target_result_used:false,prediction_saved:false};
}
