/**
 * LOCAL 1.6 ranking provenance and reproducibility diagnostics.
 *
 * READ ONLY. Not a new rating rubric, not a scorer, not an EYE selector.
 * This function MUST NOT certify a score without a source-attested policy
 * and every horse's verified point contributions. A score being sorted
 * into descending order does not establish that it was independently computed.
 * It does not open an expired CLAIM, save, or write FROZEN.
 */
export const LOCAL16_RANK_AUDIT_POLICY="LOCAL16_RANK_REPRO_AUDIT_V1";
const PROTOCOL="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
const isObj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
const isDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const n=x=>typeof x==="number"&&Number.isFinite(x);
const ref=(no,index)=>"COMPACT_V1.runners[horse_no="+no+"].recent_runs["+index+"]";
const parseRef=/^COMPACT_V1\.runners\[horse_no=(\d+)\]\.recent_runs\[(\d+)\]$/;
const fail=(code,issues=[])=>({ok:false,status:"INVALID",code,issues,
 score_certified:false,rank_reproducible:false,rank_changed:false,eye_changed:false,
 frozen_modified:false,market_used:false,target_result_used:false});
const ordered=x=>[...x].sort((a,b)=>a.horse_no-b.horse_no);
const scoreProjection=(p)=>ordered(p.runners).map(r=>({
 horse_no:r.horse_no,rank:r.rank,score:r.score,grade:r.grade
}));
const sourceProjection=(race,verifiedRunners)=>({
 date:race.race_date,track:race.track,race_no:race.race_no,
 conditions:race.conditions,
 field:ordered(verifiedRunners).map(h=>({
  horse_no:h.horse_no,horse_name:h.horse_name,
  recent_runs:h.recent_runs.map(z=>({
   race_date:z.race_date,track:z.track,distance:z.distance,
   surface:z.surface??null,going:z.going??null,
   race_name:z.race_name??null,finish:z.finish??null,
   margin:z.margin??null,early_pos:z.early_pos??null,
   final_turn_pos:z.final_turn_pos??null,final3f:z.final3f??null,
   weight_carried:z.weight_carried??null,jockey:z.jockey??null
  }))
 }))
});
function normalizeJson(x){
 if(Array.isArray(x))return x.map(normalizeJson);
 if(isObj(x))return Object.fromEntries(
  Object.keys(x).sort().map(k=>[k,normalizeJson(x[k])]));
 return x===undefined?null:x;
}
export const canonicalLocal16Input=(race,verifiedRunners)=>
 JSON.stringify(normalizeJson(sourceProjection(race,verifiedRunners)));
function validateRefs(no,refs,h){
 if(!Array.isArray(refs)||new Set(refs).size!==refs.length)return false;
 return refs.every(z=>{
  const m=typeof z==="string"?z.match(parseRef):null;
  return m&&Number(m[1])===no&&Number(m[2])<h.recent_runs.length;
 });
}
// Deliberately EMPTY until a real independently reproducible LOCAL1.6 scorer is approved.
// A caller-supplied boolean/label can never authenticate a scorer implementation.
const VERIFIED_LOCAL16_SCORERS=Object.freeze({});
function ledgerMathConsistent(r,h,approved){
 const ledger=r.score_ledger;
 // This is NOT cryptographic certification. External policy identity remains
 // untrusted until connected to a separately approved scorer implementation.
 if(!isObj(ledger)||!isObj(approved)||
  !approved.implementation_verified||!approved.policy_approved||
  typeof approved.version!=="string"||typeof approved.policy_ref!=="string"||
  ledger.scorer_version!==approved.version||
  ledger.scoring_policy_ref!==approved.policy_ref||
  !n(ledger.base_score)||!Array.isArray(ledger.components)||
  ledger.components.length===0)return false;
 let total=ledger.base_score;
 for(const c of ledger.components){
  if(!isObj(c)||typeof c.rule_id!=="string"||!n(c.points)||
    !validateRefs(r.horse_no,c.evidence_refs,h)||!c.evidence_refs.length)return false;
  total+=c.points;
 }
 return Math.abs(total-r.score)<0.000001;
}
function certScore(r,h,approved){
 return ledgerMathConsistent(r,h,approved)&&
   VERIFIED_LOCAL16_SCORERS[approved.version]===approved.policy_ref;
}
/**
 * Input is strictly as-of-before-post; official results are never supplied.
 * Repeated draft is an OPTIONAL independently obtained same-input prediction.
 * @param {{race?:any,verifiedRunners?:any[],draft?:any,repeatDraft?:any,
 * observationAt?:string,approvedScoringPolicy?:any}} [arg]
 */
