/** Research structural audit, not an evaluator or proof of causal use of evidence. Self-declared independence requires separate custody verification. Never saves or modifies rankings. */
export function auditLocal16IndependentResearchAssessment({review,assessment}={}){
 const fail=code=>{throw Error(code)};
 const version="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
 if(review?.schema!=="LOCAL_16_EXTENDED_RESEARCH_REVIEW_V1"||review.rank_authorized!==false||review.score_authorized!==false||review.market_used!==false||review.target_result_used!==false||!Array.isArray(review.rows)||review.rows.length<2||new Set(review.rows.map(r=>r.horse_no)).size!==review.rows.length||assessment?.protocol_version!==version||assessment.mode!=="INDEPENDENT_RESEARCH_ONLY"||assessment.market_used!==false||assessment.target_result_used!==false||assessment.baseline_scores_seen!==false||assessment.save_authorized!==false||!Array.isArray(assessment.runners)||assessment.runners.length!==review.rows.length)fail("INVALID_ASSESSMENT_CONTRACT");
 const records=[],seen=new Set(),market=/オッズ|人気|単勝|odds|popularity|market/i;
 for(const h of assessment.runners){
  const r=review.rows.find(x=>x.horse_no===h.horse_no&&x.horse_name===h.horse_name);
  if(!r||seen.has(h.horse_no)||!Number.isInteger(h.score)||h.score<0||h.score>100||!["S","A","B","C","D","E","F"].includes(h.grade)||!Array.isArray(h.criteria)||h.criteria.length!==13||!Array.isArray(h.transfer_review)||h.transfer_review.length!==7)fail("INCOMPLETE_RUNNER_REVIEW");
  seen.add(h.horse_no);
  const validate=(row,items)=>{
   const indices=new Set();
   for(const a of items){
    if(!Number.isInteger(a.index)||a.index<0||a.index>=row.length||indices.has(a.index)||!["FAVORABLE","UNFAVORABLE","NEUTRAL","MIXED","MISSING","NOT_APPLICABLE"].includes(a.judgment)||typeof a.reason!=="string"||a.reason.trim().length<4||market.test(a.reason)||!Array.isArray(a.refs)||new Set(a.refs).size!==a.refs.length)fail("INVALID_CRITERION_ASSESSMENT");
    indices.add(a.index);
    if(!["MISSING","NOT_APPLICABLE"].includes(a.judgment)&&(!a.refs.length||a.refs.some(x=>!row[a.index].refs?.includes(x))))fail("UNKNOWN_CRITERION_REF");
    if(["MISSING","NOT_APPLICABLE"].includes(a.judgment)&&a.refs.some(x=>!row[a.index].refs?.includes(x)))fail("UNKNOWN_LIMITATION_REF");
   }
  };
  validate(r.criteria,h.criteria);validate(r.transfer_review,h.transfer_review);
  const details=r.extended_research_facts??[];
  const expected=details.flatMap((x,i)=>[...(x.lap_status==="AUTHENTICATED_RESEARCH_FACT"?[{key:i+":LAP",kind:"LAP"}]:[]),...(x.opponent_followup?.observed_peer_count>0?[{key:i+":PEER",kind:"PEER"}]:[])]);
  if(!Array.isArray(h.extended_reviews)||h.extended_reviews.length!==expected.length||new Set(h.extended_reviews.map(x=>x.key)).size!==expected.length)fail("EXTENDED_REVIEW_MISSING");
  for(const a of h.extended_reviews){
   if(!expected.some(x=>x.key===a.key)||!["FAVORABLE","UNFAVORABLE","NEUTRAL","MIXED","INSUFFICIENT_TO_INTERPRET"].includes(a.judgment)||typeof a.reason!=="string"||a.reason.trim().length<8||market.test(a.reason))fail("EXTENDED_REVIEW_INVALID");
  }
  if(!Number.isInteger(h.rank)||h.rank<1||h.rank>review.rows.length)fail("RANK_INVALID");
  records.push({horse_no:h.horse_no,score:h.score,rank:h.rank,grade:h.grade,reviewed_extended_facts:expected.length});
 }
 records.sort((a,b)=>a.rank-b.rank);
 if(records.some((x,i)=>x.rank!==i+1||(i>0&&x.score>records[i-1].score)))fail("RANK_SCORE_INCONSISTENT");
 const top5=records.slice(0,Math.min(5,records.length)).map(x=>x.horse_no);
 if(!Array.isArray(assessment.top5)||JSON.stringify(assessment.top5)!==JSON.stringify(top5))fail("TOP5_MISMATCH");
 return {status:"STRUCTURAL_ASSESSMENT_AUDIT_PASS",runner_count:records.length,criteria_count:records.length*13,transfer_checks:records.length*7,extended_review_count:records.reduce((n,x)=>n+x.reviewed_extended_facts,0),records,top5,rank_authorized:false,score_effect_proven:false,independence_proven:false,save_authorized:false,eye_status:"REQUIRES_SEPARATE_OFFICIAL_17_CHECK_GATE"};
}
