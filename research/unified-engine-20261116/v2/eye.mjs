import {meaningful,setEqual,verifyRecord} from '../input.mjs';
export function selectResearchEye({race,ranked,factsByHorse,review,cutoff}){
 const outside=ranked.filter(r=>r.rank>5),ids=outside.map(r=>r.horse_id),no=(status,extra={})=>({status,horse_id:null,formal_audit_complete:false,pool:ids,rank6_auto_selected:false,...extra});
 if(!review)return no('FORMAL_REVIEW_REQUIRED');
 if(!verifyRecord(review,Date.parse(cutoff)))return no('REVIEW_NOT_LOCKED_ASOF');
 if(!Array.isArray(review.runners)||!setEqual(review.runners.map(r=>r.horse_id),ids)||!Array.isArray(review.comparisons)||review.comparisons.length!==ids.length*(ids.length-1)/2)return no('OUTSIDE_FIELD_OR_PAIRS_INCOMPLETE');
 const pairs=new Set();for(const p of review.comparisons){if(p.a===p.b||!ids.includes(p.a)||!ids.includes(p.b)||!meaningful(p.reason))return no('INVALID_PAIR');pairs.add([p.a,p.b].sort().join('|'));}if(pairs.size!==review.comparisons.length)return no('DUPLICATE_PAIR');
 const accepted=new Map();const audit=[];
 for(const a of review.runners){if(!meaningful(a.reason)||!Array.isArray(a.risks)||!a.risks.length||a.risks.some(x=>!meaningful(x))||!Array.isArray(a.missing)||!Array.isArray(a.positives))return no('INDIVIDUAL_REVIEW_INCOMPLETE');
  const mechanisms=new Set(),atoms=new Set(),roots=new Set(),ok=[];const available=factsByHorse.get(a.horse_id)??new Map(),checks=[];
  for(const p of a.positives){const ev=Array.isArray(p.fact_ids)?p.fact_ids.map(id=>available.get(id)):[];
   let reason=null;if(!p.mechanism||mechanisms.has(p.mechanism)||!meaningful(p.independence_reason)||p.current_relevance?.race_id!==race.race_id||!meaningful(p.current_relevance?.reason)||!meaningful(p.current_relevance?.reproduction_route))reason='MECHANISM_OR_CURRENT_RELEVANCE_MISSING';
   else if(!ev.length||ev.some(f=>!f||!f.verified||atoms.has(f.id)))reason='ATOMIC_EVIDENCE_UNVERIFIED_OR_DUPLICATED';
   else if(ev.some(f=>roots.has(f.prior_key))&&(p.dependence_audit?.distinct_dimensions!==true||!meaningful(p.dependence_audit?.reason)))reason='SHARED_RACE_INDEPENDENCE_UNPROVEN';
   checks.push({mechanism:p.mechanism,status:reason??'SUPPORTED_EXPLICIT_REVIEW'});if(reason)continue;
   mechanisms.add(p.mechanism);for(const f of ev){atoms.add(f.id);roots.add(f.prior_key);}ok.push(p);
  }
  accepted.set(a.horse_id,ok);audit.push({horse_id:a.horse_id,positives:checks,risks:a.risks,missing:a.missing,reason:a.reason});
 }
 if(review.selected_horse_id===null){if(!meaningful(review.reason))return no('NULL_REASON_REQUIRED');return {...no('AUDITED_NO_SELECTION'),formal_audit_complete:true,audit,comparisons:review.comparisons};}
 const id=review.selected_horse_id;
 if(!ids.includes(id)||accepted.get(id).length<2||!meaningful(review.reason))return no('TWO_DISTINCT_CURRENT_SUPPORTED_MECHANISMS_REQUIRED',{audit});
 return {status:'FORMALLY_REVIEWED_RESEARCH_EYE',horse_id:id,formal_audit_complete:true,pool:ids,accepted_positives:accepted.get(id),audit,comparisons:review.comparisons,reason:review.reason,rank6_auto_selected:false,requires_front_gate:false,preserved_baseline_eye:false};
}
