import test from 'node:test';
import assert from 'node:assert/strict';
import {sealJraPreFreezeShadowPair,auditSealedJraShadowAgainstFrozen} from '../automation/jra-prefreeze-shadow-seal.mjs';
const race={circuit:'JRA',race_date:'2026-11-10',track:'京都',race_no:7,post_time:'2026-11-10T13:40:00+09:00'};
const field=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:'馬'+(i+1),status:'ACTIVE'}));
const baseline=field.map((x,i)=>({...x,rank:i+1}));
const preview={status:'REORDERED',baseline_kind:'EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT',
 official_saved:false,save_authorized:false,production_rank_effect:false,market_used:false,
 target_result_used:false,draft_runners_verified:true,base_core_reference_only:true,
 baseline_top5:[1,2,3,4,5],candidate_order:[1,2,3,4,6,5],top5:[1,2,3,4,6],
 model_version:'ABILITY_RELATIVE_V0_2'};
const observedAt='2026-11-10T12:20:00+09:00';
const cap=()=>sealJraPreFreezeShadowPair({race,field,baseline,preview,observedAt});
const audit=x=>auditSealedJraShadowAgainstFrozen({capture:x,officialFrozenRunners:baseline,
 officialFrozenAt:'2026-11-10T12:25:00+09:00',resultFinisherNos:[6,2,5],resultVerified:true});
test('seals complete pre-FROZEN JRA full-field with deterministic SHA256',()=>{
 const a=cap(),b=cap();assert.equal(a.status,'SEALED_PRE_FREEZE_NOT_OFFICIAL_FROZEN');
 assert.equal(a.capture_sha256,b.capture_sha256);
 assert.deepEqual(a.draft_order,[1,2,3,4,5,6]);
 assert.deepEqual(a.shadow_order,[1,2,3,4,6,5]);assert.equal(a.frozen_modified,false);
});
test('result comparison requires the matching actual FROZEN order',()=>{
 const a=audit(cap());assert.equal(a.status,'OFFLINE_PAIRED_AUDIT_COMPLETE');
 assert.deepEqual(a.newly_selected,[6]);assert.deepEqual(a.displaced,[5]);
 assert.deepEqual(a.newly_captured_finishers,[6]);assert.deepEqual(a.lost_captured_finishers,[5]);
 assert.equal(a.baseline_top3_captured,2);assert.equal(a.shadow_top3_captured,2);
});
test('postsave rank drift blocks a misleading model improvement',()=>{
 const b=structuredClone(baseline);b[4].rank=6;b[5].rank=5;
 assert.equal(auditSealedJraShadowAgainstFrozen({capture:cap(),officialFrozenRunners:b,
 officialFrozenAt:'2026-11-10T12:25:00+09:00',resultFinisherNos:[6,2,5],resultVerified:true}).status,
 'OFFICIAL_FROZEN_DIFFERS_FROM_DRAFT');
});
test('tampering with any sealed ranking fails its checksum',()=>{
 const a=cap();a.shadow_order[0]=3;assert.equal(audit(a).status,'CAPTURE_TAMPERED');
});
test('after deadline capture and too-late FROZEN fail closed',()=>{
 assert.equal(sealJraPreFreezeShadowPair({race,field,baseline,preview,
 observedAt:'2026-11-10T13:38:00+09:00'}).status,'PRE_RACE_TIME_OR_RACE_INVALID');
 assert.equal(auditSealedJraShadowAgainstFrozen({capture:cap(),officialFrozenRunners:baseline,
 officialFrozenAt:'2026-11-10T13:39:00+09:00',resultFinisherNos:[6,2,5],
 resultVerified:true}).status,'NOT_A_VALID_AS_OF_FROZEN_PAIR');
});
test('partial, false-baseline, result-leaked, and contaminated draft cannot be sealed',()=>{
 const fake=changes=>sealJraPreFreezeShadowPair({race,field,baseline,preview:{...preview,...changes},observedAt});
 assert.equal(fake({baseline_top5:[1,2,3,4,6]}).status,'DRAFT_BASELINE_MISMATCH');
 assert.equal(fake({candidate_order:[1,2,3,4,6,6]}).status,'PROPOSAL_FIELD_OR_TOP5_MISMATCH');
 assert.equal(fake({target_result_used:true}).status,'SHADOW_PREVIEW_NOT_VERIFIED');
 assert.equal(sealJraPreFreezeShadowPair({race,field,baseline:[{...baseline[0],odds:10},...baseline.slice(1)],preview,observedAt}).status,'WHOLE_FIELD_DRAFT_INVALID');
});
test('missing independently verified result blocks an offline audit',()=>{
 assert.equal(auditSealedJraShadowAgainstFrozen({capture:cap(),officialFrozenRunners:baseline,
 officialFrozenAt:'2026-11-10T12:25:00+09:00',resultFinisherNos:[6,2,5],
 resultVerified:false}).status,'OFFICIAL_RESULT_NOT_VERIFIED');
});