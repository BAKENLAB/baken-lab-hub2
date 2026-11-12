import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOfficialSaveDraft,buildOptionalSaveJraShadow,buildOptionalSaveLocalShadow}
 from '../automation/optional-atomic-shadow-save.mjs';

const raceDate='2026-11-10';
const post='2026-11-10T15:00:00+09:00';
const now='2026-11-10T13:00:00+09:00';
const field=Array.from({length:10},(_,i)=>({
 horse_no:i+1,horse_name:'検証馬'+(i+1),rank:i+1,status:'ACTIVE'
}));
const payload=()=>({runners:structuredClone(field)});
const official=()=>field.map(r=>({
 horse_no:r.horse_no,horse_name:r.horse_name,supporting_runs:
 r.horse_no===6?[
  {date:'2026-10-10',race_date:'2026-10-10',track:'京都',class:'1勝クラス',surface:'芝',distance:1400,finish:1,margin:0.0},
  {date:'2026-10-20',race_date:'2026-10-20',track:'京都',class:'1勝クラス',surface:'芝',distance:1400,finish:2,margin:0.2,
   margin_unit:'LENGTHS_TO_WINNER',margin_basis:'NAR_SECOND_PLACE_PRECEDING_IS_WINNER'}
 ]:r.horse_no===5?[
  {date:'2026-10-10',race_date:'2026-10-10',track:'京都',class:'1勝クラス',surface:'芝',distance:1400,finish:8,margin:2.1},
  {date:'2026-10-20',race_date:'2026-10-20',track:'京都',class:'1勝クラス',surface:'芝',distance:1400,finish:9,margin:2.0}
 ]:[]
}));
const comparison=(scope)=>({
 status:'READY',target_date:raceDate,runner_evidence:official(),
 market_used:false,target_result_used:false,rank_effect:false,
 ...(scope==='LOCAL'?{data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY'}:
 {source_scope:'JRA_CLAIMED_RUNNER_HISTORY'})
});
const jra=()=>({race:{race_date:raceDate,track:'京都',race_no:6,post_time:post,
 field_payload:{race:{class_name:'1勝クラス',surface:'芝',distance:1400}}},
 candidates:field.map(x=>({...x,base_rank:x.rank})),
 relative_condition_evidence:comparison('JRA')});
const local=()=>({runners:field.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name})),race:{race_date:raceDate,track:'京都',race_no:6,post_time:post,
 race_name:'普通',conditions:{class_name:'1勝クラス',surface:'芝',distance:1400}},
 relative_condition_evidence:comparison('LOCAL')});

