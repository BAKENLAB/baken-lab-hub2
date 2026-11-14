import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeVerifiedLocalCornerFacts,buildLocal16ContentReview,assertLocal16NoUnauthorizedRubric} from '../automation/local-16-content-review.mjs';
const h={race_date:'2026-11-01',track:'高知',race_no:7,finish:4,margin:'クビ',final3f:39.8,early_pos:null,final_turn_pos:null};
function fixture(){
 const base=[{horse_no:1,horse_name:'試験馬A',recent_runs:[{...h}]},{horse_no:2,horse_name:'試験馬B',recent_runs:[{...h}]}];
 const shadow={status:'DESCRIPTIVE_SHADOW_ONLY',use_for_rank:false,market_used:false,applied_prior_runs:1,
 runners:structuredClone(base),verified_corner_sources:[{current_horse_no:1,past_race:{race_date:h.race_date,track:h.track,race_no:h.race_no},
 early_pos:8,final_turn_pos:4,official_source_ref:'https://www.keiba.go.jp/example',verification_scope:'PRECLAIM_OFFICIAL_PAST_RESULT'}]};
 Object.assign(shadow.runners[0].recent_runs[0],{early_pos:8,final_turn_pos:4}); return {base,shadow};
}
test('verified old corners reach ordinary all-field history without overriding scores',()=>{
 const {base,shadow}=fixture();const o=mergeVerifiedLocalCornerFacts(base,shadow,'2026-11-14');
 assert.equal(o.runners[0].recent_runs[0].early_pos,8);assert.equal(o.runners[0].recent_runs[0].final_turn_pos,4);
 assert.equal(o.runners[0].recent_runs[0].margin,'クビ');assert.equal(base[0].recent_runs[0].early_pos,null);
 assert.equal(o.runners[1].recent_runs[0].early_pos,null);assert.equal(o.coverage.verified_corner_runs,1);
 const r=buildLocal16ContentReview({runners:o.runners});
 assert.equal(r.full_field_count,2);assert.equal(r.research_model_adopted,false);
 assert.equal(r.per_runner_coverage[0].corner_runs,1);assert.equal(r.per_runner_coverage[1].corner_runs,0);
 assert.equal(r.full_race_laps_available,false);
});
test('conflicting or duplicate corner proof is refused',()=>{
 let {base,shadow}=fixture();base[0].recent_runs[0].early_pos=1;
 assert.throws(()=>mergeVerifiedLocalCornerFacts(base,shadow,'2026-11-14'));
 ({base,shadow}=fixture());shadow.verified_corner_sources.push(shadow.verified_corner_sources[0]);
 assert.throws(()=>mergeVerifiedLocalCornerFacts(base,shadow,'2026-11-14'));
});
test('new fixed weight rubric refused while conventional LOCAL1.6 is allowed',()=>{
 const v='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013';
 assert.throws(()=>assertLocal16NoUnauthorizedRubric(v,{audit:{manual_score_breakdown:{maxima:[30,25,20,15,10]}}}),/UNAPPROVED_FIXED_WEIGHT/);
 assert.equal(assertLocal16NoUnauthorizedRubric(v,{audit:{execution_profile:'UNIFIED_LOCAL_ABILITY_V1'}}),true);
});