import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const staged=readFileSync(new URL('./staged-local-claimed-mcp-relative-v25.ts',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/evidence-research.yml',import.meta.url),'utf8');
const start=staged.indexOf('s.registerTool("lab_full_field_over_under_preview"');
const end=staged.indexOf('// Opt-in, server-validated prospective comparison capture.',start);
const tool=staged.slice(start,end);

test('full-field is exposed as a staged read-only authorized CLAIM preview',()=>{
 assert.ok(start>=0&&end>start);
 assert.match(tool,/readOnlyHint:true/);
 assert.match(tool,/const \{u,k,c\}=admin\(\),first=await claim\(c,job_id\)/);
 assert.match(tool,/const second=await claim\(c,job_id\)/);
 assert.match(tool,/CLAIM_CHANGED/);
 assert.match(tool,/lab-claimed-context/);
 assert.match(tool,/ctx\.relative_condition_evidence/);
 assert.match(tool,/buildLocalFullFieldOverUnderShadow/);
 assert.match(tool,/save_authorized:false/);
 assert.match(tool,/production_protocol_unmodified:true/);
 assert.doesNotMatch(tool,/lab_queue_save_prediction|lab_capture_rank_shadow|\.from\("official_predictions"\)/);
});
test('all-horse baseline includes independent score and rank, not only TOP5 ranks',()=>{
 assert.match(tool,/score:z\.number\(\)\.finite\(\)\.min\(0\)\.max\(100\)/);
 assert.match(tool,/baseline:z\.array/);
 assert.match(tool,/\.min\(6\)\.max\(20\)/);
});
test('Deno check bundles the challenger into staged runtime',()=>{
 assert.ok(workflow.includes('cp automation/local-full-field-over-under-shadow.mjs .local-relative-ci/local-full-field-over-under-shadow.mjs'));
});
