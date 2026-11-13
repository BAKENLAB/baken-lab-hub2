/**
 * Research-only LOCAL CLAIM context overlay. No sources are fetched here.
 * Inputs: authenticated finalContext's verified, unredacted runner witnesses,
 * its compact output runners, and a separately authorized pre-CLAIM packet.
 * The existing ranked input remains unchanged: result is shadow-only.
 */
import {bridgeLocalOfficialCorners} from './local-corner-pace-bridge.mjs';
import {buildLocalFieldPaceEvidence} from './local-field-pace.mjs';
import {buildLocalRelativeConditionComparison} from './local-relative-condition-comparison.mjs';
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const raceKey=r=>[String(r.race_date),r.track,Number(r.race_no)].join('/');
const copy=o=>structuredClone(o);
export function buildLocalClaimedCornerShadow({
 targetRace,verifiedRunners,compactRunners,cornerPacket,conditions={},clock=()=>Date.now()
}){
 if(!Array.isArray(verifiedRunners)||!Array.isArray(compactRunners)||
    verifiedRunners.length!==compactRunners.length||verifiedRunners.length<1)
   throw new TypeError('CLAIM_ROSTER_MISMATCH');
 const compactByNo=new Map(compactRunners.map(r=>[r.horse_no,r]));
 if(compactByNo.size!==compactRunners.length||verifiedRunners.some(r=>
   !compactByNo.has(r.horse_no)||
   norm(r.horse_name)!==norm(compactByNo.get(r.horse_no).horse_name)))
   throw new TypeError('CLAIM_ROSTER_MISMATCH');
 const enriched=bridgeLocalOfficialCorners({
  targetRace,officialRunners:verifiedRunners,cornerPacket,conditions,clock
 });
 const shadowRunners=copy(compactRunners);
 const verifiedByNo=new Map(enriched.runners.map(r=>[r.horse_no,r]));
 const audits=[];
 let inserted=0;
 for(const runner of shadowRunners){
  const rich=verifiedByNo.get(runner.horse_no);
  if(!Array.isArray(runner.recent_runs)||!Array.isArray(rich?.recent_runs))
   throw new TypeError('CLAIM_RUNS_MISSING');
  for(const h of runner.recent_runs){
   const matches=rich.recent_runs.filter(x=>raceKey(x)===raceKey(h));
   if(matches.length!==1)continue;
   const full=matches[0];
   // Only corner facts may be overlaid, never finish/class/market/identity.
   for(const field of ['early_pos','final_turn_pos']){
    if(h[field]===null||h[field]===undefined){
     if(Number.isInteger(full[field])&&full[field]>=1&&full[field]<=24){
      h[field]=full[field];inserted++;
     }
    }else if(full[field]!=null&&full[field]!==h[field]){
     throw new TypeError('CORE_POSITION_MISMATCH');
    }
   }
  }
 }
 const pace=buildLocalFieldPaceEvidence(shadowRunners,conditions);
 // Official pre-CLAIM corners can enrich research comparison facts only.
 // Preserve original claimed/saved inputs and never declare the displayed
 // corner history to be a validated lap, a winner-relative margin or a score.
 const compared=enriched.applied>0
   ?buildLocalRelativeConditionComparison(
      shadowRunners,conditions,targetRace.raceDate)
   :null;
 const researchRelativeComparison=compared?.status==='READY'&&
   compared.runner_count===shadowRunners.length&&
   compared.rank_effect===false&&compared.market_used===false&&
   compared.target_result_used===false?
    {...compared,corner_evidence_scope:'VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY',
      corner_enriched_prior_runs:enriched.applied,
      scoring_effect:0}:null;
 for(const item of enriched.reports)audits.push(item);
 // Only the adapter-confirmed past results become cited witnesses. Rejected,
 // conflicting, stale and already-covered rows never receive source provenance.
 const acceptedKeys=new Set(enriched.reports
  .filter(r=>r.reason==='OFFICIAL_CORNERS_ADDED')
  .map(r=>[r.horseNo,r.pastRace?.raceDate,r.pastRace?.track,Number(r.pastRace?.raceNo)].join('/')));
 const verifiedCornerSources=(Array.isArray(cornerPacket?.evidence)?cornerPacket.evidence:[])
  .filter(e=>acceptedKeys.has([e.horseNo,e.pastRace?.raceDate,e.pastRace?.track,Number(e.pastRace?.raceNo)].join('/')))
  .map(e=>({
   current_horse_no:e.horseNo,horse_name:norm(e.horseName),
   past_race:{race_date:e.pastRace.raceDate,track:e.pastRace.track,
    race_no:Number(e.pastRace.raceNo)},past_horse_no:e.pastHorseNo,
   early_pos:e.earlyPos,final_turn_pos:e.finalTurnPos,
   official_source_ref:e.sourceRef,source_checked_at:e.sourceCheckedAt,
   identity_verified_by:e.identityVerifiedBy,
   verification_scope:'PRECLAIM_OFFICIAL_PAST_RESULT',
   rank_effect:'NONE_UNTIL_REVIEWED'
  }))
  .sort((a,b)=>a.current_horse_no-b.current_horse_no||
   b.past_race.race_date.localeCompare(a.past_race.race_date)||
   a.past_race.race_no-b.past_race.race_no);
 if(acceptedKeys.size!==enriched.applied||verifiedCornerSources.length!==enriched.applied)
  throw new TypeError('CORNER_SOURCE_PROVENANCE_MISMATCH');
 // An independently checked official past-result witness must point to
 // EXACTLY one compact historical race. No positional facts are promoted
 // by trusting a generic "corner_enriched_prior_runs" count alone.
 const verifiedCornerWitnesses=verifiedCornerSources.map(e=>{
  const horse=shadowRunners.find(r=>r.horse_no===e.current_horse_no&&
    norm(r.horse_name)===e.horse_name);
  const matches=(horse?.recent_runs??[]).map((run,i)=>({run,i}))
   .filter(x=>raceKey(x.run)===
     [e.past_race.race_date,e.past_race.track,e.past_race.race_no].join('/'));
  if(matches.length!==1||matches[0].run.early_pos!==e.early_pos||
     matches[0].run.final_turn_pos!==e.final_turn_pos)
    throw new TypeError('CORNER_WITNESS_COMPACT_RUN_MISMATCH');
  return {
   horse_no:e.current_horse_no,horse_name:e.horse_name,
   evidence_ref:'COMPACT_V1.runners[horse_no='+e.current_horse_no+
     '].recent_runs['+matches[0].i+']',
   race_date:e.past_race.race_date,track:e.past_race.track,
   race_no:e.past_race.race_no,
   early_pos:e.early_pos,final_turn_pos:e.final_turn_pos,
   official_source_ref:e.official_source_ref,
   source_checked_at:e.source_checked_at,
   verification_scope:'VERIFIED_PRECLAIM_OFFICIAL_PAST_RESULT'
  };
 });
 if(verifiedCornerWitnesses.length!==enriched.applied||
    new Set(verifiedCornerWitnesses.map(x=>x.evidence_ref)).size!==enriched.applied)
  throw new TypeError('CORNER_WITNESS_IDENTITY_OR_COUNT_MISMATCH');
 const researchWithExactWitnesses=researchRelativeComparison?
   {...researchRelativeComparison,verified_corner_witnesses:verifiedCornerWitnesses}:null;
 return {
  status:enriched.status,source:'NAR_OFFICIAL_PRECLAIM_CORNERS',
  use_for_rank:false,use_for_save_gate:false,market_used:false,
  race:{race_date:targetRace.raceDate,track:targetRace.track,
   race_no:Number(targetRace.raceNo)},
  applied_prior_runs:enriched.applied,ignored_prior_runs:enriched.ignored,
  inserted_corner_fields:inserted,verified_corner_sources:verifiedCornerSources,
  field_pace_evidence:pace,
  // Separate research-only lane; not passed to production ability scorer.
  research_relative_condition_evidence:researchWithExactWitnesses,
  runners:shadowRunners,reports:audits
 };
}
