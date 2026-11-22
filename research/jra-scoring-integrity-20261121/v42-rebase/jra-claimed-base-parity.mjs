// Prospective research-only gate: base score in submitted audit must equal
// the base computed from the SAME authenticated CLAIM context candidate rate.
// The historic 30+38 formula was observed on 11/21 and 11/22 morning but is
// NOT an approved source-to-full-100-point scorer. Default absent pin refuses.
const approvedId='JRA_RESEARCH_BASE_30PLUS38_V1';
const reject=(reason,other={})=>({ok:false,reason,formal_scoring_allowed:false,
 official_original_verified:false,...other});
function expected(rate) {
 const text=typeof rate==='number'&&Number.isFinite(rate)?String(rate):rate;
 if(typeof text!=='string'||!/^(?:0|1)(?:\.\d+)?$/.test(text))
   throw Error('INVALID_CURRENT_CLAIM_RATE');
 const [whole,decimal='']=text.split('.');
 const denom=10n**BigInt(decimal.length);
 const numer=BigInt(whole)*denom+BigInt(decimal||'0');
 if(numer<0n||numer>denom)throw Error('INVALID_CURRENT_CLAIM_RATE');
 return Number((2n*(30n*denom+38n*numer)+denom)/(2n*denom));
}
export function inspectClaimedBaseParity({context,payload,serverPinnedBasePolicy}={}){
 if(serverPinnedBasePolicy!==approvedId)
   return reject('SERVER_BASE_POLICY_NOT_PINNED');
 const candidates=context?.candidates, reviews=payload?.audit?.runner_history_checked;
 if(!Array.isArray(candidates)||!Array.isArray(reviews)||!candidates.length||
    candidates.length!==reviews.length)
   return reject('BASE_PARITY_FIELD_COVERAGE');
 const seen=new Set();
 for(const c of candidates) {
   if(!Number.isInteger(c.horse_no)||seen.has(c.horse_no))
     return reject('BASE_PARITY_DUPLICATE_CANDIDATE');
   seen.add(c.horse_no);
   const found=reviews.filter(r=>r.horse_no===c.horse_no);
   if(found.length!==1||!Number.isSafeInteger(found[0].base_score))
     return reject('BASE_PARITY_MISSING_REVIEW',{horse_no:c.horse_no});
   let calc;
   try{calc=expected(c.base_rate);}catch{
     return reject('BASE_PARITY_INVALID_CONTEXT_RATE',{horse_no:c.horse_no});
   }
   if(calc!==found[0].base_score)
     return reject('BASE_PARITY_MISMATCH',{horse_no:c.horse_no,
       submitted_base:found[0].base_score,recomputed_base:calc});
 }
 return {ok:true,reason:'CLAIM_CONTEXT_BASE_ARITHMETIC_MATCH_ONLY',
   inspected_horses:seen.size,formal_scoring_allowed:false,
   original_context_immutability_proven:false,official_original_verified:false};
}
