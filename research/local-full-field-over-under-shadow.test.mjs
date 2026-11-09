import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalFullFieldOverUnderShadow as review} from '../automation/local-full-field-over-under-shadow.mjs';

const date='2026-11-10';
const race={
 race_date:date,track:'名古屋',race_no:7,race_name:'C2組',
 class_name:'C2',surface:'ダート',distance:1500,
 observation_at:'2026-11-10T10:00:00+09:00',
 post_time:'2026-11-10T15:00:00+09:00'
};
const run=(horse_no,index,finish,margin='0.2',overrides={})=>({
 race_date:index===0?'2026-10-20':'2026-09-19',
 track:'名古屋',class:'C2',surface:'ダート',distance:1500,
 finish,margin,
 evidence_ref:`COMPACT_V1.runners[horse_no=${horse_no}].recent_runs[${index}]`,
 ...overrides
});
const make=()=>{
 const baseline=Array.from({length:12},(_,i)=>({
  horse_no:i+1,horse_name:'馬'+(i+1),rank:i+1,score:95-i
 }));
 const runner_evidence=baseline.map(h=>({
  horse_no:h.horse_no,horse_name:h.horse_name,supporting_runs:[]
 }));
 const set=(no,arr)=>{runner_evidence[no-1].supporting_runs=arr};
 set(1,[run(1,0,1),run(1,1,2)]); // high-quality ◎ is protected
 set(2,[run(2,0,9,'2.1'),run(2,1,8,'1.8')]); // inflated ○ 
 set(5,[run(5,0,2),run(5,1,3)]); // good fifth is protected
 set(9,[run(9,0,2),run(9,1,1)]); // independently strong rank9
 set(6,[run(6,0,2)]); // a sixth-rank shortcut MUST NOT happen
 return {baseline,comparison:{
  status:'READY',data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY',
  target_date:date,runner_evidence,
  market_used:false,target_result_used:false,rank_effect:false,score_effect:false
 }};
};
const call=(change={})=>{
 const d=make();return review({race,baseline:d.baseline,comparison:d.comparison,...change});
};

test('all-five overvaluation audit can demote rank2 and rescue rank9 (not automatic rank6)',()=>{
 const x=call();
 assert.equal(x.status,'PROPOSED_FULL_FIELD_EXCHANGE');
 assert.equal(x.full_field_checked,12);
 assert.deepEqual(x.baseline_top5,[1,2,3,4,5]);
 assert.deepEqual(x.proposed_top5,[1,3,4,5,9]);
 assert.equal(x.proposed_top5.includes(6),false);
 assert.equal(x.exchanges[0].removed_top5_horse_no,2);
 assert.equal(x.exchanges[0].added_top5_horse_no,9);
 assert.equal(x.exchanges[0].incumbent_negative_refs.length,2);
 assert.equal(x.exchanges[0].outsider_positive_refs.length,2);
 assert.equal(new Set(x.candidate_order).size,12);
 assert.equal(x.frozen_modified,false);
 assert.equal(x.production_rank_effect,false);
 assert.equal(x.market_used,false);
});

test('multiple unrelated overvalued TOP5 and undervalued deep outsiders are reviewed together',()=>{
 const d=make();
 d.comparison.runner_evidence[3].supporting_runs=[
  run(4,0,11,'2.2'),run(4,1,10,'2.0')];
 d.comparison.runner_evidence[11].supporting_runs=[
  run(12,0,1),run(12,1,3)];
 const x=review({race,...d});
 assert.equal(x.exchanges.length,2);
 assert.deepEqual(x.exchanges.map(y=>y.removed_top5_horse_no),[2,4]);
 assert.deepEqual(x.exchanges.map(y=>y.added_top5_horse_no),[9,12]);
 assert.deepEqual(x.proposed_top5,[1,3,5,9,12]);
});

test('one bad result must not cause overvaluation flag/demotion',()=>{
 const d=make();
 d.comparison.runner_evidence[1].supporting_runs=[run(2,0,9,'2.1')];
 const x=review({race,...d});
 assert.equal(x.status,'UNCHANGED');
 assert.equal(x.overvaluation_review_count,0);
 assert.equal(x.proposed_top5.includes(2),true);
});

