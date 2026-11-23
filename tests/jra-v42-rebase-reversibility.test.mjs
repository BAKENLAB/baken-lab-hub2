import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectScoreMethodContinuity} from '../research/jra-scoring-integrity-20261121/v42-rebase/jra-score-method-continuity.mjs';
import {inspectClaimedBaseParity} from '../research/jra-scoring-integrity-20261121/v42-rebase/jra-claimed-base-parity.mjs';

const root=new URL('../research/jra-scoring-integrity-20261121/v42-rebase/',import.meta.url);
const read=x=>readFileSync(new URL(x,root),'utf8');
const asGitBlobSha1=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const manifest=JSON.parse(read('manifest.json'));
const source=read('baseline-index.ts.txt'),candidate=read('candidate-index.ts.txt');
const replacement=JSON.parse(read('replacements.json'));
test('v42 source and derived candidate remain exact pinned Git blobs',()=>{
 assert.equal(manifest.source_mcp_version,42);
 assert.equal(asGitBlobSha1(source),manifest.source_baseline_git_blob_sha1);
 assert.equal(asGitBlobSha1(candidate),manifest.candidate_git_blob_sha1);
 assert.equal(manifest.source_to_factor_rule_connected,false);
 assert.equal(manifest.official_score_engine_approved,false);
 assert.equal(manifest.authenticated_official_original_body_reader_connected,false);
 assert.equal(manifest.production_allowed,false);
 assert.equal(manifest.rollout_approved,false);
});
test('only 4 explicit gate edits transform current v42 and fully undo to actual source',()=>{
 assert.equal(replacement.length,4);
 let forward=source;
 for(const [from,to] of replacement){
  assert.equal(forward.split(from).length-1,1);
  forward=forward.replace(from,to);
 }
 assert.equal(forward,candidate);
 let reversed=candidate;
 for(const [from,to] of replacement.slice().reverse()){
  assert.equal(reversed.split(to).length-1,1);
  reversed=reversed.replace(to,from);
 }
 assert.equal(reversed,source);
 assert.match(source,/jra-full-depth-save-gate\.mjs/);
 assert.match(candidate,/inspectClaimedBaseParity\(\{context,payload:reviewedDraft/);
 assert.match(candidate,/inspectScoreMethodContinuity\(\{/);
 assert.match(candidate,/JRA_RESEARCH_BASE_POLICY_ID/);
 assert.match(candidate,/JRA_RESEARCH_SCORE_METHOD_CONTRACT/);
});
test('v42 research method contract gate refuses unpinned caller methods and missing depth',()=>{
 const payload={audit:{score_method:'PINNED_TEST_ONLY',full_depth_comparison:true}};
 let x=inspectScoreMethodContinuity({payload,approvedMethod:'PINNED_TEST_ONLY'});
 assert.equal(x.ok,true);assert.equal(x.formal_scoring_allowed,false);
 x=inspectScoreMethodContinuity({payload,approvedMethod:''});
 assert.equal(x.reason,'TRUSTED_METHOD_PIN_UNAVAILABLE');
 x=inspectScoreMethodContinuity({payload,approvedMethod:'DIFFERENT_PIN'});
 assert.equal(x.reason,'SCORE_METHOD_DRIFT');
 x=inspectScoreMethodContinuity({payload:{audit:{score_method:'PINNED_TEST_ONLY'}},approvedMethod:'PINNED_TEST_ONLY'});
 assert.equal(x.reason,'FULL_DEPTH_COMPARISON_NOT_DECLARED');
});
test('v42 base score gate independently rejects altered points before any save',()=>{
 const context={candidates:[{horse_no:1,base_rate:'0.5'},{horse_no:2,base_rate:'0.2'}]};
 const payload={audit:{runner_history_checked:[{horse_no:1,base_score:49},{horse_no:2,base_score:38}]}};
 let x=inspectClaimedBaseParity({context,payload,serverPinnedBasePolicy:'JRA_RESEARCH_BASE_30PLUS38_V1'});
 assert.equal(x.ok,true);assert.equal(x.formal_scoring_allowed,false);
 const altered=structuredClone(payload);altered.audit.runner_history_checked[1].base_score++;
 x=inspectClaimedBaseParity({context,payload:altered,serverPinnedBasePolicy:'JRA_RESEARCH_BASE_30PLUS38_V1'});
 assert.equal(x.reason,'BASE_PARITY_MISMATCH');
 x=inspectClaimedBaseParity({context,payload,serverPinnedBasePolicy:''});
 assert.equal(x.reason,'SERVER_BASE_POLICY_NOT_PINNED');
});
