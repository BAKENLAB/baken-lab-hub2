import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const v14=readFileSync(new URL('./staged-lab-claimed-context-handler-v14.mjs',import.meta.url),'utf8');
const v15=readFileSync(new URL('./staged-lab-claimed-context-handler-v15.mjs',import.meta.url),'utf8');
test('v15 retains v14 lease, roster, source and three-key gates',()=>{
 for(const fragment of [
  'assertLiveClaim(state,now)',
  "Object.keys(input).length!==3",
  "context.field_integrity_checked!==true",
  "if(!Array.isArray(context.runners)",
  "UNSAFE_HISTORY",
  "historyBeforeRace(h,state.race)",
  "verifiedRunners:context.runners,compactRunners:runners",
  "preclaimCornerPacket=await Promise.race"
 ])assert.ok(v15.includes(fragment),'missing '+fragment);
});
test('v15 has only optional shadow observations without modifying core score or bets',()=>{
 assert.ok(!v14.includes('official_loss_shadow'));
 assert.ok(v15.includes('official_loss_shadow'));
 assert.ok(v15.includes("use_for_rank:false,use_for_save_gate:false"));
 assert.ok(v15.includes("true_cause_status:'NOT_PROVEN'"));
 assert.ok(!/lab_save_claimed_prediction|lab_queue_claim_next|cron\.schedule|official_predictions|update\('official_races'/i.test(v15));
});

test('both research handlers hand off source links only as descriptive corner shadow',()=>{
 for(const source of [v14,v15]){
  assert.ok(source.includes('verified_corner_sources:shadow.verified_corner_sources'));
  assert.ok(source.includes('use_for_rank:false,use_for_save_gate:false'));
  assert.ok(source.includes('preclaimCornerPacket=await Promise.race'));
 }
});
