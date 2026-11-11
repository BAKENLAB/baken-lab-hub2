/**
 * LOCAL 1.6: positive-factor DISCOVERY completeness audit (read-only shadow).
 * Operates only on an already VERIFIED official pre-race CLAIM context.
 * No automatic LAB EYE promotion, no score/rank, and no FROZEN/CLAIM changes.
 *
 * Why: 2026-11-09 had 253 TOP5 outsiders, but recorded positive factors
 * appeared for only one runner.  An empty saved factor array does not prove
 * the absence of independently verifiable positive evidence.
 */
import {
  resolveLocalHistoricalSurface,resolveLocalOfficialClassLiteral
} from './local-verified-condition-bridge.mjs';

const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'));
const no=x=>Number.isInteger(x)&&x>=1&&x<=24;
const officialNum=x=>typeof x==='number'&&Number.isFinite(x)?x:
  typeof x==='string'&&/^\d+(?:\.\d+)?$/.test(x.trim())?Number(x):null;
const stop=reason=>({
 status:'UNVERIFIED',reason,model:'LOCAL1.6_FACTOR_COVERAGE_SHADOW',
 rank_effect:false,eye_selection_effect:false,save_gate_effect:false,
 market_used:false,target_result_used:false,runner_reports:[]
});

export function auditLocalEyePositiveFactorCoverage({
 race,verifiedRunners,baseline,eyePositiveFactorAudit=[]
}={}) {
 if(!date(race?.race_date)||!Number.isFinite(Date.parse(race?.observation_at))||
    race.observation_at.slice(0,10)!==race.race_date||
    !Number.isFinite(Date.parse(race?.post_time))||
    Date.parse(race.observation_at)>=Date.parse(race.post_time)||
    !no(race.race_no)||!norm(race.track)||!norm(race.surface)||
    !Number.isInteger(race.distance)||race.distance<800||race.distance>3600||
    !race.official_context_verified)
   return stop('VERIFIED_PRE_RACE_CONTEXT_REQUIRED');
 if(race.result!==undefined||race.finishers!==undefined||
    !Array.isArray(verifiedRunners)||verifiedRunners.length<6||
    verifiedRunners.length>20||!Array.isArray(baseline)||
    baseline.length!==verifiedRunners.length||
    !Array.isArray(eyePositiveFactorAudit))
   return stop('SCOPE_OR_ROSTER_INVALID');
 const names=new Map();
 for(const r of verifiedRunners){
  if(!no(r?.horse_no)||!norm(r.horse_name)||r.status!=='ACTIVE'||
     names.has(r.horse_no)||!Array.isArray(r.recent_runs)||
     r.recent_runs.length>5)return stop('OFFICIAL_RUNNER_IDENTITY_INVALID');
  names.set(r.horse_no,norm(r.horse_name));
  for(const h of r.recent_runs){
   if(!date(h?.race_date)||h.race_date>=race.race_date)
     return stop('HISTORICAL_ASOF_OR_DATE_INVALID');
  }
 }
 const ranked=new Set(),seenNos=new Set();
 for(const x of baseline){
  if(!no(x?.horse_no)||!names.has(x.horse_no)||
     norm(x.horse_name)!==names.get(x.horse_no)||
     !Number.isInteger(x.rank)||x.rank<1||x.rank>baseline.length||
     ranked.has(x.rank)||seenNos.has(x.horse_no)||
     ['popularity','win_odds','odds','result','finishers'].some(k=>Object.hasOwn(x,k)))
    return stop('BASELINE_FULL_FIELD_INVALID');
  ranked.add(x.rank);seenNos.add(x.horse_no);
 }
 if(ranked.size!==baseline.length)return stop('BASELINE_RANKS_GAPPED');
 const existing=new Map();
 for(const entry of eyePositiveFactorAudit){
  if(!no(entry?.horse_no)||existing.has(entry.horse_no)||
     !Array.isArray(entry.positive_factors))return stop('EYE_FACTOR_AUDIT_MALFORMED');
  existing.set(entry.horse_no,entry.positive_factors);
 }
 const dateMs=Date.parse(race.race_date+'T00:00:00Z');
 const targetClass=resolveLocalOfficialClassLiteral(race.class_name??race.race_name).class_label;
 const outer=baseline.filter(x=>x.rank>5).sort((a,b)=>a.rank-b.rank);
 const runnerByNo=new Map(verifiedRunners.map(x=>[x.horse_no,x]));
 const reports=outer.map(x=>{
  const input=runnerByNo.get(x.horse_no);
  const discovered=[];
  let ignoredNoSurface=0,nonMatchingClass=0,negativeRuns=0;
  for(let i=0;i<input.recent_runs.length;i++){
   const h=input.recent_runs[i];
   const age=(dateMs-Date.parse(h.race_date+'T00:00:00Z'))/86400000;
   if(age<0||age>180)continue;
   const histSurface=resolveLocalHistoricalSurface(h).surface;
   if(histSurface===null){ignoredNoSurface++;continue;}
   if(histSurface!==race.surface)continue;
   const dist=officialNum(h.distance),finish=officialNum(h.finish);
   if(!Number.isInteger(dist)||dist<800||dist>3600||
      !Number.isInteger(finish)||finish<1||finish>24)continue;
   if(finish>=8)negativeRuns++;
   if(norm(h.track)!==norm(race.track))continue;
   const exact=dist===race.distance;
   const closeDistance=Math.abs(dist-race.distance)<=200;
   const hclass=resolveLocalOfficialClassLiteral(h.race_class??h.class_name??h.race_name).class_label;
   if(targetClass&&hclass!==targetClass)nonMatchingClass++;
   if(![1,2,3].includes(finish))continue;
   // Each run can contribute at most ONE category. Distinct factors must
   // stem from distinct official race entries, never a cloned evidence ref.
   const type=exact?'SAME_VENUE_DISTANCE_PODIUM':
     closeDistance&&targetClass&&hclass===targetClass?
      'SAME_VENUE_CLASS_NEAR_DISTANCE_PODIUM':null;
   if(!type)continue;
   discovered.push({
    category:type,source_ref:`COMPACT_V1.runners[horse_no=${x.horse_no}].recent_runs[${i}]`,
    past_race_date:h.race_date,track:h.track,distance:dist,finish,
    class_literal_verified:!!hclass,within_180_days:true,
    basis:'OFFICIALLY_VALIDATED_CLAIM_HISTORY_ONLY'
   });
  }
  const reported=existing.get(x.horse_no)??[];
  const actualRefs=new Set(reported.flatMap(f=>Array.isArray(f?.evidence_refs)?f.evidence_refs:[]));
  const unreported=discovered.filter(d=>!actualRefs.has(d.source_ref));
  return {
   horse_no:x.horse_no,horse_name:x.horse_name,baseline_rank:x.rank,
   verified_positive_run_count:discovered.length,
   saved_positive_factor_count:reported.length,
   unreported_verified_positive_runs:unreported,
   coverage_status:unreported.length?'REVIEW_POSITIVE_EVIDENCE_OMISSION':
      discovered.length?'REFERENCED_OR_REVIEWED':'NO_POSITIVE_RUN_FOUND_IN_AVAILABLE_HISTORY',
   source_limitations:{ambiguous_surface_runs:ignoredNoSurface,
    differing_class_runs:nonMatchingClass,weak_finish_runs:negativeRuns},
   evidence:discovered,
   eye_eligible:null,
   eligibility_reason:'TWO_INDEPENDENT_CURRENT_FACTORS_AND_FULL_17_ITEM_REVIEW_NOT_ESTABLISHED_BY_THIS_SHADOW'
  };
 });
 const missing=reports.filter(x=>x.unreported_verified_positive_runs.length>0);
 return {
  status:'READY',model:'LOCAL1.6_FACTOR_COVERAGE_SHADOW',
  rank_effect:false,eye_selection_effect:false,save_gate_effect:false,
  market_used:false,target_result_used:false,
  outside_top5_checked:outer.length,positive_run_horses:reports.filter(x=>x.verified_positive_run_count>0).length,
  missing_positive_evidence_horses:missing.length,
  missing_positive_evidence_runs:missing.reduce((n,x)=>n+x.unreported_verified_positive_runs.length,0),
  runner_reports:reports,
  production_eye_rule_unchanged:true,
  prospective_only:true
 };
}
