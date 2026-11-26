// Append bounded pace contexts to already consumed historical base evidence, by exact horse/race.
// A proxy is not an ability measurement. No extra votes, no rank, no current grade.
export function attachPaceToBase({base,pace}){
 if(base?.scoring_authorized!==false||pace?.scoring_authorized!==false||pace.individual_split_measured!==false||!Array.isArray(base.runners)||!Array.isArray(pace.rows))throw Error('INPUT');
 const runners=new Map(base.runners.map(h=>[h.horse_no,h]));if(runners.size!==base.runners.length)throw Error('DUPLICATE_RUNNER');
 const seen=new Set(),by=new Map([...runners.keys()].map(h=>[h,new Map()]));
 for(const r of pace.rows){
  if(!runners.has(r.horse_no)||r.final_grade_effect!==null)throw Error('PACE_GATE');
  const k=JSON.stringify([r.horse_no,r.source_ref]);if(seen.has(k))throw Error('DUPLICATE_PACE');seen.add(k);
  by.get(r.horse_no).set(r.source_ref,r);
 }
 const out=base.runners.map(h=>{
  const a=h.item01,used=new Set(),bound=[];
  for(const c of [...a.visible_condition_evidence,...a.other_condition_evidence])for(const ref of c.source_refs){
   const r=by.get(h.horse_no).get(ref);if(!r)continue;
   if(used.has(ref))throw Error('DUPLICATE_EVIDENCE');used.add(ref);
   const items={};
   for(const k of ['07','08','11']){
    const e=r.items[k];if(e?.status!=='PROXY_CONTEXT_ONLY')continue;
    const v=e.value;
    if(!v||typeof e.limitation!=='string'||!e.limitation)throw Error('PROXY_GATE');
    items[k]={status:'PROXY_CONTEXT_CONSUMED',value:v,limitation:e.limitation,ability_measured:false,source_ref:ref};
   }
   if(Object.keys(items).length)bound.push({source_ref:ref,prior_date:r.prior_date,source_tier:c.source_tier,conditions:r.conditions,items,evidence_unit:'EXISTING_PRIOR_RACE_NOT_ADDITIONAL_VOTE'});
  }
  return {...h,item01:{...a,pace_contexts:bound,proxy_context_items:['07','08','11'].filter(k=>bound.some(r=>r.items[k])),missing_items:a.missing_items,current_ability:null,final_grade_effect:null}};
 });
 const counts=Object.fromEntries(['07','08','11'].map(k=>[k,{contexts:out.reduce((s,h)=>s+h.item01.pace_contexts.filter(r=>r.items[k]).length,0),horses:out.filter(h=>h.item01.proxy_context_items.includes(k)).length}]));
 return {...base,runners:out,proxy_coverage:counts,complete_items:0,scoring_authorized:false,final_grade_connected:false};
}
