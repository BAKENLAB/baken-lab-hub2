/**
 * LOCAL1.6 pre-save EYE evidence omission audit (READ ONLY).
 * Reviewing an official podium NEVER changes rank, score or EYE.
 * This module cannot read betting odds, official results or post-start facts.
 */
export const POLICY="LOCAL16_OMISSION_REVIEW_V1";
const date=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const num=x=>typeof x==="number"&&Number.isFinite(x)?x:typeof x==="string"&&/^\d+(?:\.\d+)?$/.test(x.trim())?Number(x):null;
const ref=(n,i)=>"COMPACT_V1.runners[horse_no="+n+"].recent_runs["+i+"]";
const pattern=/^COMPACT_V1\.runners\[horse_no=(\d+)\]\.recent_runs\[(\d+)\]$/;
const fail=(code,extra={})=>({ok:false,status:"UNVERIFIED",code,rank_effect:false,eye_effect:false,frozen_effect:false,...extra});
const goodRef=(r,n,h)=>{const m=typeof r==="string"?r.match(pattern):null;return !!(m&&Number(m[1])===n&&Number(m[2])<h.recent_runs.length);};
export function auditLocalEyeOmissions({race,verifiedRunners,payload,observationAt,maxAgeDays=90}={}){
 if(!race||!payload||!Array.isArray(payload.runners)||!Array.isArray(verifiedRunners)||
 verifiedRunners.length<5||payload.runners.length!==verifiedRunners.length||
 !date(race.race_date)||!Number.isInteger(race.race_no)||!race.track||
 !Number.isInteger(race.conditions?.distance)||!race.conditions?.surface||
 !Number.isFinite(Date.parse(race.post_time))||!Number.isFinite(Date.parse(observationAt))||
 Date.parse(observationAt)>=Date.parse(race.post_time)||
 !Number.isInteger(maxAgeDays)||maxAgeDays<1||maxAgeDays>180)
 return fail("VERIFIED_PRE_RACE_CONTEXT_REQUIRED");
 if(Object.hasOwn(race,"result")||Object.hasOwn(race,"finishers")||
 Object.hasOwn(payload,"results")||Object.hasOwn(payload,"finishers"))
 return fail("TARGET_RESULT_CONTAMINATION");
 const audit=payload.audit||{},candidates=audit.eye_candidate_audit,positives=audit.eye_positive_factor_audit;
 const reviews=audit.eye_coverage_reviewed_runs??[];
 if(!Array.isArray(candidates)||!Array.isArray(positives)||!Array.isArray(reviews))
 return fail("AUDIT_SHAPE_INVALID");
 const byNo=new Map(),ranks=new Set();
 for(const h of verifiedRunners){
  if(!Number.isInteger(h?.horse_no)||!h.horse_name||byNo.has(h.horse_no)||
  !Array.isArray(h.recent_runs))return fail("VERIFIED_ROSTER_INVALID");
  byNo.set(h.horse_no,h);
  if(h.recent_runs.some(p=>!date(p.race_date)||p.race_date>=race.race_date))
   return fail("HISTORY_NOT_PRE_RACE");
 }
 for(const p of payload.runners){
  if(!byNo.has(p.horse_no)||byNo.get(p.horse_no).horse_name!==p.horse_name||
   !Number.isInteger(p.rank)||ranks.has(p.rank))return fail("BASELINE_IDENTITY_MISMATCH");
  ranks.add(p.rank);
 }
 if(ranks.size!==payload.runners.length)return fail("BASELINE_RANKS_INCOMPLETE");
 const outsiders=payload.runners.filter(p=>p.rank>5),outerNos=new Set(outsiders.map(p=>p.horse_no));
 if(candidates.length!==outsiders.length||positives.length!==outsiders.length||
  new Set(candidates.map(x=>x.horse_no)).size!==outsiders.length||
  new Set(positives.map(x=>x.horse_no)).size!==outsiders.length||
  candidates.some(x=>!outerNos.has(x.horse_no))||
  positives.some(x=>!outerNos.has(x.horse_no)))return fail("EYE_POOL_MISMATCH");
 const allowed=["CLASS_OR_OPPONENT_UNVERIFIED","CURRENT_FORM_NEGATIVE","SURFACE_UNVERIFIED",
 "INDEPENDENT_EVIDENCE_INSUFFICIENT","OTHER_CONCRETE_CONTRADICTION"];
 const reviewed=new Map();
 for(const entry of reviews){
  const h=byNo.get(entry?.horse_no);
  if(!h||!outerNos.has(entry.horse_no)||!goodRef(entry.evidence_ref,entry.horse_no,h)||
   reviewed.has(entry.evidence_ref)||entry.decision!=="NOT_CURRENT_POSITIVE"||
   !allowed.includes(entry.reason_code)||
   typeof entry.reason!=="string"||entry.reason.trim().length<12||entry.reason.length>600)
   return fail("EYE_OMISSION_EXPLANATION_INVALID");
  reviewed.set(entry.evidence_ref,entry);
 }
 const missing=[],covered=[],acknowledged=[],diagnostics=[];
 const today=Date.parse(race.race_date+"T00:00:00Z");
 for(const outsider of outsiders){
  const h=byNo.get(outsider.horse_no);
  const row=positives.find(x=>x.horse_no===h.horse_no);
  if(!Array.isArray(row?.positive_factors))return fail("EYE_FACTOR_SCHEMA_INVALID");
  const cited=new Set(),current=[];
  for(const factor of row.positive_factors){
   if(!Array.isArray(factor?.evidence_refs)||factor.evidence_refs.length===0||
    factor.evidence_refs.some(r=>!goodRef(r,h.horse_no,h)))
    return fail("EYE_FACTOR_UNVERIFIED_REFERENCE");
   factor.evidence_refs.forEach(r=>cited.add(r));
   if(factor.current_relevance===true)current.push(new Set(factor.evidence_refs));
  }
  for(let i=0;i<current.length;i++)for(let j=i+1;j<current.length;j++){
   if(current[i].size===1&&current[j].size===1&&
    [...current[i]][0]===[...current[j]][0])
    return fail("EYE_FACTOR_SHARED_SINGLE_RUN_NOT_INDEPENDENT",{horse_no:h.horse_no});
  }
  for(let i=0;i<h.recent_runs.length;i++){
   const past=h.recent_runs[i],finish=num(past.finish),distance=num(past.distance);
   const age=(today-Date.parse(past.race_date+"T00:00:00Z"))/86400000;
   if(!Number.isInteger(finish)||finish<1||finish>3||
    age<0||age>maxAgeDays||distance!==race.conditions.distance||
    past.track!==race.track||
    past.surface&&past.surface!==race.conditions.surface)continue;
   const evidence_ref=ref(h.horse_no,i);
   const finding={horse_no:h.horse_no,horse_name:h.horse_name,rank:outsider.rank,
    evidence_ref,past_race_date:past.race_date,finish,age_days:age,
    track:past.track,distance,surface_verified:past.surface===race.conditions.surface};
   if(cited.has(evidence_ref))covered.push(finding);
   else if(reviewed.has(evidence_ref))
     acknowledged.push({...finding,reason_code:reviewed.get(evidence_ref).reason_code});
   else missing.push(finding);
  }
  diagnostics.push({horse_no:h.horse_no,
   total_verified_history:h.recent_runs.length,current_positive_factors:current.length});
 }
 const orphan=[...reviewed.keys()].filter(ref=>!acknowledged.some(x=>x.evidence_ref===ref));
 if(orphan.length)return fail("EYE_REVIEW_REFERENCE_NOT_APPLICABLE",{orphan_refs:orphan});
 return {ok:missing.length===0,status:missing.length?"REVIEW_REQUIRED":"READY",
 code:missing.length?"EYE_POSITIVE_EVIDENCE_REVIEW_REQUIRED":"EYE_OMISSION_REVIEW_PASS",
 policy:POLICY,rank_effect:false,eye_effect:false,frozen_effect:false,
 results_used:false,market_used:false,scanned_outsiders:outsiders.length,
 recent_podiums:missing.length+covered.length+acknowledged.length,
 missing_count:missing.length,missing,covered,acknowledged,diagnostics,
 unverified_surface_count:[...missing,...covered,...acknowledged].filter(x=>!x.surface_verified).length};
}
