import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildPreRaceFactualMatrix} from
 '../research/jra-scoring-integrity-20261121/claim-retention/prerace-fact-matrix.mjs';

const root=new URL('../research/jra-scoring-integrity-20261121/observations/',import.meta.url);
function read(name,sha){
 const bytes=readFileSync(new URL(name,root));
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sha);
 return JSON.parse(bytes);
}
const input={
 baseSnapshot:read('jra-20261123-basecore-prerace-readonly.json','07f8672655e987ed7fbe0b13d93551fabbe13175'),
 targetSnapshot:read('jra-20261123-target-conditions-prerace-readonly.json','c32bd4dd6541e30d6e054402770aea40ba7265dd'),
 sourceSnapshots:[
  read('jra-20261123-fukushima-all-histories-prerace-readonly.json','88a9b6561f39305fc873c517f15b39dba08c9ca9'),
  read('jra-20261123-tokyo-all-histories-prerace-readonly.json','b248dcaaeb0afaf24fede9487a356e07b94fff22')
 ]
};
test('real pre-start observations produce full-field 345 horse and 995 run factual matrix, not fabricated points',()=>{
 const x=buildPreRaceFactualMatrix(input);
 assert.equal(x.races,23);
 assert.equal(x.horses,345);
 assert.equal(x.historical_run_observations,995);
 assert.equal(x.ranked_baseline_horses,302);
 assert.equal(x.unsupported_baseline_horses,43);
 assert.match(x.fact_matrix_sha256,/^[0-9a-f]{64}$/);
 assert.equal(x.classification,'UNSIGNED_READONLY_FACT_MATRIX_NO_NUMERIC_POLICY');
 assert.equal(x.scorer_policy_sha256,null);
 assert.equal(x.original_historic_run_issuer_verified,false);
 assert.equal(x.formal_scoring_allowed,false);
 assert.equal(x.production_allowed,false);
 assert.equal(x.rows.reduce((n,r)=>n+r.history_observation_count,0),995);
 assert.ok(x.rows.every(r=>r.formal_100pt_score===null&&r.certified_rank===null&&
   r.submitted_evidence_points===null&&r.eye_audit_complete===false));
 assert.ok(x.rows.every(r=>r.history_observations.every(f=>
   f.effect_points===null&&f.pace_adjustment_points===null&&
   f.opponent_followon_points===null)));
});
test('same horse, running order and past run retrieval permutations preserve exact factual matrix digest',()=>{
 const original=buildPreRaceFactualMatrix(input);
 const shuffled=structuredClone(input);
 shuffled.baseSnapshot.races.reverse();
 shuffled.targetSnapshot.races.reverse();
 shuffled.sourceSnapshots.reverse();
 shuffled.sourceSnapshots.forEach(s=>s.races.reverse());
 shuffled.sourceSnapshots.forEach(s=>s.races.forEach(r=>{
   r.horses.reverse();r.horses.forEach(h=>h.history.reverse());
 }));
 const replay=buildPreRaceFactualMatrix(shuffled);
 assert.equal(replay.fact_matrix_sha256,original.fact_matrix_sha256);
 assert.deepEqual(replay.rows,original.rows);
 // Changing the raw source array order legitimately changes the capture
 // receipt, even though the canonical semantic fact matrix is unchanged.
 assert.notDeepEqual(replay.input_receipts.source_snapshots_sha256,original.input_receipts.source_snapshots_sha256);
});
test('changed historical 3f or target going changes digest but cannot implicitly award points',()=>{
 const old=buildPreRaceFactualMatrix(input);
 const a=structuredClone(input);
 const run=a.sourceSnapshots[0].races[0].horses[0].history.find(r=>r.final3f!==null);
 assert.ok(run);run.final3f+=0.1;
 const changed=buildPreRaceFactualMatrix(a);
 assert.notEqual(changed.fact_matrix_sha256,old.fact_matrix_sha256);
 assert.equal(changed.formal_scoring_allowed,false);
 const b=structuredClone(input);
 b.targetSnapshot.races[0].race_conditions.going='変更検証のみ';
 assert.notEqual(buildPreRaceFactualMatrix(b).fact_matrix_sha256,old.fact_matrix_sha256);
});
test('duplicate horse, missing horse and future run refuse all-field research replay',()=>{
 const dup=structuredClone(input);
 dup.sourceSnapshots[0].races[0].horses[1].horse_no=dup.sourceSnapshots[0].races[0].horses[0].horse_no;
 assert.throws(()=>buildPreRaceFactualMatrix(dup),/ROSTER_IDENTITY_DRIFT/);
 const missing=structuredClone(input);
 missing.sourceSnapshots[0].races[0].horses.pop();
 assert.throws(()=>buildPreRaceFactualMatrix(missing),/FIELD_SIZE_DRIFT/);
 const future=structuredClone(input);
 future.sourceSnapshots[0].races[0].horses[0].history[0].prior_date='2026-11-23';
 assert.throws(()=>buildPreRaceFactualMatrix(future),/POST_RACE_HISTORY_LEAK/);
});
test('current market prices and betting popularity cannot enter source matrix',()=>{
 const x=buildPreRaceFactualMatrix(input);
 const serialized=JSON.stringify(x.rows);
 assert.ok(!serialized.includes('win_odds'));
 assert.ok(!serialized.includes('popularity'));
 assert.ok(!serialized.includes('bet_strategy'));
 assert.ok(!serialized.includes('target_result'));
});
