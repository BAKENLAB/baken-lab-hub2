import test from 'node:test';
import assert from 'node:assert/strict';
import {checkLocal17Pair,digest} from '../automation/local17-pre-race-pair-guard.mjs';
const make=()=>{
  const baseline={model:'LOCAL1.6',race_date:'2026-11-10',track:'金沢',race_no:11,post_time:'2026-11-10T11:45:00Z',frozen_at:'2026-11-10T09:19:42Z',status:'FROZEN',active_horse_nos:[1,2,3]};
  const capture={race_date:baseline.race_date,track:baseline.track,race_no:baseline.race_no,evidence_as_of:'2026-11-10T09:10:00Z',active_horse_nos:[1,2,3],full_order:[3,1,2],evidence_refs:['official:historic:sample']};
  const shadow={model:'LOCAL1.7',race_date:baseline.race_date,track:baseline.track,race_no:baseline.race_no,status:'FROZEN',captured_at:'2026-11-10T09:11:00Z',as_of:capture.evidence_as_of,capture,receipt:{capture_sha256:digest(capture),immutable_storage_ref:'external:append-only:sample',captured_before_post_verified:true}};
  const result={race_date:baseline.race_date,track:baseline.track,race_no:baseline.race_no,settled_at:'2026-11-10T11:55:00Z',source:'NAR_OFFICIAL_RACEMARK'};
  return {baseline,shadow,result};
};
test('accepts independently receipted full-field pre-race pair',()=>assert.equal(checkLocal17Pair(make()).eligible,true));
test('rejects unrelated shadow model',()=>{const x=make();x.shadow.model='ABILITY_RELATIVE_V0_2';assert.equal(checkLocal17Pair(x).reason,'WRONG_MODEL');});
test('rejects post-race capture even with valid digest',()=>{const x=make();x.shadow.captured_at='2026-11-10T11:46:00Z';assert.equal(checkLocal17Pair(x).reason,'AS_OF_OR_SETTLEMENT_VIOLATION');});
test('rejects altered ranking with stale digest',()=>{const x=make();x.shadow.capture.full_order=[1,2,3];assert.equal(checkLocal17Pair(x).reason,'SHADOW_DIGEST_MISMATCH');});
test('rejects incomplete field even with refreshed digest',()=>{const x=make();x.shadow.capture.full_order=[1,2];x.shadow.receipt.capture_sha256=digest(x.shadow.capture);assert.equal(checkLocal17Pair(x).reason,'INCOMPLETE_OR_DIFFERENT_FIELD');});
test('rejects missing independent receipt',()=>{const x=make();delete x.shadow.receipt.immutable_storage_ref;assert.equal(checkLocal17Pair(x).reason,'NO_INDEPENDENT_IMMUTABLE_RECEIPT');});
test('rejects missing evidence',()=>{const x=make();x.shadow.capture.evidence_refs=[];x.shadow.receipt.capture_sha256=digest(x.shadow.capture);assert.equal(checkLocal17Pair(x).reason,'MISSING_PRERACE_EVIDENCE');});
