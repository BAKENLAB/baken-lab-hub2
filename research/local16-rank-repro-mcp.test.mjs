import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const source=readFileSync(new URL("supabase/functions/local-claimed-mcp/index.ts",root),"utf8");
const edge=readFileSync(new URL("supabase/functions/local-claimed-mcp/local16-rank-reproducibility-audit.mjs",root),"utf8");
const base=readFileSync(new URL("automation/local16-rank-reproducibility-audit.mjs",root),"utf8");
const before=source.indexOf('s.registerTool("lab_rank_repro_preflight"');
const after=source.indexOf('s.registerTool("lab_relative_rank_preview"',before);
const tool=source.slice(before,after);
test("same audited source bundled into official Edge function",()=>{
 assert.equal(edge,base);
});
test("new tool is read-only, claim-scoped and occurs outside official guarded save",()=>{
 assert.ok(before>=0&&after>before);
 assert.match(tool,/readOnlyHint:true/);
 assert.match(tool,/await auth\(\)/);
 assert.match(tool,/first=await claim\(c,job_id\)/);
 assert.match(tool,/second=await claim\(c,job_id\)/);
 assert.match(tool,/second\.j\.claim_token!==first\.j\.claim_token/);
 assert.match(tool,/auditLocal16RankStability/);
 assert.match(tool,/save_authorized:false/);
 assert.match(tool,/frozen_modified:false/);
 assert.doesNotMatch(tool,/\.rpc\(|\.upsert\(|\.insert\(|UPDATE official_predictions/i);
});
test("previous v35 EYE and v34 source-integrity guard stay in the official save flow",()=>{
 const save=source.slice(source.indexOf('s.registerTool("lab_save_claimed_prediction"'));
 assert.match(save,/assertLocalSaveDuringTransition/);
 assert.match(save,/assertLocal16EvidenceHandoffForSave/);
 assert.match(save,/auditLocalEyeOmissions/);
 assert.match(save,/lab_queue_save_prediction_with_shadow_v1/);
 assert.equal((save.match(/lab_queue_save_prediction_with_shadow_v1/g)||[]).length,1);
});
test("official 13 original + 7 transfer criteria status is preserved as informative and not a fake score",()=>{
 assert.match(tool,/local16_scoring_criteria/);
 assert.match(tool,/official_scoring_criteria_status/);
 assert.match(tool,/official_checks/);
 assert.match(tool,/official_transfer_checks/);
 assert.match(tool,/approvedScoringPolicy:null/);
});
test("v36 latest original context instruction is retained",()=>{
 assert.match(source,/local16_scoring_criteria are required inputs/);
 assert.match(source,/official 13 criteria and 7 transfer checks/);
});
