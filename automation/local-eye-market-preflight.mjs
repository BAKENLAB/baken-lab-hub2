/**
 * Read-only strict LOCAL EYE market-leak *preflight*.
 * Mirrors the existing production market-word/key checks to prevent a
 * terminal DEAD claim caused by a malformed review BEFORE sending a save.
 *
 * This is NOT a sanitizer. It does not delete/edit rejected evidence.
 * It returns explicit paths. Caller must independently rebuild a new
 * truthful candidate from verifiable pre-race sources. The production
 * validator is unchanged and remains authoritative.
 */
const keyPattern=/odds|popularity|market|人気|オッズ|単勝|市場/i;
const textPattern=/odds|popularity|人気|オッズ|高配当|市場情報/i;
function find(value,path,issues) {
 if(typeof value==='string'){
  if(textPattern.test(value))issues.push({path,reason:'MARKET_TEXT'});
  return;
 }
 if(!value||typeof value!=='object')return;
 if(Array.isArray(value)){
  value.forEach((x,i)=>find(x,path+'['+i+']',issues));
  return;
 }
 for(const [key,v] of Object.entries(value)){
  if(keyPattern.test(key))issues.push({path:path+'.'+key,reason:'MARKET_KEY'});
  find(v,path+'.'+key,issues);
 }
}
export function localEyeMarketPreflight(payload){
 const a=payload?.audit??{};
 const checks=[
  ['audit.eye_candidate_audit',a.eye_candidate_audit],
  ['audit.eye_positive_factor_audit',a.eye_positive_factor_audit],
  ['audit.eye_tie_break',a.eye_tie_break],
  ['eye',payload?.eye]
 ];
 const issues=[];
 for(const [path,v] of checks)find(v,path,issues);
 return {ok:issues.length===0,code:issues.length?'LOCAL_EYE_MARKET_EVIDENCE_PREFLIGHT':'PASS',issues,
  validator_relaxed:false,payload_modified:false};
}
