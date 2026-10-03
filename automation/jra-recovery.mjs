// JRA-only transport and safety boundary. No ability scoring or prediction generation.
import { createHash } from 'node:crypto';
import { canonical, validatePayload } from '../prediction-contract.mjs';

export const JRA_PROTOCOL = 'JRA_REBUILD_0.3_FLAT_HISTORY';
const keys = ['runners', 'top5', 'eye', 'bets', 'summary', 'bet_strategy', 'audit'];
const fail = code => { throw new Error(code); };
const timestamp = value => {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value)) fail('TIMESTAMP_REQUIRED');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail('INVALID_TIMESTAMP');
  return ms;
};
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
  && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const historyBefore = (value, bound, equal = false) => {
  try { return equal ? timestamp(value) <= timestamp(bound) : timestamp(value) < timestamp(bound); }
  catch { return false; }
};
const project = (value, names) => Object.fromEntries(names.filter(k => value[k] !== undefined).map(k => [k, value[k]]));
const runnerFields = ['horse_no', 'horse_name', 'horse_ref', 'draw', 'sex_age', 'weight_carried', 'jockey', 'trainer', 'body_weight', 'body_weight_diff', 'equipment'];
const historyFields = ['race_date', 'track', 'race_no', 'race_name', 'surface', 'distance', 'going', 'finish', 'field_size', 'final3f', 'early_pos', 'final_turn_pos', 'pos_change', 'weight_carried', 'jockey', 'time_raw', 'margin', 'margin_to_winner'];
const forbidden = /^(?:.*odds.*|.*popularity.*|.*market.*|.*人気.*|.*オッズ.*|lab_score|lab_mark|lab_grade|lab_eye|official_predictions|raw|html)$/i;
function forbidMarket(value) {
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (forbidden.test(k) && k !== 'market_used_for_ranking') fail('FORBIDDEN_INPUT');
    forbidMarket(v);
  }
}
export function assertJraIdentity(identity) {
  if (identity?.circuit !== 'JRA') fail('JRA_ONLY');
  if (!dateValid(identity.race_date) || typeof identity.track !== 'string' || !identity.track.trim()
    || !Number.isInteger(identity.race_no) || identity.race_no < 1 || identity.race_no > 12) fail('INVALID_RACE');
}
function assertRace(race, now) {
  assertJraIdentity(race);
  const current = timestamp(now);
  if (timestamp(race.post_time) <= current) fail('RACE_ALREADY_STARTED');
  if (new Date(timestamp(race.post_time) + 9 * 3600000).toISOString().slice(0, 10) !== race.race_date) fail('POST_DATE_MISMATCH');
  const meta = race.field_payload?.race;
  if (meta?.race_type !== '平地' || /障害/.test(race.race_name ?? '') || /障害/.test(meta?.surface ?? '')) fail('FLAT_ONLY');
  if (!['PENDING', 'RETRY'].includes(race.prediction_status)) fail('RACE_NOT_PENDING');
  if (race.field_status !== 'BASIC_READY') fail('FIELD_NOT_READY');
  if (race.source !== 'JRA_OFFICIAL') fail('OFFICIAL_SOURCE_REQUIRED');
  if (timestamp(race.field_fetched_at) > current) fail('FUTURE_FIELD');
}

