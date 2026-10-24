import {scoreLockedLive4Proxy} from "./lab-reborn-v04-live4-proxy.mjs";
import {resolvePriorRaceClass} from "./lab-reborn-v07-verified-prior-class.mjs";
/**
 * Pure research-only class-evidence overlay.
 *
 * The original 2024-trained coefficients are immutable; only historical
 * named race class labels are replaced when an exact, unique pretarget
 * archive runner+race identity proves the canonical class. No positional
 * finish of the TARGET race may be supplied. This overlay is post-hoc
 * when references were not frozen before the target race.
 *
 * THIS IS NOT COMPLETE REBORN 0.4/0.6 AND DOES NOT WRITE ANY DATABASE.
 */
export function compareVerifiedClassOverlay(lockedPacket,locked2024Model,archivePriorRows=[]){
 const fail=(reason)=>({status:"RESEARCH_OVERLAY_REJECTED",reason,
  production_write:false,target_results_used:false});
 const original=scoreLockedLive4Proxy(lockedPacket,locked2024Model);
 if(original.status!=="LIVE4_PROXY_ONLY_NO_FROZEN_V04_PREDICTION")
  return fail("BASE_"+(original.reason||original.status));
 if(!Array.isArray(archivePriorRows))return fail("INVALID_ARCHIVE");
 const src=lockedPacket?.payload??lockedPacket;
 const targetDate=original.race_date;
 const overlayRunners=[];
 let resolved=0,unmatched=0,direct=0,ineligible=0;
 const example=[];
 for(const horse of src.runners){
  const adaptedHistory=[];
  for(const run of horse.history){
   const verdict=resolvePriorRaceClass({
    target_date:targetDate,horse_code:horse.horse_code,
    run,evidence:archivePriorRows});
   if(verdict.status==="AMBIGUOUS_ARCHIVE"||verdict.status==="SOURCE_CLASS_CONFLICT")
    return fail("UNRESOLVED_IDENTITY_OR_CLASS_CONFLICT");
   if(verdict.status==="VERIFIED_RESOLVED"){
    resolved++;
    if(example.length<12)example.push({
     horse_no:horse.horse_no,horse_name:horse.horse_name,
     race_date:run.race_date,prior_label:run.race_class,
     verified_class:verdict.verified_class_name,
     archive_race_name:verdict.archive_race_name});
    adaptedHistory.push({...run,race_class:verdict.verified_class_name});
   }else{
    if(verdict.status==="UNKNOWN_NO_VERIFIED_ARCHIVE"||
       verdict.status==="ARCHIVE_CLASS_UNKNOWN")unmatched++;
    else if(verdict.status==="INELIGIBLE_PRIOR")ineligible++;
    else direct++;
    adaptedHistory.push({...run});
   }
  }
  overlayRunners.push({...horse,history:adaptedHistory});
 }
 const adaptedPacket={
  ...lockedPacket,
  payload:{...src,runners:overlayRunners}
 };
 const changed=scoreLockedLive4Proxy(adaptedPacket,locked2024Model);
 if(changed.status!==original.status)return fail("OVERLAY_SCORE_FAILURE");
 if(original.runners.length!==changed.runners.length)return fail("OVERLAY_ROSTER_CHANGE");
 const oldByNo=new Map(original.runners.map(r=>[r.horse_no,r]));
 const changes=changed.runners.map(r=>({
  horse_no:r.horse_no,horse_name:r.horse_name,
  base_rank:oldByNo.get(r.horse_no).proxy_rank,
  overlay_rank:r.proxy_rank,
  base_score:oldByNo.get(r.horse_no).proxy_score,
  overlay_score:r.proxy_score,
  changed_signals:r.signals.filter(x=>!oldByNo.get(r.horse_no).signals.includes(x)),
  rank_changed:r.proxy_rank!==oldByNo.get(r.horse_no).proxy_rank
 }));
 return {
   status:"POST_HOC_CLASS_PROVENANCE_DIAGNOSTIC_ONLY",
   model:"LAB_REBORN_V07_CLASS_OVERLAY_LIVE4_NOT_FULL_V04_V06",
   race_date:targetDate,track:original.track,race_no:original.race_no,
   prestart_input_locked_at:original.source_saved_at,
   original_prestart_rank_snapshot_modified:false,
   baseline_top5:original.top5.map(x=>x.horse_no),
   overlay_top5:changed.top5.map(x=>x.horse_no),
   resolved_prior_named_runs:resolved,unknown_named_runs:unmatched,
   direct_class_runs:direct,not_classifiable_runs:ineligible,
   example_verified_matches:example,
   changes,production_write:false,no_weight_retraining:true,
   target_results_used:false,odds_used:false,
   prospective_rank_snapshot:false,
   reference_archive_may_be_fetched_after_race:true
 };
}
