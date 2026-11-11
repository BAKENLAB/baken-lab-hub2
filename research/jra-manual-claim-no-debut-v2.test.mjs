import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./jra-manual-claim-no-debut-v2-20261108.sql',import.meta.url),'utf8');
test('JRA manual v2 is a separate service-only guard; never replaces v1',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.jra_manual_claim_next_v2\(\)/);
 assert.doesNotMatch(sql,/(?:CREATE|ALTER|DROP)\s+(?:OR REPLACE\s+)?FUNCTION public\.jra_manual_claim_next_v1\(\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.jra_manual_claim_next_v2\(\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.jra_manual_claim_next_v2\(\) TO service_role/);
});
test('exclude new horse at resume, enqueue and claim without a single bypass',()=>{
 assert.equal((sql.match(/NOT LIKE '%新馬%'/g)||[]).length,3);
 assert.equal((sql.match(/NOT LIKE '%メイクデビュー%'/g)||[]).length,3);
 assert.equal((sql.match(/<> '障害'/g)||[]).length,2);
});
test('original READY, post buffer, lease, FROZEN and owner guards remain intact',()=>{
 for(const guard of [
  "r.field_status IN ('BASIC_READY','READY')",
  "r.prediction_status IN ('PENDING','RETRY')",
  "r.post_time BETWEEN v_now+interval '3 minutes' AND v_now+interval '70 minutes'",
  "j.lease_until>v_now",
  "j.claimed_by='JRA_QUEUE_RESCUE'",
  "NOT EXISTS (",
  "public.official_predictions",
  "pg_catalog.pg_advisory_xact_lock(20261017, 12701)"
 ])assert.ok(sql.includes(guard),'missing preserved guard '+guard);
 assert.doesNotMatch(sql,/UPDATE\s+public\.official_races|UPDATE\s+public\.official_predictions/i);
 assert.doesNotMatch(sql,/pg_cron|cron\.schedule|net\.http_post/);
});
