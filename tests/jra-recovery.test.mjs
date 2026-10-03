import test from 'node:test';
import assert from 'node:assert/strict';
import { JRA_PROTOCOL, buildJraContext, getJraContext, validateJraPrediction, saveJraPrediction } from '../automation/jra-recovery.mjs';
import { createJraRecoveryAdapter } from '../automation/jra-recovery-db.mjs';

const identity = { race_date: '2026-10-03', track: '東京', race_no: 12, circuit: 'JRA' };
function fixture() {
  const runners = Array.from({ length: 7 }, (_, i) => {
    const horse = { horse_no: i + 1, horse_name: '馬' + (i + 1), horse_ref: 'https://official.test/horse/' + (i + 1),
      draw: i + 1, sex_age: '牡4', weight_carried: 57, jockey: '騎手', trainer: '調教師',
      body_weight: null, body_weight_diff: null, equipment: '', source_checked_at: '2026-10-03T00:00:00Z' };
    return { ...horse, history: Array.from({ length: 5 }, (_, j) => ({
      horse_ref: horse.horse_ref, horse_name: horse.horse_name, race_date: '2026-09-' + String(25 - j).padStart(2, '0'),
      surface: '芝', finish: 2, weight_carried: 55, body_weight: 490,
      source: 'LIVE_OFFICIAL', source_ref: 'official-race-' + j, source_checked_at: horse.source_checked_at,
    })) };
  });
  return { race: { ...identity, race_name: '平地', post_time: '2026-10-03T07:30:00Z', field_fetched_at: '2026-10-03T00:00:00Z',
    source: 'JRA_OFFICIAL', field_status: 'BASIC_READY', prediction_status: 'PENDING',
    field_payload: { race: { race_type: '平地', surface: '芝', field_size: 7 },
      runners: runners.map(r => ({ horse_no: r.horse_no, horse_name: r.horse_name, horse_ref: r.horse_ref, status: 'ACTIVE' })) } },
  now: '2026-10-03T05:00:00Z', existing: false, runners };
}
function prediction(context) {
  const runners = context.runners.map((r, i) => ({ horse_no: r.horse_no, horse_name: r.horse_name, rank: i + 1,
    grade: 'B', reason: '今回条件と平地履歴の個別比較根拠' }));
  return { runners, top5: runners.slice(0, 5), eye: { ...runners[6], reason: '前走距離より今回条件に具体的な改善根拠' },
    bets: [], summary: '全頭比較', bet_strategy: 'MARKET_SEPARATE',
    audit: { protocol_version: JRA_PROTOCOL, market_used_for_ranking: false, obstacle_excluded: true,
      all_runners_checked: true, outside_top5_reaudited: true, context_fingerprint: context.fingerprint,
      outside_top5_audits: runners.slice(5).map(r => ({ horse_no: r.horse_no, reason: '当該馬の個別再監査根拠' })) } };
}
function memoryAdapter(bundle, options = {}) {
  let state = { prediction: null, registryStatus: 'PENDING' };
  return {
    state: () => structuredClone(state), readBundle: async () => structuredClone(bundle),
    async transaction(fn) {
      const draft = structuredClone(state);
      const result = await fn({
        readBundle: async () => ({ ...structuredClone(bundle), existing: draft.prediction !== null }),
        insertPrediction: async row => {
          draft.prediction = { id: 'id', ...structuredClone(row) };
          draft.registryStatus = 'FROZEN'; // models the existing AFTER INSERT registry trigger
          if (options.insertError) throw new Error('TRIGGER_ERROR');
          return { id: 'id' };
        },
        readPrediction: async () => options.verifyError ? { ...draft.prediction, protocol_version: 'wrong' } : draft.prediction,
      });
      state = draft;
      return result;
    },
  };
}
const request = (c, p = prediction(c)) => ({ protocol_version: JRA_PROTOCOL, context_fingerprint: c.fingerprint, payload: p });

