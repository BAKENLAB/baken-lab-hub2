import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJraIncidentLossReview as review} from '../automation/jra-incident-loss-review.mjs';
const ref='/JRADB/accessS.html?CNAME=pw01sde1003202502060120250713/BF';
const url='https://www.jra.go.jp'+ref,core='1003202502060120250713',checked='2026-11-15T07:50:00+09:00';
const targetRace={raceDate:'2026-11-15',postTime:'2026-11-15T12:00:00+09:00'};
const clock=()=>Date.parse('2026-11-15T08:00:00+09:00');
const h={horse_no:7,horse_name:'試験馬',horse_ref:'/JRADB/accessU.html?CNAME=pw01dud102023103702/53',status:'ACTIVE'},id='2023103702';
const ev=(kind='INTERFERENCE_VICTIM',role='VICTIM')=>({kind,role,horse_id:id,race_date:'2025-07-13',source_ref:url,source_checked_at:checked,certainty:'OFFICIAL_RECORDED_FACT'});
const run={race_date:'2025-07-13',track:'福島',surface:'芝',distance:1200,finish:4,margin_to_winner:0.3,margin_basis:'CLAIMED_RESULT_REPORTED_MARGIN',early_pos:9,final_turn_pos:6,final3f:34.9,historical_source_ref:ref,deep_status:'EXACT_CLAIM_LIVE_HISTORY_MATCH'};
const lap={status:'OFFICIAL_RACE_LAPS_VERIFIED',verified:true,race_date:run.race_date,track:run.track,race_no:1,surface:run.surface,distance:run.distance,source_ref:url,source_checked_at:checked,lap_seconds:[12,11,11,11.3,11.5,12],first_600m_seconds:34,last_600m_seconds:34.8};
const args=(events=[ev()],r=run)=>({targetRace,clock,officialRunners:[h],deepHistory:{status:'SNAPSHOT_MATCHED',race_date:targetRace.raceDate,runner_history:[{horse_no:h.horse_no,horse_name:h.horse_name,past_runs:[r]}]},incidentReview:{status:'WHOLE_FIELD_INCIDENT_REVIEW',runners:[{horse_no:h.horse_no,horse_id:id,history:[{race_date:run.race_date,race_core:core,status:'VERIFIED_SOURCE_REVIEW',partial:true,sources:[{kind:'RESULT',source_ref:url,source_checked_at:checked}],events}]}]},lapPackets:[lap]});
const one=(a)=>review(a).runners[0].reviews[0];
test('primary victim with independent run facts receives review, not automatic ability credit',()=>{
 const a=args(),before=JSON.stringify(a),x=review(a),v=x.runners[0].reviews[0];
 assert.equal(x.coverage.joined_runs,1);assert.equal(x.coverage.lap_joined_runs,1);
 assert.equal(v.assessment,'EXTERNAL_PRIMARY_REVIEW');assert.equal(v.review_for_merit,true);
 assert.deepEqual(v.positions,{early:9,final_corner:6,gain_to_corner:3,gain_after_corner:2});
 assert.equal(v.runner_last_3f,34.9);assert.equal(v.race_lap_observation.race_first_600m,34);
 assert.equal(v.auto_score_effect,0);assert.equal(v.loss_cause,'UNPROVEN');assert.equal(v.time_loss_seconds,null);
 assert.equal(v.incomplete_incident_source,true);assert.equal(x.rank_effect,'NONE');assert.equal(JSON.stringify(a),before);
});
test('own behavior, secondary impact, mixed and stop remain distinct',()=>{
 for(const [events,status] of [[[ev('SELF_EVASION','SELF')],'OWN_BEHAVIOR_OR_ACTOR_RISK_REVIEW'],[[ev('ADDITIONAL_PATH_IMPACT')],'SECONDARY_IMPACT_REVIEW'],[[ev(),ev('SLOW_START','SELF')],'MIXED_EXTERNAL_AND_OWN_RISK_REVIEW'],[[ev(),ev('RACE_STOPPED','SELF')],'STOP_OR_HEALTH_REVIEW_NO_ABILITY_CREDIT']]){
  const v=one(args(events));assert.equal(v.assessment,status);assert.equal(v.review_for_merit,false);assert.equal(v.auto_score_effect,0);
 }
});
test('no event never asserts an incident-free run and absent source stays absent',()=>{
 let a=args([]);assert.equal(one(a).assessment,'NO_RECORDED_EVENT_IN_AVAILABLE_SOURCES');assert.equal(one(a).absence_is_not_no_incident,true);
 a.incidentReview.runners[0].history=[];assert.equal(one(a).status,'INCIDENT_SOURCE_UNVERIFIED');
});
test('different horse, future source, wrong lap race cannot add evidence',()=>{
 let a=args([{...ev(),horse_id:'2023109999'}]);assert.equal(one(a).review_for_merit,false);
 a=args();a.incidentReview.runners[0].history[0].sources[0].source_checked_at='2026-11-15T13:00:00+09:00';assert.equal(one(a).status,'INCIDENT_SOURCE_UNVERIFIED');
 a=args();a.lapPackets=[{...lap,surface:'ダート'}];assert.equal(one(a).race_lap_observation,null);
 a=args();a.clock=()=>Date.parse(targetRace.postTime);assert.equal(review(a).status,'UNVERIFIED_FIELD');
});
test('winner, unknown individual performance and wrong prior identity are not loss candidates',()=>{
 assert.equal(one(args([ev()],{...run,finish:1})).review_for_merit,false);
 assert.equal(one(args([ev()],{...run,early_pos:null,final_turn_pos:null,final3f:null})).review_for_merit,false);
 assert.equal(one(args([ev()],{...run,historical_source_ref:ref.replace('20250713','20250714')})).status,'PRIOR_IDENTITY_UNVERIFIED');
});

test('missing incident source retains separately verified historical laps and observable positions',()=>{
 const a=args();a.incidentReview.runners[0].history=[];
 const v=one(a);assert.equal(v.status,'INCIDENT_SOURCE_UNVERIFIED');
 assert.equal(v.incident_source_verified,false);assert.equal(v.review_for_merit,false);
 assert.equal(v.race_lap_observation.race_first_600m,34);
 assert.equal(v.positions.gain_after_corner,2);
 assert.equal(v.loss_cause,'UNPROVEN');assert.equal(v.auto_score_effect,0);
 const x=review(a);assert.equal(x.coverage.joined_runs,0);assert.equal(x.coverage.lap_joined_runs,1);
});
test('wrong or absent timing never creates incident evidence or a merit finding',()=>{
 const a=args();a.incidentReview.runners[0].history=[];a.lapPackets=[{...lap,source_ref:url.replace('20250713','20250714')}];
 const v=one(a);assert.equal(v.race_lap_observation,null);assert.equal(v.incident_source_verified,false);
 assert.equal(v.review_for_merit,false);assert.deepEqual(v.incident_kinds,[]);
});
