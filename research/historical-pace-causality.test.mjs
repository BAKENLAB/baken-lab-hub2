import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewHistoricalPaceCausality as review} from '../automation/historical-pace-causality.mjs';
const race={race_date:'2026-10-01',track:'園田',race_no:4};
const h=(positions,laps,source_ref)=>({past_race:race,positions,laps,source_ref});
const packet=(circuit,history)=>({circuit,race_date:'2026-11-11',
 runners:[{horse_no:1,horse_name:'A',history},{horse_no:2,horse_name:'B',history:[]}]});
for(const circuit of ['JRA','LOCAL']){
 test(circuit+' combines independently verified same-race positions and field splits, no automatic score',()=>{
  const r=review(packet(circuit,[h({early_pos:8,final_turn_pos:3},null,'official-position'),
   h(null,[11,11,11,13,13,13],'official-laps')]));
  assert.equal(r.full_field_reviewed,2);assert.equal(r.context_supported_horses,1);
  assert.equal(r.runners[0].historical_races[0].corner_gain,5);
  assert.equal(r.runners[0].historical_races[0].field_pace_pattern,'EARLY_FASTER');
  assert.equal(r.runners[0].historical_races[0].causal_status,'CONTEXT_SUPPORTED_CAUSE_UNPROVEN');
  assert.equal(r.causes_proven,0);assert.equal(r.runners[0].scoring_delta,0);
  assert.equal(r.rank_changed,false);assert.equal(r.market_used,false);
 });
 test(circuit+' missing lap cannot be called proven defeat cause',()=>{
  const r=review(packet(circuit,[h({early_pos:1,final_turn_pos:9},null,'official')]));
  assert.equal(r.context_supported_horses,0);
  assert.equal(r.runners[0].historical_races[0].hypothesis,'NO_CAUSAL_CLAIM');
 });
 test(circuit+' different races never cross-join evidence',()=>{
  const r=review(packet(circuit,[h({early_pos:1,final_turn_pos:9},null,'official'),
   {...h(null,[11,11,11,13,13,13],'official'),past_race:{...race,race_no:5}}]));
  assert.equal(r.context_supported_horses,0);
 });
}
test('invalid duplicate field rejected',()=>{
 assert.throws(()=>review({circuit:'JRA',runners:[{horse_no:1,history:[]},{horse_no:1,history:[]}]}),/INVALID/);
});

for(const circuit of ['JRA','LOCAL']){
 test(circuit+' rejects overlapping 3-split windows rather than inventing pace',()=>{
  const r=review(packet(circuit,[h({early_pos:8,final_turn_pos:3},[11,12,13],'official')]));
  assert.equal(r.context_supported_horses,0);
  assert.equal(r.runners[0].historical_races[0].field_pace_pattern,null);
  assert.equal(r.runners[0].historical_races[0].hypothesis,'NO_CAUSAL_CLAIM');
 });
 test(circuit+' rejects mixed 100m/200m split lengths for raw 600m comparison',()=>{
  const mixed={...h({early_pos:8,final_turn_pos:3},[7,12,12,12,12,12,12,12,12],'official'),
   lap_lengths:[100,200,200,200,200,200,200,200,200]};
  const r=review(packet(circuit,[mixed]));
  assert.equal(r.context_supported_horses,0);
  assert.equal(r.runners[0].historical_races[0].field_pace_pattern,null);
 });
}
