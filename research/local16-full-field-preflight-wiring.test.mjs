import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const edge=readFileSync(new URL("supabase/functions/local-claimed-mcp/index.ts",root),"utf8");
const source=readFileSync(new URL("automation/local16-full-field-pairwise-proof.mjs",root),"utf8");
const bundled=readFileSync(new URL("supabase/functions/local-claimed-mcp/local16-full-field-pairwise-proof.mjs",root),"utf8");
const preStart=edge.indexOf('s.registerTool("lab_rank_repro_preflight"');
const preEnd=edge.indexOf('s.registerTool("lab_relative_rank_preview"',preStart);
const tool=edge.slice(preStart,preEnd);
const save=edge.slice(edge.indexOf('s.registerTool("lab_save_claimed_prediction"'));
test("full-field proof is exact-source mirrored",()=>{
 assert.equal(source,bundled);
});
test("full-field pre-rank proof runs on verified live CLAIM read-only route",()=>{
 assert.ok(preStart>0&&preEnd>preStart);
 assert.match(edge,/import \{auditLocal16FullFieldPairwise\} from "\.\/local16-full-field-pairwise-proof.mjs";/);
 assert.match(tool,/readOnlyHint:true/);
 assert.match(tool,/await claim\(c,job_id\)/);
 assert.match(tool,/facts:data.context.official_past_content/);
 assert.match(tool,/pairwiseTrace:inspected.audit\?\.local16_full_field_pairwise_trace\?\?null/);
 assert.match(tool,/full_field_pairwise_proof:fullFieldProof/);
 assert.match(tool,/save_authorized:false/);
 assert.doesNotMatch(tool,/\.rpc\(|UPDATE official_predictions|\.upsert\(/);
 assert.match(save,/const pairwiseTrace=payload.audit\?\.local16_full_field_pairwise_trace/);
 assert.match(save,/if\(!traceVerificationContext\)/);
 assert.match(save,/const proof=auditLocal16FullFieldPairwise/);
 assert.match(save,/facts:officialContext.official_past_content/);
 assert.match(save,/pairwise_trace_status=proof.status/);
 assert.match(save,/p_payload:payload,p_original_payload:original_payload/);
 assert.match(save,/lab_queue_save_prediction_with_shadow_v1/);

});
test("no change to original LOCAL1.6 FROZEN save guard",()=>{
 assert.match(save,/assertLocal16EvidenceHandoffForSave/);
 assert.match(save,/auditLocalEyeOmissions/);
 assert.match(save,/lab_queue_save_prediction_with_shadow_v1/);
});
