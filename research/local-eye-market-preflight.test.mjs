import test from 'node:test';
import assert from 'node:assert/strict';
import {localEyeMarketPreflight as preflight} from '../automation/local-eye-market-preflight.mjs';
import {localOfficialHistoricalClassEvidence as officialClass} from '../automation/local-verified-condition-bridge.mjs';
const candidate=(finding)=>({horse_no:8,rank:6,review_checks:{class_change:{
 status:'CHECKED',finding,evidence_refs:['COMPACT_V1.runners[horse_no=8].recent_runs[0]']
}}});
const make=(value)=>({audit:{eye_candidate_audit:[candidate(value)],
 eye_positive_factor_audit:[{horse_no:8,positive_factors:[]}],eye_tie_break:null},eye:null});
test('fatal sponsored race-name false positive detected BEFORE guarded save',()=>{
 const x=preflight(make('10/12 盛岡 オッズパーク賞C1五組'));
 assert.equal(x.ok,false);
 assert.equal(x.code,'LOCAL_EYE_MARKET_EVIDENCE_PREFLIGHT');
 assert.equal(x.issues[0].path,'audit.eye_candidate_audit[0].review_checks.class_change.finding');
});
test('rebuilding factual class-only evidence avoids the false positive safely',()=>{
 const evidence=officialClass({track:'盛岡',race_name:'オッズパーク賞C1五組',
  evidence_ref:'COMPACT_V1.runners[horse_no=8].recent_runs[0]'});
 assert.equal(evidence.display,'C1五組');
 const x=preflight(make('10/12 盛岡 '+evidence.display));
 assert.equal(x.ok,true);
 assert.equal(x.payload_modified,false);
 assert.equal(x.validator_relaxed,false);
});
test('real horse-odds rationale remains blocked',()=>{
 assert.equal(preflight(make('オッズが高いので好走確率上げる')).ok,false);
 assert.equal(preflight({eye:{reason:'人気だから'}}).ok,false);
 assert.equal(preflight({audit:{eye_positive_factor_audit:[{odds:12}]}}).ok,false);
});
