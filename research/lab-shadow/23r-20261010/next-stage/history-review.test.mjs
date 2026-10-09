import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzePackage,assertTargetSet,assessRaceStrict,parsePassingOrder} from './history-review.mjs';
const raw=JSON.parse(await readFile(new URL('../2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(raw);

test('reproduces 58 runners with disjoint causal groups and overlap accounted for',()=>{
  const r=analyzePackage(raw);
  assert.equal(r.counts.active_runners,230);assert.equal(r.counts.incomplete_runners,58);
  assert.deepEqual(r.counts.groups,{DETAIL_IDENTIFIERS_ONLY:45,SHORT_ONLY:7,SHORT_AND_DETAIL_IDENTIFIERS:6});
  assert.equal(r.incomplete_runners.filter(x=>x.missing.passing_order).length,1);
});
test('124 JRA occurrences stay unverified and retain null race identifiers',()=>{
  const r=analyzePackage(raw);assert.equal(r.jra_history_occurrences.length,124);
  assert.equal(r.counts.jra_verified,0);assert.equal(r.counts.jra_unverified,124);
  assert.ok(r.jra_history_occurrences.every(x=>x.history.race_no===null && x.history.official_url===null));
});
test('13 short histories split into five non-completed-slot and eight blank-slot cases; career unconfirmed',()=>{
  const r=analyzePackage(raw);assert.equal(r.short_history_runners.length,13);
  assert.deepEqual(r.counts.short_groups,{NON_COMPLETED_SLOT_REQUIRES_OLDER_HISTORY:5,BLANK_SLOT_CAREER_UNCONFIRMED:8});
  assert.ok(r.short_history_runners.every(x=>x.actual_career_under_five==='UNVERIFIED'));
});
test('230 ACTIVE and 14 withdrawn/excluded are kept separate without modifying input',()=>{
  const input=fresh(),before=JSON.stringify(input);analyzePackage(input);
  assert.equal(JSON.stringify(input),before);
  assert.equal(input.races.flatMap(x=>x.runners).filter(x=>x.status==='CANCELLED').length,12);
  assert.equal(input.races.flatMap(x=>x.runners).filter(x=>x.status==='EXCLUDED').length,2);
});
test('all 23 races remain blocked with missing official originals, current status and weather/going',()=>{
  const r=analyzePackage(raw);assert.equal(r.counts.ready,0);assert.equal(r.counts.blocked,23);
  assert.ok(r.decisions.every(x=>x.status==='BLOCKED' && x.blockers.includes('TARGET_WEATHER_MISSING') && x.blockers.includes('TARGET_GOING_MISSING') && x.blockers.includes('OFFICIAL_HTML_ORIGINAL_UNAVAILABLE') && x.blockers.includes('LATEST_FIELD_NOT_REVERIFIED')));
});
for(const positions of ['11-9','3-4-2','1-2-3-4'])test(`whole performance cell parses ${positions} with no supplementation`,()=>{
  assert.deepEqual(parsePassingOrder({passing_order:null,evidence:{performance:`1:14.4 ${positions} 38.3`}}),{value:positions,issue:null});
});
test('date and prose substrings never become passing order',()=>{
  for(const performance of ['2026-04-25','取止 26.04.04','prose 11-9 38.3','1:14.4 11-9 38.3 extra'])assert.equal(parsePassingOrder({evidence:{performance}}).value,null);
});
test('conflicting or invalid passing order is rejected rather than overwritten',()=>{
  assert.equal(parsePassingOrder({passing_order:'1-2',evidence:{performance:'1:14.4 11-9 38.3'}}).issue,'PASSING_ORDER_CONFLICT');
  for(const passing_order of ['0-1','21-1','1-2-3-4-5',11])assert.equal(parsePassingOrder({passing_order}).issue,'PASSING_ORDER_INVALID');
});
const targetFailures=[
  ['duplicate race',d=>d.races[1]=structuredClone(d.races[0])],
  ['banei',d=>d.races[0].track='帯広ば'],
  ['wrong date',d=>d.races[0].race_date='2026-10-11'],
  ['wrong count',d=>d.races.pop()],
  ['unexpected venue',d=>d.races[0].track='大井'],
];
for(const [name,mutate] of targetFailures)test(`exact target set rejects ${name}`,()=>{const d=fresh();mutate(d);assert.throws(()=>assertTargetSet(d));});
const raceFailures=[
  ['empty active field',r=>r.runners=[], 'ACTIVE_FIELD_EMPTY'],
  ['unknown status',r=>r.runners[0].status='UNKNOWN','FIELD_STATUS_UNVERIFIED'],
  ['duplicate horse number',r=>r.runners[1].horse_no=r.runners[0].horse_no,'HORSE_IDENTITY_UNVERIFIED'],
  ['wrong profile horse identity',r=>r.runners[0].nar_lineage_id='999999','HORSE_IDENTITY_UNVERIFIED'],
  ['invalid scheduled time',r=>r.scheduled_start='invalid','PRE_RACE_TIMING_UNVERIFIED'],
  ['after-post capture',r=>r.captured_at=r.scheduled_start,'PRE_RACE_TIMING_UNVERIFIED'],
  ['wrong target official URL',r=>r.official_url=r.official_url.replace('Code=31','Code=32'),'OFFICIAL_TARGET_URL_MISMATCH'],
  ['wrong historical detail URL',r=>r.runners[0].recent_card_slots[0].official_url='https://example.test/','HISTORY_DETAIL_IDENTITY_UNVERIFIED'],
  ['duplicate history',r=>r.runners[0].recent_card_slots[1]=structuredClone(r.runners[0].recent_card_slots[0]),'HISTORY_DUPLICATE'],
  ['same-day history',r=>r.runners[0].recent_card_slots[0].race_date=r.race_date,'HISTORY_NOT_PROVEN_PRIOR'],
  ['missing slot',r=>r.runners[0].recent_card_slots.pop(),'CARD_SLOT_LAYOUT_UNVERIFIED'],
  ['market key',r=>r.runners[0].odds=2.1,'PROHIBITED_DATA_KEY'],
  ['target result',r=>r.target_result={winner:1},'PROHIBITED_DATA_KEY'],
];
for(const [name,mutate,reason] of raceFailures)test(`strict gate blocks ${name}`,()=>{
  const r=structuredClone(raw.races[0]);mutate(r);const result=assessRaceStrict(r);
  assert.equal(result.status,'BLOCKED');assert.ok(result.blockers.includes(reason),JSON.stringify(result));
});
test('adding hypothetical weather and going does not waive evidence or latest-field gates',()=>{
  const r=structuredClone(raw.races[0]);r.conditions.weather='晴';r.conditions.going='良';
  const result=assessRaceStrict(r);assert.equal(result.status,'BLOCKED');assert.ok(result.blockers.includes('LATEST_FIELD_NOT_REVERIFIED'));
});
