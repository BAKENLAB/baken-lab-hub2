import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase-candidate/supabase/functions/lab-claimed-context/handler.mjs';
import {localContextSnapshot} from '../supabase-candidate/supabase/functions/lab-claimed-context/context-snapshot.mjs';

// Boundary tests only: no network, production credentials, or database writes.
const now = Date.parse('2026-10-03T00:00:00Z');
const input = {
  run_id: '11111111-1111-1111-1111-111111111111',
  job_id: '22222222-2222-2222-2222-222222222222',
  claim_token: '33333333-3333-3333-3333-333333333333',
};
const serviceKey = 'local-fixture-key-not-a-production-secret';
function fixture() {
  return {
    lab_worker_runs: {id: input.run_id, worker_id: 'fixture-worker', status: 'RUNNING'},
    lab_prediction_jobs: {
      id: input.job_id, race_date: '2026-10-03', track: '高知', race_no: 9, circuit: 'LOCAL',
      job_status: 'CLAIMED', worker_run_id: input.run_id, claim_token: input.claim_token,
      claimed_by: 'fixture-worker', lease_until: '2026-10-03T00:30:00Z', attempts: 1, max_attempts: 3,
    },
    official_races: {
      race_date: '2026-10-03', track: '高知', race_no: 9, circuit: 'LOCAL', race_name: 'fixture race',
      post_time: '2026-10-03T01:00:00Z', prediction_status: 'PENDING',
      field_payload: {
        runners: [
          {horse_no: 1, horse_name: 'fixture-horse-one', status: 'ACTIVE', jockey: 'fixture-jockey',
            weight_carried: 56, sex_age: '牡3', draw: 1, trainer: 'fixture-trainer', body_weight: 480,
            body_weight_diff: 2, equipment: 'fixture-equipment', identity_refs: ['/ref-one', '/ref-two']},
          {horse_no: 2, horse_name: 'fixture-horse-two', status: 'ACTIVE', weight_carried: 54, jockey: 'other-jockey'},
        ],
        conditions: {surface: 'ダート', distance: 1400, going: '良', weather: '晴', turn: '右', class_name: 'fixture class'},
      },
    },
    lab_prediction_protocols: {
      protocol_key: 'LOCAL_MAIN', version: 'fixture-v1', is_active: true,
      content: {instructions: ['compare all runners', 'audit outside top five'], nested: {a: 1, b: true}},
    },
  };
}
const clone = value => JSON.parse(JSON.stringify(value));
function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseObjectKeys(item)]));
  return value;
}
function setup({mutateInitial = () => {}, mutateFresh = () => {}, mutateInPlace} = {}) {
  const initial = fixture();
  mutateInitial(initial);
  const fresh = mutateInPlace ? initial : clone(initial);
  mutateFresh(fresh);
  let reads = 0;
  let collected = 0;
  const client = {from(table) {
    assert.ok(Object.hasOwn(initial, table));
    return {
      select() { return this; }, eq() { return this; }, limit() { return this; },
      abortSignal() {
        const data = reads++ < 4 ? initial : fresh;
        return Promise.resolve({data: [mutateInPlace ? data[table] : clone(data[table])], error: null});
      },
    };
  }};
  const handler = createHandler({client, serviceKey, now: () => now, officialFactory: () => ({}),
    collector: async state => {
      collected++;
      const context = {
        claim: {job_id: state.job.id, run_id: state.run.id, claim_token: state.job.claim_token},
        race: {...clone(state.race), conditions: clone(state.race.field_payload.conditions)},
        protocol_version: state.protocol.version,
        runners: state.race.field_payload.runners.filter(runner => runner.status === 'ACTIVE')
          .map(runner => ({...clone(runner), identity_refs: [], recent_runs: [], missing_items: []})),
        missing_conditions: [], field_integrity_checked: true, supplementation_audit: [],
      };
      mutateInPlace?.(state);
      return context;
    },
  });
  return async (authorization = `Bearer ${serviceKey}`) => {
    const response = await handler(new Request('https://fixture.invalid/lab-claimed-context', {
      method: 'POST', headers: {authorization, 'content-type': 'application/json'}, body: JSON.stringify(input),
    }));
    return {status: response.status, body: await response.json(), reads, collected};
  };
}
const changed = async invoke => {
  const result = await invoke();
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {ok: false, error: 'CONTEXT_CHANGED'});
};

