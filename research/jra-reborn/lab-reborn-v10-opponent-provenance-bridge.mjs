import {auditOpponentEvidence} from "./lab-reborn-v06-rival-evidence.mjs";

/**
 * LAB REBORN v10 — independent, VERIFIED AS-OF opponent evidence gateway.
 *
 * Resolves prior meeting -> rival later podium before TARGET date. This only
 * audits rival identity/provenance from v06 and reports missing graded
 * information; it does NOT add an unvalidated opponent score bonus.
 * It may later feed v03's rival_strength axis, after matched-period uplift
 * is independently validated and source parity holds.
 */
export function auditFrozenFieldOpponents(snapshot,rivalRows=[]){
 const fail=reason=>({status:"RIVAL_BRIDGE_REJECTED",reason,
  production_write:false,rank_modified:false});
 const p=snapshot?.payload??snapshot;
 const date=snapshot?.race_date??p?.race_date,track=snapshot?.track??p?.track;
 const no=snapshot?.race_no??p?.race_no,
  saved=snapshot?.saved_at??p?.saved_at,
  post=snapshot?.source_post_time??p?.source_post_time;
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(String(date))||
  !track||!Number.isInteger(+no)||+no<1||+no>12||
  !saved||!post||!(Date.parse(saved)<Date.parse(post))||
  !Array.isArray(p?.runners)||p.runners.length<6||
  p.runners.length!==+p.field_size||!Array.isArray(rivalRows))
  return fail("INVALID_OR_NON_PRESTART_SOURCE");
 const codes=new Set();
 for(const h of p.runners){
  if(!/^\d{10}$/.test(String(h.horse_code))||codes.has(h.horse_code)||
     !Array.isArray(h.history)||h.history.some(x=>x.race_date>=date))
    return fail("INVALID_HORSE_IDENTITIES");
  codes.add(h.horse_code);
 }
 // Unlike auditOpponentEvidence's per-row skip, here reject any mixed target
 // outright: a single cross-race row must not contaminate the slate.
 for(const r of rivalRows){
  if(r.target_date!==date||r.target_track!==track||
     +r.target_no!==+no||!codes.has(r.target_horse_code))
    return fail("MIXED_TARGET_RIVAL_PACKET");
  if(!(r.meeting_date<r.later_date&&r.later_date<date))
    return fail("FUTURE_OR_INVALID_RIVAL_DATE");
 }
 const each=[];
 for(const h of p.runners){
  const rows=rivalRows.filter(r=>r.target_horse_code===h.horse_code);
  const analyzed=auditOpponentEvidence(rows,date,h.horse_code);
  if(analyzed.status!=="RESEARCH_OPPONENT_EVIDENCE_READY"||
      analyzed.skipped.identity>0||analyzed.skipped.date>0)
    return fail("BAD_RIVAL_IDENTITY_OR_DATE");
  each.push({
    horse_no:+h.horse_no,horse_name:h.horse_name,
    horse_code:h.horse_code,
    raw_candidate_rows:rows.length,
    accepted_comparable_followups:analyzed.matched_prior_followups,
    proven_graded_followup_rivals:analyzed.graded_future_podium_rival_count,
    ungraded_open_unknown_rivals:analyzed.open_unknown_grade_future_podium_rival_count,
    source_issues:analyzed.skipped,
    asof_examples:analyzed.evidence.slice(0,3)
  });
 }
 return {
   status:"ASOF_OPPONENT_EVIDENCE_AUDIT_NOT_SCORE",
   race_date:date,track,race_no:+no,runner_count:each.length,
   total_raw_rows:rivalRows.length,
   total_accepted:each.reduce((a,x)=>a+x.accepted_comparable_followups,0),
   runners_with_graded_proof:each.filter(x=>x.proven_graded_followup_rivals>0).length,
   runners_with_any_valid_context:each.filter(x=>x.accepted_comparable_followups>0).length,
   evidence_coverage:"PARTIAL_OFFICIAL_2024_2026_GRADE_REGISTRY",
   source_timestamp_asof:saved,
   runners:each,
   score_delta:0,rank_modified:false,
   no_rank_frozen_or_published:true,
   target_results_used:false,odds_used:false,old_lab_used:false,
   production_write:false
 };
}
