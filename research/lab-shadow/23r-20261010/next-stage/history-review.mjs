// Offline, read-only analysis. No scoring, fetch, model, database or file writes.
import {REQUIRED_RUN_FIELDS, auditDay} from '../revalidate-23r-rowspan.mjs';

const present = v => v !== null && v !== undefined && String(v).trim() !== '';
const complete = r => Number.isInteger(r?.finish) && r.finish > 0;
const positive = v => Number.isInteger(v) && v > 0;
const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const timestamp = v => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));

function prohibitedKeys(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => /(^|_)(odds?|popularity|market|target_result|target_finish|predicted_market)($|_)|人気|オッズ/.test(key) && !['market_fields_excluded','target_result_excluded'].includes(key) || prohibitedKeys(child));
}

export function assertTargetSet(raw) {
  if (!Array.isArray(raw?.races) || raw.races.length !== 23) throw Error('TARGET_RACE_COUNT_MISMATCH');
  const expected = new Set(['高知','佐賀'].flatMap(track => Array.from({length:track === '高知' ? 11 : 12}, (_,i) => `${track}/${i+1}`)));
  for (const race of raw.races) {
    if (race?.race_date !== '2026-10-10' || !positive(race.race_no) || !expected.delete(`${race.track}/${race.race_no}`)) throw Error('TARGET_SET_MISMATCH');
    if (!Array.isArray(race.runners)) throw Error('RUNNERS_INVALID');
  }
  if (expected.size) throw Error('TARGET_SET_MISMATCH');
}

// Extract only the entire known performance cell. A date substring is never passing order.
// Evidence remains an extracted string, not independent official verification.
export function parsePassingOrder(run) {
  const performance = run?.evidence?.performance;
  const match = typeof performance === 'string' && performance.trim().match(/^(?:\d+:)?\d{1,2}\.\d\s+(\d{1,2}(?:-\d{1,2}){1,3})\s+\d{1,2}\.\d$/);
  const extracted = match ? match[1] : null;
  const supplied = present(run?.passing_order) ? run.passing_order : null;
  const valid = v => typeof v === 'string' && /^\d{1,2}(?:-\d{1,2}){1,3}$/.test(v) && v.split('-').every(n => Number(n) > 0 && Number(n) <= 20);
  if (supplied !== null && !valid(supplied)) return {value:null, issue:'PASSING_ORDER_INVALID'};
  if (extracted !== null && !valid(extracted)) return {value:null, issue:'PASSING_ORDER_INVALID'};
  if (supplied !== null && extracted !== null && supplied !== extracted) return {value:null, issue:'PASSING_ORDER_CONFLICT'};
  return {value:extracted ?? supplied, issue:extracted || supplied ? null : 'PASSING_ORDER_MISSING'};
}

function officialDetailMatches(run) {
  if (!positive(run.race_no) || !validDate(run.race_date)) return false;
  // JRA references need observed official horse/race witnesses; never synthesize CNAME.
  if ((run.track ?? '').startsWith('Ｊ')) return false;
  const codes = {'門別':'36','盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28','高知':'31','佐賀':'32'};
  try {
    const u = new URL(run.official_url);
    return u.origin === 'https://www.keiba.go.jp' && !u.username && !u.password && !u.hash && u.pathname === '/KeibaWeb/TodayRaceInfo/RaceMarkTable'
      && ['k_babaCode','k_raceDate','k_raceNo'].every(k => u.searchParams.getAll(k).length === 1)
      && [...u.searchParams.keys()].every(k => ['k_babaCode','k_raceDate','k_raceNo'].includes(k))
      && u.searchParams.get('k_babaCode') === codes[run.track]
      && u.searchParams.get('k_raceNo') === String(run.race_no)
      && u.searchParams.get('k_raceDate') === run.race_date.replaceAll('-','/');
  } catch { return false; }
}

