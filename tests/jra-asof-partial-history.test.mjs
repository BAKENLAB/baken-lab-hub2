import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreJraClaimedRunDetails } from '../supabase/functions/jra-claimed-mcp/jra-asof-detail-handoff.mjs';

const past = (date='2026-10-03')=>({
 race_date:date,track:'京都',surface:'芝',distance:1600,
 finish:4,margin_to_winner:0.4,early_pos:3,race_class:'1勝クラス',
});
const proof=(p,opts={})=>({
 source_kind:'LIVE',raw_history_match_count:1,base_facts_available:true,
 prior_date:p.race_date,prior_track:p.track,prior_surface:p.surface,
 prior_distance:p.distance,finish:p.finish,margin_to_winner:p.margin_to_winner,
 live_corner_positions:[3,4],field_size:16,final3f:34.5,
 final3f_source:'LIVE_PAST_RUN_FALLBACK',live_going:'良',...opts
});
function fixtures(){
 const runner_history=[],runner_content_evidence=[];
 for(let no=1;no<=6;no++){
  const p=past();
  runner_history.push({horse_no:no,horse_name:'馬'+no,past_runs:[p]});
  runner_content_evidence.push({horse_no:no,horse_name:'馬'+no,history:[proof(p)]});
 }
 return {race:{race_date:'2026-11-22'},runner_history,runner_content_evidence};
}
test('complete official field: no histories excluded or order changed',()=>{
 const a=fixtures(),b=restoreJraClaimedRunDetails(a);
 assert.equal(b.runner_history.length,6);
 assert.equal(b.source_evidence_handoff.official_past_runs,6);
 assert.equal(b.source_evidence_handoff.excluded_unverified_past_run_count,0);
 assert.equal(b.source_evidence_handoff.complete_historical_coverage,true);
 assert.deepEqual(b.runner_history.map(x=>x.past_runs.length),[1,1,1,1,1,1]);
});
test('single archive with NULL horse identity: omit that RUN only, preserve current horse and verified other run',()=>{
 const a=fixtures(),p=past('2026-06-28');
 a.runner_history[1].past_runs.push(p);
 a.runner_content_evidence[1].history.push(proof(p,{
  source_kind:'DB',raw_history_match_count:0,detail_available:false,
  archive_full_field:false,archive_match_count:0,live_corner_positions:null
 }));
 const b=restoreJraClaimedRunDetails(a);
 assert.equal(b.runner_history.length,6);
 assert.deepEqual(b.runner_history.map(x=>x.past_runs.length),[1,1,1,1,1,1]);
 assert.equal(b.source_evidence_handoff.official_past_runs,6);
 assert.equal(b.source_evidence_handoff.excluded_unverified_past_run_count,1);
 assert.equal(b.source_evidence_handoff.complete_historical_coverage,false);
 assert.equal(b.source_evidence_handoff.excluded_unverified_past_runs[0].horse_no,2);
 assert.equal(b.source_evidence_handoff.excluded_unverified_past_runs[0].original_index,1);
 assert.equal(b.source_evidence_handoff.market_used,false);
});
test('ambiguous archive match fails closed; never treated as absent',()=>{
 const a=fixtures(),p=a.runner_history[1].past_runs[0];
 a.runner_content_evidence[1].history[0]=proof(p,{source_kind:'DB',archive_match_count:2,detail_available:true,archive_full_field:true});
 assert.throws(()=>restoreJraClaimedRunDetails(a),/RUN_IDENTITY/);
});
test('conflicting runner identity, including a missing source, still fails closed',()=>{
 const a=fixtures();
 a.runner_content_evidence[1].history[0]=proof(a.runner_history[1].past_runs[0],{
  source_kind:'DB',archive_match_count:0,detail_available:false,prior_distance:1800
 });
 assert.throws(()=>restoreJraClaimedRunDetails(a),/RUN_IDENTITY/);
});
test('future or race-day results never enter context',()=>{
 const a=fixtures(),p=a.runner_history[1].past_runs[0];
 p.race_date='2026-11-22';a.runner_content_evidence[1].history[0]=proof(p);
 assert.throws(()=>restoreJraClaimedRunDetails(a),/RUN_IDENTITY/);
});
test('duplicate active horse number still fails closed',()=>{
 const a=fixtures();a.runner_history[1].horse_no=1;
 assert.throws(()=>restoreJraClaimedRunDetails(a),/DUPLICATE/);
});
