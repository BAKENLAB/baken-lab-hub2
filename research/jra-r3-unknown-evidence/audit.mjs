/**
 * REBORN R3: evidence-versus-unknown audit (research only).
 *
 * No network, no DB, no market data, no score changes, no rank changes,
 * no EYE/bets, and no writes. Caller must pass pre-race history only.
 * An audit flag is NOT a recommendation to change a saved TOP5.
 */
const isFiniteNumber = n => typeof n === 'number' && Number.isFinite(n);
const numberOf = n => n === null || n === undefined || n === '' ? null :
  (isFiniteNumber(Number(n)) ? Number(n) : null);
const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !Number.isNaN(Date.parse(d + 'T00:00:00Z'));
const isTop3 = r => Number.isInteger(numberOf(r?.finish)) && numberOf(r.finish) >= 1 && numberOf(r.finish) <= 3;
const isWin = r => numberOf(r?.finish) === 1;
const isObstacle = r => /障害|ジャンプ|障|jump|steeple/i.test(
  [r?.race_type, r?.discipline, r?.race_class, r?.race_class_detail].filter(Boolean).join(' ')
);
const gradeFromRecord = r => {
  const grade = [r?.race_grade, r?.grade, r?.race_class_detail, r?.race_class]
    .filter(Boolean).join(' ');
  return /(?:G[123ⅠⅡⅢ]|Ｇ[１２３]|GⅠ|GⅡ|GⅢ|重賞|グレード)/i.test(grade);
};
const classMatches = (race, record) => {
  const current = String(race.class_name ?? '');
  const historical = [record.race_class, record.race_class_detail, record.race_grade].filter(Boolean).join(' ');
  if (/オープン|OPEN|OP|G[123ⅠⅡⅢ]|Ｇ[１２３]/i.test(current)) {
    return /オープン|OPEN|OP|G[123ⅠⅡⅢ]|Ｇ[１２３]/i.test(historical) || gradeFromRecord(record);
  }
  if (/3勝/.test(current)) return /3勝/.test(historical);
  if (/2勝/.test(current)) return /2勝/.test(historical);
  if (/1勝/.test(current)) return /1勝/.test(historical);
  if (/未勝利/.test(current)) return /未勝利/.test(historical);
  return historical.includes(current) && current.length > 0;
};
const uniqueSorted = array => [...new Set(array)].sort();
const fail = msg => { throw new Error('R3_DATA_ERROR: ' + msg); };

/**
 * @param {{race_date:string,track:string,surface:string,distance:number,class_name:string}} race
 * @param {Array<{horse_no:number,horse_name:string,rank:number,score:number,past_runs:Array<object>}>} runners
 * @returns {{model:string,scope:string,comparison_anchor:object,audits:Array<object>,review_queue:Array<object>,prediction_unchanged:true}}
 */