// bundle must come from a trusted server adapter, never from the ChatGPT caller.
export function buildJraContext(bundle) {
  const { race, now, existing, runners } = bundle;
  assertRace(race, now);
  if (existing) fail('PREDICTION_EXISTS');
  const card = race.field_payload.runners;
  if (!Array.isArray(card) || !card.length || card.some(r => r.status !== 'ACTIVE')) fail('FIELD_STATUS_UNRESOLVED');
  if (card.length !== race.field_payload.race.field_size || runners.length !== card.length) fail('FIELD_MISMATCH');
  if (new Set(card.map(r => r.horse_no)).size !== card.length) fail('DUPLICATE_HORSE');
  const used = new Set();
  const output = card.map(horse => {
    const row = runners.find(r => r.horse_no === horse.horse_no);
    if (!row || !Number.isInteger(horse.horse_no) || horse.horse_no < 1 || used.has(row.horse_no)
      || row.horse_name !== horse.horse_name || !horse.horse_ref || row.horse_ref !== horse.horse_ref) fail('HORSE_IDENTITY_UNCONFIRMED');
    used.add(row.horse_no);
    if (runnerFields.some(k => Object.hasOwn(horse, k) && canonical(horse[k]) !== canonical(row[k]))) fail('CARD_RUNNER_MISMATCH');
    if (timestamp(row.source_checked_at) > timestamp(now)) fail('FUTURE_RUNNER');
    const missing = runnerFields.filter(k => row[k] === null || row[k] === undefined);
    const excluded = [];
    const eligible = (row.history ?? []).filter(h => {
      let reason = null;
      if (h.horse_ref !== row.horse_ref || h.horse_name !== row.horse_name) reason = 'IDENTITY';
      else if (!['DB_OFFICIAL', 'LIVE_OFFICIAL'].includes(h.source) || !h.source_ref) reason = 'SOURCE';
      else if (!dateValid(h.race_date) || h.race_date >= race.race_date) reason = 'DATE';
      else if (/障害/.test([h.race_type, h.race_name, h.race_class, h.race_class_detail, h.surface, h.raw].join(' '))) reason = 'OBSTACLE';
      else if (!['芝', 'ダート'].includes(h.surface)) reason = 'FLAT_UNCONFIRMED';
      else if (!historyBefore(h.source_checked_at, now, true)) reason = 'AVAILABILITY';
      else if (h.race_start_at && !historyBefore(h.race_start_at, race.post_time)) reason = 'START_TIME';
      if (reason) excluded.push({ reason });
      return !reason;
    }).sort((a, b) => b.race_date.localeCompare(a.race_date) || (a.source === 'LIVE_OFFICIAL' ? -1 : 1));
    // Conservatively one historical run per day; no guessed race/horse identities.
    const dates = new Set();
    const history = eligible.filter(h => !dates.has(h.race_date) && dates.add(h.race_date)).slice(0, 5).map(h => ({
      ...project(h, historyFields), source: h.source,
      identity_evidence: { horse_ref: row.horse_ref, source_ref: h.source_ref },
      source_checked_at: h.source_checked_at,
    }));
    if (!history.length) missing.push('flat_history');
    const activity = [...(row.history ?? []), ...(row.activity_history ?? [])].filter(h => h.horse_ref === row.horse_ref && h.horse_name === row.horse_name
      && ['DB_OFFICIAL', 'LIVE_OFFICIAL'].includes(h.source) && h.source_ref && dateValid(h.race_date)
      && h.race_date < race.race_date && historyBefore(h.source_checked_at, now, true)
      && (!h.race_start_at || historyBefore(h.race_start_at, race.post_time)))
      .map(h => h.race_date).sort().at(-1) ?? null;
    const days = date => date === null ? null : (Date.parse(race.race_date) - Date.parse(date)) / 86400000;
    return { ...project(row, runnerFields), history, missing, excluded_history: excluded,
      activity: { last_activity_date: activity, days_since_activity: days(activity),
        last_flat_date: history[0]?.race_date ?? null, days_since_flat_ability: days(history[0]?.race_date ?? null),
        coverage: 'AVAILABLE_EVIDENCE_ONLY' },
      identity_evidence: { horse_ref: row.horse_ref, method: 'EXACT_OFFICIAL_REF' } };
  });
  const blockers = [];
  if (output.every(r => !r.history.length)) blockers.push('ALL_HISTORY_ZERO_NO_FREEZE');
  // Five is an operational hold boundary, NOT a recovered 0.3 minimum-history rule.
  if (output.some(r => r.history.length < 5)) blockers.push('SPARSE_HISTORY_POLICY_UNCONFIRMED');
  if (output.some(r => r.missing.some(k => !['flat_history', 'body_weight', 'body_weight_diff', 'equipment'].includes(k)))) blockers.push('FIELD_MISSING_POLICY_UNCONFIRMED');
  const context = {
    protocol_version: JRA_PROTOCOL,
    race: { ...project(race, ['race_date', 'track', 'race_no', 'circuit', 'race_name', 'post_time']),
      ...project(race.field_payload.race, ['race_type', 'class_name', 'surface', 'distance', 'going', 'weather', 'turn', 'course_layout', 'field_size']) },
    runners: output, blockers,
    rules: { obstacle_excluded: true, market_used_for_ranking: false, history_limit: 5,
      same_day_history_excluded: true, sparse_history_policy: 'UNCONFIRMED_HOLD' },
  };
  forbidMarket(context);
  // Availability/version changes also invalidate this fingerprint.
  const fingerprint = createHash('sha256').update(canonical({ context, field_fetched_at: race.field_fetched_at,
    source_checks: runners.map(r => r.source_checked_at) })).digest('hex');
  return { ...context, as_of: now, fingerprint };
}

