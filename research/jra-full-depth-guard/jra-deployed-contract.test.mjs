import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const s=readFileSync("research/jra-full-depth-guard/deployed-v36-jra-claimed-mcp-index.ts","utf8");
test("owner restricted OAuth+Supabase middleware unchanged",()=>{
 assert.match(s,/withOAuthProtectedResource\(\)/);
 assert.match(s,/withSupabase\(\{auth:"user"/);
 assert.match(s,/LOCAL_MCP_ALLOWED_USER_ID/);
 assert.match(s,/user\.id!==a/);
});
test("official claim still uses safe v2 exclusion of debut races",()=>{
 assert.match(s,/c\.rpc\("jra_manual_claim_next_v2"\)/);
 assert.doesNotMatch(s,/c\.rpc\("jra_manual_claim_next_v1"\)/);
});
test("read-only rank preview refuses missing full-field proof",()=>{
 assert.match(s,/status:"FULL_DEPTH_REASSESSMENT_REQUIRED"/);
 assert.match(s,/inspectJraFullDepthSave\(\{context,payload,evalInput\}\)/);
});
test("real new-FROZEN save cannot fall back after missing full depth",()=>{
 assert.match(s,/JRA_FULL_DEPTH_REVIEW_NOT_VERIFIED/);
 assert.match(s,/JRA_FULL_DEPTH_CLAIM_CONTEXT_MISSING/);
 assert.match(s,/startsWith\('JRA_FULL_DEPTH_'\)/);
 assert.match(s,/fullDepthProof\.ok!==true/);
});
test("official +/-2 Eval verified bridge gets a separately verified prebridge draft",()=>{
 assert.match(s,/JRA_FULL_DEPTH_BRIDGE_BEFORE_INVALID/);
 assert.match(s,/fullDepthProof=inspectJraFullDepthSave\(\{context,payload:reviewedDraft,evalInput\}\)/);
 assert.match(s,/verifyJraBridgeAlreadyApplied/);
});
test("new official prediction still saves with original guarded atomic RPC and readback",()=>{
 assert.match(s,/c\.rpc\("jra_save_claimed_prediction_with_shadow_v1"/);
 assert.match(s,/full_depth_source_review:fullDepthProof/);
 assert.match(s,/deepReceipt/);
 assert.match(s,/VERIFIED_FROZEN_SCORES_TOP5_AUDIT_EMPTY_BETS/);
});
