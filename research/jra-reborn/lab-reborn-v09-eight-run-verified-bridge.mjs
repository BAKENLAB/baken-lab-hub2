import {buildRebornV03} from "./lab-reborn-v03.mjs";
import {auditUnifiedRebornReadiness} from "./lab-reborn-v08-unified-readiness-gate.mjs";

/**
 * REBORN v0.9 — verified as-of research history enrichment, not final model.
 *
 * Feed frozen prestart LIVE4 packet and separately-sourced pretarget JRA archive
 * rows. Never query actual target results, odds, old LAB ranks or post-target
 * opponent results. Never write predictions. Complete 8-run claims require
 * explicit archive verification of each of the four live completed prior runs
 * plus four earlier *distinct* actual runs: four career starts != four missing.
 * Missing archive data is UNKNOWN, not zero ability.
 */
const dateOK=s=>typeof s==="string"&&/^20\d\d-\d\d-\d\d$/.test(s);
const int=x=>x===null||x===undefined||x===""||!Number.isInteger(Number(x))?null:+x;
const number=x=>x===null||x===undefined||x===""||!Number.isFinite(Number(x))?null:+x;
const raceKey=v=>[v.race_date,v.track,+v.race_no].join("|");
export function enrichLockedRebornHistory(snapshot, archiveRows=[]){
 const bad=reason=>({status:"RESEARCH_ENRICHMENT_REJECTED",reason,
  production_write:false,completed_eight_verified:false});
 const p=snapshot?.payload??snapshot;
 const race_date=snapshot?.race_date??p?.race_date;
 const track=snapshot?.track??p?.track, race_no=int(snapshot?.race_no??p?.race_no);
 const saved=snapshot?.saved_at??p?.saved_at,post=snapshot?.source_post_time??p?.source_post_time;
 if(!p||!dateOK(race_date)||!track||!race_no||race_no<1||race_no>12||
    !["芝","ダート"].includes(p.surface)||number(p.distance)===null||
    !Array.isArray(p.runners)||p.runners.length<6||
    p.runners.length!==int(p.field_size)||!Array.isArray(archiveRows)||
    !saved||!post||!(Date.parse(saved)<Date.parse(post)))return bad("INVALID_SOURCE_OR_SNAPSHOT");
 const names=new Set(),codes=new Set(),nums=new Set();
 for(const h of p.runners){
  if(!h||!int(h.horse_no)||!/^\d{10}$/.test(String(h.horse_code))||
     !h.horse_name||!Array.isArray(h.history)||
     names.has(h.horse_name)||codes.has(h.horse_code)||nums.has(+h.horse_no))
     return bad("BAD_FIELD_IDENTITY");
  names.add(h.horse_name);codes.add(h.horse_code);nums.add(+h.horse_no);
  if(h.history.some(v=>!dateOK(v.race_date)||v.race_date>=race_date))
    return bad("FUTURE_OR_INVALID_HISTORY_IN_SNAPSHOT");
 }
 const used=new Set(),validated=[];
 for(const a of archiveRows){
  if(a?.source!=="JRA_LAB_ARCHIVE"||a.record_role!=="full_runner"||
   !/^\d{10}$/.test(String(a.horse_code))||!codes.has(a.horse_code)||
   !dateOK(a.race_date)||a.race_date>=race_date||
   !a.track||!int(a.race_no)||int(a.race_no)<1||int(a.race_no)>12||
   !["芝","ダート"].includes(a.surface)||
   number(a.distance)===null||int(a.finish)===null||int(a.finish)<=0||
   typeof a.class_name!=="string"||typeof a.race_name!=="string"||
   typeof a.horse_name!=="string")
    return bad("UNVERIFIED_OR_NON_PRIOR_ARCHIVE_ROW");
  const k=a.horse_code+"|"+raceKey(a);
  if(used.has(k))return bad("DUPLICATE_ARCHIVE_EVENT");
  used.add(k);
  validated.push(a);
 }
 const byCode=new Map();
 for(const a of validated){
  if(!byCode.has(a.horse_code))byCode.set(a.horse_code,[]);
  byCode.get(a.horse_code).push(a);
 }
 const recent=[];
 const older=[];
 const status=[];
 for(const h of p.runners){
  const aRows=byCode.get(h.horse_code)??[];
  // The CODE is the primary key, but conflicting names are not silently ignored.
  if(aRows.some(a=>a.horse_name!==h.horse_name))return bad("ARCHIVE_HORSE_IDENTITY_MISMATCH");
  const dated=[...h.history].sort((a,b)=>b.race_date.localeCompare(a.race_date));
  const oldest=dated.length?dated[dated.length-1].race_date:null;
  let verifiedRecent=0,unverifiedRecent=0;
  const frozenRecent=dated.filter(x=>int(x.finish)!==null&&int(x.finish)>0);
  const recentContent=[];
  for(const run of dated){
   const matches=aRows.filter(a=>
    a.race_date===run.race_date&&a.track===run.track&&
    a.surface===run.surface&&+a.distance===number(run.distance)&&
    int(run.finish)===int(a.finish));
   if(matches.length>1)return bad("AMBIGUOUS_RECENT_ARCHIVE");
   const proof=matches.length===1?matches[0]:null;
   if(int(run.finish)!==null&&int(run.finish)>0){
     if(proof)verifiedRecent++; else unverifiedRecent++;
   }
   // If archive metadata disagrees with frozen live class, favor neither
   // without conflict alert. Named labels can differ but explicit class
   // labels that conflict must be resolved upstream.
   const prevClass=run.race_class??null;
   const exactClass=proof?.class_name??null;
   const explicit=x=>/^(?:牝)?[123]勝クラス$|未勝利|新馬|オープン/.test(x||"");
   if(proof&&explicit(prevClass)&&explicit(exactClass)&&
     prevClass!==exactClass&&
     !prevClass.endsWith(exactClass))
      return bad("RECENT_CLASS_CONFLICT");
   recentContent.push({
    prior_date:run.race_date,prior_track:run.track,
    prior_surface:run.surface,prior_distance:run.distance,
    prior_class:proof?.class_name??prevClass,
    race_name:proof?.race_name??prevClass,
    finish:run.finish,margin_to_winner:run.margin_to_winner,
    field_size:run.field_size,
    corner_positions:run.corner_positions,
    final3f:run.final3f,
    final3f_rank:proof?.final3f_rank??null,
    final3f_source:proof&&int(proof.final3f_rank)!==null?"VERIFIED_ARCHIVE":"UNVERIFIED",
    source_kind:proof?"PRETARGET_LIVE_ARCHIVE_CROSSCHECK":"LOCKED_LIVE_UNCROSSCHECKED"
   });
  }
  // Don't fill between-frozen gaps: these are older than earliest frozen
  // source dated event, even if that event is a cancellation/transfer.
  const olderMatches=oldest?aRows.filter(a=>a.race_date<oldest):[];
  olderMatches.sort((a,b)=>b.race_date.localeCompare(a.race_date)||b.race_no-a.race_no);
  const old4=olderMatches.slice(0,4);
  recent.push({horse_no:+h.horse_no,horse_name:h.horse_name,
    past_race_content:recentContent,opponent_followups:[]});
  older.push({horse_no:+h.horse_no,horse_name:h.horse_name,
    older_same_surface_near_distance:old4.map(a=>({
      date:a.race_date,track:a.track,race_name:a.race_name,class_name:a.class_name,
      surface:a.surface,distance:a.distance,finish:a.finish,field_size:a.field_size,
      final3f_rank:a.final3f_rank??null,final3f:a.final3f??null,
      corners:a.corner_positions??null,
      provenance:"JRA_LAB_ARCHIVE_BEFORE_FROZEN_HISTORY",
      // Archive margin is to preceding horse, NOT winner gap. Never
      // derive seconds-behind-winner from this archival text.
      gap_behind_winner:null
    }))});
  status.push({horse_no:+h.horse_no,horse_name:h.horse_name,
    frozen_finished:frozenRecent.length,
    verified_recent:verifiedRecent,
    unverified_recent:unverifiedRecent,
    older_available:olderMatches.length,
    older_appended:old4.length,
    strict_eight_verified:frozenRecent.length===4&&verifiedRecent===4&&old4.length===4,
    past_archive_gap:unverifiedRecent>0,
    missing_older:Math.max(0,4-old4.length)});
 }
 const fiveAxis=buildRebornV03({
  race_date,track,race_no,recent_evidence:{runners:recent},
  older_same_course_evidence:older
 },{date:race_date,track,raceNo:race_no,raceName:p.race_name,
    className:p.class_name,surface:p.surface,distance:+p.distance});
 const readiness=auditUnifiedRebornReadiness({sourceLock:snapshot,fiveAxisOutput:fiveAxis});
 return {
  status:"RESEARCH_ENRICHED_SOURCE_DIAGNOSTIC",
  version:"LAB_REBORN_V09_VERIFIED_EIGHT_RUN_EVIDENCE",
  race_date,track,race_no,
  frozen_source_saved_at:saved,
  result_data_used:false,
  original_prestart_frozen_modified:false,
  fully_integrated:false,
  completed_eight_verified:status.every(x=>x.strict_eight_verified),
  runner_count:status.length,
  strictly_eight_verified_horses:status.filter(x=>x.strict_eight_verified).length,
  recent_verified_total:status.reduce((n,x)=>n+x.verified_recent,0),
  missing_live_archive_total:status.reduce((n,x)=>n+x.unverified_recent,0),
  older_attached_total:status.reduce((n,x)=>n+x.older_appended,0),
  five_axis_status:fiveAxis.status,
  axes_present:readiness.evidence_coverage.axis_counts,
  complete_model_ready:readiness.comparison_as_full_reborn_allowed,
  missing_integration:readiness.failures.map(x=>x.gate),
  runner_status:status,
  // Incomplete v03 axis diagnostic is not a scored forecast or TOP5.
  potential_ranks_not_reported:true,
  production_write:false,
  target_results_used:false,odds_used:false,old_lab_used:false
 };
}