export function validateJraPrediction(context, protocol, payload) {
  if (protocol !== JRA_PROTOCOL || context.protocol_version !== JRA_PROTOCOL) fail('PROTOCOL_MISMATCH');
  assertJraIdentity(context.race);
  if (context.blockers.length) fail('CONTEXT_HELD:' + context.blockers.join(','));
  if (!payload || Array.isArray(payload) || Object.keys(payload).length !== 7 || keys.some(k => !Object.hasOwn(payload, k))) fail('SEVEN_KEYS_REQUIRED');
  forbidMarket(payload);
  validatePayload(payload, false, JRA_PROTOCOL);
  if (!Array.isArray(payload.bets) || payload.bets.length || payload.bet_strategy !== 'MARKET_SEPARATE') fail('MARKET_LAYER_SEPARATE');
  if (typeof payload.summary !== 'string' || !payload.summary.trim()) fail('SUMMARY_REQUIRED');
  const rows = payload.runners;
  if (rows.length !== context.runners.length || new Set(rows.map(r => r.rank)).size !== rows.length
    || rows.some(r => r.rank < 1 || r.rank > rows.length || !r.reason?.trim()
      || !context.runners.some(h => h.horse_no === r.horse_no && h.horse_name === r.horse_name))) fail('FULL_FIELD_REQUIRED');
  const expected = [...rows].sort((a, b) => a.rank - b.rank).slice(0, 5);
  if (payload.top5.length !== expected.length || payload.top5.some((r, i) => r.horse_no !== expected[i].horse_no
    || r.horse_name !== expected[i].horse_name || r.rank !== expected[i].rank)) fail('TOP5_MISMATCH');
  const outside = rows.filter(r => r.rank > 5);
  if (outside.length) {
    const eye = payload.eye;
    if (!eye || !outside.some(r => r.horse_no === eye.horse_no && r.horse_name === eye.horse_name)
      || (eye.rank !== undefined && eye.rank !== rows.find(r => r.horse_no === eye.horse_no).rank)) fail('EYE_OUTSIDE_TOP5_REQUIRED');
  } else if (payload.eye !== null) fail('NO_OUTSIDE_EYE');
  const audit = payload.audit;
  if (!audit || audit.protocol_version !== JRA_PROTOCOL || audit.market_used_for_ranking !== false
    || audit.obstacle_excluded !== true || audit.all_runners_checked !== true
    || audit.outside_top5_reaudited !== true || audit.context_fingerprint !== context.fingerprint) fail('AUDIT_REQUIRED');
  const checks = audit.outside_top5_audits;
  if (!Array.isArray(checks) || checks.length !== outside.length || new Set(checks.map(r => r.horse_no)).size !== checks.length
    || checks.some(r => !outside.some(h => h.horse_no === r.horse_no) || typeof r.reason !== 'string' || !r.reason.trim())) fail('OUTSIDE_REAUDIT_REQUIRED');
  return payload; // Never rewrite ChatGPT ranks/TOP5/EYE/payload.
}

export async function getJraContext(adapter, identity) {
  assertJraIdentity(identity);
  return buildJraContext(await adapter.readBundle(identity));
}

export async function saveJraPrediction(adapter, identity, { protocol_version, context_fingerprint, payload }) {
  assertJraIdentity(identity);
  // Adapter contract: dedicated DB transaction, rollback on any throw, commit after SELECT verification.
  return adapter.transaction(async tx => {
    const context = buildJraContext(await tx.readBundle(identity, { lock: true }));
    if (context.fingerprint !== context_fingerprint) fail('STALE_CONTEXT');
    validateJraPrediction(context, protocol_version, payload);
    const inserted = await tx.insertPrediction({ ...context.race, protocol_version: JRA_PROTOCOL,
      status: 'FROZEN', source: 'CHATGPT', model_label: 'GPT-5.6 Sol', payload });
    const saved = await tx.readPrediction(inserted.id);
    if (!saved || saved.circuit !== 'JRA' || saved.race_date !== identity.race_date || saved.track !== identity.track
      || saved.race_no !== identity.race_no || saved.model_label !== 'GPT-5.6 Sol' || saved.source !== 'CHATGPT'
      || saved.protocol_version !== JRA_PROTOCOL || saved.status !== 'FROZEN'
      || canonical(saved.payload) !== canonical(payload)) fail('SAVE_VERIFICATION_FAILED');
    validateJraPrediction(context, saved.protocol_version, saved.payload);
    return { saved: true, prediction: saved };
  });
}