test('complete JRA context preserves official identity and bounds each history', () => {
  const c = buildJraContext(fixture()); assert.equal(c.runners.length, 7); assert.deepEqual(c.blockers, []);
  assert.equal(c.runners[0].history.length, 5); assert.equal(c.runners[0].identity_evidence.method, 'EXACT_OFFICIAL_REF');
});
for (const [name, mutate, code] of [
  ['LOCAL refusal', b => { b.race.circuit = 'LOCAL'; }, 'JRA_ONLY'],
  ['obstacle race refusal', b => { b.race.field_payload.race.race_type = '障害'; }, 'FLAT_ONLY'],
  ['started race refusal', b => { b.now = b.race.post_time; }, 'RACE_ALREADY_STARTED'],
  ['missing post time', b => { b.race.post_time = null; }, 'TIMESTAMP_REQUIRED'],
  ['post date mismatch', b => { b.race.post_time = '2026-10-04T07:30:00Z'; }, 'POST_DATE_MISMATCH'],
  ['future card refusal', b => { b.race.field_fetched_at = '2026-10-03T06:00:00Z'; }, 'FUTURE_FIELD'],
  ['existing prediction refusal', b => { b.existing = true; }, 'PREDICTION_EXISTS'],
  ['FROZEN race refusal', b => { b.race.prediction_status = 'FROZEN'; }, 'RACE_NOT_PENDING'],
  ['field count mismatch', b => { b.race.field_payload.race.field_size = 8; }, 'FIELD_MISMATCH'],
  ['same name different ID refusal', b => { b.runners[0].horse_ref = 'other'; }, 'HORSE_IDENTITY_UNCONFIRMED'],
  ['no ID refusal', b => { b.race.field_payload.runners[0].horse_ref = null; }, 'HORSE_IDENTITY_UNCONFIRMED'],
  ['future runner refusal', b => { b.runners[0].source_checked_at = '2026-10-03T06:00:00Z'; }, 'FUTURE_RUNNER'],
  ['cancelled field unresolved', b => { b.race.field_payload.runners[0].status = 'CANCELLED'; }, 'FIELD_STATUS_UNRESOLVED'],
]) test(name, () => { const b = fixture(); mutate(b); assert.throws(() => buildJraContext(b), new RegExp(code)); });

for (const [name, mutate] of [
  ['target race result', h => { h.race_date = '2026-10-03'; h.finish = 1; }],
  ['future date', h => { h.race_date = '2026-10-04'; }],
  ['same-day earlier result', h => { h.race_date = '2026-10-03'; h.race_start_at = '2026-10-03T01:00:00Z'; }],
  ['post-start information', h => { h.race_start_at = '2026-10-03T08:00:00Z'; }],
  ['not yet available history', h => { h.source_checked_at = '2026-10-03T06:00:00Z'; }],
  ['jump history', h => { h.race_type = '障害'; }],
  ['jump raw marker', h => { h.raw = '障害オープン'; }],
  ['different horse history', h => { h.horse_ref = 'different'; }],
  ['unverified source', h => { h.source = 'UNKNOWN'; }],
  ['missing availability evidence', h => { delete h.source_checked_at; }],
  ['malformed availability evidence', h => { h.source_checked_at = 'invalid'; }],
  ['malformed historical date', h => { h.race_date = '2026-99-99'; }],
]) test('excludes ' + name, () => {
  const b = fixture(); mutate(b.runners[0].history[0]);
  const c = buildJraContext(b); assert.equal(c.runners[0].history.length, 4);
  assert.equal(c.runners[0].excluded_history.length, 1); assert.ok(c.blockers.includes('SPARSE_HISTORY_POLICY_UNCONFIRMED'));
});

