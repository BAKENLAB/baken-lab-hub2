// Minimal data-only bridge. No scoring, no real-mode admission, no TEST relabel.
import assert from 'node:assert/strict';
import {reviewPacket,sha,canonical} from './offline-intake-v0.2.mjs';
const fields={
 finish:'finish',clock_literal:'finishClockLiteral',margin_literal:'officialMarginLiteral',final600_ms:'final600Ms',
 gate:'gate',horse_no:'no',weight_g:'weightG',body_weight_kg:'bodyWeightKg',body_weight_delta_kg:'bodyWeightDeltaKg',
 sex:'sexLiteral',age:'age',birth_date:'birthDateLiteral',display_name:'displayName',
 scheduled_post_literal:'postLiteral',surface:'surfaceLiteral',direction:'directionLiteral',distance_m:'distanceM',going:'goingLiteral',declared_count:'declaredCount',class_literal:'classLiteral',race_final4f_ms:'raceFinal4fMs',race_final3f_ms:'raceFinal3fMs',leader_laps_literal:'leaderLapSlots',corner_groups_literal:'cornerGroupSlots'
};
const unavailable=[
 ['checkpointMs','GENERAL_OFFICIAL_INDIVIDUAL_CROSSING_CLOCK_NOT_VERIFIED'],
 ['checkpointRanks','GROUPED_CORNER_ORDER_NOT_VERIFIED_AS_INDIVIDUAL_DISTANCE_RANK'],
 ['leaderLaps','LITERAL_SLOTS_REQUIRE_VERIFIED_UNIT_AND_BOUNDARIES'],
 ['passing','CORNER_GROUPS_REQUIRE_VERIFIED_CHECKPOINT_DISTANCE'],
 ['clockMs','NATIVE_CLOCK_LITERAL_FORMAT_NOT_CERTIFIED'],
 ['status','START_STATUS_NOT_CERTIFIED_FROM_CURRENT_COLUMNS'],
 ['geometry','HISTORICAL_COURSE_VERSION_REQUIRED'],
 ['rating','SELECTED_PUBLICATION_ONLY'],['incident','SEPARATE_REPORT_AND_ROLE_REQUIRED'],
 ['peerStrength','INDEPENDENT_COMPARISON_REQUIRED'],['training','COVERAGE_AND_RIGHTS_UNCONFIRMED'],
 ['pedigree','SEPARATE_IDENTITY_BOUND_PROFILE_REQUIRED']
];
export function preparePartial(bundle,trust){
 const review=reviewPacket(bundle,trust),events=[];
 const roots=new Map(review.roots.map(x=>[x.id,x]));
 for(const x of review.roots){assert.ok(x.depends.every(d=>roots.has(d)));assert.equal(x.id,sha(JSON.stringify([x.kind,x.payload,x.depends])));}
 const by=(es,h)=>{const result={};for(const o of es.filter(e=>e.horseId===h)){
  const field=fields[o.field];assert.ok(field,'UNKNOWN_SOURCE_FIELD');
  assert.ok(roots.has(o.evidenceId)&&o.depends.every(d=>roots.has(d)));
  result[field]={value:o.value,state:o.status==='MISSING'||o.value===''?'MISSING':'OBSERVED_TEST_FORMAT',evidenceId:o.evidenceId,depends:o.depends};
 }return result;};
 const missing=()=>Object.fromEntries(unavailable.map(([k,v])=>[k,{value:null,state:'HELD',reason:v}]));
 for(const eventId of [...new Set(review.observations.map(e=>e.eventId))]){
  const es=review.observations.filter(o=>o.eventId===eventId),role=es[0].role;
  assert.ok(es.every(e=>e.role===role));assert.equal(role==='TARGET_CARD',eventId===review.target.eventId);
  const native=review.roots.find(r=>r.kind==='RAW_SOURCE'&&r.payload.eventId===eventId).payload.raceIdentity;
  const rowIds=[...new Set(es.filter(o=>o.horseId!==null).map(o=>o.horseId))];
  const rows=rowIds.map(h=>({nativeId:h,observations:by(es,h),unavailable:missing()}));
  events.push({eventId,nativeRaceIdentity:native,role,observations:by(es,null),rows,unavailable:missing()});
 }
 const sourcePacket={schema:'WORK44_PARTIAL_OBSERVATIONS_0.2',scope:'SYNTHETIC_OFFICIAL_FORMAT_TEST',target:review.target,cutoff:review.cutoff,events,roots:review.roots,items:review.runners,groups:118,held:826,formal:false,scoringAuthorized:false,realAdmission:false};
 return {packet:sourcePacket,digest:sha(JSON.stringify(sourcePacket)),engineInput:null,engineBlockers:['CURRENT_COMMON_ENTRY_SYNTHETIC_ONLY','REAL_NATIVE_SAMPLE_CONFORMANCE','TRUSTED_EXTERNAL_RIGHTS_AND_TIME','PARTIAL_FIELD_KERNEL_CONSUMPTION_REQUIRED'],formal:false};
}
export function verifyPartial(bundle,trust,candidate){
 const expected=preparePartial(bundle,trust);assert.deepEqual(candidate,expected,'PARTIAL_PACKET_NOT_SOURCE_BOUND');return expected;
}
export const availability={directDocumented:Object.keys(fields),unavailable,canonicalItems:canonical.length};
