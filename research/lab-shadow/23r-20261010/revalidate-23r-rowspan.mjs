import { readFile, writeFile } from 'node:fs/promises';

export const REQUIRED_RUN_FIELDS = Object.freeze([
  'race_date','race_no','distance_m','going','finish','time',
  'passing_order','final3f','jockey','weight_kg','official_url',
]);

const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const raceKey = race => `${race.track}${race.race_no}R`;

export function normalizeRun(run, profileUrl) {
  const performance = run?.evidence?.performance ?? '';
  const passing = performance.match(/\b\d{1,2}(?:-\d{1,2}){1,3}\b/)?.[0] ?? run.passing_order ?? null;
  return {
    ...run,
    passing_order: passing,
    // A profile URL proves horse identity and the displayed card row, but is not
    // substituted for a missing race-detail URL or race number.
    identity_evidence_url: profileUrl,
    detail_evidence_status: run.official_url ? 'NAR_RACE_DETAIL_LINKED' : 'DETAIL_LINK_UNAVAILABLE',
  };
}

export function auditRace(race) {
  const active = race.runners.filter(runner => runner.status === 'ACTIVE');
  const runnerAudits = active.map(runner => {
    const runs = runner.recent_card_slots
      .map(run => normalizeRun(run, runner.profile_url))
      .filter(run => Number.isInteger(run.finish) && run.finish > 0)
      .slice(0, 5);
    const missing = Object.fromEntries(REQUIRED_RUN_FIELDS.map(field => [
      field,
      runs.reduce((count, run) => count + (present(run[field]) ? 0 : 1), 0),
    ]).filter(([, count]) => count));
    const historyReady = runs.length === 5 && Object.keys(missing).length === 0;
    return {
      horse_no: runner.horse_no,
      horse_name: runner.horse_name,
      nar_lineage_id: runner.nar_lineage_id,
      profile_url: runner.profile_url,
      completed_run_count: runs.length,
      history_status: historyReady ? 'READY' : 'DATA_INCOMPLETE',
      missing,
      runs,
    };
  });
  const weatherReady = present(race.conditions.weather) && present(race.conditions.going);
  const baseConditionsReady = ['surface','distance_m','turn','class_name'].every(k => present(race.conditions[k]));
  const allHistoryReady = runnerAudits.every(runner => runner.history_status === 'READY');
  const blockers = [];
  if (!allHistoryReady) blockers.push('RUNNER_HISTORY_FACT_GATE');
  if (!baseConditionsReady) blockers.push('TARGET_CONDITION_MISSING');
  if (!weatherReady) blockers.push('TARGET_WEATHER_OR_GOING_UNPUBLISHED');
  return {
    key: raceKey(race), track: race.track, race_no: race.race_no,
    scheduled_start: race.scheduled_start, official_url: race.official_url,
    captured_at: race.captured_at, active_runner_count: active.length,
    history_ready_runners: runnerAudits.filter(x => x.history_status === 'READY').length,
    history_incomplete_runners: runnerAudits.filter(x => x.history_status !== 'READY').length,
    verified_completed_runs: runnerAudits.reduce((n, x) => n + x.runs.length, 0),
    required_runs: active.length * 5,
    conditions: race.conditions,
    status: blockers.length ? 'BLOCKED' : 'READY', blockers,
    runners: runnerAudits,
  };
}

