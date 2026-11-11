import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLocalEyePositiveFactorCoverage as coverage} from '../automation/local-eye-factor-coverage-shadow.mjs';

const race={
 race_date:'2026-11-10',observation_at:'2026-11-10T04:20:00+09:00',
 post_time:'2026-11-10T15:40:00+09:00',
 race_no:7,track:'名古屋',surface:'ダート',distance:1500,
 class_name:'C2',official_context_verified:true
};
const field=()=>{
 const runners=Array.from({length:8},(_,i)=>({
  horse_no:i+1,horse_name:'馬'+(i+1),status:'ACTIVE',recent_runs:[]
 }));
 runners[5].recent_runs=[
  {race_date:'2026-10-25',track:'名古屋',surface:'ダート',
   distance:1500,race_name:'オッズパーク賞C2',finish:3,margin:'0.4'},
  {race_date:'2026-09-21',track:'名古屋',surface:'ダート',
   distance:1400,race_name:'C2四組',finish:2,margin:'0.2'},
  {race_date:'2026-10-28',track:'名古屋',surface:'ダート',
   distance:1500,race_name:'C2六組',finish:10,margin:'2.3'}
 ];
 runners[6].recent_runs=[
  {race_date:'2026-10-01',track:'名古屋',surface:'ダート',
   distance:1500,race_name:'C1',finish:3,margin:'0.1'}
 ];
 runners[7].recent_runs=[
  {race_date:'2026-10-05',track:'盛岡',surface:null,
   distance:1500,race_name:'C2',finish:2},
  {race_date:'2026-09-07',track:'名古屋',surface:'ダート',
   distance:1500,race_name:'C2',finish:9}
 ];
 const baseline=runners.map((r,i)=>({
  horse_no:r.horse_no,horse_name:r.horse_name,rank:i+1
 }));
 return {runners,baseline};
};
const run=(overrides={})=>{
 const {runners,baseline}=field();
 return coverage({race,verifiedRunners:runners,baseline,...overrides});
};
test('audits every non-TOP5 runner and exposes missing pre-race podium factors',()=>{
 const out=run();
 assert.equal(out.status,'READY');
 assert.equal(out.outside_top5_checked,3);
 assert.equal(out.positive_run_horses,2);
 assert.equal(out.missing_positive_evidence_horses,2);
 assert.equal(out.missing_positive_evidence_runs,3);
 const sixth=out.runner_reports.find(x=>x.horse_no===6);
 assert.equal(sixth.verified_positive_run_count,2);
 assert.equal(sixth.source_limitations.weak_finish_runs,1);
 assert.equal(sixth.evidence[0].category,'SAME_VENUE_DISTANCE_PODIUM');
 assert.equal(sixth.evidence[1].category,'SAME_VENUE_CLASS_NEAR_DISTANCE_PODIUM');
 assert.notEqual(sixth.evidence[0].source_ref,sixth.evidence[1].source_ref);
 assert.equal(sixth.eye_eligible,null);
 assert.equal(out.eye_selection_effect,false);
});
test('already referenced official run is not mislabeled missing',()=>{
 const audit=[{horse_no:6,positive_factors:[
  {evidence_refs:['COMPACT_V1.runners[horse_no=6].recent_runs[0]']},
  {evidence_refs:['COMPACT_V1.runners[horse_no=6].recent_runs[1]']}
 ]}];
 const out=run({eyePositiveFactorAudit:audit});
 assert.equal(out.status,'READY');
 assert.equal(out.runner_reports[0].coverage_status,'REFERENCED_OR_REVIEWED');
 assert.equal(out.runner_reports[0].unreported_verified_positive_runs.length,0);
 assert.equal(out.missing_positive_evidence_runs,1);
});
test('only independently verified previous runs, not repeated categories from same past race',()=>{
 const out=run();
 const one=out.runner_reports[1];
 assert.equal(one.verified_positive_run_count,1);
 assert.equal(one.evidence[0].category,'SAME_VENUE_DISTANCE_PODIUM');
});
test('missing surface on mixed dirt/turf venue never creates a false factor',()=>{
 const out=run();
 assert.equal(out.runner_reports[2].verified_positive_run_count,0);
 assert.equal(out.runner_reports[2].source_limitations.ambiguous_surface_runs,1);
});
test('official local dirt-only venue allows explicit course-level recovery',()=>{
 const {runners,baseline}=field();
 runners[5].recent_runs[0].surface=null;
 const out=run({verifiedRunners:runners,baseline});
 assert.equal(out.runner_reports[0].verified_positive_run_count,2);
});
test('current-race result or after-the-fact history is excluded',()=>{
 assert.equal(run({race:{...race,result:{finishers:[]}}}).status,'UNVERIFIED');
 const {runners,baseline}=field();
 runners[5].recent_runs[0].race_date='2026-11-10';
 assert.equal(run({verifiedRunners:runners,baseline}).reason,'HISTORICAL_ASOF_OR_DATE_INVALID');
});
test('full official field and baseline identity are mandatory',()=>{
 const {runners,baseline}=field();
 baseline[6].horse_name='別馬';
 assert.equal(run({verifiedRunners:runners,baseline}).reason,'BASELINE_FULL_FIELD_INVALID');
});
test('market field is rejected from the rank baseline, never enters output',()=>{
 const {runners,baseline}=field();
 baseline[6].popularity=1;
 assert.equal(run({verifiedRunners:runners,baseline}).reason,'BASELINE_FULL_FIELD_INVALID');
 const good=run();const text=JSON.stringify(good);
 assert.equal(text.includes('popularity'),false);
 assert.equal(text.includes('win_odds'),false);
});
test('not enough evidence does not force LAB EYE selection',()=>{
 const x=run();
 for(const r of x.runner_reports){
  assert.equal(r.eye_eligible,null);
 }
 assert.equal(x.rank_effect,false);
 assert.equal(x.production_eye_rule_unchanged,true);
});
