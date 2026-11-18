/** Trace of the actual LOCAL1.6 independent scorer's criterion judgments.
 * Structural source-reference audit only, NOT an approved scoring formula.
 */
export function auditLocal16CriterionTrace({context,draft}={}){
 const result=(status,code,extra={})=>({ok:false,status,code,score_certified:false,
  point_effect_proven:false,rank_changed:false,eye_changed:false,
  frozen_modified:false,market_used:false,target_result_used:false,...extra});
 const bad=(code,extra={})=>result("INVALID_TRACE",code,extra);
 const m=context?.local16_scoring_criteria;
 if(context?.context_format!=="COMPACT_V1"||
  context?.protocol_version!=="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013"||
  context?.field_integrity_checked!==true||m?.status!=="READY_FOR_INDEPENDENT_100_POINT_SCORING"||
  !Array.isArray(m?.rows)||m.rows.length<5||m.score_computed!==false||m.rank_effect!==false)
  return result("NOT_READY","OFFICIAL_CRITERIA_NOT_READY");
 const t=draft?.audit?.local16_scoring_trace;
 if(!t)return result("MISSING_TRACE","NO_CRITERION_TRACE");
 if(t.schema!=="LOCAL16_SCORING_TRACE_V1"||t.protocol_version!==context.protocol_version||
  !Array.isArray(t.rows)||!Array.isArray(draft?.runners)||t.rows.length!==m.rows.length||
  draft.runners.length!==m.rows.length||new Set(t.rows.map(x=>x.horse_no)).size!==t.rows.length)
  return bad("TRACE_ROSTER_OR_PROTOCOL");
 const forbidden=/オッズ|人気|odds|popularity/i;
 const statuses=new Set(["FAVORABLE","UNFAVORABLE","MIXED","NEUTRAL","INSUFFICIENT","MISSING"]);
 const counts={horses:0,judgments:0,source_references:0,positive:0,negative:0,unknown:0};
 for(const row of t.rows){
  const h=m.rows.find(x=>x.horse_no===row.horse_no&&x.horse_name===row.horse_name);
  const score=draft.runners.find(x=>x.horse_no===row.horse_no&&x.horse_name===row.horse_name);
  if(!h||!score||row.rank!==score.rank||row.score!==score.score||
   typeof row.score_reason!=="string"||row.score_reason.trim().length<10||
   row.score_reason.length>500||forbidden.test(row.score_reason))
   return bad("SCORE_REASON_OR_IDENTITY_MISMATCH",{horse_no:row.horse_no});
  counts.horses++;
  for(const field of ["criteria","transfer_review"]){
   const raw=row[field],truth=h[field],len=field==="criteria"?13:7;
   if(!Array.isArray(raw)||raw.length!==len||!Array.isArray(truth)||truth.length!==len)
    return bad("INCOMPLETE_CRITERION_TRACE",{horse_no:row.horse_no,field});
   for(let i=0;i<len;i++){
    const a=raw[i],allowed=truth[i].evidence_refs,has=truth[i].data_state==="VERIFIED_INPUT_AVAILABLE";
    if(a?.index!==i||!statuses.has(a?.judgment)||typeof a.reason!=="string"||
     a.reason.trim().length<8||a.reason.length>300||forbidden.test(a.reason)||
     !Array.isArray(a.evidence_refs)||a.evidence_refs.length>8||
     new Set(a.evidence_refs).size!==a.evidence_refs.length||
     a.evidence_refs.some(x=>!allowed.includes(x))||
     (!has&&a.judgment!=="MISSING")||
     (has&&a.judgment==="MISSING")||
     (["FAVORABLE","UNFAVORABLE","MIXED","NEUTRAL"].includes(a.judgment)&&a.evidence_refs.length===0))
      return bad("UNSUPPORTED_CRITERION_JUDGMENT",{horse_no:row.horse_no,field,index:i});
    counts.judgments++;
    counts.source_references+=a.evidence_refs.length;
    counts.positive+=["FAVORABLE","MIXED"].includes(a.judgment)?1:0;
    counts.negative+=["UNFAVORABLE","MIXED"].includes(a.judgment)?1:0;
    counts.unknown+=["INSUFFICIENT","MISSING"].includes(a.judgment)?1:0;
   }
  }
 }
 return result("STRUCTURALLY_TRACEABLE","EVIDENCE_REFERENCES_AND_JUDGMENTS_DOCUMENTED",
  {ok:true,counts,warning:"Traceability is NOT score reproducibility. The original LOCAL1.6 point-allocation procedure remains unauthenticated."});
}