export function assessRaceStrict(race) {
  const blockers = new Set(['OFFICIAL_HTML_ORIGINAL_UNAVAILABLE', 'LATEST_FIELD_NOT_REVERIFIED']);
  if (prohibitedKeys(race)) blockers.add('PROHIBITED_DATA_KEY');
  const before = t => timestamp(t) && timestamp(race.scheduled_start) && Date.parse(t) < Date.parse(race.scheduled_start);
  if (!validDate(race.race_date) || !timestamp(race.scheduled_start) || new Date(Date.parse(race.scheduled_start)+9*3600000).toISOString().slice(0,10) !== race.race_date || !before(race.captured_at)) blockers.add('PRE_RACE_TIMING_UNVERIFIED');
  try {
    const u = new URL(race.official_url);
    if (u.origin !== 'https://www.keiba.go.jp' || u.pathname !== '/KeibaWeb/TodayRaceInfo/DebaTable' || u.username || u.password || u.hash ||
        ['k_babaCode','k_raceDate','k_raceNo'].some(k => u.searchParams.getAll(k).length !== 1) ||
        [...u.searchParams.keys()].some(k => !['k_babaCode','k_raceDate','k_raceNo'].includes(k)) ||
        u.searchParams.get('k_babaCode') !== ({高知:'31',佐賀:'32'})[race.track] || u.searchParams.get('k_raceDate') !== race.race_date.replaceAll('-','/') || u.searchParams.get('k_raceNo') !== String(race.race_no)) blockers.add('OFFICIAL_TARGET_URL_MISMATCH');
  } catch { blockers.add('OFFICIAL_TARGET_URL_MISMATCH'); }
  for (const key of ['surface','distance_m','turn','class_name','going','weather']) if (!present(race.conditions?.[key])) blockers.add(`TARGET_${key.toUpperCase()}_MISSING`);
  if (!positive(race.conditions?.distance_m)) blockers.add('TARGET_DISTANCE_INVALID');
  const nos = new Set(), ids = new Set();
  const runners = Array.isArray(race.runners) ? race.runners : [];
  if (!runners.some(r => r?.status === 'ACTIVE')) blockers.add('ACTIVE_FIELD_EMPTY');
  for (const runner of runners) {
    if (!runner || !positive(runner.horse_no) || runner.horse_no > 20 || !present(runner.horse_name) || nos.has(runner.horse_no) || !/^\d+$/.test(runner.nar_lineage_id ?? '') || ids.has(runner.nar_lineage_id) || runner.profile_url !== `https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=${runner.nar_lineage_id}`) blockers.add('HORSE_IDENTITY_UNVERIFIED');
    nos.add(runner?.horse_no); ids.add(runner?.nar_lineage_id);
    if (!['ACTIVE','CANCELLED','EXCLUDED'].includes(runner?.status)) blockers.add('FIELD_STATUS_UNVERIFIED');
    if (runner?.status !== 'ACTIVE') continue;
    const slots = runner.recent_card_slots;
    if (!Array.isArray(slots) || slots.length !== 5) { blockers.add('CARD_SLOT_LAYOUT_UNVERIFIED'); continue; }
    const runs = slots.filter(complete);
    if (runs.length < 5) blockers.add('FIVE_COMPLETED_RUNS_UNPROVEN');
    const seen = new Set();
    for (const run of runs) {
      const passing = parsePassingOrder(run);
      if (passing.issue) blockers.add(passing.issue);
      if (REQUIRED_RUN_FIELDS.some(k => !present(k === 'passing_order' ? passing.value : run[k]))) blockers.add('HISTORY_REQUIRED_FACT_MISSING');
      if (!validDate(run.race_date) || run.race_date >= race.race_date) blockers.add('HISTORY_NOT_PROVEN_PRIOR');
      if (!positive(run.distance_m) || !positive(run.race_no)) blockers.add('HISTORY_FACT_TYPE_INVALID');
      if (!officialDetailMatches(run)) blockers.add('HISTORY_DETAIL_IDENTITY_UNVERIFIED');
      const key = JSON.stringify([run.race_date,run.track,run.race_no]);
      if (seen.has(key)) blockers.add('HISTORY_DUPLICATE');
      seen.add(key);
    }
  }
  // Independent provenance and current-field verification are unavailable in this handoff.
  return {track:race.track, race_no:race.race_no, status:'BLOCKED', blockers:[...blockers]};
}