export function auditLocal16RankStability({
 race,verifiedRunners,draft,repeatDraft=null,observationAt,
 approvedScoringPolicy=null
}={}){
 if(!isObj(race)||!isDate(race.race_date)||!race.track||
 !Number.isInteger(race.race_no)||race.race_no<1||
 !isObj(race.conditions)||!Number.isInteger(race.conditions.distance)||
 typeof race.conditions.surface!=="string"||
 !Number.isFinite(Date.parse(race.post_time))||
 !Number.isFinite(Date.parse(observationAt))||
 Date.parse(observationAt)>=Date.parse(race.post_time)||
 !Array.isArray(verifiedRunners)||verifiedRunners.length<5||
 !isObj(draft)||!Array.isArray(draft.runners)||
 draft.protocol_version&&draft.protocol_version!==PROTOCOL||
 draft.audit?.protocol_version!==PROTOCOL)
 return fail("PRE_RACE_VERIFIED_INPUT_REQUIRED");
 if(Object.hasOwn(race,"result")||Object.hasOwn(race,"finishers")||
  Object.hasOwn(draft,"result")||Object.hasOwn(draft,"finishers"))
  return fail("TARGET_RESULT_CONTAMINATION");
 const hmap=new Map(),rankSet=new Set();
 for(const h of verifiedRunners){
  if(!Number.isInteger(h?.horse_no)||!h.horse_name||
     hmap.has(h.horse_no)||!Array.isArray(h.recent_runs)||
     h.recent_runs.some(z=>!isDate(z?.race_date)||z.race_date>=race.race_date))
    return fail("VERIFIED_FIELD_OR_ASOF_INVALID");
  hmap.set(h.horse_no,h);
 }
 const raw=draft.runners;
 if(raw.length!==hmap.size)return fail("FULL_FIELD_NOT_RANKED");
 const ranked=[];
 for(const r of raw){
  const h=hmap.get(r?.horse_no);
  if(!h||h.horse_name!==r.horse_name||!Number.isInteger(r.rank)||
     r.rank<1||r.rank>raw.length||rankSet.has(r.rank)||
     !n(r.score)||r.score<0||r.score>100||
     !["S","A","B","C","D","E","F"].includes(r.grade))
    return fail("RANK_SCORE_ROSTER_INCONSISTENT");
  rankSet.add(r.rank);ranked.push(r);
 }
 if(rankSet.size!==raw.length)return fail("RANKS_NOT_CONTIGUOUS");
 ranked.sort((a,b)=>a.rank-b.rank);
 if(ranked.some((r,i)=>r.rank!==i+1))return fail("RANKS_NOT_CONTIGUOUS");
 if(ranked.some((r,i)=>i>0&&r.score>ranked[i-1].score))
  return fail("RANK_NOT_SORTED_BY_SCORE");
 if(!Array.isArray(draft.top5)||draft.top5.length!==5||
   draft.top5.some((r,i)=>r.horse_no!==ranked[i].horse_no||
     r.rank!==ranked[i].rank||r.score!==ranked[i].score))
  return fail("TOP5_NOT_THE_SAVED_TOP_FIVE");
 const audit=draft.audit,per=audit?.official_past_content_audit?.per_runner,an=audit?.runner_evidence_audit;
 if(audit?.official_past_content_audit?.status!=="VERIFIED_WHOLE_FIELD_FACTS"||
    !Array.isArray(per)||per.length!==ranked.length||
    !Array.isArray(an)||an.length!==ranked.length)
  return fail("FULL_FIELD_SOURCE_AUDIT_REQUIRED");
 const pmap=new Map(),amap=new Map();
 for(const r of per){
  if(pmap.has(r.horse_no))return fail("DUPLICATE_EVIDENCE_ENTRY");
  pmap.set(r.horse_no,r);
 }
 for(const r of an){
  if(amap.has(r.horse_no))return fail("DUPLICATE_RUNNER_AUDIT");
  amap.set(r.horse_no,r);
 }
 for(const r of ranked){
  const h=hmap.get(r.horse_no),p=pmap.get(r.horse_no),a=amap.get(r.horse_no);
  if(!p||!a||p.score!==r.score||p.rank!==r.rank||
   !Number.isInteger(a.recent_runs_checked)||
   a.recent_runs_checked!==h.recent_runs.length||
   typeof p.assessment!=="string"||p.assessment.trim().length<8||
   typeof a.evidence_summary!=="string"||a.evidence_summary.trim().length<8||
   !validateRefs(r.horse_no,p.evidence_refs,h)||
   (h.recent_runs.length>0&&p.evidence_refs.length<1))
   return fail("RUNNER_SCORE_SOURCE_MISMATCH",[r.horse_no]);
 }
 const mathReconciled=ranked.filter(r=>ledgerMathConsistent(r,hmap.get(r.horse_no),approvedScoringPolicy));
 const scored=ranked.filter(r=>certScore(r,hmap.get(r.horse_no),approvedScoringPolicy));
 const complete=scored.length===ranked.length;
 const narrow=ranked.length>=6?{
   fifth:{horse_no:ranked[4].horse_no,score:ranked[4].score},
   sixth:{horse_no:ranked[5].horse_no,score:ranked[5].score},
   gap:ranked[4].score-ranked[5].score,
   needs_boundary_review:ranked[4].score-ranked[5].score<=4&&!complete
 }:null;
 const mismatches=repeatDraft?.runners&&Array.isArray(repeatDraft.runners)?
   JSON.stringify(scoreProjection(draft))!==JSON.stringify(scoreProjection(repeatDraft)):null;
 if(repeatDraft && (!Array.isArray(repeatDraft.runners)||
    repeatDraft.runners.length!==draft.runners.length))
   return fail("REPEAT_DRAFT_ROSTER_MISMATCH");
 if(mismatches)return {
   ok:false,status:"NON_REPRODUCIBLE",code:"SAME_INPUT_DIFFERENT_SCORE_OR_RANK",
   scorer_policy:approvedScoringPolicy?.version??null,
   changed_horse_nos:ordered(draft.runners).filter((r,i)=>{
     const o=ordered(repeatDraft.runners)[i];
     return r.horse_no!==o.horse_no||r.rank!==o.rank||
       r.score!==o.score||r.grade!==o.grade;
   }).map(x=>x.horse_no),
   score_certified:false,rank_reproducible:false,
   rank_changed:false,eye_changed:false,frozen_modified:false,
   market_used:false,target_result_used:false
 };
 return {
  ok:true,status:complete?"SOURCE_RECONCILED":"SCORER_PROVENANCE_UNVERIFIED",
  code:complete?"PROSPECTIVE_SCORES_RECONCILED":"OFFICIAL_1_6_SCORE_LEDGER_UNAVAILABLE",
  policy:LOCAL16_RANK_AUDIT_POLICY,
  same_input_replay_checked:mismatches!==null,
  rank_reproducible:mismatches===false&&complete,
  ranked_horses:ranked.length,certified_score_count:scored.length,
  ledger_math_reconciled_count:mathReconciled.length,
  missing_score_provenance_horses:ranked.filter(r=>!scored.includes(r)).map(r=>r.horse_no),
  boundary:narrow,
  scorer_policy:approvedScoringPolicy?.version??null,
  score_certified:complete,
  limits:["Current LOCAL1.6 protocol has no approved numeric point-allocation formula",
  "A descending score order proves sorting, not the original point calculation",
  "A caller-provided approval flag is not an independent scorer implementation registry",
  "A single draft cannot prove identical-input reproducibility"],
  rank_changed:false,eye_changed:false,frozen_modified:false,
  market_used:false,target_result_used:false
 };
}
/**
 * Same-track, two-day score-shape monitoring only. Not an outcome metric.
 * @param {{baseline?:any[],current?:any[],minimumRaces?:number}} [arg]
 */
