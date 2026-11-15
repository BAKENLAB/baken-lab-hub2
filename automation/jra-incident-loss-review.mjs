/**
 * Research-only JRA loss review. No I/O, no automatic points, no changed
 * FROZEN. Use verified prior snapshots + official incident and lap sources.
 * A recorded event is not proof of a time loss or the cause of defeat.
 */
import {officialRaceCore,officialHorseId} from './jra-official-stewards-incident-link.mjs';
import {joinVerifiedJraCornerAndRaceLaps} from './jra-corner-lap-evidence-join.mjs';
const validPos=x=>Number.isInteger(x)&&x>=1&&x<=24;
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const reject=status=>({status,runners:[],rank_effect:'NONE',market_used:false,target_result_used:false,prediction_saved:false});
export function buildJraIncidentLossReview({targetRace,officialRunners,incidentReview,deepHistory,lapPackets=[],clock=()=>Date.now()}={}){
 const now=clock(),post=time(targetRace?.postTime);
 if(!Number.isFinite(now)||post===null||now>=post||!targetRace?.raceDate||
 !Array.isArray(officialRunners)||!officialRunners.length||officialRunners.length>24||
 incidentReview?.status!=='WHOLE_FIELD_INCIDENT_REVIEW'||
 !['SNAPSHOT_MATCHED','PARTIAL_SNAPSHOT_MATCH'].includes(deepHistory?.status)||
 deepHistory.race_date!==targetRace.raceDate||
 !Array.isArray(incidentReview.runners)||!Array.isArray(deepHistory.runner_history)||
 officialRunners.length!==incidentReview.runners.length||officialRunners.length!==deepHistory.runner_history.length||
 !Array.isArray(lapPackets))return reject('UNVERIFIED_FIELD');
 const nos=new Set(),ids=new Set(),byNo=new Map();
 for(const h of officialRunners){
  const id=officialHorseId(h.horse_ref);
  if(h.status!=='ACTIVE'||!validPos(h.horse_no)||!id||nos.has(h.horse_no)||ids.has(id))return reject('UNVERIFIED_ROSTER');
  nos.add(h.horse_no);ids.add(id);byNo.set(h.horse_no,id);
 }
 const index=rows=>new Map(rows.map(r=>[r.horse_no,r]));
 const inc=index(incidentReview.runners),deep=index(deepHistory.runner_history);
 if(inc.size!==nos.size||deep.size!==nos.size)return reject('DUPLICATE_RUNNER');
 const runners=[];
 for(const h of officialRunners){
  const i=inc.get(h.horse_no),d=deep.get(h.horse_no),id=byNo.get(h.horse_no);
  if(!i||i.horse_id!==id||!d||d.horse_name!==h.horse_name||
  !Array.isArray(i.history)||!Array.isArray(d.past_runs)||d.past_runs.length>5)return reject('RUNNER_MISMATCH');
  const seen=new Set();
  const reviews=d.past_runs.map((run,idx)=>{
   const key=officialRaceCore(run.historical_source_ref,'result');
   const unavailable=(reason)=>({run_index:idx,race_date:run.race_date,status:reason,score_effect:0,loss_cause:'UNPROVEN'});
   if(!key||run.deep_status!=='EXACT_CLAIM_LIVE_HISTORY_MATCH'||!(run.race_date<targetRace.raceDate)||
     key.slice(-8)!==run.race_date.replace(/-/g,''))return unavailable('PRIOR_IDENTITY_UNVERIFIED');
   if(seen.has(key))return unavailable('DUPLICATE_PRIOR_RACE');seen.add(key);
   const links=i.history.filter(x=>x.race_core===key&&x.race_date===run.race_date&&x.status==='VERIFIED_SOURCE_REVIEW');
   const link=links.length===1?links[0]:null;
   const sources=Array.isArray(link?.sources)?link.sources.filter(s=>['RESULT','REPORT'].includes(s.kind)&&officialRaceCore(s.source_ref,s.kind==='REPORT'?'report':'result')===key&&time(s.source_checked_at)!==null&&time(s.source_checked_at)<=now&&time(s.source_checked_at)<post):[];
   const incidentVerified=sources.length>0&&Array.isArray(link?.events);
   const events=(incidentVerified?link.events:[]).filter(e=>e.horse_id===id&&e.race_date===run.race_date&&e.certainty==='OFFICIAL_RECORDED_FACT'&&sources.some(s=>s.source_ref===e.source_ref&&s.source_checked_at===e.source_checked_at));
   const kinds=[...new Set(events.map(e=>e.kind))];
   const primary=events.some(e=>e.role==='VICTIM'&&['RESTRICTED_PATH','INTERFERENCE_VICTIM','OTHER_HORSE_IMPACT'].includes(e.kind));
   const secondary=events.some(e=>e.role==='VICTIM'&&e.kind==='ADDITIONAL_PATH_IMPACT');
   const self=events.some(e=>e.role==='SELF');
   const actor=events.some(e=>e.role==='ACTOR');
   const stopped=kinds.includes('RACE_STOPPED')||kinds.includes('HEALTH_INCIDENT');
   const positions=validPos(run.early_pos)&&validPos(run.final_turn_pos)?{early:run.early_pos,final_corner:run.final_turn_pos,gain_to_corner:run.early_pos-run.final_turn_pos,gain_after_corner:validPos(run.finish)?run.final_turn_pos-run.finish:null}:null;
   const sameLaps=lapPackets.filter(p=>officialRaceCore(p.source_ref,'result')===key);
   const lap=sameLaps.length===1?joinVerifiedJraCornerAndRaceLaps({targetRace,pastRun:run,officialRaceLaps:sameLaps[0],clock}):null;
   const matched=lap?.status==='EVIDENCE_ONLY_MATCHED'?lap.observation:null;
   const section=finite(run.final3f)&&run.final3f>=25&&run.final3f<=65?run.final3f:null;
   // No guessed winner gap, time loss, causal pace, or automatic ranking.
   const assessment=!incidentVerified?'INCIDENT_SOURCE_UNVERIFIED':stopped?'STOP_OR_HEALTH_REVIEW_NO_ABILITY_CREDIT':
    primary&&!self&&!actor?'EXTERNAL_PRIMARY_REVIEW':
    primary?'MIXED_EXTERNAL_AND_OWN_RISK_REVIEW':
    secondary?'SECONDARY_IMPACT_REVIEW':
    self||actor?'OWN_BEHAVIOR_OR_ACTOR_RISK_REVIEW':'NO_RECORDED_EVENT_IN_AVAILABLE_SOURCES';
   return {run_index:idx,race_date:run.race_date,race_core:key,status:incidentVerified?'VERIFIED_CONTENT_REVIEW':'INCIDENT_SOURCE_UNVERIFIED',assessment,incident_source_verified:incidentVerified,
    finish:validPos(run.finish)?run.finish:null,reported_margin:run.margin_source_value??run.margin_to_winner??null,margin_basis:run.margin_basis??'UNSPECIFIED',
    positions,runner_last_3f:section,race_lap_observation:matched,incident_kinds:kinds,incident_sources:sources,
    incomplete_incident_source:!incidentVerified||link?.partial===true,loss_cause:'UNPROVEN',time_loss_seconds:null,
    review_for_merit:incidentVerified&&primary&&!self&&!actor&&!stopped&&validPos(run.finish)&&run.finish>1&&(positions!==null||section!==null),
    auto_score_effect:0,absence_is_not_no_incident:true};
  });
  runners.push({horse_no:h.horse_no,horse_id:id,horse_name:h.horse_name,reviews,unmatched_incident_history:i.history.filter(x=>x.status!=='VERIFIED_SOURCE_REVIEW').length});
 }
 const rows=runners.flatMap(r=>r.reviews);
 return {status:'RESEARCH_WHOLE_FIELD_LOSS_REVIEW',runners,coverage:{active_runners:runners.length,supplied_runs:rows.length,joined_runs:rows.filter(x=>x.status==='VERIFIED_CONTENT_REVIEW').length,lap_joined_runs:rows.filter(x=>x.race_lap_observation).length,merit_review_runs:rows.filter(x=>x.review_for_merit).length},rank_effect:'NONE',market_used:false,target_result_used:false,prediction_saved:false};
}
