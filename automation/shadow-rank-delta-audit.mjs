/**
 * Read-only paired rank-delta audit for JRA0.4 and LOCAL1.6.
 * Never computes a production rank, changes a FROZEN prediction, or accesses odds.
 * The proposed order must come from an independently tested shadow evaluator.
 */
const circuits=new Set(['JRA','LOCAL']);
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const int=x=>Number.isInteger(x)&&x>=1&&x<=24;
function validatedOrder(rows,field,label){
 if(!Array.isArray(rows)||rows.length!==field.length)throw Error(label+'_ROSTER_INCOMPLETE');
 const seen=new Set();
 for(const row of rows){
  if(!int(row.horse_no)||!norm(row.horse_name)||seen.has(row.horse_no)||
     field.find(f=>f.horse_no===row.horse_no)?.horse_name!==norm(row.horse_name))
    throw Error(label+'_ROSTER_MISMATCH');
  seen.add(row.horse_no);
 }
 return rows.map(x=>x.horse_no);
}
function evidenceAudit(evidence,asOf){
 if(!Array.isArray(evidence))throw Error('EVIDENCE_REQUIRED');
 const seen=new Set();
 for(const item of evidence){
  if(!int(item.horse_no)||!Number.isInteger(item.fact_count)||item.fact_count<0||
     !['PASSING_ORDER','LAP','SAME_CONDITION','WIN_LOSS_CAUSE','FIELD_STYLE'].includes(item.category)||
     !['VERIFIED','MISSING','UNVERIFIED'].includes(item.status)||
     typeof item.source_ref!=='string'||!item.source_ref.trim()||
     !Number.isFinite(Date.parse(item.checked_at))||
     Date.parse(item.checked_at)>Date.parse(asOf)||
     !/^\d{4}-\d{2}-\d{2}$/.test(item.past_race_date)||
     item.past_race_date>=asOf.slice(0,10)||
     item.status!=='VERIFIED'&&item.fact_count!==0)
    throw Error('EVIDENCE_NOT_AS_OF_VERIFIED');
  const key=[item.horse_no,item.category,item.source_ref,item.past_race_date].join('|');
  if(seen.has(key))throw Error('DUPLICATE_EVIDENCE');seen.add(key);
 }
 return evidence;
}
/**
 * Expected input:
 * baseline/proposed are FULL-FIELD arrays sorted strongest first.
 * resultFinisherNos are historical actual top 3, and are used only for offline
 * post-result comparison, never fed into the pre-race evaluator.
 */
export function auditShadowRankDelta({
 circuit,modelVersion,race,field,baseline,proposed,
 evidence,asOf,resultFinisherNos
}){
 if(!circuits.has(circuit)||modelVersion!==(circuit==='JRA'?'0.4':'1.6')||
    !race||!/^\d{4}-\d{2}-\d{2}$/.test(race.race_date)||
    !Number.isInteger(race.race_no)||!race.track||
    !Number.isFinite(Date.parse(asOf))||asOf.slice(0,10)!==race.race_date)
   throw Error('AUDIT_SCOPE_INVALID');
 if(!Array.isArray(field)||field.length<5||field.length>20)throw Error('FIELD_INVALID');
 const cleanField=field.map(x=>({horse_no:x.horse_no,horse_name:norm(x.horse_name)}));
 if(cleanField.some(x=>!int(x.horse_no)||!x.horse_name)||
    new Set(cleanField.map(x=>x.horse_no)).size!==cleanField.length||
    field.some(x=>Object.keys(x).some(k=>/odds|popularity|market|price/i.test(k))))
   throw Error('FIELD_INVALID_OR_MARKET_CONTAMINATION');
 const a=validatedOrder(baseline,cleanField,'BASELINE');
 const b=validatedOrder(proposed,cleanField,'PROPOSED');
 if(!Array.isArray(resultFinisherNos)||resultFinisherNos.length!==3||
    new Set(resultFinisherNos).size!==3||
    resultFinisherNos.some(n=>!a.includes(n)))throw Error('RESULT_INVALID');
 const facts=evidenceAudit(evidence,asOf);
 if(facts.some(e=>!a.includes(e.horse_no)))throw Error('EVIDENCE_OUTSIDE_FIELD');
 const before=new Set(a.slice(0,5)),after=new Set(b.slice(0,5));
 const entrants=b.slice(0,5).filter(n=>!before.has(n));
 const displaced=a.slice(0,5).filter(n=>!after.has(n));
 const hits=order=>resultFinisherNos.filter(n=>order.slice(0,5).includes(n));
 const beforeHits=hits(a),afterHits=hits(b);
 const changes=cleanField.map(h=>{
  const old=a.indexOf(h.horse_no)+1,next=b.indexOf(h.horse_no)+1;
  const related=facts.filter(f=>f.horse_no===h.horse_no);
  return {...h,baseline_rank:old,shadow_rank:next,rank_change:old-next,
   verified_fact_count:related.filter(x=>x.status==='VERIFIED').reduce((n,x)=>n+x.fact_count,0),
   missing_categories:[...new Set(related.filter(x=>x.status!=='VERIFIED').map(x=>x.category))]};
 }).filter(x=>x.rank_change!==0);
 return {
  circuit,modelVersion,race,asOf,mode:'POST_RESULT_RESEARCH_ONLY',
  baseline_top5:a.slice(0,5),shadow_top5:b.slice(0,5),
  newly_selected:entrants,lost_from_top5:displaced,
  baseline_top3_captured:beforeHits.length,shadow_top3_captured:afterHits.length,
  newly_captured_finishers:afterHits.filter(n=>!beforeHits.includes(n)),
  lost_captured_finishers:beforeHits.filter(n=>!afterHits.includes(n)),
  winning_horse_baseline_top5:before.has(resultFinisherNos[0]),
  winning_horse_shadow_top5:after.has(resultFinisherNos[0]),
  changes,verified_evidence_rows:facts.filter(x=>x.status==='VERIFIED').length,
  missing_evidence_rows:facts.filter(x=>x.status!=='VERIFIED').length,
  production_rank_changed:false,frozen_modified:false,market_used:false
 };
}
