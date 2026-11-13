import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvalTransferForJraClaim as evaluate} from '../automation/eval-course-transfer-live.mjs';
function fakeSnapshot(){
 const tracks=['東京','中山','京都','阪神','中京','福島','札幌','函館','新潟','小倉'];
 const targets=[['東京','ダート','',1600]];
 target_loop: for(const t of tracks)for(const s of ['芝','ダート'])
  for(const d of [1200,1400,1600,1800,2000,2200,2400]){
   const k=JSON.stringify([t,s,'',d]);
   if(!targets.some(x=>JSON.stringify(x)===k))targets.push([t,s,'',d]);
   if(targets.length===82)break target_loop;
  }
 const sources=[['中山','ダート','',1800]];
 source_loop: for(const t of tracks)for(const s of ['芝','ダート'])
  for(const d of [1000,1150,1200,1300,1400,1600,1700,1800,1900,2000,2200,2400,2600]){
   const k=JSON.stringify([t,s,'',d]);
   if(!sources.some(x=>JSON.stringify(x)===k))sources.push([t,s,'',d]);
   if(sources.length===94)break source_loop;
  }
 const pairs=[];
 for(let ti=0;ti<targets.length;ti++)
  for(let si=0;si<(ti<56?24:23);si++)
   pairs.push([ti,si,si<2?5:si<9?4:si<14?3:si<20?2:1,si+1]);
 assert.equal(targets.length,82);
 assert.equal(sources.length,94);
 assert.equal(pairs.length,1942);
 return {v:'2026-11-13',observed_at:'2026-11-13T21:30:21Z',targets,sources,pairs,scope:'NORMAL_ALL_1942'};
}
function claimed(){
 return {
  stage:'AWAITING_JRA_FULL_DEPTH_COMPARISON',
  race:{race_date:'2026-11-14',track:'東京',race_no:3,
   post_time:'2026-11-14T10:50:00+09:00',
   field_payload:{race:{surface:'ダート',distance:1600,race_type:'平地'}}},
  runner_history:Array.from({length:10},(_,i)=>({
   horse_no:i+1,horse_name:'架空馬'+(i+1),
   past_runs:[{race_date:'2026-10-10',track:'中山',surface:'ダート',
    distance:1800,finish:i===0?2:5,early_pos:3,margin_to_winner:0.4}]
  }))
 };
}
const stats=[{source_course_key:'中山|ダート|1800|右',
 target_course_key:'東京|ダート|1600|左',
 runners:300,top3_lift:1.23,reliability:'HIGH',
 condition_precision:'COARSE_NO_INNER_OUTER',training_to:'2025-12-31'}];
