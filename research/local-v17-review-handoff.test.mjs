import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalV17ReviewHandoff as handoff, buildLocalV17ReviewFromClaimedContext as fromContext} from '../automation/local-v17-review-handoff.mjs';

const race={
 circuit:'LOCAL',race_date:'2026-11-14',track:'名古屋',race_no:6,
 race_name:'C2組',class_name:'C2',surface:'ダート',distance:1500,
 observation_at:'2026-11-14T10:05:00+09:00',
 post_time:'2026-11-14T13:00:00+09:00'
};
const hist=(n,finish)=>({
 race_date:'2026-10-22',track:'名古屋',class:'C2組',
 surface:'ダート',distance:1500,finish,early_pos:3,final_turn_pos:3,
 evidence_ref:`COMPACT_V1.runners[horse_no=${n}].recent_runs[0]`
});
function fixture(){
 const activeRunners=Array.from({length:10},(_,i)=>({
  horse_no:i+1,horse_name:`架空馬${i+1}`,status:'ACTIVE'}));
 const old=[1,2,3,4,10,6,7,8,9,5];
 const baseline=old.map((n,i)=>({horse_no:n,horse_name:`架空馬${n}`,rank:i+1}));
 const comparison={
  status:'READY',data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY',
  target_date:race.race_date,market_used:false,target_result_used:false,
  rank_effect:false,score_effect:false,
  runner_evidence:activeRunners.map(r=>({
   horse_no:r.horse_no,horse_name:r.horse_name,
   supporting_runs:[hist(r.horse_no,r.horse_no)],
   context_runs:[hist(r.horse_no,r.horse_no)]
  }))
 };
 return {race:structuredClone(race),activeRunners,baseline,comparison};
}
test('all ten are independently scored before old ranks are compared',()=>{
 const input=fixture(),before=structuredClone(input);
 const r=handoff(input);
 assert.equal(r.status,'RESEARCH_DRAFT_REVIEWABLE',JSON.stringify(r));
 assert.equal(r.all_runners_checked,10);
 assert.deepEqual(r.original_top5,[1,2,3,4,10]);
 assert.deepEqual(r.independently_scored_top5,[1,2,3,4,5]);
 assert.deepEqual(r.newly_in_top5,[5]);
 assert.deepEqual(r.dropped_from_top5,[10]);
 assert.equal(r.scored_full_field.length,10);
 assert.equal(r.scored_full_field.every(x=>Number.isInteger(x.independent_score_100)
  &&x.independent_score_100>=0&&x.independent_score_100<=100),true);
 assert.equal(r.scored_full_field.find(x=>x.horse_no===5).baseline_rank,10);
 assert.equal(r.scored_full_field.find(x=>x.horse_no===5).independent_rank,5);
 assert.deepEqual(input,before);
 assert.equal(r.production_rank_effect,false);
 assert.equal(r.production_score_effect,false);
 assert.equal(r.save_authorized,false);
 assert.equal(r.frozen_modified,false);
});
test('the 100-point order does not depend on baseline 1.6 ranks',()=>{
 const a=fixture(),b=fixture();
 b.baseline.reverse().forEach((h,i)=>h.rank=i+1);
 const first=handoff(a),second=handoff(b);
 assert.equal(first.status,'RESEARCH_DRAFT_REVIEWABLE');
 assert.equal(second.status,'RESEARCH_DRAFT_REVIEWABLE');
 assert.deepEqual(first.independently_scored_full_order,
  second.independently_scored_full_order);
 assert.deepEqual(first.scored_full_field.map(h=>h.independent_score_100),
  second.scored_full_field.map(h=>h.independent_score_100));
 assert.notDeepEqual(first.original_top5,second.original_top5);
});
test('each candidate carries source refs and an explicit uncertainty',()=>{
 const r=handoff(fixture());
 assert.equal(r.scored_full_field.length,10);
 const first=r.scored_full_field.find(x=>x.horse_no===1);
 assert.equal(first.strongest_evidence.length,1);
 assert.equal(first.strongest_evidence[0].evidence_ref,
  'COMPACT_V1.runners[horse_no=1].recent_runs[0]');
 assert.equal(first.strongest_evidence[0].finish,1);
 assert.equal(first.strongest_evidence[0].track,'名古屋');
 assert.equal(first.evidence_warning,'HISTORIC_CAUSAL_EXPLANATION_NOT_PROVEN');
 assert.equal(r.rank_change_explanations_required,true);
});
test('incomplete roster, duplicate horses or inconsistent baseline ranks abstain',()=>{
 const incomplete=fixture();incomplete.activeRunners.pop();
 assert.equal(handoff(incomplete).reason,'OFFICIAL_FULL_FIELD_OR_BASELINE_MISSING');
 const duplicate=fixture();duplicate.activeRunners[1].horse_no=1;
 assert.equal(handoff(duplicate).reason,'OFFICIAL_IDENTITY_OR_BASELINE_RANK_MISMATCH');
 const bad=fixture();bad.baseline[1].rank=1;
 assert.equal(handoff(bad).reason,'OFFICIAL_IDENTITY_OR_BASELINE_RANK_MISMATCH');
});
test('future result or market evidence blocks independent handoff',()=>{
 const m=fixture();m.comparison.runner_evidence[0].context_runs[0].odds=2.2;
 const mr=handoff(m);
 assert.equal(mr.status,'ABSTAINED');
 assert.equal(mr.scorer_reason,'COMPLETE_OFFICIAL_PRE_RACE_PACKET_UNVERIFIED');
 const after=fixture();after.race.observation_at=after.race.post_time;
 assert.equal(handoff(after).status,'ABSTAINED');
 const future=fixture();future.comparison.runner_evidence[0].context_runs[0].race_date=race.race_date;
 assert.equal(handoff(future).status,'ABSTAINED');
});
test('missing one official history prevents any proposed top5',()=>{
 const x=fixture();x.comparison.runner_evidence[0].context_runs=[];
 const y=handoff(x);
 assert.equal(y.status,'ABSTAINED');
 assert.equal(y.reason,'INDEPENDENT_FULL_FIELD_SCORING_NOT_VERIFIED');
 assert.equal(y.scorer_reason,'INSUFFICIENT_EVIDENCE_FOR_FAIR_WHOLE_FIELD_RANK');
 assert.equal('independently_scored_top5' in y,false);
});
test('tied 5th/6th research scores cannot select on horse number',()=>{
 const x=fixture();
 for(const r of x.comparison.runner_evidence){
  r.context_runs[0].finish=6;
  r.supporting_runs[0].finish=6;
 }
 const y=handoff(x);
 assert.equal(y.status,'ABSTAINED');
 assert.equal(y.reason,'TOP5_BOUNDARY_ABILITY_TIE');
});
test('the handoff is review-only and not a saving payload',()=>{
 const r=handoff(fixture());
 assert.equal(r.requires_manual_review,true);
 assert.equal(r.release_status,'RESEARCH_NOT_DEPLOYED');
 assert.equal(r.market_used,false);
 assert.equal(r.target_result_used,false);
 assert.equal(r.save_authorized,false);
 assert.equal(r.production_rank_effect,false);
 assert.equal(r.production_eye_effect,false);
 assert.equal('bets' in r,false);
 assert.equal('payload' in r,false);
});

