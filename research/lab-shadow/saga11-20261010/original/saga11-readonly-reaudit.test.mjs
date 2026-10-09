import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COMPACT_V1_RACE_NO_FINDING,supplementRaceNos,createRefreshProcedure,auditOfficialRefresh} from './saga11-readonly-reaudit.mjs';

const source=JSON.parse(await readFile(new URL('./SAGA11_PRERACE_SHADOW_2026-10-10.json',import.meta.url),'utf8'));
const audited=supplementRaceNos(source);
const validRefresh={
  source_ref:audited.race.official_url,fetched_at:'2026-10-10T18:00:00+09:00',
  conditions:{...audited.race.conditions,going:'良',weather:'晴'},
  runners:audited.runners.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,status:'ACTIVE'})),
};

test('race_no is an existing COMPACT_V1 identity requirement and all 50 nulls are officially supplemented',()=>{
  assert.equal(COMPACT_V1_RACE_NO_FINDING.required,true);
  assert.equal(audited.race_no_audit.initial_null_count,50);
  assert.equal(audited.runners.flatMap(r=>r.recent_card_entries).length,55);
  assert.ok(audited.runners.every(r=>r.recent_card_entries.every(x=>Number.isInteger(x.race_no)&&x.race_no_evidence.source_ref===r.profile_url)));
});

test('supplement changes only race number audit metadata and preserves all existing run facts',()=>{
  for(const runner of source.runners){
    const after=audited.runners.find(r=>r.horse_no===runner.horse_no);
    runner.recent_card_entries.forEach((before,index)=>{
      const a=after.recent_card_entries[index];
      for(const key of ['race_date','track','distance','going','finish','time','passing_order','final3f','official_url','available_before_target'])assert.deepEqual(a[key],before[key]);
    });
  }
});

test('refresh procedure is read-only, bounded and checks status changes',()=>{
  const procedure=createRefreshProcedure(audited);
  assert.equal(procedure.request_policy.cache,'no-store');
  assert.equal(procedure.request_policy.timeout_ms,15000);
  assert.ok(procedure.steps.some(x=>x.includes('ACTIVE')));
  assert.deepEqual(procedure.prohibited_actions,['database_write','queue_claim','save','finish','model_call','deployment']);
});

test('complete pre-race official refresh becomes READY and records field sets',()=>{
  const result=auditOfficialRefresh(audited,validRefresh);
  assert.equal(result.status,'READY');
  assert.deepEqual(result.active_runner_nos,[1,2,3,4,5,6,7,8,9,10,11]);
});

test('missing weather or going remains BLOCKED',()=>{
  const refresh=structuredClone(validRefresh);refresh.conditions.weather=null;refresh.conditions.going=null;
  const result=auditOfficialRefresh(audited,refresh);
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.blockers.includes('TARGET_WEATHER_MISSING'));
  assert.ok(result.blockers.includes('TARGET_GOING_MISSING'));
});

test('cancellation is recorded, while identity, future and market contamination stop safely',()=>{
  const cancelled=structuredClone(validRefresh);cancelled.runners[3].status='CANCELLED';
  assert.deepEqual(auditOfficialRefresh(audited,cancelled).cancelled_runner_nos,[4]);
  const identity=structuredClone(validRefresh);identity.runners[0].horse_name='同名別馬';
  assert.ok(auditOfficialRefresh(audited,identity).blockers.includes('FIELD_IDENTITY_CONFLICT'));
  const future=structuredClone(validRefresh);future.fetched_at=audited.race.post_time;
  assert.ok(auditOfficialRefresh(audited,future).blockers.includes('NOT_PROVEN_PRE_RACE'));
  const market=structuredClone(validRefresh);market.odds={1:2.1};
  assert.throws(()=>auditOfficialRefresh(audited,market),/BANNED_FIELD/);
});
