// Research-only arithmetic port of the *recorded* base scoring declaration
// "round(30+38*base_rate)" seen in Nov21 JRA FROZEN. Its use on Nov22 is
// diagnostics only. This does not authenticate historical as-of base_rate,
// official original data, formula approval, manual factor weights, or points.
const parse = text => {
  if (typeof text !== 'string' || !/^(?:0|1)(?:\.\d+)?$/.test(text))
    throw Error('EXACT_BOUNDED_RATE_STRING_REQUIRED');
  const [whole, decimals=''] = text.split('.');
  const den=10n**BigInt(decimals.length);
  const num=BigInt(whole)*den+BigInt(decimals||'0');
  if(num<0n || num>den)throw Error('BASE_RATE_OUTSIDE_ZERO_ONE');
  return {num,den};
};
export function calculateRecoveredBase30_38(rateText){
  const {num,den}=parse(rateText);
  const numerator=30n*den+38n*num;
  // Exact PostgreSQL numeric ROUND for nonnegative values (ties away from 0).
  const result=(2n*numerator+den)/(2n*den);
  return Number(result);
}
export function compareRecoveredBase({rateText,submittedBase}={}){
  if(!Number.isSafeInteger(submittedBase)||submittedBase<0||submittedBase>100)
    return {ok:false,reason:'DECLARED_BASE_INVALID',formal_scoring_allowed:false};
  let calculated;
  try{calculated=calculateRecoveredBase30_38(rateText);}
  catch{return {ok:false,reason:'BASE_RATE_MISSING_OR_INVALID',formal_scoring_allowed:false};}
  return {ok:calculated===submittedBase,reason:calculated===submittedBase?
    'NUMERIC_BASE_FORMULA_MATCH_NOT_ASOF_PROOF':'NUMERIC_BASE_FORMULA_DRIFT',
    calculated_base:calculated,submitted_base:submittedBase,
    difference:submittedBase-calculated,asof_input_verified:false,
    official_original_verified:false,formal_scoring_allowed:false};
}
