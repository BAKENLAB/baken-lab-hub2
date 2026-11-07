/**
 * Derive purely descriptive LOCAL pre-race passing-order / field composition evidence.
 * Input recent_runs MUST already be validated by finalContext's official-history checks.
 * No ranking, market, odds, result of the target race, or FROZEN modification.
 */
const number = (x) => x === null || x === undefined || x === '' ? null :
  Number.isFinite(Number(x)) ? Number(x) : null;
const positivePosition = (x) => {
  const n=number(x);
  return n !== null && Number.isInteger(n) && n>=1 && n<=24 ? n : null;
};
const safeRuns = (x) => Array.isArray(x) ? x : [];
export function buildLocalFieldPaceEvidence(runners, conditions={}) {
  if(!Array.isArray(runners)||!runners.length||runners.length>20)throw new TypeError('Runners required');
  const distance=number(conditions.distance);
  const surface=typeof conditions.surface==='string' ? conditions.surface : null;
  const perRunner=runners.map((r)=>{
    const observations=safeRuns(r.recent_runs).filter(x=>
      typeof x==='object' && x!==null &&
      typeof x.race_date==='string' &&
      positivePosition(x.early_pos)!==null);
    const similar=observations.filter(x=>
      surface !== null && x.surface===surface &&
      distance!==null && number(x.distance)!==null &&
      Math.abs(number(x.distance)-distance)<=200);
    const repeatedFront=similar.filter(x=>positivePosition(x.early_pos)<=3).length;
    const reliablePair=similar.length>=2;
    const posMoves=observations.filter(x=>positivePosition(x.final_turn_pos)!==null)
      .map(x=>({race_date:x.race_date,early_pos:positivePosition(x.early_pos),
        final_turn_pos:positivePosition(x.final_turn_pos)}));
    return {
      horse_no:r.horse_no,
      prior_early_position_runs:observations.length,
      prior_early_and_final_turn_runs:posMoves.length,
      prior_last3f_runs:safeRuns(r.recent_runs).filter(x=>number(x.final3f)!==null && number(x.final3f)>0).length,
      similar_condition_early_position_runs:similar.length,
      similar_condition_front3_runs:repeatedFront,
      repeated_front_evidence:reliablePair && repeatedFront>=2,
      repeated_front_status:reliablePair?'COMPARABLE':'INSUFFICIENT_RELEVANT_RUNS',
      verified_passing_order_examples:posMoves.slice(0,5)
    };
  });
  const seen=new Set();
  for(const r of perRunner){
    if(!Number.isInteger(r.horse_no)||r.horse_no<1||seen.has(r.horse_no))throw new TypeError('Duplicate/missing horse number');
    seen.add(r.horse_no);
  }
  return {
    source:'CURRENT_OFFICIALLY_VERIFIED_RECENT_RUNS',
    analysis_status:'DESCRIPTIVE_ONLY_NOT_AN_ADOPTED_PACE_MODEL',
    scoring_effect:0,
    present_condition:{surface,distance},
    field_runner_count:perRunner.length,
    runners_with_historical_passing_order:perRunner.filter(x=>x.prior_early_position_runs>0).length,
    runners_with_historical_last3f:perRunner.filter(x=>x.prior_last3f_runs>0).length,
    runners_with_two_or_more_similar_runs:perRunner.filter(x=>x.similar_condition_early_position_runs>=2).length,
    repeated_front_style_contenders:perRunner.filter(x=>x.repeated_front_evidence).length,
    race_lap_data_available:false,
    // No speed/pace direction is asserted from headcount alone.
    race_pace_projection:'NOT_VALIDATED',
    runners:perRunner
  };
}
