// Nov23 R1 captured BEFORE first post; read-only input observation, never a
// signed official-body receipt or full 100-point scorer certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../research/jra-scoring-integrity-20261121/observations/',import.meta.url);
const raw=readFileSync(new URL('jra-20261123-r1-history-prestart-readonly.json',root));
const snap=JSON.parse(raw);
const base=JSON.parse(readFileSync(new URL('jra-20261123-basecore-prerace-readonly.json',root)));
test('Nov23 08:16 R1 historical source evidence is pinned as actually captured before first post',()=>{
 const gitHash=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 assert.equal(gitHash,'ce13ce06c8ce3024a5a72da2555078f2d08abb65');
 assert.equal(snap.captured_at_jst,'2026-11-23T08:16:33.500');
 assert.equal(snap.no_prediction_saved,true);
 assert.equal(snap.not_claim_snapshot,true);
 assert.equal(snap.does_not_prove_same_context_as_later_claim,true);
});
test('each of the 29 horses and 58 past runs matches the earlier BASE_CORE field identity',()=>{
 const counts={福島:{horses:0,runs:0},東京:{horses:0,runs:0}};
 const allRuns=[];
 for(const field of snap.fields){
  assert.equal(field.race_no,1);
  const original=base.races.find(x=>x.track===field.track&&x.race_no===1);
  assert.ok(original);
  assert.equal(field.horses.length,original.runners.length);
  const seen=new Set();
  for(const horse of field.horses){
   const existing=original.runners.find(x=>x.horse_no===horse.horse_no);
   assert.ok(existing);
   assert.equal(existing.horse_name,horse.horse_name);
   assert.ok(!seen.has(horse.horse_no));
   seen.add(horse.horse_no);
   counts[field.track].horses++;
   for(const run of horse.history||[]){
    assert.ok(!run.prior_date||run.prior_date<'2026-11-23');
    counts[field.track].runs++;
    allRuns.push(run);
   }
  }
 }
 assert.deepEqual(counts,{福島:{horses:16,runs:32},東京:{horses:13,runs:26}});
 assert.equal(allRuns.filter(x=>Array.isArray(x.live_corner_positions)).length,58);
 assert.equal(allRuns.filter(x=>x.final3f!==null&&x.final3f!==undefined).length,57);
 assert.equal(allRuns.filter(x=>x.detail_available===true).length,16);
});
test('historical as-of features cannot silently impersonate signed original JRA histories',()=>{
 const rows=snap.fields.flatMap(x=>x.horses).flatMap(x=>x.history||[]);
 assert.equal(rows.length,58);
 assert.equal(rows.filter(x=>typeof x.run_id==='string').length,0);
 assert.equal(rows.filter(x=>typeof x.original_sha256==='string').length,0);
 assert.equal(rows.filter(x=>typeof x.source_ref==='string').length,0);
 // No trusted source document binding => no formal fact-to-point replay.
 const verified=rows.filter(x=>x.run_id&&x.original_sha256&&x.source_ref);
 assert.equal(verified.length,0);
});
