import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectActualJraScoringProtocol,classifySubmittedJraScoring} from
 '../research/jra-scoring-integrity-20261121/claim-retention/protocol-scoring-readiness.mjs';
const root=new URL('../research/jra-scoring-integrity-20261121/observations/',import.meta.url);
function read(name,expectedSha){
 const bytes=readFileSync(new URL(name,root));
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expectedSha);
 return JSON.parse(bytes);
}
const protocol=read('jra-active-protocol-asof-20261123-readonly.json',
 '4774d5c516e01a0025c88b941b23d9eb7a4c2df0');
const historic=read('jra-method-drift-nov15-21-22-readonly.json',
 ''); // replaced with exact Git SHA before CI
test('actual pinned active JRA protocol permits manual deviations but has no approved factor-coefficient engine',()=>{
 const x=inspectActualJraScoringProtocol(protocol);
 assert.equal(x.reason,'VALIDATED_BASE_PLUS_OPTIONAL_MANUAL_OVERLAY_NO_FIXED_FACTOR_WEIGHTS');
 assert.equal(x.protocol_version,'JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023');
 assert.equal(x.manual_rank_changes_permitted,true);
 assert.equal(x.content_sources_optional,true);
 assert.equal(x.approved_scoring_coefficients_found,false);
 assert.equal(x.can_certify_full_100pt,false);
 assert.equal(x.production_release_allowed,false);
});
test('all Nov15/21/22 historical JRA FROZEN audit claims cannot self-certify a fixed scoring rule',()=>{
 assert.equal(historic.rows.length,65);
 const summaries={};
 for(const row of historic.rows){
  const audit={score_method:row.declared_method,
   ...(row.has_legacy_depth?{full_depth_comparison:row.legacy_depth_true}:{}),
   full_depth_source_review:{ok:row.claimed_source_review_ok},
   fabricated_source_verified:true};
  const z=classifySubmittedJraScoring({protocolSnapshot:protocol,submittedAudit:audit});
  assert.equal(z.mode,'FULL_SCORE_UNPROVEN');
  assert.equal(z.can_certify_full_100pt,false);
  assert.equal(z.production_release_allowed,false);
  const c=summaries[row.race_date]??{total:0,missingMethod:0};
  c.total++;c.missingMethod+=Number(z.reason==='SCORE_METHOD_MISSING');
  summaries[row.race_date]=c;
 }
 assert.deepEqual(summaries,{
  '2026-11-15':{total:27,missingMethod:0},
  '2026-11-21':{total:20,missingMethod:0},
  '2026-11-22':{total:18,missingMethod:18}
 });
});
test('even server flags for a future approved scorer are only eligible for actual signed replay, not a production go',()=>{
 const x=classifySubmittedJraScoring({
  protocolSnapshot:protocol,submittedAudit:{score_method:'fake but declared'},
  serverAuthority:{originalIssuerAuthenticated:true,sameImmutableClaimContext:true,
    fullRunnerAndFactorCoverage:true,operatorApprovedNumericScorer:true,
    operatorScorerPolicySha256:'f'.repeat(64)}
 });
 assert.equal(x.mode,'ELIGIBLE_FOR_SEPARATE_FULL_SCORE_REPLAY');
 assert.equal(x.can_certify_full_100pt,false);
 assert.equal(x.production_release_allowed,false);
 assert.equal(x.requires_signed_packet_replay,true);
});
test('protocol version or fixed baseline change blocks automatic compatibility claims',()=>{
 const x=structuredClone(protocol);x.payload.version='UNAPPROVED_EDIT';
 assert.equal(inspectActualJraScoringProtocol(x).reason,'ACTIVE_PROTOCOL_VERSION_OR_VALIDATED_BASE_MISMATCH');
 const y=structuredClone(protocol);
 y.payload.content.ranking.content_evaluation_contract.when_optional_unavailable='FAIL_CLOSED';
 assert.equal(inspectActualJraScoringProtocol(y).reason,'PROTOCOL_MANUAL_OPTIONAL_RULE_CHANGED');
});
