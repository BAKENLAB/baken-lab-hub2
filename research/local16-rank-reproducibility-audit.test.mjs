import test from "node:test";
import assert from "node:assert/strict";
import {auditLocal16RankStability,auditLocal16BoundaryDrift,
  canonicalLocal16Input} from "../automation/local16-rank-reproducibility-audit.mjs";
const p="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
const ref=(no,i=0)=>"COMPACT_V1.runners[horse_no="+no+"].recent_runs["+i+"]";
function fixture(n=8){
 const race={race_date:"2026-11-19",track:"大井",race_no:1,
 post_time:"2026-11-19T07:00:00Z",
 conditions:{distance:1400,surface:"ダート",class_name:"B2"}};
 const verifiedRunners=Array.from({length:n},(_,i)=>({
  horse_no:i+1,horse_name:"公式馬"+(i+1),
  recent_runs:[{race_date:"2026-11-10",track:"大井",distance:1400,
   surface:"ダート",going:"不良",finish:i%4+1,margin:"0.3",
   early_pos:i+1,final_turn_pos:i+1,final3f:38.1}]
 }));
 const runners=verifiedRunners.map((h,i)=>({
  horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,score:90-i*3,
  grade:i<2?"A":i<5?"B":"C",
  reason:"11/10大井1400mの公式実走と今回の相手を確認",
  evidence_summary:"11/10大井1400mの公式実走と今回の相手を確認",
  recent_runs_checked:1
 }));
 const draft={
  runners,top5:runners.slice(0,5),eye:null,bets:[],
  audit:{protocol_version:p,
   official_past_content_audit:{status:"VERIFIED_WHOLE_FIELD_FACTS",
    per_runner:runners.map(r=>({horse_no:r.horse_no,
    rank:r.rank,score:r.score,
    assessment:"過去走を確認したが今回の条件に不確実性も残る",
    evidence_refs:[ref(r.horse_no)]}))},
   runner_evidence_audit:runners.map(r=>({
    horse_no:r.horse_no,recent_runs_checked:1,
    evidence_summary:"公式レースの結果から好走材料を評価した",
    missing_items:["全ラップ"]}))}
 };
 return {race,verifiedRunners,draft,observationAt:"2026-11-19T04:00:00Z"};
}
test("genuine official evidence references don't make numeric score provenance certified",()=>{
 const x=fixture(),before=structuredClone(x);
 const r=auditLocal16RankStability(x);
 assert.equal(r.status,"SCORER_PROVENANCE_UNVERIFIED");
 assert.equal(r.certified_score_count,0);
 assert.equal(r.missing_score_provenance_horses.length,8);
 assert.equal(r.boundary.gap,3);
 assert.equal(r.boundary.needs_boundary_review,true);
 assert.equal(r.rank_changed,false);assert.equal(r.frozen_modified,false);
 assert.deepEqual(x,before);
});
test("correct roster and content may still fail if 5th/6th copied scores disagree",()=>{
 const x=fixture();x.draft.audit.official_past_content_audit.per_runner[5].score--;
 assert.equal(auditLocal16RankStability(x).code,"RUNNER_SCORE_SOURCE_MISMATCH");
});
test("rank 6 can't be silently promoted by an ascending score",()=>{
 const x=fixture();x.draft.runners[5].score=x.draft.runners[4].score+1;
 x.draft.audit.official_past_content_audit.per_runner[5].score=x.draft.runners[5].score;
 assert.equal(auditLocal16RankStability(x).code,"RANK_NOT_SORTED_BY_SCORE");
});
test("TOP5 must match actual rank and score, even if names look right",()=>{
 const x=fixture();x.draft.top5[4]={...x.draft.top5[4],score:100};
 assert.equal(auditLocal16RankStability(x).code,"TOP5_NOT_THE_SAVED_TOP_FIVE");
});
test("replaying exactly the same official inputs and scores is consistent, not scorer-certified",()=>{
 const x=fixture();x.repeatDraft=structuredClone(x.draft);
 const r=auditLocal16RankStability(x);
 assert.equal(r.ok,true);assert.equal(r.same_input_replay_checked,true);
 assert.equal(r.rank_reproducible,false);
 assert.equal(r.status,"SCORER_PROVENANCE_UNVERIFIED");
});
test("same official input yielding different score for identical horse flags nondeterminism",()=>{
 const x=fixture();x.repeatDraft=structuredClone(x.draft);
 x.repeatDraft.runners[5].score++;
 const r=auditLocal16RankStability(x);
 assert.equal(r.status,"NON_REPRODUCIBLE");
 assert.equal(r.code,"SAME_INPUT_DIFFERENT_SCORE_OR_RANK");
 assert.deepEqual(r.changed_horse_nos,[6]);
 assert.equal(x.draft.runners[5].score,75);
});
test("same official input yielding reordered ranks flags nondeterminism",()=>{
 const x=fixture();x.repeatDraft=structuredClone(x.draft);
 x.repeatDraft.runners[0].rank=2;x.repeatDraft.runners[1].rank=1;
 const r=auditLocal16RankStability(x);
 assert.equal(r.status,"NON_REPRODUCIBLE");
 assert.deepEqual(r.changed_horse_nos,[1,2]);
});
test("source signature is stable even if official runner map ordering changes",()=>{
 const x=fixture(),s=canonicalLocal16Input(x.race,x.verifiedRunners);
 const other=structuredClone(x.verifiedRunners).reverse();
 assert.equal(canonicalLocal16Input(x.race,other),s);
 other[0].recent_runs[0].final3f=37.2;
 assert.notEqual(canonicalLocal16Input(x.race,other),s);
});
test("official race result in supplied race is prohibited",()=>{
 const x=fixture();x.race.result={finishers:[]};
 assert.equal(auditLocal16RankStability(x).code,"TARGET_RESULT_CONTAMINATION");
});
test("post-start scoring is not allowed",()=>{
 const x=fixture();x.observationAt=x.race.post_time;
 assert.equal(auditLocal16RankStability(x).code,"PRE_RACE_VERIFIED_INPUT_REQUIRED");
});
test("future history cannot masquerade as past evidence",()=>{
 const x=fixture();x.verifiedRunners[3].recent_runs[0].race_date=x.race.race_date;
 assert.equal(auditLocal16RankStability(x).code,"VERIFIED_FIELD_OR_ASOF_INVALID");
});
test("another horse's COMPACT ref is refused",()=>{
 const x=fixture();x.draft.audit.official_past_content_audit.per_runner[6].evidence_refs=[ref(8)];
 assert.equal(auditLocal16RankStability(x).code,"RUNNER_SCORE_SOURCE_MISMATCH");
});
test("a fake contribution ledger with no approved implementation cannot certify score",()=>{
 const x=fixture();
 for(const r of x.draft.runners){r.score_ledger={base_score:60,
  scorer_version:"TEST",scoring_policy_ref:"FAKE",
  components:[{rule_id:"unverified",points:r.score-60,evidence_refs:[ref(r.horse_no)]}]};
 }
 const s=auditLocal16RankStability(x);
 assert.equal(s.score_certified,false);
 assert.equal(s.missing_score_provenance_horses.length,8);
});
test("standalone policy attestation arithmetic only accepted when explicit approved policy matches",()=>{
 const x=fixture();
 for(const r of x.draft.runners){r.score_ledger={base_score:60,
  scorer_version:"TEST_VERIFIED_IMPLEMENTATION",scoring_policy_ref:"APPROVED_TEST_POLICY",
  components:[{rule_id:"verified_prior_run",points:r.score-60,evidence_refs:[ref(r.horse_no)]}]};
 }
 x.approvedScoringPolicy={version:"TEST_VERIFIED_IMPLEMENTATION",
  policy_ref:"APPROVED_TEST_POLICY",implementation_verified:true,policy_approved:true};
 let s=auditLocal16RankStability(x);
 assert.equal(s.score_certified,false,"no real LOCAL1.6 scorer is independently approved");
 assert.equal(s.ledger_math_reconciled_count,8);
 assert.equal(s.status,"SCORER_PROVENANCE_UNVERIFIED");
 assert.equal(s.rank_reproducible,false,"one sample cannot prove repeatability");
 x.repeatDraft=structuredClone(x.draft);
 s=auditLocal16RankStability(x);
 assert.equal(s.rank_reproducible,false,"matching replays alone cannot certify an unapproved scorer");
});
test("tampered points do not reconcile even with a claimed policy identity",()=>{
 const x=fixture();
 for(const r of x.draft.runners){r.score_ledger={base_score:60,
  scorer_version:"T",scoring_policy_ref:"APPROVED_TEST",
  components:[{rule_id:"prior",points:r.score-60,evidence_refs:[ref(r.horse_no)]}]};
 }
 x.draft.runners[0].score_ledger.components[0].points+=5;
 x.approvedScoringPolicy={version:"T",policy_ref:"APPROVED_TEST",implementation_verified:true,policy_approved:true};
 const z=auditLocal16RankStability(x);
 assert.equal(z.certified_score_count,0);
 assert.equal(z.ledger_math_reconciled_count,7);
 assert.equal(z.score_certified,false);
});
test("actual Nov 17 / Nov 18 Oi score gaps trigger a same-track drift warning",()=>{
 const before=[2,2,1,3,4,2,2,4,2,2,1].map((g,i)=>({
  race_date:"2026-11-17",track:"大井",race_no:i<2?i+1:i+2,
  fifth_score:80,sixth_score:80-g,protocol_version:p}));
 const now=[3,4,3,3,4,3,4,2,2,2,2,3].map((g,i)=>({
  race_date:"2026-11-18",track:"大井",race_no:i+1,
  fifth_score:80,sixth_score:80-g,protocol_version:p}));
 const out=auditLocal16BoundaryDrift({baseline:before,current:now});
 assert.equal(out.ok,true);
 assert.equal(out.status,"REVIEW_REQUIRED");
 assert.equal(out.warnings[0].code,"SAME_TRACK_SCORE_SPACING_SHIFT");
 assert.equal(out.summaries[0].baseline_gap5_6,2.27);
 assert.equal(out.summaries[0].mean_gap5_6,2.92);
 assert.equal(out.frozen_modified,false);
});
test("different track cannot supply a previous-day comparison",()=>{
 const before=[2,2,1,3,4,2,2,4,2,2,1].map((g,i)=>({
  race_date:"2026-11-17",track:"園田",race_no:i+1,
  fifth_score:80,sixth_score:80-g,protocol_version:p}));
 const now=Array.from({length:9},(_,i)=>({
  race_date:"2026-11-18",track:"大井",race_no:i+1,
  fifth_score:85,sixth_score:80,protocol_version:p}));
 const out=auditLocal16BoundaryDrift({baseline:before,current:now});
 assert.equal(out.status,"OBSERVED");assert.equal(out.warnings.length,0);
});
test("identical score spacing doesn't trigger a false-alarm change",()=>{
 const base=Array.from({length:9},(_,i)=>({race_date:"2026-11-17",
  track:"大井",race_no:i+1,fifth_score:80,sixth_score:77,protocol_version:p}));
 const cur=base.map(x=>({...x,race_date:"2026-11-18"}));
 assert.equal(auditLocal16BoundaryDrift({baseline:base,current:cur}).warnings.length,0);
});
test("score profile with inverted numeric scores is invalid, not silently clipped",()=>{
 const cur=[{race_date:"2026-11-18",track:"大井",race_no:1,
 fifth_score:70,sixth_score:80,protocol_version:p}];
 assert.equal(auditLocal16BoundaryDrift({baseline:[],current:cur}).code,"DAY_SCORE_SNAPSHOT_INVALID");
});