function claimedFixture(){
 const f=fixture();
 const claimedContext={
  context_format:'COMPACT_V1',field_integrity_checked:true,
  stage:'AWAITING_FULL_DEPTH_COMPARISON',
  protocol:{protocol_key:'LOCAL_MAIN',enforced_server_side:true,version:'1.6'},
  race:{circuit:'LOCAL',race_date:f.race.race_date,track:f.race.track,
   race_no:f.race.race_no,race_name:f.race.race_name,
   post_time:f.race.post_time,
   conditions:{class_name:f.race.class_name,surface:f.race.surface,
    distance:f.race.distance}},
  runners:f.activeRunners.map(({horse_no,horse_name})=>({horse_no,horse_name,
   recent_runs:[],missing_items:[]})),
  relative_condition_status:'READY',
  relative_condition_evidence:{...f.comparison,runner_count:f.activeRunners.length}
 };
 return {claimedContext,baseline:f.baseline,observedAt:f.race.observation_at};
}
test('real COMPACT_V1 structural adapter emits independent review with exact field',()=>{
 const f=claimedFixture(),before=structuredClone(f),r=fromContext(f);
 assert.equal(r.status,'RESEARCH_DRAFT_REVIEWABLE',JSON.stringify(r));
 assert.equal(r.evidence_lane,'NORMAL_CLAIM_OFFICIAL_HISTORY_ONLY');
 assert.equal(r.all_runners_checked,10);
 assert.deepEqual(r.independently_scored_top5,[1,2,3,4,5]);
 assert.equal(r.live_claim_rechecked_by_this_pure_function,false);
 assert.equal(r.ready_for_production_adoption,false);
 assert.equal(r.signed_official_score,false);
 assert.deepEqual(f,before);
});
test('forged optional corner metadata does not claim independent official corners',()=>{
 const f=claimedFixture();
 f.claimedContext.official_corner_shadow={
  status:'DESCRIPTIVE_SHADOW_ONLY',use_for_rank:false,
  use_for_save_gate:false,applied_prior_runs:1,
  research_relative_condition_evidence:{status:'READY',runner_count:10}
 };
 const r=fromContext(f);
 assert.equal(r.status,'RESEARCH_DRAFT_REVIEWABLE');
 assert.equal(r.evidence_lane,'NORMAL_CLAIM_OFFICIAL_HISTORY_ONLY');
 assert.equal(r.official_corner_witness_count,0);
});
test('partial, unverified or non-LOCAL claimed context abstains',()=>{
 for(const mutate of [
  x=>{x.claimedContext.field_integrity_checked=false},
  x=>{x.claimedContext.relative_condition_status='PARTIAL_OR_INVALID'},
  x=>{x.claimedContext.relative_condition_evidence.runner_count=9},
  x=>{x.claimedContext.race.circuit='JRA'},
  x=>{x.claimedContext.stage='FINISHED'},
  x=>{x.claimedContext.protocol.enforced_server_side=false}
 ]){
  const x=claimedFixture();mutate(x);
  const r=fromContext(x);
  assert.equal(r.status,'ABSTAINED');
  assert.equal(r.reason,'VERIFIED_CLAIMED_CONTEXT_NOT_AVAILABLE');
 }
});
test('COMPACT_V1 adapter never trusts an after-post time or market-tainted history',()=>{
 const a=claimedFixture();a.observedAt=a.claimedContext.race.post_time;
 const expired=fromContext(a);
 assert.equal(expired.status,'ABSTAINED');
 assert.equal(expired.live_claim_rechecked_by_this_pure_function,false);
 const b=claimedFixture();
 b.claimedContext.relative_condition_evidence.runner_evidence[0].context_runs[0].popularity=1;
 const tainted=fromContext(b);
 assert.equal(tainted.status,'ABSTAINED');
 assert.equal(tainted.scorer_reason,'COMPLETE_OFFICIAL_PRE_RACE_PACKET_UNVERIFIED');
});
