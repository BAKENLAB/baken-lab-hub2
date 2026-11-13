import test from 'node:test';
import assert from 'node:assert/strict';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';
import {buildLocalRelativeConditionComparison} from
 '../automation/local-relative-condition-comparison.mjs';
import {buildLocalClaimedCornerShadow} from '../automation/local-claimed-corner-shadow.mjs';
import {buildOptionalSaveLocalShadow} from '../automation/optional-atomic-shadow-save.mjs';

const target={raceDate:'2026-11-13',track:'園田',raceNo:7,
 postTime:'2026-11-13T14:00:00+09:00'};
const asOf='2026-11-13T11:45:00+09:00';
const conditions={class_name:'C2',surface:'ダート',distance:1400};
const pastRace={raceDate:'2026-10-15',track:'園田',raceNo:2};
function buildFixture(){
 const finishes=[1,1,2,2,3,3,4,5,6,7];
 const compact=finishes.map((finish,i)=>({
  horse_no:i+1,horse_name:'架空馬'+(i+1),
  recent_runs:[{race_date:pastRace.raceDate,track:pastRace.track,
   race_no:pastRace.raceNo,race_name:'C2二3歳以上',
   surface:'ダート',distance:1400,finish,margin:null,
   early_pos:i===5?null:2,final_turn_pos:i===5?null:3}]
 }));
 const verified=compact.map((r,i)=>{
  const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?'+
   'k_lineageLoginCode='+(123456+i);
  return {...structuredClone(r),identity_refs:[horseRef],
   recent_runs:r.recent_runs.map(h=>({...h,horse_no:i+1,
    horse_ref:horseRef,source:'NAR_OFFICIAL_HISTORY',
    identity_verified_by:'OFFICIAL_HORSE_REF'}))};
 });
 const horse6=verified[5];
 const packet={status:'PREFETCH_ONLY',
  raceDate:target.raceDate,raceTrack:target.track,raceNo:target.raceNo,
  claimStarted:false,saveAuthorized:false,marketUsed:false,
  targetResultUsed:false,rankChanged:false,evidence:[{
   horseNo:6,horseName:'架空馬6',
   horseRef:horse6.identity_refs[0],
   identityVerifiedBy:'OFFICIAL_HORSE_REF',pastRace,
   pastHorseNo:6,earlyPos:9,finalTurnPos:3,
   source:'NAR_OFFICIAL_PAST_RACE_RESULT',
   sourceRef:officialNarPastResultUrl(pastRace),
   sourceCheckedAt:'2026-11-13T11:40:00+09:00',
   rankingEffect:'NONE_UNTIL_REVIEWED'
  }]};
 const context={race:{race_date:target.raceDate,track:target.track,
  race_no:target.raceNo,race_name:'C2一3歳以上',
  post_time:target.postTime,conditions},
  runners:compact.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name})),
  relative_condition_evidence:buildLocalRelativeConditionComparison(
    compact,conditions,target.raceDate)};
 const payload={runners:compact.map(r=>({
  horse_no:r.horse_no,horse_name:r.horse_name,
  rank:r.horse_no,status:'ACTIVE'}))};
 return {compact,verified,packet,context,payload};
}
const buildCorners=fx=>buildLocalClaimedCornerShadow({
 targetRace:target,verifiedRunners:fx.verified,
 compactRunners:fx.compact,cornerPacket:fx.packet,conditions,
 clock:()=>Date.parse(asOf)});
const predict=fx=>buildOptionalSaveLocalShadow({
 context:fx.context,payload:fx.payload,now:asOf});

test('COMPLETE 10-horse chain: exact source-verified corner improves only research 1.7 rank',()=>{
 const fx=buildFixture(),initial=structuredClone(fx);
 const ordinary=predict(fx);
 assert.ok(ordinary);
 assert.equal(ordinary.preview.independent_full_field_v17.status,'ABSTAINED');
 assert.equal(ordinary.preview.independent_full_field_v17.reason,
  'TOP5_BOUNDARY_SCORE_TIE_NOT_ABILITY_RESOLVED');
 const corner=buildCorners(fx);
 assert.equal(corner.status,'DESCRIPTIVE_SHADOW_ONLY');
 assert.equal(corner.applied_prior_runs,1);
 assert.equal(corner.research_relative_condition_evidence.status,'READY');
 const witnesses=corner.research_relative_condition_evidence.verified_corner_witnesses;
 assert.equal(witnesses.length,1);
 assert.equal(witnesses[0].evidence_ref,
  'COMPACT_V1.runners[horse_no=6].recent_runs[0]');
 assert.equal(witnesses[0].official_source_ref,officialNarPastResultUrl(pastRace));
 fx.context.official_corner_shadow=corner;
 const enriched=predict(fx);
 assert.ok(enriched);
 const research=enriched.preview.independent_full_field_v17;
 assert.equal(research.status,'FULL_FIELD_PAIRED_RESEARCH_ONLY',
  JSON.stringify(research));
 assert.equal(research.model,'LOCAL_1_7_INDEPENDENT_SHADOW_V0_3');
 assert.deepEqual(research.old_top5,[1,2,3,4,5]);
 assert.deepEqual(research.shadow_top5,[1,2,3,4,6]);
 assert.equal(research.newly_selected.includes(6),true);
 assert.equal(research.lost_from_top5.includes(5),true);
 assert.equal(research.historic_corner_source,
  'INDEPENDENT_VERIFIED_PRECLAIM_CORNER_SNAPSHOT');
 assert.equal(research.official_corner_score_counterfactual.status,
  'SAME_WHOLE_FIELD_ONLY_OFFICIAL_CORNER_PROOF_CHANGED');
 assert.equal(research.official_corner_score_counterfactual.verified_witnesses,1);
 assert.equal(research.official_corner_score_counterfactual.changed_top5_membership,true);
 assert.deepEqual(research.official_corner_score_counterfactual.positive_point_delta_horses,[6]);
 assert.deepEqual(research.official_corner_score_counterfactual.negative_point_delta_horses,[]);
 assert.equal(research.score_table.find(x=>x.horse_no===6).independently_verified_corner_runs,1);
 assert.equal(research.score_table.find(x=>x.horse_no===6).verified_corner_bonus_points,3);
 assert.equal(research.production_rank_effect,false);
 assert.equal(research.eligible_for_official_accuracy_claim,false);
 assert.equal(enriched.preview.frozen_modified,false);
 assert.deepEqual(fx.compact,initial.compact);
 assert.deepEqual(fx.verified,initial.verified);
 assert.deepEqual(fx.packet,initial.packet);
 assert.deepEqual(fx.payload,initial.payload);
});
test('fake official witness is not promoted; missing source means 1.7 abstains',()=>{
 const fx=buildFixture();
 fx.packet.evidence[0].sourceRef='https://fake.keiba.go.jp';
 const read=buildCorners(fx);
 assert.equal(read.applied_prior_runs,0);
 assert.equal(read.research_relative_condition_evidence,null);
 fx.context.official_corner_shadow=read;
 const out=predict(fx);
 assert.equal(out.preview.independent_full_field_v17.status,'ABSTAINED');
 assert.equal(out.preview.independent_full_field_v17.reason,
  'TOP5_BOUNDARY_SCORE_TIE_NOT_ABILITY_RESOLVED');
 assert.equal(out.preview.verified_preclaim_corner_applied_runs,0);
});
