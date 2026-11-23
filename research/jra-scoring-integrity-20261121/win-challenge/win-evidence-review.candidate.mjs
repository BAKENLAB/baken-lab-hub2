/**
 * JRA WIN-CHALLENGE — research-only pre-race evidence REVIEW, not a scoring model.
 *
 * Intentionally has no scoring function, odds inputs, persistence, race-result
 * access, rank promotion, EYE selection or bet selection. Comparisons identify
 * horses requiring a *human* rank/◎ reassessment before an otherwise regular
 * guarded CLAIM/FROZEN. The original approved scoring engine is NOT replaced.
 */
const validDate = s => typeof s === 'string' && /^20\d\d-\d\d-\d\d$/.test(s);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const safeNo = n => Number.isInteger(n) && n >= 1 && n <= 24;
const noChange = reason => ({
  ok: false, reason, classification: 'UNAPPROVED_RESEARCH_PREFLIGHT',
  production_scoring_authorized: false, official_save_allowed: false,
  ranking_changed: false, auto_promoted: false, bet_recommendation: null
});
const differenceInDays = (later,earlier) =>
  Math.round((Date.parse(later + 'T00:00:00Z') - Date.parse(earlier + 'T00:00:00Z')) / 86400000);
function inspectHorse(race, horse, history) {
  const material = history.map((p,i) => {
    if (!validDate(p.prior_date) || p.prior_date >= race.race_date) throw Error('POSTRACE_OR_INVALID_PRIOR_DATE');
    const days=differenceInDays(race.race_date,p.prior_date);
    if (!Number.isInteger(days) || days < 1) throw Error('INVALID_ASOF_INTERVAL');
    const sameSurface=p.prior_surface === race.surface,
      nearDistance=sameSurface && finite(p.prior_distance) &&
        Math.abs(p.prior_distance - race.distance) <= 200,
      exactCourse=nearDistance && p.prior_track === race.track &&
        p.prior_distance === race.distance,
      close=finite(p.margin_to_winner) && p.margin_to_winner <= 0.7,
      corner=Array.isArray(p.live_corner_positions) ? p.live_corner_positions : [],
      front=corner.length >= 2 && corner.at(-1) <= 3;
    return {source_ref:p.source_ref || 'CLAIMED_CONTEXT_RUN:' + horse.horse_no + ':' + i,
      date:p.prior_date,days,exactCourse,nearDistance,close,front,
      finishing_margin:finite(p.margin_to_winner) ? p.margin_to_winner : null,
      finish:Number.isInteger(p.finish)?p.finish:null};
  });
  material.sort((a,b)=>a.days-b.days);
  const recent=material.filter(p=>p.days<=70),
    nearClose=recent.filter(p=>p.nearDistance && p.close),
    exactClose=material.filter(p=>p.days<=120 && p.exactCourse && p.close),
    frontClose=recent.filter(p=>p.nearDistance && p.close && p.front),
    recentExactPodium=recent.filter(p=>p.exactCourse && p.finish!==null && p.finish<=3 &&
      p.finishing_margin!==null && p.finishing_margin<=0.5),
    latest=material[0];
  return {horse_no:horse.horse_no,horse_name:horse.horse_name,official_rank:horse.rank,
    official_score:horse.score,history_count:material.length,
    recent_near_close_count:nearClose.length,
    exact_course_close_count:exactClose.length,
    front_close_count:frontClose.length,
    recent_exact_podium_count:recentExactPodium.length,
    latest_near_bad:!!(latest && latest.days<=70 && latest.nearDistance &&
      latest.finishing_margin!==null && latest.finishing_margin>1.5),
    decisive_win_proof:false, // A win is never guaranteed from prior race results.
    evidence_refs:[...new Set([...nearClose,...exactClose,...frontClose,...recentExactPodium].map(x=>x.source_ref))],
    evidence_missing:material.length===0};
}
/** Fail closed if pre-race lineage or complete field evidence cannot be checked. */
export function inspectResearchWinChallenge({race,top5,historyByHorse,marketExcluded=true}={}) {
  if (!race || !validDate(race.race_date) || !race.track ||
      !race.surface || !finite(race.distance) || race.distance <=0 ||
      !Array.isArray(top5) || top5.length !== 5 ||
      !top5.every((x,i)=>x?.rank===i+1 && safeNo(x.horse_no) &&
        Number.isInteger(x.score) && x.score>=0 && x.score<=100) ||
      new Set(top5.map(x=>x.horse_no)).size!==5)
    return noChange('MISSING_PRE_RACE_TOP5_OR_TARGET');
  if (marketExcluded!==true) return noChange('MARKET_INPUT_NOT_PROVEN_EXCLUDED');
  if (!historyByHorse || typeof historyByHorse!=='object')
    return noChange('HISTORY_MISSING');
  const reviewed=[];
  for (const h of top5) {
    const past=historyByHorse[h.horse_no];
    if (!Array.isArray(past) || past.length===0)
      return noChange('HISTORY_MISSING_FOR_TOP5_HORSE_' + h.horse_no);
    try { reviewed.push(inspectHorse(race,h,past)); }
    catch(err) { return noChange('INVALID_ASOF_HISTORY_' + h.horse_no + '_' + err.message); }
  }
  const top=reviewed[0],others=reviewed.slice(1),gap=top.official_score-reviewed[1].official_score;
  const challengers=others.filter(h=>
    (h.recent_exact_podium_count>0 && top.recent_exact_podium_count===0) ||
    h.exact_course_close_count>top.exact_course_close_count ||
    (h.recent_near_close_count>top.recent_near_close_count &&
     top.latest_near_bad && !h.latest_near_bad)
  ).map(h=>h.horse_no);
  const flags=[];
  if (gap<=2) flags.push('LOW_SCORE_GAP_TO_2ND');
  if (top.history_count>=4) flags.push('TOP1_HAS_FOUR_OR_MORE_HISTORY_ROWS_CHECK_VOLUME_EFFECTS');
  if (top.recent_near_close_count===0) flags.push('TOP1_NO_RECENT_NEAR_DISTANCE_CLOSE_FORM');
  if (top.latest_near_bad) flags.push('TOP1_RECENT_RELEVANT_LOSS');
  if (challengers.length) flags.push('OTHER_TOP5_HAS_STRONGER_CURRENT_DIRECT_EVIDENCE');
  return {ok:true,reason:'REVIEW_ONLY_NO_SCORE_OR_RANK_MUTATION',
    classification:'UNAPPROVED_RESEARCH_PREFLIGHT',review_required:flags.length>0,
    current_official_honmei:top.horse_no,
    original_top5:top5.map(x=>x.horse_no),
    challenge_candidate_horse_nos:challengers,
    human_review_flags:flags, per_top5:reviewed,
    production_scoring_authorized:false,official_save_allowed:false,
    ranking_changed:false,auto_promoted:false,
    proposed_rank_change:null,score_deltas:null,
    bet_recommendation:null,
    evidence_limitation:'CLAIM/history fields are pre-race facts, not original issuer-signed bytes; do not count available facts as a certified new factor-weight model.'
  };
}
