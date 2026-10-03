import {ContextError} from '../../../automation/local-worker-data.mjs';

// This is a value snapshot of the existing LOCAL input contract, not a score.
// The allowlists match local-worker-data.mjs and handler.mjs. Unrelated payload
// fields (odds/popularity/results/fetch metadata) never enter the comparison.
const raceKeys = ['race_date', 'track', 'race_no', 'circuit', 'post_time', 'race_name'];
const runnerKeys = ['horse_no', 'horse_name', 'status', 'sex_age', 'weight_carried',
  'jockey', 'draw', 'trainer', 'sire', 'damsire', 'body_weight', 'body_weight_diff', 'equipment'];
const conditionKeys = ['surface', 'distance', 'going', 'weather', 'turn', 'class_name'];
const pick = (object, keys) => Object.fromEntries(keys
  .filter(key => Object.hasOwn(object, key) && object[key] !== undefined)
  .map(key => [key, object[key]]));
function pickScalars(object, keys) {
  const selected = pick(object, keys);
  if (Object.values(selected).some(value => value !== null &&
    !['string', 'number', 'boolean'].includes(typeof value)))
    throw new ContextError('INVALID_CONTEXT_SNAPSHOT');
  return selected;
}

// JSON object key order is not meaningful; array order remains meaningful unless
// the contract below explicitly identifies a set (runners and identity_refs).
function canonical(value, depth = 0) {
  if (depth > 40) throw new ContextError('INVALID_CONTEXT_SNAPSHOT');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  if (typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
  }
  throw new ContextError('INVALID_CONTEXT_SNAPSHOT');
}

export function localContextSnapshot({race, protocol}) {
  if (race?.circuit !== 'LOCAL') throw new ContextError('RACE_MISMATCH');
  if (protocol?.protocol_key !== 'LOCAL_MAIN' || protocol.is_active !== true || !protocol.version)
    throw new ContextError('ACTIVE_PROTOCOL_REQUIRED');
  const rows = race.field_payload?.runners;
  if (!Array.isArray(rows) || !rows.length || rows.length > 20)
    throw new ContextError('FIELD_STATUS_CONFLICT');
  const seen = new Set();
  const runners = rows.map(row => {
    if (!row || !Number.isInteger(row.horse_no) || row.horse_no < 1 || row.horse_no > 20 ||
      seen.has(row.horse_no) || !String(row.horse_name ?? '').trim() ||
      !['ACTIVE', 'CANCELLED', 'EXCLUDED'].includes(row.status))
      throw new ContextError('FIELD_STATUS_CONFLICT');
    seen.add(row.horse_no);
    const runner = pickScalars(row, runnerKeys);
    if (row.identity_refs !== undefined) {
      if (!Array.isArray(row.identity_refs) || row.identity_refs.some(ref => typeof ref !== 'string'))
        throw new ContextError('INVALID_CONTEXT_SNAPSHOT');
      // Existing same-horse verification treats these references as membership.
      runner.identity_refs = [...new Set(row.identity_refs)].sort();
    }
    return runner;
  }).sort((left, right) => left.horse_no - right.horse_no);
  const conditions = race.field_payload?.conditions ?? {};
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions))
    throw new ContextError('INVALID_CONTEXT_SNAPSHOT');
  return canonical({
    race: pickScalars(race, raceKeys),
    field: {runners, conditions: pickScalars(conditions, conditionKeys)},
    protocol: pick(protocol, ['protocol_key', 'version', 'is_active', 'content']),
  });
}
