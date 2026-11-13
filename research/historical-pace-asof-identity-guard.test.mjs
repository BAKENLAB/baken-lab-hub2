import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewHistoricalPaceCausality} from '../automation/historical-pace-causality.mjs';
const prior=(date,surface,distance)=>({past_race:{race_date:date,track:'東京',race_no:5,surface,distance},positions:{early_pos:8,final_turn_pos:3},laps:[12,12,12,13,13,13],lap_lengths:[200,200,200,200,200,200],source_ref:'official-test'});
const run=history=>reviewHistoricalPaceCausality({circuit:'JRA',race_date:'2026-11-13',runners:[{horse_no:1,horse_name:'検証馬',history}]});
test('future and current target date cannot enter historical causal context',()=>{const x=run([prior('2026-11-13','芝',1200),prior('2026-11-14','芝',1200)]);assert.equal(x.runners[0].historical_races.length,0);assert.equal(x.context_supported_horses,0);});
test('same date track race number with different surface or distance never joins',()=>{const x=run([prior('2026-10-01','芝',1200),prior('2026-10-01','ダート',1400)]);assert.equal(x.runners[0].historical_races.length,2);assert.equal(x.context_supported_horses,1);});
test('valid old evidence remains descriptive only, with no scoring or market',()=>{const x=run([prior('2026-10-01','芝',1200)]);assert.equal(x.context_supported_horses,1);assert.equal(x.runners[0].scoring_delta,0);assert.equal(x.rank_changed,false);assert.equal(x.market_used,false);assert.equal(x.causes_proven,0);});
