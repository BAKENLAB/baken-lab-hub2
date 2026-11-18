import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeNarRaceTiming,recoverNarCornerRanges} from './local-race-timing-corner-research.mjs';
// Synthetic test cases: no horse or prediction data.
const timing={distance:900,winnerTime:'0:56.0',sectionEnds:[100,300,500,700,900],sectionTimes:[7,11,12,13,13],cumulativeTimes:[7,18,30,43,56],closing4f:49,closing3f:38};
test('short first segment and independently consistent finish',()=>{
 const x=normalizeNarRaceTiming(timing);assert.equal(x.full_laps_status,'FULL_SECTIONALS_CONSISTENT');assert.equal(x.segments[0].distance_m,100);
});
test('aggregate-only is not sectional coverage',()=>{
 const x=normalizeNarRaceTiming({distance:920,winnerTime:'0:56.0',closing4f:48,closing3f:37});assert.equal(x.full_laps_status,'NOT_AVAILABLE');assert.equal(x.segments.length,0);
});
test('reject inconsistent timing',()=>{
 assert.equal(normalizeNarRaceTiming({...timing,winnerTime:'0:57.0'}).full_laps_status,'WINNER_TIME_UNVERIFIED');
 assert.equal(normalizeNarRaceTiming({...timing,cumulativeTimes:[7,18,30,43,57]}).full_laps_status,'CUMULATIVE_MISMATCH');
 assert.equal(normalizeNarRaceTiming({...timing,sectionEnds:[200,300,500,700,900]}).full_laps_status,'SECTION_GRID_MISMATCH');
});
test('group order preserves ranges and exact positions',()=>{
 const x=recoverNarCornerRanges({expectedHorseNos:[1,2,3,4],cornerRows:[{label:'４角',order:'1,(2,3)-4'}]});
 assert.equal(x.verified_corner_rows,1);
 assert.deepEqual(x.rows[0].positions[1],{horse_no:2,position_min:2,position_max:3,position_exact:null});
 assert.equal(x.rows[0].positions[3].position_exact,4);
});
test('unknown, repeated, missing and malformed horse numbers are rejected',()=>{
 for(const order of ['1,2,2','1,2','1,2,4','1,2,3,','1/2/3'])assert.equal(recoverNarCornerRanges({expectedHorseNos:[1,2,3],cornerRows:[{label:'4角',order}]}).verified_corner_rows,0);
});
