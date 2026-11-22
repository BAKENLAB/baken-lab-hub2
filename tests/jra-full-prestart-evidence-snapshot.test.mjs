// Frozen input observations only: no official issuer originals, signed CLAIM,
// approved factor scorer, retroactive ranks, production write or scheduled task.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const prefix=new URL('../research/jra-scoring-integrity-20261121/observations/',import.meta.url);
const base=JSON.parse(readFileSync(new URL('jra-20261123-basecore-prerace-readonly.json',prefix)));
const files=[
 {track:'福島',name:'jra-20261123-fukushima-all-histories-prerace-readonly.json',
  sha:'88a9b6561f39305fc873c517f15b39dba08c9ca9',expectedRaces:11,expectedHorses:173,expectedRuns:556},
 {track:'東京',name:'jra-20261123-tokyo-all-histories-prerace-readonly.json',
  sha:'b248dcaaeb0afaf24fede9487a356e07b94fff22',expectedRaces:12,expectedHorses:172,expectedRuns:439}
];
function load(f){
 const raw=readFileSync(new URL(f.name,prefix));
 const sha=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 assert.equal(sha,f.sha);
 return JSON.parse(raw);
}
test('all 23 ready pre-start flat races and 345 horses have tamper-evident source feature observations',()=>{
 let races=0,horses=0,runs=0;
 const seen=new Set();
 for(const desc of files){
  const x=load(desc);
  assert.equal(x.track,desc.track);
  assert.equal(x.classification,'READONLY_PREPOST_HISTORICAL_FACTS_NOT_SIGNED_OFFICIAL_OR_CLAIM_CONTEXT');
  assert.equal(x.no_frozen_modified,true);
  assert.equal(x.original_jra_body_verified,false);
  assert.equal(x.claim_context_hash_bound,false);
  assert.equal(x.race_count,desc.expectedRaces);
  assert.equal(x.horse_count,desc.expectedHorses);
  assert.equal(x.past_run_count,desc.expectedRuns);
  const captured=Date.parse(x.captured_at_jst+'+09:00');
  assert.ok(Number.isFinite(captured));
  races+=x.race_count;horses+=x.horse_count;runs+=x.past_run_count;
  for(const race of x.races){
   const k=race.track+'|'+race.race_no;
   assert.ok(!seen.has(k));seen.add(k);
   assert.equal(race.track,x.track);
   assert.ok(captured<Date.parse(race.post_at_jst+'+09:00'));
   const baseline=base.races.find(y=>y.track===race.track&&y.race_no===race.race_no);
   assert.ok(baseline);
   assert.equal(race.horse_count,baseline.runners.length);
   assert.equal(race.horses.length,baseline.runners.length);
   const known=new Map(baseline.runners.map(y=>[y.horse_no,y.horse_name]));
   const actualNames=new Set(),horseNums=new Set();
   let count=0;
   for(const horse of race.horses){
    assert.ok(!horseNums.has(horse.horse_no));horseNums.add(horse.horse_no);
    assert.equal(horse.horse_name,known.get(horse.horse_no));
    assert.ok(!actualNames.has(horse.horse_name));actualNames.add(horse.horse_name);
    assert.ok(Array.isArray(horse.history));
    count+=horse.history.length;
    for(const run of horse.history){
     assert.ok(!run.prior_date||run.prior_date<base.races[0].race_date);
     assert.ok(run.run_id===undefined);
     assert.ok(run.original_sha256===undefined);
     assert.ok(run.source_ref===undefined);
    }
   }
   assert.equal(count,race.past_run_count);
  }
 }
 assert.equal(races,23);
 assert.equal(horses,345);
 assert.equal(runs,995);
 assert.equal(seen.size,23);
});
test('recovered history source does not meet issuer authentication or fixed-point weighting requirements',()=>{
 let evidenceRuns=0,authenticated=0,archiveDetails=0;
 for(const f of files){
  const x=load(f);
  for(const race of x.races)for(const horse of race.horses)for(const run of horse.history){
   evidenceRuns++;
   archiveDetails+=Number(run.detail_available===true);
   authenticated+=Number(
    typeof run.run_id==='string'&&typeof run.original_sha256==='string'&&
    typeof run.source_ref==='string');
  }
 }
 assert.equal(evidenceRuns,995);
 assert.equal(authenticated,0);
 assert.ok(archiveDetails>0);
});