test('independently deserialized equal context succeeds and never returns the claim token', async () => {
  const result = await setup()();
  assert.equal(result.status, 200);
  assert.equal(result.body.context.race.circuit, 'LOCAL');
  assert.equal(result.body.context.stage, 'AWAITING_FULL_DEPTH_COMPARISON');
  assert.equal(result.reads, 8);
  assert.equal(result.collected, 1);
  assert.ok(!JSON.stringify(result).includes(input.claim_token));
  assert.ok(!JSON.stringify(result).includes(serviceKey));
});
test('object key order, runner order and identity reference order do not change context', async () => {
  const result = await setup({mutateFresh(data) {
    Object.assign(data, reverseObjectKeys(data));
    data.official_races.field_payload.runners.reverse();
    data.official_races.field_payload.runners[1].identity_refs.reverse();
  }})();
  assert.equal(result.status, 200);
});
test('protocol rule changes cause CONTEXT_CHANGED', async () => {
  await changed(setup({mutateFresh(data) { data.lab_prediction_protocols.content.nested.a = 2; }}));
});
test('protocol instruction array order is meaningful and changes cause CONTEXT_CHANGED', async () => {
  await changed(setup({mutateFresh(data) { data.lab_prediction_protocols.content.instructions.reverse(); }}));
});
test('protocol version changes cause CONTEXT_CHANGED', async () => {
  await changed(setup({mutateFresh(data) { data.lab_prediction_protocols.version = 'fixture-v2'; }}));
});
for (const [key, value] of [
  ['horse_no', 3], ['horse_name', 'changed-horse'], ['jockey', 'changed-jockey'], ['weight_carried', 57],
  ['status', 'CANCELLED'], ['status', 'EXCLUDED'], ['sex_age', '牡4'], ['draw', 2], ['trainer', 'changed-trainer'],
  ['body_weight', 488], ['body_weight_diff', 10], ['equipment', 'changed-equipment'], ['identity_refs', ['/changed-ref']],
]) {
  test(`prediction-relevant runner change ${key}=${JSON.stringify(value)} causes CONTEXT_CHANGED`, async () => {
    await changed(setup({mutateFresh(data) { data.official_races.field_payload.runners[0][key] = value; }}));
  });
}
test('removing a runner causes CONTEXT_CHANGED', async () => {
  await changed(setup({mutateFresh(data) { data.official_races.field_payload.runners.pop(); }}));
});
test('race conditions change causes CONTEXT_CHANGED', async () => {
  await changed(setup({mutateFresh(data) { data.official_races.field_payload.conditions.going = '重'; }}));
});
test('race name and post time changes cause CONTEXT_CHANGED', async () => {
  for (const [key, value] of [['race_name', 'changed-race'], ['post_time', '2026-10-03T01:01:00Z']])
    await changed(setup({mutateFresh(data) { data.official_races[key] = value; }}));
});
test('market-only and unrelated result/fetch metadata changes do not change context', async () => {
  const result = await setup({mutateFresh(data) {
    Object.assign(data.official_races.field_payload, {odds: {1: 1.1}, popularity: [1, 2], market: 'updated',
      result: {winner: 1}, fetched_at: '2026-10-03T00:00:01Z'});
    Object.assign(data.official_races.field_payload.runners[0], {
      odds: 1.1, win_odds: 1.2, popularity: 1, market: 'updated', finish: 1, fetched_at: '2026-10-03T00:00:01Z',
    });
    data.official_races.field_payload.conditions.odds = 'updated';
  }})();
  assert.equal(result.status, 200);
  const context = JSON.stringify(result.body.context);
  for (const forbidden of ['"odds"', '"popularity"', '"market"', '"fetched_at"'])
    assert.ok(!context.includes(forbidden));
});
test('the initial immutable value snapshot detects in-place mutations during collection', async () => {
  await changed(setup({mutateInPlace(state) { state.protocol.content.nested.a = 2; }}));
  await changed(setup({mutateInPlace(state) { state.race.field_payload.runners[0].jockey = 'changed-jockey'; }}));
});
test('non-LOCAL is still rejected before collection', async () => {
  const result = await setup({mutateInitial(data) {
    data.lab_prediction_jobs.circuit = 'JRA'; data.official_races.circuit = 'JRA';
  }})();
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'RACE_MISMATCH');
  assert.equal(result.collected, 0);
});
test('expired claims remain rejected before collection', async () => {
  const result = await setup({mutateInitial(data) { data.lab_prediction_jobs.lease_until = new Date(now).toISOString(); }})();
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'STALE_OR_EXPIRED_CLAIM');
  assert.equal(result.collected, 0);
});
test('wrong worker and non-CLAIMED states remain rejected', async () => {
  for (const [key, value] of [['claimed_by', 'another-worker'], ['job_status', 'RETRY']]) {
    const result = await setup({mutateInitial(data) { data.lab_prediction_jobs[key] = value; }})();
    assert.equal(result.status, 409);
    assert.equal(result.body.error, 'STALE_OR_EXPIRED_CLAIM');
    assert.equal(result.collected, 0);
  }
});
test('authentication is still checked before database reads', async () => {
  const result = await setup()('Bearer wrong-fixture-value');
  assert.equal(result.status, 401);
  assert.equal(result.reads, 0);
});
test('LOCAL value snapshot rejects another circuit even outside the handler', () => {
  const data = fixture(); data.official_races.circuit = 'JRA';
  assert.throws(() => localContextSnapshot({race: data.official_races, protocol: data.lab_prediction_protocols}),
    error => error.code === 'RACE_MISMATCH');
});
