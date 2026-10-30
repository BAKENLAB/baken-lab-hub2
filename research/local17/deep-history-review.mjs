/**
 * LOCAL 1.7 shadow research only: alert on verified older same-condition form.
 * Pure, read-only and intentionally incapable of rescoring or changing a pick.
 * The caller must bind archived runs to a race-day runner by an independently
 * verified identity; matching a horse name alone is not sufficient.
 */
const DAY_MS = 86400000;
const day = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
};
const label = value => typeof value === 'string' ? value.normalize('NFKC').replace(/[\s\u3000]+/g, '').trim() : '';
const positiveFinish = run => Number.isInteger(run?.finish) && run.finish >= 1 && run.finish <= 3;
const hasEvidence = run => run?.identity_verified === true && run?.source_verified === true && typeof run?.source_ref === 'string' && run.source_ref.startsWith('https://www.keiba.go.jp/');

/**
 * @param {object} input
 * @param {object} input.race - {race_date,track,distance,going,race_name}
 * @param {Array<object>} input.runners - frozen ranked runners with recent_runs (5 verified starts), horse_no and rank
 * @param {object} input.archiveByHorseNo - older verified records keyed by CURRENT race horse_no; no name-only joins
 * @param {number} [input.maxAgeDays=730] - maximum days between a historic start and the target race
 * @returns {{alerts: Array<object>, coverage: object, mode: string}}
 */
export function reviewDeepHistory({ race, runners, archiveByHorseNo, maxAgeDays = 730 }) {
  if (!race || !Array.isArray(runners) || !archiveByHorseNo || typeof archiveByHorseNo !== 'object') throw new TypeError('INVALID_INPUT');
  const target = day(race.race_date);
  if (target === null || !Number.isInteger(race.distance) || !race.track || !race.going || !Number.isInteger(maxAgeDays) || maxAgeDays <= 0) throw new TypeError('INVALID_RACE');
  const alerts = [];
  const coverage = { runners: runners.length, examined: 0, insufficientRecentHistory: 0, unverifiedHistory: 0, noOldExactMatch: 0 };
  for (const runner of runners) {
    if (!Number.isInteger(runner.horse_no) || !Number.isInteger(runner.rank) || runner.rank <= 0) throw new TypeError('INVALID_RUNNER');
    if (runner.rank <= 5) continue; // Research only: focused TOP5 boundary and outside candidates.
    const recent = runner.recent_runs;
    if (!Array.isArray(recent) || recent.length < 5 || recent.slice(0, 5).some(r => day(r?.race_date) === null)) {
      coverage.insufficientRecentHistory++;
      continue;
    }
    // Any order is allowed but the fifth MOST RECENT verified run defines the archive boundary.
    const mostRecentFive = [...recent].sort((a, b) => day(b.race_date) - day(a.race_date)).slice(0, 5);
    const oldestRecent = day(mostRecentFive[4].race_date);
    const archived = archiveByHorseNo[runner.horse_no];
    if (!Array.isArray(archived) || archived.length === 0) {
      coverage.unverifiedHistory++;
      continue;
    }
    coverage.examined++;
    const matches = archived.filter(h => {
      const date = day(h?.race_date);
      return hasEvidence(h) && date !== null && date < oldestRecent && date < target && (target - date) / DAY_MS <= maxAgeDays
        && h.horse_no === runner.horse_no && label(h.horse_name) === label(runner.horse_name)
        && label(h.track) === label(race.track) && Number(h.distance) === race.distance
        && label(h.going) === label(race.going) && positiveFinish(h);
    }).sort((a, b) => day(b.race_date) - day(a.race_date));
    if (!matches.length) {
      coverage.noOldExactMatch++;
      continue;
    }
    const lastFiveFinishes = mostRecentFive.map(r => r.finish).filter(Number.isInteger);
    const poorRecent = lastFiveFinishes.filter(n => n >= 8).length;
    alerts.push({
      horse_no: runner.horse_no, horse_name: runner.horse_name, original_rank: runner.rank,
      review_only: true, auto_promote: false, auto_score_delta: 0,
      exact_old_top3_count: matches.length,
      same_race_name_old_top3_count: matches.filter(h => label(h.race_name) === label(race.race_name)).length,
      evidence: matches.slice(0, 3).map(h => ({race_date:h.race_date, track:h.track, race_name:h.race_name,
        distance:h.distance, going:h.going, finish:h.finish, source_ref:h.source_ref})),
      warnings: [
        'HISTORICAL_FORM_IS_NOT_CURRENT_ABILITY',
        ...(poorRecent ? ['RECENT_8TH_OR_WORSE_'+poorRecent+'_OF_5'] : []),
        'VERIFY_CLASS_AND_OPPOSITION_BEFORE_ANY_RANK_COMPARISON',
      ],
    });
  }
  alerts.sort((a, b) => a.original_rank - b.original_rank || a.horse_no - b.horse_no);
  return { mode: 'READ_ONLY_SHADOW_AUDIT_LOCAL_1_7', alerts, coverage };
}
