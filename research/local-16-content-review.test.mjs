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

test('verified whole-field facts become an equal-depth 100-point evidence contract without a new score',()=>{
 const {base}=fixture();
 const facts={status:'VERIFIED_WHOLE_FIELD_FACTS',runner_count:2,
  head_to_head:[{horse_nos:[1,2]}],
  per_runner:base.map((r,i)=>({horse_no:r.horse_no,
   runs:[{evidence_ref:'COMPACT_V1.runners[horse_no='+r.horse_no+'].recent_runs[0]',
    course_transition_evidence:i===0?{sample_n:20}:null}],
   loss_review_candidate_count:i===0?1:0}))};
 const x=buildLocal16ContentReview({runners:base},facts);
 assert.equal(x.status,'READY_FOR_LOCAL_1_6_FULL_FIELD_REVIEW');
 assert.equal(x.decision_contract,'REQUIRED_FOR_LOCAL_1_6_100_POINT_REASON');
 assert.equal(x.equal_depth_runner_count,2);
 assert.equal(x.per_runner_coverage[0].course_transition_matches,1);
 assert.equal(x.per_runner_coverage[0].loss_with_merit_review_candidates,1);
 assert.equal(x.score_or_rank_override,false);
 assert.equal(x.market_used,false);
});

test('missing or partial content facts do not masquerade as rank-ready',()=>{
 const {base}=fixture();
 const x=buildLocal16ContentReview({runners:base},{status:'UNAVAILABLE'});
 assert.equal(x.status,'CONTENT_FACTS_REQUIRED');
 assert.equal(x.official_past_content_required,true);
 assert.equal(x.save_authorized,false);
});
