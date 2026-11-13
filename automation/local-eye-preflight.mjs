/**
 * Read-only preflight for manual LOCAL1.6 MCP saves.
 * This is an additional client-side safety layer, NOT a substitute for the DB guard.
 * Only indexed COMPACT_V1 run references prove track and distance.
 * Generic horse-page URLs are not sufficiently specific for positive factors.
 */
export const VERSION = "CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
export const CHECKS = [
  "distance_change","track_change","going_change","class_change",
  "promotion_demotion","weight_change","jockey_change","draw",
  "running_style","pace_peers","margins","passing_order","final_section",
  "trouble","layoff_preparation","current_suitability","same_condition_history"
];
const REF = /^COMPACT_V1\.runners\[horse_no=(\d+)\]\.recent_runs\[(\d+)\]$/;
const MARKET = /odds|popularity|market|人気|オッズ|単勝|市場|高配当/i;
const setEqual = (a,b) => a.length === b.length &&
  new Set(a).size === a.length && new Set(b).size === b.length &&
  a.every(x=>b.includes(x));
const has = (a,key) => a && Object.hasOwn(a,key);

export function validateLocalEyePreflight(context, payload) {
  const errors = [];
  const fail = value => errors.push(value);
  const audit = payload?.audit || {};
  const horses = Array.isArray(context?.runners) ? context.runners : [];
  const ranked = Array.isArray(payload?.runners) ? payload.runners : [];
  const candidates = Array.isArray(audit.eye_candidate_audit) ? audit.eye_candidate_audit : [];
  const factors = Array.isArray(audit.eye_positive_factor_audit) ? audit.eye_positive_factor_audit : [];
  const byHorse = new Map(horses.map(x=>[x.horse_no,x]));
  const byCandidate = new Map(candidates.map(x=>[x.horse_no,x]));
  if (context?.field_integrity_checked !== true ||
      context?.protocol_version !== VERSION || audit.protocol_version !== VERSION)
    fail("CONTEXT_OR_PROTOCOL_UNVERIFIED");
  if (!Array.isArray(payload?.bets) || payload.bets.length ||
      payload.bet_strategy !== "SUSPENDED_FOR_ABILITY_STABILITY") fail("BETS_CONTRACT");
  if (audit.market_used_for_eye !== false || audit.market_used_for_ranking !== false ||
      MARKET.test(JSON.stringify(ranked)) || MARKET.test(JSON.stringify(factors))) fail("MARKET_EVIDENCE");
  if (horses.length < 5 || !setEqual(horses.map(x=>x.horse_no),ranked.map(x=>x.horse_no)) ||
      !setEqual(ranked.map(x=>x.rank),ranked.map((_,i)=>i+1))) fail("RUNNER_SET_OR_RANKS");
  if (horses.some(x=>!Array.isArray(x.recent_runs) ||
      !x.recent_runs.some(run=>Number.isInteger(run.finish)))) fail("MISSING_VERIFIED_HISTORY");
  const tops=ranked.filter(x=>x.rank<=5).map(x=>x.horse_no);
  if (!Array.isArray(payload?.top5) || !setEqual(tops,payload.top5.map(x=>x.horse_no)) ||
      tops.length!==5) fail("TOP5_SET");
  const outside=ranked.filter(x=>x.rank>5).map(x=>x.horse_no);
  if (!setEqual(outside,candidates.map(x=>x.horse_no)) ||
      !setEqual(outside,factors.map(x=>x.horse_no)) ||
      !Array.isArray(audit.eye_pool_checked) ||
      !setEqual(outside,audit.eye_pool_checked)) fail("EYE_POOL");
  if (audit.eye_selection_method !== "LOCAL_EYE_FACTOR_COUNT_V1" ||
      !Array.isArray(audit.eye_pairwise_comparison) ||
      audit.eye_pairwise_comparison.length || !has(audit,"eye_tie_break")) fail("EYE_SCHEMA");
  for (const c of candidates) {
    if (!c.review_checks || !setEqual(CHECKS,Object.keys(c.review_checks)))
      fail("CHECKS_NOT_17 horse="+c.horse_no);
    if (c.rank !== ranked.find(r=>r.horse_no===c.horse_no)?.rank)
      fail("CANDIDATE_RANK_MISMATCH horse="+c.horse_no);
    for (const [key,v] of Object.entries(c.review_checks||{})) {
      if (!CHECKS.includes(key) || !Array.isArray(v.evidence_refs) ||
          !["CHECKED","MISSING"].includes(v.status) ||
          (v.status==="MISSING" && v.evidence_refs.length))
        fail("CHECK_SCHEMA horse="+c.horse_no+" key="+key);
    }
  }
  const counts=[];
  for (const row of factors) {
    const no=row.horse_no,horse=byHorse.get(no),cand=byCandidate.get(no);
    if (!horse || !cand || !Array.isArray(row.positive_factors) ||
        !setEqual(["horse_no","positive_factors"],Object.keys(row))) {
      fail("FACTOR_ROW_SCHEMA horse="+no);continue;
    }
    const seenCategories=new Set(),seenReasons=new Set(),seenRaces=new Set();
    let current=0;
    for (const [i,f] of row.positive_factors.entries()) {
      const tag="horse="+no+" factor="+(i+1);
      if (!f || !setEqual(["category","reason","evidence_refs","current_relevance"],Object.keys(f)) ||
          !CHECKS.includes(f.category) || !f.reason?.trim() ||
          typeof f.current_relevance!=="boolean" ||
          !Array.isArray(f.evidence_refs) || !f.evidence_refs.length) {
        fail("FACTOR_SCHEMA "+tag);continue;
      }
      if (seenCategories.has(f.category) || seenReasons.has(f.reason.trim()))
        fail("DUPLICATE_FACTOR "+tag);
      seenCategories.add(f.category);seenReasons.add(f.reason.trim());
      const check=cand.review_checks?.[f.category];
      if (check?.status!=="CHECKED") fail("CHECK_NOT_CHECKED "+tag);
      for (const ref of f.evidence_refs) {
        if (!cand.evidence_refs?.includes(ref) || !check?.evidence_refs?.includes(ref))
          fail("FACTOR_UNVERIFIED "+tag);
        const m=typeof ref==="string"?REF.exec(ref):null;
        if (!m || Number(m[1])!==no) {fail("NOT_EXACT_RUN_REFERENCE "+tag);continue;}
        const run=horse.recent_runs[Number(m[2])];
        if (!run || !Number.isInteger(run.finish)) {fail("RUN_UNVERIFIED "+tag);continue;}
        if (context.race?.race_date && run.race_date>=context.race.race_date)
          fail("FUTURE_EVIDENCE "+tag);
        if (f.category==="same_condition_history" &&
            (run.track!==context.race?.track ||
             Number(run.distance)!==Number(context.race?.conditions?.distance)))
          fail("SAME_CONDITION_MISMATCH "+tag);
        if (f.current_relevance) {
          const raceKey=[run.race_date,run.track,run.race_no,run.distance].join(":");
          if(seenRaces.has(raceKey))fail("SAME_RACE_DOUBLE_COUNT "+tag);
          seenRaces.add(raceKey);
        }
      }
      if(f.current_relevance)current++;
    }
    counts.push({horse_no:no,current});
  }
  const qualified=counts.filter(x=>x.current>=2);
  const max=qualified.length?Math.max(...qualified.map(x=>x.current)):0;
  const leaders=qualified.filter(x=>x.current===max).map(x=>x.horse_no);
  const selected=payload?.eye?.horse_no??null;
  const marked=candidates.filter(x=>x.eye_case===true).map(x=>x.horse_no);
  if (selected===null && (marked.length || audit.eye_selected_rank!==null))
    fail("EYE_ABSTENTION_INCONSISTENT");
  if (selected!==null && (marked.length!==1 || marked[0]!==selected ||
      audit.eye_selected_rank!==ranked.find(x=>x.horse_no===selected)?.rank))
    fail("EYE_SELECTION_MISMATCH");
  if (!leaders.length && (selected!==null || audit.eye_tie_break!==null))
    fail("EYE_BELOW_TWO_FACTORS");
  if (leaders.length===1 && (selected!==leaders[0] || audit.eye_tie_break!==null))
    fail("EYE_NOT_MAX_FACTOR_COUNT");
  if (leaders.length>1 && selected!==null &&
      (!leaders.includes(selected) || audit.eye_tie_break?.selected_horse_no!==selected))
    fail("EYE_TIE_UNVERIFIED");
  if (leaders.length>1 && selected===null && audit.eye_tie_break!==null)
    fail("EYE_TIE_ABSTENTION_INCONSISTENT");
  return {ok:errors.length===0,errors,counts};
}
