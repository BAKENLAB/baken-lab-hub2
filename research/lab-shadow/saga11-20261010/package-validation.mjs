// Offline handoff validation only. No fetch, model, database or filesystem I/O.
// Official statements in the supplied JSON are claims, not independently verified evidence.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const positive = v => Number.isInteger(v) && v > 0;
const timestamp = v => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const text = v => typeof v === 'string' && v.trim().length > 0;
const market = /(^|_)(odds?|popularity|market|predicted_market)($|_)|人気|オッズ|単勝|市場/i;

function contamination(v, errors, path = 'root') {
  if (!v || typeof v !== 'object') return;
  for (const [key, child] of Object.entries(v)) {
    // These keys are explicit negative declarations in the supplied safety metadata.
    if (path === 'root.safety' && ['market_or_odds_included', 'target_result_included', 'future_information_included'].includes(key) && child === false) continue;
    if (market.test(key) || /^(target_result|target_finish|future_information)$/.test(key)) errors.push(`CONTAMINATION:${path}.${key}`);
    contamination(child, errors, `${path}.${key}`);
  }
}

export function inspectPackage(data) {
  const errors = [];
  if (!object(data)) return {ok:false, errors:['PACKAGE_INVALID'], status:'BLOCKED', blockers:['PACKAGE_INVALID']};
  contamination(data, errors);
  if (data.schema_version !== 'lab-shadow-prerace-proof-v2-race-no-audited') errors.push('SCHEMA_UNSUPPORTED');
  const race = data.race ?? {};
  if (!['高知', '佐賀'].includes(race.track) || !positive(race.race_no) || race.race_no > (race.track === '高知' ? 11 : 12)) errors.push('TARGET_UNSUPPORTED');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(race.race_date ?? '') || !timestamp(race.post_time) || !race.post_time.startsWith(race.race_date)) errors.push('POST_TIME_INVALID');
  const before = t => timestamp(t) && timestamp(race.post_time) && Date.parse(t) < Date.parse(race.post_time);
  if (!before(data.timing?.data_fetched_at)) errors.push('CAPTURE_NOT_PRE_RACE');
  let url;
  try { url = new URL(race.official_url); } catch {}
  if (!url || url.origin !== 'https://www.keiba.go.jp' || url.pathname !== '/KeibaWeb/TodayRaceInfo/DebaTable' || url.searchParams.get('k_babaCode') !== (race.track === '佐賀' ? '32' : '31') || url.searchParams.get('k_raceNo') !== String(race.race_no) || url.searchParams.get('k_raceDate') !== race.race_date?.replaceAll('-', '/')) errors.push('OFFICIAL_URL_INVALID');
  const runners = Array.isArray(data.runners) ? data.runners : [];
  if (!runners.length) errors.push('FIELD_EMPTY');
  const horseNos = new Set(), ids = new Set();
  let historyRows = 0;
  for (const r of runners) {
    if (!object(r)) { errors.push('RUNNER_INVALID'); continue; }
    if (!positive(r.horse_no) || horseNos.has(r.horse_no) || !text(r.horse_name) || !/^\d+$/.test(r.lineage_id ?? '') || ids.has(r.lineage_id)) errors.push('FIELD_IDENTITY_INVALID');
    horseNos.add(r.horse_no); ids.add(r.lineage_id);
    if (!['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status)) errors.push('FIELD_STATUS_INVALID');
    if (!before(r.fetched_at)) errors.push('RUNNER_CAPTURE_NOT_PRE_RACE');
    const runs = Array.isArray(r.recent_card_entries) ? r.recent_card_entries : [];
    if (r.status === 'ACTIVE' && runs.length !== 5) errors.push('ACTIVE_FIVE_PRIOR_RUNS_UNPROVEN');
    const seen = new Set();
    for (const run of runs) {
      historyRows++;
      if (!object(run)) { errors.push('HISTORY_INVALID'); continue; }
      const key = `${run.race_date}/${run.track}/${run.race_no}`;
      if (seen.has(key)) errors.push('HISTORY_DUPLICATE');
      seen.add(key);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(run.race_date ?? '') || run.race_date >= race.race_date || run.available_before_target !== true) errors.push('HISTORY_NOT_PROVEN_PRIOR');
      if (!positive(run.race_no) || !text(run.track) || !positive(run.distance) || !positive(run.finish) || !text(run.passing_order) || !text(run.time) || !text(run.final3f) || !text(run.going)) errors.push('HISTORY_FIELDS_INVALID');
      const expected = `https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=${r.lineage_id}`;
      if (r.profile_url !== expected || run.race_no_evidence?.source_ref !== expected || run.race_no_evidence?.source !== 'NAR_OFFICIAL_HORSE_PROFILE' || !before(run.race_no_evidence?.fetched_at)) errors.push('HISTORY_WITNESS_INVALID');
    }
  }
  const active = runners.filter(r => r?.status === 'ACTIVE').map(r => r.horse_no).sort((a,b) => a-b);
  if (!active.length) errors.push('NO_ACTIVE_RUNNERS');
  if (JSON.stringify(active) !== JSON.stringify(data.field?.active_runner_nos) || data.field?.runner_count !== runners.length) errors.push('FIELD_COUNTS_CONFLICT');
  if (data.counts?.runners !== runners.length || data.counts?.card_entries !== historyRows || data.race_no_audit?.verified_count !== historyRows) errors.push('HISTORY_COUNTS_CONFLICT');
  for (const k of ['market_or_odds_included','target_result_included','future_information_included','model_called']) if (data.safety?.[k] !== false) errors.push(`SAFETY_DECLARATION_INVALID:${k}`);
  if (data.safety?.production_writes !== 0) errors.push('PRODUCTION_WRITE_DECLARATION_INVALID');
  const blockers = [...errors];
  for (const k of ['surface','distance','turn','class_name','going','weather']) if (!text(race.conditions?.[k]) && !(k === 'distance' && positive(race.conditions?.distance))) blockers.push(`TARGET_${k.toUpperCase()}_MISSING`);
  // The package contains URLs and timestamps but no raw official HTML/profile witnesses.
  // This offline function must never turn self-reported provenance into READY.
  blockers.push('OFFICIAL_RAW_EVIDENCE_NOT_INCLUDED', 'LATEST_FIELD_NOT_RECHECKED');
  return {ok:errors.length === 0, errors:[...new Set(errors)], status:'BLOCKED', reported_status:data.status, blockers:[...new Set(blockers)], runner_count:runners.length, history_rows:historyRows};
}
