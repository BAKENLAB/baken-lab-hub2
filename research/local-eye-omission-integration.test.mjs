import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const source=readFileSync(new URL("supabase/functions/local-claimed-mcp/index.ts",root),"utf8");
const edgeAudit=readFileSync(new URL("supabase/functions/local-claimed-mcp/local-eye-omission-preflight.mjs",root),"utf8");
const refAudit=readFileSync(new URL("automation/local-eye-omission-preflight.mjs",root),"utf8");
const evidenceGate=readFileSync(new URL("supabase/functions/local-claimed-mcp/local-16-evidence-save-gate.mjs",root),"utf8");
const saveStart=source.indexOf('s.registerTool("lab_save_claimed_prediction"');
const save=source.slice(saveStart);
test("edge uses exactly tested omission checker, no changed copy",()=>{
 assert.equal(edgeAudit,refAudit);
});
test("MCP v34 existing full-field evidence gate is retained and runs before omission review",()=>{
 assert.match(source,/import \{assertLocal16EvidenceHandoffForSave\}/);
 assert.match(evidenceGate,/LOCAL_16_EVIDENCE_/);
 assert.ok(save.indexOf("assertLocal16EvidenceHandoffForSave")>=0);
 assert.ok(save.indexOf("assertLocal16EvidenceHandoffForSave")<save.indexOf("auditLocalEyeOmissions"));
});
test("omission review runs after authenticated CLAIM but before guarded official save RPC",()=>{
 const auth=save.indexOf("const user=await auth()");
 const claim=save.indexOf("await claim(c,job_id)",auth);
 const audit=save.indexOf("const review=auditLocalEyeOmissions",claim);
 const reject=save.indexOf('throw Error("LOCAL_EYE_OMISSION_REVIEW_REQUIRED")',audit);
 const rpc=save.indexOf('c.rpc("lab_queue_save_prediction_with_shadow_v1"',reject);
 assert.ok(auth>=0&&claim>auth&&audit>claim&&reject>audit&&rpc>reject);
});
test("verified missing official positive evidence must fail first, no post-save audit",()=>{
 assert.match(save,/review.status==="REVIEW_REQUIRED" && eye_coverage_missing>0/);
 assert.match(save,/throw Error\("LOCAL_EYE_OMISSION_REVIEW_REQUIRED"\)/);
 assert.match(save,/throw Error\("LOCAL_EYE_FACTOR_INDEPENDENCE_REQUIRED"\)/);
});
test("context timeout does not block all official v34 saves or fabricate zero",()=>{
 assert.match(save,/eye_coverage_status="CONTEXT_UNVERIFIED"/);
 assert.match(save,/if\(officialContext\)\{/);
 assert.match(save,/catch\{\/\* Unavailable optional context is not proof of zero positives/);
 assert.match(save,/eye_coverage_status=review.status/);
 assert.match(save,/eye_coverage_status,eye_coverage_missing/);
 assert.equal((save.match(/lab_queue_save_prediction_with_shadow_v1/g)||[]).length,1);
});
test("official context only accepted from validated CLAIM and checked roster",()=>{
 assert.match(save,/o.context\?\.field_integrity_checked===true/);
 assert.match(save,/const b=await claim\(c,job_id\)/);
 assert.match(save,/b.j.claim_token!==a.j.claim_token/);
 assert.match(save,/b.r.id!==a.r.id/);
});
test("old FROZEN, direct DB writes, cron, rank and result updates remain disallowed",()=>{
 assert.doesNotMatch(save,/UPDATE official_predictions|INSERT INTO official_predictions|Cron|target_results|win_odds/i);
 assert.match(save,/original_payload=structuredClone\(payload\)/);
 assert.match(save,/assertLocalSaveDuringTransition/);
});
test("gated only for authorized LOCAL1.6 protocol, not legacy profiles",()=>{
 assert.match(save,/protocol_version==="CHAPPY_LOCAL_1\.6_EYE_FACTOR_COUNT_20261013"/);
 assert.equal((save.match(/auditLocalEyeOmissions\(\{/g)||[]).length,1);
});
