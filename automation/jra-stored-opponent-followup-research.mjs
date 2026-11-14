/**
 * Research-only stored official JRA card/result identity linkage.
 * No inference from a horse name alone. Every observation must have an
 * independently verified historical card, result row and as-of timestamp.
 * The stored result may be partial: an absent finisher is NOT a defeat
 * or evidence that the horse did not subsequently run.
 * No scoring, production ranking, DB writes or target race outcomes.
 */
import {officialHorseId,officialRaceCore} from './jra-official-stewards-incident-link.mjs';
const trackCodes={'札幌':'01','函館':'02','福島':'03','新潟':'04','東京':'05','中山':'06','中京':'07','京都':'08','阪神':'09','小倉':'10'};
const epoch=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString().slice(0,10)===x;
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const key=r=>[r.race_date,r.track,r.race_no].join('/');
const name=x=>typeof x==='string'?x.normalize('NFKC').trim():'';
const jstDay=t=>new Date(t+9*3600000).toISOString().slice(0,10);
const fail=status=>({status,verified:false,rank_effect:'NONE',market_used:false,target_result_used:false});
function cardCore(cname){
 return typeof cname==='string'?cname.match(/^[ps]w01dde(\d{22})(?:\/|%2[fF])[A-Fa-f0-9]{2}$/)?.[1]??null:null;
}
function matchesIdentity(core,r){
 return !!core&&core.slice(2,4)===trackCodes[r.track]&&Number(core.slice(-10,-8))===r.race_no&&core.slice(-8)===r.race_date.replace(/-/g,'');
}
export function linkStoredJraResult({race,asOf,targetRaceDate}={}){
 const cutoff=epoch(asOf),post=epoch(race?.post_time),settled=epoch(race?.settled_at),checked=epoch(race?.card_checked_at),verifiedAt=epoch(race?.card_verification?.verified_at),v=race?.card_verification;
 if(cutoff===null||!date(targetRaceDate)||!date(race?.race_date)||race.race_date>=targetRaceDate||
 !integer(race.race_no,1,12)||!trackCodes[race.track]||post===null||settled===null||checked===null||verifiedAt===null||
 jstDay(post)!==race.race_date||checked>post||verifiedAt>post||settled<post||settled>cutoff||
 race.card_source!=='JRA_OFFICIAL_VERIFIED_GATE_V1'||race.result_source!=='JRA_OFFICIAL'||
 v?.verified!==true||v.basis!=='JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1'||!/^[a-f0-9]{64}$/.test(v.html_sha256??'')||
 !matchesIdentity(cardCore(race.card_cname),race))return fail('UNVERIFIED_ARCHIVE_IDENTITY_OR_ASOF');
 const card=race.card_runners,finishers=race.finishers,non=race.non_finishers;
 if(!Array.isArray(card)||!integer(card.length,1,24)||card.length!==v.runner_count||!Array.isArray(finishers)||!Array.isArray(non))return fail('UNVERIFIED_ARCHIVE_CARD_OR_RESULT');
 const byNo=new Map(),ids=new Set();
 for(const h of card){
  const id=officialHorseId(h.horse_ref);
  if(!integer(h.horse_no,1,24)||!id||!name(h.horse_name)||ids.has(id)||byNo.has(h.horse_no)||typeof h.status!=='string')return fail('AMBIGUOUS_ARCHIVE_HORSE_ID');
  ids.add(id);byNo.set(h.horse_no,{horse_id:id,horse_no:h.horse_no,horse_name:name(h.horse_name),status:h.status});
 }
 if(card.filter(h=>h.status==='ACTIVE').length!==v.active_count)return fail('ARCHIVE_ACTIVE_COUNT_MISMATCH');
 const observed=[],seen=new Set();
 for(const r of finishers){
  const h=byNo.get(r.horse_no);
  if(!h||h.status!=='ACTIVE'||h.horse_name!==name(r.horse_name)||seen.has(r.horse_no)||!integer(r.finish,1,card.length))return fail('FINISHER_CARD_ID_MISMATCH');
  seen.add(r.horse_no);observed.push({...h,finish:r.finish,reported_margin:r.margin??null});
 }
 for(const r of non){
  const h=byNo.get(r.horse_no);
  if(!h||h.horse_name!==name(r.horse_name)||seen.has(r.horse_no))return fail('NONFINISHER_CARD_ID_MISMATCH');
  seen.add(r.horse_no);
 }
 const missing=card.filter(h=>h.status==='ACTIVE'&&!seen.has(h.horse_no)).length;
 return {status:missing?'PARTIAL_STORED_RESULT':'STORED_RESULT_CARD_ID_MATCH',verified:true,
  scope:'STORED_OFFICIAL_CARD_AND_RESULT_NOT_RAW_HTML_REFETCH',
  race_date:race.race_date,track:race.track,race_no:race.race_no,race_core_suffix:cardCore(race.card_cname).slice(2),
  class_name:typeof race.class_name==='string'?race.class_name:null,settled_at:race.settled_at,
  card_digest:v.html_sha256,active_count:v.active_count,observed_finishers:observed,
  missing_active_result_count:missing,nonfinisher_count:non.length,absence_is_not_no_start:true,
  rank_effect:'NONE',market_used:false,target_result_used:false};
}
export function buildJraStoredOpponentIndex({archiveRaces,asOf,targetRaceDate}={}){
 const cutoff=epoch(asOf);
 if(cutoff===null||!date(targetRaceDate)||jstDay(cutoff)>targetRaceDate||!Array.isArray(archiveRaces)||archiveRaces.length>3000)return fail('INVALID_ARCHIVE_SCOPE');
 const counts=new Map();for(const r of archiveRaces){const k=key(r);counts.set(k,(counts.get(k)??0)+1);}
 const races=new Map(),byHorse=new Map(),rejected=[];
 for(const r of archiveRaces){
  const k=key(r);
  if(counts.get(k)!==1){rejected.push({key:k,status:'DUPLICATE_ARCHIVE_RACE'});continue;}
  const x=linkStoredJraResult({race:r,asOf,targetRaceDate});
  if(!x.verified){rejected.push({key:k,status:x.status});continue;}
  races.set(k,x);
  for(const h of x.observed_finishers){
   if(!byHorse.has(h.horse_id))byHorse.set(h.horse_id,[]);
   byHorse.get(h.horse_id).push({race_date:x.race_date,track:x.track,race_no:x.race_no,class_name:x.class_name,finish:h.finish,horse_id:h.horse_id,settled_at:x.settled_at,card_digest:x.card_digest});
  }
 }
 return {status:'RESEARCH_STORED_OPPONENT_INDEX',verified:true,races,byHorse,rejected,asOf,targetRaceDate,
  coverage:{input_races:archiveRaces.length,linked_races:races.size,partial_result_races:[...races.values()].filter(r=>r.missing_active_result_count>0).length,
  observed_finishers:[...races.values()].reduce((n,r)=>n+r.observed_finishers.length,0),unique_ids:byHorse.size},
  rank_effect:'NONE',market_used:false,target_result_used:false};
}
export function reviewStoredJraPriorRace({index,priorRace}={}){
 const bad=status=>({...fail(status),runners:[]});
 if(index?.status!=='RESEARCH_STORED_OPPONENT_INDEX'||!date(priorRace?.race_date)||!integer(priorRace.race_no,1,12))return bad('UNVERIFIED_RESEARCH_INDEX');
 const base=index.races.get(key(priorRace));
 if(!base)return bad('PRIOR_RACE_NOT_OBSERVED');
 // If a result source reference is supplied, require exactly the same
 // date/venue/race identity as the independently verified card.
 if(priorRace.source_ref!==undefined){
  const core=officialRaceCore(priorRace.source_ref,'result');
  if(!matchesIdentity(core,priorRace)||core.slice(2)!==base.race_core_suffix)return bad('PRIOR_SOURCE_IDENTITY_MISMATCH');
 }
 const runners=base.observed_finishers.map(h=>{
  const later=(index.byHorse.get(h.horse_id)??[]).filter(r=>r.race_date>base.race_date&&r.race_date<index.targetRaceDate&&epoch(r.settled_at)<=epoch(index.asOf)).sort((a,b)=>a.race_date.localeCompare(b.race_date)||a.track.localeCompare(b.track)||a.race_no-b.race_no);
  return {horse_id:h.horse_id,prior_horse_no:h.horse_no,prior_finish:h.finish,later_observations:later,
    status:later.length?'LATER_RESULT_OBSERVED':'LATER_RESULT_NOT_OBSERVED_IN_ARCHIVE'};
 });
 return {status:'RESEARCH_PRIOR_FIELD_FOLLOWUP',verified:true,prior_race:key(priorRace),prior_active_count:base.active_count,
 prior_observed_finishers:runners.length,prior_missing_active_results:base.missing_active_result_count,
 horses_with_observed_later_results:runners.filter(h=>h.later_observations.length).length,
 observed_later_runs:runners.reduce((n,h)=>n+h.later_observations.length,0),runners,
 absence_is_not_no_later_run:true,rank_effect:'NONE',market_used:false,target_result_used:false};
}
export function attachStoredJraOpponentFollowups({index,officialRunners,liveRunners}={}){
 const bad=status=>({...fail(status),runners:[]});
 if(index?.status!=='RESEARCH_STORED_OPPONENT_INDEX'||!Array.isArray(officialRunners)||!officialRunners.length||officialRunners.length>24||
 !Array.isArray(liveRunners)||liveRunners.length!==officialRunners.length)return bad('UNVERIFIED_CURRENT_FIELD');
 const byNo=new Map(),ids=new Set();
 for(const h of officialRunners){
  const id=officialHorseId(h.horse_ref);
  if(!id||h.status!=='ACTIVE'||!integer(h.horse_no,1,24)||!name(h.horse_name)||byNo.has(h.horse_no)||ids.has(id))return bad('CURRENT_ID_MISMATCH');
  byNo.set(h.horse_no,{id,horse_name:name(h.horse_name)});ids.add(id);
 }
 const runners=[],seen=new Set(),reused=new Map();
 for(const h of liveRunners){
  const o=byNo.get(h.horse_no);
  if(!o||seen.has(h.horse_no)||o.id!==officialHorseId(h.horse_ref)||o.horse_name!==name(h.horse_name)||!Array.isArray(h.past_runs))return bad('LIVE_ID_MISMATCH');
  seen.add(h.horse_no);const pastSeen=new Set();
  const history=h.past_runs.slice(0,5).map((run,i)=>{
   const missing=status=>({run_index:i,status,opponents:[]});
   const core=officialRaceCore(run.source_ref,'result');
   if(!core||!date(run.race_date)||run.race_date>=index.targetRaceDate||!trackCodes[run.track]||!integer(run.race_no,1,12)||!matchesIdentity(core,run))return missing('PRIOR_IDENTITY_UNVERIFIED');
   if(pastSeen.has(core))return missing('DUPLICATE_PRIOR_RUN');pastSeen.add(core);
   if(!reused.has(core))reused.set(core,reviewStoredJraPriorRace({index,priorRace:run}));
   const x=reused.get(core);
   if(!x.verified||!x.runners.some(r=>r.horse_id===o.id))return missing('PRIOR_HORSE_RESULT_NOT_OBSERVED');
   const opponents=x.runners.filter(r=>r.horse_id!==o.id);
   return {run_index:i,status:'STORED_OPPONENT_FOLLOWUP_REVIEW',prior_race:x.prior_race,
    observed_opponents:opponents.length,missing_prior_active_results:x.prior_missing_active_results,
    opponents_with_observed_later_results:opponents.filter(r=>r.later_observations.length).length,opponents,
    absence_is_not_no_later_run:true,automatic_score_effect:0};
  });
  runners.push({horse_no:h.horse_no,horse_id:o.id,history});
 }
 return {status:'RESEARCH_WHOLE_FIELD_OPPONENT_FOLLOWUP_REVIEW',verified:true,runners,coverage:{
   reviewed_horses:runners.length,supplied_runs:runners.reduce((n,h)=>n+h.history.length,0),
   linked_prior_runs:runners.reduce((n,h)=>n+h.history.filter(r=>r.status==='STORED_OPPONENT_FOLLOWUP_REVIEW').length,0)},
   rank_effect:'NONE',market_used:false,target_result_used:false,prediction_saved:false};
}