test('full-field Eval-normal relation + independent JRA reliable cohort yields bounded 1pt support',()=>{
 const context=claimed(),before=structuredClone(context);
 const r=evaluate({context,snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(r.status,'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW',JSON.stringify(r));
 assert.equal(r.field_count,10);
 assert.equal(r.runners[0].optional_course_fit_budget_points,1);
 assert.equal(r.runners[1].optional_course_fit_budget_points,0);
 assert.match(r.runners[0].best_evidence.verified_run_ref,/horse_no=1/);
 assert.equal(r.raw_data_in_response,false);
 assert.equal(r.authorized_to_save,false);
 assert.equal(r.market_used,false);
 assert.equal(r.target_result_used,false);
 assert.deepEqual(context,before);
});
test('thin sample or unsupported Eval tier cannot change ability assist budget',()=>{
 const thin={...stats[0],runners:12,reliability:'THIN'};
 const a=evaluate({context:claimed(),snapshot:fakeSnapshot(),ownedTransferStats:[thin],
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(a.runners[0].optional_course_fit_budget_points,0);
});
test('result-time and post-time data cannot make transfer claims',()=>{
 const a=evaluate({context:claimed(),snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-14T10:50:00+09:00'});
 assert.equal(a.status,'EVAL_TRANSFER_UNAVAILABLE');
 const c=claimed();c.runner_history[0].past_runs[0].race_date='2026-11-14';
 const b=evaluate({context:c,snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(b.runners[0].optional_course_fit_budget_points,0);
});
test('unverified source snapshot cannot be accepted as ability evidence',()=>{
 const snap=fakeSnapshot();snap.targets[0][0]='大阪';
 const r=evaluate({context:claimed(),snapshot:snap,ownedTransferStats:stats,
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(r.status,'EVAL_TRANSFER_UNAVAILABLE');
 assert.equal(r.score_effect,0);
});
test('duplicate history run is counted once, no multiplier applied',()=>{
 const context=claimed();context.runner_history[0].past_runs.push(
  structuredClone(context.runner_history[0].past_runs[0]));
 const r=evaluate({context,snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(r.status,'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW');
 assert.equal(r.runners[0].matched_verified_prior_runs,1);
 assert.equal(r.runners[0].optional_course_fit_budget_points,1);
});

test('Eval snapshot collected on 11/13 cannot be used to backfill an 11/13 or older race',()=>{
 const context=claimed();
 context.race.race_date='2026-11-13';
 context.race.post_time='2026-11-13T10:50:00+09:00';
 const r=evaluate({context,snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-13T09:50:00+09:00'});
 assert.equal(r.status,'EVAL_TRANSFER_UNAVAILABLE');
 assert.equal(r.reason,'EVAL_SNAPSHOT_NOT_AVAILABLE_ASOF_TARGET_RACE');
 assert.equal(r.score_effect,0);
});

test('all 1,942 relations are loaded and rank 8 historical source is not discarded',()=>{
 const context=claimed(),snapshot=fakeSnapshot();
 const distantSource=snapshot.sources[7];
 context.runner_history[0].past_runs[0]={race_date:'2026-10-10',
   track:distantSource[0],surface:distantSource[1],distance:distantSource[3],
   finish:2,margin_to_winner:0.3,early_pos:7};
 const r=evaluate({context,snapshot,ownedTransferStats:[],
   observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(r.status,'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW',JSON.stringify(r));
 assert.equal(r.eval_normal_rows,1942);
 assert.equal(r.eval_remaining_normal_rows_not_loaded,0);
 assert.equal(r.runners[0].best_evidence.eval_rank_among_all_conditions,8);
 assert.equal(r.runners[0].best_evidence.eval_tier,'A');
 assert.equal(r.runners[0].optional_course_fit_budget_points,0);
});
test('confirmed official laps/corners/last3f from same archived prior run reach all-field reviewer',()=>{
 const context=claimed();context.runner_content_status='READY';
 context.runner_content_evidence=context.runner_history.map(h=>({
  horse_no:h.horse_no,horse_name:h.horse_name,
  history:[{prior_date:'2026-10-10',prior_track:'中山',
   prior_surface:'ダート',prior_distance:1800,
   finish:h.horse_no===1?2:5,detail_available:true,
   archive_full_field:true,archive_match_count:1,raw_history_match_count:1,
   corner_positions:'8 6 4 2',race_halons:'12.1 - 11.8 - 12.0',
   final3f:36.2,final3f_rank:2}]
 }));
 const r=evaluate({context,snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(r.status,'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW');
 assert.equal(r.official_one_to_one_archive_pace_matches,10);
 assert.equal(r.runners[0].best_evidence.official_corner_positions,'8 6 4 2');
 assert.equal(r.runners[0].best_evidence.official_race_halon_laps,'12.1 - 11.8 - 12.0');
 assert.equal(r.runners[0].best_evidence.official_final3f_rank,2);
 assert.equal(r.runners[1].best_evidence.verified_close_loss_review,true);
 assert.equal(r.runners[1].optional_course_fit_budget_points,0);
});
test('unverified non-matching archive must never masquerade as official lap proof',()=>{
 const context=claimed();context.runner_content_status='READY';
 context.runner_content_evidence=context.runner_history.map(h=>({
  horse_no:h.horse_no,horse_name:h.horse_name,
  history:[{prior_date:'2026-10-01',prior_track:'中山',
   prior_surface:'ダート',prior_distance:1800,
   finish:2,detail_available:true,archive_full_field:true,
   archive_match_count:1,raw_history_match_count:1,
   corner_positions:'1 2 3 4',race_halons:'12.1 - 11.8'}]
 }));
 const r=evaluate({context,snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(r.status,'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW');
 assert.equal(r.official_one_to_one_archive_pace_matches,0);
 assert.equal(r.runners[0].best_evidence.official_race_halon_laps,null);
});
test('snapshot created after claimed time cannot be applied retroactively',()=>{
 const r=evaluate({context:claimed(),snapshot:fakeSnapshot(),ownedTransferStats:stats,
  observedAt:'2026-11-14T05:00:00+09:00'});
 assert.equal(r.reason,'EVAL_SNAPSHOT_NOT_AVAILABLE_ASOF_TARGET_RACE');
});
test('inner/outer official course_layout normalization is safe',()=>{
 const context=claimed(),snapshot=fakeSnapshot();
 const idx=snapshot.targets.findIndex(x=>x[0]==='東京'&&x[1]==='ダート'&&x[3]===1600);
 snapshot.targets[idx]=['東京','ダート','外',1600];
 context.race.field_payload.race.course_layout='OUTER';
 const r=evaluate({context,snapshot,ownedTransferStats:stats,
  observedAt:'2026-11-14T09:50:00+09:00'});
 assert.equal(r.status,'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW');
});
