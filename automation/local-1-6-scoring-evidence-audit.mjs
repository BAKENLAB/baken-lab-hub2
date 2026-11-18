/**
 * LOCAL1.6 pre-save quality audit. READ ONLY; never computes or changes an
 * ability score, ranking, EYE choice or previously sealed FROZEN prediction.
 *
 * A 17-item CHECKED flag means the recorded *aspect* was inspected, NOT that
 * every part of that aspect (e.g. layoff vs training) was verified.
 * Return scoped gaps rather than silently marking missing data as evidence.
 */
const CHECKS=Object.freeze([
 'distance_change','track_change','going_change','class_change',
 'promotion_demotion','weight_change','jockey_change','draw',
 'running_style','pace_peers','margins','passing_order','final_section',
 'trouble','layoff_preparation','current_suitability','same_condition_history'
]);
const bool=x=>typeof x==='boolean';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clean=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const refPattern=/^COMPACT_V1\.runners\[horse_no=(\d+)\]\.recent_runs\[(\d+)\]$/;
const supportedRef=(ref,no,h)=> {
 const m=typeof ref==='string'?ref.match(refPattern):null;
 return Boolean(m&&Number(m[1])===no&&h&&Array.isArray(h.recent_runs)&&
  Number(m[2])>=0&&Number(m[2])<h.recent_runs.length);
};
const sum=x=>x.reduce((n,v)=>n+v,0);
const error=(code,issues=[],metrics={})=>({ok:false,code,issues,metrics});
function scoreTrace(r,h){
 const l=r?.score_ledger;
 if(!obj(l)||!Number.isFinite(l.base_score)||!Array.isArray(l.components)||
  !clean(l.scorer_version)||!clean(l.scoring_policy_ref))
  return 'SCORE_LEDGER_MISSING_OR_UNATTESTED';
 if(!Number.isFinite(r.score)||r.score<0||r.score>100||
   l.components.some(v=>!obj(v)||!clean(v.rule_id)||
     !Number.isFinite(v.points)||!Array.isArray(v.evidence_refs)||
     !v.evidence_refs.length||
     !v.evidence_refs.every(ref=>supportedRef(ref,r.horse_no,h))))
  return 'SCORE_LEDGER_INVALID_COMPONENT';
 const total=l.base_score+sum(l.components.map(c=>c.points));
 if(Math.abs(total-r.score)>1e-7)return 'SCORE_LEDGER_SUM_MISMATCH';
 return null;
}
export function auditLocal16EvidenceQuality({
 payload,verifiedRunners,strictScoreTrace=false,targetDate=null
}={}){
 if(!obj(payload)||!Array.isArray(payload.runners)||!Array.isArray(verifiedRunners)||
  !obj(payload.audit))return error('LOCAL_AUDIT_INPUT_INVALID');
 const hByNo=new Map(verifiedRunners.map(h=>[h?.horse_no,h]));
 if(hByNo.size!==verifiedRunners.length||verifiedRunners.length!==payload.runners.length)
  return error('LOCAL_AUDIT_ROSTER_MISMATCH');
 const rankNos=new Set();
 const issues=[],gaps=[],scoring=[];
 for(const r of payload.runners){
  const h=hByNo.get(r?.horse_no);
  if(!h||h.horse_name!==r.horse_name||!Number.isInteger(r.rank)||
   rankNos.has(r.rank)||!Array.isArray(h.recent_runs))
   return error('LOCAL_AUDIT_ROSTER_MISMATCH');
  rankNos.add(r.rank);
  for(const past of h.recent_runs){
   if(!date(past?.race_date)||(targetDate!==null&&past.race_date>=targetDate))
    return error('LOCAL_AUDIT_HISTORY_ASOF_INVALID',[{horse_no:r.horse_no}]);
  }
  const sc=scoreTrace(r,h);
  if(sc)scoring.push({horse_no:r.horse_no,code:sc});
 }
 const candidates=payload.audit.eye_candidate_audit;
 const factors=payload.audit.eye_positive_factor_audit;
 if(!Array.isArray(candidates)||!Array.isArray(factors))
  return error('LOCAL_AUDIT_EYE_SHAPE_INVALID');
 const expected=payload.runners.filter(r=>r.rank>5).map(r=>r.horse_no).sort((a,b)=>a-b);
 const actual=candidates.map(c=>c?.horse_no).sort((a,b)=>a-b);
 const factorNos=factors.map(f=>f?.horse_no).sort((a,b)=>a-b);
 if(JSON.stringify(expected)!==JSON.stringify(actual)||
   JSON.stringify(expected)!==JSON.stringify(factorNos))
  return error('LOCAL_AUDIT_EYE_POOL_MISMATCH');
 for(const c of candidates){
  const h=hByNo.get(c.horse_no),check=c.review_checks;
  if(!obj(check)||CHECKS.some(k=>!obj(check[k]))||Object.keys(check).length!==17)
   return error('LOCAL_AUDIT_17_CHECKS_INCOMPLETE',[{horse_no:c.horse_no}]);
  for(const k of CHECKS){
   const v=check[k],refs=v.evidence_refs;
   if(!['CHECKED','MISSING'].includes(v.status)||!clean(v.finding)||
    !Array.isArray(refs))
    issues.push({horse_no:c.horse_no,criterion:k,code:'INVALID_CHECK_SCHEMA'});
   else if(v.status==='CHECKED'&&
     (!refs.length||refs.some(x=>!supportedRef(x,c.horse_no,h))))
    issues.push({horse_no:c.horse_no,criterion:k,code:'CHECKED_WITHOUT_VERIFIED_RUN'});
   else if(v.status==='MISSING'&&refs.length)
    issues.push({horse_no:c.horse_no,criterion:k,code:'MISSING_HAS_INVENTED_EVIDENCE'});
   else if(v.status==='MISSING')
    gaps.push({horse_no:c.horse_no,criterion:k,code:'NOT_VERIFIED'});
   // A date/interval is not proof of training condition. Keep this distinct.
   if(k==='layoff_preparation'&&v.status==='CHECKED'&&
      /(?:調教|仕上がり|追い切り).{0,8}(?:未確認|不明|未取得)/.test(v.finding))
     gaps.push({horse_no:c.horse_no,criterion:'training_preparation',
       code:'INTERVAL_ONLY_TRAINING_UNVERIFIED'});
   if(k==='jockey_change'&&v.status==='CHECKED'&&
      /前走(?:未確認|欠測|不明)/.test(v.finding))
     gaps.push({horse_no:c.horse_no,criterion:'previous_jockey',
       code:'CHANGE_NOT_INDEPENDENTLY_VERIFIED'});
   // A same-condition claim must point to an actual same-track same-distance run.
   if(k==='same_condition_history'&&v.status==='CHECKED'){
    const verified=refs.some(ref=>{
     const i=Number(ref?.match(refPattern)?.[2]);
     const x=h?.recent_runs?.[i];
     return x&&x.track===payload.audit?.race_track&&
       x.distance===payload.audit?.race_distance;
    });
    // Only enforce this check when certified current race conditions were
    // explicitly provided. Do not infer them from textual race labels.
    if(clean(payload.audit?.race_track)&&Number.isInteger(payload.audit?.race_distance)&&!verified)
     issues.push({horse_no:c.horse_no,criterion:k,code:'SAME_CONDITION_NOT_VERIFIED'});
   }
  }
 }
 const byCandidate=new Map(candidates.map(c=>[c.horse_no,c]));
 for(const row of factors){
  if(!Array.isArray(row.positive_factors))
   return error('LOCAL_AUDIT_EYE_FACTOR_SCHEMA',[{horse_no:row.horse_no}]);
  const seen=new Set();
  for(const f of row.positive_factors){
   const c=byCandidate.get(row.horse_no),check=c?.review_checks?.[f.category];
   if(!CHECKS.includes(f.category)||seen.has(f.category)||!bool(f.current_relevance)||
      !Array.isArray(f.evidence_refs)||f.evidence_refs.length===0||
      !f.evidence_refs.every(ref=>supportedRef(ref,row.horse_no,hByNo.get(row.horse_no))&&
        check?.evidence_refs?.includes(ref))||check?.status!=='CHECKED')
     issues.push({horse_no:row.horse_no,criterion:f.category,code:'EYE_FACTOR_NOT_VERIFIED'});
   seen.add(f.category);
  }
 }
 const metrics={total_runners:payload.runners.length,eye_candidates:candidates.length,
  verified_checks:candidates.reduce((n,c)=>n+CHECKS.filter(k=>c.review_checks[k].status==='CHECKED').length,0),
  missing_checks:candidates.reduce((n,c)=>n+CHECKS.filter(k=>c.review_checks[k].status==='MISSING').length,0),
  missing_score_traces:scoring.length,
  scoped_gaps:gaps.length};
 if(issues.length)return error('LOCAL_EVIDENCE_ASSERTION_MISMATCH',issues,metrics);
 if(strictScoreTrace&&scoring.length)
  return error('LOCAL_SCORE_TRACE_UNPROVEN',scoring,metrics);
 return {ok:true,code:scoring.length?'LOCAL_EVIDENCE_VALID_SCORE_UNVERIFIED':'LOCAL_EVIDENCE_VALID_SCORE_RECONCILED',
  metrics,gaps,scoreTraceVerified:scoring.length===0,
  scoreTraceIssues:scoring,production_rank_changed:false,production_eye_changed:false,
  frozen_modified:false};
}
