import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPreraceEyeBoundaryCounterfactual,evaluateEyeBoundaryAfterResult,
  auditMechanicalEyeSwapPairs} from './frozen-eye-boundary-study.mjs';
function fixture({track='福島',race_no=8,top=[15,14,4,3,6],
 eye=9,order=null,actual=[6,9,15],circuit='JRA'}={}){
 const all=order??[...top,...Array.from({length:16},(_,i)=>i+1).filter(n=>!top.includes(n))];
 const field=all.map((horse_no,i)=>({horse_no,horse_name:'馬'+horse_no,rank:i+1,status:'ACTIVE'}));
 const prediction={race_date:'2026-11-08',track,race_no,circuit,status:'FROZEN',
 frozen_at:'2026-11-08T12:30:00+09:00',post_time:'2026-11-08T13:40:00+09:00',
 payload:{runners:field,top5:top.map((horse_no,i)=>({horse_no,
 horse_name:'馬'+horse_no,rank:i+1,grade:'A'})),
 eye:eye===null?null:{horse_no:eye,horse_name:'馬'+eye,rank:all.indexOf(eye)+1},
 market:{popularity:1,odds:1.1}}};
 return {prediction,result:{finishers:actual.map((horse_no,i)=>({horse_no,finish:i+1,win_odds:100,popularity:1}))}};
}
test('Fukushima8: naive 9-for-6 replacement loses winner despite EYE finishing second',()=>{
 const case8=fixture({order:[15,14,4,3,6,7,9,13,10,5,11,8,2,12,1,16]}),
 before=structuredClone(case8);
 const pred=buildPreraceEyeBoundaryCounterfactual(case8.prediction);
 assert.equal(pred.state,'SHADOW_ONLY');
 assert.deepEqual(pred.proposal.baseline_top5,[15,14,4,3,6]);
 assert.deepEqual(pred.proposal.shadow_top5,[15,14,4,3,9]);
 const out=evaluateEyeBoundaryAfterResult(pred.proposal,case8.result);
 assert.deepEqual(out.newly_caught,[9]);
 assert.deepEqual(out.lost_from_top5,[6]);
 assert.equal(out.winner_lost,true);
 assert.equal(out.podium_before,2);assert.equal(out.podium_after,2);
 assert.equal(pred.proposal.target_result_used,false);
 assert.deepEqual(case8,before);
});
test('a profitable example is captured as research, not a live ranking rule',()=>{
 const pair=fixture({track:'京都',race_no:7,actual:[9,15,14]});
 const a=buildPreraceEyeBoundaryCounterfactual(pair.prediction);
 const o=evaluateEyeBoundaryAfterResult(a.proposal,pair.result);
 assert.equal(o.podium_gain,1);assert.equal(o.podium_loss,0);
 assert.equal(o.winner_gained,true);
 assert.equal(o.production_rank_effect,false);assert.equal(a.changed_frozen,false);
});
test('without EYE, never auto-promote rank 6',()=>{
 const p=fixture({eye:null,actual:[6,4,15]});
 const a=buildPreraceEyeBoundaryCounterfactual(p.prediction);
 assert.equal(a.state,'NO_EYE_NOT_AUTO_RANK6');
 assert.equal(a.proposal,null);
 const s=auditMechanicalEyeSwapPairs([p]);
 assert.equal(s.cohorts['JRA|HOLDOUT_1108'].candidates,0);
 assert.equal(s.cohorts['JRA|HOLDOUT_1108'].eye_without_promotion,1);
});
test('prerace builder rejects result leakage, late freeze, and horse mismatch',()=>{
 const p=fixture();
 p.prediction.result=p.result;
 assert.equal(buildPreraceEyeBoundaryCounterfactual(p.prediction).state,'INPUT_MUST_BE_PRERACE_ONLY');
 delete p.prediction.result;
 p.prediction.frozen_at=p.prediction.post_time;
 assert.equal(buildPreraceEyeBoundaryCounterfactual(p.prediction).state,'NOT_VERIFIED_PRERACE');
 p.prediction.frozen_at='2026-11-08T12:30:00+09:00';
 p.prediction.payload.eye.horse_name='別馬';
 assert.equal(buildPreraceEyeBoundaryCounterfactual(p.prediction).state,'EYE_NOT_IN_FROZEN_FIELD');
});
test('outcome comparison requires three official distinct finishers',()=>{
 const p=fixture(),shadow=buildPreraceEyeBoundaryCounterfactual(p.prediction);
 p.result.finishers[2].horse_no=p.result.finishers[0].horse_no;
 assert.equal(evaluateEyeBoundaryAfterResult(shadow.proposal,p.result).state,'RESULT_NOT_VERIFIED');
});
test('aggregate reports both the added EYE and displaced fifth, with duplicate rejection',()=>{
 const a=fixture({actual:[6,9,15]});
 const b=fixture({track:'東京',race_no:10,actual:[9,4,14]});
 const x=auditMechanicalEyeSwapPairs([a,b,a]);
 const s=x.cohorts['JRA|HOLDOUT_1108'];
 assert.equal(s.races,2);assert.equal(s.candidates,2);
 assert.equal(s.podium_gain,2);assert.equal(s.podium_loss,1);
 assert.equal(s.winner_gain,1);assert.equal(s.winner_loss,1);
 assert.equal(x.invalid.length,1);assert.equal(x.invalid[0].reason,'DUPLICATE_RACE');
});
