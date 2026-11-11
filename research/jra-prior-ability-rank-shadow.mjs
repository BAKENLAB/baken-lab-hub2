/**
 * Research ONLY: as-of proven prior facts -> hypothetical score/rank changes.
 * No network/DB/write, no current-race result, no odds and NO live ranking.
 * A rank delta here is an unvalidated hypothesis, never a prediction update.
 */
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'));
const timestamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const num=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const natural=(n,max=40)=>Number.isInteger(n)&&n>=1&&n<=max;
const sourceUrl=u=>{
 try{const x=new URL(u);return x.protocol==='https:'&&
 ['www.jra.go.jp','jra.jp','app.jra.jp'].includes(x.hostname)&&
 x.pathname.startsWith('/JRADB/')&&!x.username&&!x.password&&!x.hash;}
 catch{return false;}
};
const fail=(status)=>({status,production_rank_effect:false,production_score_effect:false,
  changed_frozen:false,market_used:false,target_result_used:false,entries:[]});

/**
 * @param {object} params
 * target={raceDate, postTime, frozenAt, officialVerified}
 * frozenRunners=[{horse_no,horse_name,rank,score,status:'ACTIVE'}]
 * proofByHorse=[{horse_no,horse_name,priorRuns:[{
 *  raceDate,track,surface,distance,finish,margin,grade,earlyPos,
 *  officialSourceRef,sourceCheckedAt,identityVerified,officialVerified
 * }]}]
 * minEvidenceN intentionally does not define new rankings; hypotheses are tested
 * only when a source was already independently verified BEFORE frozenAt.
 */
export function buildJraPriorAbilityRankShadow({
 target,frozenRunners,proofByHorse,bonusPoints=3
}={}){
 const post=timestamp(target?.postTime),frozen=timestamp(target?.frozenAt);
 if(!date(target?.raceDate)||!Number.isFinite(post)||!Number.isFinite(frozen)||
    frozen>=post||target?.officialVerified!==true) return fail('UNVERIFIED_TARGET');
 if(!Array.isArray(frozenRunners)||frozenRunners.length<2||frozenRunners.length>24||
    !Array.isArray(proofByHorse)||proofByHorse.length>24||
    !natural(bonusPoints,10))return fail('INVALID_MODEL_OR_FIELD');
 const seenNo=new Set(),seenRank=new Set(),names=new Map();
 for(const r of frozenRunners){
  if(!natural(r.horse_no,24)||typeof r.horse_name!=='string'||!r.horse_name.trim()||
     !natural(r.rank,24)||r.rank>frozenRunners.length||!num(r.score,0,100)||
     r.status!=='ACTIVE'||seenNo.has(r.horse_no)||seenRank.has(r.rank))
   return fail('INVALID_FROZEN_ROSTER');
  seenNo.add(r.horse_no);seenRank.add(r.rank);names.set(r.horse_no,r.horse_name);
 }
 if(!Array.from({length:frozenRunners.length},(_,i)=>i+1).every(i=>seenRank.has(i)))
  return fail('NON_CONTIGUOUS_RANKS');
 const included=new Map(),usedEvidence=new Map();
 for(const packet of proofByHorse){
  const n=packet?.horse_no;
  if(!seenNo.has(n)||names.get(n)!==packet?.horse_name||included.has(n)||
     !Array.isArray(packet.priorRuns)||packet.priorRuns.length>15)
   return fail('BAD_EVIDENCE_IDENTITY');
  included.set(n,true);
  const eligible=[];
  for(const past of packet.priorRuns){
   const checked=timestamp(past?.sourceCheckedAt);
   // Strict as-of: never re-create pre-race evidence from later verification.
   if(!date(past?.raceDate)||past.raceDate>=target.raceDate||
      checked===null||checked>frozen||
      !sourceUrl(past.officialSourceRef)||
      past.identityVerified!==true||past.officialVerified!==true)continue;
   const age=(Date.parse(target.raceDate+'T00:00:00Z')-Date.parse(past.raceDate+'T00:00:00Z'))/86400000;
   if(age<0||age>400)continue;
   const distanceTarget=Number(target.distance);
   const isNear=Number.isInteger(distanceTarget)&&distanceTarget>=1000&&
     Number.isInteger(past.distance)&&Math.abs(past.distance-distanceTarget)<=300;
   const grade=['G1','G2','G3'].includes(past.grade);
   const close=natural(past.finish,24)&&past.finish<=3&&num(past.margin,0,0.5);
   const surfaceMatch=typeof past.surface==='string'&&past.surface===target.surface;
   const earlyVerified=natural(past.earlyPos,24)&&past.earlyPos<=4;
   if(grade&&close&&surfaceMatch&&isNear&&earlyVerified){
    eligible.push({raceDate:past.raceDate,track:past.track,grade:past.grade,
      finish:past.finish,earlyPos:past.earlyPos,source:past.officialSourceRef});
   }
  }
  usedEvidence.set(n,eligible.sort((a,b)=>b.raceDate.localeCompare(a.raceDate)));
 }
 const entries=frozenRunners.map(r=>{
  const proof=usedEvidence.get(r.horse_no)??[];
  const tentativeBonus=proof.length?bonusPoints:0;
  return {horse_no:r.horse_no,horse_name:r.horse_name,old_rank:r.rank,
   old_score:r.score,hypothesis_bonus:tentativeBonus,
   hypothesis_score:Math.min(100,r.score+tentativeBonus),
   verified_prior_grade_close_front_evidence:proof,
   source_status:proof.length?'VERIFIED_AS_OF':'NO_ELIGIBLE_PRE_FROZEN_FACT'};
 });
 const ranked=entries.slice().sort((a,b)=>
  b.hypothesis_score-a.hypothesis_score||
  a.old_rank-b.old_rank||a.horse_no-b.horse_no);
 ranked.forEach((r,i)=>r.shadow_rank=i+1);
 const positions=new Map(ranked.map(r=>[r.horse_no,r.shadow_rank]));
 const re=entries.map(r=>{
  const shadowRank=positions.get(r.horse_no);
  return {...r,shadow_rank:shadowRank,rank_delta:r.old_rank-shadowRank,
   top5_changed:(r.old_rank<=5)!==(shadowRank<=5)};
 }).sort((a,b)=>a.old_rank-b.old_rank);
 return {
  status:'RESEARCH_SHADOW_NOT_VALIDATED',
  evidence_used_runners:re.filter(x=>x.hypothesis_bonus>0).length,
  altered_rank_runners:re.filter(x=>x.rank_delta!==0).length,
  promoted_to_top5:re.filter(x=>x.old_rank>5&&x.shadow_rank<=5).map(x=>x.horse_no),
  lost_from_top5:re.filter(x=>x.old_rank<=5&&x.shadow_rank>5).map(x=>x.horse_no),
  original_top5:re.filter(x=>x.old_rank<=5).map(x=>x.horse_no),
  shadow_top5:re.filter(x=>x.shadow_rank<=5).sort((a,b)=>a.shadow_rank-b.shadow_rank).map(x=>x.horse_no),
  bonus_points_research_only:bonusPoints,
  scoring_hypothesis:'GRADED_PODIUM_CLOSE_FRONT_SIMILAR_CONDITION',
  source_asof:'VERIFIED_BEFORE_OR_AT_ORIGINAL_FROZEN',
  target_result_used:false,market_used:false,
  production_rank_effect:false,production_score_effect:false,changed_frozen:false,
  entries:re
 };
}
