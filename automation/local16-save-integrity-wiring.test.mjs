import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('supabase/functions/local-claimed-mcp/index.ts','utf8');
const publicError=readFileSync('supabase/functions/local-claimed-mcp/queue-operation.mjs','utf8');
const optional=readFileSync('supabase/functions/local-claimed-mcp/local16-optional-trace-save-gate.mjs','utf8');
const save=source.slice(source.indexOf('s.registerTool("lab_save_claimed_prediction"'));
test('real deployed-style MCP wires official trace to a guarded save, not to rating',()=>{
 assert.match(source,/import \{verifyOptionalLocal16TraceForSave\}/);
 assert.match(save,/assertLocal16EvidenceHandoffForSave\(\{protocol_version,payload\}\)/);
 assert.match(save,/assertLocalSaveDuringTransition\(/);
 assert.match(save,/auditLocalEyeOmissions\(/);
 assert.match(save,/verifyOptionalLocal16TraceForSave\(/);
 assert(save.indexOf('const traceCheck=verifyOptionalLocal16TraceForSave')>
   save.indexOf('assertLocal16EvidenceHandoffForSave'));
 assert(save.indexOf('const traceCheck=verifyOptionalLocal16TraceForSave')<
   save.indexOf('c.rpc("lab_queue_save_prediction_with_shadow_v1"'));
 assert.match(save,/scoring_trace_status:traceCheck.status/);
});
test('trace is optional, but rejected without verified context when presented',()=>{
 assert.match(optional,/if\(absent\)return \{status:"NOT_PROVIDED"/);
 assert.match(optional,/LOCAL_16_TRACE_CONTEXT_UNAVAILABLE/);
 assert.match(optional,/LOCAL_16_TRACE_INVALID/);
 assert.match(publicError,/LOCAL_16_TRACE_/);
});
test('guard must not rewrite FROZEN, approve weights, or alter EYE selector',()=>{
 assert(!optional.includes("c.rpc("));
 assert(!optional.includes("supabase"));
 assert.match(source,/lab_queue_save_prediction_with_shadow_v1/);
 assert.match(source,/assertLocal16NoUnauthorizedRubric\(/);
});
