import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const source=readFileSync(new URL("supabase/functions/local-claimed-mcp/index.ts",root),"utf8");
const edgeAudit=readFileSync(new URL("supabase/functions/local-claimed-mcp/local-eye-omission-preflight.mjs",root),"utf8");
const refAudit=readFileSync(new URL("automation/local-eye-omission-preflight.mjs",root),"utf8");
test("edge uses exactly tested omission checker, no altered copy",()=>{
 assert.equal(edgeAudit,refAudit);
});
test("omission preflight runs within authenticated valid CLAIM before official save RPC",()=>{
 const auth=source.indexOf("const user=await auth()");
 const first=source.indexOf("await claim(c,job_id)",auth);
 const audit=source.indexOf("const preflight=auditLocalEyeOmissions",first);
 const block=source.indexOf('throw Error("LOCAL_EYE_COVERAGE_REVIEW_REQUIRED")',audit);
 const save=source.indexOf('c.rpc("lab_queue_save_prediction_with_shadow_v1"',block);
 assert.ok(auth>=0&&first>auth&&audit>first&&block>audit&&save>block);
});
test("missing official context fails closed, never equates missing to zero positives",()=>{
 assert.match(source,/LOCAL_EYE_COVERAGE_CONTEXT_UNVERIFIED/);
 assert.match(source,/contextResponse\.context\.field_integrity_checked!==true/);
 assert.match(source,/const validated=await claim\(c,job_id\)/);
});
test("gate scope preserves official LOCAL1.6 and no new write path",()=>{
 assert.match(source,/protocol_version==="CHAPPY_LOCAL_1\.6_EYE_FACTOR_COUNT_20261013"/);
 assert.equal((source.match(/lab_queue_save_prediction_with_shadow_v1/g)||[]).length,1);
 assert.doesNotMatch(source,/UPDATE official_predictions|INSERT INTO official_predictions/i);
});
