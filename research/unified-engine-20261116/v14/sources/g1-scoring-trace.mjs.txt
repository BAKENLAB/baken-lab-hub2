/**
 * G1 INTELLIGENCE / score attribution against the existing JRA0.4 official
 * Eval+pace score preview. This is a read-only VALIDATOR, not a new scorer.
 * No automatic G1 bonuses. Do not use retrospective G1 scores as evidence.
 */
const fail=(reason,extra={})=>({version:"JRA_G1_SCORE_TRACE_V1",status:"BLOCKED",reason,
 score_delta_from_g1:0,rank_changed_by_g1:false,save_authorized:false,
 frozen_modified:false,market_used:false,target_result_used:false,...extra});
const isNo=x=>Number.isInteger(x)&&x>=1&&x<=24;
const n=x=>Number.isInteger(x)&&x>=0&&x<=100;
const norm=x=>String(x??"").normalize("NFKC").trim();
const runRef=(horseNo,index)=>"JRA_CLAIMED_CONTEXT.runner_history[horse_no="+horseNo+"].past_runs["+index+"]";
export function reconcileG1ScoringTrace({context,originalPayload,rankPreview,g1Audit,observedAt}={}){
 if(g1Audit?.status==="SKIPPED_NON_G1")
  return {version:"JRA_G1_SCORE_TRACE_V1",status:"SKIPPED_NON_G1",score_delta_from_g1:0,
    save_authorized:false,frozen_modified:false};
 if(g1Audit?.status!=="READY_READ_ONLY_REVIEW"||!g1Audit.full_field_verified)
  return fail("G1_AUDIT_NOT_READY");
 if(context?.stage!=="AWAITING_JRA_FULL_DEPTH_COMPARISON"||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(context?.race?.race_date??""))
  return fail("UNVERIFIED_OFFICIAL_PRE_RACE_CONTEXT");
 const now=Date.parse(observedAt??""),post=Date.parse(context?.race?.post_time??"");
 if(!Number.isFinite(now)||!Number.isFinite(post)||now>=post)
  return fail("NOT_BEFORE_OFFICIAL_POST_TIME");
 const original=originalPayload?.runners,changed=rankPreview?.proposed_payload?.runners,
  auditRows=rankPreview?.proposed_payload?.audit?.evidence_rank_bridge?.per_runner;
 if(!["READY_FOR_OFFICIAL_SAVE","EYE_REAUDIT_REQUIRED"].includes(rankPreview?.status))
  return fail("OFFICIAL_JRA_PREVIEW_NOT_READY");
 if(!Array.isArray(original)||!Array.isArray(changed)||!Array.isArray(auditRows)||
    original.length!==g1Audit.field_count||changed.length!==original.length||
    auditRows.length!==original.length||
    !Array.isArray(g1Audit.per_runner)||g1Audit.per_runner.length!==original.length)
  return fail("FULL_FIELD_NOT_ALIGNED");
 const before=new Map(),after=new Map(),proofs=new Map(),g1=new Map(),hist=new Map();
 for(const h of context?.runner_history??[]){
  if(!isNo(h?.horse_no)||hist.has(h.horse_no)||!Array.isArray(h.past_runs))
    return fail("HISTORY_NOT_ALIGNED");
  hist.set(h.horse_no,h);
 }
 for(const r of original){
  if(!isNo(r?.horse_no)||before.has(r.horse_no)||!n(r.score)||!Number.isInteger(r.rank)||
     r.rank<1||r.rank>original.length||!norm(r.horse_name))return fail("DRAFT_SCORE_INVALID");
  before.set(r.horse_no,r);
 }
 for(const r of changed){
  if(!isNo(r?.horse_no)||after.has(r.horse_no)||!n(r.score)||!Number.isInteger(r.rank)||
     !before.has(r.horse_no)||norm(r.horse_name)!==norm(before.get(r.horse_no).horse_name))
    return fail("PROPOSED_SCORE_INVALID");
  after.set(r.horse_no,r);
 }
 for(const a of auditRows){
  if(!isNo(a?.horse_no)||proofs.has(a.horse_no)||!before.has(a.horse_no))
    return fail("BRIDGE_PROOF_IDENTITY_INVALID");
  proofs.set(a.horse_no,a);
 }
 for(const h of g1Audit.per_runner){
  if(!isNo(h?.horse_no)||g1.has(h.horse_no)||!before.has(h.horse_no)||
     norm(h.horse_name)!==norm(before.get(h.horse_no).horse_name))
    return fail("G1_FIELD_IDENTITY_MISMATCH");
  g1.set(h.horse_no,h);
 }
 if(after.size!==before.size||proofs.size!==before.size||g1.size!==before.size||
    hist.size!==before.size)return fail("FIELD_COVERAGE_MISMATCH");
 const rankSet=new Set([...after.values()].map(x=>x.rank));
 if(rankSet.size!==before.size||[...rankSet].some(x=>x<1||x>before.size))
  return fail("FINAL_RANK_NOT_PERMUTATION");
 const shownTop=rankPreview.proposed_payload.top5??[];
 const top=[...after.values()].sort((a,b)=>a.rank-b.rank).slice(0,5);
 if(shownTop.length!==5||top.some((x,i)=>x.horse_no!==shownTop[i].horse_no))
  return fail("TOP5_NOT_ALIGNED");
 const perRunner=[];
 for(const [no,b] of before){
  const a=after.get(no),p=proofs.get(no),g=g1.get(no),h=hist.get(no);
  const refs=p.verified_run_refs;
  if(!n(p.score_before)||!n(p.score_after)||!Number.isInteger(p.applied_delta)||
     p.horse_no!==no||p.score_before!==b.score||p.score_after!==a.score||
     p.applied_delta!==a.score-b.score||p.applied_delta<0||p.applied_delta>2||
     !Array.isArray(refs)||new Set(refs).size!==refs.length)
    return fail("OFFICIAL_SCORE_PROVENANCE_MISMATCH",{horse_no:no});
  if(refs.length===0&&p.applied_delta!==0)return fail("DELTA_WITHOUT_OFFICIAL_PROOF",{horse_no:no});
  for(const ref of refs){
   const idx=h.past_runs.findIndex((_,i)=>ref===runRef(no,i));
   if(idx<0||h.past_runs[idx]?.race_date>=context.race.race_date||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(h.past_runs[idx]?.race_date??""))
    return fail("OFFICIAL_PROOF_NOT_AS_OF_RUN",{horse_no:no});
  }
  perRunner.push({horse_no:no,horse_name:norm(b.horse_name),rank_before:b.rank,rank_after:a.rank,
    score_before:b.score,score_after:a.score,official_bridge_delta:p.applied_delta,
    already_scored_verified_run_refs:[...refs],
    g1_auto_delta:0,g1_assessment_rank_4_to_10:g.near_top5_boundary===true,
    g1_close_loss_review_count:g.prior_close_losses_to_review,
    external_g1_evidence_not_verified:g.external_pre_race_checks_required??[],
    integration:"EXISTING_HUB_SCORE_ONLY_NO_AUTO_G1_BONUS"});
 }
 return {version:"JRA_G1_SCORE_TRACE_V1",status:rankPreview.status==="EYE_REAUDIT_REQUIRED"?
   "TRACE_VALID_EYE_REAUDIT_REQUIRED":"TRACE_VALID_NO_NEW_G1_BONUS",
  official_preview_status:rankPreview.status,field_count:perRunner.length,
  score_delta_from_g1:0,rank_changed_by_g1:false,
  official_bridge_delta_count:perRunner.filter(x=>x.official_bridge_delta>0).length,
  runner_recheck_count:perRunner.filter(x=>x.g1_assessment_rank_4_to_10).length,
  per_runner:perRunner,score_provenance_verified_against_existing_bridge:true,
  no_independent_g1_scoring_policy_certified:true,
  next_action:"REVIEW_UNVERIFIED_PRE_RACE_FACTS_AND_RECOMPUTE_WITH_EXISTING_HUB_100PT_CRITERIA_IF_VERIFIED",
  save_authorized:false,frozen_modified:false,market_used:false,target_result_used:false};
}
