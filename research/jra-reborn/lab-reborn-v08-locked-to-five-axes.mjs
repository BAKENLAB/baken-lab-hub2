import {buildRebornV03} from "./lab-reborn-v03.mjs";
import {resolvePriorRaceClass} from "./lab-reborn-v07-verified-prior-class.mjs";
import {auditUnifiedRebornReadiness} from "./lab-reborn-v08-unified-readiness-gate.mjs";
/**
 * First tangible bridge for rebuilding intended REBORN:
 * formerly immutable input-only race packets -> ACTUAL v03 five-axis evaluator,
 * with only verified historical prior-class replacements.
 *
 * THIS IS SUBSET INPUT, not v0.3G/v04/v05/v06 integration. It intentionally
 * supplies no imaginary opponent follow-ups, older 5-8 runs, final3f rank,
 * pace-normalized times, or validated rank corrections. It cannot produce a
 * prospective complete integrated REBORN prediction from these inputs.
 *
 * No official LAB rank, odds, actual TARGET result, or production DB access.
 */
export function evaluateFiveAxisSourceBridge(snapshot,{verifiedPriorClassEvidence=[]}={}){
 const fail=(reason)=>({status:"BRIDGE_REJECTED",reason,
  publication_ready:false,comparison_as_full_reborn_allowed:false,
  production_write:false,target_results_used:false,odds_used:false});
 if(!snapshot||!Array.isArray(verifiedPriorClassEvidence))return fail("INVALID_SOURCE");
 const p=snapshot.payload??snapshot;
 const race_date=snapshot.race_date??p.race_date,
  track=snapshot.track??p.track,
  race_no=snapshot.race_no??p.race_no,
  sourcePost=snapshot.source_post_time??p.source_post_time,
  saved=snapshot.saved_at??p.saved_at;
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(String(race_date))||
  typeof saved!=="string"||typeof sourcePost!=="string"||
  !(Date.parse(saved)<Date.parse(sourcePost))||
  !["芝","ダート"].includes(p.surface)||
  !Number.isFinite(+p.distance)||!Number.isInteger(+race_no)||
  !Array.isArray(p.runners)||p.runners.length<6||
  p.runners.length!==Number(p.field_size))return fail("INVALID_OR_LATE_SNAPSHOT");
 const numbers=new Set();
 let confirmed_prior_classes=0,unresolved_named_classes=0;
 const recent=[];
 for(const h of p.runners){
  if(!Number.isInteger(+h.horse_no)||numbers.has(+h.horse_no)||
    typeof h.horse_name!=="string"||
    !/^\d{10}$/.test(String(h.horse_code??""))||
    !Array.isArray(h.history))return fail("INVALID_RUNNER_IDENTITIES");
  numbers.add(+h.horse_no);
  const past=[];
  for(const r of h.history){
   if(typeof r.race_date!=="string"||r.race_date>=race_date||
    !/^20\d{2}-\d{2}-\d{2}$/.test(r.race_date))
      return fail("NON_PRIOR_HISTORY");
   const level=resolvePriorRaceClass({
     target_date:race_date,horse_code:h.horse_code,run:r,
     evidence:verifiedPriorClassEvidence});
   if(["SOURCE_CLASS_CONFLICT","AMBIGUOUS_ARCHIVE"].includes(level.status))
      return fail(level.status);
   if(level.status==="VERIFIED_RESOLVED")confirmed_prior_classes++;
   if(level.status==="UNKNOWN_NO_VERIFIED_ARCHIVE")unresolved_named_classes++;
   past.push({
    prior_date:r.race_date,prior_track:r.track,
    prior_surface:r.surface,prior_distance:r.distance,
    prior_class:level.status==="VERIFIED_RESOLVED"?
       level.verified_class_name:r.race_class,
    race_name:r.race_class,finish:r.finish,
    margin_to_winner:r.margin_to_winner,
    field_size:r.field_size,
    corner_positions:r.corner_positions,
    // Timestamp/section time is NOT an independently verified relative rank.
    final3f_rank:null,final3f_source:"NOT_VERIFIED",
    source_kind:"LOCKED_PRESTART_INPUT",
    verified_class_source:level.source??null
   });
  }
  recent.push({horse_no:+h.horse_no,horse_name:h.horse_name,
     past_race_content:past,
     opponent_followups:[]});
 }
 const packet={
   race_date,track,race_no,
   recent_evidence:{runners:recent},
   older_same_course_evidence:recent.map(h=>({
     horse_no:h.horse_no,horse_name:h.horse_name,
     older_same_surface_near_distance:[]
   }))
 };
 const ctx={date:race_date,track,raceNo:race_no,
   raceName:p.race_name,className:p.class_name,
   surface:p.surface,distance:+p.distance};
 const actualFiveAxis=buildRebornV03(packet,ctx);
 const gate=auditUnifiedRebornReadiness({
  sourceLock:snapshot,fiveAxisOutput:actualFiveAxis});
 return {
   status:"RESEARCH_SOURCE_BRIDGE_ONLY",
   target:{race_date,track,race_no},
   source_saved_at:saved,source_post_time:sourcePost,
   historical_classes_verified:confirmed_prior_classes,
   historical_named_classes_unknown:unresolved_named_classes,
   evaluated_five_axis_status:actualFiveAxis.status,
   evaluated_runner_count:actualFiveAxis.runners.length,
   usable_scored_horses:actualFiveAxis.runners.filter(x=>x.score!==null).length,
   five_axis_evidence_counts:gate.evidence_coverage.axis_counts,
   missing_integration:gate.failures.map(x=>x.gate),
   // Diagnostic, not releaseable TOP5. Don't expose as prediction.
   research_runner_diagnostics:actualFiveAxis.runners.map(x=>({
     horse_no:x.horse_no,horse_name:x.horse_name,
     axis_evidence_coverage:x.evidence_coverage,
     axis_scores:x.axes,data_warnings:x.data_warnings
   })),
   publication_ready:false,comparison_as_full_reborn_allowed:false,
   live4_proxy_used_as_five_axes:false,old_lab_used:false,
   target_results_used:false,odds_used:false,
   production_write:false
 };
}
