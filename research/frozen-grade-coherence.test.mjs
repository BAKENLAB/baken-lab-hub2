import test from 'node:test';
import assert from 'node:assert/strict';
import {auditFrozenGradeCoherence} from './frozen-grade-coherence.mjs';
function p(race_no,score=95,grade='S',day='2026-11-08'){
 return {race_date:day,circuit:'JRA',track:'東京',race_no,
  protocol_version:'JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023',
  status:'FROZEN',frozen_at:day+'T12:00:00+09:00',
  post_time:day+'T13:00:00+09:00',
  payload:{top5:[
   {horse_no:1,horse_name:'馬1',rank:1,score,grade},
   {horse_no:2,horse_name:'馬2',rank:2,score:90,grade:'A'},
   {horse_no:3,horse_name:'馬3',rank:3,score:85,grade:'A'},
   {horse_no:4,horse_name:'馬4',rank:4,score:80,grade:'B'},
   {horse_no:5,horse_name:'馬5',rank:5,score:75,grade:'B'}
  ],market:{popularity:1,win_odds:1.1}}};
}
test('same-day S92 versus A94 is a review flag, never an auto-downgrade',()=>{
 const input=[p(1,92,'S'),p(2,94,'A'),...Array.from({length:9},(_,i)=>p(i+3,95,'S'))];
 const snapshot=structuredClone(input);
 const result=auditFrozenGradeCoherence(input);
 const c=result.cohorts['2026-11-08|JRA|JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023'];
 assert.equal(c.races,11);assert.equal(c.gradeCounts.S,10);assert.equal(c.gradeCounts.A,1);
 assert.equal(c.scoreInversions,1);
 assert.ok(c.flags.includes('S_USAGE_SATURATION_REVIEW'));
 assert.ok(c.flags.includes('S_A_SCORE_ORDER_OVERLAP_REVIEW'));
 assert.equal(result.production_grade_changed,false);
 assert.equal(result.target_result_used,false);
 assert.deepEqual(input,snapshot);
});
test('missing original score is not inferred from grade',()=>{
 const x=[p(1,null,'A','2026-10-25'),p(2,null,'S','2026-10-25')];
 const out=auditFrozenGradeCoherence(x,{minimumSamples:5});
 const c=out.cohorts['2026-10-25|JRA|JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023'];
 assert.equal(c.scoreKnown,0);assert.equal(c.scoreMissing,2);
 assert.equal(c.scoreInversions,0);
 assert.ok(c.flags.includes('SCORE_MISSING_DO_NOT_COMPUTE_SCORE_GAPS'));
});
test('S above A numerically is not an overlap, still no model change',()=>{
 const out=auditFrozenGradeCoherence([p(1,96,'S'),p(2,92,'A')],{minimumSamples:5});
 const c=Object.values(out.cohorts)[0];
 assert.equal(c.scoreInversions,0);assert.equal(c.flags.length,0);
});
test('an all-S cohort raises lack of contrast and saturation flags',()=>{
 const out=auditFrozenGradeCoherence(Array.from({length:10},(_,i)=>p(i+1,95,'S')));
 const c=Object.values(out.cohorts)[0];
 assert.ok(c.flags.includes('S_USAGE_SATURATION_REVIEW'));
 assert.ok(c.flags.includes('NO_S_A_CONTRAST_THIS_COHORT'));
});
test('result leakage, late freeze, bad score and duplicate cannot enter grade audit',()=>{
 const a=p(1),b=p(2);b.result={finishers:[]};
 const c=p(3);c.frozen_at=c.post_time;
 const d=p(4,101,'S');
 const r=auditFrozenGradeCoherence([a,a,b,c,d]);
 assert.equal(Object.values(r.cohorts)[0].races,1);
 assert.deepEqual(r.excluded.map(x=>x.reason),[
   'DUPLICATE_RACE','RESULT_NOT_ALLOWED_IN_PRERACE_AUDIT',
   'NOT_VERIFIED_PRERACE_FROZEN','INVALID_SCORE']);
});
