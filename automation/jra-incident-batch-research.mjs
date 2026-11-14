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
export async function runJraIncidentBatch({targetRace,officialRunners,liveRunners,priorRaceInputs,acquire,clock=()=>Date.now(),reserveMs=180000,maxRaces=8}={}){
 if(typeof acquire!=='function'||!Number.isInteger(maxRaces)||maxRaces<1||maxRaces>12)return fail('INVALID_RESEARCH_BATCH_LIMIT');
 const plan=planJraIncidentBatch({targetRace,officialRunners,liveRunners,priorRaceInputs,clock,reserveMs});
 if(plan.status!=='RESEARCH_BATCH_PLANNED')return plan;
 const packets=[],receipts=[];let attempted=0;
 for(const item of plan.items){
  const receipt={race_core:item.race_core,linked_runs:item.links.length};
  if(item.status!=='READY_FOR_RESEARCH_FETCH'){receipts.push({...receipt,status:item.status});continue;}
  if(attempted>=maxRaces){receipts.push({...receipt,status:'BATCH_LIMIT'});continue;}
  if(clock()+reserveMs>=ts(targetRace.postTime)){receipts.push({...receipt,status:'DEADLINE'});continue;}
  attempted++;
  try{
   const x=await acquire({targetRace,priorRace:item.priorRace,expectedRoster:item.expectedRoster,reportRef:item.reportRef,clock,reserveMs});
   if(x?.verified===true&&Array.isArray(x.packets)){
    const accepted=x.packets.filter(p=>p?.verified===true&&['RESULT','REPORT'].includes(p.source_kind)&&officialRaceCore(p.source_ref,p.source_kind==='REPORT'?'report':'result')===item.race_core&&p.race_date===item.priorRace.raceDate);
    packets.push(...accepted);
    receipts.push({...receipt,status:accepted.length?'SOURCE_REVIEW_AVAILABLE':'PACKET_UNVERIFIED',accepted_sources:accepted.length,failures:x.failures??[]});
   }else receipts.push({...receipt,status:x?.status??'SOURCE_UNAVAILABLE'});
  }catch{receipts.push({...receipt,status:'SOURCE_UNAVAILABLE'});}
 }
 const industry=attachJraPriorIncidentEvidence({targetRace,officialRunners,liveRunners,packets,clock});
 return {status:'RESEARCH_BATCH_COMPLETE',plan,receipts,attempted_prior_races:attempted,incident_review:industry,rank_effect:'NONE',market_used:false,target_result_used:false,prediction_saved:false};
}
