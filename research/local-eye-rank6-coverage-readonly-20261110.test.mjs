import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./local-eye-rank6-coverage-readonly-20261110.sql',import.meta.url),'utf8');
test('5v6/EYE cohort includes only pre-post FROZEN paired with official NAR records',()=>{
 for(const v of ["p.circuit='LOCAL'","p.status='FROZEN'","p.frozen_at<p.post_time",
 "r.source='NAR_OFFICIAL_RACEMARK'","r.settled_at>=p.post_time"])
   assert.ok(sql.includes(v),v);
});
test('NAR winner identity is disambiguated using a unique official WIN receipt, never raw first entry',()=>{
 assert.ok(sql.includes("r.result->'payouts'->'win'"));
 assert.ok(sql.includes("jsonb_array_length(COALESCE(r.result->'payouts'->'win','[]'::jsonb))=1"));
 assert.ok(sql.includes("f->>'finish'='1' AND f->>'horse_no'=b.winner_no::text"));
 assert.ok(sql.includes("winner_no<>second_no AND winner_no<>third_no"));
});
test('research compares captured and lost 6th ranks, all outsider factor auditing, and track mix',()=>{
 for(const key of [
 'rank5_podium','rank6_podium','rank6_podium_rescued_eye',
 'rank6_podium_not_eye','eye_rank8plus','zero_factor_horses',
 'checked_but_zero','GROUPING SETS ((race_date,track),(race_date),())'
 ])assert.ok(sql.includes(key),key);
});
test('analyzes results only downstream of saved predictions and cannot modify production',()=>{
 assert.doesNotMatch(sql,/\b(?:UPDATE|INSERT|DELETE|TRUNCATE|CREATE|ALTER|DROP)\s+(?:public|private)\./i);
 assert.doesNotMatch(sql,/win_odds|popularity|\bbets\s*=/i);
 assert.match(sql,/STRICTLY post-race review/);
});
