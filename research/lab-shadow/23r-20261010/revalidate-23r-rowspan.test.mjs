import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditDay, normalizeRun } from './revalidate-23r-rowspan.mjs';

const raw=JSON.parse(await readFile(new URL('./2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json',import.meta.url),'utf8'));

test('target contains exactly Kochi 11 plus Saga 12 and excludes Obihiro',()=>{
  const out=auditDay(raw);
  assert.equal(out.races.length,23);
  assert.equal(out.races.filter(r=>r.track==='高知').length,11);
  assert.equal(out.races.filter(r=>r.track==='佐賀').length,12);
  assert.equal(out.races.some(r=>r.track==='帯広ば'),false);
});

test('rowspan parser evidence holds lineage identity and five card columns where published',()=>{
  for(const race of raw.races) for(const runner of race.runners){
    assert.match(runner.nar_lineage_id,/^\d+$/);
    assert.ok(Array.isArray(runner.recent_card_slots));
    assert.equal(runner.recent_card_slots.length,5);
  }
});

test('two-position passing order is recovered without guessing',()=>{
  const run={passing_order:null,evidence:{performance:'1:14.4 11-9 38.3'}};
  assert.equal(normalizeRun(run,'profile').passing_order,'11-9');
});

test('missing race detail identifier is not fabricated',()=>{
  const out=normalizeRun({race_no:null,official_url:null,evidence:{performance:'1:14.4 11-9 38.3'}},'profile');
  assert.equal(out.race_no,null);
  assert.equal(out.official_url,null);
  assert.equal(out.detail_evidence_status,'DETAIL_LINK_UNAVAILABLE');
});

test('unpublished target weather and going keep every race blocked',()=>{
  const out=auditDay(raw);
  assert.equal(out.ready_count,undefined);
  assert.equal(out.races.every(r=>r.status==='BLOCKED'),true);
  assert.equal(out.races.every(r=>r.blockers.includes('TARGET_WEATHER_OR_GOING_UNPUBLISHED')),true);
});

test('audit remains side-effect free and model free',()=>{
  const out=auditDay(raw);
  assert.deepEqual(out.production_mutations,[]);
  assert.equal(out.model_calls,0);
  assert.equal(out.saga11_existing_audit_preserved,true);
});
