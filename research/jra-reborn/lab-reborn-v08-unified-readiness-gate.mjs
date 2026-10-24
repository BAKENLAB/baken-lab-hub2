/**
 * LAB REBORN v0.8 — fail-closed integration / reporting gate.
 * Research-only; reports actual presence of evidence; never scores or writes.
 *
 * Background: independent v03 five axes, v04 2024-fitted ranker, v05
 * separately validated (not approved) content trial, and v06 zero-delta
 * opponent+clock diagnostics were erroneously discussed as a fully
 * integrated candidate. This check prevents that representation.
 *
 * No source results, old LAB score, market/popularity or odds are required.
 */
export const EXPECTED_AXES = Object.freeze([
  "peak","form","course_fit","race_content","rival_strength"
]);
const goodDate=x=>typeof x==="string"&&/^20\d{2}-\d{2}-\d{2}$/.test(x);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const flag=(ok,why)=>({ok,reason:ok?null:why});
/**
 * @param {Object} input
 * {sourceLock,fiveAxisOutput, historyAudit, gradeAudit,
 *  v04Output,v05Output,v06Output, integrationAudit}
 *
 * The only pass conditions are independently demonstrated with source
 * provenance and independent validation, not a model_version string.
 */
export function auditUnifiedRebornReadiness(input={}){
  const s=input.sourceLock??{};
  const source=s.payload??s;
  const sourceDate=s.race_date??source.race_date;
  const rawRunners=Array.isArray(source.runners)?source.runners:[];
  const saved=s.saved_at??source.saved_at,post=s.source_post_time??source.source_post_time;
  const idSet=new Set(rawRunners.map(x=>Number(x.horse_no)));
  const completeInput=goodDate(sourceDate)&&
     typeof saved==="string"&&typeof post==="string"&&
     Number.isFinite(Date.parse(saved))&&Number.isFinite(Date.parse(post))&&
     Date.parse(saved)<Date.parse(post)&&
     rawRunners.length>=6&&
     rawRunners.length===Number(source.field_size)&&
     idSet.size===rawRunners.length&&
     rawRunners.every(x=>x.horse_name&&Array.isArray(x.history)&&
        x.history.every(h=>goodDate(h.race_date)&&h.race_date<sourceDate));
  const five=input.fiveAxisOutput??{};
  const fieldSize=rawRunners.length;
  const axisCount=EXPECTED_AXES.length;
  const knownRunners=Array.isArray(five.runners)?five.runners:[];
  const matchingRosters=knownRunners.length===fieldSize&&
   new Set(knownRunners.map(x=>Number(x.horse_no))).size===fieldSize&&
   knownRunners.every(r=>rawRunners.some(x=>Number(x.horse_no)===Number(r.horse_no)&&x.horse_name===r.horse_name));
  const counts=Object.fromEntries(EXPECTED_AXES.map(axis=>
    [axis,knownRunners.filter(r=>finite(r?.axes?.[axis])).length]));
  const scored=knownRunners.filter(r=>finite(r.score)).length;
  const axesPresent=matchingRosters&&five.status==="RESEARCH_READY"&&
    EXPECTED_AXES.every(x=>counts[x]===fieldSize)&&
    scored===fieldSize;
  const h=input.historyAudit??{};
  const g=input.gradeAudit??{};
  const v4=input.v04Output??{},v5=input.v05Output??{},v6=input.v06Output??{};
  const integration=input.integrationAudit??{};
  const gates={
    immutable_asof_input:flag(completeInput,"MISSING_OR_LATE_PRESTART_INPUT"),
    five_axis_sources:flag(axesPresent,
      "FIVE_AXES_NOT_VERIFIED_FOR_EVERY_RUNNER"),
    history_complete:flag(h.status==="VERIFIED_COMPLETE_AVAILABLE_ASOF"&&
      h.runner_count===fieldSize&&h.unresolved_identities===0&&h.gaps_between_recent_and_archive===0,
      "HISTORY_5_TO_8_OR_RECENT_IDENTITY_UNVERIFIED"),
    graded_race_provenance:flag(g.status==="VERIFIED_ASOF"&&
      g.runner_count===fieldSize&&g.unknown_used_as_known===0,
      "GRADE_TIER_EVIDENCE_INCOMPLETE"),
    fitted_v04_parity:flag(v4.status==="RESEARCH_READY"&&v4.runners?.length===fieldSize&&
      v4.model==="LAB_REBORN_V04_ASOF_2024_FIT"&&input.v04Parity?.source_archive_parity===true,
      "V04_ARCHIVE_LIVE_FEATURE_PARITY_NOT_PROVEN"),
    content_v05_validated:flag(v5.status==="RESEARCH_READY"&&v5.runners?.length===fieldSize&&
      v5.model==="LAB_REBORN_V05_2024_LOCKED_CONTENT"&&
      input.v05Validation?.independent_holdout_supported===true,
      "V05_CONTENT_UPLIFT_NOT_ESTABLISHED"),
    clock_rival_integration:flag(v6.status==="RESEARCH_READY"&&v6.runners?.length===fieldSize&&
      v6.model==="LAB_REBORN_0.6_RESEARCH_DIAGNOSTIC"&&
      v6.computed_uplift===true&&v6.rank_changes_from_v04!==0&&
      input.v06Validation?.independent_holdout_supported===true,
      "V06_IS_ZERO_DELTA_DIAGNOSTIC_NOT_RANKING"),
    unified_scoring:flag(integration.status==="FROZEN_PRESTART_UNIFIED"&&
      integration.runner_count===fieldSize&&integration.all_axes_in_scoring===true&&
      integration.coefficients_locked_before_holdout===true&&
      typeof integration.snapshot_saved_at==="string"&&
      Date.parse(integration.snapshot_saved_at)<Date.parse(post),
      "NO_PRESTART_VALIDATED_COMBINED_SCORE")
  };
  const failures=Object.entries(gates).filter(([,v])=>!v.ok).map(([key,v])=>({gate:key,reason:v.reason}));
  return {
    status:failures.length?"INCOMPLETE_REBORN_REBUILD":"VERIFIED_UNIFIED_REBORN_RESEARCH",
    gates,failures,
    evidence_coverage:{
      runner_count:fieldSize,run_eligible_scored:scored,axis_counts:counts,
      verified_five_axis_horses:knownRunners.filter(r=>EXPECTED_AXES.every(x=>finite(r?.axes?.[x]))).length
    },
    top5_publishable_as_full_reborn:failures.length===0,
    comparison_as_full_reborn_allowed:failures.length===0,
    official_production_write:false,
    original_lab_frozen_modified:false,
    target_result_used:false,
    market_or_odds_used:false,
    note:"A RESEARCH_READY scorer by itself is NOT equivalent to a fully integrated REBORN model."
  };
}
