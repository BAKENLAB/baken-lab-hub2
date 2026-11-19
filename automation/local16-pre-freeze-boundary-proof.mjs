/**
 * LOCAL1.6 independent fifth-versus-sixth evidence gate.
 * Pure read-only diagnostic. It is NOT an alternative scorer or permission to save.
 * Never reads target results, changes TOP5, promotes rank6/EYE or writes FROZEN.
 */
export const LOCAL16_BOUNDARY_POLICY = "LOCAL16_PRE_FREEZE_BOUNDARY_PROOF_V1";
const PROTOCOL = "CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
const REF = /^COMPACT_V1\.runners\[horse_no=(\d+)\]\.recent_runs\[(\d+)\]$/;
const forbidden = /(?:odds|popularity|market|オッズ|人気|単勝|市場|高配当)/i;
const object = v => !!v && typeof v === "object" && !Array.isArray(v);
const no = x => Number.isInteger(x) && x >= 1;
const text = x => typeof x === "string" && x.trim().length >= 10;
const verdict = (status, code, details = {}) => ({
  policy: LOCAL16_BOUNDARY_POLICY,
  status, code,
  review_documented: false, score_certified: false,
  score_changed: false, rank_changed: false, eye_changed: false,
  frozen_modified: false, target_result_used: false, market_used: false,
  save_authorized: false, ...details
});
const reference = (ref, horse) => {
  const m = typeof ref === "string" ? ref.match(REF) : null;
  return !!(m && Number(m[1]) === horse.horse_no &&
    Number(m[2]) < horse.recent_runs.length);
};
const recentPodiums = (horse, race) => horse.recent_runs.filter(run => {
  const date = Date.parse(run.race_date + "T00:00:00Z");
  const target = Date.parse(race.race_date + "T00:00:00Z");
  return Number.isFinite(date) && target > date && target - date <= 120 * 86400000 &&
    run.track === race.track && run.distance === race.conditions.distance &&
    Number.isInteger(run.finish) && run.finish >= 1 && run.finish <= 3;
}).length;

/** The 5/6 comparison is mandatory for a narrow gap in this diagnostic.
 * No arbitrary score coefficients and no approval to publish are produced.
 */
export function auditLocal16PreFreezeBoundary({
  race, verifiedRunners, draft, observationAt, comparison = null
} = {}) {
  if (!object(race) || !/^\d{4}-\d{2}-\d{2}$/.test(race.race_date ?? "") ||
      !race.track || !no(race.race_no) || !object(race.conditions) ||
      !Number.isInteger(race.conditions.distance) ||
      !Number.isFinite(Date.parse(race.post_time)) ||
      !Number.isFinite(Date.parse(observationAt)) ||
      Date.parse(observationAt) >= Date.parse(race.post_time) ||
      Object.hasOwn(race,"result") || Object.hasOwn(race,"finishers") ||
      !object(draft) || Object.hasOwn(draft,"result") || Object.hasOwn(draft,"finishers") ||
      draft.audit?.protocol_version !== PROTOCOL ||
      !Array.isArray(verifiedRunners) || verifiedRunners.length < 6 ||
      !Array.isArray(draft.runners) || draft.runners.length !== verifiedRunners.length)
    return verdict("INVALID","PRE_RACE_OFFICIAL_CONTEXT_REQUIRED");
  const source = new Map();
  for (const h of verifiedRunners) {
    if (!no(h?.horse_no) || !h.horse_name || source.has(h.horse_no) ||
        !Array.isArray(h.recent_runs) ||
        h.recent_runs.some(r => !/^\d{4}-\d{2}-\d{2}$/.test(r?.race_date ?? "") ||
          r.race_date >= race.race_date))
      return verdict("INVALID","PAST_RUN_SOURCE_OR_ROSTER_INVALID");
    source.set(h.horse_no,h);
  }
  const sorted = [...draft.runners].sort((a,b) => a.rank - b.rank);
  if (!Array.isArray(draft.top5) || draft.top5.length !== 5 ||
      sorted.some((r,i) => r.rank !== i+1 || !source.has(r.horse_no) ||
        source.get(r.horse_no).horse_name !== r.horse_name ||
        !Number.isInteger(r.score) || r.score < 0 || r.score > 100 ||
        (i > 0 && r.score > sorted[i-1].score)) ||
      draft.top5.some((r,i) => r.horse_no !== sorted[i].horse_no ||
        r.rank !== sorted[i].rank || r.score !== sorted[i].score))
    return verdict("INVALID","RANK_SCORE_OR_TOP5_CONFLICT");
  const fifth = sorted[4], sixth = sorted[5], gap = fifth.score - sixth.score;
  const a = source.get(fifth.horse_no), b = source.get(sixth.horse_no);
  const clues = {
    rank5: {horse_no: fifth.horse_no, score: fifth.score,
      same_venue_distance_podiums_120d: recentPodiums(a,race)},
    rank6: {horse_no: sixth.horse_no, score: sixth.score,
      same_venue_distance_podiums_120d: recentPodiums(b,race)},
    gap,
    sixth_same_condition_podium_advantage:
      recentPodiums(b,race) > recentPodiums(a,race)
  };
  if (gap > 4) return verdict("OBSERVED","NOT_NARROW_BOUNDARY",{boundary:clues});
  if (!comparison) return verdict("REVIEW_REQUIRED","NARROW_BOUNDARY_TWO_SIDED_PROOF_MISSING",
    {boundary:clues});
  const accepted = ["KEEP_FIFTH","REVISE_DRAFT","UNDECIDED"];
  const fail = (code) => verdict("INVALID",code,{boundary:clues});
  if (!object(comparison) || comparison.rank5_horse_no !== fifth.horse_no ||
      comparison.rank6_horse_no !== sixth.horse_no ||
      !accepted.includes(comparison.conclusion) ||
      !text(comparison.fifth_advantage_reason) ||
      !text(comparison.sixth_counter_case_reason) ||
      forbidden.test(comparison.fifth_advantage_reason) ||
      forbidden.test(comparison.sixth_counter_case_reason) ||
      !Array.isArray(comparison.fifth_evidence_refs) ||
      !Array.isArray(comparison.sixth_evidence_refs) ||
      comparison.fifth_evidence_refs.length === 0 ||
      comparison.sixth_evidence_refs.length === 0 ||
      comparison.fifth_evidence_refs.length > 5 ||
      comparison.sixth_evidence_refs.length > 5 ||
      comparison.fifth_evidence_refs.some(r=>!reference(r,a)) ||
      comparison.sixth_evidence_refs.some(r=>!reference(r,b)))
    return fail("PAIR_COMPARISON_UNSUPPORTED");
  if (comparison.conclusion !== "KEEP_FIFTH")
    return verdict("REVIEW_REQUIRED","PAIR_RANK_UNRESOLVED",
      {boundary:clues,review_documented:true,
       explanation:"No auto-promotion. Re-evaluate every horse on independent pre-start facts."});
  return verdict("PROOF_DOCUMENTED_UNCERTIFIED","NARROW_BOUNDARY_REFERENCES_RECORDED",
    {boundary:clues,review_documented:true,
     explanation:"Two-sided evidence is recorded, but 100-point arithmetic is not independently certified."});
}
