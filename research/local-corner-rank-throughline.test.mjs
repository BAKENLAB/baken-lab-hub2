import test from 'node:test';
import assert from 'node:assert/strict';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';
import {buildLocalRelativeConditionComparison} from '../automation/local-relative-condition-comparison.mjs';
import {buildLocalClaimedCornerShadow} from '../automation/local-claimed-corner-shadow.mjs';
import {buildOptionalSaveLocalShadow} from '../automation/optional-atomic-shadow-save.mjs';

/**
 * Real modules in sequence, fictional horses, fully pre-race dates.
 * This is NOT a historical hit-rate claim and never starts a CLAIM/SAVE.
 */
const target={raceDate:'2026-11-08',track:'佐賀',raceNo:2,
 postTime:'2026-11-08T09:30:00+09:00'};
const asOf='2026-11-08T08:00:00+09:00';
const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
const conditions={class_name:'Ｃ２四組',surface:'ダート',distance:1300};
const prior=(horseNo,weak)=>[1,2].map((i)=>({
 race_date:i===1?'2026-10-13':'2026-10-24',track:'佐賀',race_no:2+i,
 horse_no:horseNo,horse_ref:horseRef,
 source:'NAR_OFFICIAL_HISTORY',identity_verified_by:'OFFICIAL_HORSE_REF',
 race_name:'Ｃ２二組',surface:'ダート',distance:1300,
 finish:weak?(i===1?9:8):3,margin:null,early_pos:null,final_turn_pos:null
}));
function fixture(){
 const compact=Array.from({length:10},(_,i)=>({
  horse_no:i+1,horse_name:'検証馬'+(i+1),
  recent_runs:i===4?prior(5,true):i===5?prior(6,false):[]
 }));
 const verified=compact.map(r=>({...r,identity_refs:[horseRef],
  recent_runs:structuredClone(r.recent_runs)}));
 const evidence=verified[5].recent_runs.map((r,i)=>{
  const pastRace={raceDate:r.race_date,track:r.track,raceNo:r.race_no};
  return {horseNo:6,horseName:'検証馬6',horseRef,
   identityVerifiedBy:'OFFICIAL_HORSE_REF',pastRace,pastHorseNo:6,
   earlyPos:i===0?9:8,finalTurnPos:i===0?4:3,
   source:'NAR_OFFICIAL_PAST_RACE_RESULT',
   sourceRef:officialNarPastResultUrl(pastRace),
   sourceCheckedAt:'2026-11-08T07:50:00+09:00',
   rankingEffect:'NONE_UNTIL_REVIEWED'};
 });
 const packet={status:'PREFETCH_ONLY',raceDate:target.raceDate,
  raceTrack:target.track,raceNo:target.raceNo,
  claimStarted:false,saveAuthorized:false,marketUsed:false,
  targetResultUsed:false,rankChanged:false,evidence};
 const normal=buildLocalRelativeConditionComparison(compact,conditions,target.raceDate);
 const payload={runners:compact.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
  rank:r.horse_no,status:'ACTIVE'}))};
 const context={race:{race_date:target.raceDate,track:target.track,
  race_no:target.raceNo,post_time:target.postTime,race_name:'普通',conditions},
  runners:compact,relative_condition_evidence:normal};
 return {compact,verified,packet,payload,context};
}
const read=(fx)=>buildLocalClaimedCornerShadow({targetRace:target,
 verifiedRunners:fx.verified,compactRunners:fx.compact,cornerPacket:fx.packet,
 conditions,clock:()=>Date.parse(asOf)});
const predict=(fx)=>buildOptionalSaveLocalShadow({
 context:fx.context,payload:fx.payload,now:asOf
});

test('verified pre-CLAIM corner witnesses genuinely change guarded research TOP5',()=>{
 const fx=fixture(),original=structuredClone(fx);
 const ordinary=predict(fx);
 assert.equal(ordinary.preview.status,'UNCHANGED');
 assert.deepEqual(ordinary.preview.top5,[1,2,3,4,5]);
 const corner=read(fx);
 assert.equal(corner.status,'DESCRIPTIVE_SHADOW_ONLY');
 assert.equal(corner.applied_prior_runs,2);
 assert.equal(corner.research_relative_condition_evidence.status,'READY');
 assert.equal(corner.verified_corner_sources.length,2);
 fx.context.official_corner_shadow=corner;
 const enriched=predict(fx),delta=enriched.preview.corner_rank_counterfactual;
 assert.equal(enriched.preview.status,'REORDERED');
 assert.deepEqual(enriched.preview.top5,[1,2,3,4,6]);
 assert.equal(enriched.preview.observed_corner_source,'VERIFIED_PRECLAIM_CORNER_SHADOW');
 assert.equal(enriched.preview.verified_preclaim_corner_applied_runs,2);
 assert.equal(enriched.preview.elected_challenger.podium_evidence_effect,
  'VERIFIED_LATE_CORNER_ADVANCE_PODIUM_NO_PACE_CAUSALITY');
 assert.equal(delta.status,'VERIFIED_SAME_DRAFT_AB_COMPARISON');
 assert.equal(delta.verified_changed_supporting_runs,2);
 assert.deepEqual(delta.new_top5_horse_numbers,[6]);
 assert.deepEqual(delta.lost_top5_horse_numbers,[5]);
 assert.equal(enriched.preview.production_rank_effect,false);
 assert.equal(enriched.preview.frozen_modified,false);
 assert.equal(enriched.preview.market_used,false);
 assert.equal(enriched.preview.target_result_used,false);
 assert.deepEqual(fx.compact,original.compact);
 assert.deepEqual(fx.verified,original.verified);
 assert.deepEqual(fx.packet,original.packet);
 assert.deepEqual(fx.payload,original.payload);
});
test('after-post evidence cannot be laundered into research rank',()=>{
 const fx=fixture();
 for(const e of fx.packet.evidence)e.sourceCheckedAt='2026-11-08T09:31:00+09:00';
 const corner=read(fx);
 assert.equal(corner.applied_prior_runs,0);
 assert.equal(corner.research_relative_condition_evidence,null);
 fx.context.official_corner_shadow=corner;
 assert.deepEqual(predict(fx).preview.top5,[1,2,3,4,5]);
});
test('one official past corner, not two, cannot trigger late advance promotion',()=>{
 const fx=fixture();fx.packet.evidence.pop();
 const corner=read(fx);
 assert.equal(corner.applied_prior_runs,1);
 fx.context.official_corner_shadow=corner;
 const output=predict(fx);
 assert.equal(output.preview.status,'UNCHANGED');
 assert.deepEqual(output.preview.top5,[1,2,3,4,5]);
 assert.equal(output.preview.corner_rank_counterfactual.changed_top5,false);
});
test('official horse identity or past-result URL mismatch cannot make rank proposal',()=>{
 for(const mutate of [
  fx=>{fx.packet.evidence[0].pastHorseNo=21;},
  fx=>{fx.packet.evidence[0].sourceRef='https://not-keiba.example/';}
 ]){
  const fx=fixture();mutate(fx);
  const corner=read(fx);
  assert.equal(corner.applied_prior_runs,1);
  fx.context.official_corner_shadow=corner;
  const out=predict(fx);
  assert.equal(out.preview.status,'UNCHANGED');
  assert.deepEqual(out.preview.top5,[1,2,3,4,5]);
 }
});