test('single good outsider race is insufficient; even rank6 cannot be auto promoted',()=>{
 const d=make();
 d.comparison.runner_evidence[8].supporting_runs=[run(9,0,1)];
 const x=review({race,...d});
 assert.equal(x.status,'UNCHANGED');
 assert.equal(x.undervaluation_review_count,0);
 assert.deepEqual(x.proposed_top5,[1,2,3,4,5]);
});

test('missing history is UNKNOWN rather than a negative that justifies demotion',()=>{
 const d=make();
 d.comparison.runner_evidence[1].supporting_runs=[];
 const x=review({race,...d});
 assert.equal(x.status,'UNCHANGED');
 assert.equal(x.overvaluation_review_count,0);
 assert.equal(x.all_runner_audits[1].review,'INSUFFICIENT_COMPARABLE_HISTORY');
 assert.equal(x.all_runner_audits[1].missing_history_is_not_failure,true);
});

test('different district, class, surface or distance cannot create false matched proof',()=>{
 const d=make();
 d.comparison.runner_evidence[8].supporting_runs=[
  run(9,0,1,'0.1',{track:'佐賀'}),
  run(9,1,2,'0.1',{class:'C1'})];
 const x=review({race,...d});
 assert.equal(x.status,'UNCHANGED');
 assert.equal(x.all_runner_audits[8].other_venue_or_class_runs,2);
 assert.equal(x.all_runner_audits[8].recent_matched_podium,0);
});

test('prior small-margin fourth is a positive sign but not inflated into podium proof',()=>{
 const d=make();
 d.comparison.runner_evidence[8].supporting_runs=[
  run(9,0,4,'0.3'),run(9,1,2,'0.4')];
 const x=review({race,...d});
 assert.equal(x.all_runner_audits[8].small_margin_near_misses,1);
 assert.equal(x.all_runner_audits[8].recent_matched_podium,1);
 assert.equal(x.undervaluation_review_count,0);
});

test('no current results, market values, after-post and future historical runs are permitted',()=>{
 const d=make();
 assert.equal(review({race:{...race,result:{winner:9}},...d}).status,'UNVERIFIED');
 assert.equal(review({race:{...race,observation_at:'2026-11-10T16:00:00+09:00'},...d}).status,'UNVERIFIED');
 const tainted=structuredClone(d);
 tainted.baseline[8].popularity=1;
 assert.equal(review({race,...tainted}).status,'UNVERIFIED');
 const future=structuredClone(d);
 future.comparison.runner_evidence[8].supporting_runs[0].race_date=date;
 assert.equal(review({race,...future}).reason,'HISTORICAL_EVIDENCE_NOT_VERIFIED_ASOF');
});

test('duplicated past race evidence references cannot amplify a horse score',()=>{
 const d=make();
 d.comparison.runner_evidence[8].supporting_runs[1].evidence_ref=
  d.comparison.runner_evidence[8].supporting_runs[0].evidence_ref;
 assert.equal(review({race,...d}).reason,'HISTORICAL_EVIDENCE_NOT_VERIFIED_ASOF');
});

test('candidate still refuses to change rankings if no verified incumbent is overvalued',()=>{
 const d=make();d.comparison.runner_evidence[1].supporting_runs=[
  run(2,0,2),run(2,1,3)];
 const x=review({race,...d});
 assert.equal(x.status,'UNCHANGED');
 assert.equal(x.undervaluation_review_count,1);
 assert.equal(x.overvaluation_review_count,0);
 assert.equal(x.candidate_order.length,12);
 assert.deepEqual(x.proposed_top5,[1,2,3,4,5]);
});

test('UTC early-morning LIVE CLAIM is checked in JST, not falsely rejected as yesterday',()=>{
 const d=make();
 const x=review({race:{...race,observation_at:'2026-11-09T23:00:00Z'},...d});
 assert.equal(x.status,'PROPOSED_FULL_FIELD_EXCHANGE');
 assert.deepEqual(x.proposed_top5,[1,3,4,5,9]);
});
test('real previous local calendar date and future date still fail the as-of gate',()=>{
 const d=make();
 assert.equal(review({race:{...race,observation_at:'2026-11-09T14:59:59Z'},...d}).status,'UNVERIFIED');
 assert.equal(review({race:{...race,observation_at:'2026-11-10T15:00:01Z'},...d}).status,'UNVERIFIED');
});
