import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LOCAL16_METHOD_CONTRACT as method} from "../automation/local16-method-reference.mjs";
const root=new URL("../",import.meta.url);
const original=readFileSync(new URL("automation/local16-method-reference.mjs",root),"utf8");
const bundled=readFileSync(new URL("supabase/functions/local-claimed-mcp/local16-method-reference.mjs",root),"utf8");
const edge=readFileSync(new URL("supabase/functions/local-claimed-mcp/index.ts",root),"utf8");
const start=edge.indexOf('s.registerTool("lab_claimed_context"');
const end=edge.indexOf('s.registerTool("lab_eye_coverage_preflight"',start);
const claimed=edge.slice(start,end);
const save=edge.slice(edge.indexOf('s.registerTool("lab_save_claimed_prediction"'));
test("method contract is source-equivalent and independent of chat contents",()=>{
 assert.equal(original,bundled);
 assert.equal(method.version,"LOCAL16_20261116_PRE_RANK_METHOD_V1");
 assert.equal(method.historical_reference,"research/local16-20261116-frozen-anchors.json");
 assert.ok(method.stages.some(v=>v.includes("BEFORE assigning scores")));
 assert.ok(method.stages.some(v=>v.includes("17-item EYE")));
 assert.equal(method.score_math_certified,false);
 assert.equal(method.auto_rank_effect,false);
});
test("every authorized claimed-context tool reply includes static method reference and keeps claim guard",()=>{
 assert.ok(start>0&&end>start);
 assert.match(edge,/import \{LOCAL16_METHOD_CONTRACT\} from "\.\/local16-method-reference\.mjs";/);
 assert.match(claimed,/await claim\(c,job_id\)/);
 assert.match(claimed,/if\(b.r.id!==a.r.id\|\|b.j.claim_token!==a.j.claim_token\)throw Error\("CLAIM_CHANGED"\)/);
 assert.match(claimed,/local16_method_contract:LOCAL16_METHOD_CONTRACT/);
 assert.doesNotMatch(claimed,/\.rpc\(|UPDATE official_predictions|\.upsert\(/);
});
test("pre-save method proof is official source-gated; no trace means old protected path",()=>{
 assert.match(edge,/reference_method_version:LOCAL16_METHOD_CONTRACT.version/);
 assert.match(save,/const pairwiseTrace=payload.audit.local16_full_field_pairwise_trace/);
 assert.match(save,/if\(!traceVerificationContext\)/);
 assert.match(save,/if\(payload\?\.audit\?\.local16_full_field_pairwise_trace!==undefined\)\{/);
 assert.match(save,/facts:traceVerificationContext.official_past_content/);
 assert.match(save,/p_payload:payload,p_original_payload:original_payload/);
 assert.match(save,/lab_queue_save_prediction_with_shadow_v1/);
 assert.doesNotMatch(save,/UPDATE official_predictions|delete\(\)|\.upsert\(/);
});
