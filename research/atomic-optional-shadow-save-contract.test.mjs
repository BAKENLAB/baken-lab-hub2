import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('research/2026-11-09-atomic-optional-shadow-save-v1.sql');
const jra=read('research/staged-jra-claimed-mcp-ability-v14.ts');
const local=read('research/staged-local-claimed-mcp-relative-v25.ts');
const helper=read('automation/optional-atomic-shadow-save.mjs');

test('official JRA save and shadow capture run inside one DB transaction',()=>{
 const p=sql.indexOf('CREATE OR REPLACE FUNCTION public.jra_save_claimed_prediction_with_shadow_v1');
 const c=sql.slice(p,sql.indexOf('REVOKE ALL ON FUNCTION public.jra_save_claimed_prediction_with_shadow_v1',p));
 assert.ok(c.indexOf('lab_capture_rank_shadow_preflight_v1')>=0);
 assert.ok(c.indexOf('lab_capture_rank_shadow_preflight_v1')<
    c.indexOf('v_prediction_id:=public.jra_save_claimed_prediction('));
 assert.ok(c.indexOf('EXCEPTION WHEN OTHERS')>=0);
 assert.ok(c.indexOf("v_shadow_status:='OPTIONAL_CAPTURE_SKIPPED'")>=0);
 assert.doesNotMatch(c,/INSERT INTO public\.official_predictions|UPDATE public\.official_predictions/i);
});
test('LOCAL wrapper delegates intact idempotent queue-save and keeps receipt',()=>{
 const p=sql.indexOf('CREATE OR REPLACE FUNCTION public.lab_queue_save_prediction_with_shadow_v1');
 const c=sql.slice(p,sql.indexOf('REVOKE ALL ON FUNCTION public.lab_queue_save_prediction_with_shadow_v1',p));
 assert.match(c,/pg_advisory_xact_lock\(72817,hashtext\(p_job_id::text\)\)/);
 assert.match(c,/public\.lab_queue_save_prediction_v1\(/);
 assert.match(c,/p_original_payload/);
 assert.match(c,/EXCEPTION WHEN OTHERS THEN/);
 assert.doesNotMatch(c,/INSERT INTO public\.official_predictions/i);
});
test('JRA MCP normal save uses server-derived bounded evidence and atomic wrapper',()=>{
 const p=jra.indexOf('s.registerTool("jra_save_claimed_prediction"');
 const s=jra.slice(p,jra.indexOf('s.registerTool("jra_queue_claim_next"',p));
 assert.match(s,/await auth\(\)/);
 assert.match(s,/extractOfficialSaveDraft\(payload,"JRA"\)/);
 assert.match(s,/AbortSignal\.timeout\(2200\)/);
 assert.match(s,/buildOptionalSaveJraShadow\(/);
 assert.match(s,/jra_save_claimed_prediction_with_shadow_v1/);
 assert.match(s,/p_baseline:shadow\?\.baseline\?\?null/);
 assert.match(s,/if\(error\|\|!uuid\(data\?\.prediction_id\)/);
 assert.doesNotMatch(s,/rpc\("jra_save_claimed_prediction"/);
});
test('LOCAL MCP save retains transition audit and original payload retry semantics',()=>{
 const p=local.indexOf('s.registerTool("lab_save_claimed_prediction"');
 const s=local.slice(p,local.indexOf('\n return s});return handler.fetch(req)',p));
 assert.match(s,/const original_payload=structuredClone\(payload\)/);
 assert.match(s,/assertLocalSaveDuringTransition\(/);
 assert.match(s,/extractOfficialSaveDraft\(payload,"LOCAL"\)/);
 assert.match(s,/AbortSignal\.timeout\(2300\)/);
 assert.match(s,/buildOptionalSaveLocalShadow\(/);
 assert.match(s,/lab_queue_save_prediction_with_shadow_v1/);
 assert.match(s,/p_original_payload:original_payload/);
 assert.match(s,/SAVE_RETRY_MISMATCH/);
 assert.match(s,/if\(c && TERMINAL_EYE_CODES\.has\(code\)\)/);
 assert.doesNotMatch(s,/rpc\("lab_save_claimed_prediction"/);
});
test('unverified optional source never blocks official save in either circuit',()=>{
 for(const s of [jra,local]){
  assert.match(s,/catch\{\/\*[^*]+optional|catch\{\/\* Core official save must remain available/);
 }
 assert.match(sql,/EXCEPTION WHEN OTHERS THEN/);
 assert.match(helper,/preview=buildJraClaimedDraftPreview/);
 assert.match(helper,/result=buildRelativeAbilityRankProposal/);
});
test('no original save function redefinition, no public direct table writes',()=>{
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.jra_save_claimed_prediction\(/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.lab_queue_save_prediction_v1\(/);
 assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE|DELETE FROM) public\.official_predictions\b/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.jra_save_claimed_prediction_with_shadow_v1/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.lab_queue_save_prediction_with_shadow_v1/);
});
