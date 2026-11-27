const banned=new Set(['finish','margin','clock_ms','final600_ms','checkpoint_ms','checkpoint_ranks','result','payout','odds','popularity']);
export function auditBlindInput(value,path='root',findings=[]){
 if(Array.isArray(value)){value.forEach((v,i)=>auditBlindInput(v,`${path}[${i}]`,findings));return findings;}
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(banned.has(k.toLowerCase()))findings.push({path:`${path}.${k}`,reason:'TARGET_RESULT_OR_MARKET_FIELD'});auditBlindInput(v,`${path}.${k}`,findings);}return findings;
}
export function assertBlindAnalysis(bundle){
 if(bundle.sealed_results.accessible_to_analysis!==false)throw Error('RESULTS_NOT_SEALED');
 if(bundle.analysis.result_reference!==null)throw Error('RESULT_REFERENCE_PRESENT');
 const findings=auditBlindInput(bundle.analysis.target);if(findings.length)throw Error('TARGET_LEAK');
 if(bundle.analysis.runner_supplies.some(r=>r.formal||r.scoring_authorized))throw Error('FORMAL_OR_SCORING_ENABLED');
 return {ok:true,result_docs_visible:0,market_fields:0,formal:false};
}
