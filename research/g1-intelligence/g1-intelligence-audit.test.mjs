import test from 'node:test';
import assert from 'node:assert/strict';
import { buildG1IntelligenceAudit } from '../../supabase/functions/jra-claimed-mcp/g1-intelligence-audit.mjs';

const context = () => ({
  stage: 'AWAITING_JRA_FULL_DEPTH_COMPARISON',
  race: { race_date:'2026-11-22',post_time:'2026-11-22T15:40:00+09:00',
    field_payload:{race:{race_name:'マイルチャンピオンシップ'},runners:
      Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:'馬'+(i+1),status:'ACTIVE'}))}},
  runner_history:Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:'馬'+(i+1),
    past_runs:[{race_date:'2026-09-01',finish:3,corner_positions:'4 4',final3f:33.5}]}))
});
const opts = {observedAt:'2026-11-21T00:00:00Z'};
test('G1 full-field valid context produces non-scoring coverage audit',()=>{
  const c=context(),prior=JSON.stringify(c);
  const r=buildG1IntelligenceAudit(c,{...opts,payload:{runners:[{horse_no:1,rank:5}]}});
  assert.equal(r.status,'READY_READ_ONLY_REVIEW');
  assert.equal(r.field_count,6);
  assert.equal(r.per_runner[0].near_top5_boundary,true);
  assert.equal(r.score_delta,0);assert.equal(r.save_authorized,false);
  assert.equal(r.market_used,false);assert.equal(r.target_result_used,false);
  assert.equal(r.frozen_modified,false);assert.equal(JSON.stringify(c),prior);
});
test('non-G1 unchanged',()=>{
  const c=context();c.race.field_payload.race.race_name='1勝クラス';
  assert.equal(buildG1IntelligenceAudit(c,opts).status,'SKIPPED_NON_G1');
});
test('refuses post-time observed request',()=>{
  assert.equal(buildG1IntelligenceAudit(context(),{observedAt:'2026-11-23T00:00:00Z'}).status,'BLOCKED_NOT_VALID_PRE_RACE_CLAIM');
});
test('refuses future or target-race history',()=>{
  const c=context();c.runner_history[0].past_runs[0].race_date='2026-11-22';
  assert.equal(buildG1IntelligenceAudit(c,opts).status,'BLOCKED_FUTURE_OR_UNDATED_RUN');
});
test('refuses missing runner histories',()=>{
  const c=context();c.runner_history.pop();
  assert.equal(buildG1IntelligenceAudit(c,opts).status,'BLOCKED_INCOMPLETE_HISTORY');
});
test('refuses candidate identity mismatch',()=>{
  const c=context();c.runner_history[1].horse_name='違う馬';
  assert.equal(buildG1IntelligenceAudit(c,opts).status,'BLOCKED_HISTORY_IDENTITY_MISMATCH');
});
test('requires official live stage',()=>{
  const c=context();c.stage='DONE';
  assert.equal(buildG1IntelligenceAudit(c,opts).status,'BLOCKED_NOT_VALID_PRE_RACE_CLAIM');
});
test('never fabricates missing pre-race trainer or equipment evidence',()=>{
  const r=buildG1IntelligenceAudit(context(),opts);
  for(const x of r.per_runner){
    assert.ok(x.external_pre_race_checks_required.includes('PRE_RACE_TRAINER_COMMENT'));
    assert.ok(x.external_pre_race_checks_required.includes('EQUIPMENT_CHANGE'));
  }
});
