import test from "node:test";
import assert from "node:assert/strict";
import {reconcileG1ScoringTrace} from "../../supabase/functions/jra-claimed-mcp/g1-scoring-trace.mjs";
const testCase=()=>{
 const orig=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:"Horse "+(i+1),score:90-i*5,rank:i+1}));
 const changed=orig.map((x,i)=>i===5?{...x,score:x.score+1}:({...x}));
 const rows=orig.map((x,i)=>({horse_no:x.horse_no,score_before:x.score,score_after:changed[i].score,
  applied_delta:changed[i].score-x.score,
  verified_run_refs:i===5?["JRA_CLAIMED_CONTEXT.runner_history[horse_no=6].past_runs[0]"]:[]}));
 return {observedAt:"2026-11-21T04:00:00+09:00",context:{stage:"AWAITING_JRA_FULL_DEPTH_COMPARISON",race:{race_date:"2026-11-22",post_time:"2026-11-22T15:40:00+09:00"},
  runner_history:orig.map(x=>({horse_no:x.horse_no,past_runs:[{race_date:"2026-09-01"}]}))},
  originalPayload:{runners:orig},
  rankPreview:{status:"READY_FOR_OFFICIAL_SAVE",proposed_payload:{runners:changed,top5:changed.slice(0,5),
   audit:{evidence_rank_bridge:{per_runner:rows}}}},
  g1Audit:{status:"READY_READ_ONLY_REVIEW",full_field_verified:true,field_count:6,
   per_runner:orig.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name,
    near_top5_boundary:x.rank>=4,prior_close_losses_to_review:1,external_pre_race_checks_required:["PRE_RACE_TRAINER_COMMENT"]}))}
 };
};
test("verified existing +1 is attributed to bridge, no G1 bonus",()=>{
 const x=testCase(),before=JSON.stringify(x),r=reconcileG1ScoringTrace(x);
 assert.equal(r.status,"TRACE_VALID_NO_NEW_G1_BONUS");
 assert.equal(r.official_bridge_delta_count,1);
 assert.equal(r.score_delta_from_g1,0);
 assert.equal(r.per_runner[5].already_scored_verified_run_refs.length,1);
 assert.equal(r.per_runner[5].g1_auto_delta,0);
 assert.equal(JSON.stringify(x),before);
});
test("blocks change with no verified run proof",()=>{
 const x=testCase();x.rankPreview.proposed_payload.audit.evidence_rank_bridge.per_runner[5].verified_run_refs=[];
 assert.equal(reconcileG1ScoringTrace(x).status,"BLOCKED");
});
test("blocks wrong baseline reconciliation",()=>{
 const x=testCase();x.rankPreview.proposed_payload.audit.evidence_rank_bridge.per_runner[5].score_before=70;
 assert.equal(reconcileG1ScoringTrace(x).reason,"OFFICIAL_SCORE_PROVENANCE_MISMATCH");
});
test("blocks target-race evidence ref",()=>{
 const x=testCase();x.context.runner_history[5].past_runs[0].race_date="2026-11-22";
 assert.equal(reconcileG1ScoringTrace(x).reason,"OFFICIAL_PROOF_NOT_AS_OF_RUN");
});
test("blocks wrong runner identity",()=>{
 const x=testCase();x.g1Audit.per_runner[0].horse_name="UNKNOWN";
 assert.equal(reconcileG1ScoringTrace(x).reason,"G1_FIELD_IDENTITY_MISMATCH");
});
test("blocks duplicate evidence refs",()=>{
 const x=testCase();const a=x.rankPreview.proposed_payload.audit.evidence_rank_bridge.per_runner[5];a.verified_run_refs.push(a.verified_run_refs[0]);
 assert.equal(reconcileG1ScoringTrace(x).reason,"OFFICIAL_SCORE_PROVENANCE_MISMATCH");
});
test("blocks incomplete full field",()=>{
 const x=testCase();x.g1Audit.per_runner.pop();
 assert.equal(reconcileG1ScoringTrace(x).reason,"FULL_FIELD_NOT_ALIGNED");
});
test("blocks top5 mismatch",()=>{
 const x=testCase();x.rankPreview.proposed_payload.top5.reverse();
 assert.equal(reconcileG1ScoringTrace(x).reason,"TOP5_NOT_ALIGNED");
});
test("requires valid official preview and G1 audit",()=>{
 const x=testCase();x.rankPreview.status="NOT_READY";
 assert.equal(reconcileG1ScoringTrace(x).reason,"OFFICIAL_JRA_PREVIEW_NOT_READY");
 x.rankPreview.status="READY_FOR_OFFICIAL_SAVE";x.g1Audit.status="BLOCKED";
 assert.equal(reconcileG1ScoringTrace(x).reason,"G1_AUDIT_NOT_READY");
});
test("no automatic rank change after an EYE re-audit required preview",()=>{
 const x=testCase();x.rankPreview.status="EYE_REAUDIT_REQUIRED";
 const r=reconcileG1ScoringTrace(x);
 assert.equal(r.status,"TRACE_VALID_EYE_REAUDIT_REQUIRED");assert.equal(r.save_authorized,false);
});
test("non-G1 is skipped without score effects",()=>{
 const x=testCase();x.g1Audit.status="SKIPPED_NON_G1";
 const r=reconcileG1ScoringTrace(x);assert.equal(r.status,"SKIPPED_NON_G1");
});

test("rejects post-time scoring inspection even if other audit status is spoofed",()=>{
 const x=testCase();x.observedAt="2026-11-22T16:00:00+09:00";
 assert.equal(reconcileG1ScoringTrace(x).reason,"NOT_BEFORE_OFFICIAL_POST_TIME");
});
test("rejects scoring trace without a trustworthy observation time",()=>{
 const x=testCase();delete x.observedAt;
 assert.equal(reconcileG1ScoringTrace(x).reason,"NOT_BEFORE_OFFICIAL_POST_TIME");
});
