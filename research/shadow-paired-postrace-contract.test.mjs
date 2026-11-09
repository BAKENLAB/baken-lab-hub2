import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(
  new URL('../research/2026-11-09-shadow-paired-postrace-readonly.sql',import.meta.url),
  'utf8'
);
test('comparison joins only an official FROZEN matching the captured draft',()=>{
 for(const guard of [
   'hash_verified',
   "prediction_status<>'FROZEN'",
   'official_protocol IS DISTINCT FROM protocol_version',
   "official_frozen_at<captured_at",
   "official_frozen_at>=post_time-interval '3 minutes'",
   'official_frozen_order IS DISTINCT FROM draft_order',
   'official_frozen_field IS DISTINCT FROM field_athletes',
   "'DRAFT_NOT_OFFICIAL_FROZEN'",
   "ELSE 'PAIRED'"
 ])assert.ok(sql.includes(guard),'Missing '+guard);
});
test('result scoring requires verified official source and three distinct valid podium runners',()=>{
 for(const guard of [
  "result_source IS DISTINCT FROM 'JRA_OFFICIAL'",
  "result_source IS DISTINCT FROM 'NAR_OFFICIAL_RACEMARK'",
  "result_settled_at<captured_at",
  "COALESCE(jsonb_array_length(official_podium),0)<>3",
  'count(DISTINCT h.value)',
  'WAITING_VERIFIED_PODIUM'
 ])assert.ok(sql.includes(guard),'Missing '+guard);
 assert.match(sql,/WHEN audit_status='PAIRED' THEN official_podium END official_podium/);
 assert.doesNotMatch(sql,/win_odds|popularity|payoff/i);
});
test('paired metrics measure both added and lost capture, winners and original model',()=>{
 for(const field of [
 'baseline_top3_count','shadow_top3_count',
 'newly_captured','lost_captured',
 'winner_in_baseline','winner_in_shadow',
 'baseline_podium_horses','proposed_podium_horses',
 'added_podium_horses','lost_podium_horses',
 'changed_draft_excluded'
 ]) assert.ok(sql.includes(field),'Missing '+field);
});
test('postrace audit remains private, read-only and service-role restricted',()=>{
 assert.match(sql,/CREATE OR REPLACE VIEW private\.lab_rank_shadow_paired_audit_v1\s*WITH \(security_invoker = true\)/);
 assert.match(sql,/CREATE OR REPLACE VIEW private\.lab_rank_shadow_paired_summary_v1\s*WITH \(security_invoker = true\)/);
 assert.match(sql,/REVOKE ALL ON private\.lab_rank_shadow_paired_audit_v1 FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/REVOKE ALL ON private\.lab_rank_shadow_paired_summary_v1 FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON private\.lab_rank_shadow_paired_summary_v1 TO service_role/);
 assert.doesNotMatch(sql,/\bINSERT INTO\b|\bUPDATE public\b|\bDELETE FROM\b/i);
});

test('legacy JRA saved rank omitting ALL runner status remains comparable without accepting mixed-status fields',()=>{
 assert.match(sql,/p\.circuit='JRA' AND\s+NOT EXISTS \(\s*SELECT 1 FROM jsonb_array_elements\(COALESCE\(p\.payload->'runners','\[\]'::jsonb\)\) k WHERE k \? 'status'/);
 assert.match(sql,/frozen_runner_status_policy/);
 assert.match(sql,/JRA_LEGACY_ALL_STATUS_MISSING/);
 // The allowance MUST be restricted to JRA and only when no saved runner
 // has status; it must not automatically treat an explicitly inactive runner
 // as active, or be enabled for LOCAL.
 assert.equal((sql.match(/h->>'status'='ACTIVE' OR \(p\.circuit='JRA' AND/g)||[]).length,2);
 assert.doesNotMatch(sql,/p\.circuit='LOCAL' AND\s*NOT EXISTS/);
 assert.match(sql,/official_frozen_field IS DISTINCT FROM field_athletes/);
});

test('NAR results with duplicate raw first-place rows use verified official WIN payout only',()=>{
 assert.match(sql,/spurious extra "finish:1" row/);
 assert.match(sql,/official_podium_places IS DISTINCT FROM '\[1,2,3\]'::jsonb/);
 assert.match(sql,/official_win_payout_count<>1/);
 assert.match(sql,/r\.result->'payouts'->'win'/);
 assert.match(sql,/w->>'combination'=h->>'horse_no'/);
 assert.match(sql,/p\.circuit<>'LOCAL' OR h->>'finish'<>'1'/);
 // The canonical podium requires exactly 1st, 2nd and 3rd and a
 // UNIQUE independently verifiable winner.  JRA uses existing logic.
 assert.match(sql,/THEN 'WAITING_VERIFIED_PODIUM'/);
 assert.equal((sql.match(/CREATE OR REPLACE VIEW/g)||[]).length,2);
});