export function auditUnknownCapability(race, runners) {
  if (!race || !validDate(race.race_date) || typeof race.track !== 'string' || !race.track ||
    !['芝', 'ダート'].includes(race.surface) || !Number.isInteger(race.distance) ||
    race.distance <= 0 || typeof race.class_name !== 'string' || !race.class_name) fail('invalid race');
  if (!Array.isArray(runners) || runners.length < 5) fail('five or more runners required');
  const numbers = new Set(), ranks = new Set();
  for (const r of runners) {
    if (!r || !Number.isInteger(r.horse_no) || r.horse_no < 1 ||
      typeof r.horse_name !== 'string' || !r.horse_name.trim() ||
      !Number.isInteger(r.rank) || r.rank < 1 || !isFiniteNumber(r.score) ||
      !Array.isArray(r.past_runs)) fail('invalid runner or missing pre-race history list');
    if (numbers.has(r.horse_no) || ranks.has(r.rank)) fail('duplicate horse or rank');
    numbers.add(r.horse_no); ranks.add(r.rank);
  }
  if (![1,2,3,4,5].every(n => ranks.has(n))) fail('saved TOP5 ranks missing');
  const fifth = runners.find(r => r.rank === 5);
  const anchor = {horse_no:fifth.horse_no,horse_name:fifth.horse_name,rank:5,score:fifth.score};
  const audits = runners.map(r => {
    const omitted = [];
    const seen = new Set();
    // Reject records with missing/after-race dates; never use current-race results.
    const historical = r.past_runs.filter(h => {
      if (!h || !validDate(h.race_date) || h.race_date >= race.race_date) {
        omitted.push('INVALID_OR_NON_PRERACE_HISTORY'); return false;
      }
      if (seen.has(h.race_date + ':' + (h.race_class || '') + ':' + (h.distance || ''))) {
        omitted.push('DUPLICATE_HISTORY'); return false;
      }
      seen.add(h.race_date + ':' + (h.race_class || '') + ':' + (h.distance || ''));
      return true;
    }).sort((a,b) => b.race_date.localeCompare(a.race_date));
    const comparable = historical.filter(h => !isObstacle(h) && h.surface === race.surface);
    const close = comparable.filter(h => Math.abs(numberOf(h.distance) - race.distance) <= 300);
    const recent = comparable.slice(0,2);
    const positives = [];
    if (recent.length === 2 && recent.every(isTop3)) positives.push('TWO_RECENT_TOP3');
    if (recent.length > 0 && isWin(recent[0]) &&
      numberOf(recent[0].margin_to_winner) >= 0.3) positives.push('DECISIVE_RECENT_WIN');
    const exactGood = close.filter(h => numberOf(h.distance) === race.distance && isTop3(h));
    if (exactGood.length >= 2) positives.push('REPEATED_EXACT_DISTANCE_TOP3');
    const lower = close.some(h => numberOf(h.distance) < race.distance && isTop3(h));
    const upper = close.some(h => numberOf(h.distance) > race.distance && isTop3(h));
    if (lower && upper) positives.push('POSITIVE_DISTANCE_BRIDGE');
    if (comparable.some(h => gradeFromRecord(h) && isTop3(h))) positives.push('VERIFIED_GRADED_TOP3');
    if (close.some(h => h.track === race.track && isTop3(h))) positives.push('SAME_TRACK_NEAR_DISTANCE_TOP3');
    // Separate uncertainty from actual negative performance evidence.
    const unknown = [];
    if (!historical.some(h => classMatches(race,h))) unknown.push('CLASS_UNTESTED');
    if (!comparable.some(h => h.track === race.track && numberOf(h.distance) === race.distance)) {
      unknown.push('EXACT_COURSE_UNTESTED');
    }
    if (!comparable.some(h => numberOf(h.distance) === race.distance)) unknown.push('EXACT_DISTANCE_UNTESTED');
    if (comparable.length === 0) unknown.push('SURFACE_UNTESTED');
    const contradiction = [];
    const poor = close.filter(h => numberOf(h.finish) >= 8 &&
      numberOf(h.margin_to_winner) >= 1.5);
    if (poor.length >= 2) contradiction.push('REPEATED_COMPARABLE_DEFEATS');
    // Count distinct historical race dates, not repeating the same single result twice.
    const goodDates = new Set(comparable.filter(h => isTop3(h)).map(h => h.race_date));
    const review = r.rank > 5 && positives.length >= 2 && goodDates.size >= 2;
    return {
      horse_no:r.horse_no, horse_name:r.horse_name, original_rank:r.rank,
      original_score:r.score, category:review?'REVIEW_REQUIRED':'NO_AUTOMATIC_REVIEW',
      capability_evidence:uniqueSorted(positives),
      unknown_conditions:uniqueSorted(unknown),
      explicit_contradictions:uniqueSorted(contradiction),
      history_warnings:uniqueSorted(omitted),
      verified_good_races:goodDates.size,
      grade_unverified_without_explicit_record:!comparable.some(gradeFromRecord),
      // Only comparison, no replacement of fifth or overwriting any saved field.
      comparison_anchor:{...anchor}, original_score_gap_to_fifth:r.score-anchor.score,
      proposed_rank:null, proposed_score:null,
      review_instruction:review
        ? 'COMPARE_WITH_ALL_TOP5_BY_ABILITY_AND_COUNTEREVIDENCE'
        : 'KEEP_INDEPENDENT_BASELINE'
    };
  });
  const reviewQueue = audits.filter(x => x.category === 'REVIEW_REQUIRED')
    .sort((a,b) => a.original_rank-b.original_rank);
  return {
    model:'JRA_REBORN_R3_UNKNOWN_EVIDENCE_RESEARCH_20261031',
    scope:'READ_ONLY_AUDIT_ONLY',
    comparison_anchor:{...anchor},
    audits,
    review_queue:reviewQueue,
    prediction_unchanged:true
  };
}
