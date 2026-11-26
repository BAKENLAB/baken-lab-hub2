// REBORN2 research-only audit contract. Not a prediction model or permission to release.
// Coverage is an engineering trace, not proof that every available factor must positively change a grade.
const items=Array.from({length:100},(_,i)=>String(i+1).padStart(2,'0'));
const steps=['source_verified','identity_asof_verified','analysis_executed','analysis_validated','assessment_consumed'];
const states=new Set(['PASS','BLOCKED','NOT_APPLICABLE']);
export function auditRebornTrace({roster,traces}) {
 if(!Array.isArray(roster)||!roster.length||new Set(roster).size!==roster.length||!Array.isArray(traces))throw Error('INVALID_INPUT');
 const allowed=new Set(roster),seen=new Map();
 for(const t of traces){
  if(!allowed.has(t.horse_no)||!items.includes(t.item)||!t.stages||steps.some(s=>!states.has(t.stages[s]?.state)))throw Error('INVALID_TRACE');
  const k=JSON.stringify([t.horse_no,t.item]);
  if(seen.has(k))throw Error('DUPLICATE_TRACE');
  let stopped=false,allNA=true;
  for(const s of steps){
   const x=t.stages[s];
   if(x.state==='PASS'){
    if(stopped||!Array.isArray(x.evidence_ids)||!x.evidence_ids.length||x.evidence_ids.some(id=>typeof id!=='string'||!id.trim()))throw Error('UNSUPPORTED_PASS');
    allNA=false;
   }else{
    stopped=true;
    if(typeof x.reason!=='string'||!x.reason.trim())throw Error('MISSING_REASON');
    if(x.state!=='NOT_APPLICABLE')allNA=false;
   }
  }
  if(t.stages.assessment_consumed.state==='PASS'&&(!['SUPPORT','CONTRADICT','NEUTRAL'].includes(t.assessment_effect)||typeof t.assessment_ref!=='string'||!t.assessment_ref.trim()))throw Error('UNBOUND_ASSESSMENT');
  if(t.stages.assessment_consumed.state!=='PASS'&&t.assessment_effect!=null)throw Error('UNSUPPORTED_EFFECT');
  seen.set(k,{t,allNA});
 }
 const coverage={};
 for(const item of items){
  const a=roster.map(h=>seen.get(JSON.stringify([h,item]))),passed=a.filter(x=>x?.t.stages.assessment_consumed.state==='PASS').length,na=a.filter(x=>x?.allNA).length;
  coverage[item]={expected:roster.length,consumed:passed,not_applicable:na,blocked:roster.length-passed-na,missing_trace:a.filter(x=>!x).length};
 }
 const missing=Object.values(coverage).reduce((s,x)=>s+x.missing_trace,0),blocked=Object.values(coverage).reduce((s,x)=>s+x.blocked,0);
 return {coverage,missing,blocked,trace_complete:missing===0&&blocked===0,release_authorized:false};
}
