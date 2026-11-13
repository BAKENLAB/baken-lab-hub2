import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOptionalSaveLocalShadow} from '../automation/optional-atomic-shadow-save.mjs';

const now='2026-11-13T09:05:00+09:00';
const post='2026-11-13T11:00:00+09:00';
const baseline=Array.from({length:10},(_,i)=>({
 horse_no:i+1,horse_name:'架空馬'+(i+1),rank:i+1,status:'ACTIVE'
}));
const payload=()=>({runners:structuredClone(baseline)});
function fixture(){
 const runners=baseline.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name}));
 const runner_evidence=baseline.map(x=>{
  const records=x.horse_no===10?[
   {date:'2026-10-15',finish:1},{date:'2026-09-16',finish:2}
  ]:x.horse_no===5?[
   {date:'2026-10-15',finish:10},{date:'2026-09-16',finish:8}
  ]:[{date:'2026-10-15',finish:6}];
  const ctx=records.map((run,i)=>({
   race_date:run.date,track:'園田',class:'C2一3歳以上',
   surface:'ダート',distance:1400,finish:run.finish,
   early_pos:2,final_turn_pos:4,
   evidence_ref:'COMPACT_V1.runners[horse_no='+x.horse_no+'].recent_runs['+i+']'
  }));
  return {horse_no:x.horse_no,horse_name:x.horse_name,
   supporting_runs:ctx.map(x=>({
    date:x.race_date,track:x.track,class:x.class,
    surface:x.surface,distance:x.distance,finish:x.finish,margin:null,
    early_pos:x.early_pos,final_turn_pos:x.final_turn_pos
   })),context_runs:ctx};
 });
 return {race:{race_date:'2026-11-13',track:'園田',race_no:1,
  race_name:'C2一3歳以上',post_time:post,
  conditions:{class_name:'C2',surface:'ダート',distance:1400}},
  runners,
  relative_condition_evidence:{status:'READY',
   data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY',
   target_date:'2026-11-13',runner_count:10,
   runner_evidence,market_used:false,target_result_used:false,
   rank_effect:false,score_effect:false}};
}
test('one as-of official history feeds BOTH baseline and independent 100pt full-field ranks',()=>{
 const ctx=fixture(),p=payload(),before=structuredClone({ctx,p});
 const out=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(out);
 const independent=out.preview.independent_full_field_v17;
 assert.equal(independent.status,'FULL_FIELD_PAIRED_RESEARCH_ONLY',
  JSON.stringify(independent));
 assert.equal(independent.all_runners_checked,10);
 assert.equal(independent.rank_source,'INDEPENDENT_SCORE_NO_BASELINE_RANK_INPUT');
 assert.deepEqual(independent.old_top5,[1,2,3,4,5]);
 assert.equal(independent.shadow_top5.includes(10),true);
 assert.equal(independent.newly_selected.includes(10),true);
 assert.equal(independent.lost_from_top5.includes(5),true);
 assert.equal(independent.score_table.length,10);
 assert.equal(new Set(independent.score_table.map(x=>x.horse_no)).size,10);
 assert.equal(independent.production_rank_effect,false);
 assert.equal(independent.production_score_effect,false);
 assert.equal(independent.target_result_used,false);
 assert.equal(independent.market_used,false);
 assert.equal(out.preview.production_rank_effect,false);
 assert.deepEqual({ctx,p},before);
});
test('independent 1.7 scoring is unchanged when only baseline saved ranks change',()=>{
 const ctx=fixture(),before=payload();
 const after=payload();
 for(const h of after.runners)h.rank=11-h.rank;
 const a=buildOptionalSaveLocalShadow({context:ctx,payload:before,now});
 const b=buildOptionalSaveLocalShadow({context:ctx,payload:after,now});
 assert.ok(a);assert.ok(b);
 assert.deepEqual(a.preview.independent_full_field_v17.score_table,
  b.preview.independent_full_field_v17.score_table);
 assert.deepEqual(a.preview.independent_full_field_v17.shadow_top5,
  b.preview.independent_full_field_v17.shadow_top5);
 assert.notDeepEqual(a.preview.independent_full_field_v17.old_top5,
  b.preview.independent_full_field_v17.old_top5);
});
test('missing official history on one horse means NO invented full-field 1.7 rank',()=>{
 const ctx=fixture();ctx.relative_condition_evidence.runner_evidence[0].context_runs=[];
 const p=payload(),out=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(out);
 const sidecar=out.preview.independent_full_field_v17;
 assert.equal(sidecar.status,'ABSTAINED');
 assert.equal(sidecar.reason,'INSUFFICIENT_EVIDENCE_FOR_FAIR_WHOLE_FIELD_RANK');
 assert.equal('shadow_top5' in sidecar,false);
 assert.equal(sidecar.production_rank_effect,false);
 assert.deepEqual(p,payload());
});
test('leaky runner field is rejected for independent ranking without making a bet',()=>{
 const ctx=fixture();
 ctx.relative_condition_evidence.runner_evidence[0].context_runs[0].popularity=5;
 const result=buildOptionalSaveLocalShadow({context:ctx,payload:payload(),now});
 assert.ok(result);
 assert.equal(result.preview.independent_full_field_v17.status,'ABSTAINED');
 assert.equal(result.preview.independent_full_field_v17.reason,
  'COMPLETE_OFFICIAL_PRE_RACE_PACKET_UNVERIFIED');
 assert.equal(result.preview.production_rank_effect,false);
 assert.equal(result.preview.save_authorized,false);
});
test('FROZEN-after-post or altered draft cannot create paired independent output',()=>{
 const ctx=fixture();
 assert.equal(buildOptionalSaveLocalShadow({context:ctx,payload:payload(),
  now:'2026-11-13T10:59:00+09:00'}),null);
 const duplicate=payload();duplicate.runners[0].rank=2;
 assert.equal(buildOptionalSaveLocalShadow({context:ctx,payload:duplicate,now}),null);
});
