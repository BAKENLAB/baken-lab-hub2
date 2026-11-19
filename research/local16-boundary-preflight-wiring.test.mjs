import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const edge=readFileSync(new URL("supabase/functions/local-claimed-mcp/index.ts",root),"utf8");
const source=readFileSync(new URL("automation/local16-pre-freeze-boundary-proof.mjs",root),"utf8");
const deployedCopy=readFileSync(new URL("supabase/functions/local-claimed-mcp/local16-pre-freeze-boundary-proof.mjs",root),"utf8");
const a=edge.indexOf('s.registerTool("lab_rank_repro_preflight"');
const b=edge.indexOf('s.registerTool("lab_relative_rank_preview"',a);
const rankTool=edge.slice(a,b);
const save=edge.slice(edge.indexOf('s.registerTool("lab_save_claimed_prediction"'));
test("pre-freeze proof source exactly matches official MCP bundled module",()=>{
 assert.equal(source,deployedCopy);
});
test("integration is read-only, on an official live claim, never writes FROZEN",()=>{
 assert.ok(a>0&&b>a);
 assert.match(edge,/import \{auditLocal16PreFreezeBoundary\} from ".\/local16-pre-freeze-boundary-proof.mjs";/);
 assert.match(rankTool,/readOnlyHint:true/);
 assert.match(rankTool,/await claim\(c,job_id\)/);
 assert.match(rankTool,/const boundaryProof=auditLocal16PreFreezeBoundary/);
 assert.match(rankTool,/comparison:inspected.audit\?\.local16_boundary_comparison\?\?null/);
 assert.match(rankTool,/boundary_proof:boundaryProof/);
 assert.match(rankTool,/save_authorized:false/);
 assert.doesNotMatch(rankTool,/\.rpc\(|UPDATE official_predictions|\.upsert\(/);
 assert.doesNotMatch(save,/auditLocal16PreFreezeBoundary/);
});
test("existing LOCAL1.6 save and EYE gates are preserved",()=>{
 assert.match(save,/assertLocal16EvidenceHandoffForSave/);
 assert.match(save,/auditLocalEyeOmissions/);
 assert.match(save,/lab_queue_save_prediction_with_shadow_v1/);
 assert.equal((save.match(/lab_queue_save_prediction_with_shadow_v1/g)||[]).length,1);
});
