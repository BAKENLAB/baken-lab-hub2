import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const stage=readFileSync('research/staged-local-v17-independent-shadow-storage-v1.sql','utf8');
const parent=readFileSync('research/staged-local-v17-parent-preflight-hook-v1.sql','utf8');
const save=readFileSync('research/2026-11-09-atomic-optional-shadow-save-v1.sql','utf8');
const bridge=readFileSync('automation/optional-atomic-shadow-save.mjs','utf8');
const engine=readFileSync('automation/local-v17-full-field-independent-shadow.mjs','utf8');
const postrace=readFileSync('research/staged-local-v17-paired-postrace-audit-readonly.sql','utf8');
test('staged only, never modifies production frozen or public ranks',()=>{
 assert.match(stage,/RESEARCH STAGE ONLY.*NOT EXECUTED/);
 assert.match(parent,/NOT EXECUTE IN PRODUCTION/);
 assert.doesNotMatch(stage,/\b(?:UPDATE|DELETE)\s+(?:FROM\s+)?public\.official_predictions\b/i);
 assert.doesNotMatch(stage,/\b(?:UPDATE|DELETE)\s+(?:FROM\s+)?private\.lab_rank_shadow_preflight_v1\b/i);
 assert.match(stage,/production_rank_effect boolean NOT NULL DEFAULT false/);
 assert.match(stage,/CHECK\(production_rank_effect=false\)/);
});
test('stage is append-only and inaccessible to public users',()=>{
 assert.match(stage,/CREATE TABLE IF NOT EXISTS private\.lab_v17_independent_preflight_v1/);
 assert.match(stage,/UNIQUE\(circuit,race_date,track,race_no\)/);
 assert.match(stage,/ON CONFLICT\(circuit,race_date,track,race_no\) DO NOTHING/);
 assert.match(stage,/V17_SHADOW_ALREADY_SEALED_DIFFERENT/);
 assert.match(stage,/REVOKE ALL ON TABLE.*(?:\n.*)?FROM PUBLIC,anon,authenticated/s);
 assert.match(stage,/GRANT SELECT,INSERT ON TABLE private\.lab_v17_independent_preflight_v1 TO service_role/);
 assert.doesNotMatch(stage,/GRANT[^;]*UPDATE|GRANT[^;]*DELETE/i);
 assert.match(stage,/REVOKE ALL ON FUNCTION private\.lab_capture_v17_independent_preflight_v1\(uuid,jsonb\)/);
});
test('capture requires original immutable draft source, same day, before post, no prior frozen',()=>{
 assert.match(stage,/FROM private\.lab_rank_shadow_preflight_v1 s/);
 assert.match(stage,/WHERE s\.circuit='LOCAL' AND s\.job_id=p_job_id/);
 assert.match(stage,/v_prior\.race_date<>\(v_now AT TIME ZONE 'Asia\/Tokyo'\)::date/);
 assert.match(stage,/v_prior\.post_time<=v_now\+interval '3 minutes'/);
 assert.match(stage,/EXISTS\(SELECT 1 FROM public\.official_predictions p/);
 assert.match(stage,/original_capture_sha256/);
 assert.match(stage,/captured_at timestamptz NOT NULL DEFAULT clock_timestamp\(\)/);
});
test('full-field score proof never accepts an odds, result, fake field or borrowed grade',()=>{
 assert.match(stage,/p_sidecar->'market_used' IS DISTINCT FROM 'false'::jsonb/);
 assert.match(stage,/p_sidecar->'target_result_used' IS DISTINCT FROM 'false'::jsonb/);
 assert.match(stage,/p_sidecar->'production_rank_effect' IS DISTINCT FROM 'false'::jsonb/);
 assert.match(stage,/INDEPENDENT_SCORE_NO_BASELINE_RANK_INPUT/);
 assert.match(stage,/LOCAL_1_7_INDEPENDENT_SHADOW_V0_2/);
 assert.match(stage,/ALREADY_VERIFIED_LOCAL_CLAIMED_HISTORY_ONLY/);
 assert.match(stage,/p_sidecar->'old_top5' IS DISTINCT FROM v_baseline/);
 assert.match(stage,/jsonb_array_length\(p_sidecar->'score_table'\)<>v_n/);
 assert.match(stage,/count\(distinct x->>'horse_no'\)/);
 assert.match(stage,/count\(distinct x->>'rank'\)/);
 assert.match(stage,/NOT EXISTS\([\s\S]*?FROM jsonb_array_elements\(v_prior\.field_athletes\)/);
 assert.match(stage,/research_score_100'\)::int NOT BETWEEN 0 AND 100/);
});
test('score order and 5/6 tie cannot produce a fabricated top5',()=>{
 assert.match(stage,/V17_SHADOW_SCORE_ORDER_OR_BOUNDARY_TIE/);
 assert.match(stage,/JOIN jsonb_array_elements\(v_scores\) y ON/);
 assert.match(stage,/WHERE \(x->>'rank'\)::int=5/);
 assert.match(stage,/WHERE \(x->>'rank'\)::int=6/);
 assert.match(stage,/p_sidecar->'shadow_top5' IS DISTINCT FROM v_top/);
 assert.match(bridge,/TOP5_BOUNDARY_SCORE_TIE_NOT_ABILITY_RESOLVED/);
 assert.match(engine,/top5_boundary_score_tie:top5BoundaryTied/);
});
test('research abstentions are captured explicitly, without synthetic rankings',()=>{
 assert.match(stage,/status IN \('FULL_FIELD_PAIRED_RESEARCH_ONLY','ABSTAINED'\)/);
 assert.match(stage,/status='ABSTAINED' AND score_table IS NULL/);
 assert.match(stage,/p_sidecar \? 'shadow_top5'/);
 assert.match(stage,/abstention_reason text/);
});
test('existing guarded preflight is executed BEFORE optional 1.7 capture',()=>{
 const capture=parent.indexOf('INSERT INTO private.lab_rank_shadow_preflight_v1');
 const attach=parent.indexOf('private.lab_capture_v17_independent_preflight_v1(');
 const result=parent.lastIndexOf("RETURN jsonb_build_object('status'");
 assert.ok(capture>=0 && attach>capture && result>attach);
 assert.match(parent,/IF p_circuit='LOCAL' AND p_preview \? 'independent_full_field_v17'/);
 assert.match(parent,/EXCEPTION WHEN OTHERS THEN[\s\S]*v_v17_status:='OPTIONAL_V17_CAPTURE_SKIPPED'/);
 assert.match(parent,/'independent_v17_status',v_v17_status/);
});
test('official save remains canonical and atomic; optional capture cannot block it',()=>{
 const old=save.slice(save.indexOf('CREATE OR REPLACE FUNCTION public.lab_queue_save_prediction_with_shadow_v1'));
 const capture=old.indexOf("public.lab_capture_rank_shadow_preflight_v1('LOCAL'");
 const official=old.indexOf('public.lab_queue_save_prediction_v1(');
 assert.ok(capture>=0 && official>capture);
 assert.match(old,/EXCEPTION WHEN OTHERS THEN[\s\S]*v_shadow_status:='OPTIONAL_CAPTURE_SKIPPED'/);
 assert.match(bridge,/independent_full_field_v17:independentV17/);
});

test('sidecar guard checks current service lease and READY again, not merely yesterday seal',()=>{
 assert.match(stage,/FROM public\.lab_prediction_jobs j/);
 assert.match(stage,/j\.job_status='CLAIMED'/);
 assert.match(stage,/j\.lease_until>v_now/);
 assert.match(stage,/j\.claim_token IS NOT NULL/);
 assert.match(stage,/j\.claimed_by=w\.worker_id AND w\.status='RUNNING'/);
 assert.match(stage,/FROM public\.official_races r/);
 assert.match(stage,/r\.prediction_status IN \('PENDING','RETRY'\)/);
 assert.match(stage,/r\.field_status IN \('READY','BASIC_READY'\)/);
 assert.ok(stage.includes("v_reason !~ '^[A-Z0-9_]{1,120}
});
test('postrace comparison never invents a FROZEN replay or three finishers',()=>{
 assert.match(postrace,/^-- READ ONLY/m);
 assert.match(postrace,/private\.lab_v17_independent_preflight_v1/);
 assert.match(postrace,/private\.lab_rank_shadow_preflight_v1/);
 assert.match(postrace,/p\.capture_sha256=v\.original_capture_sha256/);
 assert.match(postrace,/j\.saved_order IS DISTINCT FROM j\.draft_order/);
 assert.match(postrace,/j\.frozen_at<j\.captured_at OR j\.frozen_at>=j\.post_time/);
 assert.match(postrace,/j\.official_result_settled_at<j\.post_time/);
 assert.match(postrace,/j\.top3_finish_positions<>3 OR j\.top3_distinct_horses<>3/);
 assert.match(postrace,/THEN 'WAITING_VERIFIED_PODIUM'/);
 assert.match(postrace,/WHEN j\.status='ABSTAINED' THEN 'RESEARCH_ABSTAINED'/);
 assert.match(postrace,/newly_captured/);
 assert.match(postrace,/lost_captured/);
 assert.doesNotMatch(postrace,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/i);
});
"));
});
test('postrace comparison never invents a FROZEN replay or three finishers',()=>{
 assert.match(postrace,/^-- READ ONLY/m);
 assert.match(postrace,/private\.lab_v17_independent_preflight_v1/);
 assert.match(postrace,/private\.lab_rank_shadow_preflight_v1/);
 assert.match(postrace,/p\.capture_sha256=v\.original_capture_sha256/);
 assert.match(postrace,/j\.saved_order IS DISTINCT FROM j\.draft_order/);
 assert.match(postrace,/j\.frozen_at<j\.captured_at OR j\.frozen_at>=j\.post_time/);
 assert.match(postrace,/j\.official_result_settled_at<j\.post_time/);
 assert.match(postrace,/j\.top3_finish_positions<>3 OR j\.top3_distinct_horses<>3/);
 assert.match(postrace,/THEN 'WAITING_VERIFIED_PODIUM'/);
 assert.match(postrace,/WHEN j\.status='ABSTAINED' THEN 'RESEARCH_ABSTAINED'/);
 assert.match(postrace,/newly_captured/);
 assert.match(postrace,/lost_captured/);
 assert.doesNotMatch(postrace,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/i);
});
