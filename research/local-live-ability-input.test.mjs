import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalLiveAbilityInput as build} from '../automation/local-live-ability-input.mjs';
const date='2026-11-14';
function fixture(){
 const names=Array.from({length:10},(_,i)=>({horse_no:i+1,horse_name:'架空'+(i+1)}));
 const rows=names.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
  context_runs:[{race_date:'2026-10-21',track:'佐賀',race_no:2,
   race_name:'C2',class:'C2',surface:'ダート',distance:1400,finish:r.horse_no,
   evidence_ref:`COMPACT_V1.runners[horse_no=${r.horse_no}].recent_runs[0]`}],
  supporting_runs:[]}));
 return {context_format:'COMPACT_V1',
  field_integrity_checked:true,stage:'AWAITING_FULL_DEPTH_COMPARISON',
  protocol:{protocol_key:'LOCAL_MAIN',version:'CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013',
   enforced_server_side:true},
  race:{race_date:date,track:'佐賀',race_no:5,circuit:'LOCAL',
   race_name:'C2',post_time:'2026-11-14T17:20:00+09:00',
   conditions:{surface:'ダート',distance:1400,class_name:'C2'}},
  runners:names.map(x=>({...x,recent_runs:[]})),
  relative_condition_status:'READY',
  relative_condition_evidence:{
   status:'READY',data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY',
   target_date:date,market_used:false,target_result_used:false,
   rank_effect:false,score_effect:false,runner_count:10,runner_evidence:rows
  }
 };
}
test('today first-class production rank input all horses only from official prereace evidence',()=>{
 const f=fixture(),before=structuredClone(f),r=build(f,'2026-11-14T12:00:00+09:00');
 assert.equal(r.status,'READY_FOR_OFFICIAL_RANK_DECISION',JSON.stringify(r));
 assert.equal(r.live_rank_input_used,true);
 assert.equal(r.full_field_100point_rank_candidate.length,10);
 assert.deepEqual(r.independently_scored_top5,[1,2,3,4,5]);
 assert.equal(r.full_field_100point_rank_candidate[0].current_condition_podium_count,1);
 assert.equal(r.source_scope,'OFFICIAL_CLAIM_HISTORY_ONLY');
 assert.equal(r.rank_or_score_written,false);
 assert.equal(r.save_authorized,false);
 assert.equal(r.frozen_modified,false);
 assert.deepEqual(f,before);
});
test('outside top5 ranked horse also has same-condition evidence rendered',()=>{
 const f=fixture();
 const outsider=f.relative_condition_evidence.runner_evidence[7];
 outsider.context_runs[0].finish=1;
 const r=build(f,'2026-11-14T12:00:00+09:00');
 assert.equal(r.status,'READY_FOR_OFFICIAL_RANK_DECISION');
 const x=r.full_field_100point_rank_candidate.find(x=>x.horse_no===8);
 assert.equal(x.current_condition_podium_count,1);
 assert.equal(x.strongest_verified_run_proofs[0].finish,1);
 assert.match(x.same_venue_exact_distance_recent_podium_refs[0],/horse_no=8/);
});
test('missing a runner prior official proof rejects candidate without blocking core 1.6',()=>{
 const f=fixture();f.relative_condition_evidence.runner_evidence[3].context_runs=[];
 const r=build(f,'2026-11-14T12:00:00+09:00');
 assert.equal(r.status,'FALLBACK_TO_LOCAL_1_6');
 assert.equal(r.live_rank_input_used,false);
 assert.equal(r.save_authorized,false);
});
test('post-time, odds and unverified current roster fail closed',()=>{
 const a=fixture();const x=build(a,'2026-11-14T17:20:00+09:00');
 assert.equal(x.status,'FALLBACK_TO_LOCAL_1_6');
 const b=fixture();b.relative_condition_evidence.runner_evidence[0].context_runs[0].popularity=1;
 assert.equal(build(b,'2026-11-14T12:00:00+09:00').status,'FALLBACK_TO_LOCAL_1_6');
 const c=fixture();c.runners[0].horse_name='別の馬';
 assert.equal(build(c,'2026-11-14T12:00:00+09:00').reason,
  'INDEPENDENT_FULL_FIELD_IDENTITY_MISMATCH');
});
test('forged corner evidence is not promoted to certified corner proof',()=>{
 const f=fixture();f.official_corner_shadow={
  status:'DESCRIPTIVE_SHADOW_ONLY',use_for_rank:false,use_for_save_gate:false,
  research_relative_condition_evidence:{...f.relative_condition_evidence,
   corner_evidence_scope:'UNVERIFIED',corner_enriched_prior_runs:1,
   verified_corner_witnesses:[{horse_no:1}]}
 };
 const r=build(f,'2026-11-14T12:00:00+09:00');
 assert.equal(r.status,'READY_FOR_OFFICIAL_RANK_DECISION');
 assert.equal(r.official_corner_used,false);
 assert.equal(r.official_corner_verified_run_count,0);
});
