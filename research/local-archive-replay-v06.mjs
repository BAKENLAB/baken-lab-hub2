/**
 * Exploratory archival replay ONLY. Never imported by CLAIM, SAVE or FROZEN.
 * Historical horse-name matches cannot prove identity or capture-time as-of;
 * the race course metadata is drawn from a post-race official result. Therefore
 * no replay output is eligible for certified pre-race model metrics.
 */
import {buildRelativeAbilityRankProposal} from '../automation/relative-ability-rank-proposal.mjs';
const CERT='RETROSPECTIVE_ARCHIVE_UNVERIFIED_NOT_PRERACE';
const validDate=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x);
const iso=x=>typeof x==='string'?x.replace(' ','T').replace(/([+-]\d\d)$/,'$1:00'):null;
const num=(x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const skip=(reason,base=[])=>({
 certification:CERT,eligible_for_official_metrics:false,status:'SKIPPED',
 reason,baseline_top5:base.slice(0,5).map(x=>x.horse_no),
 shadow_top5:null,retrospective_newly_captured:null,
 retrospective_lost_captured:null,certified_improvements:0
});
export function replayArchivedLocalRace(row,{evaluator=buildRelativeAbilityRankProposal}={}){
 if(!row||!validDate(row.race_date)||typeof row.track!=='string')return skip('BAD_RACE');
 const entries=(Array.isArray(row.runners)?row.runners:[]).slice().sort((a,b)=>a.rank-b.rank);
 const base=entries.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name,rank:x.rank}));
 if(base.length<6||base.length>20||new Set(base.map(x=>x.horse_no)).size!==base.length||
    base.some((x,i)=>!num(x.horse_no,1,24)||x.rank!==i+1||
      typeof x.horse_name!=='string'||!x.horse_name))
   return skip('INCOMPLETE_FROZEN_BASELINE',base);
 const history=entries.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name,
  supporting_runs:(Array.isArray(x.history)?x.history:[]).map(h=>({
   date:h.date,track:h.track,class:h.class,finish:h.finish,
   surface:h.surface,distance:h.distance,
   early_pos:Number.isInteger(h.early_pos)?h.early_pos:null,
   final_turn_pos:Number.isInteger(h.final_turn_pos)?h.final_turn_pos:null,
   // Raw NAR margins cannot be treated as winner-relative.
   margin:null
  }))}));
 if(history.some(x=>x.supporting_runs.length>12))return skip('EXCESS_HISTORY',base);
 if(history.some(x=>x.supporting_runs.some(h=>!validDate(h.date)||h.date>=row.race_date)))
   return skip('FUTURE_OR_INVALID_HISTORY',base);
 const post=iso(row.post_time),frozen=iso(row.frozen_at);
 if(!post||!frozen||!Number.isFinite(Date.parse(post))||
    !Number.isFinite(Date.parse(frozen))||Date.parse(frozen)>=Date.parse(post))
   return skip('NOT_VERIFIED_FROZEN_BEFORE_POST',base);
 const course=row.retrospective_course_metadata??row.metadata;
 if(!num(course?.distance,800,3600)||typeof course?.surface!=='string')
   return skip('POSTRACE_COURSE_METADATA_MISSING',base);
 // Pure scorer compatibility shim: this is NOT claimed-context provenance.
 // The final result is explicitly NON-CERTIFIED and must never be sealed.
 const comparison={status:'READY',target_date:row.race_date,
  runner_evidence:history,market_used:false,target_result_used:false,
  rank_effect:false,data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY'};
 const race={race_date:row.race_date,post_time:post,observation_at:frozen,
  circuit:'LOCAL',track:row.track,race_name:row.race_name,
  class_name:row.race_name,surface:course.surface,distance:course.distance};
 const before=JSON.stringify({row,race,base,history});
 const attempt=evaluator({race,baseline:base,comparison});
 if(before!==JSON.stringify({row,race,base,history}))
   return skip('SCORER_MUTATED_ARCHIVE_INPUT',base);
 if(!attempt||!['REORDERED','UNCHANGED'].includes(attempt.status))
   return skip('MODEL_REJECTED_'+(attempt?.status||'UNKNOWN'),base);
 const oldTop=base.slice(0,5).map(x=>x.horse_no),newTop=attempt.top5;
 if(!Array.isArray(newTop)||newTop.length!==5)
   return skip('INVALID_SHADOW_TOP5',base);
 const added=newTop.filter(x=>!oldTop.includes(x));
 const removed=oldTop.filter(x=>!newTop.includes(x));
 const podium=(row.retrospective_finishers??row.finishers??[]).filter(x=>num(x.finish,1,3))
   .sort((a,b)=>a.finish-b.finish).map(x=>x.horse_no);
 const comparable=podium.length===3;
 return {certification:CERT,eligible_for_official_metrics:false,
  status:attempt.status,model_version:attempt.model_version,
  baseline_top5:oldTop,shadow_top5:[...newTop],
  retrospective_baseline_podium:comparable?podium.filter(x=>oldTop.includes(x)).length:null,
  retrospective_shadow_podium:comparable?podium.filter(x=>newTop.includes(x)).length:null,
  retrospective_newly_captured:comparable?podium.filter(x=>added.includes(x)).length:null,
  retrospective_lost_captured:comparable?podium.filter(x=>removed.includes(x)).length:null,
  archived_horse_count:history.filter(x=>x.supporting_runs.length>0).length,
  archived_corner_horse_count:history.filter(x=>x.supporting_runs.some(h=>
   h.early_pos!==null&&h.final_turn_pos!==null)).length,
  claim_started:false,official_frozen_modified:false,certified_improvements:0
 };
}
export function summarizeArchivedLocalReplays(rows,opts={}){
 if(!Array.isArray(rows))throw new TypeError('ARRAY_REQUIRED');
 const reports=rows.map(x=>replayArchivedLocalRace(x,opts));
 const used=reports.filter(x=>x.status==='REORDERED'||x.status==='UNCHANGED');
 const observed=used.filter(x=>x.retrospective_newly_captured!==null);
 return {certification:CERT,eligible_for_official_metrics:false,
  total:rows.length,model_evaluable:used.length,
  model_reordered:used.filter(x=>x.status==='REORDERED').length,
  skipped:rows.length-used.length,
  retrospective_baseline_podium:observed.reduce((s,x)=>s+x.retrospective_baseline_podium,0),
  retrospective_shadow_podium:observed.reduce((s,x)=>s+x.retrospective_shadow_podium,0),
  retrospective_newly_captured:observed.reduce((s,x)=>s+x.retrospective_newly_captured,0),
  retrospective_lost_captured:observed.reduce((s,x)=>s+x.retrospective_lost_captured,0),
  certified_improvements:0,
  skipped_reasons:reports.filter(x=>x.status==='SKIPPED').reduce((a,x)=>{
   a[x.reason]=(a[x.reason]||0)+1;return a;},{}),
  reports};
}
