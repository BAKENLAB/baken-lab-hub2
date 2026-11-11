import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./local-boundary-5v6-result-audit.sql',import.meta.url),'utf8');
test('boundary baseline is always a genuine pre-race FROZEN, never late saved',()=>{
 for(const gate of [
  "p.circuit='LOCAL'","p.status='FROZEN'",
  'p.frozen_at<p.post_time',
  "r.source='NAR_OFFICIAL_RACEMARK'",
  'r.settled_at>=p.post_time'
 ])assert.ok(sql.includes(gate),'missing '+gate);
});
test('normalization uses uniquely official payout to distinguish duplicated first-place rows',()=>{
 assert.match(sql,/r\.result->'payouts'->'win'/);
 assert.match(sql,/jsonb_array_length\(COALESCE\(r\.result->'payouts'->'win','\[\]'::jsonb\)\)=1/);
 assert.match(sql,/h->>'finish'='1' AND h->>'horse_no'=winner_no::text/);
 assert.match(sql,/rank5_no IN \(winner_no,second_no,third_no\)/);
 assert.match(sql,/rank6_no IN \(winner_no,second_no,third_no\)/);
});
test('retrospective gain and lost incumbent are both counted, no writes',()=>{
 for(const gate of [
  'rank6_only_captured','rank5_only_captured',
  'hypothetical_swap_net_podium',
  'RETROSPECTIVE_ONLY_NO_PRODUCTION_REORDER'
 ])assert.ok(sql.includes(gate));
 assert.doesNotMatch(sql,/\b(?:UPDATE|INSERT|DELETE|TRUNCATE|CREATE|ALTER|DROP)\s+(?:public|private)\./i);
 assert.doesNotMatch(sql,/win_odds|popularity|bets\s*=/i);
});
