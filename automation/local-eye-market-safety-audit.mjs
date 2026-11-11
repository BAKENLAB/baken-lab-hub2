/**
 * Read-only mirror of the production LOCAL EYE market-evidence hard guard.
 * Intentionally fail-closed on any appearance of these tokens including
 * NEGATED phrases such as "人気薄を理由にしない".
 *
 * DO NOT strip or rewrite words to get past the production gate. This audit
 * rejects early, before the official save MCP is called. No CLAIM or SAVE.
 */
const marketKey=/odds|popularity|market|人気|オッズ|単勝|市場/i;
const marketText=/odds|popularity|人気|オッズ|高配当|市場情報/i;
const isObject=x=>x!==null&&typeof x==='object';
function scan(value,path,issues){
 if(typeof value==='string'){
  if(marketText.test(value))issues.push({path,reason:'FORBIDDEN_MARKET_TEXT'});
  return;
 }
 if(!isObject(value))return;
 for(const [k,v] of Object.entries(value)){
  const p=path+(Array.isArray(value)?'['+k+']':'.'+k);
  if(marketKey.test(k))issues.push({path:p,reason:'FORBIDDEN_MARKET_KEY'});
  scan(v,p,issues);
 }
}
export function checkLocalEyeTextBeforeSave({payload,protocolVersion}={}){
 const issues=[];
 if(protocolVersion!=='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'||
    !payload||!isObject(payload.audit))
  return {ok:false,status:'INVALID_LOCAL_PRE_SAVE_OPTIONS',issues:[]};
 // Exact source sections used by production local-claimed-mcp v19.
 // A summary may contain an explanation of separating market from capability;
 // this scanner does not claim to validate the entire payload.
 for(const [path,value] of [
  ['audit.eye_candidate_audit',payload.audit.eye_candidate_audit],
  ['audit.eye_positive_factor_audit',payload.audit.eye_positive_factor_audit],
  ['audit.eye_pairwise_comparison',payload.audit.eye_pairwise_comparison],
  ['audit.eye_tie_break',payload.audit.eye_tie_break],
  ['audit.eye_abstention_reason',payload.audit.eye_abstention_reason],
  ['eye',payload.eye]
 ])scan(value,path,issues);
 return {ok:issues.length===0,
  status:issues.length?'LOCAL_EYE_MARKET_EVIDENCE_PRE_SAVE_BLOCK':'TEXT_GUARD_OK',
  issues};
}
