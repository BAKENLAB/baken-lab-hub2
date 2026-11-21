import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("research/jra-claim-20261121-deployed-v34/index.ts","utf8");
test("JRA queue tool uses guarded SQL v2, never v1",()=>{
 assert.match(source,/c\.rpc\(["']jra_manual_claim_next_v2["']\)/);
 assert.doesNotMatch(source,/c\.rpc\(["']jra_manual_claim_next_v1["']\)/);
});
test("existing OAuth protected resource and owner allowlist remain",()=>{
 assert.match(source,/withOAuthProtectedResource\(\)/);
 assert.match(source,/withSupabase\(\{auth:"user"/);
 assert.match(source,/LOCAL_MCP_ALLOWED_USER_ID/);
 assert.match(source,/user\.id!==a/);
});
test("no unapproved queue protocol or emergency Cron edit",()=>{
 assert.doesNotMatch(source,/cron\.schedule\(/);
 assert.doesNotMatch(source,/jra_manual_claim_next_v3/);
});
test("guarded official FROZEN save RPC remains unchanged",()=>{
 assert.match(source,/jra_save_claimed_prediction/);
});