test('strict full-field saved draft keeps true official rank, not list order',()=>{
 const p=payload();p.runners.reverse();
 const baseline=extractOfficialSaveDraft(p,'JRA');
 assert.deepEqual(baseline.map(x=>x.horse_no),[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(Object.keys(baseline[0]),['horse_no','horse_name','rank']);
});
test('ACTIVE status is required for LOCAL; JRA all-status-omitted legacy is tolerated',()=>{
 const j=payload();for(const h of j.runners)delete h.status;
 assert.equal(extractOfficialSaveDraft(j,'LOCAL'),null);
 assert.equal(extractOfficialSaveDraft(j,'JRA').length,10);
 j.runners[0].status='ACTIVE';assert.equal(extractOfficialSaveDraft(j,'JRA'),null);
});
test('scratched horses excluded and blank or duplicate ranks are not auto-promoted',()=>{
 const p=payload();p.runners[9].status='CANCELLED';p.runners[9].rank=null;
 assert.equal(extractOfficialSaveDraft(p,'LOCAL').length,9);
 p.runners[4].rank=p.runners[5].rank;
 assert.equal(extractOfficialSaveDraft(p,'LOCAL'),null);
});
test('JRA optional prep genuinely computes new TOP5 only before post time',()=>{
 const p=payload();const ctx=jra(),copy=structuredClone(p);
 const result=buildOptionalSaveJraShadow({context:ctx,payload:p,now});
 assert.ok(result);
 assert.deepEqual(result.preview.baseline_top5,[1,2,3,4,5]);
 assert.deepEqual(result.preview.top5,[1,2,3,4,6]);
 assert.equal(result.preview.production_rank_effect,false);
 assert.equal(result.preview.baseline_kind,'EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT');
 assert.deepEqual(p,copy);
 assert.equal(buildOptionalSaveJraShadow({context:ctx,payload:p,now:'2026-11-10T14:59:00+09:00'}),null);
});
test('LOCAL optional prep uses officially verified matching track history only',()=>{
 const ctx=local();ctx.race.track='高知';ctx.race.conditions.class_name='Ｃ２四組';
 for(const row of ctx.relative_condition_evidence.runner_evidence){
  for(const h of row.supporting_runs){h.track='高知';h.class='Ｃ２二組';}
 }
 const result=buildOptionalSaveLocalShadow({context:ctx,payload:payload(),now});
 assert.ok(result);assert.deepEqual(result.preview.top5,[1,2,3,4,6]);
 assert.equal(result.preview.official_saved,false);
 assert.equal(result.preview.save_authorized,false);
});
test('unknown source, bad rank or result data cannot create any record',()=>{
 const bad=jra();bad.relative_condition_evidence.market_used=true;
 assert.equal(buildOptionalSaveJraShadow({context:bad,payload:payload(),now}),null);
 const p=payload();p.runners[2].rank=3;p.runners[1].rank=3;
 assert.equal(buildOptionalSaveJraShadow({context:jra(),payload:p,now}),null);
 const loc=local();loc.relative_condition_evidence.target_result_used=true;
 assert.equal(buildOptionalSaveLocalShadow({context:loc,payload:payload(),now}),null);
});
test('missing verification safely skips without touching official payload',()=>{
 const p=payload(),snapshot=structuredClone(p);
 const j=jra();j.relative_condition_evidence={status:'PARTIAL_OR_INVALID'};
 assert.equal(buildOptionalSaveJraShadow({context:j,payload:p,now}),null);
 assert.deepEqual(p,snapshot);
});


test('verified historical preclaim corner lane reaches research rank proof but never edits FROZEN candidate',()=>{
 const ctx=local();
 ctx.race.track='高知';ctx.race.conditions.class_name='Ｃ２四組';
 for(const row of ctx.relative_condition_evidence.runner_evidence)
  for(const h of row.supporting_runs){h.track='高知';h.class='Ｃ２二組';}
 const original=buildOptionalSaveLocalShadow({context:ctx,payload:payload(),now});
 assert.ok(original);
 assert.equal(original.preview.proof_by_horse.find(x=>x.horse_no===6).same_class_front_runs,0);
 const corner=structuredClone(ctx.relative_condition_evidence);
 corner.corner_evidence_scope='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY';
 corner.corner_enriched_prior_runs=1;
 corner.runner_count=field.length;
 corner.score_effect=false;
 corner.runner_evidence.find(x=>x.horse_no===6).supporting_runs[0].early_pos=1;
 ctx.official_corner_shadow={status:'DESCRIPTIVE_SHADOW_ONLY',applied_prior_runs:1,
  use_for_rank:false,use_for_save_gate:false,research_relative_condition_evidence:corner};
 const p=payload(),snapshot=structuredClone(p);
 const enriched=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(enriched);
 assert.equal(enriched.preview.proof_by_horse.find(x=>x.horse_no===6).same_class_front_runs,1);
 assert.equal(enriched.preview.production_rank_effect,false);
 assert.equal(enriched.preview.frozen_modified,false);
 assert.equal(enriched.preview.market_used,false);
 assert.deepEqual(p,snapshot);
 corner.corner_evidence_scope='UNVERIFIED_LATER_RESULT';
 const rejected=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(rejected);
 assert.equal(rejected.preview.proof_by_horse.find(x=>x.horse_no===6).same_class_front_runs,0);
});


test('official preclaim sustained-front corners change LOCAL rank only in research preview',()=>{
 const ctx=local(),p=payload();
 ctx.race.track='高知';
 ctx.race.conditions.class_name='Ｃ２四組';
 ctx.race.conditions.surface='芝';
 // The fixture's existing supporting_runs are Kyoto turf; rehome all verified
 // history to this fictional LOCAL-compatible track and class.
 for(const row of ctx.relative_condition_evidence.runner_evidence)
  for(const h of row.supporting_runs){h.track='高知';h.class='Ｃ２二組';}
 // Rank5 has two backfield races; rank6 has 2 podiums but no winner gap.
 const fifth=ctx.relative_condition_evidence.runner_evidence[4];
 fifth.supporting_runs.forEach(h=>{
  h.finish=9;h.margin=null;h.margin_basis='UNVERIFIED_WINNER_GAP';
 });
 const sixth=ctx.relative_condition_evidence.runner_evidence[5];
 sixth.supporting_runs.forEach(h=>{
  h.finish=3;h.margin=null;h.margin_basis='UNVERIFIED_WINNER_GAP';
  delete h.early_pos;delete h.final_turn_pos;
 });
 const before=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(before);
 assert.equal(before.preview.status,'UNCHANGED');
 const enriched=structuredClone(ctx.relative_condition_evidence);
 for(const h of enriched.runner_evidence[5].supporting_runs){
  h.early_pos=2;h.final_turn_pos=2;
 }
 enriched.corner_evidence_scope='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY';
 enriched.corner_enriched_prior_runs=2;
 enriched.runner_count=field.length;
 enriched.score_effect=false;
 ctx.official_corner_shadow={status:'DESCRIPTIVE_SHADOW_ONLY',
  applied_prior_runs:2,use_for_rank:false,use_for_save_gate:false,
  research_relative_condition_evidence:enriched};
 const original=structuredClone(p);
 const after=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.equal(after.preview.status,'REORDERED');
 assert.deepEqual(after.preview.top5,[1,2,3,4,6]);
 assert.equal(after.preview.elected_challenger.podium_evidence_effect,
  'VERIFIED_SUSTAINED_FRONT_PODIUM_NO_WINNER_GAP');
 assert.equal(after.preview.production_rank_effect,false);
 assert.deepEqual(p,original);
 // Replacing the trusted source label with a fake one must restore baseline.
 enriched.corner_evidence_scope='UNVERIFIED_LATER_RESULT';
 assert.equal(buildOptionalSaveLocalShadow({context:ctx,payload:p,now}).preview.status,'UNCHANGED');
});

test('optional LOCAL proposal accurately tags verified corner source vs normal history',()=>{
 const ctx=local(),p=payload(),old=structuredClone(p);
 ctx.race.track='高知';ctx.race.conditions.class_name='Ｃ２四組';
 for(const row of ctx.relative_condition_evidence.runner_evidence){
  for(const h of row.supporting_runs){h.track='高知';h.class='Ｃ２二組';}
 }
 const normal=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(normal);
 assert.equal(normal.preview.observed_corner_source,'NORMAL_VERIFIED_CLAIM_HISTORY_ONLY');
 assert.equal(normal.preview.verified_preclaim_corner_applied_runs,0);
 const corner=structuredClone(ctx.relative_condition_evidence);
 corner.corner_evidence_scope='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY';
 corner.corner_enriched_prior_runs=2;corner.runner_count=field.length;corner.score_effect=false;
 ctx.official_corner_shadow={status:'DESCRIPTIVE_SHADOW_ONLY',applied_prior_runs:2,
  use_for_rank:false,use_for_save_gate:false,research_relative_condition_evidence:corner};
 const yes=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(yes);
 assert.equal(yes.preview.observed_corner_source,'VERIFIED_PRECLAIM_CORNER_SHADOW');
 assert.equal(yes.preview.verified_preclaim_corner_applied_runs,2);
 corner.corner_evidence_scope='UNVERIFIED_LATER_RESULT';
 const rejected=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(rejected);
 assert.equal(rejected.preview.observed_corner_source,'NORMAL_VERIFIED_CLAIM_HISTORY_ONLY');
 assert.equal(rejected.preview.verified_preclaim_corner_applied_runs,0);
 assert.deepEqual(p,old);
});


test('same-draft A/B identifies an actual NEW top5 horse caused by official corners',()=>{
 const ctx=local(),p=payload();
 ctx.race.track='高知';ctx.race.conditions.class_name='Ｃ２四組';ctx.race.conditions.surface='芝';
 for(const entry of ctx.relative_condition_evidence.runner_evidence)
  for(const h of entry.supporting_runs){h.track='高知';h.class='Ｃ２二組';}
 const fifth=ctx.relative_condition_evidence.runner_evidence[4];
 for(const h of fifth.supporting_runs){h.finish=9;h.margin=null;h.margin_basis='UNVERIFIED_WINNER_GAP';}
 const sixth=ctx.relative_condition_evidence.runner_evidence[5];
 for(const h of sixth.supporting_runs){h.finish=3;h.margin=null;h.margin_basis='UNVERIFIED_WINNER_GAP';delete h.early_pos;delete h.final_turn_pos;}
 const before=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.equal(before.preview.corner_rank_counterfactual.status,'NO_VERIFIED_PRECLAIM_CORNERS');
 assert.equal(before.preview.status,'UNCHANGED');
 const enhanced=structuredClone(ctx.relative_condition_evidence);
 for(const h of enhanced.runner_evidence[5].supporting_runs){h.early_pos=2;h.final_turn_pos=2;}
 enhanced.corner_evidence_scope='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY';
 enhanced.corner_enriched_prior_runs=2;enhanced.runner_count=field.length;enhanced.score_effect=false;
 ctx.official_corner_shadow={status:'DESCRIPTIVE_SHADOW_ONLY',applied_prior_runs:2,
  use_for_rank:false,use_for_save_gate:false,research_relative_condition_evidence:enhanced};
 const original=structuredClone(p),after=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.equal(after.preview.status,'REORDERED');
 const proof=after.preview.corner_rank_counterfactual;
 assert.equal(proof.status,'VERIFIED_SAME_DRAFT_AB_COMPARISON');
 assert.deepEqual(proof.normal_top5,[1,2,3,4,5]);
 assert.deepEqual(proof.enriched_top5,[1,2,3,4,6]);
 assert.equal(proof.changed_top5,true);
 assert.deepEqual(proof.new_top5_horse_numbers,[6]);
 assert.deepEqual(proof.lost_top5_horse_numbers,[5]);
 assert.equal(after.preview.production_rank_effect,false);
 assert.deepEqual(p,original);
});
test('preclaim corners do NOT get credit for an identical rank ordering',()=>{
 const ctx=local(),p=payload();ctx.race.track='高知';ctx.race.conditions.class_name='Ｃ２四組';
 for(const entry of ctx.relative_condition_evidence.runner_evidence)
  for(const h of entry.supporting_runs){h.track='高知';h.class='Ｃ２二組';}
 const enriched=structuredClone(ctx.relative_condition_evidence);
 enriched.corner_evidence_scope='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY';
 enriched.corner_enriched_prior_runs=1;enriched.runner_count=field.length;enriched.score_effect=false;
 enriched.runner_evidence[5].supporting_runs[0].early_pos=1;
 ctx.official_corner_shadow={status:'DESCRIPTIVE_SHADOW_ONLY',applied_prior_runs:1,
  use_for_rank:false,use_for_save_gate:false,research_relative_condition_evidence:enriched};
 const result=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(result);assert.equal(result.preview.observed_corner_source,'VERIFIED_PRECLAIM_CORNER_SHADOW');
 assert.equal(result.preview.corner_rank_counterfactual.status,'VERIFIED_SAME_DRAFT_AB_COMPARISON');
 assert.equal(result.preview.corner_rank_counterfactual.changed_top5,false);
 assert.deepEqual(result.preview.corner_rank_counterfactual.new_top5_horse_numbers,[]);
});
test('missing ordinary history cannot manufacture a measured corner uplift',()=>{
 const ctx=local(),p=payload();
 ctx.race.track='高知';ctx.race.conditions.class_name='Ｃ２四組';
 for(const row of ctx.relative_condition_evidence.runner_evidence)
  for(const h of row.supporting_runs){h.track='高知';h.class='Ｃ２二組';}
 const enhanced=structuredClone(ctx.relative_condition_evidence);
 enhanced.corner_evidence_scope='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY';
 enhanced.corner_enriched_prior_runs=1;enhanced.runner_count=field.length;enhanced.score_effect=false;
 ctx.official_corner_shadow={status:'DESCRIPTIVE_SHADOW_ONLY',applied_prior_runs:1,
  use_for_rank:false,use_for_save_gate:false,research_relative_condition_evidence:enhanced};
 delete ctx.relative_condition_evidence;
 const out=buildOptionalSaveLocalShadow({context:ctx,payload:p,now});
 assert.ok(out);
 assert.equal(out.preview.corner_rank_counterfactual.status,'NORMAL_HISTORY_NOT_COMPARABLE');
 assert.equal(out.preview.corner_rank_counterfactual.changed_top5,null);
 assert.deepEqual(out.preview.corner_rank_counterfactual.new_top5_horse_numbers,[]);
});