export function analyzePackage(raw) {
  assertTargetSet(raw);
  const previous = auditDay(raw); // reproduces the original 58-runner gate, not official verification
  const incomplete = [], short = [], jra = [];
  for (const race of raw.races) for (const runner of race.runners) {
    if (runner.status !== 'ACTIVE') continue;
    const identity = {track:race.track,race_no:race.race_no,horse_no:runner.horse_no,horse_name:runner.horse_name,nar_lineage_id:runner.nar_lineage_id};
    const old = previous.races.find(r => r.track === race.track && r.race_no === race.race_no).runners.find(r => r.horse_no === runner.horse_no);
    if (old.history_status !== 'READY') {
      const missingIds = !!(old.missing.race_no || old.missing.official_url);
      incomplete.push({...identity,group:old.completed_run_count < 5 ? (missingIds ? 'SHORT_AND_DETAIL_IDENTIFIERS' : 'SHORT_ONLY') : 'DETAIL_IDENTIFIERS_ONLY', completed_runs:old.completed_run_count,missing:old.missing});
    }
    const runs = runner.recent_card_slots.filter(complete);
    if (runs.length < 5) {
      const nonCompleted = runner.recent_card_slots.filter(r => !complete(r));
      const described = nonCompleted.filter(r => present(r.race_date));
      short.push({...identity, completed_runs:runs.length,profile_url:runner.profile_url,
        category:described.length ? 'NON_COMPLETED_SLOT_REQUIRES_OLDER_HISTORY' : 'BLANK_SLOT_CAREER_UNCONFIRMED',
        non_completed_evidence:nonCompleted.map(r => ({race_date:r.race_date,meta:r.evidence?.meta ?? ''})),
        actual_career_under_five:'UNVERIFIED', older_fifth_completed_run:'UNVERIFIED'});
    }
    runner.recent_card_slots.forEach((run, slot_index) => {
      if (!(run.track ?? '').startsWith('Ｊ')) return;
      jra.push({...identity,slot_index,history:{race_date:run.race_date,track:run.track,race_name:run.race_name,surface:run.surface,distance_m:run.distance_m,finish:run.finish,time:run.time,passing_order:parsePassingOrder(run).value,final3f:run.final3f,jockey:run.jockey,weight_kg:run.weight_kg,race_no:run.race_no,official_url:run.official_url},status:'UNVERIFIED',reason:'OFFICIAL_PROFILE_CROSSWALK_AND_RESULT_HTML_NOT_AVAILABLE'});
    });
  }
  const count = (rows,key) => rows.reduce((out,row) => (out[row[key]]=(out[row[key]] ?? 0)+1,out),{});
  const decisions = raw.races.map(assessRaceStrict);
  return {schema:'LAB_SHADOW_HISTORY_REVIEW_V1',target_date:'2026-10-10',
    counts:{races:23,active_runners:previous.totals.active_runners,incomplete_runners:incomplete.length,groups:count(incomplete,'group'),short_runners:short.length,short_groups:count(short,'category'),jra_occurrences:jra.length,jra_verified:0,jra_unverified:jra.length,ready:0,blocked:23},
    incomplete_runners:incomplete,short_history_runners:short,jra_history_occurrences:jra,decisions,
    limitation:'Extracted strings and URLs are retained; official original HTML and historical as-of current-field verification are absent. No fields were supplemented; no official matching completed.'};
}
