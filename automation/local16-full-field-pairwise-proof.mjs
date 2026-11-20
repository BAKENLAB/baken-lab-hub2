/**
 * LOCAL1.6 prospective whole-field direct-opponent proof.
 * Diagnostic ONLY: neither calculates scores nor authorizes an official save.
 * Facts must be from an independently authenticated, as-of verified live CLAIM.
 * A citation of a horse's own past run alone is NOT evidence of a relative rank decision.
 */
export const POLICY="LOCAL16_FULL_FIELD_PAIRWISE_PROOF_V1";
const PROTOCOL="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
const REF=/^COMPACT_V1\.runners\[horse_no=(\d+)\]\.recent_runs\[(\d+)\]$/;
const forbidden=/(?:odds|popularity|market|target.result|オッズ|人気|単勝|払戻|配当)/i;
const obj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
const good=x=>typeof x==="string"&&x.trim().length>=12&&!forbidden.test(x);
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const report=(status,code,detail={})=>({
 policy:POLICY,status,code,review_required:status!=="DOCUMENTED_UNCERTIFIED",
 certified_score_math:false,proven_score_effect:false,
 score_changed:false,rank_changed:false,eye_changed:false,
 frozen_modified:false,target_result_used:false,market_used:false,
 save_authorized:false,...detail
});
const sameKey=(a,b)=>a?.race_date===b?.race_date&&a?.track===b?.track&&
 a?.race_no===b?.race_no;
function refOf(ref,horse,expectedRun){
 const m=typeof ref==="string"?ref.match(REF):null;
 if(!m||Number(m[1])!==horse.horse_no)return false;
 const run=horse.recent_runs[Number(m[2])];
 return !!run&&sameKey(run,expectedRun);
}
const pairKey=(p)=>[p.race_date,p.track,p.race_no,...[...p.horse_nos].sort((a,b)=>a-b)].join("|");
/**
 * @param {{race?:any,verifiedRunners?:any[],facts?:any,draft?:any,
 * observationAt?:string,pairwiseTrace?:any[]}} args
 */
