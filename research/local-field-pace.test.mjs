import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalFieldPaceEvidence} from '../automation/local-field-pace.mjs';
const run=(date,pos,last=pos,extra={})=>({race_date:date,surface:'ダート',distance:1600,early_pos:pos,final_turn_pos:last,final3f:40.2,...extra});
test('local whole-field comparison captures repeated leading styles without ranking',()=>{
 const a=buildLocalFieldPaceEvidence([
 {horse_no:1,recent_runs:[run('2026-10-15',1,2),run('2026-09-15',3,4)]},
 {horse_no:2,recent_runs:[run('2026-10-15',5,7),run('2026-09-15',8,6)]},
 {horse_no:3,recent_runs:[run('2026-10-15',2,2),run('2026-09-15',1,1)]}
 ],{surface:'ダート',distance:1600});
 assert.equal(a.repeated_front_style_contenders,2);
 assert.equal(a.runners_with_historical_passing_order,3);
 assert.equal(a.runners_with_two_or_more_similar_runs,3);
 assert.equal(a.race_pace_projection,'NOT_VALIDATED');
 assert.equal(a.scoring_effect,0);
});
test('one prior race or unknown conditions never fabricates style conclusion',()=>{
 const a=buildLocalFieldPaceEvidence([{horse_no:3,recent_runs:[run('2026-10-15',1)]}],{surface:null,distance:null});
 assert.equal(a.repeated_front_style_contenders,0);
 assert.equal(a.runners[0].repeated_front_status,'INSUFFICIENT_RELEVANT_RUNS');
 assert.equal(a.runners_with_historical_passing_order,1);
});
test('running-style metrics never require odds/market attributes',()=>{
 const a=buildLocalFieldPaceEvidence([{horse_no:2,recent_runs:[run('2026-10-15',4,3)]}],{surface:'ダート',distance:1600});
 const s=JSON.stringify(a);
 assert.equal(s.includes('win_odds'),false);
 assert.equal(s.includes('popularity'),false);
 assert.equal(s.includes('rank'),false);
});
test('an incorrect number or duplicate horse is rejected',()=>{
 assert.throws(()=>buildLocalFieldPaceEvidence([{horse_no:1,recent_runs:[]},{horse_no:1,recent_runs:[]}],{}),/Duplicate/);
});
