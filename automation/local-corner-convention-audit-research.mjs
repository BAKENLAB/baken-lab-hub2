/** Research-only comparison. Legacy first-group rank and archived individual rank
 * can differ by convention. A numeric match alone does not prove exact position.
 * A range must come from separately verified full official corner order, not inferred.
 * Never overwrites either source, never authorizes rank. */
export function compareCornerWitness({legacyPosition,archivePosition,range=null}={}){
 const pos=x=>Number.isInteger(x)&&x>=1&&x<=24;
 if(!pos(legacyPosition)||!pos(archivePosition))return {status:"MISSING_OR_INVALID",rank_authorized:false};
 if(range!==null){
  const {position_min:lo,position_max:hi,position_exact:exact}=range;
  if(!pos(lo)||!pos(hi)||lo>hi||legacyPosition!==lo||(lo===hi?exact!==lo:exact!==null))return {status:"RANGE_CONFLICT",rank_authorized:false};
  if(archivePosition<lo||archivePosition>hi)return {status:"OUTSIDE_VERIFIED_RANGE",rank_authorized:false};
  return {status:lo===hi?"EXACT_POSITION_AGREES":"COMPATIBLE_WITH_VERIFIED_GROUP_RANGE",rank_authorized:false};
 }
 return {status:legacyPosition===archivePosition?"NUMERIC_AGREEMENT_ONLY":"CONVENTION_OR_SOURCE_MISMATCH",rank_authorized:false};
}