export function auditLocal16BoundaryDrift({baseline,current,minimumRaces=7}={}){
 if(!Array.isArray(baseline)||!Array.isArray(current)||!current.length||
  !Number.isInteger(minimumRaces)||minimumRaces<2)
  return fail("DAY_SNAPSHOT_REQUIRED");
 const valid=x=>x&&isDate(x.race_date)&&typeof x.track==="string"&&
  Number.isInteger(x.race_no)&&x.race_no>=1&&x.race_no<=24&&
  n(x.fifth_score)&&n(x.sixth_score)&&x.fifth_score>=x.sixth_score&&
  x.protocol_version===PROTOCOL;
 if([...baseline,...current].some(x=>!valid(x)))return fail("DAY_SCORE_SNAPSHOT_INVALID");
 const groups=new Map();
 for(const p of current){const key=p.race_date+"|"+p.track;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
 }
 const warnings=[],summaries=[];
 const avg=a=>a.reduce((n,r)=>n+r.fifth_score-r.sixth_score,0)/a.length;
 for(const [key,rows]of groups){
  const day=rows[0].race_date,track=rows[0].track;
  const before=baseline.filter(x=>x.track===track&&x.race_date<day);
  const nowGap=avg(rows),prevGap=before.length?avg(before):null;
  summaries.push({key,races:rows.length,baseline_races:before.length,
    mean_gap5_6:Math.round(nowGap*100)/100,
    baseline_gap5_6:prevGap===null?null:Math.round(prevGap*100)/100});
  if(before.length>=minimumRaces&&rows.length>=minimumRaces&&
     nowGap-prevGap>=0.5)
   warnings.push({code:"SAME_TRACK_SCORE_SPACING_SHIFT",track,date:day,
    baseline_avg:Math.round(prevGap*100)/100,current_avg:Math.round(nowGap*100)/100,
    note:"Review scoring provenance; this does not establish the cause of lost winners"});
 }
 return {ok:true,status:warnings.length?"REVIEW_REQUIRED":"OBSERVED",
   warnings,summaries,rank_changed:false,eye_changed:false,
   frozen_modified:false,market_used:false,target_result_used:false};
}
