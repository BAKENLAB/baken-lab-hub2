/**
 * JRA 0.4: all-runner, non-scoring TOP5 boundary review.
 * Pre-race evidence only. NEVER alters the official prediction.
 */
const integer=x=>Number.isInteger(Number(x))&&Number(x)>0;
const empty=status=>({status,review_only:true,rank_effect:false,
  approval_to_save:false,comparison:[],missing_evidence_does_not_penalize:true});
function positives(x){
  const p=[];
  if(x.competitive_near_condition_runs>0) p.push({
    key:"COMPETITIVE_NEAR_CONDITION",
    fact:"今回に近い条件で好走・接戦実績"+x.competitive_near_condition_runs+"件"});
  if(x.verified_fast3f_runs>0) p.push({
    key:"VERIFIED_3F_SPEED",
    fact:"アーカイブ照合済み上がり3F上位"+x.verified_fast3f_runs+"件"});
  if(x.distinct_rivals_with_followups>0) p.push({
    key:"OPPONENT_SUPPORT",
    fact:"後に好走した対戦相手"+x.distinct_rivals_with_followups+"頭"});
  return p;
}
export function reviewJraV04Boundary(base,ledger,{candidateMaxRank=10}={}){
  if(!Array.isArray(base)||ledger?.status!=="READY"
     ||!Array.isArray(ledger.runners)) return empty("MISSING_INPUT");
  const originals=[...base].sort((a,b)=>Number(a.rank)-Number(b.rank));
  if(base.length!==ledger.runners.length || originals.some((r,i)=>
      !integer(r.rank)||Number(r.rank)!==i+1||!integer(r.horse_no)) ||
    new Set(base.map(r=>Number(r.horse_no))).size!==base.length) return empty("INVALID_BASE");
  const byNo=new Map(ledger.runners.map(r=>[Number(r.horse_no),r]));
  if(byNo.size!==ledger.runners.length ||
     originals.some(r=>byNo.get(Number(r.horse_no))?.horse_name!==r.horse_name))
    return empty("FIELD_OR_IDENTITY_MISMATCH");
  const protectedTop5=originals.filter(r=>Number(r.rank)<=5);
  const nonTop5=originals.filter(r=>Number(r.rank)>5
    &&Number(r.rank)<=candidateMaxRank);
  const rank5=protectedTop5[4];
  const limit=rank5?byNo.get(Number(rank5.horse_no)):null;
  const limitEvidence=limit?positives(limit):[];
  const comparison=nonTop5.map(candidate=>{
    const evidence=byNo.get(Number(candidate.horse_no));
    const proof=positives(evidence);
    const status=evidence.prior_history_count===0?"HISTORY_ABSENT":
      !proof.length?"NO_SUPPORTED_POSITIVE":proof.some(x=>
        !limitEvidence.some(y=>y.key===x.key))?
        "REVIEW_DIFFERENT_POSITIVE":"REVIEW_BOTH";
    return {
      candidate:{horse_no:Number(candidate.horse_no),horse_name:candidate.horse_name,
        original_rank:Number(candidate.rank)},
      rank5_protected:rank5?{horse_no:Number(rank5.horse_no),
        horse_name:rank5.horse_name,original_rank:5}:null,
      assessment:status,
      candidate_positive_evidence:proof,
      rank5_positive_evidence:limitEvidence,
      candidate_facts:(evidence.facts??[]).slice(0,6),
      protected_facts:(limit?.facts??[]).slice(0,4),
      candidate_caveats:evidence.caveats??[],
      protected_caveats:limit?.caveats??[],
      direction:"COMPARE_ALL_RUNNERS; DO_NOT_AUTO_SWAP",
    };
  });
  return {status:"REVIEW_READY",review_only:true,rank_effect:false,
    approval_to_save:false,missing_evidence_does_not_penalize:true,
    original_top5:protectedTop5.map(x=>({horse_no:Number(x.horse_no),
      horse_name:x.horse_name,rank:Number(x.rank)})),
    comparison,
    audit:{horse_count:originals.length,reviewed_outside_top5:comparison.length,
      has_unverified_record:ledger.runners.some(x=>x.caveats?.length>0),
      odds_and_popularity_used:false,asof_date:ledger.target_race_date,
      source:"PRIVATE_JRA_V04_EVIDENCE_BUNDLE"},
  };
}