export function auditDay(raw) {
  if (raw.races.length !== 23) throw new Error(`TARGET_RACE_COUNT_MISMATCH:${raw.races.length}`);
  if (raw.races.some(race => race.track === '帯広ば')) throw new Error('EXCLUDED_TRACK_PRESENT:帯広ば');
  const races = raw.races.map(auditRace).sort((a,b) => a.track.localeCompare(b.track,'ja') || a.race_no-b.race_no);
  const byTrack = Object.fromEntries(['高知','佐賀'].map(track => {
    const rows = races.filter(r => r.track === track);
    return [track, {
      target_races: rows.length,
      evidence_captured: rows.filter(r => r.official_url).length,
      ready: rows.filter(r => r.status === 'READY').length,
      blocked: rows.filter(r => r.status === 'BLOCKED').length,
      active_runners: rows.reduce((n,r) => n+r.active_runner_count,0),
      required_runs: rows.reduce((n,r) => n+r.required_runs,0),
      completed_runs_observed: rows.reduce((n,r) => n+r.verified_completed_runs,0),
      fact_complete_runners: rows.reduce((n,r) => n+r.history_ready_runners,0),
    }];
  }));
  return {
    schema:'LAB_SHADOW_23R_REAUDIT_V1', generated_at:new Date().toISOString(),
    target_date:'2026-10-10', target_tracks:['高知','佐賀'], excluded_tracks:['帯広ば'],
    read_only:true, production_mutations:[], model_calls:0,
    parser_fix:'DOM-owned five-column extraction per horse row group; accepts 2-4 passing-order positions; never substitutes profile evidence for missing race detail identifiers.',
    saga11_existing_audit_preserved:true,
    totals:{
      target_races:races.length,
      evidence_captured:races.filter(r=>r.official_url).length,
      ready:races.filter(r=>r.status==='READY').length,
      blocked:races.filter(r=>r.status==='BLOCKED').length,
      active_runners:races.reduce((n,r)=>n+r.active_runner_count,0),
      required_runs:races.reduce((n,r)=>n+r.required_runs,0),
      completed_runs_observed:races.reduce((n,r)=>n+r.verified_completed_runs,0),
      fact_complete_runners:races.reduce((n,r)=>n+r.history_ready_runners,0),
    },
    by_track:byTrack, races,
    short_career_existing_behavior:{
      rule:'Existing shadow boundary requires exactly five recent runs and every required fact.',
      under_five:'DATA_INCOMPLETE/BLOCKED; no padding, no degraded score, evaluator not invoked.',
      specification_changed:false,
      evidence_files:['temporary-official-supplement.mjs','shadow-rank-boundary.mjs','multi-race-shadow-audit.mjs','short-history-reaudit.mjs'],
    },
  };
}

export async function run({rawPath, jsonPath, csvPath, reportPath}) {
  const raw = JSON.parse(await readFile(rawPath,'utf8'));
  const out = auditDay(raw);
  await writeFile(jsonPath, JSON.stringify(out,null,2)+'\n');
  const q=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const header=['track','race_no','scheduled_start','active_runners','history_ready_runners','history_incomplete_runners','completed_runs_observed','required_runs','weather','going','status','blockers','official_url','captured_at'];
  const csv=[header.join(','),...out.races.map(r=>[
    r.track,r.race_no,r.scheduled_start,r.active_runner_count,r.history_ready_runners,r.history_incomplete_runners,
    r.verified_completed_runs,r.required_runs,r.conditions.weather,r.conditions.going,r.status,r.blockers.join('|'),r.official_url,r.captured_at,
  ].map(q).join(','))].join('\n')+'\n';
  await writeFile(csvPath,csv);
  const rows=out.races.map(r=>`| ${r.track}${r.race_no}R | ${r.active_runner_count} | ${r.history_ready_runners}/${r.active_runner_count} | ${r.verified_completed_runs}/${r.required_runs} | ${r.status} | ${r.blockers.join(', ')} |`).join('\n');
  const report=`# LAB SHADOW 23レース再監査（2026-10-10）\n\n`+
    `対象は高知11R＋佐賀12R。帯広ばはユーザー指定により対象外。読み取り専用で、本番変更・モデル呼び出しは0件。\n\n`+
    `## 集計\n\n| 場 | 対象 | 証跡保持 | READY | BLOCKED | ACTIVE | 完走履歴表示 | 事実完全馬 |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`+
    Object.entries(out.by_track).map(([k,v])=>`| ${k} | ${v.target_races} | ${v.evidence_captured} | ${v.ready} | ${v.blocked} | ${v.active_runners} | ${v.completed_runs_observed}/${v.required_runs} | ${v.fact_complete_runners}/${v.active_runners} |`).join('\n')+
    `\n\n## レース別\n\n| レース | ACTIVE | 履歴事実PASS | 完走履歴 | 判定 | 主因 |\n|---|---:|---:|---:|---|---|\n${rows}\n\n`+
    `## 既存仕様確認\n\nキャリア5戦未満は既存境界でDATA_INCOMPLETE/BLOCKED。存在しない履歴を補完せず、5走未満向けの別採点や代替スコアも作成していない。\n`;
  await writeFile(reportPath,report);
  return out;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const base=new URL('./2026-10-10-23r/',import.meta.url);
  const out=await run({
    rawPath:new URL('LAB_SHADOW_23R_RAW_2026-10-10.json',base),
    jsonPath:new URL('LAB_SHADOW_23R_REAUDIT_2026-10-10.json',base),
    csvPath:new URL('LAB_SHADOW_23R_REAUDIT_2026-10-10.csv',base),
    reportPath:new URL('LAB_SHADOW_23R_REAUDIT_REPORT_2026-10-10.md',base),
  });
  console.log(JSON.stringify(out.totals));
}
