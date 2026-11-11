import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const sql=read('research/2026-11-09-shadow-preflight-production.sql');
const jra=read('research/staged-jra-claimed-mcp-ability-v13.ts');
const loc=read('research/staged-local-claimed-mcp-relative-v24.ts');

test('separate private preflight table is immutable, RLS-on and inaccessible to public roles',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS private\.lab_rank_shadow_preflight_v1/);
 assert.match(sql,/ALTER TABLE private\.lab_rank_shadow_preflight_v1 ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON private\.lab_rank_shadow_preflight_v1 FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT,INSERT ON private\.lab_rank_shadow_preflight_v1 TO service_role/);
 assert.match(sql,/BEFORE UPDATE OR DELETE ON private\.lab_rank_shadow_preflight_v1/);
 assert.match(sql,/CONSTRAINT shadow_preflight_one_per_race UNIQUE \(circuit,race_date,track,race_no\)/);
});

test('RPC denies anon/ordinary users and requires live CLAIM, matching official field and prestart clock',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.lab_capture_rank_shadow_preflight_v1\(text,uuid,jsonb,jsonb\)\s*FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.lab_capture_rank_shadow_preflight_v1\(text,uuid,jsonb,jsonb\)\s*TO service_role/);
 for(const required of [
  "j.job_status='CLAIMED'",'j.lease_until>v_now',
  "r.post_time>v_now+interval '3 minutes'",
  "r.prediction_status IN ('PENDING','RETRY')",
  "r.field_status IN ('READY','BASIC_READY')",
  "SHADOW_CAPTURE_FROZEN_ALREADY_EXISTS",
  'SHADOW_CAPTURE_IDENTITY_OR_RANK',
  "p_preview->'market_used' IS DISTINCT FROM 'false'::jsonb",
  "p_preview->'target_result_used' IS DISTINCT FROM 'false'::jsonb",
  "p_preview->'official_saved' IS DISTINCT FROM 'false'::jsonb",
  'SHADOW_CAPTURE_STATUS_MISMATCH',
  'SHA256 is calculated by the database',
  'ON CONFLICT (circuit,race_date,track,race_no) DO NOTHING',
  'SHADOW_CAPTURE_ALREADY_SEALED_DIFFERENT'
 ])assert.ok(sql.includes(required),'Missing safeguard: '+required);
 assert.doesNotMatch(sql,/INSERT INTO public\.official_predictions/i);
 assert.doesNotMatch(sql,/UPDATE public\.official_predictions/i);
 assert.doesNotMatch(sql,/DELETE FROM public\.official_predictions/i);
});

test('JRA separate write action rebuilds proposal from server CLAIM not client-proposed order',()=>{
 const tool=jra.split('s.registerTool("jra_seal_relative_rank_pair"')[1].split('s.registerTool("jra_save_claimed_prediction"')[0];
 assert.match(tool,/await auth\(\)/);
 assert.match(tool,/rpc\("jra_claimed_context"/);
 assert.match(tool,/buildJraClaimedDraftPreview\(/);
 assert.match(tool,/rpc\("lab_capture_rank_shadow_preflight_v1"/);
 assert.match(tool,/p_circuit:"JRA"/);
 assert.match(tool,/readOnlyHint:false/);
 assert.doesNotMatch(tool,/rpc\("jra_save_claimed_prediction"/);
 assert.doesNotMatch(tool,/jra_manual_claim_next_v1/);
});

test('LOCAL separate write action checks same live claim before and after verified source fetch',()=>{
 const tool=loc.split('s.registerTool("lab_seal_relative_rank_pair"')[1].split('s.registerTool("lab_save_claimed_prediction"')[0];
 assert.match(tool,/await auth\(\)/);
 assert.match(tool,/first=await claim\(c,job_id\)/);
 assert.match(tool,/claim_token:first\.j\.claim_token/);
 assert.match(tool,/second=await claim\(c,job_id\)/);
 assert.match(tool,/second\.j\.claim_token!==first\.j\.claim_token/);
 assert.match(tool,/buildRelativeAbilityRankProposal\(/);
 assert.match(tool,/rpc\("lab_capture_rank_shadow_preflight_v1"/);
 assert.match(tool,/p_circuit:"LOCAL"/);
 assert.match(tool,/readOnlyHint:false/);
 assert.doesNotMatch(tool,/queueSave\(/);
 assert.doesNotMatch(tool,/queueNext\(/);
});