test('latest five and duplicate-date elimination', () => {
  const b = fixture(); b.runners[0].history.push({ ...b.runners[0].history[0], race_date: '2026-09-01' }, { ...b.runners[0].history[0] });
  assert.deepEqual(buildJraContext(b).runners[0].history.map(h => h.race_date), ['2026-09-25','2026-09-24','2026-09-23','2026-09-22','2026-09-21']);
});
test('market, old predictions, raw HTML excluded; old weight never becomes current weight', () => {
  const b = fixture(); Object.assign(b.runners[0], { popularity: 1, win_odds: 1.1, lab_score: 100, raw: '<html>' });
  Object.assign(b.runners[0].history[0], { win_odds: 2, lab_eye: true, raw: '<html>' });
  const c = buildJraContext(b); assert.equal(c.runners[0].weight_carried, 57); assert.equal(c.runners[0].body_weight, null);
  assert.equal(c.runners[0].history[0].weight_carried, 55); assert.equal(c.runners[0].history[0].body_weight, undefined);
  for (const key of ['win_odds', 'popularity', 'lab_score', 'lab_eye', '<html>']) assert.ok(!JSON.stringify(c).includes(key));
});
test('all zero histories are never frozen', () => {
  const b = fixture(); b.runners.forEach(r => { r.history = []; }); const c = buildJraContext(b);
  assert.ok(c.blockers.includes('ALL_HISTORY_ZERO_NO_FREEZE'));
  assert.throws(() => validateJraPrediction(c, JRA_PROTOCOL, prediction(c)), /CONTEXT_HELD/);
});
test('one sparse horse explicitly holds without invented comparison', () => {
  const b = fixture(); b.runners[0].history = b.runners[0].history.slice(0, 2); const c = buildJraContext(b);
  assert.ok(c.blockers.includes('SPARSE_HISTORY_POLICY_UNCONFIRMED'));
});
test('EYE rank 7 accepted; ChatGPT payload retained exactly', () => {
  const c = buildJraContext(fixture()), p = prediction(c); assert.equal(validateJraPrediction(c, JRA_PROTOCOL, p), p);
  assert.equal(p.eye.rank, 7);
});
for (const [name, mutate, code] of [
  ['extra key', p => { p.extra = true; }, 'SEVEN_KEYS_REQUIRED'],
  ['missing key', p => { delete p.audit; }, 'SEVEN_KEYS_REQUIRED'],
  ['duplicate rank', p => { p.runners[6].rank = 6; }, 'FULL_FIELD_REQUIRED'],
  ['missing runner', p => { p.runners.splice(5, 1); }, 'FULL_FIELD_REQUIRED'],
  ['TOP5 reorder', p => { p.top5.reverse(); }, 'TOP5_MISMATCH'],
  ['EYE inside TOP5', p => { p.eye = { ...p.runners[0] }; }, 'EYE_OUTSIDE_TOP5_REQUIRED'],
  ['no EYE', p => { p.eye = null; }, 'EYE_OUTSIDE_TOP5_REQUIRED'],
  ['missing outside audit', p => { p.audit.outside_top5_audits.pop(); }, 'OUTSIDE_REAUDIT_REQUIRED'],
  ['market used', p => { p.audit.market_used_for_ranking = true; }, 'AUDIT_REQUIRED'],
  ['obstacle not excluded', p => { p.audit.obstacle_excluded = false; }, 'AUDIT_REQUIRED'],
  ['market values in payload', p => { p.runners[0].win_odds = 1; }, 'FORBIDDEN_INPUT'],
  ['nonempty bets', p => { p.bets.push({ type: 'WIN' }); }, 'MARKET_LAYER_SEPARATE'],
  ['wrong bet strategy', p => { p.bet_strategy = 'LOCAL'; }, 'MARKET_LAYER_SEPARATE'],
  ['wrong audit version', p => { p.audit.protocol_version = 'JRA_BASE_CORE_0.1_AB'; }, 'AUDIT_REQUIRED'],
]) test('payload rejects ' + name, () => {
  const c = buildJraContext(fixture()), p = structuredClone(prediction(c)); mutate(p);
  assert.throws(() => validateJraPrediction(c, JRA_PROTOCOL, p), new RegExp(code));
});
test('0.1_AB cannot be mislabeled as formal 0.3', () => {
  const c = buildJraContext(fixture()); assert.throws(() => validateJraPrediction(c, 'JRA_BASE_CORE_0.1_AB', prediction(c)), /PROTOCOL_MISMATCH/);
});
test('save and post-save SELECT preserve exact payload and registry completion', async () => {
  const a = memoryAdapter(fixture()), c = await getJraContext(a, identity), p = prediction(c);
  const result = await saveJraPrediction(a, identity, request(c, p));
  assert.equal(result.saved, true); assert.deepEqual(result.prediction.payload, p); assert.equal(a.state().registryStatus, 'FROZEN');
  assert.equal(result.prediction.protocol_version, JRA_PROTOCOL);
});
for (const flag of ['insertError', 'verifyError']) test(flag + ' rolls back prediction and registry', async () => {
  const b = fixture(), a = memoryAdapter(b, { [flag]: true }), c = buildJraContext(b);
  await assert.rejects(saveJraPrediction(a, identity, request(c)));
  assert.deepEqual(a.state(), { prediction: null, registryStatus: 'PENDING' });
});
test('changed context refuses stale prediction', async () => {
  const b = fixture(), c = buildJraContext(b); b.runners[0].jockey = '別騎手';
  await assert.rejects(saveJraPrediction(memoryAdapter(b), identity, request(c)), /STALE_CONTEXT/);
});
test('save rejects existing prediction instead of overwrite', async () => {
  const a = memoryAdapter(fixture()), c = buildJraContext(fixture()); await saveJraPrediction(a, identity, request(c));
  await assert.rejects(saveJraPrediction(a, identity, request(c)), /PREDICTION_EXISTS/);
});
test('lease-independent JRA save repeats deadline check', async () => {
  const b = fixture(), c = buildJraContext(b); b.now = b.race.post_time;
  await assert.rejects(saveJraPrediction(memoryAdapter(b), identity, request(c)), /RACE_ALREADY_STARTED/);
});
test('LOCAL rejected before any adapter call', async () => {
  let calls = 0; const a = { readBundle: () => { calls++; }, transaction: () => { calls++; } };
  await assert.rejects(getJraContext(a, { ...identity, circuit: 'LOCAL' }), /JRA_ONLY/);
  await assert.rejects(saveJraPrediction(a, { ...identity, circuit: 'LOCAL' }, {}), /JRA_ONLY/); assert.equal(calls, 0);
});
test('PostgreSQL adapter rollback and release on failure', async () => {
  const commands = [], client = { query: async sql => { commands.push(sql); return { rows: [] }; }, release: () => commands.push('release') };
  const a = createJraRecoveryAdapter({ connect: async () => client });
  await assert.rejects(a.transaction(async () => { throw new Error('fail'); }), /fail/);
  assert.deepEqual(commands, ['BEGIN ISOLATION LEVEL REPEATABLE READ', "SET LOCAL statement_timeout = '15s'", "SET LOCAL lock_timeout = '5s'", 'ROLLBACK', 'release']);
});
test('PostgreSQL save uses JRA-only INSERT with SQL deadline and three-key uniqueness guard', async () => {
  const sqls = [], client = { query: async (sql, params) => { sqls.push({ sql, params }); return { rows: [{ id: 'id' }] }; }, release() {} };
  const a = createJraRecoveryAdapter({ connect: async () => client });
  await a.transaction(tx => tx.insertPrediction({ ...identity, protocol_version: JRA_PROTOCOL, payload: {} }));
  const { sql } = sqls.find(x => x.sql.includes('INSERT INTO'));
  assert.match(sql, /r\.circuit='JRA'/); assert.match(sql, /r\.post_time>clock_timestamp\(\)/);
  assert.match(sql, /p\.race_date=r\.race_date AND p\.track=r\.track AND p\.race_no=r\.race_no/);
  assert.doesNotMatch(sql, /UPSERT|DELETE|UPDATE|lab_.*prediction/i);
});
test('obstacle activity contributes only to interval, never flat ability history', () => {
  const b = fixture(); b.runners[0].history.unshift({ ...b.runners[0].history[0], race_date: '2026-10-01', race_type: '障害' });
  const r = buildJraContext(b).runners[0]; assert.equal(r.activity.days_since_activity, 2);
  assert.equal(r.activity.days_since_flat_ability, 8); assert.ok(r.history.every(h => h.race_date !== '2026-10-01'));
});
test('changed current carried weight is never borrowed from a historical run', () => {
  const b = fixture(); b.runners[0].weight_carried = null; const c = buildJraContext(b);
  assert.equal(c.runners[0].weight_carried, null); assert.ok(c.runners[0].missing.includes('weight_carried'));
  assert.ok(c.blockers.includes('FIELD_MISSING_POLICY_UNCONFIRMED'));
});
test('untrusted current race source rejected', () => {
  const b = fixture(); b.race.source = 'UNVERIFIED'; assert.throws(() => buildJraContext(b), /OFFICIAL_SOURCE_REQUIRED/);
});
test('DB-only all-race activity is separated from five flat runs', () => {
  const b = fixture(); b.runners[0].activity_history = [{ ...b.runners[0].history[0], race_date: '2026-10-01', source: 'DB_OFFICIAL' }];
  const r = buildJraContext(b).runners[0]; assert.equal(r.activity.days_since_activity, 2); assert.equal(r.history.length, 5);
});
test('card/current runner drift rejects the input', () => {
  const b = fixture(); b.race.field_payload.runners[0].weight_carried = 58;
  assert.throws(() => buildJraContext(b), /CARD_RUNNER_MISMATCH/);
});
