// Research-only. This checks a scoring contract interface, NOT genuine official
// JRA authentication, an approved production policy or production readiness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFixedScoreContract } from '../research/jra-scoring-integrity-20261121/claim-retention/fixed-score-contract.candidate.mjs';
const digest=n=>n.repeat(64);
const policySha=digest('a'),contextSha=digest('b'),rawSha=digest('c');
function fixture(){
  const source_ref='JRA_HISTORY_ARCHIVE_ID_FOR_SYNTHETIC_TEST';
  const fact={kind:'margin',source_ref,points:3,original_sha256:rawSha,
    run_id:'synthetic-run-1',horse_id:'synthetic-horse-1',rule_sha256:policySha,
    verified_by_source_reader:true};
  const payload={runners:[{horse_no:1,horse_name:'テスト馬',rank:1,score:43}],
    audit:{runner_history_checked:[{horse_no:1,base_score:40,score_after:43,
      evidence_effects:[{kind:'margin',source_ref,points:3}]}]}};
  const selected={serverPinnedContract:{policy_id:'RESEARCH_FIXTURE_UNAPPROVED_V1',
      scorer_version:'RESEARCH_FIXTURE_UNAPPROVED_V1',policy_sha256:policySha,
      approved_by_operator:true},
    context_sha256:contextSha,
    serverEvaluated:{policy_id:'RESEARCH_FIXTURE_UNAPPROVED_V1',
      policy_sha256:policySha,context_sha256:contextSha,
      runners:[{horse_no:1,base_score:40,factors:[fact]}]},
    serverBaseProofs:[{horse_no:1,base_score:40,policy_sha256:policySha,
      input_sha256:digest('d'),generated_by_pinned_scorer:true}],
    verifiedSourceFacts:[{horse_no:1,source_ref,original_sha256:rawSha,
      run_id:'synthetic-run-1',horse_id:'synthetic-horse-1',
      verified_by_official_reader:true}]};
  return {payload,selected};
}
test('identical synthetic source-and-rule-bound inputs replay same declared result, never authorize production',()=>{
  const x=fixture(),before=structuredClone(x),a=checkFixedScoreContract(x),
    b=checkFixedScoreContract(structuredClone(x));
  assert.deepEqual(a,b);assert.deepEqual(x,before);assert.equal(a.ok,true);
  assert.equal(a.reason,'DECLARED_SCORE_MATCHES_SEPARATE_SERVER_PACKET_ONLY');
  assert.equal(a.formal_scoring_allowed,false);
  assert.equal(a.official_original_verified,false);
  assert.equal(a.checks[0].score_before_bridge,43);
});
test('unapproved/unpinned or unavailable generated base blocks official fact-to-score claim',()=>{
  const x=fixture();x.selected.serverPinnedContract.approved_by_operator=false;
  assert.equal(checkFixedScoreContract(x).reason,'TRUSTED_FIXED_SCORE_CONTRACT_MISSING');
  const y=fixture();y.selected.serverBaseProofs=[];
  assert.equal(checkFixedScoreContract(y).reason,'BASE_SCORE_GENERATOR_PROOF_MISSING');
});
test('surrogate claimed-context source is rejected even when fake proofs match',()=>{
  const x=fixture(),fake='CLAIMED_CONTEXT_RUN:1:0';
  x.payload.audit.runner_history_checked[0].evidence_effects[0].source_ref=fake;
  x.selected.serverEvaluated.runners[0].factors[0].source_ref=fake;
  x.selected.verifiedSourceFacts[0].source_ref=fake;
  assert.equal(checkFixedScoreContract(x).reason,'SURROGATE_CLAIMED_CONTEXT_REF_NOT_IMMUTABLE');
});
test('mismatched source runner or source hash rejects prior to any scoring authorization',()=>{
  const x=fixture();x.selected.verifiedSourceFacts[0].run_id='wrong-run';
  assert.equal(checkFixedScoreContract(x).reason,'FACTOR_NOT_BOUND_TO_SELECTED_OFFICIAL_RUN');
  const y=fixture();y.selected.serverEvaluated.runners[0].factors[0].original_sha256=digest('e');
  assert.equal(checkFixedScoreContract(y).reason,'FACTOR_NOT_BOUND_TO_SELECTED_OFFICIAL_RUN');
});
test('declared per-factor weight is not silently substituted for independently calculated rule output',()=>{
  const x=fixture();x.payload.audit.runner_history_checked[0].evidence_effects[0].points=4;
  assert.equal(checkFixedScoreContract(x).reason,'SUBMITTED_FACT_POINTS_NOT_REPRODUCED');
  const y=fixture();y.selected.serverEvaluated.runners[0].factors[0].points=2;
  assert.equal(checkFixedScoreContract(y).reason,'SUBMITTED_FACT_POINTS_NOT_REPRODUCED');
});
test('final score cannot drift without separately verified bridge',()=>{
  const x=fixture();x.payload.runners[0].score=44;
  assert.equal(checkFixedScoreContract(x).reason,'FINAL_SCORE_NOT_REPRODUCED_OR_BRIDGE_UNVERIFIED');
});
test('full-field completeness and scorer context digest are required',()=>{
  const x=fixture();x.payload.runners.push({horse_no:2,horse_name:'馬2',score:20,rank:2});
  assert.equal(checkFixedScoreContract(x).reason,'FULL_FIELD_REPLAY_COVERAGE');
  const y=fixture();y.selected.serverEvaluated.context_sha256=digest('f');
  assert.equal(checkFixedScoreContract(y).reason,'SERVER_REPLAY_PACKET_MISSING_OR_UNBOUND');
});
