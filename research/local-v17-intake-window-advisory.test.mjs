import test from 'node:test';
import assert from 'node:assert/strict';
import {localRaceIntakeAdvisory as plan} from '../automation/local-v17-intake-window-advisory.mjs';
const saga={
 raceDate:'2026-11-14',track:'佐賀',raceNo:1,
 officialPostTime:'2026-11-14T15:20:00+09:00'
};
const kochi={
 raceDate:'2026-11-14',track:'高知',raceNo:1,
 officialPostTime:'2026-11-14T15:35:00+09:00'
};
test('pre-7 JST cannot imply registration failure or authorize preclaim',()=>{
 const r=plan({...saga,observedAt:'2026-11-14T05:40:00+09:00'});
 assert.equal(r.status,'WAITING_0700_JST_SCHEDULE_DISCOVERY');
 assert.equal(r.earliest_normal_schedule_discovery_jst,
  '2026-11-14T07:00:00+09:00');
 assert.equal(r.earliest_normal_detail_attempt_jst,
  '2026-11-14T11:20:00+09:00');
 assert.equal(r.may_call_preclaim,false);
 assert.equal(r.may_call_claim,false);
 assert.equal(r.may_save,false);
});
test('Kochi opens at most four hours before its 15:35 first post',()=>{
 const r=plan({...kochi,observedAt:'2026-11-14T10:10:00+09:00',
  registryStatus:'REGISTERED'});
 assert.equal(r.status,'WAITING_FOUR_HOUR_DETAIL_WINDOW');
 assert.equal(r.earliest_normal_detail_attempt_jst,'2026-11-14T11:35:00+09:00');
});
test('registry missing after 7 remains unready, not a claim candidate',()=>{
 const r=plan({...saga,observedAt:'2026-11-14T11:25:00+09:00'});
 assert.equal(r.status,'WAITING_OFFICIAL_RACE_REGISTRY');
});
test('an eligible clock window without field READY cannot authorize research',()=>{
 const r=plan({...saga,observedAt:'2026-11-14T11:25:00+09:00',
  registryStatus:'REGISTERED',fieldStatus:'PENDING'});
 assert.equal(r.status,'WAITING_OFFICIAL_FIELD_READY');
 assert.equal(r.official_ready_verified_by_this_function,false);
});
test('READY in a static advisory is not an authenticated claim or save',()=>{
 const r=plan({...saga,observedAt:'2026-11-14T11:25:00+09:00',
  registryStatus:'REGISTERED',fieldStatus:'READY'});
 assert.equal(r.status,'OFFICIAL_READY_STILL_REQUIRES_AUTHORIZED_LIVE_CLAIM');
 assert.equal(r.may_call_preclaim,false);
 assert.equal(r.may_call_claim,false);
 assert.equal(r.may_save,false);
});
test('frozen or post-time races cannot be authorized by time calculation',()=>{
 const frozen=plan({...saga,observedAt:'2026-11-14T11:25:00+09:00',
  registryStatus:'REGISTERED',fieldStatus:'READY',alreadyFrozen:true});
 assert.equal(frozen.status,'ALREADY_FROZEN');
 const late=plan({...saga,observedAt:'2026-11-14T15:21:00+09:00',
  registryStatus:'REGISTERED',fieldStatus:'READY'});
 assert.equal(late.status,'POST_TIME_PASSED');
 assert.equal(late.may_save,false);
});
test('11/14 Kochi Final opens only at 16:50 and cannot be backfilled',()=>{
 const final=plan({raceDate:'2026-11-14',track:'高知',raceNo:11,
  officialPostTime:'2026-11-14T20:50:00+09:00',
  observedAt:'2026-11-14T05:40:00+09:00'});
 assert.equal(final.earliest_normal_detail_attempt_jst,
  '2026-11-14T16:50:00+09:00');
});
test('UTC date crossing is judged by JST race date, not utc date',()=>{
 const r=plan({...saga,observedAt:'2026-11-13T20:40:00Z'});
 assert.equal(r.status,'WAITING_0700_JST_SCHEDULE_DISCOVERY');
 assert.equal(r.observed_at_jst,'2026-11-14T05:40:00+09:00');
});
test('invalid post-time or race identity is never considered ready',()=>{
 for(const input of [
  {...saga,officialPostTime:'2026-11-13T15:20:00+09:00'},
  {...saga,officialPostTime:'bad'},
  {...saga,raceNo:0}
 ]){
  const r=plan({...input,observedAt:'2026-11-14T11:25:00+09:00',
   registryStatus:'REGISTERED',fieldStatus:'READY'});
  assert.equal(r.status,'UNVERIFIED');
  assert.equal(r.may_call_claim,false);
 }
});