export function auditLocal16FullFieldPairwise({
 race,verifiedRunners,facts,draft,observationAt,pairwiseTrace=null
}={}){
 if(!obj(race)||!date(race.race_date)||typeof race.track!=="string"||
  !Number.isInteger(race.race_no)||!Number.isFinite(Date.parse(race.post_time))||
  !Number.isFinite(Date.parse(observationAt))||
  Date.parse(observationAt)>=Date.parse(race.post_time)||
  Object.hasOwn(race,"result")||Object.hasOwn(race,"finishers")||
  !Array.isArray(verifiedRunners)||verifiedRunners.length<5||
  !obj(facts)||facts.status!=="VERIFIED_WHOLE_FIELD_FACTS"||
  !Array.isArray(facts.head_to_head)||
  !obj(draft)||Object.hasOwn(draft,"result")||Object.hasOwn(draft,"finishers")||
  draft.audit?.protocol_version!==PROTOCOL||
  !Array.isArray(draft.runners)||draft.runners.length!==verifiedRunners.length)
  return report("INVALID","LIVE_VERIFIED_PRE_RACE_INPUT_REQUIRED");
 const horses=new Map(), ranks=new Map();
 for(const h of verifiedRunners){
  if(!Number.isInteger(h?.horse_no)||!h.horse_name||horses.has(h.horse_no)||
   !Array.isArray(h.recent_runs)||h.recent_runs.some(r=>!date(r?.race_date)||
     r.race_date>=race.race_date))
   return report("INVALID","HISTORY_ASOF_OR_IDENTITY_INVALID");
  horses.set(h.horse_no,h);
 }
 for(const r of draft.runners){
  if(!horses.has(r?.horse_no)||horses.get(r.horse_no).horse_name!==r.horse_name||
   !Number.isInteger(r.rank)||r.rank<1||r.rank>horses.size||
   !Number.isFinite(r.score)||r.score<0||r.score>100||ranks.has(r.rank))
   return report("INVALID","SAVED_RANK_IDENTITY_INVALID");
  ranks.set(r.rank,r);
 }
 if(ranks.size!==horses.size||[...ranks].some(([i,r])=>i>1&&r.score>ranks.get(i-1)?.score))
  return report("INVALID","SAVED_RANK_ORDER_INVALID");
 const verified=new Map(),covered=new Set();
 for(const f of facts.head_to_head){
  if(!date(f?.race_date)||f.race_date>=race.race_date||
   typeof f.track!=="string"||!Number.isInteger(f.race_no)||
   !Array.isArray(f.horse_nos)||f.horse_nos.length!==2||
   f.horse_nos[0]===f.horse_nos[1]||
   !f.horse_nos.every(n=>horses.has(n))||
   !Array.isArray(f.refs)||f.refs.length!==2||
   !f.refs.every((ref,i)=>refOf(ref,horses.get(f.horse_nos[i]),f)))
   return report("INVALID","UNVERIFIED_DIRECT_OPPONENT_SOURCE");
  const key=pairKey(f);
  if(verified.has(key))return report("INVALID","DUPLICATE_DIRECT_OPPONENT_FACT");
  verified.set(key,f);
  f.horse_nos.forEach(n=>covered.add(n));
 }
 if(!verified.size)return report("OBSERVED","NO_VERIFIED_DIRECT_PAIRS",{
  verified_pair_count:0,affected_horses:0,
  explanation:"Absence of direct prior encounters is not proof of a scoring omission."});
 if(!Array.isArray(pairwiseTrace))
  return report("REVIEW_REQUIRED","RANK_LINK_NOT_DOCUMENTED",{
    verified_pair_count:verified.size,affected_horses:covered.size,
    missing_horse_nos:[...covered].sort((a,b)=>a-b),
    explanation:"Official same-race comparisons are available, but no pre-rank decision trace links them to the saved ranking."});
 const seen=new Set(),reviewed=new Set(),unresolved=[];
 for(const row of pairwiseTrace){
  if(!obj(row)||!Array.isArray(row.horse_nos)||row.horse_nos.length!==2||
   !date(row.race_date)||typeof row.track!=="string"||
   !Number.isInteger(row.race_no)||!good(row.rank_rationale)||
   !["SUPPORTS_SAVED_ORDER","COUNTER_EVIDENCE","NOT_DECISIVE"].includes(row.rank_impact)||
   !Array.isArray(row.evidence_refs)||row.evidence_refs.length!==2)
   return report("INVALID","PAIRWISE_TRACE_INVALID");
  const key=pairKey(row),f=verified.get(key);
  if(!f||seen.has(key)||![...f.refs].sort().every((ref,i)=>ref===[...row.evidence_refs].sort()[i]))
   return report("INVALID","PAIRWISE_TRACE_SOURCE_MISMATCH");
  seen.add(key);f.horse_nos.forEach(n=>reviewed.add(n));
  if(row.rank_impact==="COUNTER_EVIDENCE")unresolved.push({horse_nos:f.horse_nos,race_date:f.race_date});
 }
 const missing=[...covered].filter(n=>!reviewed.has(n)).sort((a,b)=>a-b);
 if(missing.length||unresolved.length)return report("REVIEW_REQUIRED",
  unresolved.length?"RANK_COUNTER_EVIDENCE_NEEDS_DECISION":"DIRECT_PAIR_COVERAGE_INCOMPLETE",{
  verified_pair_count:verified.size,reviewed_pair_count:seen.size,
  affected_horses:covered.size,covered_horses:reviewed.size,
  missing_horse_nos:missing,unresolved_pairs:unresolved});
 return report("DOCUMENTED_UNCERTIFIED","FULL_FIELD_PAIRWISE_REVIEW_DOCUMENTED",{
  review_required:false,verified_pair_count:verified.size,
  reviewed_pair_count:seen.size,affected_horses:covered.size,
  covered_horses:reviewed.size,
  explanation:"Verified direct opponents have a documented ranking rationale; this is NOT proof of numeric score causality or higher accuracy."});
}
