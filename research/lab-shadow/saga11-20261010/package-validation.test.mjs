import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectPackage} from './package-validation.mjs';
const original = await readFile(new URL('./original/SAGA11_PRERACE_REAUDIT_2026-10-10.json', import.meta.url), 'utf8');
const fresh = () => JSON.parse(original);

test('supplied artifact has 11 runners and 55 histories with a missing passing order; remains BLOCKED', () => {
  const result = inspectPackage(fresh());
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['HISTORY_FIELDS_INVALID']);
  assert.equal(result.runner_count, 11);
  assert.equal(result.history_rows, 55);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.includes('TARGET_WEATHER_MISSING'));
  assert.ok(result.blockers.includes('TARGET_GOING_MISSING'));
});
test('inspection preserves every supplied history field and original JSON', () => {
  const data = fresh(); inspectPackage(data); assert.equal(JSON.stringify(data), JSON.stringify(fresh()));
});
const cases = [
  ['invalid post time', d => d.race.post_time = 'invalid', 'POST_TIME_INVALID'],
  ['post-time capture', d => d.timing.data_fetched_at = d.race.post_time, 'CAPTURE_NOT_PRE_RACE'],
  ['wrong official venue', d => d.race.official_url = d.race.official_url.replace('Code=32','Code=31'), 'OFFICIAL_URL_INVALID'],
  ['duplicate horse identity', d => d.runners[1].lineage_id = d.runners[0].lineage_id, 'FIELD_IDENTITY_INVALID'],
  ['missing horse name', d => d.runners[0].horse_name = '', 'FIELD_IDENTITY_INVALID'],
  ['unknown status', d => d.runners[0].status = 'UNKNOWN', 'FIELD_STATUS_INVALID'],
  ['active history under five is not filled with fabricated runs', d => d.runners[0].recent_card_entries.pop(), 'ACTIVE_FIVE_PRIOR_RUNS_UNPROVEN'],
  ['target-day history', d => d.runners[0].recent_card_entries[0].race_date = d.race.race_date, 'HISTORY_NOT_PROVEN_PRIOR'],
  ['duplicate history', d => d.runners[0].recent_card_entries[1] = structuredClone(d.runners[0].recent_card_entries[0]), 'HISTORY_DUPLICATE'],
  ['race number missing', d => d.runners[0].recent_card_entries[0].race_no = null, 'HISTORY_FIELDS_INVALID'],
  ['passing order missing', d => d.runners[0].recent_card_entries[0].passing_order = '', 'HISTORY_FIELDS_INVALID'],
  ['post-time witness', d => d.runners[0].recent_card_entries[0].race_no_evidence.fetched_at = d.race.post_time, 'HISTORY_WITNESS_INVALID'],
  ['wrong horse witness', d => d.runners[0].recent_card_entries[0].race_no_evidence.source_ref = d.runners[1].profile_url, 'HISTORY_WITNESS_INVALID'],
  ['missing runner conflicts with recorded field', d => d.runners.pop(), 'FIELD_COUNTS_CONFLICT'],
  ['market data', d => d.runners[0].odds = 2.1, 'CONTAMINATION:root.runners.0.odds'],
  ['target result', d => d.target_result = {winner:1}, 'CONTAMINATION:root.target_result'],
  ['banei excluded', d => d.race.track = '帯広', 'TARGET_UNSUPPORTED'],
];
for (const [name, mutate, expected] of cases) test(name, () => {
  const data = fresh(); mutate(data); const result = inspectPackage(data);
  assert.equal(result.ok, false); assert.equal(result.status, 'BLOCKED'); assert.ok(result.errors.includes(expected), JSON.stringify(result));
});
for (const state of ['CANCELLED','EXCLUDED']) test(`explicit ${state} preserved with consistent ACTIVE set`, () => {
  const data = fresh(); data.runners[0].status = state; data.field.active_runner_nos.shift();
  assert.deepEqual(inspectPackage(data).errors, ['HISTORY_FIELDS_INVALID']); assert.equal(data.runners[0].status, state); assert.equal(inspectPackage(data).status, 'BLOCKED');
});
test('weather and going plus a claimed READY never substitute for raw evidence', () => {
  const data = fresh(); data.race.conditions.weather = '晴'; data.race.conditions.going = '良'; data.status = 'READY';
  const result = inspectPackage(data); assert.equal(result.ok, false); assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.includes('OFFICIAL_RAW_EVIDENCE_NOT_INCLUDED'));
});
test('malformed top-level inputs fail closed', () => {
  for (const data of [null, [], 'READY', 1]) assert.equal(inspectPackage(data).ok, false);
});
