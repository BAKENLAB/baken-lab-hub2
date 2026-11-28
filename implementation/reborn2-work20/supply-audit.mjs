import {createHash} from 'node:crypto';
const check=(x,m)=>{if(!x)throw Error(m)};
const timestamp=x=>typeof x==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
export const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
export function normalizeInventory(input){
 const rows=Array.isArray(input)?input:input.rows;
 check(rows.length===115&&new Set(rows.map(r=>r.id)).size===115,'ITEM_IDS');
 const out=rows.map(r=>({id:r.id,inputs:r.inputs,direct:r.work16Status==='DIRECT_NOT_PUBLISHED'||(r.work16Status===undefined&&r.direct===true)}));
 check(out.every(r=>Array.isArray(r.inputs)&&r.inputs.length>0)&&out.filter(r=>r.direct).length===15,'DIRECT_STATUS_15');
 return out;
}
const keys={course_geometry_partial:'course_geometry',official_incident_route:'official_incident',prior_result_visible_row_count:'full_prior_result',direct_pair_candidate:'field_identity'};
export function auditSupply({inventory,scope,roster,expectedCount,facts,cutoff,post}){
 const inv=normalizeInventory(inventory);
 check(timestamp(cutoff)&&timestamp(post)&&Date.parse(cutoff)<Date.parse(post),'PREPOST');
 check(Number.isInteger(expectedCount)&&expectedCount>0&&roster.length===expectedCount&&new Set(roster.map(h=>h.no)).size===expectedCount&&roster.every(h=>Number.isInteger(h.no)&&h.no>0),'FULL_DENOMINATOR');
 const obs=[];
 for(const [index,f] of facts.entries()){
  if(f.scope!==scope)continue;
  check(typeof f.source==='string'&&/^https:\/\/(www\.jra\.go\.jp|www\.keiba\.go\.jp|sp\.keiba\.go\.jp)\//.test(f.source),'SOURCE');
  check(typeof f.unit==='string'&&f.unit.length>0&&timestamp(f.observedAt)&&Date.parse(f.observedAt)<=Date.parse(cutoff),'FACT_CUTOFF_OR_UNIT');
  if(f.publishedDate!==undefined)check(/^\d{4}-\d\d-\d\d$/.test(f.publishedDate)&&f.publishedDate<=cutoff.slice(0,10),'PUBLISHED_DATE');
  if(f.no!==undefined)check(roster.some(h=>h.no===f.no),'SUBJECT_SCOPE');
  const key=keys[f.key]??f.key;
  const contextOnly=f.key==='course_geometry_partial';
  const status=f.value===null?(f.reason??'NO_VALUE_OBSERVED'):contextOnly?'COURSE_VERSION_OR_DISTANCE_UNBOUND':f.no!==undefined?'NATIVE_ID_LINK_UNVERIFIED':f.key==='official_travel'?'GROUP_MEMBERS_NOT_BOUND':'EVENT_OR_RELATION_NOT_BOUND';
  obs.push({id:'W19-'+index,key,originalKey:f.key,value:f.value,unit:f.unit,source:f.source,observedAt:f.observedAt,publishedDate:f.publishedDate??null,publicationPrecision:f.publishedDate?'DATE_ONLY':'UNKNOWN',no:f.no??null,scope,pastEvent:f.pastEvent??null,contextOnly,status,tier:f.tier??'UNVERIFIED',original:f});
  if(f.publishedDate&&f.no!==undefined)obs.push({id:'W19-'+index+'-DATE',key:'published_time',originalKey:f.key,value:f.publishedDate,unit:'calendar_date_JST',source:f.source,observedAt:f.observedAt,publishedDate:f.publishedDate,publicationPrecision:'DATE_ONLY',no:f.no,scope,pastEvent:null,contextOnly:false,status:'EXACT_PUBLICATION_TIME_AND_NATIVE_ID_UNBOUND',tier:f.tier??'UNVERIFIED'});
 }
 const rows=[];
 for(const horse of roster)for(const i of inv){
  const held=obs.filter(o=>i.inputs.includes(o.key)&&(o.no===horse.no||o.contextOnly));
  rows.push({no:horse.no,item:i.id,identityStatus:horse.identityStatus??'NOT_BOUND',directMeasureStatus:i.direct?'DIRECT_MEASUREMENT_NOT_PUBLISHED':'NOT_A_DIRECT_MEASUREMENT_LIMIT',candidateRefs:held.map(o=>o.id),available:[],missing:i.inputs.map(k=>({key:k,reason:held.find(o=>o.key===k)?.status??'NOT_OBSERVED_OR_NOT_IMPLEMENTED'})),judgment:'NOT_CERTIFIED'});
 }
 const result={schema:'WORK20_BOUNDARY_AUDIT_1',scope,cutoff,post,expectedCount,roster,inventoryDigest:digest(inv),observations:obs,unboundContext:obs.filter(o=>o.no===null&&!o.contextOnly).map(o=>o.id),rows,formalAdmission:false,publicationAllowed:false};
 return {...result,digest:digest(result)};
}
