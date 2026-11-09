import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJraClaimedDraftPreview} from '../automation/jra-relative-draft-adapter.mjs';

const TIME='2026-11-10T12:20:00+09:00';
function claimed(){
 const field=Array.from({length:10},(_,i)=>({horse_no:i+1,horse_name:'JRA馬'+(i+1),base_rank:i+1}));
 // Machine BASE_CORE has 6th above 5th, unlike a later whole-field manual draft.
 field[4].base_rank=6;field[5].base_rank=5;
 const runner_evidence=field.map(h=>{
   const good=h.horse_no===6?2:h.horse_no===5?0:1;
   const bad=h.horse_no===5?2:0;
   return {horse_no:h.horse_no,horse_name:h.horse_name,
     supporting_runs:[
       ...Array.from({length:good},(_,i)=>({
         date:'2026-10-'+String(i+10).padStart(2,'0'),
         track:'京都',surface:'芝',distance:1400,class:'1勝クラス',
         finish:i+1,margin:0.1,early_pos:2
       })),
       ...Array.from({length:bad},(_,i)=>({
         date:'2026-10-'+String(i+20).padStart(2,'0'),
         track:'京都',surface:'芝',distance:1400,class:'1勝クラス',
         finish:9,margin:2.1,early_pos:7
       }))
     ]
   };
 });
 return {
   race:{race_date:'2026-11-10',track:'京都',race_no:7,
     post_time:'2026-11-10T13:40:00+09:00',
     field_payload:{race:{class_name:'1勝クラス',surface:'芝',distance:1400}}},
   candidates:field,
   relative_condition_evidence:{status:'READY',target_date:'2026-11-10',
     source_scope:'JRA_CLAIMED_RUNNER_HISTORY',market_used:false,
     target_result_used:false,rank_effect:false,
     runner_evidence}
 };
}
const baseline=()=>Array.from({length:10},(_,i)=>({horse_no:i+1,
 horse_name:'JRA馬'+(i+1),rank:i+1}));
test('real-shaped JRA claimed context compares EXPLICIT draft ranks, not BASE_CORE',()=>{
 const data=claimed(),copy=structuredClone(data),b=baseline();
 const v=buildJraClaimedDraftPreview({claimedContext:data,baseline:b,observedAt:TIME});
 assert.equal(v.status,'REORDERED');
 assert.deepEqual(v.top5,[1,2,3,4,6]);
 assert.equal(v.elected_challenger.old_rank,6);
 assert.equal(v.baseline_kind,'EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT');
 assert.equal(v.base_core_reference_only,true);
 assert.equal(v.base_core_draft_delta_known,true);
 assert.deepEqual(v.base_core_draft_differences.map(x=>x.horse_no),[5,6]);
 assert.equal(v.official_saved,false);assert.equal(v.production_rank_effect,false);
 assert.equal(v.target_result_used,false);assert.equal(v.market_used,false);
 assert.deepEqual(data,copy);
});
test('partial draft cannot be mistaken for an officially comparable full-field rank',()=>{
 const v=buildJraClaimedDraftPreview({claimedContext:claimed(),
   baseline:baseline().slice(0,9),observedAt:TIME});
 assert.equal(v.status,'EVIDENCE_FIELD_SIZE_MISMATCH');
 assert.equal(v.draft_runners_verified,false);
 assert.equal(v.candidate_order,null);
});
test('unverified as-of historical runner and future observation are refused',()=>{
 const d=claimed();
 d.relative_condition_evidence.runner_evidence[5].supporting_runs[0].date='2026-11-10';
 let v=buildJraClaimedDraftPreview({claimedContext:d,baseline:baseline(),observedAt:TIME});
 assert.equal(v.status,'EVIDENCE_CONTAINS_CURRENT_OR_FUTURE_RACE');
 v=buildJraClaimedDraftPreview({claimedContext:claimed(),
   baseline:baseline(),observedAt:'2026-11-10T13:45:00+09:00'});
 assert.equal(v.status,'PRE_RACE_IDENTITY_OR_TIME_UNVERIFIED');
});
test('rank identity swap and market in draft are refused',()=>{
 const b=baseline(); b[0].horse_name='wrong';
 let v=buildJraClaimedDraftPreview({claimedContext:claimed(),baseline:b,observedAt:TIME});
 assert.equal(v.status,'EVIDENCE_IDENTITY_OR_SHAPE_INVALID');
 const m=baseline();m[0].odds=1.1;
 v=buildJraClaimedDraftPreview({claimedContext:claimed(),baseline:m,observedAt:TIME});
 assert.equal(v.status,'RESULT_OR_MARKET_IN_PRERACE_INPUT');
});
test('missing optional evidence cannot alter existing draft rank',()=>{
 const d=claimed();d.relative_condition_evidence={status:'PARTIAL_OR_INVALID'};
 const v=buildJraClaimedDraftPreview({claimedContext:d,baseline:baseline(),observedAt:TIME});
 assert.equal(v.status,'BASELINE_OR_EVIDENCE_NOT_READY');assert.equal(v.candidate_order,null);
});
