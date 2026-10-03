// Read-only supplementation after an existing claim. No ranking or DB writes.
import {historyBeforeRace} from './history-boundary.mjs';
export const RECENT_RUN_LIMIT = 5;
export const NAR_TRACK_CODES = {'門別':'36','帯広':'03','盛岡':'10','水沢':'11','浦和':'18','船橋':'19',
  '大井':'20','川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28','高知':'31','佐賀':'32'};
const attributes = ['sex_age', 'weight_carried', 'jockey'];
const optionalCurrentFields = ['draw','trainer','sire','damsire','body_weight','body_weight_diff','equipment'];
const conditionFields = ['surface','distance','going','weather','turn','class_name'];
const historicalFields = ['race_date','track','race_no','race_name','surface','distance',
  'going','finish','margin','time_raw','early_pos','final_turn_pos','final3f',
  'weight_carried','body_weight','jockey','trainer','horse_no','source_ref','horse_ref','source',
  'race_start_at','scheduled_start_at','result_confirmed_at','data_origin',
  'identity_source_ref','identity_verified_by'];
const officialSources = new Set(['NAR_OFFICIAL_DEBA','NAR_OFFICIAL_HISTORY','NAR_OFFICIAL_RESCUE','jra_public_reference']);
const present = v => v !== null && v !== undefined && String(v).trim() !== '';
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k,o[k]]));
const canonicalName = v => String(v ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();
const sameRace = (a,b) => ['race_date','track','race_no','circuit'].every(k => a[k] === b[k]);
const millis = v => Date.parse(v);
const key = r => JSON.stringify([r.race_date,r.track,r.race_no]);
export class ContextError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function assertLiveClaim({job,run,race}, now = Date.now()) {
  if (!sameRace(job,race) || race.circuit !== 'LOCAL') throw new ContextError('RACE_MISMATCH');
  if (run.status !== 'RUNNING' || job.job_status !== 'CLAIMED' ||
      job.worker_run_id !== run.id || job.claimed_by !== run.worker_id || !job.claim_token ||
      !Number.isInteger(job.attempts) || !Number.isInteger(job.max_attempts) ||
      job.attempts > job.max_attempts || !(millis(job.lease_until) > now))
    throw new ContextError('STALE_OR_EXPIRED_CLAIM');
  if (!(millis(race.post_time) > now + 180000)) throw new ContextError('PRE_RACE_DEADLINE');
  if (!['PENDING','RETRY'].includes(race.prediction_status)) throw new ContextError('RACE_NOT_PENDING');
}
// Aborts the underlying read and bounds its wait even if the adapter ignores abort.
async function boundedRead(fn, args, timeoutMs, deadline, now) {
  const ms = Math.min(timeoutMs, deadline - now());
  if (!(ms > 0)) throw new ContextError('SUPPLEMENTATION_BUDGET_EXHAUSTED');
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => fn(...args, controller.signal)),
      new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new ContextError('SOURCE_TIMEOUT'));
      }, ms); })
    ]);
  } finally { clearTimeout(timer); controller.abort(); }
}
function activeRunners(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 20) throw new ContextError('FIELD_STATUS_CONFLICT');
  const nos = new Set();
  for (const r of rows) {
    if (!Number.isInteger(r.horse_no) || r.horse_no < 1 || r.horse_no > 20 ||
        !canonicalName(r.horse_name) || nos.has(r.horse_no) ||
        !['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status)) throw new ContextError('FIELD_STATUS_CONFLICT');
    nos.add(r.horse_no);
  }
  return rows.filter(r => r.status === 'ACTIVE');
}
function verifiedSnapshot(s, race, now) {
  if (!s || !sameRace(s,race) || s.source !== 'NAR_OFFICIAL_DEBA' || s.truncated ||
      s.post_race || !Number.isFinite(millis(s.fetched_at)) || millis(s.fetched_at) > now ||
      now - millis(s.fetched_at) > 60000 || millis(s.fetched_at) >= millis(race.post_time) - 180000)
    throw new ContextError('OFFICIAL_FIELD_UNVERIFIED');
  let source;
  try { source = new URL(s.source_ref); } catch { throw new ContextError('OFFICIAL_FIELD_UNVERIFIED'); }
  if(source.origin!=='https://www.keiba.go.jp' || source.pathname!=='/KeibaWeb/TodayRaceInfo/DebaTable' ||
      source.searchParams.get('k_babaCode')!==NAR_TRACK_CODES[race.track] ||
      source.searchParams.get('k_raceDate')!==race.race_date.replaceAll('-','/') ||
      source.searchParams.get('k_raceNo')!==String(race.race_no))
    throw new ContextError('OFFICIAL_FIELD_UNVERIFIED');
  return activeRunners(s.runners);
}
function references(r) {
  return Array.isArray(r.identity_refs) ? r.identity_refs.filter(v => typeof v === 'string' && v.length < 512 &&
    (/^\/JRADB\/accessU\.html\?CNAME=[^\s#]+$/.test(v) ||
     /^https:\/\/www\.keiba\.go\.jp\/KeibaWeb(?:SP)?\/.+\?[^\s]*k_lineageLoginCode=/.test(v))) : [];
}
function historicalIdentityMatches(h, current, snapshot) {
  if (canonicalName(h.horse_name) !== canonicalName(current.horse_name)) return false;
  // Stable official cross-reference; name alone NEVER establishes identity.
  if (present(h.horse_ref) && references(current).includes(h.horse_ref)) return true;
  // NAR horse_runs has no stable horse id. An official, horse-specific history
  // witness must link this exact past race AND past horse number to the runner.
  return snapshot.history.some(w => w.horse_no === current.horse_no &&
    w.horse_ref && references(current).includes(w.horse_ref) && key(w) === key(h) &&
    w.past_horse_no === h.horse_no &&
    ['finish','time_raw','distance'].every(k=>!present(w[k]) || !present(h[k]) || String(w[k])===String(h[k])));
}
function safeHistory(rows, current, snapshot, race) {
  if (!Array.isArray(rows) || rows.length > RECENT_RUN_LIMIT) throw new ContextError('HISTORY_LIMIT_EXCEEDED');
  return rows.filter(h => {
    if (historicalFields.some(k => h[k] !== undefined && h[k] !== null &&
        (typeof h[k] !== 'string' && typeof h[k] !== 'number' || String(h[k]).length>1024)) ||
        !historyBeforeRace(h,race) ||
        !present(h.track) || !Number.isInteger(h.race_no) || !present(h.source_ref) ||
        !officialSources.has(h.source) || h.post_race_target || h.prediction_archive ||
        (h.source === 'jra_public_reference' && h.record_role !== 'full_runner'))
      return false;
    return historicalIdentityMatches(h,current,snapshot);
  }).map(h => {
    const witness=snapshot.history.find(w=>w.horse_no===current.horse_no && key(w)===key(h) &&
      w.past_horse_no===h.horse_no && references(current).includes(w.horse_ref));
    return {...pick(h,historicalFields),
      identity_verified_by:references(current).includes(h.horse_ref)?'OFFICIAL_HORSE_REF':'OFFICIAL_RACE_HORSE_NO',
      identity_source_ref:references(current).includes(h.horse_ref)?h.horse_ref:witness.source_ref};
  });
}
function latestFive(rows) {
  const unique = new Map();
  // Order of inputs is source priority; a second source cannot overwrite facts.
  for (const row of rows) if (!unique.has(key(row))) unique.set(key(row),row);
  return [...unique.values()].sort((a,b) => b.race_date.localeCompare(a.race_date) || b.race_no-a.race_no)
    .slice(0,RECENT_RUN_LIMIT);
}
export async function collectClaimedContext(state, {db, official, now = Date.now,
  timeoutMs = 5000, predictionReserveMs = 60000} = {}) {
  assertLiveClaim(state,now());
  if (!db || !official || !Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
      !Number.isFinite(predictionReserveMs) || predictionReserveMs < 0)
    throw new ContextError('INVALID_CONTEXT_OPTIONS');
  const {race,job,protocol} = state;
  if (!protocol?.version || protocol.protocol_key !== 'LOCAL_MAIN' || protocol.is_active !== true)
    throw new ContextError('ACTIVE_PROTOCOL_REQUIRED');
  const deadline = Math.min(millis(job.lease_until),millis(race.post_time)-180000) - predictionReserveMs;
  const audit = [];
  const read = async (stage, horseNo, fn, args) => {
    try {
      const data = await boundedRead(fn,args,timeoutMs,deadline,now);
      audit.push({stage,horse_no:horseNo,outcome:'READ_OK'}); return data;
    } catch (e) {
      audit.push({stage,horse_no:horseNo,outcome:'MISSING',reason:
        e instanceof ContextError ? e.code : 'SOURCE_READ_FAILED'});
      return null;
    }
  };
  const dbActive = activeRunners(race.field_payload?.runners);
  const candidates = new Map();
  const initialMissing = dbActive.map(r => ({horse_no:r.horse_no,
    items:attributes.filter(k => !present(r[k]))}));
  // Detect -> DB horse_runs -> DB official reference fallback. Reads have a
  // server-side LIMIT 5. Candidates are not evidence until identity is verified.
  for (const runner of dbActive) {
    const opts = {before:race.race_date,limit:RECENT_RUN_LIMIT};
    const horse = await read('DB_HORSE_RUNS',runner.horse_no,db.readHorseRuns,[runner,opts]);
    if (!Array.isArray(horse) || horse.length < RECENT_RUN_LIMIT)
      initialMissing.find(r=>r.horse_no===runner.horse_no).items.push(
        Array.isArray(horse)?'db_horse_runs:'+horse.length+'/5':'db_horse_runs_read_failed');
    const fallback = !Array.isArray(horse) || horse.length < RECENT_RUN_LIMIT
      ? await read('DB_OFFICIAL_HISTORY',runner.horse_no,db.readOfficialHistory,[runner,opts]) : [];
    candidates.set(runner.horse_no,{horse:horse ?? [],fallback:fallback ?? []});
  }
  // Required even with complete attributes: latest field integrity must be
  // established. This uses the existing NAR origin, never the refresh writer.
  const snapshot = await read('OFFICIAL_FIELD',null,official.readRace,[race,{limit:RECENT_RUN_LIMIT}]);
  if (!snapshot) throw new ContextError('OFFICIAL_FIELD_UNVERIFIED');
  const currentActive = verifiedSnapshot(snapshot,race,now());
  if (!Array.isArray(snapshot.history)) snapshot.history = [];
  if (snapshot.history.length > currentActive.length * RECENT_RUN_LIMIT)
    throw new ContextError('HISTORY_LIMIT_EXCEEDED');
  if (currentActive.length !== dbActive.length || currentActive.some(o => !dbActive.some(d =>
      d.horse_no === o.horse_no && canonicalName(d.horse_name) === canonicalName(o.horse_name))))
    throw new ContextError('FIELD_STATUS_CONFLICT');
  const runners = [];
  for (const runner of dbActive) {
    const current = currentActive.find(r => r.horse_no === runner.horse_no);
    // Current attrs ONLY from latest official card. Old race weights and DB
    // stale values cannot fill current nulls. No sex/age extrapolation.
    let candidate = candidates.get(runner.horse_no);
    let runs = latestFive([
      ...safeHistory(candidate.horse,current,snapshot,race),
      ...safeHistory(candidate.fallback,current,snapshot,race)
    ]);
    // After resolving official cross-references, narrow the DB query so a
    // same-name horse cannot occupy the bounded candidate list.
    if (runs.length < RECENT_RUN_LIMIT && references(current).length) {
      const more = await read('DB_OFFICIAL_IDENTITY',runner.horse_no,db.readOfficialHistory,
        [current,{before:race.race_date,limit:RECENT_RUN_LIMIT}]);
      if (more) runs = latestFive([...runs,...safeHistory(more,current,snapshot,race)]);
    }
    const cardHistory = snapshot.history.filter(h => h.horse_no === runner.horse_no)
      .map(h => ({...h,horse_no:h.past_horse_no}));
    runs = latestFive([...runs,...safeHistory(cardHistory,current,snapshot,race)]);
    // Only unresolved horses may make an additional horse-specific official read.
    if (runs.length < RECENT_RUN_LIMIT && typeof official.readHistory === 'function') {
      const more = await read('OFFICIAL_HISTORY',runner.horse_no,official.readHistory,
        [current,{before:race.race_date,limit:RECENT_RUN_LIMIT,race}]);
      if (more) {
        const verified=safeHistory(more,current,snapshot,race);
        // Only time-gated, horse-specific official facts become cross-source witnesses.
        const witnesses=verified.map(h=>({...h,horse_no:current.horse_no,past_horse_no:h.horse_no}));
        const witnessed={...snapshot,history:[...snapshot.history,...witnesses]};
        runs=latestFive([...runs,...safeHistory(candidate.horse,current,witnessed,race),
          ...safeHistory(candidate.fallback,current,witnessed,race),...verified]);
      }
    }
    const missing = attributes.filter(k => !present(current[k]));
    for(const k of optionalCurrentFields) if(!present(current[k])) missing.push(k);
    if (runs.length < RECENT_RUN_LIMIT) missing.push('recent_runs:'+runs.length+'/5');
    if (runs.length === 0) missing.push('verified_history');
    runners.push({horse_no:runner.horse_no,horse_name:runner.horse_name,
      ...Object.fromEntries(attributes.map(k => [k,present(current[k]) ? current[k] : null])),
      ...pick(current,optionalCurrentFields),
      identity_refs:references(current),recent_runs:runs,missing_items:missing,
      current_source_ref:snapshot.source_ref});
  }
  assertLiveClaim(state,now());
  return {claim:{job_id:job.id,run_id:state.run.id,claim_token:job.claim_token},
    race:{...pick(race,['race_date','track','race_no','circuit','post_time','race_name']),
      conditions:pick(snapshot.conditions ?? {},conditionFields)},
    missing_conditions:conditionFields.filter(k=>!present(snapshot.conditions?.[k])),
    protocol_version:protocol.version,runners,initial_missing:initialMissing,
    field_integrity_checked:true,supplementation_audit:audit,
    stage:'AWAITING_FULL_DEPTH_COMPARISON'};
}
// Semantic comparison is performed by the ChatGPT worker. This validates its
// explicit assessment; it does not turn field_complete/history-count into rank.
export function assessComparison(context, assessment) {
  const conditions=assessment?.condition_review;
  if(!conditions || conditions.major_unresolved!==false || !present(conditions.comparison_rationale) ||
      !Array.isArray(conditions.missing_items) || context.missing_conditions.some(k=>!conditions.missing_items.includes(k)))
    return {can_continue:false,reason:'RACE_CONDITIONS_NOT_ASSESSED'};
  if (assessment?.protocol_version !== context.protocol_version ||
      !Array.isArray(assessment.runner_reviews) || assessment.runner_reviews.length !== context.runners.length)
    return {can_continue:false,reason:'RUNNER_EVIDENCE_INCOMPLETE'};
  const seen = new Set();
  for (const runner of context.runners) {
    const review = assessment.runner_reviews.find(r => r.horse_no === runner.horse_no);
    if (!review || seen.has(review.horse_no) || !Array.isArray(review.evidence_facts) ||
        review.evidence_facts.length < 2 || review.evidence_facts.some(f => typeof f.statement !== 'string' || !present(f.statement) ||
          ![runner.current_source_ref,...runner.recent_runs.map(r=>r.source_ref)].includes(f.source_ref)) ||
        new Set(review.evidence_facts.map(f=>f.statement.trim())).size < 2 ||
        !Array.isArray(review.missing_items) || runner.missing_items.some(k => !review.missing_items.includes(k)) ||
        review.major_unresolved !== false || !present(review.comparison_rationale))
      return {can_continue:false,reason:'RUNNER_EVIDENCE_INCOMPLETE'};
    seen.add(review.horse_no);
  }
  if (assessment.full_depth_comparison_established !== true || assessment.eye_audit_established !== true)
    return {can_continue:false,reason:'FULL_DEPTH_COMPARISON_NOT_ESTABLISHED'};
  return {can_continue:true,reason:null};
}
