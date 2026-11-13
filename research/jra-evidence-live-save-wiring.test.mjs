import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../supabase/functions/jra-claimed-mcp/index.ts',import.meta.url),'utf8');
test('JRA official save calls whole-field evidence scorer BEFORE the original guarded FROZEN RPC',()=>{
 const block=src.slice(src.indexOf('s.registerTool("jra_save_claimed_prediction"'),
   src.indexOf('s.registerTool("jra_queue_claim_next"'));
 assert.ok(block.includes('loadEvalForClaim(context,c)'));
 assert.ok(block.includes('buildJraVerifiedEvidenceRankBridge('));
 assert.ok(block.includes('savedPayload=preview.proposed_payload'));
 assert.ok(block.includes('p_payload:savedPayload'));
 assert.ok(block.indexOf('buildJraVerifiedEvidenceRankBridge(')<
   block.indexOf('jra_save_claimed_prediction_with_shadow_v1'));
 assert.ok(block.includes('verifyJraBridgeAlreadyApplied('));
 assert.ok(block.includes('JRA_EVIDENCE_EYE_REAUDIT_REQUIRED'));
 assert.ok(block.includes('evidence_rank_bridge'));
 assert.ok(block.includes('score_changed_runner_count'));
});
test('no new CLAIM, postrace write, Cron or direct DB modifications in evidence finalizer',()=>{
 const helper=readFileSync(new URL('../automation/jra-verified-evidence-rank-bridge.mjs',import.meta.url),'utf8');
 assert.equal(/\.from\(|\.rpc\(|\bfetch\(|\bupdate\(|\binsert\(/.test(helper),false);
 assert.ok(src.includes('jra_save_claimed_prediction_with_shadow_v1'));
 assert.ok(src.includes('jra_manual_claim_next_v1'));
 assert.ok(src.includes("PRIVATE_EVAL_PRIORITIES?.scope==='NORMAL_ALL_1942'"));
});
